import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getRepoRoot() {
  return path.resolve(__dirname, '..');
}

export function loadConfig() {
  const repoRoot = getRepoRoot();

  const host = process.env.HAPA_OPEN_TASKS_HOST || '127.0.0.1';
  const port = parseInt(process.env.HAPA_OPEN_TASKS_PORT || '8733', 10);

  const tokenFilePath = path.join(repoRoot, '.node_token');
  const tokenFromEnv = process.env.HAPA_OPEN_TASKS_TOKEN;
  const token = loadOrCreateToken({ tokenFilePath, tokenFromEnv });

  const storageDir = process.env.HAPA_OPEN_TASKS_STORAGE_DIR || path.join(repoRoot, 'storage');
  const coreDir = path.join(storageDir, 'hypercore');
  const dbPath = process.env.HAPA_OPEN_TASKS_DB_PATH || path.join(storageDir, 'open_tasks.db');

  const defaultMarkdownRoot = path.resolve(repoRoot, '..', '.Overwatch');
  const markdownRootsRaw = process.env.HAPA_OPEN_TASKS_MARKDOWN_ROOTS || defaultMarkdownRoot;
  const markdownRoots = markdownRootsRaw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.resolve(p));

  const allowQueryToken = process.env.HAPA_OPEN_TASKS_ALLOW_QUERY_TOKEN === '1';

  const defaultRuntimeFilePath = path.join(repoRoot, 'artifacts', 'runtime', 'open_tasks_node_runtime.json');
  const runtimeFilePath = path.resolve(process.env.HAPA_OPEN_TASKS_RUNTIME_FILE || defaultRuntimeFilePath);

  return {
    repoRoot,
    host,
    port,
    token,
    tokenFilePath,
    storageDir,
    coreDir,
    dbPath,
    markdownRoots,
    allowQueryToken,
    runtimeFilePath
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
  return String(t).trim().replace(/^Bearer\s+/i, '');
}
