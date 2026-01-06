import fs from 'node:fs';
import path from 'node:path';

import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { v4 as uuidv4 } from 'uuid';

import { requireBearerToken } from './auth.js';
import { API_VERSION, DEFAULT_PORT, SERVICE_NAME, loadConfig } from './config.js';
import { openDb } from './db.js';
import { openEventLog } from './eventLog.js';
import { applyEvent, catchUpFromLog, getLastAppliedSeq, loadStateFromDb } from './projector.js';
import { createEmptyState, getAgent, listAgents } from './state.js';
import { createAvatarClient } from './avatarClient.js';
import { acquirePortLease } from './portLease.js';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeRuntimeFile(runtimeFilePath, runtime) {
  ensureDir(path.dirname(runtimeFilePath));
  fs.writeFileSync(runtimeFilePath, JSON.stringify(runtime, null, 2), 'utf8');
}

function removeRuntimeFile(runtimeFilePath) {
  try {
    fs.unlinkSync(runtimeFilePath);
  } catch {
  }
}

function createWriteLock() {
  let chain = Promise.resolve();

  return async function withLock(fn) {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };
}

function sanitizeActor(actor) {
  const s = String(actor || '').trim();
  if (!s) return 'anonymous';
  return s.slice(0, 80);
}

function getActor(req) {
  const headerActor = req.headers?.['x-hapa-actor'];
  if (headerActor) return sanitizeActor(headerActor);
  const bodyActor = req.body?.actor;
  if (bodyActor) return sanitizeActor(bodyActor);
  return 'anonymous';
}

function pickAgentPatch(body) {
  const patch = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name) patch.name = name;
  }

  return patch;
}

function cleanAvatarName(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return n.slice(0, 80);
}

function buildExpandAvatarBody(reqBody, avatarName, defaultAsyncMode = true) {
  const body = reqBody && typeof reqBody === 'object' ? reqBody : {};

  const out = {
    avatar_name: cleanAvatarName(avatarName),
    async_mode: body.async_mode !== undefined ? !!body.async_mode : defaultAsyncMode
  };

  const optionalFields = [
    'base_prompt',
    'base_image_asset_id',
    'base_image_base64',
    'model',
    'negative_prompt',
    'steps',
    'seed',
    'width',
    'height',
    'quantize',
    'guidance',
    'low_ram',
    'image_strength',
    'variants',
    'poses',
    'timeout_seconds',
    'poll_interval_seconds'
  ];

  for (const k of optionalFields) {
    if (body[k] !== undefined) out[k] = body[k];
  }

  return out;
}

