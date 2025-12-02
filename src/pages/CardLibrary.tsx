// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import CardWorkspace from '../components/CardWorkspace';
import { 
    calculateCardQuality, 
    getCardType, 
    getTierBadge,
    getAllTiers,
    getAllCardTypes,
    type CardQualityTier,
    type CardType 
} from '../utils/cardQuality';

interface CardIndexEntry {
    cardId: string;
    name?: string; // Added Name field
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
    mediaMimeType?: string;
    subType?: string;
    derivedGif?: { localPath: string; cardId: string };
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
    const [activeWormholeStep, setActiveWormholeStep] = useState<'summarization' | 'keyTerms' | 'wikiUpdate' | null>(
        null,
    );
    const [overrideSummarizationModel, setOverrideSummarizationModel] = useState('');
    const [overrideKeyTermsModel, setOverrideKeyTermsModel] = useState('');
    const [overrideWikiModel, setOverrideWikiModel] = useState('');
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
    const [search, setSearch] = useState('');
    const [editingName, setEditingName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);

    // Drag and Drop State
    const [draggedCard, setDraggedCard] = useState<CardIndexEntry | null>(null);
    const [isOverDropZone, setIsOverDropZone] = useState(false);
    const [activeWorkspaceCard, setActiveWorkspaceCard] = useState<CardIndexEntry | null>(null);

