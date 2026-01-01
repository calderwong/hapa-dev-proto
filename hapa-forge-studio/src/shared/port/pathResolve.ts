// src/shared/port/pathResolve.ts

/**
 * Canonical helpers for resolving paths inside uploaded/exported zips.
 *
 * Goals:
 * - wrapper-folder tolerance via zipPrefix
 * - support BOTH rooted and relative bundlePath refs:
 *   - relative: "items/.../bundle.portable.json"
 *   - rooted:   "hapa_forge_export/items/.../bundle.portable.json"
 * - safe path handling (reject traversal / absolute paths)
 *
 * NOTE: We also export a few backwards-compatible helper names used by
 * earlier /port Preview code (normalizeBundlePathForZipLookup, etc.).
 */

export type ResolveRoots = {
  /** Everything before "hapa_handoff/" (for handoff zips) or "<embeddedExportRoot>/" (for export zips). Often "" or "SomeWrapper/". */
  zipPrefix?: string;
  /** Usually "hapa_handoff" for handoff zips. Use "" for bare export zips. */
  handoffDir?: string;
  /** Usually "hapa_forge_export" */
  embeddedExportRoot: string;
};

/** Normalize to POSIX-ish zip paths: no backslashes, collapse "//", strip leading "./" and "/". */
export function normalizeZipPath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/** Reject path traversal and absolute paths. */
export function assertSafeZipRelativePath(input: string): string {
  const raw = String(input);
  // Catch absolute paths before normalizeZipPath() strips leading slashes.
  const rawSlashes = raw.replace(/\\/g, '/');
  if (rawSlashes.startsWith('/') || /^[A-Za-z]:\//.test(rawSlashes) || rawSlashes.includes('\0')) {
    throw new Error(`Unsafe path (absolute/null): "${input}"`);
  }

  const p = normalizeZipPath(rawSlashes);
  const parts = p.split('/');
  if (parts.includes('..')) {
    throw new Error(`Unsafe path (traversal): "${input}"`);
  }
  return p;
}

/**
 * Detect wrapper-folder prefix by locating ".../<embeddedExportRoot>/manifest.json".
 * Returns everything before "<embeddedExportRoot>/manifest.json" (may be "").
 */
export function detectZipPrefixForEmbeddedExport(zipEntryPaths: string[], embeddedExportRoot: string): string | null {
  const exportRoot = normalizeZipPath(embeddedExportRoot);
  const needle = exportRoot + '/manifest.json';

  for (const p of zipEntryPaths) {
    const norm = normalizeZipPath(p);
    if (norm.endsWith(needle)) {
      return norm.slice(0, norm.length - needle.length);
    }
  }
  return null;
}

/**
 * Detect wrapper-folder prefix by locating ".../<handoffDir>/hapa_import_manifest.json".
 * Useful when the user uploads a handoff zip (not just an export zip).
 */
export function detectZipPrefixForHandoffManifest(zipEntryPaths: string[], handoffDir = 'hapa_handoff'): string | null {
  const handoff = normalizeZipPath(handoffDir);
  const needle = handoff + '/hapa_import_manifest.json';

  for (const p of zipEntryPaths) {
    const norm = normalizeZipPath(p);
    if (norm.endsWith(needle)) {
      return norm.slice(0, norm.length - needle.length);
    }
  }
  return null;
}

/**
 * Resolve a node ref's bundlePath to an absolute zip-entry path.
 *
 * Supports both:
 * - relative: "items/.../bundle.portable.json" (treated as under export root)
 * - rooted:   "<embeddedExportRoot>/items/..." (treated as under handoff root)
 *
 * For export zips, pass roots.handoffDir as "".
 */
export function resolveBundleAbsZipPath(bundlePath: string, roots: ResolveRoots): string {
  const zipPrefix = normalizeZipPath(roots.zipPrefix ?? '');
  const handoffDir = normalizeZipPath(roots.handoffDir ?? 'hapa_handoff');
  const exportRoot = normalizeZipPath(roots.embeddedExportRoot);

  const raw = assertSafeZipRelativePath(bundlePath);

  // If handoffDir is "", this becomes "<zipPrefix>/".
  const handoffRoot = [zipPrefix, handoffDir].filter(Boolean).join('/') + '/';
  const exportRootAbs = handoffRoot + exportRoot + '/';

  // If bundlePath is already rooted like "hapa_forge_export/..."
  if (raw === exportRoot || raw.startsWith(exportRoot + '/')) {
    return normalizeZipPath(handoffRoot + raw);
  }

  // Otherwise treat as relative to export root like "items/..."
  return normalizeZipPath(exportRootAbs + raw);
}

/**
 * Resolve a portable bundle's assets[].path to an absolute zip-entry path.
 * Contract: assets[].path is relative to embeddedExportRoot.
 */
export function resolveExportAssetAbsZipPath(assetPath: string, roots: ResolveRoots): string {
  return resolveBundleAbsZipPath(assetPath, roots);
}

// --- Backwards-compatible aliases / helpers used by earlier preview code ---

/** Alias used by earlier prompt wording. */
export const detectZipPrefixForExportRoot = detectZipPrefixForEmbeddedExport;

/**
 * Normalize a bundlePath for lookup inside an export zip.
 *
 * Returns a path RELATIVE to the export root, like "items/.../bundle.portable.json".
 * Accepts both rooted and relative inputs.
 */
export const normalizeBundlePathForZipLookup = (bundlePath: string, embeddedExportRoot: string): string => {
  const exportRoot = normalizeZipPath(embeddedExportRoot);
  const raw = assertSafeZipRelativePath(bundlePath);

  if (raw === exportRoot) return '';
  if (raw.startsWith(exportRoot + '/')) {
    return normalizeZipPath(raw.slice((exportRoot + '/').length));
  }
  return normalizeZipPath(raw);
};

/**
 * Resolve an export-root-relative file to a zip entry key:
 *   "<zipPrefix><embeddedExportRoot>/<relUnderExportRoot>"
 */
export const toZipAbsPathForExportFile = (zipPrefix: string, embeddedExportRoot: string, relUnderExportRoot: string): string => {
  const prefix = normalizeZipPath(zipPrefix || '');
  const exportRoot = normalizeZipPath(embeddedExportRoot);
  const rel = assertSafeZipRelativePath(relUnderExportRoot);
  return normalizeZipPath([prefix, exportRoot, rel].filter(Boolean).join('/'));
};

/** Convenience: resolve a possibly-rooted bundlePath into an absolute export-zip key. */
export const resolveBundleZipKey = (args: { bundlePath: string; embeddedExportRoot: string; zipPrefix: string }): string => {
  return resolveBundleAbsZipPath(args.bundlePath, {
    zipPrefix: args.zipPrefix,
    handoffDir: '',
    embeddedExportRoot: args.embeddedExportRoot,
  });
};

/**
 * Contract: portable bundle assets[].path is relative to embeddedExportRoot.
 * This helper tolerates rooted refs too.
 */
export const resolveExportAssetZipKey = (args: { assetPath: string; embeddedExportRoot: string; zipPrefix: string }): string => {
  return resolveExportAssetAbsZipPath(args.assetPath, {
    zipPrefix: args.zipPrefix,
    handoffDir: '',
    embeddedExportRoot: args.embeddedExportRoot,
  });
};
