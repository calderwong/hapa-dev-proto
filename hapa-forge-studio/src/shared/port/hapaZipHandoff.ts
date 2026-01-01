import { strToU8, zipSync } from 'fflate';

import type { HapaBundle } from '@/shared/export/hapaBundle';
import type { HapaForgeExportManifest } from '@/shared/export/hapaZip';
import { buildHapaImportManifest, type HapaImportManifest } from '@/shared/port/hapaGraph';

export type HapaHandoffProgress = {
  phase: 'graph' | 'hash' | 'zip';
  current: number;
  total: number;
  itemId?: string;
  title?: string;
};

const yieldToBrowser = async () => {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(() => resolve(), 0);
  });
};

const bytesToHex = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  if (!(globalThis.crypto as any)?.subtle) {
    throw new Error('WebCrypto SubtleCrypto not available');
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return bytesToHex(new Uint8Array(digest));
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Builds a new zip containing:
 * - hapa_handoff/hapa_import_manifest.json
 * - hapa_handoff/hapa_forge_export/** (the original export folder copied as-is)
 */
export const buildHapaHandoffZip = async (args: {
  exportFiles: Record<string, Uint8Array>;
  exportWrapPrefix: string;
  exportManifest: HapaForgeExportManifest;
  portableBundlesById: Record<string, HapaBundle | undefined>;
  computeSha256?: boolean;
  onProgress?: (p: HapaHandoffProgress) => void;
}): Promise<{ blob: Blob; manifest: HapaImportManifest }> => {
  const total = (args.exportManifest.items || []).length;
  args.onProgress?.({ phase: 'graph', current: 0, total });
  await yieldToBrowser();

  // 1) Build graph manifest from parsed portable bundles.
  const manifest = buildHapaImportManifest({
    exportManifest: args.exportManifest,
    portableBundlesById: args.portableBundlesById,
  });

  // 2) Optional sha256 hashing for portable image assets.
  if (args.computeSha256) {
    const cache = new Map<string, string>();
    let seen = 0;

    // Count total image assets so progress feels accurate.
    const imageAssets: Array<{ path: string; itemId: string; title?: string }> = [];
    for (const item of manifest.items) {
      for (const node of item.nodes) {
        for (const a of node.assets || []) {
          if (a.kind === 'image' && isNonEmptyString(a.path)) {
            imageAssets.push({ path: a.path, itemId: item.id, title: item.title });
          }
        }
      }
    }

    const totalImgs = imageAssets.length || 1;
    for (const entry of imageAssets) {
      seen++;
      args.onProgress?.({ phase: 'hash', current: seen, total: totalImgs, itemId: entry.itemId, title: entry.title });

      if (cache.has(entry.path)) {
        // Fill all occurrences via second pass below.
        await yieldToBrowser();
        continue;
      }

      const key = `${args.exportWrapPrefix}hapa_forge_export/${entry.path}`;
      const bytes = args.exportFiles[key];
      if (!bytes) {
        cache.set(entry.path, '');
        await yieldToBrowser();
        continue;
      }
      try {
        const hex = await sha256Hex(bytes);
        cache.set(entry.path, hex);
      } catch {
        cache.set(entry.path, '');
      }
      await yieldToBrowser();
    }

    // Second pass: attach sha256 to all nodes.
    for (const item of manifest.items) {
      for (const node of item.nodes) {
        for (const a of node.assets || []) {
          if (a.kind === 'image' && isNonEmptyString(a.path)) {
            const h = cache.get(a.path);
            if (h) a.sha256 = h;
          }
        }
      }
    }
  }

  // 3) Build final zip: add manifest + copy export folder unchanged.
  args.onProgress?.({ phase: 'zip', current: 0, total: 1 });
  await yieldToBrowser();

  const outFiles: Record<string, Uint8Array> = {};

  outFiles['hapa_handoff/hapa_import_manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const prefix = `${args.exportWrapPrefix}hapa_forge_export/`;
  for (const [k, v] of Object.entries(args.exportFiles)) {
    if (!k.startsWith(prefix)) continue;
    const relative = k.slice(args.exportWrapPrefix.length); // starts with 'hapa_forge_export/...'
    outFiles[`hapa_handoff/${relative}`] = v;
  }

  // zipSync is synchronous; yield above so UI can paint the "Zipping" status.
  const zipped = zipSync(outFiles, { level: 6 });
  args.onProgress?.({ phase: 'zip', current: 1, total: 1 });

  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);

  return {
    blob: new Blob([copy.buffer], { type: 'application/zip' }),
    manifest,
  };
};
