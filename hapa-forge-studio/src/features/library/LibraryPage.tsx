import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadBlob, downloadDataUrl, downloadJson, copyToClipboard } from '@/shared/export/hapaBundle';
import { exportLibraryItemsToHapaZip, type HapaZipProgress } from '@/shared/export/hapaZip';
import {
  deleteLibraryItem,
  getLibraryItem,
  listLibraryItems,
  LibraryItem,
  upsertLibraryItem,
} from '@/shared/storage/library';
import {
  getBundleBestImageDataUrl,
  getBundlePreferredAspectRatio,
  getBundleSuggestedPrompt,
  getBundleTitle,
} from '@/shared/export/selectors';
import { strFromU8, unzipSync } from 'fflate';

const kindLabel: Record<LibraryItem['kind'], string> = {
  character: 'Character',
  ship: 'Spaceship',
  media: 'Media',
};

export default function LibraryPage() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<HapaZipProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const items = useMemo(() => {
    tick; // re-render on updates
    return listLibraryItems();
  }, [tick]);

  const exportPhaseLabel = exportProgress
    ? (
        {
          prepare: 'Preparing',
          'write-images': 'Writing images',
          'write-json': 'Writing JSON',
          zip: 'Zipping',
        } as const
      )[exportProgress.phase]
    : '';

  // Prune selections if items were deleted
  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => items.some((i) => i.id === id)));
  }, [items]);

  const onDelete = (id: string) => {
    if (!confirm('Delete this item from your library?')) return;
    deleteLibraryItem(id);
    setTick((t) => t + 1);
  };

  const sendToMediaStudio = (item: LibraryItem) => {
    const imageDataUrl = getBundleBestImageDataUrl(item.bundle);
    if (!imageDataUrl) {
      alert('No image asset available in this bundle.');
      return;
    }

    const payload = {
      imageDataUrl,
      prompt: getBundleSuggestedPrompt(item.bundle) || '',
      aspectRatio: getBundlePreferredAspectRatio(item.bundle),
    };

    try {
      sessionStorage.setItem('hapa_forge_media_handoff_v1', JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to write media handoff payload', e);
    }

    navigate('/media?handoff=1');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const selectAll = () => {
    setSelectedIds(items.map((i) => i.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
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

  const exportItemsToZip = async (targetItems: LibraryItem[]) => {
    if (targetItems.length === 0) return;

    setIsExporting(true);
    setExportProgress({ phase: 'prepare', current: 0, total: targetItems.length });
    try {
      const blob = await exportLibraryItemsToHapaZip(targetItems, (p) => setExportProgress(p));
      const filename = `hapa_forge_export_${formatDateYmd(new Date())}_${targetItems.length}.zip`;
      downloadBlob(blob, filename);
    } catch (e: any) {
      console.error('Hapa zip export failed', e);
      alert(`Zip export failed. ${e?.message || e}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const onExportSelectedZip = async () => {
    const selected = items.filter((i) => selectedSet.has(i.id));
    await exportItemsToZip(selected);
  };

  const onExportAllZip = async () => {
    if (items.length === 0) return;
    // Keep UX intuitive: select everything, then export.
    setSelectedIds(items.map((i) => i.id));
    await exportItemsToZip(items);
  };

  const onPortToHapa = () => {
    // Pass current selection to /port so the wizard can default to these items.
    try {
      sessionStorage.setItem('hapa_forge_port_selected_ids_v1', JSON.stringify(selectedIds));
    } catch (e) {
      console.warn('Failed to write port selection', e);
    }
    navigate('/port');
  };

  const ensureUniqueLibraryId = (candidate: string): string => {
    const base = candidate && String(candidate).trim().length ? String(candidate).trim() : `imported_${Date.now()}`;
    if (!getLibraryItem(base)) return base;
    const suffix = Date.now().toString(36);
    return `${base}_import_${suffix}`;
  };

  const bytesToBase64 = (bytes: Uint8Array): string => {
    // Prefer Buffer when available (some environments / polyfills).
    const Buf = (globalThis as any)?.Buffer;
    if (Buf?.from) {
      return Buf.from(bytes).toString('base64');
    }

    // Prefer TextDecoder('latin1') for a safe 1-byte-per-code-unit binary string.
    try {
      if (typeof TextDecoder !== 'undefined') {
        const decoder = new TextDecoder('latin1');
        return btoa(decoder.decode(bytes));
      }
    } catch {
      // Fall back to manual chunked encoding.
    }

    const parts: string[] = [];
    const chunkSize = 0x2000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      // Avoid spread operator on large arrays.
      let s = '';
      for (let j = 0; j < sub.length; j++) s += String.fromCharCode(sub[j]);
      parts.push(s);
    }
    return btoa(parts.join(''));
  };

  const bytesToDataUrl = (bytes: Uint8Array, mimeType: string): string => {
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  };

  const mimeFromPath = (path: string): string => {
    const lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
  };

  const importBundleIntoLibrary = (bundle: any, preferredId?: string, subtitle?: string, createdAt?: number) => {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Invalid bundle JSON');
    }
    if (bundle.version !== '1.0' || (bundle.kind !== 'character' && bundle.kind !== 'ship' && bundle.kind !== 'media')) {
      throw new Error('Not a valid HapaBundle (expected version="1.0" and kind)');
    }

    const id = ensureUniqueLibraryId(preferredId || `import_${bundle.kind}_${Date.now()}`);
    const title = getBundleTitle(bundle);
    const thumb = getBundleBestImageDataUrl(bundle) || undefined;
    const ts = typeof createdAt === 'number' ? createdAt : typeof bundle.createdAt === 'number' ? bundle.createdAt : Date.now();

    const item: LibraryItem = {
      id,
      kind: bundle.kind,
      title,
      subtitle,
      createdAt: ts,
      thumbnailDataUrl: thumb,
      bundle,
    };
    upsertLibraryItem(item);
  };

  const onImportFile = async (file: File) => {
    setIsImporting(true);
    // Give React a chance to repaint "Importing…" before doing heavy synchronous work.
    await yieldToBrowser();
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.zip')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await yieldToBrowser();
        const zipFiles = unzipSync(bytes);

        const manifestKey =
          zipFiles["hapa_forge_export/manifest.json"]
            ? "hapa_forge_export/manifest.json"
            : zipFiles['manifest.json']
              ? 'manifest.json'
              : Object.keys(zipFiles).find((k) => k.endsWith('/manifest.json'));

        if (!manifestKey) {
          throw new Error('Zip does not contain manifest.json');
        }

        const rootPrefix = manifestKey.endsWith('/manifest.json')
          ? manifestKey.slice(0, -'/manifest.json'.length)
          : '';
        const withRoot = (rel: string) => (rootPrefix ? `${rootPrefix}/${rel}` : rel);

        const manifest = JSON.parse(strFromU8(zipFiles[manifestKey]));
        if (!manifest || !Array.isArray(manifest.items)) {
          throw new Error('Malformed manifest.json');
        }

        let importedCount = 0;

        let itemIdx = 0;

        for (const mi of manifest.items) {
          // Yield between items so the UI stays responsive for large imports.
          if (itemIdx > 0 && itemIdx % 1 === 0) {
            await yieldToBrowser();
          }
          itemIdx++;
          const portablePath = typeof mi?.portableBundlePath === 'string' ? mi.portableBundlePath : undefined;
          const canonicalPath = typeof mi?.bundlePath === 'string' ? mi.bundlePath : undefined;

          const bundleKey = portablePath && zipFiles[withRoot(portablePath)]
            ? withRoot(portablePath)
            : canonicalPath && zipFiles[withRoot(canonicalPath)]
              ? withRoot(canonicalPath)
              : undefined;

          if (!bundleKey) {
            console.warn('Missing bundle for manifest item', mi);
            continue;
          }

          const bundle = JSON.parse(strFromU8(zipFiles[bundleKey]));
          if (!bundle || typeof bundle !== 'object') continue;

          // If this is a portable bundle, re-hydrate image assets back into dataUrls.
          if (Array.isArray(bundle.assets)) {
            for (let aIdx = 0; aIdx < bundle.assets.length; aIdx++) {
              const asset = bundle.assets[aIdx];
              if (asset?.type === 'image' && !asset.dataUrl && typeof asset.path === 'string') {
                const imgKey = zipFiles[withRoot(asset.path)]
                  ? withRoot(asset.path)
                  : zipFiles[asset.path]
                    ? asset.path
                    : undefined;
                if (!imgKey) continue;
                const mime = typeof asset.mimeType === 'string' ? asset.mimeType : mimeFromPath(asset.path);
                asset.dataUrl = bytesToDataUrl(zipFiles[imgKey], mime);
              }

              // Yield occasionally when converting large image payloads.
              if (aIdx > 0 && aIdx % 3 === 0) {
                await yieldToBrowser();
              }
            }
          }

          importBundleIntoLibrary(bundle, mi?.id, mi?.subtitle, mi?.createdAt);
          importedCount++;
        }

        setTick((t) => t + 1);
        alert(`Imported ${importedCount} item${importedCount === 1 ? '' : 's'} from zip.`);
        return;
      }

      // JSON bundle import
      const text = await file.text();
      const parsed = JSON.parse(text);

      // If a LibraryItem-like object was provided, accept it but normalize to current schema.
      if (parsed && typeof parsed === 'object' && parsed.bundle) {
        const bundle = parsed.bundle;
        importBundleIntoLibrary(bundle, parsed.id, parsed.subtitle, parsed.createdAt);
        setTick((t) => t + 1);
        alert('Imported 1 item from JSON.');
        return;
      }

      // If a bare bundle
      importBundleIntoLibrary(parsed);
      setTick((t) => t + 1);
      alert('Imported 1 item from JSON.');
    } catch (e: any) {
      console.error('Import failed', e);
      alert(`Import failed. ${e?.message || e}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <input
          ref={importInputRef}
          type="file"
          className="hidden"
          accept=".zip,.json,application/zip,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            // Allow importing the same file twice
            e.currentTarget.value = '';
            if (!file) return;
            await onImportFile(file);
          }}
        />

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-orbitron text-2xl text-white">Library</h1>
            <p className="text-slate-300 mt-2">
              Saved characters, ships, and media outputs. Export as Hapa Bundles.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {items.length} item{items.length === 1 ? '' : 's'}
          </div>
        </div>

        {items.length > 0 && (
          <>
            <div className="mt-6 glass-panel rounded-xl border border-white/10 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-slate-300">
                  {selectedIds.length} selected
                </span>
                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                  onClick={selectAll}
                  disabled={isExporting || isImporting}
                >
                  Select All
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                  onClick={clearSelection}
                  disabled={selectedIds.length === 0 || isExporting || isImporting}
                >
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                  onClick={onPortToHapa}
                  disabled={isExporting || isImporting || items.length === 0}
                  title="Open the Port to Hapa wizard (uses your current selection if set)"
                >
                  Port to Hapa…
                </button>

                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting || isExporting}
                >
                  {isImporting ? 'Importing…' : 'Import (Bundle/Zip)'}
                </button>

                <button
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10 disabled:opacity-50"
                  onClick={onExportAllZip}
                  disabled={items.length === 0 || isExporting || isImporting}
                  title="Export all items to a single Hapa ZIP"
                >
                  Export All (Hapa ZIP)
                </button>

                <button
                  className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30 disabled:opacity-50"
                  onClick={onExportSelectedZip}
                  disabled={selectedIds.length === 0 || isExporting || isImporting}
                >
                  {isExporting ? 'Exporting…' : 'Export Selected (Hapa ZIP)'}
                </button>
              </div>
            </div>

            {isExporting && exportProgress && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs font-mono text-slate-200">
                Exporting {Math.max(1, exportProgress.current)}/{exportProgress.total} — {exportPhaseLabel}
                {exportProgress.title ? ` — ${exportProgress.title}` : ''}
              </div>
            )}

            {isImporting && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs font-mono text-slate-200">
                Importing… this may take a moment for large zips.
              </div>
            )}
          </>
        )}

        {items.length === 0 ? (
          <div className="mt-10 glass-panel rounded-xl p-6 border border-white/10 text-slate-300">
            Nothing saved yet. Generate something in Character or Media Studio, then click “Save to Library”.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className={`glass-panel rounded-xl border border-white/10 overflow-hidden relative ${
                  selectedSet.has(item.id) ? 'ring-2 ring-hapa-blue/30' : ''
                }`}
              >
                <div className="absolute top-3 left-3 z-20 bg-black/50 border border-white/10 rounded-md px-2 py-1">
                  <label className="flex items-center gap-2 text-[11px] font-mono text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggleSelected(item.id)}
                    />
                    Select
                  </label>
                </div>

                <div className="h-40 bg-black/30 border-b border-white/10 flex items-center justify-center overflow-hidden">
                  {item.thumbnailDataUrl ? (
                    <img
                      src={item.thumbnailDataUrl}
                      className="w-full h-full object-cover"
                      alt={item.title}
                    />
                  ) : (
                    <div className="text-slate-500 text-xs font-mono">No thumbnail</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {kindLabel[item.kind]} • {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-200">
                      {item.kind}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(item.kind === 'character' || item.kind === 'ship') && (
                      <button
                        className="px-3 py-2 rounded-lg bg-hapa-purple/20 border border-hapa-purple/30 text-hapa-purple text-xs hover:bg-hapa-purple/30"
                        onClick={() => sendToMediaStudio(item)}
                      >
                        {item.kind === 'character' ? 'Use portrait in Media' : 'Use concept art in Media'}
                      </button>
                    )}

                    {(item.kind === 'character' || item.kind === 'ship') && (
                      <button
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                        onClick={() =>
                          navigate(
                            `/media?libraryItemId=${encodeURIComponent(item.id)}&use=image`
                          )
                        }
                      >
                        Open in Media (link)
                      </button>
                    )}

                    {item.kind === 'ship' && (
                      <button
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                        onClick={() => navigate(`/ship?libraryItemId=${encodeURIComponent(item.id)}`)}
                      >
                        Open
                      </button>
                    )}

                    <button
                      className="px-3 py-2 rounded-lg bg-hapa-blue/20 border border-hapa-blue/30 text-hapa-blue text-xs hover:bg-hapa-blue/30"
                      onClick={() => downloadJson(item.bundle, `${item.title.replace(/\s+/g, '_')}.hapa.bundle.json`)}
                    >
                      Download JSON
                    </button>

                    {item.bundle.assets
                      .filter((a) => a.type === 'image' && a.dataUrl)
                      .slice(0, 3)
                      .map((asset) => (
                        <button
                          key={asset.id}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                          onClick={() =>
                            downloadDataUrl(
                              asset.dataUrl!,
                              asset.name || `${item.id}.${asset.mimeType?.split('/')[1] || 'png'}`
                            )
                          }
                        >
                          Download image
                        </button>
                      ))}

                    {item.bundle.assets
                      .filter((a) => a.type === 'video' && a.url)
                      .slice(0, 1)
                      .map((asset) => (
                        <button
                          key={asset.id}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs hover:bg-white/10"
                          onClick={async () => {
                            await copyToClipboard(asset.url!);
                            alert('Video link copied to clipboard.');
                          }}
                        >
                          Copy video link
                        </button>
                      ))}

                    <button
                      className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs hover:bg-red-500/20"
                      onClick={() => onDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
