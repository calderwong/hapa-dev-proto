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

    const prefetchedCardIdsRef = React.useRef<Set<string>>(new Set());

    const loadIndex = React.useCallback(async () => {
        if (typeof window === 'undefined' || !window.electronAPI?.p2pRead) {
            setError('Nexus requires the Electron P2P backend.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const items = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
            const byId = new Map<string, any>();

            for (const raw of items || []) {
                try {
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!parsed || parsed.type !== 'card-index') continue;
                    const id = parsed.cardId || parsed.coreName;
                    if (!id) continue;
                    byId.set(String(id), parsed);
                } catch {
                    // ignore malformed entries
                }
            }

            const entries: IndexEntry[] = Array.from(byId.values()).map((e: any) => ({
                cardId: String(e.cardId || e.coreName),
                coreName: e.coreName ? String(e.coreName) : String(e.cardId || e.coreName),
                name: e.name,
                mediaKind: e.mediaKind,
                thumbnail: e.thumbnail,
                mediaLocalPath: e.mediaLocalPath,
                parentCardId: e.parentCardId,
                createdAt: e.createdAt,
            }));

            entries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            setIndexEntries(entries);
        } catch (e: any) {
            setError(e?.message || 'Failed to load card index.');
        } finally {
            setLoading(false);
        }
    }, []);

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
        loadIndex();
    }, [loadIndex]);

    React.useEffect(() => {
        let cancelled = false;
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
            for (const id of toPrefetch) {
                if (cancelled) return;
                await ensureCardRecord(id);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [cardRecords, ensureCardRecord, indexEntries]);

    React.useEffect(() => {
        ensureCardRecord(focusedCardId);
    }, [ensureCardRecord, focusedCardId]);

    const handleCardSelect = React.useCallback((cardId: string) => {
        const next = new URLSearchParams(location.search || '');
        next.set('cardId', String(cardId));
        if (!next.get('from')) next.set('from', from);
        setSearchParams(next);
        ensureCardRecord(cardId);
    }, [ensureCardRecord, from, location.search, setSearchParams]);

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
            />
        </Suspense>
    );
};

export default Nexus;
