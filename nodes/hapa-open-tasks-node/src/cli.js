import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { loadConfig } from './config.js';

function usage() {
  console.log('hapa-open-tasks <command>');
  console.log('');
  console.log('Commands:');
  console.log('  start [--host HOST] [--port PORT] [--daemon]');
  console.log('  stop');
  console.log('  status');
  console.log('  self-test');
}

function parseFlags(args) {
  const flags = {};
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (a === '--help' || a === '-h') {
      flags.help = true;
      continue;
    }

    if (a === '--daemon' || a === '-d') {
      flags.daemon = true;
      continue;
    }

    if (a === '--host') {
      flags.host = args[i + 1];
      i++;
      continue;
    }

    if (a === '--port') {
      flags.port = args[i + 1];
      i++;
      continue;
    }

    if (a === '--token') {
      flags.token = args[i + 1];
      i++;
      continue;
    }

    if (a === '--runtime-file') {
      flags.runtimeFile = args[i + 1];
      i++;
      continue;
    }

    rest.push(a);
  }

  return { flags, rest };
}

function applyEnvOverrides(flags) {
  if (typeof flags.host === 'string' && flags.host.trim()) {
    process.env.HAPA_OPEN_TASKS_HOST = flags.host.trim();
  }

  if (flags.port !== undefined) {
    const p = parseInt(String(flags.port), 10);
    if (!Number.isFinite(p) || p < 0) {
      throw new Error('Invalid --port');
    }
    process.env.HAPA_OPEN_TASKS_PORT = String(p);
  }

  if (typeof flags.token === 'string' && flags.token.trim()) {
    process.env.HAPA_OPEN_TASKS_TOKEN = flags.token.trim();
  }

  if (typeof flags.runtimeFile === 'string' && flags.runtimeFile.trim()) {
    process.env.HAPA_OPEN_TASKS_RUNTIME_FILE = flags.runtimeFile.trim();
  }
}

function loadRuntime(runtimeFilePath) {
  try {
    const txt = fs.readFileSync(runtimeFilePath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchJson(url, { timeoutMs = 2000, ...opts } = {}) {
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

async function cmdStart(config, { daemon }) {
  const runtime = loadRuntime(config.runtimeFilePath);
  if (runtime && isProcessRunning(runtime.pid)) {
    console.log(`Already running (PID: ${runtime.pid})`);
    console.log(runtime.base_url);
    return;
  }

  const serverPath = path.join(config.repoRoot, 'src', 'server.js');
  const env = { ...process.env };

  const child = spawn(process.execPath, [serverPath], {
    cwd: config.repoRoot,
    env,
    stdio: daemon ? 'ignore' : 'inherit',
    detached: !!daemon
  });

  if (daemon) {
    child.unref();
    const started = await waitForRuntime(config.runtimeFilePath, 8000);
    if (!started) {
      console.log('Failed to start (runtime file not created)');
      return;
    }
    console.log(`Started (PID: ${started.pid})`);
    console.log(`URL: ${started.base_url}`);
    console.log(`Token: ${config.token}`);
    return;
  }

  await new Promise((resolve) => {
    child.on('exit', resolve);
  });
}

async function cmdStop(config) {
  const runtime = loadRuntime(config.runtimeFilePath);
  if (!runtime) {
    console.log('No running node found');
    return;
  }

  if (!isProcessRunning(runtime.pid)) {
    try {
      fs.unlinkSync(config.runtimeFilePath);
    } catch {
    }
    console.log('Node not running');
    return;
  }

  try {
    process.kill(runtime.pid, 'SIGTERM');
  } catch (err) {
    console.log(String(err?.message || err));
    return;
  }

  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (!isProcessRunning(runtime.pid)) break;
    await sleep(150);
  }

  console.log('Stopped');
}

async function cmdStatus(config) {
  const runtime = loadRuntime(config.runtimeFilePath);
  if (!runtime || !isProcessRunning(runtime.pid)) {
    console.log('Not running');
    return;
  }

  console.log(`Running (PID: ${runtime.pid})`);
  console.log(`URL: ${runtime.base_url}`);

  try {
    const res = await fetchJson(`${runtime.base_url}/health`, { timeoutMs: 1500 });
    if (res.status === 200 && res.json?.ok) {
      console.log('Health: ok');
    } else {
      console.log(`Health: ${res.status}`);
    }
  } catch {
    console.log('Health: unknown');
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function cmdSelfTest(config) {
  const reportPath = path.join(config.repoRoot, 'artifacts', 'self_test', 'open_tasks_self_test_latest.json');
  const testPath = path.join(config.repoRoot, 'test', 'self_test.test.js');

  const child = spawn(process.execPath, ['--test', testPath], {
    cwd: config.repoRoot,
    env: { ...process.env },
    stdio: 'inherit'
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  console.log(`Self-test report: ${reportPath}`);
  const report = readJsonFile(reportPath);
  if (report && typeof report.ok === 'boolean') {
    console.log(`Self-test ok: ${report.ok}`);
    if (report.task_id) console.log(`task_id: ${report.task_id}`);
  }

  return exitCode;
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, rest } = parseFlags(argv);
  const command = rest[0] || 'help';

  if (flags.help || command === 'help') {
    usage();
    process.exit(0);
  }

  applyEnvOverrides(flags);
  const config = loadConfig();

  if (command === 'start') {
    await cmdStart(config, { daemon: !!flags.daemon });
    return;
  }

  if (command === 'stop') {
    await cmdStop(config);
    return;
  }

  if (command === 'status') {
    await cmdStatus(config);
    return;
  }

  if (command === 'self-test' || command === 'selftest') {
    const code = await cmdSelfTest(config);
    process.exit(code);
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
