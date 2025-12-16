import React, { Suspense } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { CardData } from '../components/Card3DViewer';
import { useNavigationHistory } from '../contexts/NavigationHistoryContext';

const Card3DViewer = React.lazy(() => import('../components/Card3DViewer/Card3DViewer').then((m) => ({ default: m.Card3DViewer })));

type IndexEntry = {
    cardId: string;
    coreName?: string;
    name?: string;
    mediaKind?: string;
    thumbnail?: string;
    mediaLocalPath?: string;
    parentCardId?: string;
    createdAt?: string;
};

const CARD_LIBRARY_CORE_NAME = 'card-library';

const Nexus: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const navHistory = useNavigationHistory();

    const focusedCardId = searchParams.get('cardId') || undefined;
    const from = searchParams.get('from') || '/cards';

    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [indexEntries, setIndexEntries] = React.useState<IndexEntry[]>([]);
    const [cardRecords, setCardRecords] = React.useState<Record<string, any>>({});

    const [nexusSettings, setNexusSettings] = React.useState<{ globalRenderCap: number; globalPageSize: number } | null>(null);
    const [indexCursor, setIndexCursor] = React.useState<number | null>(null);
    const [indexHasMore, setIndexHasMore] = React.useState<boolean>(true);
    const [searchJobId, setSearchJobId] = React.useState<string | null>(null);
    const [searchLoading, setSearchLoading] = React.useState(false);
    const searchQueryRef = React.useRef<string>('');

    const prefetchedCardIdsRef = React.useRef<Set<string>>(new Set());

    const mergeIndexEntries = React.useCallback((incoming: IndexEntry[]) => {
        if (!incoming || incoming.length === 0) return;
        setIndexEntries((prev) => {
            const byId = new Map<string, IndexEntry>();
            for (const e of prev) {
                if (!e?.cardId) continue;
                byId.set(String(e.cardId), e);
            }
            for (const e of incoming) {
                if (!e?.cardId) continue;
                const id = String(e.cardId);
                if (!byId.has(id)) {
                    byId.set(id, e);
                }
            }
            const next = Array.from(byId.values());
            next.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            return next;
        });
    }, []);

    const loadSettings = React.useCallback(async () => {
        const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
        if (!api?.nexusGetSettings) {
            setNexusSettings({ globalRenderCap: 1000, globalPageSize: 120 });
            return;
        }
        try {
            const s = await api.nexusGetSettings();
            if (s && typeof s === 'object') {
                setNexusSettings({
                    globalRenderCap: typeof s.globalRenderCap === 'number' ? s.globalRenderCap : 1000,
                    globalPageSize: typeof s.globalPageSize === 'number' ? s.globalPageSize : 120,
                });
            }
        } catch {
            setNexusSettings({ globalRenderCap: 1000, globalPageSize: 120 });
        }
    }, []);

    const loadIndexPage = React.useCallback(async (opts?: { reset?: boolean }) => {
        const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
        if (!api?.nexusIndexPage) {
            setError('Nexus requires the Electron backend (Phase 2 Nexus APIs missing).');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const reset = opts?.reset === true;
            const cursor = reset ? undefined : indexCursor ?? undefined;
            const pageSize = nexusSettings?.globalPageSize || 120;
            const result = await api.nexusIndexPage({
                coreName: CARD_LIBRARY_CORE_NAME,
                cursor,
                limit: pageSize,
                direction: 'reverse',
            });

            const items = Array.isArray(result?.items) ? result.items : [];
            if (reset) {
                setIndexEntries([]);
                setCardRecords({});
                prefetchedCardIdsRef.current = new Set();
            }
            mergeIndexEntries(items);
            setIndexCursor(typeof result?.nextCursor === 'number' ? result.nextCursor : null);
            setIndexHasMore(!!result?.hasMore);
        } catch (e: any) {
            setError(e?.message || 'Failed to load card index.');
        } finally {
            setLoading(false);
        }
    }, [indexCursor, mergeIndexEntries, nexusSettings?.globalPageSize]);

    const ensureCardRecord = React.useCallback(async (cardId?: string) => {
        const id = cardId ? String(cardId) : '';
        if (!id) return;
        if (cardRecords[id]) return;
        if (!window.electronAPI?.p2pRead) return;

        const entry = indexEntries.find((e) => e.cardId === id);
        const coreName = entry?.coreName || id;

        try {
            const records = await window.electronAPI.p2pRead(coreName);
            if (!Array.isArray(records) || records.length === 0) return;

            let latest: any = null;
            for (let i = records.length - 1; i >= 0; i--) {
                const r = records[i];
                try {
                    const parsed = typeof r === 'string' ? JSON.parse(r) : r;
                    if (parsed && typeof parsed === 'object') {
                        latest = parsed;
                        break;
                    }
                } catch {
                    // ignore
                }
            }

            if (!latest) return;
            setCardRecords((prev) => ({ ...prev, [id]: latest }));
        } catch {
            // ignore
        }
    }, [cardRecords, indexEntries]);

    const ensureCardRecordsBatch = React.useCallback(async (ids: string[]) => {
        const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
        if (!api?.nexusCardLatestBatch) {
            for (const id of ids) {
                await ensureCardRecord(id);
            }
            return;
        }

        const entries = ids
            .map((id) => {
                const e = indexEntries.find((x) => x.cardId === id);
                return { cardId: id, coreName: e?.coreName || id };
            })
            .filter((e) => !!e.cardId);

        if (entries.length === 0) return;
        try {
            const res = await api.nexusCardLatestBatch({ entries });
            const byId = (res && typeof res === 'object' ? res.recordsById : null) as any;
            if (!byId || typeof byId !== 'object') return;
            setCardRecords((prev) => ({ ...prev, ...byId }));
        } catch {
            // ignore
        }
    }, [ensureCardRecord, indexEntries]);

    const cardsForViewer: CardData[] = React.useMemo(() => {
        return indexEntries.map((e) => ({
            cardId: e.cardId,
            name: e.name,
            mediaKind: e.mediaKind,
            thumbnail: e.thumbnail,
            mediaLocalPath: e.mediaLocalPath,
            parentCardId: e.parentCardId,
            cardRecord: cardRecords[e.cardId],
        }));
    }, [indexEntries, cardRecords]);

    React.useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    React.useEffect(() => {
        if (!nexusSettings) return;
        loadIndexPage({ reset: true });
    }, [loadIndexPage, nexusSettings]);

    React.useEffect(() => {
        if (!indexEntries.length) return;

        const candidates = indexEntries
            .slice(0, 120)
            .filter((e) => (e.mediaKind === 'image' || e.mediaKind === 'video'))
            .filter((e) => !e.thumbnail)
            .filter((e) => !cardRecords[e.cardId])
            .map((e) => e.cardId);

        const toPrefetch = candidates
            .filter((id) => !prefetchedCardIdsRef.current.has(id))
            .slice(0, 24);

        if (toPrefetch.length === 0) return;

        for (const id of toPrefetch) {
            prefetchedCardIdsRef.current.add(id);
        }

        (async () => {
            await ensureCardRecordsBatch(toPrefetch);
        })();

        return;
    }, [cardRecords, ensureCardRecordsBatch, indexEntries]);

    React.useEffect(() => {
        ensureCardRecord(focusedCardId);
    }, [ensureCardRecord, focusedCardId]);

    React.useEffect(() => {
        const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
        if (!api?.onNexusSearchUpdate) return;

        const unsub = api.onNexusSearchUpdate((evt: any) => {
            const jobId = String(evt?.jobId || '');
            if (!jobId || jobId !== searchJobId) return;

            if (evt?.status === 'done') {
                setSearchLoading(false);
                return;
            }
            if (evt?.status === 'update') {
                const batch = Array.isArray(evt?.results) ? evt.results : [];
                if (batch.length > 0) {
                    mergeIndexEntries(batch);
                }
            }
        });

        return () => {
            if (typeof unsub === 'function') unsub();
        };
    }, [mergeIndexEntries, searchJobId]);

    const startAsyncSearch = React.useCallback(async (query: string) => {
        const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
        if (!api?.nexusSearchStart) return;

        const q = String(query || '').trim();
        if (searchJobId && api?.nexusSearchCancel) {
            try {
                await api.nexusSearchCancel({ jobId: searchJobId });
            } catch {
                // ignore
            }
        }

        if (!q) {
            setSearchJobId(null);
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);
        try {
            const res = await api.nexusSearchStart({
                query: q,
                coreName: CARD_LIBRARY_CORE_NAME,
                limit: nexusSettings?.globalRenderCap || 1000,
            });
            setSearchJobId(String(res?.jobId || ''));
        } catch {
            setSearchLoading(false);
        }
    }, [nexusSettings?.globalRenderCap, searchJobId]);

    const handleCardSelect = React.useCallback((cardId: string) => {
        const next = new URLSearchParams(location.search || '');
        next.set('cardId', String(cardId));
        if (!next.get('from')) next.set('from', from);
        setSearchParams(next);
        ensureCardRecord(cardId);
    }, [ensureCardRecord, from, location.search, setSearchParams]);

    // When the user changes the search query inside the viewer, we want:
    // 1) Immediate filter on loaded cards (handled inside Card3DViewer)
    // 2) Background search that loads more matching entries over time.
    const handleViewerSearchChange = React.useCallback((q: string) => {
        searchQueryRef.current = q;
        startAsyncSearch(q);
    }, [startAsyncSearch]);

    const handleClose = React.useCallback(() => {
        if (navHistory.canGoBack) {
            navHistory.goBack();
            return;
        }
        const dest = from || '/cards';
        const q = new URLSearchParams();
        if (dest === '/cards' && focusedCardId) q.set('cardId', focusedCardId);
        const qs = q.toString();
        navigate(qs ? `${dest}?${qs}` : dest);
    }, [from, focusedCardId, navHistory, navigate]);

    if (error) {
        return (
            <div className="p-6 text-red-300 font-mono">
                <div className="text-lg font-bold">Nexus failed to load</div>
                <div className="mt-2 text-sm text-red-200/70">{error}</div>
            </div>
        );
    }

    if (loading && indexEntries.length === 0) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-cyan-400 text-4xl mb-4 animate-pulse">◈</div>
                    <div className="text-cyan-300 font-mono">Loading Nexus...</div>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-cyan-400 text-4xl mb-4 animate-pulse">◈</div>
                    <div className="text-cyan-300 font-mono">Loading Card Nexus...</div>
                </div>
            </div>
        }>
            <Card3DViewer
                cards={cardsForViewer}
                focusedCardId={focusedCardId}
                onCardSelect={handleCardSelect}
                onClose={handleClose}
                onSearchQueryChange={handleViewerSearchChange}
                isSearching={searchLoading}
                onRequestMoreGlobal={() => {
                    if (!indexHasMore) return;
                    loadIndexPage({ reset: false });
                }}
            />
        </Suspense>
    );
};

export default Nexus;
