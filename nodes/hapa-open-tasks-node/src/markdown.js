import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.rst',
  '.log',
  '.json',
  '.yml',
  '.yaml',
  '.toml'
]);

export async function readAllowedTextFile({ requestedPath, roots, maxBytes = DEFAULT_MAX_BYTES }) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    throw new Error('Missing path');
  }

  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error('No markdown roots configured');
  }

  const absRequested = path.resolve(requestedPath);
  const realPath = await fs.realpath(absRequested);

  const allowed = roots.some((root) => {
    const r = path.resolve(root);
    return realPath === r || realPath.startsWith(r + path.sep);
  });

  if (!allowed) {
    throw new Error('Path not allowed');
  }

  const ext = path.extname(realPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Extension not allowed');
  }

  const stat = await fs.stat(realPath);
  if (!stat.isFile()) {
    throw new Error('Not a file');
  }

  if (stat.size > maxBytes) {
    throw new Error('File too large');
  }

  const content = await fs.readFile(realPath, 'utf8');
  return { path: realPath, content };
}
