import type { HapaBundle } from '@/shared/export/hapaBundle';

const isRecord = (v: unknown): v is Record<string, any> => {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

const isNonEmptyString = (v: unknown): v is string => {
  return typeof v === 'string' && v.trim().length > 0;
};

/**
 * Only accept image data URLs for "best image" selection.
 * This avoids accidentally picking JSON or other data URLs from outputs.
 */
const isImageDataUrlString = (v: unknown): v is string => {
  return (
    typeof v === 'string' &&
    v.startsWith('data:image/') &&
    // Most of our generated assets are base64 data URLs.
    (v.includes(';base64,') || v.includes(','))
  );
};

const findFirstDataUrl = (value: unknown, depth = 0): string | null => {
  if (depth > 4) return null;
  if (isImageDataUrlString(value)) return value;

  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findFirstDataUrl(v, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (isRecord(value)) {
    for (const v of Object.values(value)) {
      const found = findFirstDataUrl(v, depth + 1);
      if (found) return found;
    }
  }

  return null;
};

const pickString = (value: unknown): string | undefined => {
  if (isNonEmptyString(value)) return value.trim();
  if (isRecord(value)) {
    // Common fields that might contain a human-friendly summary.
    for (const key of ['summary', 'text', 'lore', 'description', 'prompt']) {
      const v = (value as any)[key];
      if (isNonEmptyString(v)) return v.trim();
    }
  }
  return undefined;
};

export const getBundleTitle = (bundle: HapaBundle): string => {
  try {
    if (bundle.kind === 'character') {
      const analysis = bundle.outputs?.analysis;
      const nameFromAnalysis = isRecord(analysis) ? (analysis as any).name : undefined;
      return (
        (isNonEmptyString(nameFromAnalysis) ? nameFromAnalysis.trim() : undefined) ||
        (isNonEmptyString(bundle.outputs?.name) ? String(bundle.outputs.name).trim() : undefined) ||
        'Character'
      );
    }

    if (bundle.kind === 'ship') {
      const ship =
        bundle.outputs?.ship ??
        bundle.outputs?.shipData ??
        bundle.outputs?.shipManifest;
      const shipName = isRecord(ship) ? (ship as any).name : undefined;
      return (isNonEmptyString(shipName) ? shipName.trim() : undefined) || 'Ship';
    }

    // media
    return 'Media Clip';
  } catch {
    return 'Untitled';
  }
};

export const getBundleBestImageDataUrl = (bundle: HapaBundle): string | null => {
  // 1) First image asset
  const assetUrl = bundle.assets?.find((a) => a.type === 'image' && isImageDataUrlString(a.dataUrl))?.dataUrl;
  if (assetUrl) return assetUrl;

  // 2) Any output value that looks like a data URL
  return findFirstDataUrl(bundle.outputs);
};

export const getBundleBestVideoUrl = (bundle: HapaBundle): string | null => {
  return bundle.assets?.find((a) => a.type === 'video' && isNonEmptyString(a.url))?.url || null;
};

export const getBundlePreferredAspectRatio = (bundle: HapaBundle): '16:9' | '9:16' => {
  if (bundle.kind === 'ship') return '16:9';
  if (bundle.kind === 'character') return '9:16';
  return '9:16';
};

export const getBundleSuggestedPrompt = (bundle: HapaBundle): string => {
  // Character
  if (bundle.kind === 'character') {
    const p1 = pickString(bundle.outputs?.animatedPrompt);
    if (p1) return p1;
    const p2 = pickString(bundle.outputs?.portraitPrompt);
    if (p2) return p2;
    const p3 = pickString((bundle.outputs as any)?.visualPrompt);
    if (p3) return p3;

    return 'Slow cinematic push-in, subtle parallax, holographic UI shimmer, scanlines, floating stat glyphs, 5–8 seconds. Keep identity consistent; no scene change.';
  }

  // Ship
  if (bundle.kind === 'ship') {
    const shipAnalysis =
      (bundle.outputs as any)?.shipAnalysis ??
      (bundle.outputs as any)?.analysis ??
      (bundle.outputs as any)?.lore;

    const maybe = pickString(shipAnalysis);
    if (maybe) {
      return `${maybe}\n\nSlow cinematic spaceship flyby, subtle parallax, holographic UI shimmer, scanlines, 5–8 seconds. Preserve ship silhouette; do not introduce new text.`;
    }

    return 'Slow cinematic spaceship flyby, subtle parallax, holographic UI shimmer, scanlines, 5–8 seconds. Preserve ship silhouette; do not introduce new text.';
  }

  // Media fallback
  return 'Slow cinematic camera move, holographic UI shimmer, subtle parallax, 5–8 seconds.';
};
