import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { PrimaryButton, SecondaryButton } from '../components/Button';

interface WormholeIngestDisplayItem {
    contentId: string;
    cardId: string;
    mediaType: string;
    createdAt: string;
    transcriptionStatus?: string;
    transcriptionError?: string | null;
    summarizationStatus?: string;
    summarizationError?: string | null;
    keyTermsStatus?: string;
    keyTermsError?: string | null;
    wikiStatus?: string;
    wikiError?: string | null;
}

interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
}

const CARD_LIBRARY_CORE_NAME = 'card-library';

const Wormhole: React.FC = () => {
    const navigate = useNavigate();
    const [filePath, setFilePath] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');
    const [ownerDid, setOwnerDid] = useState('');
    const [sourceLabel, setSourceLabel] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [ingesting, setIngesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<WormholeIngestDisplayItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const [globalItems, setGlobalItems] = useState<WormholeIngestDisplayItem[]>([]);
    const [globalLoading, setGlobalLoading] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
    const [overrideSummarizationModel, setOverrideSummarizationModel] = useState('');
    const [overrideKeyTermsModel, setOverrideKeyTermsModel] = useState('');
    const [overrideWikiModel, setOverrideWikiModel] = useState('');

    const loadGlobalIngests = async () => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.p2pRead) {
            setGlobalError('Global Wormhole feed requires the Electron P2P backend.');
            return;
        }

        setGlobalLoading(true);
        setGlobalError(null);
        try {
            let indexItems: string[] = [];
            try {
                indexItems = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
            } catch (inner: any) {
                const msg = inner?.message || '';
                if (msg.includes('not found')) {
                    setGlobalItems([]);
                    setGlobalLoading(false);
                    return;
                }
                throw inner;
            }

            const feed: WormholeIngestDisplayItem[] = [];

            for (const raw of indexItems) {
                if (!raw || typeof raw !== 'string') continue;
                let data: any;
                try {
                    data = JSON.parse(raw);
                } catch {
                    continue;
                }
                if (!data || data.type !== 'card-index') continue;

                const cardId = String(data.cardId || data.id || '');
                const coreName = typeof data.coreName === 'string' ? data.coreName : undefined;
                const createdAt = typeof data.createdAt === 'string' ? data.createdAt : '';
                if (!coreName) continue;

                let records: string[] = [];
                try {
                    records = await window.electronAPI.p2pRead(coreName);
                } catch {
                    continue;
                }
                if (!Array.isArray(records) || records.length === 0) continue;

                let cardRecord: any | null = null;
                for (let i = records.length - 1; i >= 0; i -= 1) {
                    const recRaw = records[i];
                    if (!recRaw || typeof recRaw !== 'string') continue;
                    try {
                        const parsed = JSON.parse(recRaw);
                        if (parsed && parsed.type === 'card') {
                            cardRecord = parsed;
                            break;
                        }
                    } catch {
                        // ignore
                    }
                }

                if (!cardRecord || !cardRecord.wormhole) continue;

                const ingest = cardRecord.wormhole.ingest || {};
                const processing = (cardRecord.wormhole.processing || {}) as any;

                const contentId = typeof ingest.contentId === 'string' ? ingest.contentId : cardId;
                const mediaType = String(ingest.mediaType || cardRecord.mediaType || '');
                const created =
                    (typeof ingest.startedAt === 'string' && ingest.startedAt) || createdAt || new Date().toISOString();

                const makeStatus = (step: any): string | undefined =>
                    step && typeof step.status === 'string' ? (step.status as string) : undefined;
                const makeError = (step: any): string | null =>
                    step && typeof step.error === 'string' ? (step.error as string) : null;

                feed.push({
                    contentId,
                    cardId,
                    mediaType,
                    createdAt: created,
                    transcriptionStatus: makeStatus(processing.transcription),
                    transcriptionError: makeError(processing.transcription),
                    summarizationStatus: makeStatus(processing.summarization),
                    summarizationError: makeError(processing.summarization),
                    keyTermsStatus: makeStatus(processing.keyTerms),
                    keyTermsError: makeError(processing.keyTerms),
                    wikiStatus: makeStatus(processing.wikiUpdate),
                    wikiError: makeError(processing.wikiUpdate),
                });
            }

            feed.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setGlobalItems(feed);
        } catch (e: any) {
            setGlobalError(e?.message || 'Failed to load Wormhole ingest feed.');
        } finally {
            setGlobalLoading(false);
        }
    };

    const loadGeminiModels = async () => {
        if (!window.electronAPI || !window.electronAPI.listGeminiModels) return;
        try {
            const models = await window.electronAPI.listGeminiModels();
            if (Array.isArray(models) && models.length > 0) {
                setGeminiModels(models as ModelInfo[]);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to load Gemini models for Wormhole:', e);
        }
    };

    useEffect(() => {
        loadGlobalIngests();
        loadGeminiModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleIngest = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedPath = filePath.trim();
        const trimmedUrl = remoteUrl.trim();
        const hasPath = trimmedPath.length > 0;
        const hasDroppedFile = !!droppedFile;
        const hasUrl = trimmedUrl.length > 0;

        if (!hasPath && !hasDroppedFile && !hasUrl) {
            setError('Please provide a file path, drop/select a file, or enter a source URL to ingest.');
            return;
        }

        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeIngestContent) {
            setError('Wormhole ingestion is only available in the Electron app.');
            return;
        }

        setError(null);
        setIngesting(true);
        try {
            const tags = tagsText
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t.length > 0);

            let result: any = null;

            // If we have a dropped File object, prefer streaming its bytes unless we know
            // we have a real filesystem path (Electron OS drag/drop sets a path and clears droppedFile).
            if (hasDroppedFile && droppedFile) {
                const arrayBuffer = await droppedFile.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i += 1) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);

                result = await window.electronAPI.wormholeIngestContent({
                    bytesBase64: base64,
                    fileName: droppedFile.name,
                    ownerDid: ownerDid.trim() || undefined,
                    sourceLabel: sourceLabel.trim() || undefined,
                    originalUrl: hasUrl ? trimmedUrl : undefined,
                    tags,
                } as any);
            } else if (hasPath) {
                result = await window.electronAPI.wormholeIngestContent({
                    path: trimmedPath,
                    ownerDid: ownerDid.trim() || undefined,
                    sourceLabel: sourceLabel.trim() || undefined,
                    originalUrl: hasUrl ? trimmedUrl : undefined,
                    tags,
                });
            } else if (hasUrl) {
                result = await window.electronAPI.wormholeIngestContent({
                    originalUrl: trimmedUrl,
                    ownerDid: ownerDid.trim() || undefined,
                    sourceLabel: sourceLabel.trim() || undefined,
                    tags,
                } as any);
            }

            if (!result) {
                throw new Error('Wormhole ingest did not return a result.');
            }

            const createdAt = new Date().toISOString();
            setItems((prev) => [
                {
                    contentId: result.contentId,
                    cardId: result.cardId,
                    mediaType: result.mediaType,
                    createdAt,
                    transcriptionStatus: undefined,
                    transcriptionError: null,
                    summarizationStatus: undefined,
                    summarizationError: null,
                    keyTermsStatus: undefined,
                    keyTermsError: null,
                    wikiStatus: undefined,
                    wikiError: null,
                },
                ...prev,
            ]);
            // Refresh global feed so the new card shows up in the Wormhole ingest list.
            loadGlobalIngests();
        } catch (err: any) {
            console.error('Wormhole ingest failed:', err);
            setError(err?.message || 'Failed to ingest content via Wormhole.');
        } finally {
            setIngesting(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const anyFile = file as any;
            const droppedPath =
                anyFile && typeof anyFile.path === 'string' && anyFile.path.length > 0
                    ? (anyFile.path as string)
                    : '';

            if (droppedPath) {
                // Electron desktop: we can use the direct filesystem path.
                setFilePath(droppedPath);
                setDroppedFile(null);
                setError(null);
            } else {
                // Browser / non-Electron: remember the File object and stream bytes during ingest.
                setDroppedFile(file);
                setFilePath(file.name || '');
                setError(null);
            }
        }
    };

    const handleOpenCard = (cardId: string) => {
        if (!cardId) return;
        navigate(`/cards?cardId=${encodeURIComponent(cardId)}`);
    };

    const handleTranscribe = async (item: WormholeIngestDisplayItem) => {
        if (item.mediaType !== 'audio') {
            setError('Transcription is currently implemented for audio cards only.');
            return;
        }

        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeRunTranscription) {
            setError('Wormhole transcription is only available in the Electron app.');
            return;
        }

        setError(null);
        try {
            const result = await window.electronAPI.wormholeRunTranscription({
                cardId: item.cardId,
            } as any);
            const statusCode = result && result.status && result.status.status ? result.status.status : 'unknown';

            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, transcriptionStatus: statusCode, transcriptionError: null }
                        : entry,
                ),
            );
        } catch (err: any) {
            console.error('Wormhole transcription failed:', err);
            const message = err?.message || 'Transcription failed.';
            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, transcriptionError: message }
                        : entry,
                ),
            );
        }
    };

    const handleWikiUpdate = async (item: WormholeIngestDisplayItem) => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeRunWikiUpdate) {
            setError('Wormhole wiki update is only available in the Electron app.');
            return;
        }

        setError(null);
        try {
            const result = await window.electronAPI.wormholeRunWikiUpdate({
                cardId: item.cardId,
                overrideModel: overrideWikiModel.trim() || undefined,
            } as any);
            const statusCode = result && result.status && result.status.status ? result.status.status : 'unknown';

            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, wikiStatus: statusCode, wikiError: null }
                        : entry,
                ),
            );
        } catch (err: any) {
            console.error('Wormhole wiki update failed:', err);
            const message = err?.message || 'Wiki update failed.';
            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, wikiError: message }
                        : entry,
                ),
            );
        }
    };

    const handleSummarize = async (item: WormholeIngestDisplayItem) => {
        if (item.mediaType !== 'audio' && item.mediaType !== 'text' && item.mediaType !== 'markdown') {
            setError('Summarization is currently implemented for audio (with transcript) and text/markdown cards.');
            return;
        }

        if (
            typeof window === 'undefined' ||
            !window.electronAPI ||
            !window.electronAPI.wormholeRunSummarization
        ) {
            setError('Wormhole summarization is only available in the Electron app.');
            return;
        }

        setError(null);
        try {
            const result = await window.electronAPI.wormholeRunSummarization({
                cardId: item.cardId,
                overrideModel: overrideSummarizationModel.trim() || undefined,
            } as any);
            const statusCode = result && result.status && result.status.status ? result.status.status : 'unknown';

            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, summarizationStatus: statusCode, summarizationError: null }
                        : entry,
                ),
            );
        } catch (err: any) {
            console.error('Wormhole summarization failed:', err);
            const message = err?.message || 'Summarization failed.';
            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, summarizationError: message }
                        : entry,
                ),
            );
        }
    };

    const handleKeyTerms = async (item: WormholeIngestDisplayItem) => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeRunKeyTerms) {
            setError('Wormhole key-term extraction is only available in the Electron app.');
            return;
        }

        setError(null);
        try {
            const result = await window.electronAPI.wormholeRunKeyTerms({
                cardId: item.cardId,
                overrideModel: overrideKeyTermsModel.trim() || undefined,
            } as any);
            const statusCode = result && result.status && result.status.status ? result.status.status : 'unknown';

            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, keyTermsStatus: statusCode, keyTermsError: null }
                        : entry,
                ),
            );
        } catch (err: any) {
            console.error('Wormhole key-term extraction failed:', err);
            const message = err?.message || 'Key-term extraction failed.';
            setItems((prev) =>
                prev.map((entry) =>
                    entry.cardId === item.cardId
                        ? { ...entry, keyTermsError: message }
                        : entry,
                ),
            );
        }
    };

    return (
        <PageContainer>
            <div className="w-full text-white max-w-3xl">
                <h2 className="text-3xl font-bold mb-4">Wormhole</h2>
                <p className="text-sm text-gray-300 mb-6">
                    Ingest local files into Sovereign Memory as Cards. Each ingestion creates a card-backed Hypercore
                    entry; further processing steps (transcription, summarization, key terms, wiki) are triggered
                    manually elsewhere.
                </p>

                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-4 text-xs text-gray-200">
                    <div className="font-semibold text-emerald-300 mb-1">Per-run model overrides (optional)</div>
                    <p className="text-[11px] text-gray-400 mb-2">
                        These override the Wormhole settings for this session only. Choose a model below or leave set to
                        "Use defaults" to rely on the configured Wormhole settings.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <div className="text-gray-500 mb-0.5">Summarization model</div>
                            {geminiModels.length > 0 ? (
                                <select
                                    aria-label="Wormhole summarization model override"
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
                            <div className="text-gray-500 mb-0.5">Key terms model</div>
                            {geminiModels.length > 0 ? (
                                <select
                                    aria-label="Wormhole key terms model override"
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
                            <div className="text-gray-500 mb-0.5">Wiki update model</div>
                            {geminiModels.length > 0 ? (
                                <select
                                    aria-label="Wormhole wiki update model override"
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
                </div>

                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`mb-6 rounded-xl border-2 border-dashed px-6 py-10 flex flex-col items-center justify-center text-center text-sm transition-colors ${
                        isDragging ? 'border-blue-400 bg-blue-950/40' : 'border-gray-600 bg-gray-900/60'
                    }`}
                >
                    <div className="font-medium text-gray-200 mb-1">Drag &amp; drop files to set the Wormhole path</div>
                    <div className="text-xs text-gray-400 mb-1">
                        Drop a file from your system here; its path will populate the field below. No ingestion happens
                        until you click &quot;Ingest via Wormhole&quot;.
                    </div>
                    <div className="text-[11px] text-gray-500">
                        Current selection:{' '}
                        <span className="font-mono text-gray-300">
                            {filePath || (droppedFile ? droppedFile.name : 'None selected')}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleIngest} className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">File path</label>
                        <input
                            type="text"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
                            placeholder="C:\\path\\to\\file.pdf"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            For now, enter a full local file path. Future versions will add drag-and-drop and pickers.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Owner DID (optional)</label>
                            <input
                                type="text"
                                value={ownerDid}
                                onChange={(e) => setOwnerDid(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="did:example:alice"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Source URL (optional)</label>
                            <input
                                type="text"
                                value={remoteUrl}
                                onChange={(e) => setRemoteUrl(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="https://example.com/file.pdf"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Source label (optional)</label>
                            <input
                                type="text"
                                value={sourceLabel}
                                onChange={(e) => setSourceLabel(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="drag-drop / HPN-IDE-Agent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={tagsText}
                                onChange={(e) => setTagsText(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="foundation, podcast, paper"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <PrimaryButton type="submit" disabled={ingesting} className="px-6">
                            {ingesting ? 'Ingesting…' : 'Ingest via Wormhole'}
                        </PrimaryButton>
                        {error && <span className="text-xs text-red-400 ml-4">{error}</span>}
                    </div>
                </form>

                {items.length > 0 && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-purple-300">Recent ingests</h3>
                            <span className="text-[11px] text-gray-500">Newest first</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            {items.map((item) => (
                                <div
                                    key={item.contentId}
                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-700/80 rounded-lg px-3 py-2 bg-gray-900/60"
                                >
                                    <div className="text-xs text-gray-200 space-y-0.5">
                                        <div>
                                            <span className="text-gray-500">Card ID: </span>
                                            <span className="break-all">{item.cardId}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Content ID: </span>
                                            <span className="break-all">{item.contentId}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                                            <span>Media: {item.mediaType}</span>
                                            <span>Ingested: {item.createdAt}</span>
                                            {item.transcriptionStatus && (
                                                <span className="text-emerald-400">
                                                    Transcription: {item.transcriptionStatus}
                                                </span>
                                            )}
                                            {item.transcriptionError && (
                                                <span className="text-red-400">
                                                    Transcription error: {item.transcriptionError}
                                                </span>
                                            )}
                                            {item.summarizationStatus && (
                                                <span className="text-cyan-400">
                                                    Summarization: {item.summarizationStatus}
                                                </span>
                                            )}
                                            {item.summarizationError && (
                                                <span className="text-red-400">
                                                    Summarization error: {item.summarizationError}
                                                </span>
                                            )}
                                            {item.keyTermsStatus && (
                                                <span className="text-indigo-300">
                                                    Key terms: {item.keyTermsStatus}
                                                </span>
                                            )}
                                            {item.keyTermsError && (
                                                <span className="text-red-400">
                                                    Key terms error: {item.keyTermsError}
                                                </span>
                                            )}
                                            {item.wikiStatus && (
                                                <span className="text-amber-300">
                                                    Wiki: {item.wikiStatus}
                                                </span>
                                            )}
                                            {item.wikiError && (
                                                <span className="text-red-400">
                                                    Wiki error: {item.wikiError}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        {item.mediaType === 'audio' && (
                                            <SecondaryButton
                                                type="button"
                                                onClick={() => handleTranscribe(item)}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                Run transcription
                                            </SecondaryButton>
                                        )}
                                        {(item.mediaType === 'audio' ||
                                            item.mediaType === 'text' ||
                                            item.mediaType === 'markdown') && (
                                            <SecondaryButton
                                                type="button"
                                                onClick={() => handleSummarize(item)}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                Run summarization
                                            </SecondaryButton>
                                        )}
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleKeyTerms(item)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Run key terms
                                        </SecondaryButton>
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleWikiUpdate(item)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Run wiki update
                                        </SecondaryButton>
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleOpenCard(item.cardId)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Open in Card Library
                                        </SecondaryButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {globalError && <p className="text-sm text-red-400 mt-4">{globalError}</p>}
                {globalLoading && (
                    <p className="text-sm text-gray-400 mt-4">Loading Wormhole ingest feed…</p>
                )}

                {!globalLoading && globalItems.length > 0 && (
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-purple-300">All Wormhole ingests</h3>
                            <span className="text-[11px] text-gray-500">Newest first</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            {globalItems.map((item) => (
                                <div
                                    key={`${item.cardId}-${item.contentId}`}
                                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-700/80 rounded-lg px-3 py-2 bg-gray-900/60"
                                >
                                    <div className="text-xs text-gray-200 space-y-0.5">
                                        <div>
                                            <span className="text-gray-500">Card ID: </span>
                                            <span className="break-all">{item.cardId}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Content ID: </span>
                                            <span className="break-all">{item.contentId}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                                            <span>Media: {item.mediaType}</span>
                                            <span>Ingested: {item.createdAt}</span>
                                            {item.transcriptionStatus && (
                                                <span className="text-emerald-400">
                                                    Transcription: {item.transcriptionStatus}
                                                </span>
                                            )}
                                            {item.summarizationStatus && (
                                                <span className="text-cyan-400">
                                                    Summarization: {item.summarizationStatus}
                                                </span>
                                            )}
                                            {item.keyTermsStatus && (
                                                <span className="text-indigo-300">
                                                    Key terms: {item.keyTermsStatus}
                                                </span>
                                            )}
                                            {item.wikiStatus && (
                                                <span className="text-amber-300">Wiki: {item.wikiStatus}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        {item.mediaType === 'audio' && (
                                            <SecondaryButton
                                                type="button"
                                                onClick={() => handleTranscribe(item)}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                Run transcription
                                            </SecondaryButton>
                                        )}
                                        {(item.mediaType === 'audio' ||
                                            item.mediaType === 'text' ||
                                            item.mediaType === 'markdown') && (
                                            <SecondaryButton
                                                type="button"
                                                onClick={() => handleSummarize(item)}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                Run summarization
                                            </SecondaryButton>
                                        )}
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleKeyTerms(item)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Run key terms
                                        </SecondaryButton>
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleWikiUpdate(item)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Run wiki update
                                        </SecondaryButton>
                                        <SecondaryButton
                                            type="button"
                                            onClick={() => handleOpenCard(item.cardId)}
                                            className="px-3 py-1.5 text-xs"
                                        >
                                            Open in Card Library
                                        </SecondaryButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default Wormhole;
