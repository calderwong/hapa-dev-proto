import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { unzipSync, strFromU8 } from 'fflate';

import type { LibraryItem } from '@/shared/storage/library';
import { listLibraryItems } from '@/shared/storage/library';
import { exportLibraryItemsToHapaZip, type HapaForgeExportManifest, type HapaForgeExportManifestItem } from '@/shared/export/hapaZip';
import { downloadBlob } from '@/shared/export/hapaBundle';
import type { HapaBundle } from '@/shared/export/hapaBundle';
import { buildHapaHandoffZip, type HapaHandoffProgress } from '@/shared/port/hapaZipHandoff';
import { buildHapaImportManifest } from '@/shared/port/hapaGraph';
import {
  detectZipPrefixForEmbeddedExport,
  resolveBundleAbsZipPath,
  resolveExportAssetAbsZipPath,
  type ResolveRoots,
} from '@/shared/port/pathResolve';
import HapaPreviewPanel from '@/features/port/components/HapaPreviewPanel';

type SourceMode = 'library' | 'zip';

type PortStage = 'source' | 'validate' | 'preview' | 'generate';

type ForgeExportContext = {
  wrapPrefix: string;
  exportFiles: Record<string, Uint8Array>;
  exportManifest: HapaForgeExportManifest;
};

