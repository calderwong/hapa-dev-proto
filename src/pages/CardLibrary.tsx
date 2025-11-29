import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageContainer from '../components/PageContainer';

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
    mediaKind?: 'image' | 'video' | 'audio';
    mediaLocalPath?: string;
    mediaRemoteUrl?: string;
    mediaMimeType?: string;
    cardRecord?: any;
}

const CARD_LIBRARY_CORE_NAME = 'card-library';

interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
}

const toFileUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('file://')) return path;
    const normalized = path.replace(/\\/g, '/');
    return `file:///${normalized}`;
};

const CardLibrary: React.FC = () => {
    const location = useLocation();
    const [cards, setCards] = useState<CardIndexEntry[]>([]);
    const [selected, setSelected] = useState<CardIndexEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wormholeActionPending, setWormholeActionPending] = useState(false);
    const [overrideSummarizationModel, setOverrideSummarizationModel] = useState('');
    const [overrideKeyTermsModel, setOverrideKeyTermsModel] = useState('');
    const [overrideWikiModel, setOverrideWikiModel] = useState('');
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);

    const enrichWithCardRecords = async (entries: CardIndexEntry[]): Promise<CardIndexEntry[]> => {
        if (!window.electronAPI || !window.electronAPI.p2pRead) {
            return entries;
        }

        const enriched = await Promise.all(
            entries.map(async (entry) => {
                if (!entry.coreName) {
                    return entry;
                }

                try {
                    const records = await window.electronAPI.p2pRead(entry.coreName);
                    if (!Array.isArray(records) || records.length === 0) {
                        return entry;
                    }

                    let cardRecord: any | null = null;
                    for (let i = records.length - 1; i >= 0; i -= 1) {
                        const raw = records[i];
                        if (!raw || typeof raw !== 'string') continue;
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.type === 'card') {
                                cardRecord = parsed;
                                break;
                            }
                        } catch {
                            // ignore parse errors for individual records
                        }
                    }

                    if (!cardRecord) {
                        return entry;
                    }

                    let mediaKind: 'image' | 'video' | 'audio' | undefined;
                    let mediaLocalPath: string | undefined;
                    let mediaRemoteUrl: string | undefined;
                    let mediaMimeType: string | undefined;

                    if (cardRecord.image) {
                        mediaKind = 'image';
                        mediaLocalPath = cardRecord.image.localPath;
                        mediaRemoteUrl = cardRecord.image.remoteUrl || cardRecord.image.dataUrl;
                        mediaMimeType = cardRecord.image.mimeType;
                    } else if (cardRecord.video) {
                        mediaKind = 'video';
                        mediaLocalPath = cardRecord.video.localPath;
                        mediaRemoteUrl = cardRecord.video.remoteUrl;
                        mediaMimeType = cardRecord.video.mimeType;
                    } else if (cardRecord.audio) {
                        mediaKind = 'audio';
                        mediaLocalPath = cardRecord.audio.localPath;
                        mediaRemoteUrl = cardRecord.audio.remoteUrl;
                        mediaMimeType = cardRecord.audio.mimeType;
                    }

                    return {
                        ...entry,
                        mediaKind,
                        mediaLocalPath,
                        mediaRemoteUrl,
                        mediaMimeType,
                        cardRecord,
                    };
                } catch {
                    return entry;
                }
            }),
        );

        return enriched;
    };

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
            const enriched = await enrichWithCardRecords(parsed);
            setCards(enriched);

            const targetId = preferredCardId || (selected && selected.cardId) || null;
            if (targetId) {
                const match = enriched.find((c) => c.cardId === targetId);
                if (match) {
                    setSelected(match);
                    return;
                }
            }

            if (enriched.length > 0) {
                setSelected(enriched[0]);
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

    useEffect(() => {
        const loadGeminiModels = async () => {
            if (!window.electronAPI || !window.electronAPI.listGeminiModels) return;
            try {
                const models = await window.electronAPI.listGeminiModels();
                if (Array.isArray(models) && models.length > 0) {
                    setGeminiModels(models as ModelInfo[]);
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('Failed to load Gemini models for Card Library:', e);
            }
        };

        loadGeminiModels();
    }, []);

    const selectedWormhole: any = selected && selected.cardRecord && selected.cardRecord.wormhole
        ? selected.cardRecord.wormhole
        : null;
    const selectedWormholeIngest: any = selectedWormhole && selectedWormhole.ingest;
    const selectedWormholeProcessing: any = selectedWormhole && selectedWormhole.processing;

    const runWormholeStep = async (step: 'summarization' | 'keyTerms' | 'wikiUpdate') => {
        if (!selected || !selected.cardRecord) {
            setError('No card is currently selected.');
            return;
        }

        if (typeof window === 'undefined' || !window.electronAPI) {
            setError('Wormhole processing requires the Electron backend.');
            return;
        }

        const cardId = selected.cardId;
        const mediaType = (selected.cardRecord.mediaType || '').toString();

        let overrideModel: string | undefined;
        if (step === 'summarization') {
            overrideModel = overrideSummarizationModel.trim() || undefined;
        } else if (step === 'keyTerms') {
            overrideModel = overrideKeyTermsModel.trim() || undefined;
        } else if (step === 'wikiUpdate') {
            overrideModel = overrideWikiModel.trim() || undefined;
        }

        if (step === 'summarization') {
            if (mediaType !== 'audio' && mediaType !== 'text' && mediaType !== 'markdown') {
                setError('Summarization is currently implemented for audio (with transcript) and text/markdown cards.');
                return;
            }
            if (!window.electronAPI.wormholeRunSummarization) {
                setError('Wormhole summarization is only available in the Electron app.');
                return;
            }
        } else if (step === 'keyTerms') {
            if (!window.electronAPI.wormholeRunKeyTerms) {
                setError('Wormhole key-term extraction is only available in the Electron app.');
                return;
            }
        } else if (step === 'wikiUpdate') {
            if (!window.electronAPI.wormholeRunWikiUpdate) {
                setError('Wormhole wiki update is only available in the Electron app.');
                return;
            }
        }

        try {
            setError(null);
            setWormholeActionPending(true);

            if (step === 'summarization') {
                await window.electronAPI.wormholeRunSummarization!({ cardId, overrideModel } as any);
            } else if (step === 'keyTerms') {
                await window.electronAPI.wormholeRunKeyTerms!({ cardId, overrideModel } as any);
            } else if (step === 'wikiUpdate') {
                await window.electronAPI.wormholeRunWikiUpdate!({ cardId, overrideModel } as any);
            }

            await loadCards(cardId);
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('Wormhole processing from Card Library failed:', e);
            setError(e?.message || 'Wormhole processing failed.');
        } finally {
            setWormholeActionPending(false);
        }
    };

    const renderWormholeStepBadge = (label: string, step: any) => {
        if (!step) return null;
        const status = typeof step.status === 'string' ? step.status : 'unknown';

        let color = 'text-gray-300 border-gray-600';
        if (status === 'complete') {
            color = 'text-emerald-300 border-emerald-500/60';
        } else if (status === 'failed') {
            color = 'text-red-300 border-red-500/60';
        } else if (status === 'in_progress') {
            color = 'text-yellow-300 border-yellow-500/60';
        }

        const provider = step.provider ? String(step.provider) : '';
        const model = step.model ? String(step.model) : '';

        const parts: string[] = [label, status];
        if (provider) parts.push(provider);
        if (model) parts.push(model);

        return (
            <span
                key={label}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${color}`}
            >
                {parts.join(' · ')}
            </span>
        );
    };

    const renderThumbnail = (card: CardIndexEntry) => {
        if (card.mediaKind === 'image') {
            const src = card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.thumbnail || card.mediaRemoteUrl;
            if (src) {
                return (
                    <img
                        src={src}
                        alt={card.cardId}
                        className="w-full h-32 object-cover rounded-lg border border-gray-700 bg-black/40"
                    />
                );
            }
        }

        if (card.mediaKind === 'video') {
            const src = card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.mediaRemoteUrl;
            if (src) {
                return (
                    <video
                        src={src}
                        className="w-full h-32 rounded-lg border border-gray-700 bg-black"
                        controls={false}
                    />
                );
            }
        }

        if (card.mediaKind === 'audio') {
            return (
                <div className="w-full h-32 flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-xs text-gray-300">
                    <span className="mb-1">Audio Card</span>
                    <span className="text-[10px] text-gray-500 truncate max-w-full">
                        {card.mediaMimeType || 'audio'}
                    </span>
                </div>
            );
        }

        if (card.thumbnail) {
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
        <PageContainer>
            <div className="w-full text-white">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold">Card Library</h2>
                        <p className="text-sm text-gray-300 mt-1">
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
                    <div
                        className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4"
                        onClick={() => setSelected(null)}
                    >
                        <div
                            className="relative w-full max-w-5xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-xl flex flex-col md:flex-row gap-6 p-6 overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                className="absolute top-3 right-3 px-2 py-1 rounded-md text-[11px] bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200"
                            >
                                Close
                            </button>
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
                                {selectedWormhole && (
                                    <div className="mt-4 text-xs text-gray-200">
                                        <div className="font-semibold mb-1 text-emerald-300">Wormhole ingest</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                                        {selectedWormholeIngest && selectedWormholeIngest.mediaType && (
                                            <div>
                                                <span className="text-gray-500">Media type: </span>
                                                <span>{String(selectedWormholeIngest.mediaType)}</span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest && selectedWormholeIngest.ownerDid && (
                                            <div>
                                                <span className="text-gray-500">Owner DID: </span>
                                                <span className="break-all">{String(selectedWormholeIngest.ownerDid)}</span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest && selectedWormholeIngest.sourceLabel && (
                                            <div>
                                                <span className="text-gray-500">Source label: </span>
                                                <span>{String(selectedWormholeIngest.sourceLabel)}</span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest && selectedWormholeIngest.originalFileName && (
                                            <div>
                                                <span className="text-gray-500">Original file name: </span>
                                                <span className="break-all">
                                                    {String(selectedWormholeIngest.originalFileName)}
                                                </span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest && selectedWormholeIngest.originalPath && (
                                            <div>
                                                <span className="text-gray-500">Stored path: </span>
                                                <span className="break-all">{String(selectedWormholeIngest.originalPath)}</span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest && selectedWormholeIngest.originalUrl && (
                                            <div>
                                                <span className="text-gray-500">Source URL: </span>
                                                <span className="break-all">{String(selectedWormholeIngest.originalUrl)}</span>
                                            </div>
                                        )}
                                        {selectedWormholeIngest &&
                                            Array.isArray(selectedWormholeIngest.tags) &&
                                            selectedWormholeIngest.tags.length > 0 && (
                                                <div className="md:col-span-2">
                                                    <span className="text-gray-500">Tags: </span>
                                                    <span>{(selectedWormholeIngest.tags as any[]).join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                        {selectedWormholeProcessing && (
                                            <div className="mt-3">
                                                <div className="font-semibold mb-1 text-emerald-300">Wormhole processing</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {renderWormholeStepBadge('Ingest', selectedWormholeProcessing.ingest)}
                                                    {renderWormholeStepBadge(
                                                        'Transcription',
                                                        selectedWormholeProcessing.transcription,
                                                    )}
                                                    {renderWormholeStepBadge(
                                                        'Summarization',
                                                        selectedWormholeProcessing.summarization,
                                                    )}
                                                    {renderWormholeStepBadge(
                                                        'Key terms',
                                                        selectedWormholeProcessing.keyTerms,
                                                    )}
                                                    {renderWormholeStepBadge(
                                                        'Wiki update',
                                                        selectedWormholeProcessing.wikiUpdate,
                                                    )}
                                                </div>
                                                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                                                    <div>
                                                        <div className="text-gray-500 mb-0.5">Summarization model override</div>
                                                        {geminiModels.length > 0 ? (
                                                            <select
                                                                value={overrideSummarizationModel}
                                                                onChange={(e) => setOverrideSummarizationModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                            >
                                                                <option value="">Use defaults</option>
                                                                {geminiModels.map((model) => (
                                                                    <option key={model.name} value={model.name}>
                                                                        {model.displayName || model.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={overrideSummarizationModel}
                                                                onChange={(e) => setOverrideSummarizationModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                                placeholder="e.g. gemini-1.5-flash"
                                                            />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500 mb-0.5">Key terms model override</div>
                                                        {geminiModels.length > 0 ? (
                                                            <select
                                                                value={overrideKeyTermsModel}
                                                                onChange={(e) => setOverrideKeyTermsModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                            >
                                                                <option value="">Use defaults</option>
                                                                {geminiModels.map((model) => (
                                                                    <option key={model.name} value={model.name}>
                                                                        {model.displayName || model.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={overrideKeyTermsModel}
                                                                onChange={(e) => setOverrideKeyTermsModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                                placeholder="e.g. gemini-1.5-flash"
                                                            />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500 mb-0.5">Wiki update model override</div>
                                                        {geminiModels.length > 0 ? (
                                                            <select
                                                                value={overrideWikiModel}
                                                                onChange={(e) => setOverrideWikiModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                            >
                                                                <option value="">Use defaults</option>
                                                                {geminiModels.map((model) => (
                                                                    <option key={model.name} value={model.name}>
                                                                        {model.displayName || model.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={overrideWikiModel}
                                                                onChange={(e) => setOverrideWikiModel(e.target.value)}
                                                                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[11px] text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
                                                                placeholder="optional"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => runWormholeStep('summarization')}
                                                        disabled={wormholeActionPending}
                                                        className="px-3 py-1.5 rounded-md text-[11px] bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border border-gray-600 text-gray-100"
                                                    >
                                                        Run summarization
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => runWormholeStep('keyTerms')}
                                                        disabled={wormholeActionPending}
                                                        className="px-3 py-1.5 rounded-md text-[11px] bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border border-gray-600 text-gray-100"
                                                    >
                                                        Run key terms
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => runWormholeStep('wikiUpdate')}
                                                        disabled={wormholeActionPending}
                                                        className="px-3 py-1.5 rounded-md text-[11px] bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 border border-gray-600 text-gray-100"
                                                    >
                                                        Run wiki update
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {Array.isArray(selectedWormhole.wikiEntries) &&
                                            selectedWormhole.wikiEntries.length > 0 && (
                                                <div className="mt-3">
                                                    <div className="font-semibold mb-1 text-emerald-300">
                                                        Wormhole wiki entries
                                                    </div>
                                                    <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-200">
                                                        {selectedWormhole.wikiEntries.map((entry: any, idx: number) => (
                                                            <li key={String(entry.wikiId || idx)}>
                                                                <span className="text-gray-500">Term: </span>
                                                                <span>{String(entry.term || '')}</span>
                                                                {entry.wikiId && (
                                                                    <>
                                                                        <span className="text-gray-500"> · Wiki ID: </span>
                                                                        <span className="break-all">
                                                                            {String(entry.wikiId)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                    </div>
                                )}
                                {selected.cardRecord && (
                                    <div className="mt-4 text-xs text-gray-400">
                                        <div className="font-semibold mb-1">Raw card record</div>
                                        <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                                            {JSON.stringify(selected.cardRecord, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default CardLibrary;
