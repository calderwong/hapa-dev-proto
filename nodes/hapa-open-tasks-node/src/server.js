import fs from 'node:fs';
import path from 'node:path';

import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { v4 as uuidv4 } from 'uuid';

import { loadConfig } from './config.js';
import { requireBearerToken } from './auth.js';
import { openDb } from './db.js';
import { openEventLog } from './eventLog.js';
import { createEmptyState, getTask, listStatusDefinitions, listTasks } from './state.js';
import { applyEvent, catchUpFromLog, getLastAppliedSeq, loadStateFromDb } from './projector.js';
import { readAllowedTextFile } from './markdown.js';
import { seedIfEmpty } from './seed.js';

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

function pickTaskPatch(body) {
  const patch = {};

  if (typeof body.kind === 'string') patch.kind = body.kind;
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.description === 'string') patch.description = body.description;
  if (typeof body.status_key === 'string') patch.status_key = body.status_key;

  return patch;
}

function normalizeStatusInput(s) {
  const statusKey = s?.status_key ?? s?.key;
  if (!statusKey || typeof statusKey !== 'string') return null;

  const orderIndex = Number.isFinite(s.order_index) ? s.order_index : parseInt(String(s.order_index || '0'), 10);

  return {
    status_key: statusKey,
    name: typeof s.name === 'string' ? s.name : statusKey,
    order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
    color: typeof s.color === 'string' ? s.color : null,
    is_terminal: !!s.is_terminal
  };
}

async function main() {
  const config = loadConfig();

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

  await seedIfEmpty({ core, appendEvent });

  await catchUpFromLog(core, db, state);
  loadStateFromDb(db, state);

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
      service: 'hapa-open-tasks-node',
      time: new Date().toISOString()
    };
  });

  app.get('/v1/capabilities', async () => {
    return {
      service: 'hapa-open-tasks-node',
      api_version: '0.1.0',
      open_read: true,
      write_auth: 'bearer',
      markdown_roots: config.markdownRoots,
      storage: {
        event_log: 'hypercore',
        projection: 'sqlite'
      }
    };
  });

  app.get('/v1/system', async () => {
    return {
      ok: true,
      host: config.host,
      port: config.port,
      event_log_length: core.length,
      last_applied_seq: getLastAppliedSeq(db),
      counts: {
        tasks: state.tasksById.size,
        refs: Array.from(state.refsByTaskId.values()).reduce((n, arr) => n + arr.length, 0),
        status_definitions: state.statusDefinitions.length
      }
    };
  });

  app.get('/v1/events', async (req) => {
    const since = parseInt(req.query?.since || '0', 10);
    const limitRaw = parseInt(req.query?.limit || '200', 10);
    const limit = Math.max(1, Math.min(1000, Number.isFinite(limitRaw) ? limitRaw : 200));

    const rows = db
      .prepare(
        'SELECT seq, event_id, ts, type, actor, data_json FROM events WHERE seq >= ? ORDER BY seq ASC LIMIT ?'
      )
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

  app.get('/v1/status-definitions', async () => {
    return {
      ok: true,
      statuses: listStatusDefinitions(state)
    };
  });

  app.post('/v1/status-definitions', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const statusesRaw = Array.isArray(req.body?.statuses) ? req.body.statuses : null;
    if (!statusesRaw) {
      reply.code(400);
      return { ok: false, error: 'Missing statuses' };
    }

    const statuses = [];
    for (const s of statusesRaw) {
      const normalized = normalizeStatusInput(s);
      if (!normalized) continue;
      statuses.push(normalized);
    }

    const { seq } = await appendEvent({
      id: uuidv4(),
      ts: Date.now(),
      type: 'status_definitions.set',
      actor: getActor(req),
      data: { statuses }
    });

    return { ok: true, seq, statuses: listStatusDefinitions(state) };
  });

  app.get('/v1/tasks', async (req) => {
    const status = req.query?.status;
    const kind = req.query?.kind;

    return {
      ok: true,
      tasks: listTasks(state, { status, kind })
    };
  });

  app.get('/v1/tasks/:task_id', async (req, reply) => {
    const taskId = req.params.task_id;
    const task = getTask(state, taskId);
    if (!task) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }
    return { ok: true, task };
  });

  app.post('/v1/tasks', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const title = String(req.body?.title || '').trim();
    if (!title) {
      reply.code(400);
      return { ok: false, error: 'Missing title' };
    }

    const actor = getActor(req);
    const now = Date.now();

    const task = {
      task_id: uuidv4(),
      kind: typeof req.body?.kind === 'string' ? req.body.kind : 'task',
      title,
      description: typeof req.body?.description === 'string' ? req.body.description : '',
      status_key: typeof req.body?.status_key === 'string' ? req.body.status_key : 'BACKLOG',
      created_at: now,
      updated_at: now,
      created_by: actor,
      updated_by: actor
    };

    const { seq } = await appendEvent({
      id: uuidv4(),
      ts: now,
      type: 'task.created',
      actor,
      data: { task }
    });

    return { ok: true, seq, task };
  });

  app.patch('/v1/tasks/:task_id', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const taskId = req.params.task_id;
    const prev = state.tasksById.get(taskId);
    if (!prev) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    const patch = pickTaskPatch(req.body || {});
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
      type: 'task.updated',
      actor,
      data: { task_id: taskId, patch }
    });

    const task = getTask(state, taskId);
    return { ok: true, seq, task };
  });

  app.post('/v1/tasks/:task_id/refs', async (req, reply) => {
    if (!requireBearerToken(req, reply, config)) return;

    const taskId = req.params.task_id;
    const task = state.tasksById.get(taskId);
    if (!task) {
      reply.code(404);
      return { ok: false, error: 'NOT_FOUND' };
    }

    const kind = typeof req.body?.kind === 'string' ? req.body.kind : 'markdown';
    const refPath = typeof req.body?.path === 'string' ? req.body.path : '';
    if (!refPath) {
      reply.code(400);
      return { ok: false, error: 'Missing path' };
    }

    const actor = getActor(req);
    const now = Date.now();

    const ref = {
      ref_id: uuidv4(),
      task_id: taskId,
      kind,
      path: refPath,
      label: typeof req.body?.label === 'string' ? req.body.label : null,
      created_at: now,
      created_by: actor
    };

    const { seq } = await appendEvent({
      id: uuidv4(),
      ts: now,
      type: 'task.ref.added',
      actor,
      data: { ref }
    });

    return { ok: true, seq, ref, task: getTask(state, taskId) };
  });

  app.get('/v1/markdown', async (req, reply) => {
    const requestedPath = req.query?.path;

    try {
      const result = await readAllowedTextFile({
        requestedPath,
        roots: config.markdownRoots
      });
      return { ok: true, ...result };
    } catch (err) {
      reply.code(400);
      return { ok: false, error: String(err?.message || err) };
    }
  });

  const address = await app.listen({ host: config.host, port: config.port });
  const actualPort = app.server.address()?.port || config.port;

  writeRuntimeFile(config.runtimeFilePath, {
    pid: process.pid,
    host: config.host,
    port: actualPort,
    base_url: `http://${config.host}:${actualPort}`,
    started_at: new Date().toISOString(),
    token_file: config.tokenFilePath
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
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