type ValidationRow = {
  id: string;
  kind: 'character' | 'ship' | 'media';
  title: string;
  status: 'ok' | 'missing-bundle' | 'invalid-bundle' | 'missing-images';
  missing: string[];
  portableBundlePath?: string;
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

const formatDateYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const detectWrapPrefix = (files: Record<string, Uint8Array>): string | null => {
  // Wrapper-folder tolerant: detects everything before "hapa_forge_export/manifest.json".
  return detectZipPrefixForEmbeddedExport(Object.keys(files), 'hapa_forge_export');
};

const safeJsonParse = <T,>(text: string): { ok: true; value: T } | { ok: false; error: string } => {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
};

const isForgeExportManifest = (v: any): v is HapaForgeExportManifest => {
  return (
    v &&
    typeof v === 'object' &&
    v.exportVersion === '1.0' &&
    v.app?.format === 'hapa_forge_export' &&
    Array.isArray(v.items)
  );
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export default function PortToHapaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<PortStage>('source');
  const [sourceMode, setSourceMode] = useState<SourceMode>('library');

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => listLibraryItems());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [zipFile, setZipFile] = useState<File | null>(null);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareMsg, setPrepareMsg] = useState<string>('');

  const [ctx, setCtx] = useState<ForgeExportContext | null>(null);
  const [validation, setValidation] = useState<ValidationRow[]>([]);
  const [portableBundlesById, setPortableBundlesById] = useState<Record<string, HapaBundle | undefined>>({});

  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<HapaHandoffProgress | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Refresh library snapshot when entering (helps if user came from /library).
  useEffect(() => {
    setLibraryItems(listLibraryItems());
  }, []);

  // Preselect ids passed from /library (sessionStorage), if any.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('hapa_forge_port_selected_ids_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((x) => typeof x === 'string');
        // Only keep ids that still exist.
        const valid = ids.filter((id) => libraryItems.some((i) => i.id === id));
        if (valid.length) setSelectedIds(valid);
      }
    } catch {
      // ignore
    }
  }, [libraryItems]);

  // Convenience: allow /port?source=zip to preselect zip mode.
  useEffect(() => {
    const s = searchParams.get('source');
    if (s === 'zip') setSourceMode('zip');
  }, [searchParams]);

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const selectAll = () => {
    setSelectedIds(libraryItems.map((i) => i.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const parsePortableBundle = (text: string): HapaBundle | null => {
    const res = safeJsonParse<any>(text);
    if (!res.ok) return null;
    const b = res.value;
    if (!b || typeof b !== 'object') return null;
    if (b.version !== '1.0') return null;
    if (b.kind !== 'character' && b.kind !== 'ship' && b.kind !== 'media') return null;
    if (!Array.isArray(b.steps)) b.steps = [];
    if (!Array.isArray(b.assets)) b.assets = [];
    if (!b.inputs || typeof b.inputs !== 'object') b.inputs = {};
    if (!b.outputs || typeof b.outputs !== 'object') b.outputs = {};
    return b as HapaBundle;
  };

  const validateExportContext = async (context: ForgeExportContext) => {
    const wrapPrefix = context.wrapPrefix;
    const files = context.exportFiles;
    const manifest = context.exportManifest;

    // Canonical join rule for (possibly rooted) bundlePath and export-root-relative asset paths.
    // For bare export zips (no "hapa_handoff" folder), set handoffDir to "".
    const roots: ResolveRoots = {
      zipPrefix: wrapPrefix,
      handoffDir: '',
      embeddedExportRoot: 'hapa_forge_export',
    };

    const bundlesById: Record<string, HapaBundle | undefined> = {};
    const rows: ValidationRow[] = [];

    for (let idx = 0; idx < manifest.items.length; idx++) {
      const mi = manifest.items[idx] as HapaForgeExportManifestItem;
      // Yield between items so UI stays responsive.
      if (idx > 0) await yieldToBrowser();

      const portableKey = resolveBundleAbsZipPath(mi.portableBundlePath, roots);
      const canonicalKey = resolveBundleAbsZipPath(mi.bundlePath, roots);

      const bundleBytes = files[portableKey] || files[canonicalKey];
      if (!bundleBytes) {
        rows.push({
          id: mi.id,
          kind: mi.kind,
          title: mi.title,
          status: 'missing-bundle',
          missing: ['bundle.portable.json (or bundle.json)'],
          portableBundlePath: mi.portableBundlePath,
        });
        continue;
      }

      const bundleText = strFromU8(bundleBytes);
      const parsed = parsePortableBundle(bundleText);
      if (!parsed) {
        rows.push({
          id: mi.id,
          kind: mi.kind,
          title: mi.title,
          status: 'invalid-bundle',
          missing: [],
          portableBundlePath: mi.portableBundlePath,
        });
        continue;
      }

      bundlesById[mi.id] = parsed;

      const missing: string[] = [];
      for (const asset of parsed.assets || []) {
        if (asset?.type === 'image' && !asset.dataUrl && isNonEmptyString(asset.path)) {
          const relPath = asset.path;
          const imgKey = resolveExportAssetAbsZipPath(relPath, roots);
          if (!files[imgKey]) {
            missing.push(relPath);
          }
        }
      }

      rows.push({
        id: mi.id,
        kind: mi.kind,
        title: mi.title,
        status: missing.length ? 'missing-images' : 'ok',
        missing,
        portableBundlePath: mi.portableBundlePath,
      });
    }

    setPortableBundlesById(bundlesById);
    setValidation(rows);
  };

  const prepareFromZipBytes = async (bytes: Uint8Array) => {
    await yieldToBrowser();
    const exportFiles = unzipSync(bytes);

    const wrapPrefix = detectWrapPrefix(exportFiles);
    if (wrapPrefix === null) {
      throw new Error('Zip does not contain hapa_forge_export/manifest.json');
    }

    const manifestKey = `${wrapPrefix}hapa_forge_export/manifest.json`;
    const mfBytes = exportFiles[manifestKey];
    if (!mfBytes) {
      throw new Error('Missing manifest.json in export');
    }
    const mfRes = safeJsonParse<any>(strFromU8(mfBytes));
    if (mfRes.ok === false) {
      throw new Error(`Malformed manifest.json: ${mfRes.error}`);
    }
    if (!isForgeExportManifest(mfRes.value)) {
      throw new Error('manifest.json is not a valid Hapa Forge export manifest');
    }

    const context: ForgeExportContext = {
      wrapPrefix,
      exportFiles,
      exportManifest: mfRes.value,
    };
    setCtx(context);
    await validateExportContext(context);
  };

  const onNextFromSource = async () => {
    setIsPreparing(true);
    setPrepareMsg('Preparing source…');
    try {
      if (sourceMode === 'library') {
        const chosen = libraryItems.filter((i) => selectedSet.has(i.id));
        if (chosen.length === 0) {
          alert('Select at least one Library item first.');
          return;
        }
        setPrepareMsg(`Exporting ${chosen.length} item(s) to hapa_forge_export…`);

        const exportBlob = await exportLibraryItemsToHapaZip(chosen, (p) => {
          setPrepareMsg(
            `Exporting ${Math.max(1, p.current)}/${p.total} — ${p.phase}${p.title ? ` — ${p.title}` : ''}`
          );
        });
        const bytes = new Uint8Array(await exportBlob.arrayBuffer());
        setPrepareMsg('Reading export zip…');
        await prepareFromZipBytes(bytes);
      } else {
        if (!zipFile) {
          alert('Choose a hapa_forge_export_*.zip file first.');
          return;
        }
        setPrepareMsg(`Reading ${zipFile.name}…`);
        const bytes = new Uint8Array(await zipFile.arrayBuffer());
        await prepareFromZipBytes(bytes);
      }

      setStage('validate');
    } catch (e: any) {
      console.error('Port preparation failed', e);
      alert(`Failed to prepare export. ${e?.message || e}`);
    } finally {
      setIsPreparing(false);
      setPrepareMsg('');
    }
  };

  const onGenerate = async () => {
    if (!ctx) return;
    setIsGenerating(true);
    setGenProgress({ phase: 'graph', current: 0, total: ctx.exportManifest.items.length });
    try {
      const { blob } = await buildHapaHandoffZip({
        exportFiles: ctx.exportFiles,
        exportWrapPrefix: ctx.wrapPrefix,
        exportManifest: ctx.exportManifest,
        portableBundlesById,
        computeSha256: true,
        onProgress: (p) => setGenProgress(p),
      });

      const filename = `hapa_handoff_${formatDateYmd(new Date())}_${ctx.exportManifest.items.length}.zip`;
      downloadBlob(blob, filename);
      setStage('generate');
    } catch (e: any) {
      console.error('Handoff zip generation failed', e);
      alert(`Failed to generate handoff zip. ${e?.message || e}`);
    } finally {
      setIsGenerating(false);
      setGenProgress(null);
    }
  };

  const statusBadge = (status: ValidationRow['status']) => {
    const base = 'text-[10px] font-mono px-2 py-1 rounded border '; // style
    if (status === 'ok') return <span className={base + 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'}>OK</span>;
    if (status === 'missing-bundle') return <span className={base + 'bg-rose-500/10 border-rose-500/20 text-rose-200'}>MISSING BUNDLE</span>;
    if (status === 'invalid-bundle') return <span className={base + 'bg-rose-500/10 border-rose-500/20 text-rose-200'}>INVALID BUNDLE</span>;
    return <span className={base + 'bg-amber-500/10 border-amber-500/20 text-amber-200'}>MISSING FILES</span>;
  };

  const canNext = sourceMode === 'library' ? selectedIds.length > 0 : !!zipFile;

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-orbitron text-2xl text-white">Port to Hapa</h1>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Package a <span className="font-mono text-slate-200">hapa_forge_export</span> into a Hapa-ready handoff zip with a deterministic node graph manifest.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            <Link className="text-hapa-blue hover:underline" to="/library">Back to Library</Link>
          </div>
        </div>

        {/* Wizard steps */}
        <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-300">
          <div className={stage === 'source' ? 'text-white' : ''}>1) Source</div>
          <div className="text-slate-500">→</div>
          <div className={stage === 'validate' ? 'text-white' : ''}>2) Validate</div>
          <div className="text-slate-500">→</div>
          <div className={stage === 'preview' ? 'text-white' : ''}>3) Preview</div>
          <div className="text-slate-500">→</div>
          <div className={stage === 'generate' ? 'text-white' : ''}>4) Download</div>
        </div>

        {/* Step 1: Source */}
        {stage === 'source' && (
          <div className="mt-8 glass-panel rounded-xl border border-white/10 p-6">
            <h2 className="font-orbitron text-lg text-white">Step 1 — Choose source</h2>
            <p className="text-slate-300 text-sm mt-2">
              Use your current Library selection, or upload a previously exported <span className="font-mono">hapa_forge_export_*.zip</span>.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                className={
                  'rounded-xl border p-4 text-left transition-colors ' +
                  (sourceMode === 'library'
                    ? 'border-hapa-blue/40 bg-hapa-blue/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10')
                }
                onClick={() => setSourceMode('library')}
              >
                <div className="text-white font-medium">Use Library items</div>
                <div className="text-slate-300 text-xs mt-1">Select items to port (no network calls).</div>
              </button>

              <button
                className={
                  'rounded-xl border p-4 text-left transition-colors ' +
                  (sourceMode === 'zip'
                    ? 'border-hapa-blue/40 bg-hapa-blue/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10')
                }
                onClick={() => setSourceMode('zip')}
              >
                <div className="text-white font-medium">Upload export zip</div>
                <div className="text-slate-300 text-xs mt-1">Use an existing hapa_forge_export_*.zip file.</div>
              </button>
            </div>

            {sourceMode === 'library' && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-mono text-slate-300">
                    {selectedIds.length} selected • {libraryItems.length} in library
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                      onClick={selectAll}
                    >
                      Select All
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                      onClick={clearSelection}
                      disabled={selectedIds.length === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {libraryItems.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-300">
                    Nothing in your Library yet. Generate something in Character/Ship/Media first.
                  </div>
                ) : (
                  <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/20">
                    {libraryItems.map((it) => (
                      <label
                        key={it.id}
                        className="flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-b-0 text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSet.has(it.id)}
                          onChange={() => toggleSelected(it.id)}
                        />
                        <span className="text-xs font-mono text-slate-400 w-24">{it.kind}</span>
                        <span className="flex-1">{it.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sourceMode === 'zip' && (
              <div className="mt-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.currentTarget.value = '';
                    setZipFile(f);
                  }}
                />

                <div className="flex items-center gap-3">
                  <button
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose zip…
                  </button>
                  <div className="text-xs text-slate-300">
                    {zipFile ? zipFile.name : 'No file selected'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                onClick={() => navigate('/library')}
              >
                Cancel
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30 disabled:opacity-50"
                onClick={onNextFromSource}
                disabled={!canNext || isPreparing}
              >
                {isPreparing ? 'Preparing…' : 'Next → Validate'}
              </button>
            </div>

            {isPreparing && prepareMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs font-mono text-slate-200">
                {prepareMsg}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Validate */}
        {stage === 'validate' && ctx && (
          <div className="mt-8 glass-panel rounded-xl border border-white/10 p-6">
            <h2 className="font-orbitron text-lg text-white">Step 2 — Validate</h2>
            <p className="text-slate-300 text-sm mt-2">
              We verify portable bundles and ensure every <span className="font-mono">assets[].path</span> points to an existing file in the zip.
            </p>

            <div className="mt-5 overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-black/30">
                  <tr className="text-left text-xs font-mono text-slate-300">
                    <th className="p-3">Item</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="p-3 text-slate-200">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-[11px] font-mono text-slate-400">{row.id}</div>
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-xs">{row.kind}</td>
                      <td className="p-3">{statusBadge(row.status)}</td>
                      <td className="p-3 text-xs text-slate-300">
                        {row.missing.length ? (
                          <div className="space-y-1">
                            {row.missing.slice(0, 3).map((m) => (
                              <div key={m} className="font-mono">{m}</div>
                            ))}
                            {row.missing.length > 3 && (
                              <div className="font-mono text-slate-400">+{row.missing.length - 3} more…</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                onClick={() => setStage('source')}
              >
                ← Back
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30 disabled:opacity-50"
                onClick={() => setStage('preview')}
                disabled={!validation.some((r) => r.status === 'ok')}
                title="Preview the node graph + assets that Hapa will ingest before generating the handoff zip"
              >
                Next → Preview
              </button>
            </div>
          </div>
        )}

        
        {/* Step 3: Preview */}
        {stage === 'preview' && ctx && (
          <div className="mt-8 glass-panel rounded-xl border border-white/10 p-6">
            <h2 className="font-orbitron text-lg text-white">Step 3 — Preview</h2>
            <p className="text-slate-300 text-sm mt-2">
              Inspect the inferred node graph, JSON pointers, and referenced assets before generating the Hapa handoff zip.
            </p>

            {(() => {
              const importManifest = buildHapaImportManifest({
                exportManifest: ctx.exportManifest,
                portableBundlesById,
              });

              return (
                <HapaPreviewPanel
                  sourceMode={sourceMode}
                  exportManifest={ctx.exportManifest}
                  importManifest={importManifest}
                  portableBundlesById={portableBundlesById}
                  exportFiles={ctx.exportFiles}
                  zipPrefix={ctx.wrapPrefix}
                  libraryItems={sourceMode === 'library' ? libraryItems : undefined}
                  validationRows={validation}
                />
              );
            })()}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                onClick={() => setStage('validate')}
              >
                ← Back
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30 disabled:opacity-50"
                onClick={onGenerate}
                disabled={isGenerating}
                title="Generates a new zip that embeds the original export folder unchanged plus a Hapa import manifest"
              >
                {isGenerating ? 'Generating…' : 'Generate Hapa Handoff Zip'}
              </button>
            </div>

            {isGenerating && genProgress && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs font-mono text-slate-200">
                {genProgress.phase.toUpperCase()} — {genProgress.current}/{genProgress.total}
                {genProgress.title ? ` — ${genProgress.title}` : ''}
              </div>
            )}
          </div>
        )}

{/* Step 4: Download (simple success state) */}
        {stage === 'generate' && (
          <div className="mt-8 glass-panel rounded-xl border border-white/10 p-6">
            <h2 className="font-orbitron text-lg text-white">Step 4 — Download</h2>
            <p className="text-slate-300 text-sm mt-2">
              Your handoff zip has been downloaded. It includes the original <span className="font-mono">hapa_forge_export</span> folder unchanged and a single <span className="font-mono">hapa_import_manifest.json</span>.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <Link
                to="/library"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
              >
                Back to Library
              </Link>
              <button
                className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30"
                onClick={() => {
                  // Start again (keep source selection).
                  setCtx(null);
                  setValidation([]);
                  setPortableBundlesById({});
                  setStage('source');
                }}
              >
                Port another…
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