async function main() {
  const config = loadConfig();

  const basePort = config.port && config.port >= 1 ? config.port : DEFAULT_PORT;
  const preferredPort = config.port && config.port >= 1 ? config.port : null;

  const lease = await acquirePortLease({
    service: SERVICE_NAME,
    host: config.host,
    basePort,
    preferredPort,
    instance: config.instance,
    pid: process.pid
  });

  ensureDir(config.storageDir);

  const db = openDb(config.dbPath);
  const state = createEmptyState();

  const core = await openEventLog({ coreDir: config.coreDir });
  const withWriteLock = createWriteLock();

  const appendEvent = async (event) => {
    return withWriteLock(async () => {
      await core.append(event);
      const seq = core.length - 1;
      db.transaction(() => {
        applyEvent(db, state, { seq, event });
      })();
      return { seq, event };
    });
  };

  await catchUpFromLog(core, db, state);
  loadStateFromDb(db, state);

  const avatarClient = createAvatarClient({
    mode: config.avatarMode,
    baseUrl: config.avatarBaseUrl,
    token: config.avatarToken
  });

  const app = fastify({ logger: true });

  app.register(fastifyStatic, {
    root: path.join(config.repoRoot, 'web'),
    prefix: '/',
    index: ['index.html']
  });

  app.get('/health', async () => {
    return {
      ok: true,
      status: 'healthy',
      service: SERVICE_NAME,
      time: new Date().toISOString()
    };
  });

  app.get('/v1/capabilities', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    return {
      ok: true,
      service: SERVICE_NAME,
      api_version: API_VERSION,
      auth: 'bearer',
      storage: {
        event_log: 'hypercore',
        projection: 'sqlite'
      },
      avatar: {
        mode: config.avatarMode,
        base_url: config.avatarBaseUrl || null
      },
      endpoints: {
        health: 'GET /health',
        capabilities: 'GET /v1/capabilities',
        system: 'GET /v1/system',
        events: 'GET /v1/events',
        agents: 'GET /v1/agents',
        agent: 'GET /v1/agents/:agent_id',
        create_agent: 'POST /v1/agents',
        update_agent: 'PATCH /v1/agents/:agent_id',
        expand_avatar: 'POST /v1/agents/:agent_id/avatar/expand',
        avatar_status: 'GET /v1/agents/:agent_id/avatar/status',
        avatar_preview: 'GET /v1/agents/:agent_id/avatar/preview',
        avatar_export: 'POST /v1/agents/:agent_id/avatar/export'
      }
    };
  });

  app.get('/v1/system', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    return {
      ok: true,
      host: config.host,
      port: lease.port,
      event_log_length: core.length,
      last_applied_seq: getLastAppliedSeq(db),
      counts: {
        agents: state.agentsById.size
      },
      port_lease: {
        lease_file: lease.lease_file,
        runtime_file: lease.runtime_file
      }
    };
  });

  app.get('/v1/events', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const since = parseInt(req.query?.since || '0', 10);
    const limitRaw = parseInt(req.query?.limit || '200', 10);
    const limit = Math.max(1, Math.min(1000, Number.isFinite(limitRaw) ? limitRaw : 200));

    const rows = db
      .prepare('SELECT seq, event_id, ts, type, actor, data_json FROM events WHERE seq >= ? ORDER BY seq ASC LIMIT ?')
      .all(Number.isFinite(since) ? since : 0, limit);

    return {
      ok: true,
      events: rows.map((r) => ({
        seq: r.seq,
        id: r.event_id,
        ts: r.ts,
        type: r.type,
        actor: r.actor,
        data: JSON.parse(r.data_json)
      }))
    };
  });

  app.get('/v1/agents', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;
    return { ok: true, agents: listAgents(state) };
  });

  app.get('/v1/agents/:agent_id', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const agent = getAgent(state, agentId);
    if (!agent) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    return { ok: true, agent };
  });

  app.post('/v1/agents', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const name = String(req.body?.name || '').trim();
    if (!name) {
      reply.code(400);
      return { ok: false, error: 'Missing name' };
    }

    const actor = getActor(req);
    const now = Date.now();

    const agent = {
      agent_id: uuidv4(),
      name,
      created_at: now,
      updated_at: now,
      created_by: actor,
      updated_by: actor,
      avatar_name: null,
      avatar_status: null,
      avatar_job_id: null,
      avatar_base_url: null,
      avatar_error: null,
      avatar_result_json: null
    };

    const { seq } = await appendEvent({
      id: uuidv4(),
      ts: now,
      type: 'agent.created',
      actor,
      data: { agent }
    });

    return { ok: true, seq, agent };
  });

  app.patch('/v1/agents/:agent_id', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const prev = getAgent(state, agentId);
    if (!prev) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    const patch = pickAgentPatch(req.body || {});
    if (Object.keys(patch).length === 0) {
      reply.code(400);
      return { ok: false, error: 'No patch fields provided' };
    }

    const actor = getActor(req);
    patch.updated_at = Date.now();
    patch.updated_by = actor;

    const { seq } = await appendEvent({
      id: uuidv4(),
      ts: Date.now(),
      type: 'agent.updated',
      actor,
      data: { agent_id: agentId, patch }
    });

    return { ok: true, seq, agent: getAgent(state, agentId) };
  });

  app.post('/v1/agents/:agent_id/avatar/expand', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const agent = getAgent(state, agentId);
    if (!agent) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    const actor = getActor(req);

    const requestedName = cleanAvatarName(req.body?.avatar_name);
    const avatarName = requestedName || cleanAvatarName(agent.avatar_name) || `agent_${agent.agent_id.slice(0, 8)}`;

    const expandBody = buildExpandAvatarBody(req.body, avatarName, true);

    let response;
    try {
      response = await avatarClient.expandAvatar(expandBody);
    } catch (err) {
      const msg = String(err?.message || err);
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.failed',
        actor,
        data: { agent_id: agentId, error: msg }
      });
      reply.code(400);
      return { ok: false, error: msg, agent: getAgent(state, agentId) };
    }

    if (!response || response.ok !== true) {
      const error = String(response?.error || 'Avatar request failed');
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.failed',
        actor,
        data: { agent_id: agentId, error }
      });
      reply.code(400);
      return { ok: false, error, response, agent: getAgent(state, agentId) };
    }

    await appendEvent({
      id: uuidv4(),
      ts: Date.now(),
      type: 'agent.avatar.job_started',
      actor,
      data: {
        agent_id: agentId,
        job: {
          avatar_name: avatarName,
          job_id: response.job_id || null,
          avatar_base_url: config.avatarBaseUrl || null
        }
      }
    });

    if (response.status === 'succeeded' && response.result) {
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.completed',
        actor,
        data: {
          agent_id: agentId,
          result: response.result
        }
      });
    } else if (response.status === 'failed') {
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.failed',
        actor,
        data: {
          agent_id: agentId,
          error: String(response.error || 'Avatar job failed')
        }
      });
    }

    return {
      ok: true,
      response,
      agent: getAgent(state, agentId)
    };
  });

  app.get('/v1/agents/:agent_id/avatar/status', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const agent = getAgent(state, agentId);
    if (!agent) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    if (!agent.avatar_job_id) {
      reply.code(400);
      return { ok: false, error: 'Missing avatar_job_id', agent };
    }

    const actor = getActor(req);

    let job;
    try {
      job = await avatarClient.status(agent.avatar_job_id);
    } catch (err) {
      reply.code(400);
      return { ok: false, error: String(err?.message || err), agent };
    }

    if (job && job.status === 'succeeded' && agent.avatar_status !== 'succeeded' && job.result) {
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.completed',
        actor,
        data: {
          agent_id: agentId,
          result: job.result
        }
      });
    } else if (job && job.status === 'failed' && agent.avatar_status !== 'failed') {
      await appendEvent({
        id: uuidv4(),
        ts: Date.now(),
        type: 'agent.avatar.failed',
        actor,
        data: {
          agent_id: agentId,
          error: String(job.error || 'Avatar job failed')
        }
      });
    }

    return { ok: true, job, agent: getAgent(state, agentId) };
  });

  app.get('/v1/agents/:agent_id/avatar/preview', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const agent = getAgent(state, agentId);
    if (!agent) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    if (!agent.avatar_name) {
      reply.code(400);
      return { ok: false, error: 'Missing avatar_name', agent };
    }

    try {
      const preview = await avatarClient.preview(agent.avatar_name);
      return { ok: true, preview };
    } catch (err) {
      reply.code(400);
      return { ok: false, error: String(err?.message || err) };
    }
  });

  app.post('/v1/agents/:agent_id/avatar/export', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const agentId = req.params.agent_id;
    const agent = getAgent(state, agentId);
    if (!agent) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    if (!agent.avatar_name) {
      reply.code(400);
      return { ok: false, error: 'Missing avatar_name', agent };
    }

    try {
      const exported = await avatarClient.exportAvatar(agent.avatar_name);
      return { ok: true, exported };
    } catch (err) {
      reply.code(400);
      return { ok: false, error: String(err?.message || err) };
    }
  });

  const address = await app.listen({ host: config.host, port: lease.port });
  const actualPort = app.server.address()?.port || lease.port;

  lease.writeRuntime({
    baseUrl: `http://${config.host}:${actualPort}`,
    tokenPath: config.tokenFilePath,
    storageDir: config.storageDir,
    extra: {
      node_api_version: API_VERSION,
      repo_root: config.repoRoot
    }
  });

  writeRuntimeFile(config.runtimeFilePath, {
    pid: process.pid,
    host: config.host,
    port: actualPort,
    base_url: `http://${config.host}:${actualPort}`,
    started_at: new Date().toISOString(),
    token_file: config.tokenFilePath,
    lease_file: lease.lease_file,
    port_manager_runtime_file: lease.runtime_file
  });

  app.log.info(`Listening on ${address}`);

  const shutdown = async () => {
    try {
      await app.close();
    } catch {
    }
    try {
      db.close();
    } catch {
    }
    try {
      await core.close();
    } catch {
    }
    removeRuntimeFile(config.runtimeFilePath);
    try {
      lease.release({ removeRuntime: true });
    } catch {
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
