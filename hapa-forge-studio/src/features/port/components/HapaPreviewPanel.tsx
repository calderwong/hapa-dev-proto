import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { LibraryItem } from '@/shared/storage/library';
import type { HapaBundle, HapaAsset } from '@/shared/export/hapaBundle';
import type { HapaForgeExportManifest } from '@/shared/export/hapaZip';
import type { HapaGraphNode, HapaImportManifest } from '@/shared/port/hapaGraph';
import { resolveJsonPointer } from '@/shared/port/jsonPointer';
import {
  normalizeBundlePathForZipLookup,
  resolveBundleZipKey,
  resolveExportAssetZipKey,
  toZipAbsPathForExportFile,
} from '@/shared/port/pathResolve';

type TabKey = 'graph' | 'node' | 'assets' | 'raw';

type ValidationStatus = 'ok' | 'missing-bundle' | 'invalid-bundle' | 'missing-images';

export type PreviewValidationRow = {
  id: string;
  kind: 'character' | 'ship' | 'media';
  title: string;
  status: ValidationStatus;
  missing: string[];
  portableBundlePath?: string;
};

type PreviewWarning = {
  kind: 'bundle' | 'asset' | 'pointer' | 'json';
  message: string;
  nodeId?: string;
  pointer?: string;
  assetId?: string;
  path?: string;
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

const inferImageMime = (asset: { mimeType?: string; path?: string }): string => {
  if (isNonEmptyString(asset.mimeType)) return asset.mimeType;
  const p = asset.path || '';
  const lower = p.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
};

const pretty = (v: any) => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const nodeStatusFromBundle = (node: HapaGraphNode, bundle: HapaBundle | undefined): string | null => {
  if (!bundle) return null;
  if (!node.stepId) return null;
  const step = (bundle.steps || []).find((s) => s?.id === node.stepId);
  const st = step?.status;
  return st === 'success' || st === 'error' ? st : null;
};

const badge = (text: string, tone: 'neutral' | 'warn' | 'error' | 'ok') => {
  const base = 'text-[10px] font-mono px-2 py-1 rounded border ';
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
      : tone === 'warn'
      ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
      : tone === 'error'
      ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
      : 'bg-white/5 border-white/10 text-slate-200';
  return <span className={base + cls}>{text}</span>;
};

export default function HapaPreviewPanel(props: {
  sourceMode: 'library' | 'zip';
  exportManifest: HapaForgeExportManifest;
  importManifest: HapaImportManifest;
  portableBundlesById: Record<string, HapaBundle | undefined>;
  exportFiles: Record<string, Uint8Array>;
  zipPrefix: string;
  libraryItems?: LibraryItem[];
  validationRows: PreviewValidationRow[];
}) {
  const embeddedExportRoot = props.importManifest.embeddedExportRoot || 'hapa_forge_export';

  const validationById = useMemo(() => {
    const m = new Map<string, PreviewValidationRow>();
    for (const r of props.validationRows) m.set(r.id, r);
    return m;
  }, [props.validationRows]);

  const libraryById = useMemo(() => {
    const m = new Map<string, LibraryItem>();
    for (const it of props.libraryItems || []) m.set(it.id, it);
    return m;
  }, [props.libraryItems]);

  const warningsById = useMemo(() => {
    const out = new Map<string, PreviewWarning[]>();

    for (const mi of props.exportManifest.items || []) {
      const warnings: PreviewWarning[] = [];
      const row = validationById.get(mi.id);

      if (!row) {
        warnings.push({ kind: 'bundle', message: 'Missing validation row (internal).', path: mi.portableBundlePath });
      } else {
        if (row.status === 'missing-bundle') {
          warnings.push({
            kind: 'bundle',
            message: `Missing portable bundle: ${row.portableBundlePath || mi.portableBundlePath}`,
            path: row.portableBundlePath || mi.portableBundlePath,
          });
        } else if (row.status === 'invalid-bundle') {
          warnings.push({
            kind: 'json',
            message: `Portable bundle is invalid JSON or not a HapaBundle: ${row.portableBundlePath || mi.portableBundlePath}`,
            path: row.portableBundlePath || mi.portableBundlePath,
          });
        }

        if (row.status === 'missing-images') {
          for (const p of row.missing || []) {
            warnings.push({ kind: 'asset', message: `Missing image file in zip: ${p}`, path: p });
          }
        }
      }

      // Pointer warnings (only for items with a parsed bundle and graph nodes)
      const bundle = props.portableBundlesById[mi.id];
      const graphItem = props.importManifest.items.find((x) => x.id === mi.id);

      if (bundle && graphItem) {
        for (const node of graphItem.nodes || []) {
          if (node.promptRef?.jsonPointer) {
            const res = resolveJsonPointer(bundle, node.promptRef.jsonPointer);
            if (res.ok === false) {
              const err = res.error;
              warnings.push({
                kind: 'pointer',
                nodeId: node.nodeId,
                pointer: node.promptRef.jsonPointer,
                message: `Pointer failed for prompt: ${err.message} (${err.atPointer || ''})`,
              });
            }
          }

          for (const outRef of node.outputs || []) {
            const res = resolveJsonPointer(bundle, outRef.valueRef.jsonPointer);
            if (res.ok === false) {
              const err = res.error;
              warnings.push({
                kind: 'pointer',
                nodeId: node.nodeId,
                pointer: outRef.valueRef.jsonPointer,
                message: `Pointer failed for output "${outRef.key}": ${err.message} (${err.atPointer || ''})`,
              });
            }
          }
        }
      }

      out.set(mi.id, warnings);
    }

    return out;
  }, [props.exportManifest.items, props.importManifest.items, props.portableBundlesById, validationById]);

  const firstOk = useMemo(() => {
    const ok = props.validationRows.find((r) => r.status === 'ok');
    return ok?.id || props.validationRows[0]?.id || null;
  }, [props.validationRows]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(firstOk);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('graph');

  // Keep selectedItemId valid if items change.
  useEffect(() => {
    if (!selectedItemId && firstOk) setSelectedItemId(firstOk);
  }, [firstOk, selectedItemId]);

  const selectedExportItem = useMemo(() => {
    if (!selectedItemId) return null;
    return (props.exportManifest.items || []).find((i) => i.id === selectedItemId) || null;
  }, [props.exportManifest.items, selectedItemId]);

  const selectedGraphItem = useMemo(() => {
    if (!selectedItemId) return null;
    return props.importManifest.items.find((i) => i.id === selectedItemId) || null;
  }, [props.importManifest.items, selectedItemId]);

  const selectedBundle = useMemo(() => {
    if (!selectedItemId) return undefined;
    return props.portableBundlesById[selectedItemId];
  }, [props.portableBundlesById, selectedItemId]);

  // When item changes, default selected node to first node.
  useEffect(() => {
    const nodes = selectedGraphItem?.nodes || [];
    if (nodes.length) {
      setSelectedNodeId(nodes[0].nodeId);
    } else {
      setSelectedNodeId(null);
    }
  }, [selectedGraphItem?.id]);

  const selectedNode = useMemo(() => {
    const nodes = selectedGraphItem?.nodes || [];
    if (!nodes.length) return null;
    return nodes.find((n) => n.nodeId === selectedNodeId) || nodes[0] || null;
  }, [selectedGraphItem?.nodes, selectedNodeId]);

  // Object URL thumbnails for zip-sourced image bytes
  const createdUrlsRef = useRef<string[]>([]);
  const [objectUrlsByAssetId, setObjectUrlsByAssetId] = useState<Record<string, string>>({});

  // Build a map of image assetId -> dataUrl from the in-app library bundle (if available).
  const libraryDataUrlByAssetId = useMemo(() => {
    if (!selectedItemId) return {};
    const it = libraryById.get(selectedItemId);
    const map: Record<string, string> = {};
    for (const a of it?.bundle?.assets || []) {
      if (a?.type === 'image' && isNonEmptyString(a.dataUrl) && a.dataUrl.startsWith('data:image/')) {
        map[a.id] = a.dataUrl;
      }
    }
    return map;
  }, [libraryById, selectedItemId]);

  useEffect(() => {
    // Cleanup prior URLs
    for (const u of createdUrlsRef.current) URL.revokeObjectURL(u);
    createdUrlsRef.current = [];
    setObjectUrlsByAssetId({});

    if (!selectedItemId) return;
    if (!selectedBundle) return;

    const urls: Record<string, string> = {};

    for (const a of selectedBundle.assets || []) {
      if (a?.type !== 'image') continue;

      // Prefer library dataUrl if present (library source), otherwise portable bundle may have dataUrl.
      const libUrl = libraryDataUrlByAssetId[a.id];
      if (isNonEmptyString(libUrl)) continue;
      if (isNonEmptyString(a.dataUrl) && a.dataUrl.startsWith('data:image/')) continue;
      if (!isNonEmptyString(a.path)) continue;

      // Resolve the image file inside the export zip.
      let key: string | null = null;
      try {
        key = resolveExportAssetZipKey({
          assetPath: a.path,
          embeddedExportRoot,
          zipPrefix: props.zipPrefix,
        });
      } catch {
        key = null;
      }

      if (!key) continue;
      const bytes = props.exportFiles[key];
      if (!bytes) continue;

      const mime = inferImageMime(a);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
      createdUrlsRef.current.push(url);
      urls[a.id] = url;
    }

    setObjectUrlsByAssetId(urls);

    return () => {
      // Cleanup on unmount / item switch
      for (const u of createdUrlsRef.current) URL.revokeObjectURL(u);
      createdUrlsRef.current = [];
    };
  }, [embeddedExportRoot, libraryDataUrlByAssetId, props.exportFiles, props.zipPrefix, selectedBundle, selectedItemId]);

  const selectedWarnings = useMemo(() => {
    if (!selectedItemId) return [];
    return warningsById.get(selectedItemId) || [];
  }, [warningsById, selectedItemId]);

  const nodeWarningsCount = (nodeId: string) => {
    const ws = selectedWarnings;
    let c = 0;
    for (const w of ws) {
      if (w.nodeId === nodeId) c++;
    }
    return c;
  };

  const resolveRefValue = (jsonPointer?: string) => {
    if (!selectedBundle || !jsonPointer) return { ok: false as const, error: { message: 'No bundle/pointer', pointer: jsonPointer || '' } };
    return resolveJsonPointer(selectedBundle, jsonPointer);
  };

  const renderValue = (v: any) => {
    if (v === null) return <div className="text-slate-400 italic">null</div>;
    if (v === undefined) return <div className="text-slate-400 italic">undefined</div>;
    if (typeof v === 'string') return <pre className="whitespace-pre-wrap break-words text-slate-200 text-sm">{v}</pre>;
    if (typeof v === 'number' || typeof v === 'boolean') return <pre className="text-slate-200 text-sm">{String(v)}</pre>;
    return (
      <pre className="whitespace-pre-wrap break-words text-slate-200 text-xs font-mono max-h-80 overflow-auto">
        {pretty(v)}
      </pre>
    );
  };

  const tabButton = (k: TabKey, label: string) => (
    <button
      className={
        'px-3 py-2 text-xs rounded-lg border transition-colors ' +
        (tab === k ? 'bg-hapa-blue/10 border-hapa-blue/30 text-hapa-blue' : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10')
      }
      onClick={() => setTab(k)}
    >
      {label}
    </button>
  );

  const nodes = selectedGraphItem?.nodes || [];
  const hasGraph = nodes.length > 0;

  // For "Raw" tab: show how rooted + relative bundlePath would resolve for zip lookup.
  const pathExamples = useMemo(() => {
    const out: Array<{ label: string; bundlePath: string; rel: string; abs: string }> = [];
    if (!selectedGraphItem) return out;
    const firstNode = selectedGraphItem.nodes?.find((n) => isNonEmptyString(n.promptRef?.bundlePath)) || selectedGraphItem.nodes?.[0];
    const rooted = firstNode?.promptRef?.bundlePath;
    if (!isNonEmptyString(rooted)) return out;

    const rel = normalizeBundlePathForZipLookup(rooted, embeddedExportRoot);
    const abs = resolveBundleZipKey({ bundlePath: rooted, embeddedExportRoot, zipPrefix: props.zipPrefix });

    out.push({ label: 'Rooted bundlePath', bundlePath: rooted, rel, abs });

    // Also show the relative form for backwards-compat.
    const relativeForm = rel; // e.g. "items/.../bundle.portable.json"
    const abs2 = toZipAbsPathForExportFile(props.zipPrefix, embeddedExportRoot, relativeForm);
    out.push({ label: 'Relative bundlePath', bundlePath: relativeForm, rel: relativeForm, abs: abs2 });

    return out;
  }, [embeddedExportRoot, props.zipPrefix, selectedGraphItem]);

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Left: item list */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-3 py-3 border-b border-white/10">
          <div className="text-xs font-mono text-slate-300">Items</div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          {(props.exportManifest.items || []).map((it) => {
            const row = validationById.get(it.id);
            const status = row?.status || 'invalid-bundle';
            const warnCount = (warningsById.get(it.id) || []).length;

            const isSelected = it.id === selectedItemId;
            return (
              <button
                key={it.id}
                className={
                  'w-full text-left px-3 py-3 border-b border-white/5 last:border-b-0 transition-colors ' +
                  (isSelected ? 'bg-hapa-blue/10' : 'hover:bg-white/10')
                }
                onClick={() => setSelectedItemId(it.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{it.title}</div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">{it.kind} • {it.id}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {status === 'ok' ? badge('OK', 'ok') : status === 'missing-images' ? badge('WARN', 'warn') : badge('ERROR', 'error')}
                    {warnCount > 0 ? badge(`${warnCount}`, status === 'ok' ? 'neutral' : 'warn') : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: preview */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{selectedExportItem?.title || 'Select an item'}</div>
            <div className="text-xs font-mono text-slate-400 truncate">
              {selectedExportItem ? `${selectedExportItem.kind} • ${selectedExportItem.id}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tabButton('graph', 'Graph')}
            {tabButton('node', 'Node Details')}
            {tabButton('assets', 'Assets')}
            {tabButton('raw', 'Raw')}
          </div>
        </div>

        {!selectedExportItem && (
          <div className="mt-4 text-sm text-slate-300">Pick an item on the left to preview.</div>
        )}

        {selectedExportItem && (
          <>
            {/* Warnings */}
            {selectedWarnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs font-mono text-amber-200">Warnings ({selectedWarnings.length})</div>
                <ul className="mt-2 space-y-1 text-xs text-slate-200">
                  {selectedWarnings.slice(0, 8).map((w, idx) => (
                    <li key={idx} className="font-mono break-words">
                      • {w.nodeId ? `[${w.nodeId}] ` : ''}{w.pointer ? `${w.pointer} — ` : ''}{w.message}
                    </li>
                  ))}
                  {selectedWarnings.length > 8 && (
                    <li className="text-xs text-slate-400 font-mono">+{selectedWarnings.length - 8} more…</li>
                  )}
                </ul>
              </div>
            )}

            {/* Tab contents */}
            {tab === 'graph' && (
              <div className="mt-4">
                {!hasGraph ? (
                  <div className="text-sm text-slate-300">
                    No graph nodes available for this item (likely missing/invalid bundle).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nodes.map((n, idx) => {
                      const isSel = n.nodeId === selectedNode?.nodeId;
                      const warn = nodeWarningsCount(n.nodeId);
                      const st = nodeStatusFromBundle(n, selectedBundle);
                      return (
                        <div key={n.nodeId}>
                          <button
                            className={
                              'w-full text-left rounded-lg border p-3 transition-colors ' +
                              (isSel ? 'border-hapa-blue/40 bg-hapa-blue/10' : 'border-white/10 bg-black/20 hover:bg-white/10')
                            }
                            onClick={() => {
                              setSelectedNodeId(n.nodeId);
                              setTab('node');
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-white font-medium truncate">{n.label}</div>
                                <div className="text-xs font-mono text-slate-400 truncate">
                                  {n.type}{n.model ? ` • ${n.model}` : ''}{n.stepId ? ` • ${n.stepId}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {st === 'success' ? badge('SUCCESS', 'ok') : st === 'error' ? badge('ERROR', 'error') : null}
                                {warn > 0 ? badge(`${warn}`, 'warn') : null}
                              </div>
                            </div>
                          </button>
                          {idx < nodes.length - 1 && (
                            <div className="text-center text-slate-500 text-xs my-1">↓</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'node' && (
              <div className="mt-4">
                {!selectedNode ? (
                  <div className="text-sm text-slate-300">Select a node to view details.</div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium">{selectedNode.label}</div>
                        <div className="text-xs font-mono text-slate-400 break-words">{selectedNode.nodeId}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {badge(selectedNode.type, 'neutral')}
                        {selectedNode.model ? badge(selectedNode.model, 'neutral') : null}
                        {selectedNode.stepId ? badge(selectedNode.stepId, 'neutral') : null}
                      </div>
                    </div>

                    {/* Prompt */}
                    <div className="mt-4">
                      <div className="text-xs font-mono text-slate-300">Prompt</div>
                      <div className="mt-2 rounded border border-white/10 bg-black/30 p-3">
                        {selectedNode.promptRef?.jsonPointer ? (
                          (() => {
                            const res = resolveRefValue(selectedNode.promptRef?.jsonPointer);
                            if (res.ok === false) {
                              const err = res.error;
                              return (
                                <div className="text-xs font-mono text-rose-200">
                                  Failed to resolve {selectedNode.promptRef?.jsonPointer}: {err.message}
                                </div>
                              );
                            }
                            return renderValue(res.value);
                          })()
                        ) : (
                          <div className="text-slate-400 text-sm">—</div>
                        )}
                      </div>
                    </div>

                    {/* Outputs */}
                    <div className="mt-4">
                      <div className="text-xs font-mono text-slate-300">Outputs</div>
                      <div className="mt-2 space-y-3">
                        {(selectedNode.outputs || []).length === 0 ? (
                          <div className="text-slate-400 text-sm">—</div>
                        ) : (
                          (selectedNode.outputs || []).map((o) => {
                            const ptr = o.valueRef.jsonPointer;
                            const res = resolveRefValue(ptr);
                            let valueEl: React.ReactNode;
                            if (res.ok === false) {
                              const err = res.error;
                              valueEl = (
                                <div className="text-xs font-mono text-rose-200">
                                  Failed to resolve {ptr}: {err.message}
                                </div>
                              );
                            } else {
                              valueEl = renderValue(res.value);
                            }
                            return (
                              <div key={o.key} className="rounded border border-white/10 bg-black/30 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-mono text-slate-200">{o.key}</div>
                                  <div className="text-[11px] font-mono text-slate-500 break-words">{ptr}</div>
                                </div>
                                <div className="mt-2">{valueEl}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Node assets */}
                    {selectedNode.assets && selectedNode.assets.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-mono text-slate-300">Node Assets</div>
                        <div className="mt-2 space-y-2">
                          {selectedNode.assets.map((a) => (
                            <div key={a.assetId} className="rounded border border-white/10 bg-black/30 p-3 text-xs font-mono">
                              <div className="text-slate-200">{a.kind.toUpperCase()} • {a.assetId}</div>
                              {a.path ? <div className="text-slate-400 break-words">path: {a.path}</div> : null}
                              {a.url ? <div className="text-slate-400 break-words">url: {a.url}</div> : null}
                              {a.sha256 ? <div className="text-slate-400 break-words">sha256: {a.sha256}</div> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'assets' && (
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Images */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-xs font-mono text-slate-300">Images</div>
                    <div className="mt-3 space-y-3">
                      {(selectedBundle?.assets || []).filter((a) => a.type === 'image').length === 0 ? (
                        <div className="text-sm text-slate-400">No image assets found.</div>
                      ) : (
                        (selectedBundle?.assets || [])
                          .filter((a) => a.type === 'image')
                          .map((a) => {
                            const img = a as HapaAsset;
                            const src =
                              libraryDataUrlByAssetId[img.id] ||
                              (isNonEmptyString(img.dataUrl) && img.dataUrl.startsWith('data:image/') ? img.dataUrl : '') ||
                              objectUrlsByAssetId[img.id] ||
                              '';
                            return (
                              <div key={img.id} className="rounded border border-white/10 bg-black/30 p-3">
                                <div className="text-xs font-mono text-slate-200">{img.id}</div>
                                <div className="text-[11px] font-mono text-slate-500 break-words">
                                  {img.path ? `path: ${img.path}` : img.dataUrl ? 'dataUrl: (embedded)' : 'missing image source'}
                                </div>
                                {src ? (
                                  <img
                                    src={src}
                                    alt={img.name || img.id}
                                    className="mt-2 w-full max-h-48 object-contain rounded bg-black/40"
                                  />
                                ) : (
                                  <div className="mt-2 text-xs text-slate-400">No preview available.</div>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  {/* Videos */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-xs font-mono text-slate-300">Videos</div>
                    <div className="mt-3 space-y-2">
                      {(selectedBundle?.assets || []).filter((a) => a.type === 'video').length === 0 ? (
                        <div className="text-sm text-slate-400">No video assets found.</div>
                      ) : (
                        (selectedBundle?.assets || [])
                          .filter((a) => a.type === 'video' && isNonEmptyString(a.url))
                          .map((a) => (
                            <div key={a.id} className="rounded border border-white/10 bg-black/30 p-3">
                              <div className="text-xs font-mono text-slate-200">{a.id}</div>
                              <div className="text-[11px] font-mono text-slate-400 break-words">{a.url}</div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'raw' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-mono text-slate-300">Path resolution examples</div>
                  {pathExamples.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-400">No bundlePath examples available for this item.</div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {pathExamples.map((ex) => (
                        <div key={ex.label} className="rounded border border-white/10 bg-black/30 p-3 text-xs font-mono">
                          <div className="text-slate-200">{ex.label}</div>
                          <div className="text-slate-400 break-words">bundlePath: {ex.bundlePath}</div>
                          <div className="text-slate-400 break-words">normalized (under export root): {ex.rel || '(root)'}</div>
                          <div className="text-slate-400 break-words">zip key: {ex.abs}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-mono text-slate-300">Import manifest item (graph)</div>
                  <pre className="mt-2 text-xs font-mono text-slate-200 max-h-80 overflow-auto whitespace-pre-wrap break-words">
                    {pretty(selectedGraphItem)}
                  </pre>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-mono text-slate-300">Portable bundle JSON</div>
                  <pre className="mt-2 text-xs font-mono text-slate-200 max-h-80 overflow-auto whitespace-pre-wrap break-words">
                    {pretty(selectedBundle)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
