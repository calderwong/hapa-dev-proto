import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import assert from 'node:assert/strict';
import test from 'node:test';

import Database from 'better-sqlite3';

import { getRepoRoot } from '../src/config.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRuntime(runtimeFilePath) {
  try {
    const txt = fs.readFileSync(runtimeFilePath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function waitForRuntime(runtimeFilePath, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const runtime = loadRuntime(runtimeFilePath);
    if (runtime && runtime.base_url) return runtime;
    await sleep(150);
  }
  return null;
}

async function fetchJson(url, { timeoutMs = 4000, ...opts } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    const txt = await res.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = null;
    }
    return { status: res.status, json, text: txt };
  } finally {
    clearTimeout(t);
  }
}

function safeTail(s, maxChars = 4000) {
  if (!s) return '';
  if (s.length <= maxChars) return s;
  return s.slice(s.length - maxChars);
}

async function waitForExit(child, timeoutMs = 8000) {
  if (!child || child.exitCode !== null) return;

  await Promise.race([
    new Promise((resolve) => {
      child.once('exit', resolve);
    }),
    (async () => {
      await sleep(timeoutMs);
      throw new Error('Timed out waiting for server process to exit');
    })()
  ]);
}

function normalizeIsoForFilename(iso) {
  return String(iso).replace(/[:.]/g, '-');
}

