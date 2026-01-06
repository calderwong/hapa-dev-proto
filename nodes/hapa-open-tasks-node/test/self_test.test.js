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

test('hapa-open-tasks-node self test', async () => {
  const repoRoot = getRepoRoot();
  const startedAt = new Date().toISOString();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hapa-open-tasks-selftest-'));

  const storageDir = path.join(tempDir, 'storage');
  const markdownRoot = path.join(tempDir, 'markdown');
  const runtimeFilePath = path.join(tempDir, 'runtime.json');

  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(markdownRoot, { recursive: true });

  const markdownFilePath = path.join(markdownRoot, 'note.md');
  fs.writeFileSync(markdownFilePath, '# Self Test\n\nHello from self test.\n', 'utf8');

  const token = `self_test_${Date.now()}`;
  const dbPath = path.join(storageDir, 'open_tasks.db');

  const env = {
    ...process.env,
    HAPA_OPEN_TASKS_HOST: '127.0.0.1',
    HAPA_OPEN_TASKS_PORT: '0',
    HAPA_OPEN_TASKS_TOKEN: token,
    HAPA_OPEN_TASKS_STORAGE_DIR: storageDir,
    HAPA_OPEN_TASKS_DB_PATH: dbPath,
    HAPA_OPEN_TASKS_MARKDOWN_ROOTS: markdownRoot,
    HAPA_OPEN_TASKS_RUNTIME_FILE: runtimeFilePath
  };

  const report = {
    ok: false,
    started_at: startedAt,
    temp_dir: tempDir,
    runtime: null,
    base_url: null,
    db_path: dbPath,
    task_id: null,
    system: null,
    steps: [],
    errors: []
  };

  const reportDir = path.join(repoRoot, 'artifacts', 'self_test');
  const reportPathLatest = path.join(reportDir, 'open_tasks_self_test_latest.json');
  const reportPathTimestamped = path.join(
    reportDir,
    `open_tasks_self_test__${normalizeIsoForFilename(startedAt)}.json`
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

    const createNoAuth = await fetchJson(`${runtime.base_url}/v1/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Self Test Task (unauth)' })
    });
    assert.equal(createNoAuth.status, 401);

    report.steps.push({ step: 'write_requires_auth', ts: new Date().toISOString() });

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    };

    const created = await fetchJson(`${runtime.base_url}/v1/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ title: 'Self Test Task', actor: 'self_test' })
    });

    assert.equal(created.status, 200);
    assert.equal(created.json?.ok, true);
    assert(created.json?.task?.task_id);

    const taskId = created.json.task.task_id;
    report.task_id = taskId;

    report.steps.push({ step: 'task_created', ts: new Date().toISOString(), task_id: taskId });

    const updated = await fetchJson(`${runtime.base_url}/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status_key: 'DONE', actor: 'self_test' })
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.json?.task?.status_key, 'DONE');

    report.steps.push({ step: 'task_updated', ts: new Date().toISOString(), status_key: 'DONE' });

    const refAdded = await fetchJson(`${runtime.base_url}/v1/tasks/${taskId}/refs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ kind: 'markdown', path: markdownFilePath, label: 'Self test note', actor: 'self_test' })
    });

    assert.equal(refAdded.status, 200);
    assert.equal(refAdded.json?.ok, true);

    report.steps.push({ step: 'ref_added', ts: new Date().toISOString(), path: markdownFilePath });

    const markdown = await fetchJson(`${runtime.base_url}/v1/markdown?path=${encodeURIComponent(markdownFilePath)}`);
    assert.equal(markdown.status, 200);
    assert.equal(markdown.json?.ok, true);
    assert.equal(markdown.json?.path, markdownFilePath);

    report.steps.push({ step: 'markdown_preview', ts: new Date().toISOString() });

    const system = await fetchJson(`${runtime.base_url}/v1/system`);
    assert.equal(system.status, 200);
    assert.equal(system.json?.ok, true);

    report.system = system.json;
    assert(Number.isFinite(system.json?.event_log_length));
    assert(system.json.event_log_length >= 8);

    report.steps.push({ step: 'system', ts: new Date().toISOString(), event_log_length: system.json.event_log_length });

    const db = new Database(dbPath);
    const row = db.prepare('SELECT task_id, status_key, title FROM tasks WHERE task_id = ?').get(taskId);
    db.close();

    assert(row);
    assert.equal(row.status_key, 'DONE');

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
