import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { PrimaryButton, SecondaryButton } from '../components/Button';
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
                    className="w-full h-40 object-cover rounded-lg bg-black/40"
                />
            );
        }
        if (item.type === 'video') {
            return (
                <video
                    src={item.mediaUrl}
                    controls
                    className="w-full h-40 rounded-lg bg-black"
                />
            );
        }
        if (item.type === 'audio') {
            return (
                <div className="w-full h-40 flex flex-col items-center justify-center rounded-lg bg-gray-900 border border-gray-700 px-3">
                    <div className="w-full mb-2 text-xs text-gray-300 text-center truncate">
                        {item.prompt || 'Audio from Revid'}
                    </div>
                    <audio controls src={item.mediaUrl} className="w-full" />
                </div>
            );
        }
        return (
            <div className="w-full h-40 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-xs text-gray-500">
                No preview
            </div>
        );
    };

    return (
        <PageContainer>
            <div className="w-full text-white">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold">Revid Media</h2>
                        <p className="text-sm text-gray-300 mt-1 max-w-2xl">
                            Search your Revid media library, preview results, download assets, and turn them into Cards in the Hapa Card Library.
                        </p>
                    </div>
                </div>

                {!hasRevidSupport && (
                    <p className="text-sm text-red-400 mb-4">
                        Revid media integration is not available. Make sure you are running the Electron app and have configured your Revid API key in Settings.
                    </p>
                )}

                {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
                {lastCreatedCardId && (
                    <p className="text-sm text-green-400 mb-4">
                        Card {lastCreatedCardId} created from Revid media. It is now available in the Card Library.
                    </p>
                )}

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1">
                            <label
                                htmlFor="revid-media-search-query"
                                className="block text-xs font-medium text-gray-300 mb-1"
                            >
                                Search query
                            </label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                id="revid-media-search-query"
                                placeholder="Search your Revid media (e.g. 'cat video')"
                            />
                        </div>
                        <div className="flex flex-row gap-3">
                            <div>
                                <label
                                    htmlFor="revid-media-type"
                                    className="block text-xs font-medium text-gray-300 mb-1"
                                >
                                    Media type
                                </label>
                                <select
                                    value={mediaType}
                                    onChange={(e) => setMediaType(e.target.value as any)}
                                    id="revid-media-type"
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm"
                                >
                                    <option value="all">All</option>
                                    <option value="video">Video</option>
                                    <option value="image">Image</option>
                                    <option value="audio">Audio</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="revid-media-topk"
                                    className="block text-xs font-medium text-gray-300 mb-1"
                                >
                                    Max results
                                </label>
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
                                    id="revid-media-topk"
                                    className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex flex-row gap-2">
                            <PrimaryButton
                                type="button"
                                tone="blue"
                                onClick={handleSearch}
                                disabled={loading || !hasRevidSupport}
                            >
                                {loading ? 'Searching…' : 'Search'}
                            </PrimaryButton>
                            <SecondaryButton
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    setResults([]);
                                    setError(null);
                                    setLastCreatedCardId(null);
                                }}
                                disabled={loading}
                            >
                                Clear
                            </SecondaryButton>
                        </div>
                    </div>
                </div>

                {results.length === 0 && !loading && !error && (
                    <p className="text-sm text-gray-400">
                        No media loaded yet. Run a search to see your Revid assets.
                    </p>
                )}

                {results.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {results.map((item) => {
                            const isDownloaded = !!downloaded[item.id];
                            const isCreatingCard = creatingCardId === item.id;
                            const cardIdForItem = createdCards[item.id];
                            const hasCard = !!cardIdForItem;
                            const label =
                                item.type === 'video'
                                    ? 'Video'
                                    : item.type === 'image'
                                    ? 'Image'
                                    : item.type === 'audio'
                                    ? 'Audio'
                                    : 'Unknown';
                            return (
                                <div
                                    key={item.id}
                                    className="rounded-xl border border-gray-700 bg-gray-850/40 p-3 flex flex-col gap-2"
                                >
                                    <div className="relative">
                                        {renderPreview(item)}
                                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] uppercase tracking-wide text-gray-100">
                                            {label}
                                        </div>
                                        {(isDownloaded || hasCard) && (
                                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                {isDownloaded && (
                                                    <div className="px-2 py-0.5 rounded-full bg-green-600/80 text-[10px] text-white">
                                                        Downloaded
                                                    </div>
                                                )}
                                                {hasCard && cardIdForItem && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenCard(cardIdForItem)}
                                                        className="px-2 py-0.5 rounded-full bg-purple-600/90 text-[10px] text-white hover:bg-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-300"
                                                    >
                                                        View Card
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-1 space-y-1">
                                        <div className="text-xs text-gray-200 font-semibold truncate" title={item.prompt || ''}>
                                            {item.prompt || 'Untitled media'}
                                        </div>
                                        <div className="text-[11px] text-gray-500 flex flex-wrap gap-2">
                                            {item.fileType && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                                                    {item.fileType}
                                                </span>
                                            )}
                                            {item.orientation && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700">
                                                    {item.orientation}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-row gap-2">
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleDownload(item)}
                                            disabled={loading}
                                        >
                                            {isDownloaded ? 'Re-download' : 'Download'}
                                        </SecondaryButton>
                                        {hasCard && cardIdForItem ? (
                                            <PrimaryButton
                                                type="button"
                                                tone="purple"
                                                onClick={() => handleOpenCard(cardIdForItem)}
                                                disabled={loading}
                                            >
                                                Open Card
                                            </PrimaryButton>
                                        ) : (
                                            <PrimaryButton
                                                type="button"
                                                tone="purple"
                                                onClick={() => handleCreateCard(item)}
                                                disabled={loading || isCreatingCard}
                                            >
                                                {isCreatingCard ? 'Creating…' : 'Create Card'}
                                            </PrimaryButton>
                                        )}
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