    // Filter & Sort State
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'quality-high' | 'quality-low' | 'name-az' | 'name-za'>('newest');
    const [filterTiers, setFilterTiers] = useState<CardQualityTier[]>([]);
    const [filterTypes, setFilterTypes] = useState<CardType[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const emitWormholeRunEvent = (
        type: 'start' | 'end',
        step: 'summarization' | 'keyTerms' | 'wikiUpdate',
    ) => {
        if (typeof window === 'undefined') return;
        const eventName = type === 'start' ? 'wormhole-run-start' : 'wormhole-run-end';
        window.dispatchEvent(new CustomEvent(eventName, { detail: { step } }));
    };

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
                        subType: cardRecord.subType,
                        derivedGif: cardRecord.derivedGif,
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

            const parsedMap = new Map<string, CardIndexEntry>();

            // Process in order, later entries overwrite earlier ones (allowing for updates)
            for (const raw of items) {
                if (!raw || typeof raw !== 'string') continue;
                try {
                    const data = JSON.parse(raw);
                    if (!data || data.type !== 'card-index') continue;

                    const cardId = String(data.cardId || data.id || '');
                    if (!cardId) continue;

                    const entry: CardIndexEntry = {
                        cardId,
                        name: typeof data.name === 'string' ? data.name : undefined,
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

                    // Merge with existing to preserve fields if partial update (though we usually write full entries)
                    const existing = parsedMap.get(cardId);
                    if (existing) {
                        parsedMap.set(cardId, { ...existing, ...entry });
                    } else {
                        parsedMap.set(cardId, entry);
                    }
                } catch {
                    // ignore parse errors for individual entries
                }
            }

            const parsed = Array.from(parsedMap.values());
            parsed.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

            const enriched = await enrichWithCardRecords(parsed);
            setCards(enriched);

            const targetId = preferredCardId || (selected && selected.cardId) || null;
            if (targetId) {
                const match = enriched.find((c) => c.cardId === targetId);
                if (match) {
                    setSelected(match);
                    setEditingName(match.name || '');
                    return;
                }
            }

            // Don't auto-select first item to keep the grid clean initially
            if (!selected && preferredCardId) {
                if (enriched.length > 0) {
                    setSelected(enriched[0]);
                    setEditingName(enriched[0].name || '');
                }
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

    // Helper to find text content from various possible fields
    const findTextContent = (record: any, raw: any) => {
        if (!record && !raw) return '';

        // Check cardRecord first
        if (record) {
            if (record.text) return record.text;
            if (record.content) return record.content;
            if (record.data?.text) return record.data.text;
            if (record.data?.content) return record.data.content;
            if (record.markdown) return record.markdown;
        }

        // Fallback to raw index entry
        if (raw) {
            if (raw.text) return raw.text;
            if (raw.content) return raw.content;
            if (raw.description) return raw.description;
        }

        return '';
    };

    useEffect(() => {
        const fetchContent = async () => {
            if (!activeWorkspaceCard) return;

            // Check if we already have text content
            const currentText = findTextContent(activeWorkspaceCard.cardRecord, activeWorkspaceCard.raw);

            // If text is empty, try to fetch it from backend
            if (!currentText && window.electronAPI?.wormholeGetCardText) {
                try {
                    const text = await window.electronAPI.wormholeGetCardText({ cardId: activeWorkspaceCard.cardId });
                    if (text) {
                        setActiveWorkspaceCard(prev => {
                            if (!prev || prev.cardId !== activeWorkspaceCard.cardId) return prev;
                            // Update cardRecord with the fetched text
                            return {
                                ...prev,
                                cardRecord: {
                                    ...(prev.cardRecord || {}),
                                    text: text
                                }
                            };
                        });
                    }
                } catch (e) {
                    console.error("Failed to fetch card text:", e);
                }
            }
        };

        fetchContent();
    }, [activeWorkspaceCard]);

    const handleCardClick = (card: CardIndexEntry) => {
        setSelected(card);
        setEditingName(card.name || '');
        setIsEditingName(false);
    };

    const handleSaveName = async () => {
        if (!selected || !window.electronAPI || !window.electronAPI.p2pAppend) return;

        try {
            const updatedEntry = {
                ...selected.raw,
                name: editingName,
                updatedAt: new Date().toISOString()
            };

            await window.electronAPI.p2pAppend({
                name: CARD_LIBRARY_CORE_NAME,
                data: JSON.stringify(updatedEntry)
            });

            // Optimistic update
            const updatedCard = { ...selected, name: editingName };
            setSelected(updatedCard);
            setCards(prev => prev.map(c => c.cardId === selected.cardId ? updatedCard : c));
            setIsEditingName(false);
        } catch (e) {
            console.error('Failed to save card name:', e);
            setError('Failed to save card name.');
        }
    };

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
            setActiveWormholeStep(step);
            emitWormholeRunEvent('start', step);

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
            setActiveWormholeStep(null);
            emitWormholeRunEvent('end', step);
        }
    };

    const renderWormholeStepBadge = (label: string, step: any) => {
        if (!step) return null;
        const status = typeof step.status === 'string' ? step.status : 'unknown';

        let ruxStatus = 'standby';
        if (status === 'complete') ruxStatus = 'normal';
        else if (status === 'failed') ruxStatus = 'critical';
        else if (status === 'in_progress') ruxStatus = 'caution';

        const provider = step.provider ? String(step.provider) : '';
        const model = step.model ? String(step.model) : '';

        const parts: string[] = [label, status];
        if (provider) parts.push(provider);
        if (model) parts.push(model);

        return (
            <div
                key={label}
                className="inline-flex items-center gap-1.5 rounded border border-gray-700 px-2 py-0.5 text-[10px] text-gray-300 bg-gray-900"
            >
                <rux-status status={ruxStatus}></rux-status>
                <span>{parts.join(' · ')}</span>
            </div>
        );
    };

    const renderThumbnail = (card: CardIndexEntry, large = false) => {
        const className = large
            ? "w-full h-64 object-cover rounded-lg border border-gray-700 bg-black/40 shadow-lg"
            : "w-full h-40 object-cover rounded-t-lg bg-black/40 group-hover:opacity-90 transition-opacity pointer-events-none"; // pointer-events-none to prevent image dragging interfering with card dragging

        if (card.mediaKind === 'image') {
            const src = card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.thumbnail || card.mediaRemoteUrl;
            if (src) {
                return <img src={src} alt={card.cardId} className={className} />;
            }
        }

        if (card.mediaKind === 'video') {
            const src = card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.mediaRemoteUrl;
            if (src) {
                return <video src={src} className={className} controls={large} />;
            }
        }

        if (card.mediaKind === 'audio') {
            return (
                <div className={`${className} flex flex-col items-center justify-center bg-gray-900 text-gray-300`}>
                    <rux-icon icon="audiotrack" size={large ? "large" : "normal"}></rux-icon>
                    <span className="mt-2 text-xs font-mono">{card.mediaMimeType || 'AUDIO'}</span>
                </div>
            );
        }

        if (card.thumbnail) {
            return <img src={card.thumbnail} alt={card.cardId} className={className} />;
        }

        return (
            <div className={`${className} flex items-center justify-center bg-gray-900 text-gray-500`}>
                <rux-icon icon="image-not-supported" size={large ? "large" : "normal"}></rux-icon>
            </div>
        );
    };

    // Enhanced filtering and sorting with quality system
    const filteredCards = useMemo(() => {
        let result = [...cards];

        // Text search filter
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(c =>
                (c.name && c.name.toLowerCase().includes(q)) ||
                c.cardId.toLowerCase().includes(q) ||
                (c.provider && c.provider.toLowerCase().includes(q))
            );
        }

        // Filter by tier
        if (filterTiers.length > 0) {
            result = result.filter(c => {
                const quality = calculateCardQuality(c);
                return filterTiers.includes(quality.tier);
            });
        }

        // Filter by type
        if (filterTypes.length > 0) {
            result = result.filter(c => {
                const cardType = getCardType(c);
                return filterTypes.includes(cardType);
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return (b.createdAt || '').localeCompare(a.createdAt || '');
                case 'oldest':
                    return (a.createdAt || '').localeCompare(b.createdAt || '');
                case 'quality-high':
                    return calculateCardQuality(b).score - calculateCardQuality(a).score;
                case 'quality-low':
                    return calculateCardQuality(a).score - calculateCardQuality(b).score;
                case 'name-az':
                    return (a.name || 'Untitled').localeCompare(b.name || 'Untitled');
                case 'name-za':
                    return (b.name || 'Untitled').localeCompare(a.name || 'Untitled');
                default:
                    return 0;
            }
        });

        return result;
    }, [cards, search, filterTiers, filterTypes, sortBy]);

