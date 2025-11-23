import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface CardIndexEntry {
    cardId: string;
    createdAt: string;
    threadId?: string;
    messageId?: string;
    provider?: string;
    model?: string;
    coreName?: string;
    coreKey?: string;
    coreDiscoveryKey?: string;
    thumbnail?: string;
    raw: any;
}

const CARD_LIBRARY_CORE_NAME = 'card-library';

const CardLibrary: React.FC = () => {
    const location = useLocation();
    const [cards, setCards] = useState<CardIndexEntry[]>([]);
    const [selected, setSelected] = useState<CardIndexEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCards = async (preferredCardId?: string | null) => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.p2pRead) {
            setError('Card Library requires the Electron P2P backend.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            let items: string[] = [];
            try {
                items = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
            } catch (inner: any) {
                const msg = inner?.message || '';
                if (msg.includes('not found')) {
                    setCards([]);
                    setSelected(null);
                    setLoading(false);
                    return;
                }
                throw inner;
            }

            const parsed: CardIndexEntry[] = [];
            for (const raw of items) {
                if (!raw || typeof raw !== 'string') continue;
                try {
                    const data = JSON.parse(raw);
                    if (!data || data.type !== 'card-index') continue;
                    const entry: CardIndexEntry = {
                        cardId: String(data.cardId || data.id || ''),
                        createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
                        threadId: typeof data.threadId === 'string' ? data.threadId : undefined,
                        messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
                        provider: typeof data.provider === 'string' ? data.provider : undefined,
                        model: typeof data.model === 'string' ? data.model : undefined,
                        coreName: typeof data.coreName === 'string' ? data.coreName : undefined,
                        coreKey: typeof data.coreKey === 'string' ? data.coreKey : undefined,
                        coreDiscoveryKey:
                            typeof data.coreDiscoveryKey === 'string' ? data.coreDiscoveryKey : undefined,
                        thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
                        raw: data,
                    };
                    parsed.push(entry);
                } catch {
                    // ignore parse errors for individual entries
                }
            }

            parsed.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setCards(parsed);

            const targetId = preferredCardId || (selected && selected.cardId) || null;
            if (targetId) {
                const match = parsed.find((c) => c.cardId === targetId);
                if (match) {
                    setSelected(match);
                    return;
                }
            }

            if (parsed.length > 0) {
                setSelected(parsed[0]);
            } else {
                setSelected(null);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load Card Library');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search || '');
        const preferredCardId = params.get('cardId');
        loadCards(preferredCardId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    const renderThumbnail = (card: CardIndexEntry) => {
        if (card.thumbnail && card.thumbnail.startsWith('data:image/')) {
            return (
                <img
                    src={card.thumbnail}
                    alt={card.cardId}
                    className="w-full h-32 object-cover rounded-lg border border-gray-700 bg-black/40"
                />
            );
        }
        return (
            <div className="w-full h-32 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-xs text-gray-500">
                No preview
            </div>
        );
    };

    return (
        <div className="p-8 max-w-5xl mx-auto w-full text-white">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold">Card Library</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Browse all image Cards created from chat and AI outputs.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => loadCards(selected?.cardId || null)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border border-gray-600 text-gray-100"
                    >
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

            {cards.length === 0 && !loading && !error && (
                <p className="text-sm text-gray-400">
                    No Cards have been created yet. Use "Add to Card Stock" on any chat image to create one.
                </p>
            )}

            {cards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {cards.map((card) => {
                        const isSelected = selected && selected.cardId === card.cardId;
                        return (
                            <button
                                key={card.cardId + card.createdAt}
                                type="button"
                                onClick={() => setSelected(card)}
                                className={`text-left rounded-xl border p-3 bg-gray-850/40 hover:bg-gray-800 transition-colors flex flex-col gap-2 ${
                                    isSelected ? 'border-purple-500' : 'border-gray-700'
                                }`}
                            >
                                {renderThumbnail(card)}
                                <div className="mt-1">
                                    <div className="text-xs text-gray-300 font-semibold truncate">
                                        {card.provider ? `${card.provider}${card.model ? ` · ${card.model}` : ''}` : 'Unknown source'}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                        {card.createdAt || 'Unknown time'}
                                    </div>
                                    {card.threadId && (
                                        <div className="text-[10px] text-gray-600 truncate mt-0.5">
                                            Thread: {card.threadId}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selected && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mt-2 flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/3">
                        <h3 className="text-lg font-semibold mb-2 text-purple-300">Preview</h3>
                        {renderThumbnail(selected)}
                    </div>
                    <div className="md:flex-1 space-y-2 text-sm">
                        <h3 className="text-lg font-semibold mb-1 text-blue-300">Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-200">
                            <div>
                                <span className="text-gray-500">Card ID: </span>
                                <span className="break-all">{selected.cardId}</span>
                            </div>
                            {selected.createdAt && (
                                <div>
                                    <span className="text-gray-500">Created: </span>
                                    <span>{selected.createdAt}</span>
                                </div>
                            )}
                            {selected.provider && (
                                <div>
                                    <span className="text-gray-500">Provider: </span>
                                    <span>{selected.provider}</span>
                                </div>
                            )}
                            {selected.model && (
                                <div>
                                    <span className="text-gray-500">Model: </span>
                                    <span>{selected.model}</span>
                                </div>
                            )}
                            {selected.threadId && (
                                <div>
                                    <span className="text-gray-500">Thread: </span>
                                    <span className="break-all">{selected.threadId}</span>
                                </div>
                            )}
                            {selected.messageId && (
                                <div>
                                    <span className="text-gray-500">Message: </span>
                                    <span className="break-all">{selected.messageId}</span>
                                </div>
                            )}
                            {selected.coreName && (
                                <div>
                                    <span className="text-gray-500">Core name: </span>
                                    <span className="break-all">{selected.coreName}</span>
                                </div>
                            )}
                            {selected.coreKey && (
                                <div>
                                    <span className="text-gray-500">Core key: </span>
                                    <span className="break-all">{selected.coreKey}</span>
                                </div>
                            )}
                            {selected.coreDiscoveryKey && (
                                <div>
                                    <span className="text-gray-500">Discovery key: </span>
                                    <span className="break-all">{selected.coreDiscoveryKey}</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 text-xs text-gray-400">
                            <div className="font-semibold mb-1">Raw index entry</div>
                            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(selected.raw, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardLibrary;
