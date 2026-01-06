import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const PORT_MANAGER_API_VERSION = 'v1';

export function runtimeRoot() {
  const value = String(process.env.HAPA_RUNTIME_DIR || '').trim();
  if (value) return path.resolve(value);
  return path.join(os.homedir(), '.hapa', 'runtime');
}

function staleSeconds() {
  const raw = String(process.env.HAPA_RUNTIME_STALE_SECONDS || '').trim() || '600';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 600;
}

function leasesDir(root) {
  const p = path.join(root, 'leases');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function runtimesDir(root) {
  const p = path.join(root, 'runtimes');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function utcNowIso() {
  return new Date().toISOString();
}

function safeComponent(value) {
  const text = String(value || '').trim() || 'unknown';
  const out = [];
  for (const ch of text) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-' || ch === '_' || ch === '.') {
      out.push(ch);
    } else {
      out.push('_');
    }
  }
  const cleaned = out.join('').replace(/^[._-]+/, '').replace(/[._-]+$/, '');
  return cleaned || 'unknown';
}

function atomicWriteJson(filePath, data, { mode = 0o600 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(path.dirname(filePath), `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, `${JSON.stringify(data)}\n`, { encoding: 'utf8', mode });
  try {
    fs.chmodSync(tmpPath, mode);
  } catch {
  }
  fs.renameSync(tmpPath, filePath);
}

function tryCreateJsonExclusive(filePath, data, { mode = 0o600 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let fd;
  try {
    fd = fs.openSync(filePath, 'wx', mode);
  } catch (err) {
    if (err && err.code === 'EEXIST') return false;
    throw err;
  }

  try {
    fs.writeSync(fd, JSON.stringify(data));
    fs.writeSync(fd, '\n');
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
    }
  }

  return true;
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function pidExists(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    return true;
  }
}

async function isPortAvailable(host, port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: String(host), port: Number(port) }, () => {
      server.close(() => resolve(true));
    });
  });
}

function leasePortFromName(filePath) {
  const name = path.basename(filePath);
  if (!name.startsWith('port-') || !name.endsWith('.json')) return null;
  const mid = name.slice('port-'.length, -'.json'.length);
  const n = parseInt(mid, 10);
  return Number.isFinite(n) ? n : null;
}

async function isStaleRecord({ filePath, pid, host, port, staleSeconds: staleness }) {
  if (pid && Number.isFinite(pid) && pid > 0 && !pidExists(pid)) return true;

  let ageSeconds = staleness + 1;
  try {
    const st = fs.statSync(filePath);
    ageSeconds = (Date.now() - st.mtimeMs) / 1000;
  } catch {
  }

  if (ageSeconds <= staleness) return false;

  const checkHost = String(host || '').trim() || '127.0.0.1';
  const checkPort = port && Number.isFinite(port) ? port : null;
  if (checkPort === null) return true;

  return await isPortAvailable(checkHost, checkPort);
}

export async function cleanupStale({ root } = {}) {
  const base = path.resolve(root || runtimeRoot());
  const staleness = staleSeconds();
  const leases = leasesDir(base);
  const runtimes = runtimesDir(base);

  let leasesRemoved = 0;
  let runtimesRemoved = 0;

  for (const leasePath of fs.readdirSync(leases).map((n) => path.join(leases, n)).sort()) {
    if (!path.basename(leasePath).startsWith('port-') || !path.basename(leasePath).endsWith('.json')) continue;

    const data = readJson(leasePath) || {};

    const pidRaw = data.pid;
    const pid = Number.isFinite(pidRaw) ? pidRaw : parseInt(String(pidRaw || '0'), 10);

    const host = typeof data.host === 'string' ? data.host : null;

    const portRaw = data.port;
    let port = Number.isFinite(portRaw) ? portRaw : parseInt(String(portRaw || ''), 10);
    if (!Number.isFinite(port)) port = leasePortFromName(leasePath);

    if (!(await isStaleRecord({ filePath: leasePath, pid, host, port, staleSeconds: staleness }))) continue;

    const runtimeFile = typeof data.runtime_file === 'string' ? data.runtime_file : null;

    try {
      fs.unlinkSync(leasePath);
      leasesRemoved++;
    } catch {
    }

    if (runtimeFile) {
      try {
        fs.unlinkSync(runtimeFile);
        runtimesRemoved++;
      } catch {
      }
    }
  }

  for (const runtimePath of fs.readdirSync(runtimes).map((n) => path.join(runtimes, n)).sort()) {
    if (!path.basename(runtimePath).endsWith('.json')) continue;

    const data = readJson(runtimePath) || {};

    const pidRaw = data.pid;
    const pid = Number.isFinite(pidRaw) ? pidRaw : parseInt(String(pidRaw || '0'), 10);

    const host = typeof data.host === 'string' ? data.host : null;

    const portRaw = data.port;
    const port = Number.isFinite(portRaw) ? portRaw : parseInt(String(portRaw || ''), 10);

    if (!(await isStaleRecord({ filePath: runtimePath, pid, host, port, staleSeconds: staleness }))) continue;

    try {
      fs.unlinkSync(runtimePath);
      runtimesRemoved++;
    } catch {
    }
  }

  return { leases_removed: leasesRemoved, runtimes_removed: runtimesRemoved };
}

export class PortLease {
  constructor({ service, host, port, pid, startedAt, leaseFile, runtimeFile }) {
    this.service = String(service);
    this.host = String(host);
    this.port = Number(port);
    this.pid = Number(pid) || 0;
    this.started_at = String(startedAt);
    this.lease_file = String(leaseFile);
    this.runtime_file = String(runtimeFile);
  }

  toLeaseDict() {
    return {
      api_version: PORT_MANAGER_API_VERSION,
      service: this.service,
      host: this.host,
      port: this.port,
      pid: this.pid,
      started_at: this.started_at,
      runtime_file: this.runtime_file
    };
  }

  writeLease() {
    atomicWriteJson(this.lease_file, this.toLeaseDict(), { mode: 0o600 });
  }

  writeRuntime({ baseUrl, tokenPath, storageDir, extra } = {}) {
    const base_url = baseUrl || `http://${this.host}:${this.port}`;

    const data = {
      api_version: PORT_MANAGER_API_VERSION,
      service: this.service,
      base_url,
      host: this.host,
      port: this.port,
      pid: this.pid,
      started_at: this.started_at,
      updated_at: utcNowIso(),
      lease_file: this.lease_file
    };

    if (tokenPath) data.token_path = path.resolve(String(tokenPath));
    if (storageDir) data.storage_dir = path.resolve(String(storageDir));

    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      for (const [k, v] of Object.entries(extra)) {
        if (Object.prototype.hasOwnProperty.call(data, k)) continue;
        data[String(k)] = v;
      }
    }

    atomicWriteJson(this.runtime_file, data, { mode: 0o600 });
  }

  setPid(pid) {
    this.pid = Number(pid) || 0;
    this.writeLease();
  }

  release({ removeRuntime = true } = {}) {
    try {
      fs.unlinkSync(this.lease_file);
    } catch {
    }
    if (removeRuntime) {
      try {
        fs.unlinkSync(this.runtime_file);
      } catch {
      }
    }
  }
}