    // Calculate tier distribution for stats
    const tierStats = useMemo(() => {
        const stats: Record<CardQualityTier, number> = {
            common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0
        };
        cards.forEach(c => {
            const quality = calculateCardQuality(c);
            stats[quality.tier]++;
        });
        return stats;
    }, [cards]);

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, card: CardIndexEntry) => {
        setDraggedCard(card);
        e.dataTransfer.setData('text/plain', card.cardId);
        e.dataTransfer.effectAllowed = 'move';
        // Create a custom drag image if desired, or let browser handle it
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        setIsOverDropZone(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOverDropZone(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOverDropZone(false);
        if (draggedCard) {
            setActiveWorkspaceCard(draggedCard);
            setDraggedCard(null);
        }
    };

    const handleWorkspaceSave = async (newContent: string) => {
        if (!activeWorkspaceCard || !window.electronAPI?.p2pAppend) return;

        // In a real implementation, we would append to the 'card-updates' core or similar.
        // For now, we'll just log it or simulate an append to the card's core if possible.
        // Since we don't have a specific 'update' schema defined in the backend yet for text content updates 
        // that propagates back to the card record, we will simulate it by appending a new message 
        // to the card's specific core if it exists, or just the library index.

        // Let's assume we are updating the 'text' field of the card record.
        try {
            // This is a placeholder for the actual update logic
            console.log("Saving content for card:", activeWorkspaceCard.cardId, newContent);

            // TODO: Implement actual P2P append logic here
            // await window.electronAPI.p2pAppend({ ... });
        } catch (e) {
            console.error("Failed to save workspace changes", e);
        }
    };

    // If Workspace is active, show it instead of the grid
    if (activeWorkspaceCard) {
        // Construct a 'card' object compatible with CardWorkspace
        // We need to map CardIndexEntry + CardRecord to what CardWorkspace expects



        const textContent = findTextContent(activeWorkspaceCard.cardRecord, activeWorkspaceCard.raw);

        const workspaceCard = {
            id: activeWorkspaceCard.cardId,
            type: (activeWorkspaceCard.mediaKind === 'image' || activeWorkspaceCard.mediaKind === 'video' || activeWorkspaceCard.mediaKind === 'audio')
                ? activeWorkspaceCard.mediaKind
                : 'text',
            timestamp: new Date(activeWorkspaceCard.createdAt).getTime(),
            data: {
                title: activeWorkspaceCard.name,
                text: textContent,
                url: activeWorkspaceCard.mediaRemoteUrl || toFileUrl(activeWorkspaceCard.mediaLocalPath),
                imageUrl: activeWorkspaceCard.mediaRemoteUrl || toFileUrl(activeWorkspaceCard.mediaLocalPath),
                tags: activeWorkspaceCard.cardRecord?.tags || []
            },
            coreName: activeWorkspaceCard.coreName || activeWorkspaceCard.cardId
        };

        return (
            <PageContainer>
                <div className="w-full h-full max-w-[1800px] mx-auto p-6">
                    <CardWorkspace
                        card={workspaceCard}
                        onClose={() => setActiveWorkspaceCard(null)}
                        onSave={handleWorkspaceSave}
                    />
                </div>
            </PageContainer>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
            {/* Status Header Bar */}
            <div className="flex-none px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-700 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center border border-purple-500/30">
                            <rux-icon icon="photo-library" size="small" className="text-purple-400"></rux-icon>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-bold text-white tracking-widest uppercase leading-none">Card Library</h2>
                            <span className="text-[10px] text-purple-400/80 font-mono tracking-wider">MEMORY CORE</span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-gray-700 mx-2"></div>

                    <div className="flex items-center gap-2">
                        <rux-status status={loading ? 'caution' : 'standby'} className="mt-1"></rux-status>
                        <span className="text-xs text-gray-400 font-mono uppercase">
                            {loading ? 'Syncing...' : `${cards.length} Cards`}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-200"></div>
                        <rux-input
                            type="text"
                            value={search}
                            onInput={(e: any) => setSearch(e.target.value)}
                            placeholder="Search cards..."
                            className="relative min-w-[200px]"
                        >
                            <rux-icon slot="prefix" icon="search" size="small"></rux-icon>
                        </rux-input>
                    </div>
                    <rux-button
                        onClick={() => setShowFilters(!showFilters)}
                        icon="filter-list"
                        secondary
                        size="small"
                        className={filterTiers.length > 0 || filterTypes.length > 0 ? 'ring-2 ring-purple-500' : ''}
                    >
                        Filter
                    </rux-button>
                    <rux-button
                        onClick={() => loadCards(selected?.cardId || null)}
                        disabled={loading}
                        icon="refresh"
                        secondary
                        size="small"
                    >
                        Sync
                    </rux-button>
                </div>
            </div>

            {/* Filter & Sort Panel */}
            {showFilters && (
                <div className="flex-none px-6 py-3 bg-gray-800/50 border-b border-gray-700/50 flex flex-wrap items-center gap-4">
                    {/* Sort By */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Sort:</span>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-purple-500 focus:outline-none"
                            title="Sort order"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="quality-high">Quality ↓</option>
                            <option value="quality-low">Quality ↑</option>
                            <option value="name-az">Name A-Z</option>
                            <option value="name-za">Name Z-A</option>
                        </select>
                    </div>

                    <div className="h-4 w-px bg-gray-700"></div>

                    {/* Tier Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Tier:</span>
                        <div className="flex gap-1">
                            {[
                                { value: 'common' as CardQualityTier, label: 'Common', activeClass: 'bg-gray-500/30 text-gray-400 ring-1 ring-gray-500' },
                                { value: 'uncommon' as CardQualityTier, label: 'Uncommon', activeClass: 'bg-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500' },
                                { value: 'rare' as CardQualityTier, label: 'Rare', activeClass: 'bg-blue-500/30 text-blue-400 ring-1 ring-blue-500' },
                                { value: 'epic' as CardQualityTier, label: 'Epic', activeClass: 'bg-purple-500/30 text-purple-400 ring-1 ring-purple-500' },
                                { value: 'legendary' as CardQualityTier, label: 'Legendary', activeClass: 'bg-orange-500/30 text-orange-400 ring-1 ring-orange-500' },
                                { value: 'mythic' as CardQualityTier, label: 'Mythic', activeClass: 'bg-rose-500/30 text-rose-400 ring-1 ring-rose-500' },
                            ].map(tier => (
                                <button
                                    key={tier.value}
                                    onClick={() => {
                                        setFilterTiers(prev => 
                                            prev.includes(tier.value) 
                                                ? prev.filter(t => t !== tier.value)
                                                : [...prev, tier.value]
                                        );
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                                        filterTiers.includes(tier.value)
                                            ? tier.activeClass
                                            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                                    }`}
                                    data-tooltip={`${tier.label} (${tierStats[tier.value]} cards)`}
                                    data-tooltip-tier={tier.value}
                                >
                                    {getTierBadge(tier.value)} <span className="opacity-60">{tierStats[tier.value]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-4 w-px bg-gray-700"></div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Type:</span>
                        <div className="flex gap-1">
                            {getAllCardTypes().map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => {
                                        setFilterTypes(prev => 
                                            prev.includes(type.value) 
                                                ? prev.filter(t => t !== type.value)
                                                : [...prev, type.value]
                                        );
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                                        filterTypes.includes(type.value)
                                            ? 'bg-purple-500/30 text-purple-400 ring-1 ring-purple-500'
                                            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                                    }`}
                                    data-tooltip={type.label}
                                >
                                    <rux-icon icon={type.icon} size="extra-small"></rux-icon>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {(filterTiers.length > 0 || filterTypes.length > 0) && (
                        <>
                            <div className="h-4 w-px bg-gray-700"></div>
                            <button
                                onClick={() => {
                                    setFilterTiers([]);
                                    setFilterTypes([]);
                                }}
                                className="text-[10px] uppercase tracking-wider text-red-400 hover:text-red-300 font-bold"
                            >
                                Clear Filters
                            </button>
                        </>
                    )}

                    {/* Results Count */}
                    <div className="ml-auto text-[10px] text-gray-500 font-mono">
                        Showing {filteredCards.length} of {cards.length}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
            <style>{`
                .card-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 1.5rem;
                }
                .glass-overlay {
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(16px);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                
                @keyframes pulse-border {
                    0% { border-color: rgba(34, 211, 238, 0.3); box-shadow: 0 0 0 rgba(34, 211, 238, 0); }
                    50% { border-color: rgba(34, 211, 238, 0.8); box-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
                    100% { border-color: rgba(34, 211, 238, 0.3); box-shadow: 0 0 0 rgba(34, 211, 238, 0); }
                }
                .drop-zone-active {
                    animation: pulse-border 2s infinite;
                }
            `}</style>

            <div className="w-full text-white h-full flex flex-col max-w-[1800px] mx-auto relative">
                {error && (
                    <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-300">
                        <rux-icon icon="warning" size="small"></rux-icon>
                        <span className="font-mono text-sm">{error}</span>
                    </div>
                )}

                {loading && cards.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                        <rux-progress type="circular"></rux-progress>
                        <div className="font-mono text-sm animate-pulse text-purple-400">INITIALIZING MEMORY MATRIX...</div>
                    </div>
                )}

                {!loading && cards.length === 0 && !error && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                        <rux-icon icon="sd-card-alert" size="large" className="opacity-20"></rux-icon>
                        <div className="text-center">
                            <div className="text-lg font-medium text-gray-300">Memory Core Empty</div>
                            <div className="text-sm text-gray-500 mt-1">
                                No cards detected. Generate artifacts in Chat to populate the library.
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 relative">
                    <div className="card-grid pb-32">
                        {filteredCards.map((card) => {
                            const quality = calculateCardQuality(card);
                            return (
                            <div
                                key={card.cardId + card.createdAt}
                                draggable
                                onDragStart={(e) => handleDragStart(e, card)}
                                onClick={() => handleCardClick(card)}
                                className={`group relative bg-gray-900/40 border-2 rounded-lg cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all duration-300 flex flex-col overflow-hidden ${quality.borderClass} ${quality.glowClass}`}
                            >
                                {/* Tier Badge */}
                                <div 
                                    className={`absolute top-2 right-2 z-10 tier-badge ${quality.badgeClass}`} 
                                    data-tooltip={`${quality.tierLabel} • Score: ${quality.score}/13`}
                                    data-tooltip-tier={quality.tier}
                                    data-tooltip-pos="bottom"
                                >
                                    {getTierBadge(quality.tier)}
                                </div>
                                {renderThumbnail(card)}
                                <div className="p-4 flex flex-col gap-1">
                                    <div className="font-bold text-sm text-gray-200 truncate group-hover:text-purple-300 transition-colors">
                                        {card.name || 'Untitled Card'}
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-500 truncate">
                                        {card.cardId}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                                            {card.provider || 'SYSTEM'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {/* Affix Badges */}
                                            {(() => {
                                                const summaryCount = card.cardRecord?.summaries?.length || 0;
                                                const keyTermCount = card.cardRecord?.keyTerms?.length || 0;
                                                const wikiCount = card.cardRecord?.wormhole?.wikiEntries?.length || 0;
                                                const transcriptCount = card.cardRecord?.transcripts?.length || 0;

                                                if (summaryCount === 0 && keyTermCount === 0 && wikiCount === 0 && transcriptCount === 0 && !card.derivedGif && card.subType !== 'sprite-sheet') return null;

                                                return (
                                                    <div className="flex items-center gap-2 mr-2 border-r border-gray-700 pr-2">
                                                        {(card.derivedGif || card.subType === 'sprite-sheet') && (
                                                            <div className="flex items-center gap-1 text-pink-400" data-tooltip="Animated Loop">
                                                                <rux-icon icon="animation" size="extra-small"></rux-icon>
                                                            </div>
                                                        )}
                                                        {transcriptCount > 0 && (
                                                            <div className="flex items-center gap-1 text-yellow-400" data-tooltip={`${transcriptCount} Transcript${transcriptCount > 1 ? 's' : ''}`}>
                                                                <rux-icon icon="mic" size="extra-small"></rux-icon>
                                                            </div>
                                                        )}
                                                        {summaryCount > 0 && (
                                                            <div className="flex items-center gap-1 text-cyan-400" data-tooltip={`${summaryCount} Summar${summaryCount > 1 ? 'ies' : 'y'}`}>
                                                                <rux-icon icon="subject" size="extra-small"></rux-icon>
                                                            </div>
                                                        )}
                                                        {keyTermCount > 0 && (
                                                            <div className="flex items-center gap-1 text-purple-400" data-tooltip={`${keyTermCount} Key Term Set${keyTermCount > 1 ? 's' : ''}`}>
                                                                <rux-icon icon="local-offer" size="extra-small"></rux-icon>
                                                            </div>
                                                        )}
                                                        {wikiCount > 0 && (
                                                            <div className="flex items-center gap-1 text-emerald-400" data-tooltip={`${wikiCount} Wiki Entr${wikiCount > 1 ? 'ies' : 'y'}`}>
                                                                <rux-icon icon="public" size="extra-small"></rux-icon>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            {card.mediaKind && (
                                                <rux-icon icon={card.mediaKind === 'video' ? 'videocam' : card.mediaKind === 'audio' ? 'audiotrack' : 'image'} size="extra-small" className="text-gray-600"></rux-icon>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                </div>

                {/* Drop Zone */}
                <div
                    className={`absolute bottom-8 right-8 w-64 h-48 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-md z-40 ${isOverDropZone
                        ? 'border-cyan-400 bg-cyan-900/40 shadow-[0_0_30px_rgba(34,211,238,0.4)] scale-105 drop-zone-active'
                        : draggedCard
                            ? 'border-gray-600 bg-gray-900/80 border-dashed opacity-100'
                            : 'border-transparent bg-transparent opacity-0 pointer-events-none'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <rux-icon icon="input" size="large" className={isOverDropZone ? "text-cyan-400 animate-bounce" : "text-gray-500"}></rux-icon>
                    <span className={`font-mono text-xs font-bold tracking-widest uppercase ${isOverDropZone ? "text-cyan-300" : "text-gray-500"}`}>
                        {isOverDropZone ? "DROP TO OPEN" : "DROP ZONE"}
                    </span>
                </div>

                {/* Detail Overlay (Old Inspector - kept for click interaction if desired, or we can remove/unify) */}
                {selected && !activeWorkspaceCard && (
                    <div className="absolute inset-0 z-50 glass-overlay flex justify-end animate-in slide-in-from-right duration-300">
                        <div className="w-full max-w-3xl h-full bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl">
                            {/* Overlay Header */}
                            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                                <div className="flex items-center gap-3">
                                    <rux-icon icon="assignment" size="small" className="text-purple-400"></rux-icon>
                                    <span className="text-sm font-mono text-gray-400 uppercase tracking-widest">Card Inspector</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Close card inspector"
                                    onClick={() => setSelected(null)}
                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors text-xl font-light"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <div className="flex flex-col gap-8">
                                    {/* Top Section: Preview & Basic Info */}
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="w-full md:w-1/2">
                                            {renderThumbnail(selected, true)}
                                        </div>
                                        <div className="w-full md:w-1/2 flex flex-col gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Card Name</label>
                                                <div className="flex gap-2">
                                                    {isEditingName ? (
                                                        <div className="flex-1 flex gap-2">
                                                            <rux-input
                                                                value={editingName}
                                                                onInput={(e: any) => setEditingName(e.target.value)}
                                                                className="flex-1"
                                                                size="small"
                                                            ></rux-input>
                                                            <rux-button size="small" icon="save" onClick={handleSaveName}></rux-button>
                                                            <rux-button size="small" icon="close" secondary onClick={() => setIsEditingName(false)}></rux-button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-between group/name">
                                                            <h1 className="text-2xl font-bold text-white truncate" title={selected.name}>
                                                                {selected.name || 'Untitled Card'}
                                                            </h1>
                                                            <button
                                                                type="button"
                                                                aria-label="Edit card name"
                                                                onClick={() => setIsEditingName(true)}
                                                                className="opacity-0 group-hover/name:opacity-100 text-gray-500 hover:text-purple-400 transition-all"
                                                            >
                                                                <rux-icon icon="edit" size="small"></rux-icon>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <div className="text-gray-500 mb-1">Created</div>
                                                    <div className="text-gray-300 font-mono">{new Date(selected.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 mb-1">Type</div>
                                                    <div className="text-gray-300 font-mono uppercase">{selected.mediaKind || 'UNKNOWN'}</div>
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="text-gray-500 mb-1">ID</div>
                                                    <div className="text-gray-300 font-mono break-all">{selected.cardId}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-800"></div>

                                    {/* Wormhole Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <rux-icon icon="cloud-queue" size="small"></rux-icon>
                                            <h3 className="font-bold uppercase tracking-wider text-sm">Wormhole Status</h3>
                                        </div>

                                        {selectedWormholeProcessing ? (
                                            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {renderWormholeStepBadge('Ingest', selectedWormholeProcessing.ingest)}
                                                    {renderWormholeStepBadge('Transcription', selectedWormholeProcessing.transcription)}
                                                    {renderWormholeStepBadge('Summarization', selectedWormholeProcessing.summarization)}
                                                    {renderWormholeStepBadge('Key terms', selectedWormholeProcessing.keyTerms)}
                                                    {renderWormholeStepBadge('Wiki update', selectedWormholeProcessing.wikiUpdate)}
                                                </div>

                                                {/* Run Stats */}
                                                <div className="grid grid-cols-3 gap-4 mb-4 border-t border-gray-700/50 pt-4">
                                                    <div className="flex flex-col items-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/30">
                                                        <rux-icon icon="subject" size="small" className="text-cyan-400 mb-1"></rux-icon>
                                                        <span className="text-2xl font-bold text-white">{selected.cardRecord?.summaries?.length || 0}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Summaries</span>
                                                    </div>
                                                    <div className="flex flex-col items-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/30">
                                                        <rux-icon icon="local-offer" size="small" className="text-purple-400 mb-1"></rux-icon>
                                                        <span className="text-2xl font-bold text-white">{selected.cardRecord?.keyTerms?.length || 0}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Key Terms</span>
                                                    </div>
                                                    <div className="flex flex-col items-center p-3 bg-gray-900/50 rounded-lg border border-gray-700/30">
                                                        <rux-icon icon="public" size="small" className="text-emerald-400 mb-1"></rux-icon>
                                                        <span className="text-2xl font-bold text-white">{selected.cardRecord?.wormhole?.wikiEntries?.length || 0}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Wiki Entries</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                                    <rux-button
                                                        size="small"
                                                        secondary
                                                        onClick={() => runWormholeStep('summarization')}
                                                        disabled={wormholeActionPending}
                                                    >
                                                        {wormholeActionPending && activeWormholeStep === 'summarization' ? (
                                                            <>
                                                                <rux-icon
                                                                    icon="sync"
                                                                    size="extra-small"
                                                                    className="animate-spin mr-1"
                                                                ></rux-icon>
                                                                Running…
                                                            </>
                                                        ) : (
                                                            'Run Summarization'
                                                        )}
                                                    </rux-button>
                                                    <rux-button
                                                        size="small"
                                                        secondary
                                                        onClick={() => runWormholeStep('keyTerms')}
                                                        disabled={wormholeActionPending}
                                                    >
                                                        {wormholeActionPending && activeWormholeStep === 'keyTerms' ? (
                                                            <>
                                                                <rux-icon
                                                                    icon="sync"
                                                                    size="extra-small"
                                                                    className="animate-spin mr-1"
                                                                ></rux-icon>
                                                                Running…
                                                            </>
                                                        ) : (
                                                            'Run Key Terms'
                                                        )}
                                                    </rux-button>
                                                    <rux-button
                                                        size="small"
                                                        secondary
                                                        onClick={() => runWormholeStep('wikiUpdate')}
                                                        disabled={wormholeActionPending}
                                                    >
                                                        {wormholeActionPending && activeWormholeStep === 'wikiUpdate' ? (
                                                            <>
                                                                <rux-icon
                                                                    icon="sync"
                                                                    size="extra-small"
                                                                    className="animate-spin mr-1"
                                                                ></rux-icon>
                                                                Running…
                                                            </>
                                                        ) : (
                                                            'Run Wiki Update'
                                                        )}
                                                    </rux-button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 text-sm italic">
                                                No Wormhole data associated with this card.
                                            </div>
                                        )}
                                    </div>

                                    {/* Raw Data Section */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <rux-icon icon="code" size="small"></rux-icon>
                                            <h3 className="font-bold uppercase tracking-wider text-xs">Raw Metadata</h3>
                                        </div>
                                        <pre className="bg-black/50 border border-gray-800 rounded-lg p-4 text-[10px] font-mono text-gray-400 overflow-x-auto max-h-60 custom-scrollbar">
                                            {JSON.stringify(selected.cardRecord || selected.raw, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default CardLibrary;
