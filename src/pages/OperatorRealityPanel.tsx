import React from 'react';
import PageContainer from '../components/PageContainer';

const CARD_LIBRARY_CORE_NAME = 'card-library';

type PersistenceStats = {
    cardCount: number;
    wikiNodeCount: number;
    wikiEdgeCount: number;
    embeddingCount: number;
    dbSizeBytes: number;
    projectionVersion: number;
    lastUpdated: string;
};

type RealitySnapshot = {
    time: string;
    system?: any;
    diagnostics?: any;
    hypercore?: {
        cardLibraryLogLength?: number;
        wikiLogLength?: number;
    };
    sqlite?: PersistenceStats | any;
    paging?: {
        itemsReturned: number;
        nextCursor: number;
        hasMore: boolean;
        totalLength: number;
    };
    ui?: {
        cardLibrary?: any;
    };
};

const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '—';
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(2)} ${sizes[i]}`;
};

const safeString = (v: any) => {
    if (v === undefined || v === null) return '—';
    const s = String(v);
    return s.length > 0 ? s : '—';
};

const OperatorRealityPanel: React.FC = () => {
    const [snapshot, setSnapshot] = React.useState<RealitySnapshot | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [rebuilding, setRebuilding] = React.useState(false);
    const [status, setStatus] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const updateDebugState = React.useCallback((partial: any) => {
        try {
            const w: any = window as any;
            if (!w.__HAPA_DEBUG_STATE__ || typeof w.__HAPA_DEBUG_STATE__ !== 'object') w.__HAPA_DEBUG_STATE__ = {};
            const prev = w.__HAPA_DEBUG_STATE__.operatorRealityPanel && typeof w.__HAPA_DEBUG_STATE__.operatorRealityPanel === 'object'
                ? w.__HAPA_DEBUG_STATE__.operatorRealityPanel
                : {};
            w.__HAPA_DEBUG_STATE__.operatorRealityPanel = {
                ...prev,
                ...partial,
                updatedAt: new Date().toISOString(),
            };
        } catch {
        }
    }, []);

    React.useEffect(() => {
        updateDebugState({ active: true, mountedAt: new Date().toISOString() });
        return () => {
            updateDebugState({ active: false, unmountedAt: new Date().toISOString() });
        };
    }, [updateDebugState]);

    const loadSnapshot = React.useCallback(async () => {
        if (!window.electronAPI) {
            setError('electronAPI not available');
            return;
        }

        const api = window.electronAPI;

        setLoading(true);
        setError(null);
        setStatus(null);
        updateDebugState({ lastAction: 'refresh', loading: true, error: null, status: null });

        try {
            const [systemStats, persistenceStats, paging, diagnostics] = await Promise.all([
                api.getSystemStats ? api.getSystemStats() : null,
                api.getPersistenceStats ? api.getPersistenceStats() : null,
                api.nexusIndexPage
                    ? api.nexusIndexPage({ coreName: CARD_LIBRARY_CORE_NAME, limit: 1, direction: 'reverse' })
                    : null,
                api.getDiagnosticsSnapshot ? api.getDiagnosticsSnapshot() : null,
            ]);

            const w: any = window as any;
            const debug = w.__HAPA_DEBUG_STATE__;
            const ui =
                debug && typeof debug === 'object' && debug.cardLibrary && typeof debug.cardLibrary === 'object'
                    ? { cardLibrary: debug.cardLibrary }
                    : undefined;

            const next: RealitySnapshot = {
                time: new Date().toISOString(),
                system: systemStats || undefined,
                diagnostics: diagnostics || undefined,
                hypercore: {
                    cardLibraryLogLength:
                        typeof diagnostics?.cardLibrary?.hypercoreLength === 'number'
                            ? diagnostics.cardLibrary.hypercoreLength
                            : typeof systemStats?.cardCount === 'number'
                                ? systemStats.cardCount
                                : undefined,
                    wikiLogLength:
                        typeof diagnostics?.wiki?.hypercoreLength === 'number'
                            ? diagnostics.wiki.hypercoreLength
                            : typeof systemStats?.wikiEntryCount === 'number'
                                ? systemStats.wikiEntryCount
                                : undefined,
                },
                sqlite: persistenceStats || undefined,
                paging:
                    paging && typeof paging === 'object'
                        ? {
                              itemsReturned: Array.isArray(paging.items) ? paging.items.length : 0,
                              nextCursor: typeof paging.nextCursor === 'number' ? paging.nextCursor : 0,
                              hasMore: paging.hasMore === true,
                              totalLength: typeof paging.totalLength === 'number' ? paging.totalLength : 0,
                          }
                        : undefined,
                ui,
            };

            setSnapshot(next);
            updateDebugState({ snapshot: next });
        } catch (e: any) {
            setError(e?.message || String(e));
            updateDebugState({ error: e?.message || String(e) });
        } finally {
            setLoading(false);
            updateDebugState({ loading: false });
        }
    }, [updateDebugState]);

    React.useEffect(() => {
        loadSnapshot();
    }, [loadSnapshot]);

    const snapshotJson = React.useMemo(() => {
        if (!snapshot) return '';
        try {
            return JSON.stringify(snapshot, null, 2);
        } catch {
            return '';
        }
    }, [snapshot]);

    const copyJson = React.useCallback(async () => {
        if (!snapshotJson) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(snapshotJson);
                setStatus('Copied JSON to clipboard');
                updateDebugState({ lastAction: 'copy_json', status: 'Copied JSON to clipboard' });
                return;
            }
            setError('Clipboard API not available');
            updateDebugState({ lastAction: 'copy_json', error: 'Clipboard API not available' });
        } catch (e: any) {
            setError(e?.message || 'Failed to copy');
            updateDebugState({ lastAction: 'copy_json', error: e?.message || 'Failed to copy' });
        }
    }, [snapshotJson, updateDebugState]);

    const downloadJson = React.useCallback(() => {
        if (!snapshotJson) return;

        const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `hapa-debug-packet-${safeTimestamp}.json`;

        const blob = new Blob([snapshotJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus(`Downloaded ${fileName}`);
        updateDebugState({ lastAction: 'download_json', status: `Downloaded ${fileName}` });
    }, [snapshotJson, updateDebugState]);

    const rebuildProjection = React.useCallback(async () => {
        const api = window.electronAPI;
        if (!api?.persistenceRebuildCardLibraryIndex) {
            setError('persistenceRebuildCardLibraryIndex not available');
            updateDebugState({ lastAction: 'rebuild_projection', error: 'persistenceRebuildCardLibraryIndex not available' });
            return;
        }

        const ok = window.confirm('Rebuild Card Library projection index? This may take a moment.');
        if (!ok) return;

        setRebuilding(true);
        setError(null);
        setStatus('Rebuilding projection...');
        updateDebugState({ lastAction: 'rebuild_projection', rebuilding: true, error: null, status: 'Rebuilding projection...' });

        try {
            const result = await api.persistenceRebuildCardLibraryIndex();
            if (result?.ok) {
                setStatus(`Rebuild complete: ${result.indexed}/${result.totalBlocks}`);
                updateDebugState({ status: `Rebuild complete: ${result.indexed}/${result.totalBlocks}`, rebuildResult: result });
            } else {
                setStatus(`Rebuild finished (see logs).`);
                updateDebugState({ status: 'Rebuild finished (see logs).', rebuildResult: result });
            }
            await loadSnapshot();
        } catch (e: any) {
            setError(e?.message || String(e));
            updateDebugState({ error: e?.message || String(e) });
        } finally {
            setRebuilding(false);
            updateDebugState({ rebuilding: false });
        }
    }, [loadSnapshot, updateDebugState]);

    const system = snapshot?.system;
    const sqlite = snapshot?.sqlite;
    const diagCardLibrary = snapshot?.diagnostics && typeof snapshot.diagnostics === 'object' ? snapshot.diagnostics.cardLibrary : null;
    const diagSqlite = diagCardLibrary && typeof diagCardLibrary === 'object' ? diagCardLibrary.sqlite : null;
    const diagPaging = diagCardLibrary && typeof diagCardLibrary === 'object' ? diagCardLibrary.paging : null;

    return (
        <PageContainer title="Operator Reality Panel" icon="security">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    <rux-button onClick={loadSnapshot} disabled={loading || rebuilding}>
                        Refresh
                    </rux-button>
                    <rux-button onClick={copyJson} disabled={!snapshotJson || loading || rebuilding}>
                        Copy JSON
                    </rux-button>
                    <rux-button onClick={downloadJson} disabled={!snapshotJson || loading || rebuilding}>
                        Download JSON
                    </rux-button>
                    <rux-button onClick={rebuildProjection} disabled={loading || rebuilding}>
                        Rebuild Card Library Index
                    </rux-button>
                    {(loading || rebuilding) && <rux-progress type="indeterminate" className="w-10" />}
                    {status && <span className="text-xs text-emerald-400 font-mono">{status}</span>}
                    {error && <span className="text-xs text-red-400 font-mono">{error}</span>}
                </div>

                <rux-card>
                    <div className="p-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-300">Snapshot</div>
                            <div className="text-xs font-mono text-gray-500">{safeString(snapshot?.time)}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-2">
                                <div className="text-xs text-gray-500 uppercase tracking-widest">Storage</div>
                                <div className="text-xs font-mono text-gray-300 break-all">{safeString(system?.storageDir)}</div>
                                <div className="text-xs font-mono text-gray-400">Used: {formatBytes(system?.storageUsageBytes)}</div>
                                <div className="text-xs font-mono text-gray-400">Free: {formatBytes(system?.storageFreeBytes)}</div>
                                <div className="text-xs font-mono text-gray-400">Total: {formatBytes(system?.storageTotalBytes)}</div>
                            </div>

                            <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-2">
                                <div className="text-xs text-gray-500 uppercase tracking-widest">Network</div>
                                <div className="text-xs font-mono text-gray-400">Peers: {safeString(system?.p2pPeers)}</div>
                                <div className="text-xs font-mono text-gray-300 break-all">{safeString(system?.p2pPublicKey)}</div>
                            </div>
                        </div>
                    </div>
                </rux-card>

                <rux-card>
                    <div className="p-6 space-y-4">
                        <div className="text-sm text-gray-300">Truth Sources</div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-2">
                                <div className="text-xs text-gray-500 uppercase tracking-widest">Hypercore (log length)</div>
                                <div className="text-xs font-mono text-gray-400">card-library: {safeString(snapshot?.hypercore?.cardLibraryLogLength)}</div>
                                <div className="text-xs font-mono text-gray-400">wiki: {safeString(snapshot?.hypercore?.wikiLogLength)}</div>
                            </div>

                            <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-2">
                                <div className="text-xs text-gray-500 uppercase tracking-widest">SQLite (projection)</div>
                                <div className="text-xs font-mono text-gray-400">cards (not deleted): {safeString(sqlite?.cardCount)}</div>
                                <div className="text-xs font-mono text-gray-400">dbSize: {formatBytes(sqlite?.dbSizeBytes)}</div>
                                <div className="text-xs font-mono text-gray-400">projectionVersion: {safeString(sqlite?.projectionVersion)}</div>
                                <div className="text-xs font-mono text-gray-400 break-all">lastUpdated: {safeString(sqlite?.lastUpdated)}</div>
                                <div className="pt-2 text-xs text-gray-500 uppercase tracking-widest">Index checkpoint</div>
                                <div className="text-xs font-mono text-gray-400">key: {safeString(diagSqlite?.checkpointKey)}</div>
                                <div className="text-xs font-mono text-gray-400">checkpoint: {safeString(diagSqlite?.checkpoint)}</div>
                                <div className="text-xs font-mono text-gray-400">caughtUp: {safeString(diagSqlite?.caughtUp)}</div>
                                <div className="pt-2 text-xs text-gray-500 uppercase tracking-widest">Paging mode</div>
                                <div className="text-xs font-mono text-gray-400">mode: {safeString(diagPaging?.mode)}</div>
                                <div className="text-xs font-mono text-gray-400 break-all">reason: {safeString(diagPaging?.reason)}</div>
                            </div>
                        </div>
                    </div>
                </rux-card>

                <rux-card>
                    <div className="p-6 space-y-3">
                        <div className="text-sm text-gray-300">Paging Snapshot</div>
                        {snapshot?.paging ? (
                            <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-2">
                                <div className="text-xs font-mono text-gray-400">itemsReturned: {snapshot.paging.itemsReturned}</div>
                                <div className="text-xs font-mono text-gray-400">nextCursor: {snapshot.paging.nextCursor}</div>
                                <div className="text-xs font-mono text-gray-400">hasMore: {String(snapshot.paging.hasMore)}</div>
                                <div className="text-xs font-mono text-gray-400">totalLength: {snapshot.paging.totalLength}</div>
                            </div>
                        ) : (
                            <div className="text-xs font-mono text-gray-500">nexusIndexPage not available</div>
                        )}
                    </div>
                </rux-card>

                <rux-card>
                    <div className="p-6 space-y-3">
                        <div className="text-sm text-gray-300">UI Debug (if present)</div>
                        {snapshot?.ui?.cardLibrary ? (
                            <pre className="bg-black/30 border border-gray-800 rounded p-4 text-xs font-mono text-gray-300 overflow-auto max-h-64">
                                {JSON.stringify(snapshot.ui.cardLibrary, null, 2)}
                            </pre>
                        ) : (
                            <div className="text-xs font-mono text-gray-500">No `window.__HAPA_DEBUG_STATE__.cardLibrary` found</div>
                        )}
                    </div>
                </rux-card>

                <rux-card>
                    <div className="p-6 space-y-3">
                        <div className="text-sm text-gray-300">Raw Snapshot JSON</div>
                        <pre className="bg-black/30 border border-gray-800 rounded p-4 text-xs font-mono text-gray-300 overflow-auto max-h-[520px]">
                            {snapshotJson || 'No snapshot'}
                        </pre>
                    </div>
                </rux-card>
            </div>
        </PageContainer>
    );
};

export default OperatorRealityPanel;
