import { strToU8, zipSync } from 'fflate';

import type { HapaAsset, HapaBundle } from '@/shared/export/hapaBundle';
import type { LibraryItem } from '@/shared/storage/library';
import { getBundleBestVideoUrl } from '@/shared/export/selectors';

export type HapaForgeExportManifestItem = {
  id: string;
  kind: 'character' | 'ship' | 'media';
  title: string;
  subtitle?: string;
  createdAt: number;
  folder: string;
  bundlePath: string;
  portableBundlePath: string;
  thumbnailPath?: string;
  hasVideo: boolean;
};

export type HapaForgeExportManifest = {
  exportVersion: '1.0';
  createdAt: number;
  app: {
    name: 'Hapa Forge Studio';
    format: 'hapa_forge_export';
  };
  items: HapaForgeExportManifestItem[];
};

export type WrittenAssetInfo = {
  path: string;
  mimeType?: string;
  ext?: string;
};

export type PortableHapaBundle = HapaBundle & {
  assets: Array<HapaAsset & { path?: string }>;
};

export type HapaZipProgress = {
  phase: 'prepare' | 'write-images' | 'write-json' | 'zip';
  current: number;
  total: number;
  itemId?: string;
  title?: string;
};

const ROOT_FOLDER = 'hapa_forge_export';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const extFromMime = (mimeType: string): string => {
  return MIME_TO_EXT[mimeType.toLowerCase()] || 'png';
};

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * ASCII-ish slug for filesystem paths.
 */
export const slugify = (input: string, maxLen = 60): string => {
  const s = (input || 'untitled')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  const out = s.length ? s : 'untitled';
  return out.slice(0, clamp(maxLen, 8, 120));
};

/**
 * Sanitizes a single path segment (no slashes).
 */
export const sanitizeSegment = (input: string, maxLen = 120): string => {
  const s = (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  const out = s.length ? s : 'x';
  return out.slice(0, clamp(maxLen, 8, 180));
};

const uniqueName = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  const out = `${base}-${i}`;
  used.add(out);
  return out;
};

export const dataUrlToUint8Array = (
  dataUrl: string
): { bytes: Uint8Array; mimeType: string; ext: string } => {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) {
    throw new Error('Invalid dataUrl');
  }

  const mimeType = (m[1] || 'application/octet-stream').trim();
  const isBase64 = !!m[2];
  const payload = (m[3] || '').replace(/\s/g, '');

  let bytes: Uint8Array;
  if (isBase64) {
    const bin = atob(payload);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const text = decodeURIComponent(payload);
    bytes = strToU8(text);
  }

  const ext = extFromMime(mimeType);
  return { bytes, mimeType, ext };
};

export const buildPortableBundle = (
  item: LibraryItem,
  writtenAssetMap: Record<string, WrittenAssetInfo>
): PortableHapaBundle => {
  // Bundles are JSON-safe, so this is a convenient deep-clone.
  const cloned: HapaBundle = JSON.parse(JSON.stringify(item.bundle));

  const assets = (cloned.assets || []).map((asset) => {
    if (asset.type === 'image' && isNonEmptyString(asset.dataUrl)) {
      const info = writtenAssetMap[asset.id];
      if (info?.path) {
        return {
          ...asset,
          mimeType: asset.mimeType || info.mimeType,
          dataUrl: undefined,
          path: info.path,
        };
      }
    }

    return { ...asset };
  });

  return {
    ...cloned,
    assets,
  };
};

const buildLinksJson = (bundle: HapaBundle) => {
  const videos = (bundle.assets || [])
    .filter((a) => a.type === 'video' && isNonEmptyString(a.url))
    .map((a) => ({ id: a.id, url: a.url as string, name: a.name }));

  return { videos };
};

const pick = (obj: any, keys: string[]) => {
  const out: Record<string, any> = {};
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
};

const buildPreviewHighlights = (item: LibraryItem): Record<string, any> => {
  const b = item.bundle;
  try {
    if (item.kind === 'character') {
      const analysis = b.outputs?.analysis;
      return {
        analysis: typeof analysis === 'object' && analysis ? pick(analysis, ['name', 'archetype', 'role', 'class', 'race', 'origin', 'stats']) : analysis,
        hasAnimatedVideo: !!(b.outputs as any)?.animatedVideoUrl,
      };
    }

    if (item.kind === 'ship') {
      const ship = (b.outputs as any)?.ship ?? (b.outputs as any)?.shipData ?? (b.outputs as any)?.shipManifest;
      if (typeof ship === 'object' && ship) {
        return {
          ship: pick(ship, ['name', 'role', 'class', 'manufacturer', 'faction', 'stats', 'coreStats']),
        };
      }
      return { ship };
    }

    // media
    return {
      videoUrl: getBundleBestVideoUrl(b),
      prompt: (b.outputs as any)?.prompt,
    };
  } catch {
    return {};
  }
};

