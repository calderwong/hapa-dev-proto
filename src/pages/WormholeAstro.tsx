// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';

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

const WormholeAstro: React.FC = () => {
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
    const [activeRun, setActiveRun] = useState<{
        cardId: string;
        step: 'summarization' | 'keyTerms' | 'wikiUpdate';
    } | null>(null);

    const emitWormholeRunEvent = (
        type: 'start' | 'end',
        step: 'summarization' | 'keyTerms' | 'wikiUpdate',
    ) => {
        if (typeof window === 'undefined') return;
        const eventName = type === 'start' ? 'wormhole-run-start' : 'wormhole-run-end';
        window.dispatchEvent(new CustomEvent(eventName, { detail: { step } }));
    };

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
                    } catch { }
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
            console.error('Failed to load Gemini models for Wormhole:', e);
        }
    };

    useEffect(() => {
        loadGlobalIngests();
        loadGeminiModels();
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
            loadGlobalIngests();
            // Reset form
            setFilePath('');
            setDroppedFile(null);
            setRemoteUrl('');
            setTagsText('');
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
                setFilePath(droppedPath);
                setDroppedFile(null);
                setError(null);
            } else {
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

    const handleWikiUpdate = async (item: WormholeIngestDisplayItem) => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeRunWikiUpdate) {
            setError('Wormhole wiki update is only available in the Electron app.');
            return;
        }

        setError(null);
        setActiveRun({ cardId: item.cardId, step: 'wikiUpdate' });
        emitWormholeRunEvent('start', 'wikiUpdate');
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
        } finally {
            setActiveRun((prev) =>
                prev && prev.cardId === item.cardId && prev.step === 'wikiUpdate' ? null : prev,
            );
            emitWormholeRunEvent('end', 'wikiUpdate');
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
        setActiveRun({ cardId: item.cardId, step: 'summarization' });
        emitWormholeRunEvent('start', 'summarization');
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
        } finally {
            setActiveRun((prev) =>
                prev && prev.cardId === item.cardId && prev.step === 'summarization' ? null : prev,
            );
            emitWormholeRunEvent('end', 'summarization');
        }
    };

    const handleKeyTerms = async (item: WormholeIngestDisplayItem) => {
        if (typeof window === 'undefined' || !window.electronAPI || !window.electronAPI.wormholeRunKeyTerms) {
            setError('Wormhole key-term extraction is only available in the Electron app.');
            return;
        }

        setError(null);
        setActiveRun({ cardId: item.cardId, step: 'keyTerms' });
        emitWormholeRunEvent('start', 'keyTerms');
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
        } finally {
            setActiveRun((prev) =>
                prev && prev.cardId === item.cardId && prev.step === 'keyTerms' ? null : prev,
            );
            emitWormholeRunEvent('end', 'keyTerms');
        }
    };

    const renderModelSelectOptions = () => {
        return geminiModels.map((model) => (
            <rux-option
                key={model.name}
                value={model.name}
                label={model.displayName || model.name}
            ></rux-option>
        ));
    };

    const mapStatus = (status?: string) => {
        if (status === 'complete') return 'normal';
        if (status === 'failed') return 'critical';
        if (status === 'in_progress') return 'caution';
        return 'standby';
    };

    return (
        <PageContainer>
            <style>{`
                @keyframes pulse-border {
                    0% { border-color: rgba(77, 182, 172, 0.3); box-shadow: 0 0 0 rgba(77, 182, 172, 0); }
                    50% { border-color: rgba(77, 182, 172, 0.8); box-shadow: 0 0 15px rgba(77, 182, 172, 0.2); }
                    100% { border-color: rgba(77, 182, 172, 0.3); box-shadow: 0 0 0 rgba(77, 182, 172, 0); }
                }
                .wormhole-portal {
                    background: radial-gradient(circle at center, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
                    backdrop-filter: blur(4px);
                }
                .wormhole-portal.active {
                    animation: pulse-border 2s infinite;
                    background: radial-gradient(circle at center, rgba(30, 51, 69, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
                }
                .glass-panel {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .status-strip {
                    position: relative;
                    padding-bottom: 2px;
                }
                .status-strip::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    height: 2px;
                    width: 100%;
                    background: linear-gradient(to right, rgba(56, 189, 248, 0.9), rgba(129, 140, 248, 0.9));
                    opacity: 0;
                    transform-origin: left;
                    transform: scaleX(0.2);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                .status-strip--active::after {
                    opacity: 0.9;
                    animation: status-strip-pulse 1.2s infinite;
                }
                @keyframes status-strip-pulse {
                    0% { transform: scaleX(0.2); opacity: 0.4; }
                    50% { transform: scaleX(1); opacity: 0.9; }
                    100% { transform: scaleX(0.2); opacity: 0.4; }
                }
            `}</style>

            <div className="w-full text-white max-w-[1600px] mx-auto h-full flex flex-col gap-6">
                {/* Header Section */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-4">
                    <div>
                        <h2 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                            <rux-icon icon="cloud-upload" size="large"></rux-icon>
                            WORMHOLE <span className="text-emerald-400 text-lg font-mono font-normal opacity-80">v2.0</span>
                        </h2>
                        <p className="text-gray-400 mt-1 font-mono text-xs tracking-wide">
                            SOVEREIGN MEMORY INGESTION PROTOCOL // SECURE CHANNEL
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">System Status</span>
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${ingesting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                                <span className={`text-xs font-mono ${ingesting ? 'text-amber-300' : 'text-emerald-300'}`}>
                                    {ingesting ? 'INGESTING DATA...' : 'READY FOR INPUT'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Control Deck (Model Overrides) */}
                <rux-card className="w-full border-t-4 border-t-emerald-500/50">
                    <div className="p-4 flex flex-col md:flex-row gap-6 items-center justify-between bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <rux-icon icon="settings" size="small" className="text-gray-400"></rux-icon>
                            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Processing Configuration</div>
                        </div>
                        <div className="flex flex-wrap gap-4 flex-1 justify-end">
                            <div className="flex flex-col gap-1 w-48">
                                <label className="text-[10px] text-gray-500 uppercase font-bold">Summarization Model</label>
                                {geminiModels.length > 0 ? (
                                    <rux-select
                                        size="small"
                                        value={overrideSummarizationModel}
                                        onInput={(e: any) => setOverrideSummarizationModel(e.target.value || '')}
                                        className="w-full"
                                    >
                                        <rux-option value="" label="Default (System)"></rux-option>
                                        {renderModelSelectOptions()}
                                    </rux-select>
                                ) : (
                                    <rux-input
                                        size="small"
                                        value={overrideSummarizationModel}
                                        onInput={(e: any) => setOverrideSummarizationModel(e.target.value || '')}
                                        placeholder="e.g. gemini-1.5-flash"
                                        className="w-full"
                                    ></rux-input>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 w-48">
                                <label className="text-[10px] text-gray-500 uppercase font-bold">Key Terms Model</label>
                                {geminiModels.length > 0 ? (
                                    <rux-select
                                        size="small"
                                        value={overrideKeyTermsModel}
                                        onInput={(e: any) => setOverrideKeyTermsModel(e.target.value || '')}
                                        className="w-full"
                                    >
                                        <rux-option value="" label="Default (System)"></rux-option>
                                        {renderModelSelectOptions()}
                                    </rux-select>
                                ) : (
                                    <rux-input
                                        size="small"
                                        value={overrideKeyTermsModel}
                                        onInput={(e: any) => setOverrideKeyTermsModel(e.target.value || '')}
                                        placeholder="e.g. gemini-1.5-flash"
                                        className="w-full"
                                    ></rux-input>
                                )}
                            </div>
                            <div className="flex flex-col gap-1 w-48">
                                <label className="text-[10px] text-gray-500 uppercase font-bold">Wiki Update Model</label>
                                {geminiModels.length > 0 ? (
                                    <rux-select
                                        size="small"
                                        value={overrideWikiModel}
                                        onInput={(e: any) => setOverrideWikiModel(e.target.value || '')}
                                        className="w-full"
                                    >
                                        <rux-option value="" label="Default (System)"></rux-option>
                                        {renderModelSelectOptions()}
                                    </rux-select>
                                ) : (
                                    <rux-input
                                        size="small"
                                        value={overrideWikiModel}
                                        onInput={(e: any) => setOverrideWikiModel(e.target.value || '')}
                                        placeholder="Optional"
                                        className="w-full"
                                    ></rux-input>
                                )}
                            </div>
                        </div>
                    </div>
                </rux-card>

                {/* Main Ingest Core */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: The Portal (Drop Zone) */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`wormhole-portal relative rounded-2xl border-2 border-dashed transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-8 group cursor-pointer ${isDragging ? 'active border-emerald-400/50' : 'border-gray-700 hover:border-gray-500'
                                }`}
                        >
                            <div className={`absolute inset-0 bg-emerald-500/5 rounded-2xl transition-opacity duration-500 ${isDragging ? 'opacity-100' : 'opacity-0'}`}></div>

                            <div className="relative z-10 transform transition-transform duration-300 group-hover:scale-105">
                                <div className="mb-6 relative">
                                    <div className={`absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full transition-opacity duration-300 ${isDragging ? 'opacity-40' : ''}`}></div>
                                    <rux-icon icon="publish" size="large" className={`text-5xl ${isDragging ? 'text-emerald-300' : 'text-gray-400'}`}></rux-icon>
                                </div>
                                <h3 className="text-xl font-bold text-gray-200 mb-2">Initiate Transfer</h3>
                                <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                                    Drag and drop files here to bridge them into the Memory Core.
                                </p>
                            </div>

                            <div className="mt-8 w-full max-w-xs">
                                <div className="text-[10px] uppercase text-gray-500 font-bold mb-2 tracking-wider">Current Payload</div>
                                <div className="bg-gray-900/80 rounded px-3 py-2 border border-gray-700 text-xs font-mono text-emerald-300 truncate">
                                    {filePath || (droppedFile ? droppedFile.name : 'NO FILE SELECTED')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: The Manifest (Form) */}
                    <div className="lg:col-span-7">
                        <rux-card className="h-full border-l-4 border-l-blue-500/50">
                            <div className="p-6 flex flex-col h-full">
                                <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
                                    <rux-icon icon="assignment" size="small"></rux-icon>
                                    <h3 className="text-lg font-bold text-white">Ingest Manifest</h3>
                                </div>

                                <form onSubmit={handleIngest} className="flex flex-col gap-6 flex-1">
                                    {/* Primary Source Group */}
                                    <div className="bg-gray-900/40 p-4 rounded-lg border border-gray-700/50">
                                        <div className="text-[10px] uppercase text-emerald-400 font-bold mb-3 tracking-wider flex items-center gap-2">
                                            <rux-icon icon="gps-fixed" size="extra-small"></rux-icon>
                                            Source Coordinates
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            <rux-input
                                                label="File Path"
                                                value={filePath}
                                                onInput={(e: any) => setFilePath(e.target.value || '')}
                                                placeholder="C:\\path\\to\\file.pdf"
                                                className="w-full"
                                                help-text="Local system path. Auto-filled via drag & drop."
                                            ></rux-input>
                                            <rux-input
                                                label="Source URL"
                                                value={remoteUrl}
                                                onInput={(e: any) => setRemoteUrl(e.target.value || '')}
                                                placeholder="https://example.com/..."
                                                help-text="Original web location (optional)."
                                            ></rux-input>
                                        </div>
                                    </div>

                                    {/* Metadata Group */}
                                    <div className="bg-gray-900/40 p-4 rounded-lg border border-gray-700/50">
                                        <div className="text-[10px] uppercase text-blue-400 font-bold mb-3 tracking-wider flex items-center gap-2">
                                            <rux-icon icon="fingerprint" size="extra-small"></rux-icon>
                                            Identity & Classification
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <rux-input
                                                label="Owner DID"
                                                value={ownerDid}
                                                onInput={(e: any) => setOwnerDid(e.target.value || '')}
                                                placeholder="did:example:..."
                                            ></rux-input>
                                            <rux-input
                                                label="Source Label"
                                                value={sourceLabel}
                                                onInput={(e: any) => setSourceLabel(e.target.value || '')}
                                                placeholder="e.g. HPN-IDE-Agent"
                                            ></rux-input>
                                            <div className="md:col-span-2">
                                                <rux-input
                                                    label="Tags"
                                                    value={tagsText}
                                                    onInput={(e: any) => setTagsText(e.target.value || '')}
                                                    placeholder="foundation, podcast, paper"
                                                    help-text="Comma-separated keywords for indexing."
                                                ></rux-input>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 flex items-center justify-between">
                                        {error && (
                                            <div className="text-xs text-red-400 font-mono bg-red-900/20 px-3 py-2 rounded border border-red-900/50 flex items-center gap-2">
                                                <rux-icon icon="warning" size="extra-small"></rux-icon>
                                                {error}
                                            </div>
                                        )}
                                        <div className="flex-1"></div>
                                        <rux-button type="submit" disabled={ingesting} size="large" icon="send" className="w-full md:w-auto shadow-lg shadow-emerald-900/20">
                                            {ingesting ? 'TRANSMITTING...' : 'ENGAGE WORMHOLE'}
                                        </rux-button>
                                    </div>
                                </form>
                            </div>
                        </rux-card>
                    </div>
                </div>

                {/* The Stream (History) */}
                <div className="flex-1 min-h-0 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <rux-icon icon="history" size="small"></rux-icon>
                            Data Stream
                        </h3>
                        {globalLoading && <span className="text-xs font-mono text-emerald-400 animate-pulse">SYNCING STREAM...</span>}
                    </div>

                    <div className="glass-panel rounded-xl flex-1 overflow-hidden flex flex-col">
                        {globalError && (
                            <div className="p-4 text-xs text-red-400 border-b border-red-900/30 bg-red-900/10">
                                STREAM ERROR: {globalError}
                            </div>
                        )}

                        {globalItems.length === 0 && !globalLoading && !globalError && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2 p-12">
                                <rux-icon icon="wifi-tethering-off" size="large" className="opacity-20"></rux-icon>
                                <div className="text-sm font-mono">NO DATA SIGNATURES DETECTED</div>
                            </div>
                        )}

                        <div className="overflow-auto flex-1 p-4 space-y-3 custom-scrollbar">
                            {globalItems.map((item) => (
                                <div
                                    key={`global-${item.cardId}`}
                                    className="group bg-gray-900/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-emerald-500/30 rounded-lg p-3 transition-all duration-200"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3 overflow-hidden">
                                            <div className="mt-1">
                                                <rux-status status={item.transcriptionStatus === 'complete' ? 'normal' : 'standby'}></rux-status>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-emerald-300 font-mono truncate max-w-[120px]" title={item.cardId}>
                                                        {item.cardId.slice(0, 12)}...
                                                    </span>
                                                    <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 uppercase tracking-wide border border-gray-700">
                                                        {item.mediaType}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex gap-4 text-[10px] text-gray-400">
                                                    <span className={`flex items-center gap-1 status-strip ${item.transcriptionStatus === 'complete' ? 'text-emerald-400' : ''}`}>
                                                        TX: {item.transcriptionStatus || 'PENDING'}
                                                    </span>
                                                    <span
                                                        className={`flex items-center gap-1 status-strip ${
                                                            item.summarizationStatus === 'complete'
                                                                ? 'text-cyan-400'
                                                                : ''
                                                        } ${
                                                            activeRun &&
                                                            activeRun.cardId === item.cardId &&
                                                            activeRun.step === 'summarization'
                                                                ? 'status-strip--active'
                                                                : ''
                                                        }`}
                                                    >
                                                        SUM: {item.summarizationStatus || 'PENDING'}
                                                    </span>
                                                    <span
                                                        className={`flex items-center gap-1 status-strip ${
                                                            item.keyTermsStatus === 'complete' ? 'text-purple-400' : ''
                                                        } ${
                                                            activeRun &&
                                                            activeRun.cardId === item.cardId &&
                                                            activeRun.step === 'keyTerms'
                                                                ? 'status-strip--active'
                                                                : ''
                                                        }`}
                                                    >
                                                        KEYS: {item.keyTermsStatus || 'PENDING'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <rux-button
                                                size="small"
                                                secondary
                                                onClick={() => handleSummarize(item)}
                                                title="Run Summarization"
                                                disabled={!!activeRun}
                                            >
                                                {activeRun && activeRun.cardId === item.cardId && activeRun.step === 'summarization' ? (
                                                    <>
                                                        <rux-icon
                                                            icon="sync"
                                                            size="extra-small"
                                                            className="animate-spin mr-1"
                                                        ></rux-icon>
                                                        Running
                                                    </>
                                                ) : (
                                                    <rux-icon icon="short-text" size="extra-small"></rux-icon>
                                                )}
                                            </rux-button>
                                            <rux-button
                                                size="small"
                                                secondary
                                                onClick={() => handleKeyTerms(item)}
                                                title="Extract Key Terms"
                                                disabled={!!activeRun}
                                            >
                                                {activeRun && activeRun.cardId === item.cardId && activeRun.step === 'keyTerms' ? (
                                                    <>
                                                        <rux-icon
                                                            icon="sync"
                                                            size="extra-small"
                                                            className="animate-spin mr-1"
                                                        ></rux-icon>
                                                        Running
                                                    </>
                                                ) : (
                                                    <rux-icon icon="vpn-key" size="extra-small"></rux-icon>
                                                )}
                                            </rux-button>
                                            <rux-button
                                                size="small"
                                                secondary
                                                onClick={() => handleWikiUpdate(item)}
                                                title="Update Wiki"
                                                disabled={!!activeRun}
                                            >
                                                {activeRun && activeRun.cardId === item.cardId && activeRun.step === 'wikiUpdate' ? (
                                                    <>
                                                        <rux-icon
                                                            icon="sync"
                                                            size="extra-small"
                                                            className="animate-spin mr-1"
                                                        ></rux-icon>
                                                        Running
                                                    </>
                                                ) : (
                                                    <rux-icon icon="share" size="extra-small"></rux-icon>
                                                )}
                                            </rux-button>
                                            <div className="h-4 w-px bg-gray-700 mx-1"></div>
                                            <rux-button size="small" onClick={() => handleOpenCard(item.cardId)}>
                                                OPEN
                                            </rux-button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default WormholeAstro;