async function waitForAgentStatus({ baseUrl, token, agentId, desiredStatus, timeoutMs = 8000 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetchJson(`${baseUrl}/v1/agents/${encodeURIComponent(agentId)}`, {
      timeoutMs: 2000,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (res.status === 200 && res.json?.ok) {
      const status = res.json.agent?.avatar_status;
      if (status === desiredStatus) return res.json.agent;
    }

    await sleep(150);
  }

  return null;
}

test('hapa-agent-registry-node self test', async () => {
  const repoRoot = getRepoRoot();
  const startedAt = new Date().toISOString();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hapa-agent-registry-selftest-'));

  const storageDir = path.join(tempDir, 'storage');
  const runtimeFilePath = path.join(tempDir, 'runtime.json');
  const runtimeRoot = path.join(tempDir, 'hapa_runtime');

  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });

  const token = `self_test_${Date.now()}`;
  const dbPath = path.join(storageDir, 'agent_registry.db');

  const env = {
    ...process.env,
    HAPA_AGENT_REGISTRY_HOST: '127.0.0.1',
    HAPA_AGENT_REGISTRY_PORT: '8737',
    HAPA_AGENT_REGISTRY_TOKEN: token,
    HAPA_AGENT_REGISTRY_STORAGE_DIR: storageDir,
    HAPA_AGENT_REGISTRY_DB_PATH: dbPath,
    HAPA_AGENT_REGISTRY_RUNTIME_FILE: runtimeFilePath,
    HAPA_AGENT_REGISTRY_INSTANCE: 'self_test',
    HAPA_AGENT_REGISTRY_AVATAR_MODE: 'stub',
    HAPA_RUNTIME_DIR: runtimeRoot
  };

  const report = {
    ok: false,
    started_at: startedAt,
    temp_dir: tempDir,
    runtime: null,
    base_url: null,
    db_path: dbPath,
    agent_id: null,
    system: null,
    steps: [],
    errors: []
  };

  const reportDir = path.join(repoRoot, 'artifacts', 'self_test');
  const reportPathLatest = path.join(reportDir, 'agent_registry_self_test_latest.json');
  const reportPathTimestamped = path.join(
    reportDir,
    `agent_registry_self_test__${normalizeIsoForFilename(startedAt)}.json`
  );

  let child = null;
  let stdout = '';
  let stderr = '';

  const writeReport = () => {
    try {
      fs.mkdirSync(reportDir, { recursive: true });
      const payload = {
        ...report,
        finished_at: new Date().toISOString(),
        stdout_tail: safeTail(stdout),
        stderr_tail: safeTail(stderr)
      };
      fs.writeFileSync(reportPathLatest, JSON.stringify(payload, null, 2), 'utf8');
      fs.writeFileSync(reportPathTimestamped, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
    }
  };

  try {
    const serverPath = path.join(repoRoot, 'src', 'server.js');
    child = spawn(process.execPath, [serverPath], {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    report.steps.push({ step: 'spawn', ts: new Date().toISOString() });

    const runtime = await waitForRuntime(runtimeFilePath, 8000);
    assert(runtime, 'runtime file created');

    report.runtime = runtime;
    report.base_url = runtime.base_url;

    report.steps.push({ step: 'runtime_ready', ts: new Date().toISOString(), base_url: runtime.base_url });

    const health = await fetchJson(`${runtime.base_url}/health`, { timeoutMs: 2000 });
    assert.equal(health.status, 200);
    assert.equal(health.json?.ok, true);

    report.steps.push({ step: 'health', ts: new Date().toISOString() });

    const createNoAuth = await fetchJson(`${runtime.base_url}/v1/agents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Self Test Agent (unauth)' })
    });
    assert.equal(createNoAuth.status, 401);

    report.steps.push({ step: 'write_requires_auth', ts: new Date().toISOString() });

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    };

    const created = await fetchJson(`${runtime.base_url}/v1/agents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Self Test Agent', actor: 'self_test' })
    });

    assert.equal(created.status, 200);
    assert.equal(created.json?.ok, true);
    assert(created.json?.agent?.agent_id);

    const agentId = created.json.agent.agent_id;
    report.agent_id = agentId;

    report.steps.push({ step: 'agent_created', ts: new Date().toISOString(), agent_id: agentId });

    const updated = await fetchJson(`${runtime.base_url}/v1/agents/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Self Test Agent Updated', actor: 'self_test' })
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.json?.ok, true);
    assert.equal(updated.json?.agent?.name, 'Self Test Agent Updated');

    report.steps.push({ step: 'agent_updated', ts: new Date().toISOString() });

    const expanded = await fetchJson(`${runtime.base_url}/v1/agents/${encodeURIComponent(agentId)}/avatar/expand`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ avatar_name: 'self_test_avatar', base_prompt: 'stub', async_mode: true, actor: 'self_test' })
    });

    assert.equal(expanded.status, 200);
    assert.equal(expanded.json?.ok, true);

    report.steps.push({ step: 'avatar_expand', ts: new Date().toISOString() });

    const statusResp = await fetchJson(`${runtime.base_url}/v1/agents/${encodeURIComponent(agentId)}/avatar/status`, {
      timeoutMs: 4000,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(statusResp.status, 200);
    assert.equal(statusResp.json?.ok, true);

    report.steps.push({ step: 'avatar_status', ts: new Date().toISOString(), job_status: statusResp.json?.job?.status });

    const agentAfter = await waitForAgentStatus({
      baseUrl: runtime.base_url,
      token,
      agentId,
      desiredStatus: 'succeeded',
      timeoutMs: 8000
    });

    assert(agentAfter, 'agent avatar_status succeeded');

    report.steps.push({ step: 'avatar_succeeded', ts: new Date().toISOString() });

    const preview = await fetchJson(`${runtime.base_url}/v1/agents/${encodeURIComponent(agentId)}/avatar/preview`, {
      timeoutMs: 2000,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(preview.status, 200);
    assert.equal(preview.json?.ok, true);

    report.steps.push({ step: 'avatar_preview', ts: new Date().toISOString() });

    const exported = await fetchJson(`${runtime.base_url}/v1/agents/${encodeURIComponent(agentId)}/avatar/export`, {
      timeoutMs: 2000,
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(exported.status, 200);
    assert.equal(exported.json?.ok, true);

    report.steps.push({ step: 'avatar_export', ts: new Date().toISOString() });

    const system = await fetchJson(`${runtime.base_url}/v1/system`, {
      timeoutMs: 2000,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(system.status, 200);
    assert.equal(system.json?.ok, true);
    assert(Number.isFinite(system.json?.event_log_length));
    assert(system.json.event_log_length >= 3);

    report.system = system.json;

    report.steps.push({ step: 'system', ts: new Date().toISOString(), event_log_length: system.json.event_log_length });

    const db = new Database(dbPath);
    const row = db
      .prepare(
        'SELECT agent_id, name, avatar_status, avatar_job_id FROM agents WHERE agent_id = ?'
      )
      .get(agentId);
    db.close();

    assert(row);
    assert.equal(row.name, 'Self Test Agent Updated');
    assert.equal(row.avatar_status, 'succeeded');
    assert(row.avatar_job_id);

    report.steps.push({ step: 'sqlite_projection', ts: new Date().toISOString() });

    report.ok = true;
  } catch (err) {
    report.errors.push(String(err?.stack || err));
    throw err;
  } finally {
    try {
      if (child && child.exitCode === null) {
        child.kill('SIGTERM');
        await waitForExit(child, 8000);
      }
    } catch (err) {
      report.errors.push(String(err?.message || err));
    }

    writeReport();

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
    }
  }
});