const yieldToBrowser = async () => {
  await new Promise<void>((resolve) => {
    // Prefer rAF when available so UI can repaint progress.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(() => resolve(), 0);
  });
};

export const exportLibraryItemsToHapaZip = async (
  items: LibraryItem[],
  onProgress?: (p: HapaZipProgress) => void
): Promise<Blob> => {
  const createdAt = Date.now();
  const total = items.length;

  const files: Record<string, Uint8Array> = {};
  const manifestItems: HapaForgeExportManifestItem[] = [];

  // README
  const readme = [
    'Hapa Forge Studio export',
    '',
    '- bundle.json is the canonical HapaBundle object as stored in Hapa Forge Studio.',
    '- bundle.portable.json rewrites image assets to portable relative file paths (assets[].path).',
    '- Videos are NOT downloaded. Video assets remain as URLs (see assets/links.json).',
    '',
    'Top-level manifest.json lists all exported items and their relative paths.',
    '',
  ].join('\n');

  files[`${ROOT_FOLDER}/README.txt`] = strToU8(readme);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const current = idx + 1;

    onProgress?.({
      phase: 'prepare',
      current,
      total,
      itemId: item.id,
      title: item.title,
    });

    // Yield regularly so the UI can update progress labels.
    if (idx % 1 === 0) {
      await yieldToBrowser();
    }

    const kind = item.kind;
    const slug = slugify(item.title || 'untitled', 60);
    const safeId = sanitizeSegment(item.id, 80);

    const folderRel = `items/${kind}/${slug}__${safeId}`;
    const folderZip = `${ROOT_FOLDER}/${folderRel}`;

    // Canonical bundle
    files[`${folderZip}/bundle.json`] = strToU8(JSON.stringify(item.bundle, null, 2));

    // Write image assets as real files
    const writtenAssetMap: Record<string, WrittenAssetInfo> = {};
    const imagePaths: string[] = [];
    const usedNames = new Set<string>();

    const imageAssets = (item.bundle.assets || []).filter(
      (a) => a.type === 'image' && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:image/')
    );

    onProgress?.({ phase: 'write-images', current, total, itemId: item.id, title: item.title });

    for (let aIdx = 0; aIdx < imageAssets.length; aIdx++) {
      const asset = imageAssets[aIdx];
      try {
        const { bytes, mimeType, ext } = dataUrlToUint8Array(asset.dataUrl!);
        const baseName = uniqueName(slugify(asset.id || 'image', 48), usedNames);
        const filename = `${baseName}.${ext}`;
        const relPath = `${folderRel}/assets/images/${filename}`;

        files[`${ROOT_FOLDER}/${relPath}`] = bytes;
        writtenAssetMap[asset.id] = { path: relPath, mimeType, ext };
        imagePaths.push(relPath);
      } catch (e) {
        console.warn('Failed to materialize image asset', asset?.id, e);
      }

      // Yield occasionally when processing many images.
      if (aIdx > 0 && aIdx % 2 === 0) {
        await yieldToBrowser();
      }
    }

    onProgress?.({ phase: 'write-json', current, total, itemId: item.id, title: item.title });

    // Portable bundle (image assets rewritten to paths)
    const portableBundle = buildPortableBundle(item, writtenAssetMap);
    files[`${folderZip}/bundle.portable.json`] = strToU8(JSON.stringify(portableBundle, null, 2));

    // links.json
    const links = buildLinksJson(item.bundle);
    files[`${folderZip}/assets/links.json`] = strToU8(JSON.stringify(links, null, 2));

    const videoUrls = links.videos.map((v) => v.url);

    // preview.json
    const preview = {
      title: item.title,
      kind: item.kind,
      imagePaths,
      videoUrls,
      highlights: buildPreviewHighlights(item),
    };
    files[`${folderZip}/previews/preview.json`] = strToU8(JSON.stringify(preview, null, 2));

    // manifest entry
    manifestItems.push({
      id: item.id,
      kind,
      title: item.title,
      subtitle: item.subtitle,
      createdAt: item.createdAt,
      folder: folderRel,
      bundlePath: `${folderRel}/bundle.json`,
      portableBundlePath: `${folderRel}/bundle.portable.json`,
      thumbnailPath: imagePaths[0],
      hasVideo: videoUrls.length > 0,
    });
  }

  const manifest: HapaForgeExportManifest = {
    exportVersion: '1.0',
    createdAt,
    app: {
      name: 'Hapa Forge Studio',
      format: 'hapa_forge_export',
    },
    items: manifestItems,
  };

  files[`${ROOT_FOLDER}/manifest.json`] = strToU8(JSON.stringify(manifest, null, 2));

  onProgress?.({ phase: 'zip', current: total, total });
  // Give the browser a chance to paint “Zipping…” before the synchronous zip stage.
  await yieldToBrowser();

  const zipped = zipSync(files, { level: 0 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy.buffer], { type: 'application/zip' });
};
