// @ts-nocheck
import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import CardWorkspace from '../components/CardWorkspace';
import { HoverVideoThumbnail, getCardVideoPath, getCardImagePath } from '../components/HoverVideoThumbnail';

// Lazy load 3D viewer for performance
const Card3DViewer = lazy(() => import('../components/Card3DViewer/Card3DViewer').then(m => ({ default: m.Card3DViewer })));
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
    mediaKind?: 'image' | 'video' | 'audio' | 'message' | 'pet';
    mediaLocalPath?: string;
    mediaRemoteUrl?: string;
    mediaMimeType?: string;
    subType?: string;
    // Message card specific fields
    messageContent?: string;
    messageRole?: 'user' | 'model';
    attachmentCount?: number;
    hasVideo?: boolean;
    derivedGif?: { localPath: string; cardId: string };
    cardRecord?: any;
    // Parent-child relationship
    parentCardId?: string;
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
    
    // Card Sets State
    const [searchParams, setSearchParams] = useSearchParams();
    const [cardSets, setCardSets] = useState<any[]>([]);
    const [activeSetId, setActiveSetId] = useState<string | null>(null);
    const [activeSetCardIds, setActiveSetCardIds] = useState<string[]>([]);
    const [loadingSets, setLoadingSets] = useState(false);

    // Extraction State
    const [extracting, setExtracting] = useState<{ [key: string]: boolean }>({});
    const [extractedChildren, setExtractedChildren] = useState<{ [cardId: string]: string[] }>({});
    
    // Scroll Attachment State
    const [showScrollPicker, setShowScrollPicker] = useState(false);
    const [availableScrollCards, setAvailableScrollCards] = useState<{ cardId: string; name: string; mediaType: string }[]>([]);
    const [scrollAttaching, setScrollAttaching] = useState(false);
    
    // Image Generation State
    const [imageGenState, setImageGenState] = useState<'idle' | 'crafting' | 'generating' | 'complete' | 'error'>('idle');
    const [imageGenError, setImageGenError] = useState<string | null>(null);
    const [imageProvider, setImageProvider] = useState<'gemini' | 'local-vision'>('gemini');
    const [localVisionStatus, setLocalVisionStatus] = useState<{ running: boolean }>({ running: false });

    // Lightbox State (for full-screen image view)
    const [showLightbox, setShowLightbox] = useState(false);
    
    // Video Generation State for Hell Week cards
    const [hwVideoGenStatus, setHwVideoGenStatus] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');

    // Check Local Vision status
    useEffect(() => {
        const checkStatus = async () => {
            if (window.electronAPI?.getLocalVisionStatus) {
                try {
                    const status = await window.electronAPI.getLocalVisionStatus();
                    setLocalVisionStatus(status);
                } catch (e) {
                    // ignore
                }
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);
    
    // Loop Video State
    const [loopGenStatus, setLoopGenStatus] = useState<{ [imageId: string]: { status: string; progress?: number; message?: string } }>({});
    const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
    
    // Global Mute State (persisted to localStorage)
    const [globalMuted, setGlobalMuted] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('globalMuted') === 'true';
        }
        return true; // Default muted
    });
    
    // Persist mute state
    useEffect(() => {
        localStorage.setItem('globalMuted', String(globalMuted));
    }, [globalMuted]);
    
    // Load Card Sets and handle URL param
    useEffect(() => {
        const loadCardSets = async () => {
            if (!window.electronAPI?.cardSetsList) return;
            setLoadingSets(true);
            try {
                const sets = await window.electronAPI.cardSetsList();
                setCardSets(sets || []);
            } catch (err) {
                console.error('Failed to load card sets:', err);
            } finally {
                setLoadingSets(false);
            }
        };
        loadCardSets();
    }, []);
    
    // Handle setId from URL params
    useEffect(() => {
        const setIdFromUrl = searchParams.get('setId');
        if (setIdFromUrl && setIdFromUrl !== activeSetId) {
            setActiveSetId(setIdFromUrl);
        }
    }, [searchParams]);
    
    // Load card IDs for active set
    useEffect(() => {
        const loadSetCardIds = async () => {
            if (!activeSetId || !window.electronAPI?.cardSetsGetCardIds) {
                setActiveSetCardIds([]);
                return;
            }
            try {
                const cardIds = await window.electronAPI.cardSetsGetCardIds(activeSetId);
                setActiveSetCardIds(cardIds || []);
            } catch (err) {
                console.error('Failed to load set card IDs:', err);
                setActiveSetCardIds([]);
            }
        };
        loadSetCardIds();
    }, [activeSetId]);
    
    // Helper to clear set filter
    const clearSetFilter = () => {
        setActiveSetId(null);
        setActiveSetCardIds([]);
        setSearchParams({});
    };
    
    // Get active set info
    const activeSet = useMemo(() => {
        return cardSets.find(s => s.setId === activeSetId || s.mergedSetId === activeSetId);
    }, [cardSets, activeSetId]);
    
    // Navigation Animation State
    const [navAnimation, setNavAnimation] = useState<'none' | 'zoom-to-child' | 'zoom-to-parent' | 'slide-left' | 'slide-right'>('none');
    const [pendingCard, setPendingCard] = useState<CardIndexEntry | null>(null);
    
    // 3D Viewer State
    const [show3DViewer, setShow3DViewer] = useState(false);

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
                            // HELL WEEK CARDS: type === 'card-state' with data in .card property
                            if (parsed && parsed.type === 'card-state' && parsed.card) {
                                cardRecord = parsed.card;
                                break;
                            }
                            // Accept various card types: traditional cards, pets, AND new media cards (videos, images)
                            if (parsed && (
                                parsed.type === 'card' || 
                                parsed.type === 'pet' ||
                                parsed.mediaKind ||  // NEW: loop videos and generated images
                                parsed.cardId        // NEW: any record with cardId
                            )) {
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

                    let mediaKind: 'image' | 'video' | 'audio' | 'message' | undefined;
                    let mediaLocalPath: string | undefined;
                    let mediaRemoteUrl: string | undefined;
                    let mediaMimeType: string | undefined;
                    let messageContent: string | undefined;
                    let messageRole: 'user' | 'model' | undefined;
                    let attachmentCount: number | undefined;
                    let hasVideo: boolean | undefined;

                    if (cardRecord.kind === 'message' || cardRecord.message) {
                        // Message card
                        mediaKind = 'message';
                        messageContent = cardRecord.message?.content;
                        messageRole = cardRecord.message?.role;
                        attachmentCount = cardRecord.attachments?.length;
                        hasVideo = !!cardRecord.video;
                        // Use first attachment as thumbnail if available
                        if (cardRecord.attachments?.[0]?.dataUrl) {
                            mediaRemoteUrl = cardRecord.attachments[0].dataUrl;
                        }
                    } else if (cardRecord.image) {
                        mediaKind = 'image';
                        mediaLocalPath = cardRecord.image.localPath;
                        mediaRemoteUrl = cardRecord.image.remoteUrl || cardRecord.image.dataUrl;
                        mediaMimeType = cardRecord.image.mimeType;
                    } else if (cardRecord.video) {
                        mediaKind = 'video';
                        mediaLocalPath = cardRecord.video.localPath;
                        mediaRemoteUrl = cardRecord.video.remoteUrl;
                        mediaMimeType = cardRecord.video.mimeType;
                    } else if (cardRecord.mediaKind === 'video') {
                        // NEW FORMAT: Loop videos and generated videos store mediaLocalPath directly
                        mediaKind = 'video';
                        mediaLocalPath = cardRecord.mediaLocalPath;
                        mediaMimeType = 'video/mp4';
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
                        messageContent,
                        messageRole,
                        attachmentCount,
                        hasVideo,
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
                        mediaKind: data.mediaKind,
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
    
    // Listen for loop video generation progress
    useEffect(() => {
        if (!window.electronAPI?.onLoopVideoProgress) return;
        
        const cleanup = window.electronAPI.onLoopVideoProgress((payload: any) => {
            console.log('[CardLibrary] Loop video progress:', payload);
            if (payload.imageId) {
                setLoopGenStatus(prev => ({
                    ...prev,
                    [payload.imageId]: {
                        status: payload.status,
                        progress: payload.progress,
                        message: payload.message,
                    },
                }));
                
                // Update Hell Week video status if this is the selected card
                if (selected && payload.imageId === selected.cardId) {
                    if (payload.status === 'complete') {
                        setHwVideoGenStatus('complete');
                        setTimeout(() => setHwVideoGenStatus('idle'), 5000);
                    } else if (payload.status === 'error') {
                        setHwVideoGenStatus('error');
                        setTimeout(() => setHwVideoGenStatus('idle'), 5000);
                    } else if (payload.status === 'generating' || payload.status === 'crafted') {
                        setHwVideoGenStatus('generating');
                    }
                }
                
                // If complete, reload cards to get updated data including the new video card
                if (payload.status === 'complete') {
                    // Delay slightly to let backend finish saving
                    setTimeout(() => {
                        loadCards().then(() => {
                            // Re-select the card to refresh its data
                            if (selected) {
                                loadCards(selected.cardId);
                            }
                        });
                    }, 500);
                }
            }
        });
        
        return cleanup;
    }, [selected]);

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
            // Now supports: audio, text, markdown, image, video (multimodal analysis)
            const supportedTypes = ['audio', 'text', 'markdown', 'image', 'video'];
            const effectiveMediaType = mediaType || selected.mediaKind || '';
            if (!supportedTypes.includes(effectiveMediaType)) {
                setError(`Summarization is not supported for '${effectiveMediaType}' cards. Supported: audio, text, markdown, image, video.`);
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

    // Mini thumbnail for lineage previews
    const getMiniThumbnailSrc = (card: CardIndexEntry): string | null => {
        if (card.mediaKind === 'image') {
            return card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.thumbnail || card.mediaRemoteUrl || null;
        }
        if (card.mediaKind === 'video') {
            // For videos, use the thumbnail if available, or the cardRecord image dataUrl
            if (card.thumbnail) return card.thumbnail;
            if (card.cardRecord?.video?.thumbnail) return card.cardRecord.video.thumbnail;
            // Can't easily show video as mini preview, return null
            return null;
        }
        if (card.thumbnail) return card.thumbnail;
        // Check cardRecord for image dataUrl
        if (card.cardRecord?.image?.dataUrl) return card.cardRecord.image.dataUrl;
        return null;
    };

    const renderThumbnail = (card: CardIndexEntry, large = false) => {
        // Note: We removed pointer-events-none for thumbnails with videos so hover works
        const baseClassName = large
            ? "w-full h-64 object-cover rounded-lg border border-gray-700 bg-black/40 shadow-lg"
            : "w-full h-40 object-cover rounded-t-lg bg-black/40 group-hover:opacity-90 transition-opacity";
        
        // Only add pointer-events-none for non-video thumbnails (to prevent drag interference)
        const className = baseClassName;

        // HELL WEEK CARDS: Check for image in cardRecord.mediaPrompts
        const hellWeekImagePath = card.cardRecord?.mediaPrompts?.generated_image_local;
        if (hellWeekImagePath && !card.mediaKind) {
            const imageSrc = toFileUrl(hellWeekImagePath);
            // Get video path if exists
            const videoPath = getCardVideoPath(card);
            const videoSrc = videoPath ? toFileUrl(videoPath) : null;
            
            if (!large) {
                return (
                    <HoverVideoThumbnail
                        imageSrc={imageSrc}
                        videoSrc={videoSrc}
                        alt={card.cardId}
                        className={className}
                        showLoopBadge={!!videoSrc}
                        badgePosition="top-right"
                    />
                );
            }
            
            // Large view - AUTO-PLAY looping video if child video exists
            if (videoSrc) {
                return (
                    <div className={`${className} relative`}>
                        <video 
                            src={videoSrc} 
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted={globalMuted}
                            playsInline
                            preload="metadata"
                        />
                        {/* LOOP badge */}
                        <div className="absolute top-2 right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                            <rux-icon icon="loop" size="extra-small"></rux-icon>
                            LOOP
                        </div>
                        {/* Mute toggle */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setGlobalMuted(!globalMuted); }}
                            className="absolute bottom-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                            title={globalMuted ? 'Unmute' : 'Mute'}
                        >
                            <rux-icon 
                                icon={globalMuted ? 'volume-off' : 'volume-up'} 
                                size="small"
                                className="text-white"
                            ></rux-icon>
                        </button>
                    </div>
                );
            }
            
            // No video yet - show image with hover effect for lightbox
            return (
                <div className={`${className} relative cursor-pointer group/hwimg`} onClick={() => setShowLightbox(true)}>
                    <img src={imageSrc} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/hwimg:opacity-100 transition-opacity flex items-center justify-center">
                        <rux-icon icon="zoom-in" size="normal" className="text-white"></rux-icon>
                    </div>
                </div>
            );
        }

        if (card.mediaKind === 'image') {
            const imageSrc = card.mediaLocalPath ? toFileUrl(card.mediaLocalPath) : card.thumbnail || card.mediaRemoteUrl;
            if (imageSrc) {
                // Get video path from card (new taxonomy children or legacy)
                const videoPath = getCardVideoPath(card);
                const videoSrc = videoPath ? toFileUrl(videoPath) : null;
                
                // For card grid (small thumbnails) - use modular HoverVideoThumbnail
                if (!large) {
                    return (
                        <HoverVideoThumbnail
                            imageSrc={imageSrc}
                            videoSrc={videoSrc}
                            alt={card.cardId}
                            className={className}
                            showLoopBadge={!!videoSrc}
                            badgePosition="top-right"
                        />
                    );
                }
                
                // For detail view (large=true) - AUTO-PLAY looping video if child video exists
                if (videoSrc) {
                    // Has loop video - auto-play it
                    return (
                        <div className={`${className} relative`}>
                            <video 
                                src={videoSrc} 
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                muted={globalMuted}
                                playsInline
                                preload="metadata"
                            />
                            {/* LOOP badge */}
                            <div className="absolute top-2 right-2 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                <rux-icon icon="loop" size="extra-small"></rux-icon>
                                LOOP
                            </div>
                            {/* Mute toggle */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setGlobalMuted(!globalMuted); }}
                                className="absolute bottom-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                                title={globalMuted ? 'Unmute' : 'Mute'}
                            >
                                <rux-icon 
                                    icon={globalMuted ? 'volume-off' : 'volume-up'} 
                                    size="small"
                                    className="text-white"
                                ></rux-icon>
                            </button>
                        </div>
                    );
                }
                
                // No loop video - show create button overlay
                const loopStatus = loopGenStatus[card.cardId];
                const isGenerating = loopStatus?.status === 'generating';
                
                return (
                    <div className={`${className} relative group/imagethumb`}>
                        <img src={imageSrc} alt={card.cardId} className="w-full h-full object-cover" loading="lazy" />
                        {/* Create Loop Video overlay button */}
                        {!isGenerating && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/imagethumb:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreateLoopVideoFromImageCard(card);
                                    }}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 text-white font-bold text-sm transition-colors shadow-lg"
                                >
                                    <rux-icon icon="movie" size="small"></rux-icon>
                                    Create Loop Video
                                </button>
                            </div>
                        )}
                        {/* Generating overlay */}
                        {isGenerating && (
                            <div className="absolute inset-0 bg-purple-900/60 flex flex-col items-center justify-center">
                                <rux-icon icon="autorenew" size="normal" className="animate-spin text-purple-300"></rux-icon>
                                <span className="mt-2 text-sm text-purple-200 font-bold">Creating Loop...</span>
                            </div>
                        )}
                    </div>
                );
            }
        }

        if (card.mediaKind === 'video') {
            // Get video source - check multiple possible locations
            const rawVideoPath = card.mediaLocalPath || 
                                card.cardRecord?.mediaLocalPath ||
                                card.cardRecord?.video?.localPath;
            const videoSrc = rawVideoPath ? toFileUrl(rawVideoPath) : card.mediaRemoteUrl;
            
            console.log('[renderThumbnail] Video card:', card.cardId, 'videoSrc:', videoSrc, 'raw:', rawVideoPath);
            
            if (videoSrc) {
                // For grid view (small) - hover to play with thumbnail
                if (!large) {
                    // Get thumbnail - use sourceImage, thumbnail, or generate from video
                    const thumbSrc = card.thumbnail || 
                                    (card.cardRecord?.sourceImage?.localPath ? toFileUrl(card.cardRecord.sourceImage.localPath) : null) ||
                                    card.cardRecord?.thumbnail;
                    
                    if (thumbSrc) {
                        return (
                            <HoverVideoThumbnail
                                imageSrc={thumbSrc}
                                videoSrc={videoSrc}
                                alt={card.cardId}
                                className={className}
                                showLoopBadge={true}
                                badgePosition="top-right"
                            />
                        );
                    }
                    
                    // No thumbnail - just show video directly with poster frame
                    return (
                        <HoverVideoThumbnail
                            imageSrc={videoSrc}
                            videoSrc={videoSrc}
                            alt={card.cardId}
                            className={className}
                            showLoopBadge={true}
                            badgePosition="top-right"
                        />
                    );
                }
                
                // For detail view (large) - full video player
                return (
                    <div className={`${className} relative`}>
                        <video 
                            src={videoSrc} 
                            className="w-full h-full object-cover"
                            autoPlay={large}
                            loop={large}
                            muted={globalMuted}
                            playsInline
                            controls={large}
                            preload="metadata"
                        />
                        {/* Mute toggle button */}
                        {large && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setGlobalMuted(!globalMuted); }}
                                className="absolute bottom-4 right-4 p-2 bg-black/70 hover:bg-black/90 rounded-full transition-colors"
                                title={globalMuted ? 'Unmute' : 'Mute'}
                            >
                                <rux-icon 
                                    icon={globalMuted ? 'volume-off' : 'volume-up'} 
                                    size="small"
                                    className="text-white"
                                ></rux-icon>
                            </button>
                        )}
                    </div>
                );
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

        if (card.mediaKind === 'message') {
            const hasMedia = (card.attachmentCount || 0) > 0 || card.hasVideo;
            // If message has thumbnail from attachment, show it
            if (card.thumbnail || card.mediaRemoteUrl) {
                return (
                    <div className={`${className} relative`}>
                        <img 
                            src={card.thumbnail || card.mediaRemoteUrl} 
                            alt={card.cardId} 
                            className="w-full h-full object-cover" 
                        />
                        {/* Message badge overlay */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/70 rounded text-xs">
                            <rux-icon icon={card.messageRole === 'user' ? 'person' : 'smart-toy'} size="12px" className="text-purple-400"></rux-icon>
                            <span className="text-purple-300 font-medium">{card.messageRole === 'user' ? 'Request' : 'Response'}</span>
                        </div>
                    </div>
                );
            }
            // Text-only message card
            return (
                <div className={`${className} flex flex-col p-3 bg-gradient-to-br from-purple-900/50 to-gray-900`}>
                    <div className="flex items-center gap-2 mb-2">
                        <rux-icon icon={card.messageRole === 'user' ? 'person' : 'smart-toy'} size="small" className="text-purple-400"></rux-icon>
                        <span className="text-xs font-medium text-purple-300">{card.messageRole === 'user' ? 'User Request' : 'AI Response'}</span>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-4 flex-1">{card.messageContent || card.name}</p>
                    {hasMedia && (
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-purple-400">
                            {(card.attachmentCount || 0) > 0 && (
                                <span className="flex items-center gap-1">
                                    <rux-icon icon="attach-file" size="12px"></rux-icon>
                                    {card.attachmentCount} media
                                </span>
                            )}
                            {card.hasVideo && (
                                <span className="flex items-center gap-1">
                                    <rux-icon icon="videocam" size="12px"></rux-icon>
                                    Video
                                </span>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (card.mediaKind === 'pet') {
            // Check for video from cardRecord (forged avatars)
            const videoPath = card.cardRecord?.video?.localPath || card.raw?.video?.localPath;
            if (videoPath) {
                return (
                    <video 
                        src={toFileUrl(videoPath)} 
                        className={className}
                        autoPlay 
                        muted 
                        loop 
                        playsInline
                        preload="metadata"
                    />
                );
            }
            // Fallback to image
            const imagePath = card.cardRecord?.image?.localPath || card.raw?.image?.localPath;
            const src = card.thumbnail || card.mediaRemoteUrl || (imagePath ? toFileUrl(imagePath) : null);
            if (src) {
                return <img src={src} alt={card.cardId} className={className} style={{ imageRendering: 'pixelated' }} loading="lazy" />;
            }
        }

        // Generic fallback: check for any video in cardRecord
        const videoPath = card.cardRecord?.video?.localPath || card.raw?.video?.localPath;
        if (videoPath) {
            return (
                <video 
                    src={toFileUrl(videoPath)} 
                    className={className}
                    autoPlay 
                    muted 
                    loop 
                    playsInline
                    preload="metadata"
                />
            );
        }

        if (card.thumbnail) {
            return <img src={card.thumbnail} alt={card.cardId} className={className} loading="lazy" />;
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

        // Filter by Card Set (first, to narrow scope)
        if (activeSetId && activeSetCardIds.length > 0) {
            const setCardIdSet = new Set(activeSetCardIds);
            result = result.filter(c => {
                // Direct member of the set
                if (setCardIdSet.has(c.cardId)) return true;
                // Child of a set member (loop videos, extractions, etc.)
                const parentId = c.cardRecord?.parentCardId || c.parentCardId;
                if (parentId && setCardIdSet.has(parentId)) return true;
                return false;
            });
        }

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
    }, [cards, search, filterTiers, filterTypes, sortBy, activeSetId, activeSetCardIds]);

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

    // Helper to find related cards
    const findCardById = (cardId: string) => cards.find(c => c.cardId === cardId);
    
    const getParentCard = (card: CardIndexEntry) => {
        const parentId = card.cardRecord?.parentCardId;
        return parentId ? findCardById(parentId) : null;
    };
    
    const getChildCards = (card: CardIndexEntry) => {
        // Search for children by their parentCardId reference (more robust)
        return cards.filter(c => 
            c.cardRecord?.parentCardId === card.cardId || 
            c.parentCardId === card.cardId
        );
    };
    
    const getSiblingCards = (card: CardIndexEntry) => {
        const parent = getParentCard(card);
        if (!parent) return [];
        return getChildCards(parent).filter(c => c.cardId !== card.cardId);
    };

    // Animated navigation between cards
    const navigateToCard = (toCard: CardIndexEntry, relationship: 'parent' | 'child' | 'sibling') => {
        const animMap = {
            parent: 'zoom-to-parent',
            child: 'zoom-to-child',
            sibling: 'slide-left'
        } as const;
        
        setNavAnimation(animMap[relationship]);
        setPendingCard(toCard);
        
        setTimeout(() => {
            setSelected(toCard);
            setNavAnimation('none');
            setPendingCard(null);
        }, 300);
    };

    // Extract media from video card
    const handleExtract = async (extractType: 'first-frame' | 'last-frame' | 'audio') => {
        if (!selected || !selected.mediaLocalPath || selected.mediaKind !== 'video') return;
        if (!window.electronAPI) return;
        
        const extractKey = `${selected.cardId}-${extractType}`;
        if (extracting[extractKey]) return;
        
        setExtracting(prev => ({ ...prev, [extractKey]: true }));
        
        try {
            let result: any;
            if (extractType === 'audio') {
                result = await window.electronAPI.extractVideoAudio({ videoPath: selected.mediaLocalPath });
            } else {
                const frameType = extractType === 'first-frame' ? 'first' : 'last';
                result = await window.electronAPI.extractVideoFrame({ 
                    videoPath: selected.mediaLocalPath, 
                    frameType 
                });
            }
            
            // Create new card
            const childCoreName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const isAudio = extractType === 'audio';
            const dataUrl = isAudio 
                ? `data:${result.mimeType};base64,${result.audioBase64}`
                : `data:${result.mimeType};base64,${result.imageBase64}`;
            
            const childRecord = {
                type: 'card',
                id: childCoreName,
                kind: isAudio ? 'audio' : 'image',
                title: `${extractType === 'first-frame' ? 'First Frame' : extractType === 'last-frame' ? 'Last Frame' : 'Audio'} from ${selected.name || 'Video'}`,
                [isAudio ? 'audio' : 'image']: { dataUrl, localPath: isAudio ? result.audioPath : result.imagePath },
                mimeType: result.mimeType,
                parentCardId: selected.cardId,
                extractionSource: {
                    type: extractType,
                    extractedAt: new Date().toISOString(),
                    sourceVideoPath: selected.mediaLocalPath
                },
                tags: ['extracted', isAudio ? 'audio' : 'frame', extractType],
                createdAt: new Date().toISOString(),
            };
            
            // Save child card
            await window.electronAPI.p2pCreateCore(childCoreName);
            await window.electronAPI.p2pAppend({ name: childCoreName, data: JSON.stringify(childRecord) });
            
            // Update parent card with child reference
            const existingChildIds = selected.cardRecord?.childCardIds || [];
            const updatedParentRecord = {
                ...selected.cardRecord,
                childCardIds: [...existingChildIds, childCoreName]
            };
            await window.electronAPI.p2pAppend({ name: selected.coreName, data: JSON.stringify(updatedParentRecord) });
            
            // Add to library index
            await window.electronAPI.p2pCreateCore('card-library');
            await window.electronAPI.p2pAppend({ name: 'card-library', data: JSON.stringify({
                type: 'card-index',
                cardId: childCoreName,
                coreName: childCoreName,
                name: childRecord.title,
                createdAt: childRecord.createdAt,
                parentCardId: selected.cardId,
            })});
            
            // Track locally
            setExtractedChildren(prev => ({
                ...prev,
                [selected.cardId]: [...(prev[selected.cardId] || []), childCoreName]
            }));
            
            // Refresh cards
            await loadCards(selected.cardId);
            
        } catch (err) {
            console.error('Extraction failed:', err);
        } finally {
            setExtracting(prev => ({ ...prev, [extractKey]: false }));
        }
    };
    
    // Check if extraction type already exists
    const hasExtractionChild = (card: CardIndexEntry, extractType: 'first-frame' | 'last-frame' | 'audio') => {
        const childIds = card.cardRecord?.childCardIds || [];
        return childIds.some(id => {
            const child = findCardById(id);
            return child?.cardRecord?.extractionSource?.type === extractType;
        });
    };

    // ========== HELL WEEK CARD HELPERS ==========
    
    // Check if card has Hell Week data (from pipeline)
    const isHellWeekCard = (card: CardIndexEntry): boolean => {
        const rec = card.cardRecord || {};
        return !!(rec.cardData || rec.truthAnalysis || rec.mediaPrompts || rec.state);
    };
    
    // Get rarity based on card type (matches CardDetails.tsx)
    const getHellWeekRarity = (type?: string): { name: string; color: string; stars: number; bgColor: string } => {
        const rarities: Record<string, { name: string; color: string; stars: number; bgColor: string }> = {
            'Concept': { name: 'COMMON', color: 'text-gray-400', stars: 1, bgColor: 'bg-gray-500/20' },
            'Entity': { name: 'UNCOMMON', color: 'text-green-400', stars: 2, bgColor: 'bg-green-500/20' },
            'Rule': { name: 'RARE', color: 'text-blue-400', stars: 3, bgColor: 'bg-blue-500/20' },
            'Principle': { name: 'EPIC', color: 'text-purple-400', stars: 4, bgColor: 'bg-purple-500/20' },
            'Law': { name: 'LEGENDARY', color: 'text-amber-400', stars: 5, bgColor: 'bg-amber-500/20' },
        };
        return rarities[type || ''] || rarities['Concept'];
    };
    
    // Generate pseudo-random stats based on card name (for visual interest)
    const generateHellWeekStats = (name?: string) => {
        const generateStat = (seed: string, base: number = 50) => {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
            }
            return Math.abs(hash % 50) + base;
        };
        const cardName = name || 'card';
        return {
            power: generateStat(cardName + 'power', 40),
            wisdom: generateStat(cardName + 'wisdom', 30),
            speed: generateStat(cardName + 'speed', 35),
            magic: generateStat(cardName + 'magic', 45),
        };
    };
    
    // Handle video generation for Hell Week cards
    const handleHellWeekVideoGenerate = async () => {
        if (!selected) return;
        const rec = selected.cardRecord || {};
        const imagePath = rec.mediaPrompts?.generated_image_local || selected.mediaLocalPath || selected.thumbnail;
        if (!imagePath || !window.electronAPI?.createLoopVideoForImage) return;
        
        setHwVideoGenStatus('generating');
        try {
            // Use the existing createLoopVideoForImage API
            await window.electronAPI.createLoopVideoForImage({
                parentCardId: selected.cardId,
                imageId: selected.cardId, // Use cardId as imageId for Hell Week cards
                imagePath: imagePath,
                imageNumber: 1,
                cardName: rec.cardData?.name || selected.name,
            });
            setHwVideoGenStatus('complete');
            setTimeout(() => setHwVideoGenStatus('idle'), 5000);
        } catch (err) {
            console.error('Video generation failed:', err);
            setHwVideoGenStatus('error');
            setTimeout(() => setHwVideoGenStatus('idle'), 5000);
        }
    };

    // Get the image set from a card (supports NEW children[] and LEGACY imageSet)
    const getImageSet = (card: CardIndexEntry): { images: any[]; heroIndex: number; displayOrder: number[]; isNewTaxonomy: boolean } => {
        const rec = card.cardRecord || {};
        
        // NEW TAXONOMY: Check for image children first
        const imageChildren = (rec.children || []).filter((c: any) => c.type === 'image');
        if (imageChildren.length > 0) {
            return {
                images: imageChildren.map((child: any, i: number) => ({
                    id: child.cardId,
                    cardId: child.cardId,           // Mark as a card reference
                    localPath: child.imageUrl?.replace('file:///', '').replace(/\//g, '\\') || '',
                    imageUrl: child.imageUrl,
                    label: child.label,
                    craftedPrompt: '',              // Stored in child card
                    generatedAt: child.createdAt,
                    creationOrder: i,
                    isCard: true,                   // Flag to indicate this is a separate card
                })),
                heroIndex: 0,
                displayOrder: imageChildren.map((_: any, i: number) => i),
                isNewTaxonomy: true,
            };
        }
        
        // LEGACY: Check for imageSet
        if (rec.imageSet) {
            return { ...rec.imageSet, isNewTaxonomy: false };
        }
        
        // LEGACY: Single image field
        if (rec.image?.localPath) {
            return {
                images: [{
                    id: `img-${Date.now()}`,
                    localPath: rec.image.localPath,
                    mimeType: rec.image.mimeType || 'image/jpeg',
                    craftedPrompt: rec.image.generatedPrompt || '',
                    generatedAt: rec.image.generatedAt || new Date().toISOString(),
                    creationOrder: 0,
                    isCard: false,
                }],
                heroIndex: 0,
                displayOrder: [0],
                isNewTaxonomy: false,
            };
        }
        
        return { images: [], heroIndex: 0, displayOrder: [], isNewTaxonomy: false };
    };

    // Collect context from parent cards for richer generation
    const collectParentContext = async (card: CardIndexEntry): Promise<{ names: string[]; summaries: string[]; tags: string[] }> => {
        const names: string[] = [];
        const summaries: string[] = [];
        const tags: string[] = [];
        
        let currentParentId = card.cardRecord?.parentCardId || card.parentCardId;
        let depth = 0;
        const maxDepth = 5; // Limit traversal depth
        
        while (currentParentId && depth < maxDepth) {
            // Try to find parent in loaded cards first
            let parentCard = cards.find(c => c.cardId === currentParentId);
            
            // If not found, try to load from Hypercore
            if (!parentCard && window.electronAPI?.p2pRead) {
                try {
                    const records = await window.electronAPI.p2pRead(currentParentId);
                    if (Array.isArray(records) && records.length > 0) {
                        for (let i = records.length - 1; i >= 0; i--) {
                            try {
                                const parsed = JSON.parse(records[i]);
                                if (parsed) {
                                    parentCard = { cardId: currentParentId, cardRecord: parsed } as any;
                                    break;
                                }
                            } catch { /* skip */ }
                        }
                    }
                } catch { /* skip */ }
            }
            
            if (parentCard) {
                const pRec = parentCard.cardRecord || {};
                if (parentCard.name || pRec.name) names.push(parentCard.name || pRec.name);
                if (pRec.summaries?.length > 0) {
                    summaries.push(...pRec.summaries.map((s: any) => s.text || s.medium || s.short || '').filter(Boolean).slice(0, 2));
                }
                if (pRec.tags?.length > 0) {
                    tags.push(...pRec.tags.slice(0, 5));
                }
                currentParentId = pRec.parentCardId || parentCard.parentCardId;
                depth++;
            } else {
                break;
            }
        }
        
        return { names, summaries, tags };
    };

    // Generate image for card using AI (supports series continuation)
    const handleGenerateImage = async () => {
        if (!selected || !window.electronAPI?.generateImageForCard) return;
        
        // Extract context from the card - ENHANCED to handle wormhole documents
        const rec = selected.cardRecord || selected.raw || {};
        
        // Collect parent context for child cards (like video cards)
        const parentContext = await collectParentContext(selected);
        
        // 1. Try direct text fields
        let textContent = rec.text || rec.content || rec.description || rec.bio || '';
        
        // 2. Extract from summaries (most valuable for wormhole docs)
        if (!textContent && rec.summaries?.length > 0) {
            textContent = rec.summaries
                .map((s: any) => s.text || s.medium || s.short || '')
                .filter(Boolean)
                .slice(0, 3) // Limit to first 3 summaries
                .join('\n\n');
        }
        
        // 3. Extract key terms and add to tags
        let tags = Array.isArray(rec.tags) ? [...rec.tags] : [];
        if (rec.keyTerms?.length > 0) {
            const terms = rec.keyTerms
                .map((kt: any) => typeof kt === 'string' ? kt : kt.term || kt.name || '')
                .filter(Boolean)
                .slice(0, 20); // Limit to 20 key terms
            tags = [...tags, ...terms];
        }
        
        // 4. Card title/name
        const name = selected.name || rec.name || rec.title || 'Untitled';
        
        // 5. Message content for chat cards
        const messageContent = rec.message?.content || selected.messageContent || '';
        
        // 6. Get card kind for context
        const mediaKind = selected.mediaKind || rec.kind || 'unknown';
        
        // 7. For video cards, include the loop prompt as context
        const loopVideoContext = rec.generationParams?.loopPrompt || rec.sourceImage?.craftedPrompt || '';
        
        // 8. Merge parent context into tags and text
        const combinedTags = [...new Set([...tags, ...parentContext.tags])];
        const combinedText = [
            textContent,
            ...parentContext.summaries,
            loopVideoContext,
        ].filter(Boolean).join('\n\n');
        const combinedName = parentContext.names.length > 0 
            ? `${name} (from ${parentContext.names[0]})`
            : name;
        
        const cardContext = {
            name: combinedName,
            mediaKind,
            text: combinedText,
            tags: combinedTags,
            messageContent,
        };
        
        // Check if there's enough context - RELAXED: name + any other content is enough
        const hasContent = cardContext.text || cardContext.messageContent || cardContext.tags.length > 0;
        const hasName = cardContext.name && cardContext.name !== 'Untitled';
        
        if (!hasContent && !hasName) {
            setImageGenError('Not enough context to generate an image. Add some text, tags, or a title.');
            setImageGenState('error');
            setTimeout(() => setImageGenState('idle'), 3000);
            return;
        }
        
        // Get existing image set for series continuation
        const currentImageSet = getImageSet(selected);
        const imageNumber = currentImageSet.images.length + 1;
        const lastImage = currentImageSet.images[currentImageSet.images.length - 1];
        
        // Build series context if this is a continuation
        const seriesContext = imageNumber > 1 && lastImage ? {
            imageNumber,
            previousPrompt: lastImage.craftedPrompt,
            previousImagePath: lastImage.localPath,
        } : undefined;
        
        try {
            setImageGenState('crafting');
            setImageGenError(null);
            
            // Small delay for UX - show "crafting" state
            await new Promise(r => setTimeout(r, 500));
            setImageGenState('generating');
            
            console.log('[ImageGen] Generating image #', imageNumber, seriesContext ? '(series continuation)' : '(first image)');
            
            const result = await window.electronAPI.generateImageForCard({ 
                cardContext, 
                seriesContext,
                provider: imageProvider 
            });
            
            if (result.success && result.localPath) {
                // ============================================================
                // NEW TAXONOMY: Create a separate Image Card for each generated image
                // ============================================================
                
                const imageCardId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const now = new Date().toISOString();
                
                // 1. Create Image Card record
                const imageCardRecord = {
                    id: imageCardId,
                    type: 'card',
                    mediaType: 'image',
                    subType: 'generated',
                    
                    // Relationships
                    parentId: selected.cardId,
                    children: [], // Can have loop videos, upscaled versions, etc.
                    
                    // Content
                    title: `${cardContext.name} - Image #${imageNumber}`,
                    
                    // File storage
                    wormhole: {
                        ingest: {
                            originalPath: result.localPath,
                            mimeType: result.mimeType,
                        }
                    },
                    
                    // Generation metadata
                    generationPrompt: result.craftedPrompt,
                    generationModel: imageProvider,
                    generationIndex: imageNumber,
                    seriesContext: seriesContext ? {
                        previousPrompt: seriesContext.previousPrompt,
                        continuationOf: lastImage?.id,
                    } : undefined,
                    
                    // Standard fields
                    tags: ['generated', 'ai-image', ...(cardContext.tags?.slice(0, 5) || [])],
                    createdAt: now,
                    updatedAt: now,
                };
                
                console.log('[ImageGen] Creating Image Card:', imageCardId);
                
                // 2. Create Hypercore for the Image Card
                try {
                    await window.electronAPI.p2pCreateCore(imageCardId);
                    await window.electronAPI.p2pAppend({
                        name: imageCardId,
                        data: JSON.stringify(imageCardRecord)
                    });
                    console.log('[ImageGen] Image Card saved to Hypercore:', imageCardId);
                } catch (err) {
                    console.error('[ImageGen] Failed to create Image Card Hypercore:', err);
                }
                
                // 3. Update PARENT card's children array
                const parentCoreName = selected.coreName || selected.cardId;
                const existingChildren = selected.cardRecord?.children || [];
                
                // Read latest parent record
                let parentLatest = selected.cardRecord || {};
                try {
                    const parentRecords = await window.electronAPI.p2pRead(parentCoreName);
                    for (const r of parentRecords) {
                        try {
                            const parsed = JSON.parse(r);
                            if (parsed) parentLatest = parsed;
                        } catch { }
                    }
                } catch { }
                
                const updatedParentRecord = {
                    ...parentLatest,
                    children: [
                        ...(parentLatest.children || []),
                        {
                            cardId: imageCardId,
                            type: 'image',
                            label: `Image #${imageNumber}`,
                            imageUrl: `file:///${result.localPath.replace(/\\/g, '/')}`,
                            createdAt: now,
                        }
                    ],
                    updatedAt: now,
                    // Set first image as thumbnail if none exists
                    thumbnail: parentLatest.thumbnail || `file:///${result.localPath.replace(/\\/g, '/')}`,
                };
                
                try {
                    await window.electronAPI.p2pAppend({
                        name: parentCoreName,
                        data: JSON.stringify(updatedParentRecord)
                    });
                    console.log('[ImageGen] Parent card updated with child reference');
                } catch (err) {
                    console.error('[ImageGen] Failed to update parent card:', err);
                }
                
                // 4. Add Image Card to library index
                try {
                    await window.electronAPI.p2pCreateCore(CARD_LIBRARY_CORE_NAME);
                    await window.electronAPI.p2pAppend({
                        name: CARD_LIBRARY_CORE_NAME,
                        data: JSON.stringify({
                            type: 'card-index',
                            cardId: imageCardId,
                            coreName: imageCardId,
                            name: imageCardRecord.title,
                            mediaKind: 'image',
                            subType: 'generated',
                            thumbnail: `file:///${result.localPath.replace(/\\/g, '/')}`,
                            createdAt: now,
                            parentCardId: selected.cardId,
                        })
                    });
                    console.log('[ImageGen] Image Card added to library index');
                } catch (err) {
                    console.error('[ImageGen] Failed to add to library index:', err);
                }
                
                setImageGenState('complete');
                
                // Reload cards to show the new image card
                await loadCards(selected.cardId);
                
                setTimeout(() => setImageGenState('idle'), 2000);
            }
        } catch (err: any) {
            console.error('[ImageGen] Error:', err);
            setImageGenError(err?.message || 'Failed to generate image');
            setImageGenState('error');
            setTimeout(() => setImageGenState('idle'), 4000);
        }
    };
    
    // Set hero image for a card
    const handleSetHeroImage = async (imageIndex: number) => {
        if (!selected) return;
        
        const currentImageSet = getImageSet(selected);
        if (imageIndex < 0 || imageIndex >= currentImageSet.images.length) return;
        
        const updatedImageSet = {
            ...currentImageSet,
            heroIndex: imageIndex,
        };
        
        const heroImage = currentImageSet.images[imageIndex];
        const updatedRecord = {
            ...selected.cardRecord,
            updatedAt: new Date().toISOString(),
            imageSet: updatedImageSet,
            // Update legacy image field to point to new hero
            image: {
                localPath: heroImage?.localPath,
                mimeType: heroImage?.mimeType,
                generatedPrompt: heroImage?.craftedPrompt,
                generatedAt: heroImage?.generatedAt,
            },
        };
        
        const coreToUse = selected.coreName || selected.cardId;
        if (window.electronAPI?.p2pAppend && coreToUse) {
            try {
                await window.electronAPI.p2pAppend({ 
                    name: coreToUse, 
                    data: JSON.stringify(updatedRecord) 
                });
                await loadCards(selected.cardId);
            } catch (err) {
                console.error('[ImageGen] Failed to set hero:', err);
            }
        }
    };
    
    // Move image in display order
    const handleMoveImage = async (imageIndex: number, direction: 'up' | 'down') => {
        if (!selected) return;
        
        const currentImageSet = getImageSet(selected);
        const displayOrder = [...currentImageSet.displayOrder];
        const currentPos = displayOrder.indexOf(imageIndex);
        
        if (currentPos === -1) return;
        const newPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
        if (newPos < 0 || newPos >= displayOrder.length) return;
        
        // Swap positions
        [displayOrder[currentPos], displayOrder[newPos]] = [displayOrder[newPos], displayOrder[currentPos]];
        
        const updatedRecord = {
            ...selected.cardRecord,
            updatedAt: new Date().toISOString(),
            imageSet: {
                ...currentImageSet,
                displayOrder,
            },
        };
        
        const coreToUse = selected.coreName || selected.cardId;
        if (window.electronAPI?.p2pAppend && coreToUse) {
            try {
                await window.electronAPI.p2pAppend({ 
                    name: coreToUse, 
                    data: JSON.stringify(updatedRecord) 
                });
                await loadCards(selected.cardId);
            } catch (err) {
                console.error('[ImageGen] Failed to reorder:', err);
            }
        }
    };
    
    // Check if card has any images
    const cardHasImage = (card: CardIndexEntry): boolean => {
        const imageSet = getImageSet(card);
        return imageSet.images.length > 0 || !!(card.thumbnail || card.mediaLocalPath);
    };
    
    // Get image count for a card
    const getImageCount = (card: CardIndexEntry): number => {
        return getImageSet(card).images.length;
    };
    
    // Create looping video from an image
    const handleCreateLoopVideo = async (imgIdx: number) => {
        if (!selected || !window.electronAPI?.createLoopVideoForImage) return;
        
        const imageSet = getImageSet(selected);
        const img = imageSet.images[imgIdx];
        if (!img) return;
        
        // Set generating status
        setLoopGenStatus(prev => ({
            ...prev,
            [img.id]: { status: 'generating', message: 'Starting loop generation...' },
        }));
        
        try {
            // NEW TAXONOMY: If image is a card, use its cardId as parent
            // The loop video's parent should be the IMAGE card, not the source document
            const loopParentCardId = img.isCard && img.cardId ? img.cardId : selected.cardId;
            
            const result = await window.electronAPI.createLoopVideoForImage({
                parentCardId: loopParentCardId,
                imageId: img.id,
                imagePath: img.localPath,
                originalPrompt: img.craftedPrompt || '',
                cardName: img.isCard ? (img.label || `Image #${img.creationOrder + 1}`) : (selected.name || 'Untitled'),
                imageOrder: img.creationOrder,
            });
            
            if (result.success) {
                const now = new Date().toISOString();
                
                // NEW TAXONOMY: Update the IMAGE card's children array
                if (img.isCard && img.cardId) {
                    try {
                        // Read the image card
                        const imageCardRecords = await window.electronAPI.p2pRead(img.cardId);
                        let imageCardLatest: any = {};
                        for (const r of imageCardRecords) {
                            try {
                                const parsed = JSON.parse(r);
                                if (parsed) imageCardLatest = parsed;
                            } catch { }
                        }
                        
                        // Update with loop video child
                        const updatedImageCard = {
                            ...imageCardLatest,
                            children: [
                                ...(imageCardLatest.children || []),
                                {
                                    cardId: result.videoCardId,
                                    type: 'loop-video',
                                    label: 'Loop Video',
                                    createdAt: now,
                                }
                            ],
                            updatedAt: now,
                        };
                        
                        await window.electronAPI.p2pAppend({
                            name: img.cardId,
                            data: JSON.stringify(updatedImageCard),
                        });
                        console.log('[LoopVideo] Updated Image Card with loop video child');
                    } catch (err) {
                        console.error('[LoopVideo] Failed to update Image Card:', err);
                    }
                }
                
                // LEGACY: Update the source card's imageSet
                else {
                    const updatedImages = [...imageSet.images];
                    updatedImages[imgIdx] = {
                        ...img,
                        loopVideo: {
                            cardId: result.videoCardId,
                            localPath: result.videoPath,
                            generatedAt: now,
                            status: 'complete' as const,
                        },
                    };
                    
                    const updatedRecord = {
                        ...selected.cardRecord,
                        updatedAt: now,
                        imageSet: {
                            ...imageSet,
                            images: updatedImages,
                        },
                    };
                    
                    // Save to Hypercore
                    const coreToUse = selected.coreName || selected.cardId;
                    if (window.electronAPI?.p2pAppend && coreToUse) {
                        await window.electronAPI.p2pAppend({
                            name: coreToUse,
                            data: JSON.stringify(updatedRecord),
                        });
                    }
                }
                
                // Reload cards
                await loadCards(selected.cardId);
                
                setLoopGenStatus(prev => ({
                    ...prev,
                    [img.id]: { status: 'complete', message: 'Loop video created!' },
                }));
            }
        } catch (err: any) {
            console.error('[LoopVideo] Error:', err);
            setLoopGenStatus(prev => ({
                ...prev,
                [img.id]: { status: 'error', message: err?.message || 'Failed to create loop' },
            }));
        }
    };
    
    // Create loop video directly from an Image Card (new taxonomy)
    const handleCreateLoopVideoFromImageCard = async (imageCard: CardIndexEntry) => {
        if (!window.electronAPI?.createLoopVideoForImage) return;
        
        const imageId = imageCard.cardId;
        const imagePath = imageCard.cardRecord?.wormhole?.ingest?.originalPath || imageCard.mediaLocalPath || '';
        const imagePrompt = imageCard.cardRecord?.generationPrompt || '';
        const imageName = imageCard.name || imageCard.cardRecord?.title || 'Image';
        
        if (!imagePath) {
            console.error('[LoopVideo] No image path found for Image Card:', imageId);
            return;
        }
        
        // Set generating status
        setLoopGenStatus(prev => ({
            ...prev,
            [imageId]: { status: 'generating', message: 'Starting loop generation...' },
        }));
        
        try {
            const result = await window.electronAPI.createLoopVideoForImage({
                parentCardId: imageId, // Parent is the IMAGE card itself
                imageId: imageId,
                imagePath: imagePath,
                originalPrompt: imagePrompt,
                cardName: imageName,
                imageOrder: imageCard.cardRecord?.generationIndex || 0,
            });
            
            if (result.success) {
                const now = new Date().toISOString();
                
                // Update the Image Card's children array with loop video
                try {
                    const imageCardRecords = await window.electronAPI.p2pRead(imageId);
                    let imageCardLatest: any = {};
                    for (const r of imageCardRecords) {
                        try {
                            const parsed = JSON.parse(r);
                            if (parsed) imageCardLatest = parsed;
                        } catch { }
                    }
                    
                    const updatedImageCard = {
                        ...imageCardLatest,
                        children: [
                            ...(imageCardLatest.children || []),
                            {
                                cardId: result.videoCardId,
                                type: 'loop-video',
                                label: 'Loop Video',
                                videoPath: result.videoPath,
                                createdAt: now,
                            }
                        ],
                        updatedAt: now,
                    };
                    
                    await window.electronAPI.p2pAppend({
                        name: imageId,
                        data: JSON.stringify(updatedImageCard),
                    });
                    console.log('[LoopVideo] Updated Image Card with loop video child');
                } catch (err) {
                    console.error('[LoopVideo] Failed to update Image Card:', err);
                }
                
                // Reload to show the new video
                await loadCards(imageId);
                
                setLoopGenStatus(prev => ({
                    ...prev,
                    [imageId]: { status: 'complete', message: 'Loop video created!' },
                }));
            }
        } catch (err: any) {
            console.error('[LoopVideo] Error creating loop from Image Card:', err);
            setLoopGenStatus(prev => ({
                ...prev,
                [imageId]: { status: 'error', message: err?.message || 'Failed to create loop' },
            }));
        }
    };

    // Navigate to a loop video's card page
    const handleNavigateToLoopVideo = async (loopVideoCardId: string) => {
        console.log('[LoopVideo] Navigating to video card:', loopVideoCardId);
        
        // First check if already in current cards
        const videoCard = cards.find(c => c.cardId === loopVideoCardId);
        if (videoCard) {
            console.log('[LoopVideo] Found video card in current cards, selecting');
            setSelected(videoCard);
            return;
        }
        
        // Card not in current list - need to reload and find it
        console.log('[LoopVideo] Video card not in current list, reloading...');
        
        // Try to load the card directly from its core
        if (window.electronAPI?.p2pRead) {
            try {
                const records = await window.electronAPI.p2pRead(loopVideoCardId);
                if (Array.isArray(records) && records.length > 0) {
                    // Parse the most recent record
                    let cardRecord: any = null;
                    for (let i = records.length - 1; i >= 0; i--) {
                        try {
                            const parsed = JSON.parse(records[i]);
                            if (parsed) {
                                cardRecord = parsed;
                                break;
                            }
                        } catch { /* skip */ }
                    }
                    
                    if (cardRecord) {
                        console.log('[LoopVideo] Loaded video card record directly:', cardRecord);
                        const videoEntry: CardIndexEntry = {
                            cardId: loopVideoCardId,
                            name: cardRecord.name || 'Loop Video',
                            createdAt: cardRecord.createdAt || new Date().toISOString(),
                            mediaKind: cardRecord.mediaKind || 'video',
                            mediaLocalPath: cardRecord.mediaLocalPath,
                            coreName: loopVideoCardId,
                            parentCardId: cardRecord.parentCardId,
                            cardRecord: cardRecord,
                            raw: cardRecord,
                        };
                        setSelected(videoEntry);
                        return;
                    }
                }
            } catch (err) {
                console.error('[LoopVideo] Failed to load video card directly:', err);
            }
        }
        
        // Fallback: reload all cards with preference
        loadCards(loopVideoCardId);
    };

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, card: CardIndexEntry) => {
        setDraggedCard(card);
        e.dataTransfer.setData('text/plain', card.cardId);
        // Include full card data for cross-component drops (e.g., to Veo frame slots, Pet Portal)
        e.dataTransfer.setData('application/json', JSON.stringify({
            cardId: card.cardId,
            name: card.name,
            mediaKind: card.mediaKind,
            mediaLocalPath: card.mediaLocalPath,
            thumbnail: card.thumbnail,
            image: card.cardRecord?.image,
            coreName: card.coreName,
            // Pass full cardRecord to ensure PetPortal can reconstruct the pet config
            cardRecord: card.cardRecord,
            type: 'card-transfer'
        }));
        e.dataTransfer.effectAllowed = 'copyMove';
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
                tags: activeWorkspaceCard.cardRecord?.tags || [],
                isSpriteSeed: activeWorkspaceCard.cardRecord?.isSpriteSeed,
                localPath: activeWorkspaceCard.mediaLocalPath,
                generatedPrompt: activeWorkspaceCard.cardRecord?.sourceImage?.craftedPrompt || activeWorkspaceCard.cardRecord?.generatedPrompt
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
                        onUpdate={async () => {
                            if (window.electronAPI?.p2pRead) {
                                const coreName = activeWorkspaceCard.coreName || activeWorkspaceCard.cardId;
                                try {
                                    const records = await window.electronAPI.p2pRead(coreName);
                                    let latest: any = {};
                                    for (const r of records) {
                                        try {
                                            const p = JSON.parse(r);
                                            if (p.type === 'card') latest = p;
                                        } catch {}
                                    }
                                    setActiveWorkspaceCard(prev => prev ? ({ ...prev, cardRecord: latest }) : null);
                                    loadCards(); // Refresh grid as well
                                } catch (e) { console.error("Failed to refresh workspace card", e); }
                            }
                        }}
                    />
                </div>
            </PageContainer>
        );
    }

    return (
        <>
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
                    <rux-button
                        onClick={async () => {
                            if (!window.electronAPI?.pipelineRecoverCards) return;
                            try {
                                setLoading(true);
                                const result = await window.electronAPI.pipelineRecoverCards();
                                console.log('[Recovery]', result);
                                if (result.recovered > 0) {
                                    await loadCards();
                                }
                                alert(`Recovered ${result.recovered} cards. ${result.errors?.length || 0} errors.`);
                            } catch (err) {
                                console.error('Recovery failed:', err);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        icon="history"
                        secondary
                        size="small"
                        title="Recover orphaned Hell Week cards"
                    >
                        Recover
                    </rux-button>
                    <rux-button
                        onClick={() => setShow3DViewer(true)}
                        disabled={cards.length === 0}
                        icon="view-in-ar"
                        size="small"
                        className="bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50"
                    >
                        3D Nexus
                    </rux-button>
                </div>
            </div>

            {/* Active Set Filter Indicator */}
            {activeSet && (
                <div className="flex-none px-6 py-2 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border-b border-purple-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <rux-icon icon="folder-special" size="small" className="text-purple-400"></rux-icon>
                        <div>
                            <span className="text-xs text-purple-400 uppercase font-bold">Viewing Set:</span>
                            <span className="ml-2 text-sm text-white font-medium">{activeSet.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                            ({activeSetCardIds.length} cards{activeSetCardIds.length !== filteredCards.length ? `, showing ${filteredCards.length}` : ''})
                        </span>
                    </div>
                    <rux-button 
                        size="small" 
                        secondary 
                        icon="close" 
                        onClick={clearSetFilter}
                    >
                        Clear Filter
                    </rux-button>
                </div>
            )}

            {/* Card Sets Selector (when no set active) */}
            {!activeSet && cardSets.length > 0 && (
                <div className="flex-none px-6 py-2 bg-gray-800/30 border-b border-gray-700/50">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <span className="text-xs text-gray-500 uppercase font-mono flex-shrink-0">Sets:</span>
                        {cardSets.slice(0, 5).map((set) => (
                            <button
                                key={set.setId || set.mergedSetId}
                                onClick={() => {
                                    const id = set.setId || set.mergedSetId;
                                    setActiveSetId(id);
                                    setSearchParams({ setId: id });
                                }}
                                className="flex-shrink-0 px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 rounded text-xs text-gray-300 hover:text-white transition-all flex items-center gap-2"
                            >
                                <rux-icon icon={set.type === 'merged-set' ? 'folder' : 'style'} size="extra-small"></rux-icon>
                                <span className="max-w-[120px] truncate">{set.name}</span>
                                <span className="text-gray-500">{set.cardCount || set.cardIds?.length || '?'}</span>
                            </button>
                        ))}
                        {cardSets.length > 5 && (
                            <span className="text-xs text-gray-500">+{cardSets.length - 5} more</span>
                        )}
                    </div>
                </div>
            )}

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
                                {/* Tier Badge (Quality Bar) */}
                                <div 
                                    className={`absolute top-0 left-0 right-0 z-10 py-1 flex items-center justify-center text-[9px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm border-b border-white/10 ${quality.badgeClass}`} 
                                    data-tooltip={`${quality.tierLabel} • Score: ${quality.score}/13`}
                                    data-tooltip-tier={quality.tier}
                                    data-tooltip-pos="bottom"
                                >
                                    {quality.tierLabel}
                                </div>
                                {/* Child Count Badge */}
                                {(card.cardRecord?.childCardIds?.length > 0) && (
                                    <div 
                                        className="absolute top-7 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-bold"
                                        data-tooltip={`${card.cardRecord.childCardIds.length} extracted card${card.cardRecord.childCardIds.length > 1 ? 's' : ''}`}
                                    >
                                        <rux-icon icon="account-tree" size="extra-small"></rux-icon>
                                        {card.cardRecord.childCardIds.length}
                                    </div>
                                )}
                                {/* Has Parent Indicator */}
                                {card.cardRecord?.parentCardId && (
                                    <div 
                                        className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 text-purple-400"
                                        data-tooltip="Extracted from parent"
                                    >
                                        <rux-icon icon="link" size="extra-small"></rux-icon>
                                    </div>
                                )}
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
                                                <rux-icon 
                                                    icon={
                                                        card.mediaKind === 'video' ? 'videocam' : 
                                                        card.mediaKind === 'audio' ? 'audiotrack' : 
                                                        card.mediaKind === 'message' ? 'chat' : 
                                                        card.mediaKind === 'pet' ? 'pets' : 'image'
                                                    } 
                                                    size="extra-small" 
                                                    className={card.mediaKind === 'message' ? 'text-purple-500' : 'text-gray-600'}
                                                ></rux-icon>
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
                            {/* Overlay Header - with Quality Bar for Hell Week cards */}
                            {(() => {
                                const rec = selected.cardRecord || {};
                                const isHW = isHellWeekCard(selected);
                                const rarity = isHW ? getHellWeekRarity(rec.cardData?.stats?.type) : null;
                                
                                return (
                                    <div className="relative border-b border-gray-800 bg-gray-900/50">
                                        {/* Holographic glow for Hell Week cards */}
                                        {isHW && (
                                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-60" />
                                        )}
                                        
                                        {/* Quality Bar for Hell Week Cards */}
                                        {isHW && rarity && (
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 px-6 py-1 rounded-b-lg bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 border-x border-b border-gray-600 z-10">
                                                <span className={`text-xs font-bold tracking-widest ${rarity.color}`}>
                                                    {'★'.repeat(rarity.stars)}{'☆'.repeat(5 - rarity.stars)} {rarity.name}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className="p-6 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <rux-icon icon={isHW ? "auto-awesome" : "assignment"} size="small" className={isHW ? "text-cyan-400" : "text-purple-400"}></rux-icon>
                                                <span className="text-sm font-mono text-gray-400 uppercase tracking-widest">Card Inspector</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Lightbox button */}
                                                {(selected.thumbnail || selected.mediaLocalPath || rec.mediaPrompts?.generated_image_local) && (
                                                    <button
                                                        type="button"
                                                        aria-label="View full size image"
                                                        title="View full size"
                                                        onClick={() => setShowLightbox(true)}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-gray-700/50 rounded transition-colors"
                                                    >
                                                        <rux-icon icon="zoom-in" size="small"></rux-icon>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    aria-label="Close card inspector"
                                                    onClick={() => { setSelected(null); setShowLightbox(false); }}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors text-xl font-light"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

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
                                                {/* Parent Card Link */}
                                                {(selected.cardRecord?.parentCardId || selected.parentCardId) && (
                                                    <div className="col-span-2">
                                                        <div className="text-gray-500 mb-1">Parent Card</div>
                                                        <button
                                                            onClick={() => {
                                                                const parentId = selected.cardRecord?.parentCardId || selected.parentCardId;
                                                                const parentCard = cards.find(c => c.cardId === parentId);
                                                                if (parentCard) setSelected(parentCard);
                                                                else if (parentId) loadCards(parentId);
                                                            }}
                                                            className="text-cyan-400 hover:text-cyan-300 font-mono text-xs underline"
                                                        >
                                                            ← View Parent Card
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="col-span-2">
                                                    <div className="text-gray-500 mb-1">ID</div>
                                                    <div className="text-gray-300 font-mono break-all">{selected.cardId}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ========== HELL WEEK CARD SECTIONS ========== */}
                                    {isHellWeekCard(selected) && (
                                        <>
                                            {/* Stats Section */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const stats = generateHellWeekStats(rec.cardData?.name || selected.name);
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-cyan-400">
                                                                <rux-icon icon="bar-chart" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Stats</h3>
                                                            </div>
                                                            <div className="grid gap-2 bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                                                                {[
                                                                    { label: 'POWER', value: stats.power, color: 'bg-red-500' },
                                                                    { label: 'WISDOM', value: stats.wisdom, color: 'bg-blue-500' },
                                                                    { label: 'SPEED', value: stats.speed, color: 'bg-green-500' },
                                                                    { label: 'MAGIC', value: stats.magic, color: 'bg-purple-500' },
                                                                ].map(stat => (
                                                                    <div key={stat.label} className="flex items-center gap-3 text-xs">
                                                                        <span className="w-16 text-gray-400 font-mono">{stat.label}</span>
                                                                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                                            <div className={`h-full ${stat.color} transition-all duration-500`} style={{ width: `${stat.value}%` }} />
                                                                        </div>
                                                                        <span className="w-8 text-right text-gray-300 font-mono">{stat.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {/* Evolution State & Video Generation */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const hasImage = !!(rec.mediaPrompts?.generated_image_local || selected.thumbnail);
                                                const state = rec.state || 'blob';
                                                
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-emerald-400">
                                                                <rux-icon icon="timeline" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Evolution State</h3>
                                                            </div>
                                                            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className={`w-3 h-3 rounded-full ${hasImage ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`} />
                                                                    <span className="text-sm font-mono text-gray-300 uppercase">{state}</span>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <div className="flex-1 h-1.5 rounded-full bg-emerald-500" title="Blob Created" />
                                                                    <div className={`flex-1 h-1.5 rounded-full ${state !== 'blob' ? 'bg-emerald-500' : 'bg-gray-700'}`} title="Thor Sorted" />
                                                                    <div className={`flex-1 h-1.5 rounded-full ${hasImage ? 'bg-emerald-500' : 'bg-gray-700'}`} title="Image Generated" />
                                                                    <div className="flex-1 h-1.5 rounded-full bg-gray-700" title="Video Generated" />
                                                                    <div className={`flex-1 h-1.5 rounded-full ${state === 'committed' ? 'bg-emerald-500' : 'bg-gray-700'}`} title="Committed" />
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Video Generation Button */}
                                                            {hasImage && (
                                                                <button
                                                                    onClick={handleHellWeekVideoGenerate}
                                                                    disabled={hwVideoGenStatus === 'generating'}
                                                                    className={`w-full py-3 px-4 rounded-lg border flex items-center justify-center gap-2 text-sm font-mono transition-all ${
                                                                        hwVideoGenStatus === 'generating' 
                                                                            ? 'bg-purple-900/30 border-purple-500/50 text-purple-300 cursor-wait'
                                                                            : hwVideoGenStatus === 'complete'
                                                                                ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300'
                                                                                : hwVideoGenStatus === 'error'
                                                                                    ? 'bg-red-900/30 border-red-500/50 text-red-300'
                                                                                    : 'bg-purple-900/20 border-purple-500/30 text-purple-300 hover:bg-purple-900/40 hover:border-purple-500/50'
                                                                    }`}
                                                                >
                                                                    {hwVideoGenStatus === 'generating' ? (
                                                                        <>
                                                                            <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                                                            Generating Video Loop...
                                                                        </>
                                                                    ) : hwVideoGenStatus === 'complete' ? (
                                                                        <>
                                                                            <rux-icon icon="check-circle" size="small"></rux-icon>
                                                                            Video Generated!
                                                                        </>
                                                                    ) : hwVideoGenStatus === 'error' ? (
                                                                        <>
                                                                            <rux-icon icon="error" size="small"></rux-icon>
                                                                            Failed - Try Again
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <rux-icon icon="movie" size="small"></rux-icon>
                                                                            Generate Video Loop
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {/* Skills Section */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const skills = rec.cardData?.skills || [];
                                                if (skills.length === 0) return null;
                                                
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-amber-400">
                                                                <rux-icon icon="whatshot" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Skills</h3>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {skills.map((skill: any, i: number) => (
                                                                    <div key={i} className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                                                skill.type === 'Passive' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                                                            }`}>
                                                                                {skill.type || 'Passive'}
                                                                            </span>
                                                                            <span className="text-sm font-bold text-white">{skill.name}</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-400 leading-relaxed">{skill.description}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {/* Lore Section */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const lore = rec.cardData?.lore;
                                                if (!lore) return null;
                                                
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-pink-400">
                                                                <rux-icon icon="auto-stories" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Lore</h3>
                                                            </div>
                                                            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg p-4 border border-gray-700/50">
                                                                <p className="text-sm text-gray-300 leading-relaxed italic">"{lore}"</p>
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {/* Truth Analysis Section */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const truth = rec.truthAnalysis;
                                                if (!truth || (!truth.facts?.length && !truth.desires?.length)) return null;
                                                
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-orange-400">
                                                                <rux-icon icon="psychology" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Truth Analysis</h3>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {/* Facts */}
                                                                <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30">
                                                                    <div className="text-[10px] uppercase font-bold text-blue-400 mb-2 tracking-wider">Facts</div>
                                                                    <ul className="space-y-1">
                                                                        {(truth.facts || []).slice(0, 4).map((fact: string, i: number) => (
                                                                            <li key={i} className="text-xs text-gray-300 flex gap-2">
                                                                                <span className="text-blue-400">•</span>
                                                                                <span className="line-clamp-2">{fact}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                {/* Desires */}
                                                                <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-500/30">
                                                                    <div className="text-[10px] uppercase font-bold text-purple-400 mb-2 tracking-wider">Desires</div>
                                                                    <ul className="space-y-1">
                                                                        {(truth.desires || []).slice(0, 4).map((desire: string, i: number) => (
                                                                            <li key={i} className="text-xs text-gray-300 flex gap-2">
                                                                                <span className="text-purple-400">•</span>
                                                                                <span className="line-clamp-2">{desire}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {/* Provenance Section */}
                                            {(() => {
                                                const rec = selected.cardRecord || {};
                                                const prov = rec.provenance;
                                                if (!prov) return null;
                                                
                                                return (
                                                    <>
                                                        <div className="h-px bg-gray-800"></div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-teal-400">
                                                                <rux-icon icon="fingerprint" size="small"></rux-icon>
                                                                <h3 className="font-bold uppercase tracking-wider text-sm">Provenance</h3>
                                                            </div>
                                                            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 space-y-2 text-xs">
                                                                {prov.leo && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-500">LEO</span>
                                                                        <span className="text-gray-300 font-mono">{prov.leo.commonName || prov.leo.modelName}</span>
                                                                    </div>
                                                                )}
                                                                {prov.thor && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-500">THOR</span>
                                                                        <span className="text-gray-300 font-mono">{prov.thor.commonName || prov.thor.modelName}</span>
                                                                    </div>
                                                                )}
                                                                {prov.image && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-gray-500">IMAGE</span>
                                                                        <span className="text-gray-300 font-mono">{prov.image.commonName || prov.image.modelName}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </>
                                    )}

                                    {/* Loop Video Generation Details - Show for loop video cards */}
                                    {selected.cardRecord?.generationParams?.loopMode && (
                                        <>
                                            <div className="h-px bg-gray-800"></div>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-purple-400">
                                                    <rux-icon icon="loop" size="small"></rux-icon>
                                                    <h3 className="font-bold uppercase tracking-wider text-sm">Loop Video Details</h3>
                                                </div>
                                                
                                                {/* View Parent Image Card Button */}
                                                {selected.cardRecord?.parentCardId && (
                                                    <button
                                                        onClick={() => {
                                                            const parentCard = cards.find(c => c.cardId === selected.cardRecord?.parentCardId);
                                                            if (parentCard) {
                                                                setSelected(parentCard);
                                                            } else {
                                                                loadCards(selected.cardRecord?.parentCardId);
                                                            }
                                                        }}
                                                        className="w-full py-2 px-4 bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-500/50 rounded-lg flex items-center justify-center gap-2 text-cyan-300 transition-all"
                                                    >
                                                        <rux-icon icon="image" size="small"></rux-icon>
                                                        <span className="font-bold text-sm">← View Source Image Card</span>
                                                    </button>
                                                )}
                                                
                                                {/* Loop Prompt */}
                                                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                                                    <div className="text-[10px] uppercase font-bold text-purple-400 mb-2 tracking-wider">
                                                        AI-Crafted Motion Prompt
                                                    </div>
                                                    <p className="text-gray-300 text-sm leading-relaxed">
                                                        {selected.cardRecord?.generationParams?.loopPrompt || 'No prompt available'}
                                                    </p>
                                                </div>
                                                
                                                {/* Source Image Info */}
                                                {selected.cardRecord?.sourceImage && (
                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div>
                                                            <div className="text-gray-500 mb-1">Model</div>
                                                            <div className="text-gray-300 font-mono">
                                                                {selected.cardRecord?.generationParams?.model || 'Veo 3.1'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-gray-500 mb-1">Parent</div>
                                                            <div className="text-gray-300 font-mono truncate" title={selected.cardRecord?.parentCardId}>
                                                                {selected.cardRecord?.parentCardId?.slice(0, 20)}...
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Original Image Prompt */}
                                                {selected.cardRecord?.sourceImage?.craftedPrompt && (
                                                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                                        <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-wider">
                                                            Original Image Prompt
                                                        </div>
                                                        <p className="text-gray-400 text-sm leading-relaxed">
                                                            {selected.cardRecord?.sourceImage?.craftedPrompt}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* Image Card Details - Show for generated image cards */}
                                    {selected.mediaKind === 'image' && selected.cardRecord?.subType === 'generated' && (
                                        <>
                                            <div className="h-px bg-gray-800"></div>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-cyan-400">
                                                    <rux-icon icon="image" size="small"></rux-icon>
                                                    <h3 className="font-bold uppercase tracking-wider text-sm">Image Details</h3>
                                                </div>
                                                
                                                {/* Generation Prompt */}
                                                {selected.cardRecord?.generationPrompt && (
                                                    <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
                                                        <div className="text-[10px] uppercase font-bold text-cyan-400 mb-2 tracking-wider">
                                                            AI-Crafted Image Prompt
                                                        </div>
                                                        <p className="text-gray-300 text-sm leading-relaxed">
                                                            {selected.cardRecord?.generationPrompt}
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                {/* Generation Info */}
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div>
                                                        <div className="text-gray-500 mb-1">Model</div>
                                                        <div className="text-gray-300 font-mono">
                                                            {selected.cardRecord?.generationModel || 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500 mb-1">Series #</div>
                                                        <div className="text-gray-300 font-mono">
                                                            #{selected.cardRecord?.generationIndex || 1}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Create Loop Video Button / Status */}
                                                {(() => {
                                                    const hasLoopVideo = selected.cardRecord?.children?.some((c: any) => c.type === 'loop-video');
                                                    const loopStatus = loopGenStatus[selected.cardId];
                                                    const isGenerating = loopStatus?.status === 'generating';
                                                    
                                                    if (hasLoopVideo) {
                                                        // Already has loop video - show success state
                                                        return (
                                                            <div className="pt-2">
                                                                <div className="w-full py-3 px-4 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center justify-center gap-2 text-green-400">
                                                                    <rux-icon icon="check-circle" size="small"></rux-icon>
                                                                    <span className="font-bold uppercase text-sm tracking-wider">Loop Video Created</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    if (isGenerating) {
                                                        // Currently generating
                                                        return (
                                                            <div className="pt-2">
                                                                <div className="w-full py-3 px-4 bg-purple-900/40 border border-purple-500/50 rounded-lg flex items-center justify-center gap-2 text-purple-300 animate-pulse">
                                                                    <rux-icon icon="autorenew" size="small" className="animate-spin"></rux-icon>
                                                                    <span className="font-bold uppercase text-sm tracking-wider">Creating Loop Video...</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Show create button
                                                    return (
                                                        <div className="pt-2">
                                                            <button
                                                                onClick={() => handleCreateLoopVideoFromImageCard(selected)}
                                                                className="w-full py-3 px-4 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/50 rounded-lg flex items-center justify-center gap-2 text-purple-300 transition-all hover:border-purple-400"
                                                            >
                                                                <rux-icon icon="movie" size="small"></rux-icon>
                                                                <span className="font-bold uppercase text-sm tracking-wider">Create Loop Video</span>
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                                
                                                {/* Child Loop Videos */}
                                                {selected.cardRecord?.children?.filter((c: any) => c.type === 'loop-video').length > 0 && (
                                                    <div className="pt-4">
                                                        <div className="text-[10px] uppercase font-bold text-gray-500 mb-3 tracking-wider">
                                                            Derived Loop Videos
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {selected.cardRecord.children.filter((c: any) => c.type === 'loop-video').map((child: any) => (
                                                                <button
                                                                    key={child.cardId}
                                                                    onClick={() => {
                                                                        const videoCard = cards.find(c => c.cardId === child.cardId);
                                                                        if (videoCard) setSelected(videoCard);
                                                                        else loadCards(child.cardId);
                                                                    }}
                                                                    className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg text-left hover:bg-purple-900/40 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-2 text-purple-300">
                                                                        <rux-icon icon="loop" size="extra-small"></rux-icon>
                                                                        <span className="text-xs font-mono truncate">{child.label || 'Loop Video'}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    <div className="h-px bg-gray-800"></div>

                                    {/* AI Image Generation Panel */}
                                    {(() => {
                                        const imageSet = getImageSet(selected);
                                        const imageCount = imageSet.images.length;
                                        return (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-cyan-400">
                                                        <rux-icon icon="auto-awesome" size="small"></rux-icon>
                                                        <h3 className="font-bold uppercase tracking-wider text-sm">
                                                            AI Images {imageCount > 0 && <span className="text-gray-500">({imageCount})</span>}
                                                        </h3>
                                                    </div>
                                                </div>
                                                
                                                {/* Image Gallery - Show if images exist */}
                                                {imageCount > 0 && (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {imageSet.displayOrder.map((imgIdx, displayPos) => {
                                                            const img = imageSet.images[imgIdx];
                                                            if (!img) return null;
                                                            const isHero = imgIdx === imageSet.heroIndex;
                                                            
                                                            // Check for loop video (supports both new and legacy)
                                                            // NEW TAXONOMY: Look up Image Card's children for loop-video
                                                            let hasLoop = img.loopVideo?.status === 'complete';
                                                            let loopVideoPath = img.loopVideo?.localPath;
                                                            
                                                            if (img.isCard && img.cardId) {
                                                                const imageCard = cards.find(c => c.cardId === img.cardId);
                                                                const loopChild = imageCard?.cardRecord?.children?.find((c: any) => c.type === 'loop-video');
                                                                if (loopChild) {
                                                                    hasLoop = true;
                                                                    loopVideoPath = loopChild.videoPath;
                                                                }
                                                            }
                                                            
                                                            const loopStatus = loopGenStatus[img.id] || loopGenStatus[img.cardId];
                                                            const isGeneratingLoop = loopStatus?.status === 'generating' || loopStatus?.status === 'crafted';
                                                            const isHovered = hoveredImageId === img.id;
                                                            
                                                            return (
                                                                <div 
                                                                    key={img.id || imgIdx}
                                                                    className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                                        isGeneratingLoop
                                                                            ? 'border-purple-500 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                                                            : hasLoop
                                                                                ? 'has-loop-video'
                                                                                : isHero 
                                                                                    ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                                                                                    : 'border-gray-700 hover:border-cyan-500/50'
                                                                    }`}
                                                                    onMouseEnter={() => setHoveredImageId(img.id)}
                                                                    onMouseLeave={() => setHoveredImageId(null)}
                                                                    onClick={() => {
                                                                        // NEW TAXONOMY: Navigate to Image Card if it's a card
                                                                        if (img.isCard && img.cardId) {
                                                                            const imageCard = cards.find(c => c.cardId === img.cardId);
                                                                            if (imageCard) {
                                                                                setSelected(imageCard);
                                                                            } else {
                                                                                // Card not in local list, try to load it
                                                                                loadCards(img.cardId);
                                                                            }
                                                                        }
                                                                        // LEGACY: Navigate to loop video if exists
                                                                        else if (hasLoop && img.loopVideo?.cardId) {
                                                                            handleNavigateToLoopVideo(img.loopVideo.cardId);
                                                                        }
                                                                    }}
                                                                >
                                                                    {/* Base Image */}
                                                                    <img 
                                                                        src={img.imageUrl || toFileUrl(img.localPath)} 
                                                                        alt={`Image #${img.creationOrder + 1}`}
                                                                        className={`w-full h-full object-cover transition-opacity ${
                                                                            hasLoop && isHovered ? 'opacity-0' : 'opacity-100'
                                                                        }`}
                                                                    />
                                                                    
                                                                    {/* Loop Video Preview on Hover */}
                                                                    {hasLoop && loopVideoPath && isHovered && (
                                                                        <video
                                                                            src={toFileUrl(loopVideoPath)}
                                                                            autoPlay
                                                                            loop
                                                                            muted
                                                                            playsInline
                                                                            preload="metadata"
                                                                            className="absolute inset-0 w-full h-full object-cover"
                                                                        />
                                                                    )}
                                                                    
                                                                    {/* Loop Video Badge */}
                                                                    {hasLoop && (
                                                                        <div className="absolute top-1 right-1 bg-purple-500 text-white text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                            <rux-icon icon="loop" size="extra-small"></rux-icon>
                                                                            LOOP
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Generating Loop Overlay */}
                                                                    {isGeneratingLoop && (
                                                                        <div className="absolute inset-0 bg-purple-900/70 flex flex-col items-center justify-center">
                                                                            <rux-icon icon="autorenew" size="small" className="animate-spin text-purple-300"></rux-icon>
                                                                            <span className="text-[8px] text-purple-200 mt-1">
                                                                                {loopStatus?.progress ? `${loopStatus.progress}%` : 'Creating...'}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Hero badge */}
                                                                    {isHero && (
                                                                        <div className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                            <rux-icon icon="star" size="extra-small"></rux-icon>
                                                                            HERO
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Creation order badge */}
                                                                    <div className="absolute bottom-1 right-1 bg-black/70 text-gray-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
                                                                        #{img.creationOrder + 1}
                                                                    </div>
                                                                    
                                                                    {/* Image Card indicator */}
                                                                    {img.isCard && (
                                                                        <div className="absolute bottom-1 left-1 bg-cyan-500/80 text-white text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
                                                                            <rux-icon icon="open-in-new" size="extra-small"></rux-icon>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* Hover controls */}
                                                                    {!isGeneratingLoop && (
                                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                                                            {/* View Image Card Button (new taxonomy) */}
                                                                            {img.isCard && img.cardId && (
                                                                                <button
                                                                                    onClick={(e) => { 
                                                                                        e.stopPropagation(); 
                                                                                        const imageCard = cards.find(c => c.cardId === img.cardId);
                                                                                        if (imageCard) setSelected(imageCard);
                                                                                        else loadCards(img.cardId);
                                                                                    }}
                                                                                    className="p-1.5 bg-cyan-500/30 hover:bg-cyan-500/50 rounded text-cyan-300"
                                                                                    title="View Image Card"
                                                                                >
                                                                                    <rux-icon icon="open-in-new" size="extra-small"></rux-icon>
                                                                                </button>
                                                                            )}
                                                                            {/* Create Loop Button */}
                                                                            {!hasLoop && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleCreateLoopVideo(imgIdx); }}
                                                                                    className="p-1.5 bg-purple-500/30 hover:bg-purple-500/50 rounded text-purple-300"
                                                                                    title="Create Loop Video"
                                                                                >
                                                                                    <rux-icon icon="movie" size="extra-small"></rux-icon>
                                                                                </button>
                                                                            )}
                                                                            {!isHero && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleSetHeroImage(imgIdx); }}
                                                                                    className="p-1.5 bg-amber-500/20 hover:bg-amber-500/40 rounded text-amber-400"
                                                                                    title="Set as Hero"
                                                                                >
                                                                                    <rux-icon icon="star" size="extra-small"></rux-icon>
                                                                                </button>
                                                                            )}
                                                                            {displayPos > 0 && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleMoveImage(imgIdx, 'up'); }}
                                                                                    className="p-1.5 bg-gray-500/20 hover:bg-gray-500/40 rounded text-gray-300"
                                                                                    title="Move Left"
                                                                                >
                                                                                    <rux-icon icon="chevron-left" size="extra-small"></rux-icon>
                                                                                </button>
                                                                            )}
                                                                            {displayPos < imageCount - 1 && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleMoveImage(imgIdx, 'down'); }}
                                                                                    className="p-1.5 bg-gray-500/20 hover:bg-gray-500/40 rounded text-gray-300"
                                                                                    title="Move Right"
                                                                                >
                                                                                    <rux-icon icon="chevron-right" size="extra-small"></rux-icon>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                
                                                {/* Provider Selector */}
                                                <div className="flex gap-2 mb-2 bg-gray-900/50 p-1 rounded-lg">
                                                    <button
                                                        onClick={() => setImageProvider('gemini')}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${
                                                            imageProvider === 'gemini' 
                                                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        Gemini (Cloud)
                                                    </button>
                                                    <button
                                                        onClick={() => setImageProvider('local-vision')}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1 ${
                                                            imageProvider === 'local-vision' 
                                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        Local Vision
                                                        {imageProvider !== 'local-vision' && localVisionStatus.running && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                        )}
                                                    </button>
                                                </div>
                                                
                                                {/* Local Vision Status Warning */}
                                                {imageProvider === 'local-vision' && !localVisionStatus.running && (
                                                    <div className="mb-2 px-2 py-1.5 bg-red-900/20 border border-red-500/30 rounded text-[10px] text-red-300 flex items-center gap-2">
                                                        <rux-icon icon="warning" size="extra-small"></rux-icon>
                                                        {/* Assuming Link is available, or use window.location */}
                                                        <span>Server offline. Check Local Vision settings.</span>
                                                    </div>
                                                )}

                                                {/* Generate Button */}
                                                <button
                                                    onClick={handleGenerateImage}
                                                    disabled={
                                                        (imageGenState !== 'idle' && imageGenState !== 'error') ||
                                                        (imageProvider === 'local-vision' && !localVisionStatus.running)
                                                    }
                                                    className={`w-full p-4 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-3 ${
                                                        imageGenState === 'complete'
                                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                            : imageGenState === 'error'
                                                                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                                                : imageGenState === 'crafting' || imageGenState === 'generating'
                                                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 animate-neon-pulse'
                                                                    : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                                                    }`}
                                                >
                                                    {imageGenState === 'crafting' ? (
                                                        <>
                                                            <rux-icon icon="psychology" size="small" className="animate-pulse"></rux-icon>
                                                            <span className="text-sm font-bold uppercase tracking-wider">Crafting Vision...</span>
                                                        </>
                                                    ) : imageGenState === 'generating' ? (
                                                        <>
                                                            <rux-icon icon="brush" size="small" className="animate-spin"></rux-icon>
                                                            <span className="text-sm font-bold uppercase tracking-wider">Manifesting #{imageCount + 1}...</span>
                                                        </>
                                                    ) : imageGenState === 'complete' ? (
                                                        <>
                                                            <rux-icon icon="check-circle" size="small"></rux-icon>
                                                            <span className="text-sm font-bold uppercase tracking-wider">Image #{imageCount} Created!</span>
                                                        </>
                                                    ) : imageGenState === 'error' ? (
                                                        <>
                                                            <rux-icon icon="error" size="small"></rux-icon>
                                                            <span className="text-xs">{imageGenError || 'Generation failed'}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <rux-icon icon="auto-awesome" size="small"></rux-icon>
                                                            <span className="text-sm font-bold uppercase tracking-wider">
                                                                {imageCount > 0 ? `Generate Next Image (#${imageCount + 1})` : 'Create Image'}
                                                            </span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    <div className="h-px bg-gray-800"></div>

                                    {/* Extraction Panel - Only for video cards */}
                                    {selected.mediaKind === 'video' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-purple-400">
                                                <rux-icon icon="content-cut" size="small"></rux-icon>
                                                <h3 className="font-bold uppercase tracking-wider text-sm">Extract Media</h3>
                                            </div>
                                            <div className="flex gap-3">
                                                {(['first-frame', 'last-frame', 'audio'] as const).map((extractType) => {
                                                    const isExtracting = extracting[`${selected.cardId}-${extractType}`];
                                                    const isDone = hasExtractionChild(selected, extractType);
                                                    const config = {
                                                        'first-frame': { icon: 'first-page', label: 'First Frame' },
                                                        'last-frame': { icon: 'last-page', label: 'Last Frame' },
                                                        'audio': { icon: 'audiotrack', label: 'Audio' }
                                                    }[extractType];
                                                    
                                                    return (
                                                        <button
                                                            key={extractType}
                                                            onClick={() => handleExtract(extractType)}
                                                            disabled={isExtracting || isDone}
                                                            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                                                                isDone
                                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                                    : isExtracting
                                                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                                                        : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 animate-extract-pulse'
                                                            }`}
                                                            data-tooltip={isDone ? 'Already extracted' : isExtracting ? 'Extracting...' : `Extract ${config.label}`}
                                                        >
                                                            <rux-icon icon={isDone ? 'check' : config.icon} size="small"></rux-icon>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                                {isDone ? 'Done' : isExtracting ? 'Working...' : config.label}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lineage Panel */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-cyan-400">
                                            <rux-icon icon="account-tree" size="small"></rux-icon>
                                            <h3 className="font-bold uppercase tracking-wider text-sm">Card Lineage</h3>
                                        </div>
                                        
                                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 space-y-4">
                                            {/* Parent Card */}
                                            {(() => {
                                                const parent = getParentCard(selected);
                                                const parentThumb = parent ? getMiniThumbnailSrc(parent) : null;
                                                return parent ? (
                                                    <div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Parent</div>
                                                        <button
                                                            onClick={() => navigateToCard(parent, 'parent')}
                                                            className="w-full flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group"
                                                        >
                                                            <div className="w-16 h-16 rounded overflow-hidden border border-gray-700 flex-shrink-0 bg-gray-800">
                                                                {parentThumb ? (
                                                                    <img src={parentThumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                                ) : parent.mediaKind === 'video' && parent.mediaLocalPath ? (
                                                                    <video src={toFileUrl(parent.mediaLocalPath)} className="w-full h-full object-cover" muted preload="metadata" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <rux-icon icon={parent.mediaKind === 'video' ? 'videocam' : parent.mediaKind === 'audio' ? 'audiotrack' : 'image'} size="small" className="text-gray-600"></rux-icon>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 text-left">
                                                                <div className="text-sm text-white group-hover:text-purple-300 truncate">
                                                                    {parent.name || 'Untitled'}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 uppercase">{parent.mediaKind}</div>
                                                            </div>
                                                            <rux-icon icon="arrow-upward" size="small" className="text-gray-500 group-hover:text-purple-400"></rux-icon>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-500">
                                                        <rux-icon icon="star" size="extra-small"></rux-icon>
                                                        <span className="text-xs">Original (No Parent)</span>
                                                    </div>
                                                );
                                            })()}

                                            {/* Children Cards */}
                                            {(() => {
                                                const children = getChildCards(selected);
                                                return children.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                                                            Children ({children.length})
                                                        </div>
                                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                                            {children.map(child => {
                                                                const childThumb = getMiniThumbnailSrc(child);
                                                                return (
                                                                <button
                                                                    key={child.cardId}
                                                                    onClick={() => navigateToCard(child, 'child')}
                                                                    className="flex-shrink-0 flex flex-col items-center gap-1 p-2 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all group"
                                                                >
                                                                    <div className="w-14 h-14 rounded overflow-hidden border border-gray-700 bg-gray-800">
                                                                        {childThumb ? (
                                                                            <img src={childThumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                <rux-icon 
                                                                                    icon={child.mediaKind === 'audio' ? 'audiotrack' : 'image'} 
                                                                                    size="small" 
                                                                                    className="text-gray-600"
                                                                                ></rux-icon>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[9px] text-gray-400 truncate max-w-[60px] group-hover:text-cyan-300">
                                                                        {child.cardRecord?.extractionSource?.type || child.mediaKind}
                                                                    </span>
                                                                </button>
                                                            );})}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Siblings */}
                                            {(() => {
                                                const siblings = getSiblingCards(selected);
                                                return siblings.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                                                            Siblings ({siblings.length})
                                                        </div>
                                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                                            {siblings.map(sibling => {
                                                                const siblingThumb = getMiniThumbnailSrc(sibling);
                                                                return (
                                                                <button
                                                                    key={sibling.cardId}
                                                                    onClick={() => navigateToCard(sibling, 'sibling')}
                                                                    className="flex-shrink-0 flex flex-col items-center gap-1 p-2 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all group"
                                                                >
                                                                    <div className="w-12 h-12 rounded overflow-hidden border border-gray-700 bg-gray-800">
                                                                        {siblingThumb ? (
                                                                            <img src={siblingThumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                <rux-icon 
                                                                                    icon={sibling.mediaKind === 'audio' ? 'audiotrack' : 'image'} 
                                                                                    size="extra-small" 
                                                                                    className="text-gray-600"
                                                                                ></rux-icon>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[9px] text-gray-400 truncate max-w-[50px] group-hover:text-pink-300">
                                                                        {sibling.cardRecord?.extractionSource?.type || sibling.mediaKind}
                                                                    </span>
                                                                </button>
                                                            );})}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
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

                                    {/* SCROLLS Section - Context documents for LLM analysis */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-amber-400">
                                                <rux-icon icon="description" size="small"></rux-icon>
                                                <h3 className="font-bold uppercase tracking-wider text-sm">Scrolls (Context)</h3>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!window.electronAPI?.getTextCardsForScroll) return;
                                                    try {
                                                        const textCards = await window.electronAPI.getTextCardsForScroll();
                                                        setAvailableScrollCards(textCards || []);
                                                        setShowScrollPicker(true);
                                                    } catch (e) {
                                                        console.error('Failed to load text cards:', e);
                                                    }
                                                }}
                                                className="text-xs px-3 py-1 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-500/30 rounded text-amber-300 transition-colors"
                                            >
                                                + Attach Scroll
                                            </button>
                                        </div>
                                        
                                        {/* Attached Scrolls */}
                                        {selected.cardRecord?.scrolls && selected.cardRecord.scrolls.length > 0 ? (
                                            <div className="space-y-2">
                                                {selected.cardRecord.scrolls.map((scroll: any) => (
                                                    <div 
                                                        key={scroll.cardId}
                                                        className="flex items-center justify-between p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <rux-icon icon="text-snippet" size="extra-small" className="text-amber-300"></rux-icon>
                                                            <span className="text-sm text-amber-200 font-mono truncate max-w-[200px]">
                                                                {scroll.label || scroll.cardId}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.electronAPI?.detachCardScroll || !selected) return;
                                                                try {
                                                                    await window.electronAPI.detachCardScroll({
                                                                        cardId: selected.cardId,
                                                                        scrollCardId: scroll.cardId,
                                                                    });
                                                                    await loadCards(selected.cardId);
                                                                } catch (e: any) {
                                                                    setError(e?.message || 'Failed to detach scroll');
                                                                }
                                                            }}
                                                            className="text-red-400 hover:text-red-300 text-xs px-2"
                                                            title="Remove scroll"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 text-xs italic p-3 bg-gray-900/30 rounded-lg border border-gray-800">
                                                No scrolls attached. Attach a text/markdown card to provide context for AI analysis.
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
        
        {/* Lightbox Modal for Full-Screen Image View */}
        {showLightbox && selected && (
            <div 
                className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-zoom-out"
                onClick={() => setShowLightbox(false)}
            >
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
                        className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors"
                        title="Close lightbox"
                        aria-label="Close lightbox"
                    >
                        <rux-icon icon="close" size="small"></rux-icon>
                    </button>
                </div>
                <img 
                    src={(() => {
                        const rec = selected.cardRecord || {};
                        const imgPath = rec.mediaPrompts?.generated_image_local || selected.thumbnail || selected.mediaLocalPath;
                        return imgPath ? toFileUrl(imgPath) : '';
                    })()}
                    alt={selected.name}
                    className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full">
                    <span className="text-white font-mono text-sm">{selected.name}</span>
                </div>
            </div>
        )}
        
        {/* 3D Card Viewer */}
        {show3DViewer && (
            <Suspense fallback={
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-cyan-400 text-4xl mb-4 animate-pulse">◈</div>
                        <div className="text-cyan-300 font-mono">Loading Card Nexus...</div>
                    </div>
                </div>
            }>
                <Card3DViewer
                    cards={cards.map(c => ({
                        cardId: c.cardId,
                        name: c.name,
                        mediaKind: c.mediaKind,
                        thumbnail: c.thumbnail,
                        mediaLocalPath: c.mediaLocalPath,
                        parentCardId: c.parentCardId,
                        cardRecord: c.cardRecord,
                    }))}
                    focusedCardId={selected?.cardId}
                    onCardSelect={(cardId) => {
                        const card = cards.find(c => c.cardId === cardId);
                        if (card) setSelected(card);
                    }}
                    onClose={() => setShow3DViewer(false)}
                />
            </Suspense>
        )}
        
        {/* Scroll Picker Modal */}
        {showScrollPicker && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-6 w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                            <rux-icon icon="description" size="small"></rux-icon>
                            Attach Scroll
                        </h2>
                        <button
                            onClick={() => setShowScrollPicker(false)}
                            className="text-gray-400 hover:text-white text-xl"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-4">
                        Select a text or markdown card to attach as context for AI analysis.
                    </p>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {availableScrollCards.length === 0 ? (
                            <div className="text-gray-500 text-sm italic text-center py-8">
                                No text or markdown cards found in your library.
                            </div>
                        ) : (
                            availableScrollCards
                                .filter(sc => sc.cardId !== selected.cardId) // Don't show self
                                .filter(sc => !selected.cardRecord?.scrolls?.some((s: any) => s.cardId === sc.cardId)) // Don't show already attached
                                .map(scrollCard => (
                                    <button
                                        key={scrollCard.cardId}
                                        onClick={async () => {
                                            if (!window.electronAPI?.attachCardScroll || scrollAttaching) return;
                                            setScrollAttaching(true);
                                            try {
                                                await window.electronAPI.attachCardScroll({
                                                    cardId: selected.cardId,
                                                    scrollCardId: scrollCard.cardId,
                                                });
                                                await loadCards(selected.cardId);
                                                setShowScrollPicker(false);
                                            } catch (e: any) {
                                                setError(e?.message || 'Failed to attach scroll');
                                            } finally {
                                                setScrollAttaching(false);
                                            }
                                        }}
                                        disabled={scrollAttaching}
                                        className="w-full text-left p-3 bg-gray-800/50 hover:bg-amber-900/30 border border-gray-700 hover:border-amber-500/50 rounded-lg transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <rux-icon 
                                                icon={scrollCard.mediaType === 'markdown' ? 'article' : 'text-snippet'} 
                                                size="small" 
                                                className="text-amber-400"
                                            ></rux-icon>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-200 truncate font-mono">
                                                    {scrollCard.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {scrollCard.mediaType.toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))
                        )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                        <button
                            onClick={() => setShowScrollPicker(false)}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default CardLibrary;
