// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import type { RevidMediaItem } from '../types';

const RevidMedia: React.FC = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [mediaType, setMediaType] = useState<'all' | 'video' | 'image' | 'audio'>('video');
    const [topK, setTopK] = useState(20);
    const [results, setResults] = useState<RevidMediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloaded, setDownloaded] = useState<Record<string, { localPath: string; mimeType: string }>>({});
    const [creatingCardId, setCreatingCardId] = useState<string | null>(null);
    const [lastCreatedCardId, setLastCreatedCardId] = useState<string | null>(null);
    const [createdCards, setCreatedCards] = useState<Record<string, string>>({});

    const hasRevidSupport = !!window.electronAPI && !!window.electronAPI.revidSearchMedia;

    const handleOpenCard = (cardId: string) => {
        if (!cardId) return;
        navigate(`/cards?cardId=${encodeURIComponent(cardId)}`);
    };

    const handleSearch = async () => {
        if (!window.electronAPI || !window.electronAPI.revidSearchMedia) {
            setError('Revid media search is not available in this build.');
            return;
        }
        if (!query.trim()) {
            setError('Please enter a search query.');
            return;
        }
        setError(null);
        setLoading(true);
        setLastCreatedCardId(null);
        try {
            const response = await window.electronAPI.revidSearchMedia({
                search: query,
                mediaType,
                topK,
            });
            setResults(response?.results || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to search Revid media');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (item: RevidMediaItem) => {
        if (!window.electronAPI || !window.electronAPI.revidDownloadMedia) {
            setError('Revid media download is not available in this build.');
            return;
        }
        setError(null);
        try {
            const info = await window.electronAPI.revidDownloadMedia({
                mediaUrl: item.mediaUrl,
                id: item.id,
                type: item.type,
                fileType: item.fileType,
            });
            setDownloaded((prev) => ({
                ...prev,
                [item.id]: { localPath: info.localPath, mimeType: info.mimeType },
            }));
        } catch (e: any) {
            setError(e?.message || 'Failed to download Revid media');
        }
    };

    const createRevidCard = async (
        item: RevidMediaItem,
        download: { localPath: string; fileName: string; mimeType: string; size: number },
    ): Promise<string | null> => {
        if (
            !window.electronAPI ||
            !window.electronAPI.p2pCreateCore ||
            !window.electronAPI.p2pAppend
        ) {
            setError('Card creation requires the Electron P2P backend.');
            return null;
        }

        const createdAt = new Date().toISOString();
        const cardCoreName = `card-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        let mediaKind: 'video' | 'image' | 'audio';
        if (item.type === 'video') {
            mediaKind = 'video';
        } else if (item.type === 'audio') {
            mediaKind = 'audio';
        } else {
            mediaKind = 'image';
        }

        const coreInfo = await window.electronAPI.p2pCreateCore(cardCoreName);

        const base: any = {
            type: 'card',
            kind: mediaKind,
            id: cardCoreName,
            createdAt,
            source: 'revid-media-search',
            provider: 'revid',
            model: 'media-search',
            revid: {
                mediaId: item.id,
                uid: item.uid,
                prompt: item.prompt,
                mediaUrl: item.mediaUrl,
                imagePreview: item.imagePreview,
                fileType: item.fileType,
                type: item.type,
                orientation: item.orientation,
                item,
                download,
            },
            core: {
                name: cardCoreName,
                key: coreInfo?.key,
                discoveryKey: coreInfo?.discoveryKey,
                length: coreInfo?.length,
            },
        };

        const effectiveMime = download.mimeType || item.fileType || '';

        if (mediaKind === 'video') {
            base.video = {
                localPath: download.localPath,
                remoteUrl: item.mediaUrl,
                mimeType: effectiveMime,
                fileName: download.fileName,
                size: download.size,
            };
        } else if (mediaKind === 'audio') {
            base.audio = {
                localPath: download.localPath,
                remoteUrl: item.mediaUrl,
                mimeType: effectiveMime,
                fileName: download.fileName,
                size: download.size,
            };
        } else {
            base.image = {
                localPath: download.localPath,
                remoteUrl: item.mediaUrl,
                mimeType: effectiveMime,
                fileName: download.fileName,
                size: download.size,
            };
        }

        const cardRecord = base;

        await window.electronAPI.p2pAppend({
            name: cardCoreName,
            data: JSON.stringify(cardRecord),
        });

        const CARD_LIBRARY_CORE_NAME = 'card-library';
        await window.electronAPI.p2pCreateCore(CARD_LIBRARY_CORE_NAME);
        const libraryEntry: any = {
            type: 'card-index',
            cardId: cardCoreName,
            createdAt,
            provider: 'revid',
            model: 'media-search',
            coreName: cardCoreName,
            coreKey: coreInfo?.key,
            coreDiscoveryKey: coreInfo?.discoveryKey,
            thumbnail: item.imagePreview,
            mediaKind,
            fileType: item.fileType,
            revidMediaId: item.id,
        };

        await window.electronAPI.p2pAppend({
            name: CARD_LIBRARY_CORE_NAME,
            data: JSON.stringify(libraryEntry),
        });

        return cardCoreName;
    };

    const handleCreateCard = async (item: RevidMediaItem) => {
        if (!window.electronAPI || !window.electronAPI.revidDownloadMedia) {
            setError('Revid media download is not available in this build.');
            return;
        }
        if (
            !window.electronAPI.p2pCreateCore ||
            !window.electronAPI.p2pAppend
        ) {
            setError('Card creation requires the Electron P2P backend.');
            return;
        }
        if (creatingCardId) {
            return;
        }
        setError(null);
        setCreatingCardId(item.id);
        setLastCreatedCardId(null);
        try {
            const download = await window.electronAPI.revidDownloadMedia({
                mediaUrl: item.mediaUrl,
                id: item.id,
                type: item.type,
                fileType: item.fileType,
            });

            setDownloaded((prev) => ({
                ...prev,
                [item.id]: { localPath: download.localPath, mimeType: download.mimeType },
            }));

            const cardId = await createRevidCard(item, download);
            if (cardId) {
                setLastCreatedCardId(cardId);
                setCreatedCards((prev) => ({
                    ...prev,
                    [item.id]: cardId,
                }));
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to create Card from Revid media');
        } finally {
            setCreatingCardId(null);
        }
    };

    const renderPreview = (item: RevidMediaItem) => {
        if (item.type === 'image') {
            const src = item.imagePreview || item.mediaUrl;
            return (
                <img
                    src={src}
                    alt={item.prompt || item.id}
                    className="w-full h-48 object-cover bg-black/40 transition-transform duration-500 group-hover:scale-110"
                />
            );
        }
        if (item.type === 'video') {
            return (
                <video
                    src={item.mediaUrl}
                    controls
                    className="w-full h-48 object-cover bg-black"
                />
            );
        }
        if (item.type === 'audio') {
            return (
                <div className="w-full h-48 flex flex-col items-center justify-center bg-gray-900 border-b border-gray-800 px-4">
                    <div className="w-full mb-3 text-xs text-gray-300 text-center truncate font-mono">
                        {item.prompt || 'AUDIO ASSET'}
                    </div>
                    <audio controls src={item.mediaUrl} className="w-full h-8" />
                </div>
            );
        }
        return (
            <div className="w-full h-48 flex items-center justify-center bg-gray-900 text-xs text-gray-500 font-mono">
                NO PREVIEW
            </div>
        );
    };

    return (
        <PageContainer>
            <style>{`
                .glass-panel {
                    background: rgba(17, 24, 39, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .glass-panel:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .section-label {
                    font-size: 0.7rem;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(156, 163, 175, 0.8);
                    font-family: monospace;
                    margin-bottom: 0.5rem;
                }
                .input-base {
                    background: rgba(17, 24, 39, 0.4);
                    border: 1px solid rgba(75, 85, 99, 0.5);
                    color: white;
                    transition: all 0.2s;
                }
                .input-base:focus {
                    border-color: rgba(59, 130, 246, 0.5);
                    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
                    outline: none;
                }
                .btn-primary {
                    background: rgba(147, 51, 234, 0.2);
                    border: 1px solid rgba(147, 51, 234, 0.4);
                    color: #d8b4fe;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    background: rgba(147, 51, 234, 0.3);
                    border-color: rgba(147, 51, 234, 0.6);
                    color: #e9d5ff;
                }
                .btn-secondary {
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                    transition: all 0.2s;
                }
                .btn-secondary:hover {
                    background: rgba(59, 130, 246, 0.3);
                    border-color: rgba(59, 130, 246, 0.6);
                    color: #93c5fd;
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
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>

            <div className="w-full max-w-[1600px] mx-auto pb-24">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <rux-icon icon="perm-media" size="large"></rux-icon>
                            REVID MEDIA <span className="text-purple-400 text-lg font-mono font-normal opacity-80">// ASSET LIBRARY</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            SEARCH, PREVIEW, AND TRANSFORM MEDIA ASSETS INTO CARDS
                        </p>
                    </div>
                </div>

                {!hasRevidSupport && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 flex items-center gap-3">
                        <rux-icon icon="error" size="small"></rux-icon>
                        <span className="text-sm font-mono">REVID INTEGRATION UNAVAILABLE. CHECK ELECTRON SETTINGS.</span>
                    </div>
                )}

                {/* Search & Controls */}
                <div className="glass-panel p-6 rounded-xl mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60"></div>
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 w-full">
                            <label className="section-label">Search Query</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full rounded-lg pl-10 pr-4 py-3 input-base font-mono text-sm"
                                    placeholder="Search your Revid media (e.g. 'cyberpunk city')..."
                                />
                                <rux-icon icon="search" size="small" className="absolute left-3 top-3 text-gray-500"></rux-icon>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full md:w-auto">
                            <div className="w-32">
                                <label className="section-label">Media Type</label>
                                <select
                                    value={mediaType}
                                    onChange={(e) => setMediaType(e.target.value as any)}
                                    className="w-full rounded-lg px-3 py-3 input-base font-mono text-xs appearance-none"
                                >
                                    <option value="all">ALL</option>
                                    <option value="video">VIDEO</option>
                                    <option value="image">IMAGE</option>
                                    <option value="audio">AUDIO</option>
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="section-label">Limit</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={topK}
                                    onChange={(e) => {
                                        const value = Number(e.target.value) || 1;
                                        const clamped = Math.min(Math.max(value, 1), 100);
                                        setTopK(clamped);
                                    }}
                                    className="w-full rounded-lg px-3 py-3 input-base font-mono text-xs text-center"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleSearch}
                                disabled={loading || !hasRevidSupport}
                                className="btn-primary px-6 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none"
                            >
                                {loading ? <rux-icon icon="refresh" size="small" className="animate-spin"></rux-icon> : <rux-icon icon="search" size="small"></rux-icon>}
                                {loading ? 'SEARCHING...' : 'SEARCH'}
                            </button>
                            <button
                                onClick={() => {
                                    setQuery('');
                                    setResults([]);
                                    setError(null);
                                    setLastCreatedCardId(null);
                                }}
                                disabled={loading}
                                className="px-4 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-mono text-xs uppercase tracking-wider disabled:opacity-50"
                            >
                                CLEAR
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-8 font-mono text-xs">
                        ERROR: {error}
                    </div>
                )}
                {lastCreatedCardId && (
                    <div className="bg-green-900/20 border border-green-500/50 text-green-200 p-4 rounded-lg mb-8 font-mono text-xs flex items-center justify-between">
                        <span>CARD CREATED SUCCESSFULLY: {lastCreatedCardId}</span>
                        <button
                            onClick={() => handleOpenCard(lastCreatedCardId)}
                            className="text-green-400 hover:text-white underline"
                        >
                            VIEW CARD
                        </button>
                    </div>
                )}

                {/* Results Grid */}
                {results.length === 0 && !loading && !error ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-600 opacity-50">
                        <rux-icon icon="image-search" size="large" className="mb-4"></rux-icon>
                        <p className="font-mono text-sm">NO MEDIA LOADED. INITIATE A SEARCH.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {results.map((item) => {
                            const isDownloaded = !!downloaded[item.id];
                            const isCreatingCard = creatingCardId === item.id;
                            const cardIdForItem = createdCards[item.id];
                            const hasCard = !!cardIdForItem;

                            return (
                                <div key={item.id} className="glass-panel rounded-xl overflow-hidden group hover:border-purple-500/30 transition-all duration-300 flex flex-col">
                                    <div className="relative overflow-hidden">
                                        {renderPreview(item)}

                                        {/* Overlay Badges */}
                                        <div className="absolute top-2 left-2 flex gap-1">
                                            <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-[10px] font-mono uppercase text-white border border-white/10">
                                                {item.type}
                                            </span>
                                            {item.fileType && (
                                                <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-[10px] font-mono uppercase text-gray-300 border border-white/10">
                                                    {item.fileType}
                                                </span>
                                            )}
                                        </div>

                                        {/* Status Indicators */}
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                            {isDownloaded && (
                                                <span className="px-2 py-1 rounded bg-green-500/80 backdrop-blur text-[10px] font-mono uppercase text-white shadow-lg flex items-center gap-1">
                                                    <rux-icon icon="check" size="extra-small"></rux-icon> SAVED
                                                </span>
                                            )}
                                            {hasCard && (
                                                <span className="px-2 py-1 rounded bg-purple-500/80 backdrop-blur text-[10px] font-mono uppercase text-white shadow-lg flex items-center gap-1">
                                                    <rux-icon icon="style" size="extra-small"></rux-icon> CARD
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="mb-4 flex-1">
                                            <p className="text-xs text-gray-300 font-medium line-clamp-2 leading-relaxed" title={item.prompt || ''}>
                                                {item.prompt || 'Untitled Asset'}
                                            </p>
                                            <div className="mt-2 text-[10px] text-gray-500 font-mono">
                                                ID: {item.id.substring(0, 8)}...
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-800/50">
                                            <button
                                                onClick={() => handleDownload(item)}
                                                disabled={loading}
                                                className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-mono uppercase tracking-wide transition-colors flex items-center justify-center gap-1"
                                            >
                                                <rux-icon icon="download" size="extra-small"></rux-icon>
                                                {isDownloaded ? 'AGAIN' : 'SAVE'}
                                            </button>

                                            {hasCard && cardIdForItem ? (
                                                <button
                                                    onClick={() => handleOpenCard(cardIdForItem)}
                                                    className="px-3 py-2 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-mono uppercase tracking-wide transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <rux-icon icon="visibility" size="extra-small"></rux-icon>
                                                    VIEW
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleCreateCard(item)}
                                                    disabled={loading || isCreatingCard}
                                                    className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-mono uppercase tracking-wide transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                                >
                                                    {isCreatingCard ? (
                                                        <rux-icon icon="refresh" size="extra-small" className="animate-spin"></rux-icon>
                                                    ) : (
                                                        <rux-icon icon="add" size="extra-small"></rux-icon>
                                                    )}
                                                    {isCreatingCard ? '...' : 'CARD'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default RevidMedia;
