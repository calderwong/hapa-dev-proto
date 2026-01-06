import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SERVICE_NAME = 'hapa-agent-registry-node';
export const API_VERSION = '0.1.0';
export const DEFAULT_PORT = 8737;

export function getRepoRoot() {
  return path.resolve(__dirname, '..');
}

export function loadConfig() {
  const repoRoot = getRepoRoot();

  const host = process.env.HAPA_AGENT_REGISTRY_HOST || '127.0.0.1';
  const portRaw = process.env.HAPA_AGENT_REGISTRY_PORT || String(DEFAULT_PORT);
  const portParsed = parseInt(String(portRaw), 10);
  const port = Number.isFinite(portParsed) ? portParsed : DEFAULT_PORT;

  const tokenFilePath = path.join(repoRoot, '.node_token');
  const tokenFromEnv = process.env.HAPA_AGENT_REGISTRY_TOKEN;
  const token = loadOrCreateToken({ tokenFilePath, tokenFromEnv });

  const allowQueryToken = process.env.HAPA_AGENT_REGISTRY_ALLOW_QUERY_TOKEN === '1';

  const storageDir = process.env.HAPA_AGENT_REGISTRY_STORAGE_DIR || path.join(repoRoot, 'storage');
  const coreDir = path.join(storageDir, 'hypercore');
  const dbPath = process.env.HAPA_AGENT_REGISTRY_DB_PATH || path.join(storageDir, 'agent_registry.db');

  const defaultRuntimeFilePath = path.join(repoRoot, 'artifacts', 'runtime', 'agent_registry_node_runtime.json');
  const runtimeFilePath = path.resolve(process.env.HAPA_AGENT_REGISTRY_RUNTIME_FILE || defaultRuntimeFilePath);

  const avatarMode = String(process.env.HAPA_AGENT_REGISTRY_AVATAR_MODE || 'remote').trim().toLowerCase();
  const avatarBaseUrl = String(
    process.env.HAPA_AGENT_REGISTRY_AVATAR_BASE_URL || process.env.HAPA_AVATAR_NODE_BASE_URL || ''
  )
    .trim()
    .replace(/\/+$/g, '');
  const avatarToken = normalizeToken(process.env.HAPA_AGENT_REGISTRY_AVATAR_TOKEN || process.env.HAPA_AVATAR_NODE_TOKEN);

  const instance = String(process.env.HAPA_AGENT_REGISTRY_INSTANCE || '').trim() || null;

  return {
    repoRoot,
    host,
    port,
    token,
    tokenFilePath,
    allowQueryToken,
    storageDir,
    coreDir,
    dbPath,
    runtimeFilePath,
    avatarMode,
    avatarBaseUrl,
    avatarToken,
    instance
  };
}

function loadOrCreateToken({ tokenFilePath, tokenFromEnv }) {
  if (typeof tokenFromEnv === 'string' && tokenFromEnv.trim()) {
    return normalizeToken(tokenFromEnv);
  }

  if (fs.existsSync(tokenFilePath)) {
    const txt = fs.readFileSync(tokenFilePath, 'utf8');
    return normalizeToken(txt);
  }

  const token = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(tokenFilePath, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  return token;
}

function normalizeToken(t) {
  return String(t || '')
    .trim()
    .replace(/^Bearer\s+/i, '');
}