export async function acquirePortLease({
  service,
  host,
  basePort,
  maxScan = 256,
  preferredPort = null,
  instance = null,
  pid = 0,
  root = null
}) {
  const base = path.resolve(root || runtimeRoot());
  await cleanupStale({ root: base });

  const leases = leasesDir(base);
  const runtimes = runtimesDir(base);

  const safeService = safeComponent(service);
  const startedAt = utcNowIso();
  const pidValue = Number(pid) || 0;

  const candidates = [];
  if (preferredPort !== null && preferredPort !== undefined) {
    const p = parseInt(String(preferredPort), 10);
    if (Number.isFinite(p)) candidates.push(p);
  }

  const start = Math.max(1, parseInt(String(basePort), 10));
  for (let i = 0; i < Number(maxScan); i++) {
    const p = start + i;
    if (!candidates.includes(p)) candidates.push(p);
  }

  for (const port of candidates) {
    const leaseFile = path.join(leases, `port-${Number(port)}.json`);
    const instanceFinal = instance ? safeComponent(instance) : String(Number(port));
    const runtimeFile = path.join(runtimes, `${safeService}-${instanceFinal}.json`);

    const lease = new PortLease({
      service,
      host,
      port,
      pid: pidValue,
      startedAt,
      leaseFile,
      runtimeFile
    });

    if (!tryCreateJsonExclusive(leaseFile, lease.toLeaseDict(), { mode: 0o600 })) continue;

    if (!(await isPortAvailable(host, Number(port)))) {
      try {
        fs.unlinkSync(leaseFile);
      } catch {
      }
      continue;
    }

    try {
      lease.writeRuntime();
    } catch (err) {
      try {
        fs.unlinkSync(leaseFile);
      } catch {
      }
      throw err;
    }

    return lease;
  }

  throw new Error('No available ports');
}
