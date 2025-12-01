// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { LlamaSettings, LlamaStatus, LocalLlamaModel, HfGGUFSearchResult } from '../types';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import PageContainer from '../components/PageContainer';

const LocalLlama: React.FC = () => {
    const [settings, setSettings] = useState<LlamaSettings | null>(null);
    const [status, setStatus] = useState<LlamaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localModels, setLocalModels] = useState<LocalLlamaModel[]>([]);
    const [localModelsBusy, setLocalModelsBusy] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [downloadFileName, setDownloadFileName] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
    const [hfQuery, setHfQuery] = useState('');
    const [hfResults, setHfResults] = useState<HfGGUFSearchResult[]>([]);
    const [hfSearching, setHfSearching] = useState(false);
    const [hfSearchError, setHfSearchError] = useState<string | null>(null);
    const [hfDownloadingRepo, setHfDownloadingRepo] = useState<string | null>(null);
    const [hfSelectedFiles, setHfSelectedFiles] = useState<Record<string, string>>({});

    const loadSettingsAndStatus = async () => {
        if (!window.electronAPI) return;
        setLoading(true);
        setError(null);
        try {
            const [s, st, models] = await Promise.all([
                window.electronAPI.getLlamaSettings(),
                window.electronAPI.getLlamaStatus(),
                window.electronAPI.listLlamaLocalModels(),
            ]);
            setSettings(s);
            setStatus(st);
            setLocalModels(models || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load llama runtime state');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettingsAndStatus();
    }, []);

    const handleSettingsChange = (patch: Partial<LlamaSettings>) => {
        setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    const handleSave = async () => {
        if (!window.electronAPI || !settings) return;
        setSaving(true);
        setError(null);
        try {
            await window.electronAPI.saveLlamaSettings(settings);
            await loadSettingsAndStatus();
        } catch (e: any) {
            setError(e?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const refreshStatus = async () => {
        if (!window.electronAPI) return;
        setStatusLoading(true);
        setError(null);
        try {
            const st = await window.electronAPI.getLlamaStatus();
            setStatus(st);
        } catch (e: any) {
            setError(e?.message || 'Failed to refresh status');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleStart = async () => {
        if (!window.electronAPI) return;
        setStatusLoading(true);
        setError(null);
        try {
            const st = await window.electronAPI.startLlamaServer();
            setStatus(st);
        } catch (e: any) {
            setError(e?.message || 'Failed to start llama server');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleStop = async () => {
        if (!window.electronAPI) return;
        setStatusLoading(true);
        setError(null);
        try {
            const st = await window.electronAPI.stopLlamaServer();
            setStatus(st);
        } catch (e: any) {
            setError(e?.message || 'Failed to stop llama server');
        } finally {
            setStatusLoading(false);
        }
    };

    const running = status?.running;

    const currentFavorites =
        settings && Array.isArray(settings.favorites) ? settings.favorites : [];

    const favoriteModels: LocalLlamaModel[] = localModels.filter((model) =>
        currentFavorites.includes(model.name),
    );

    const danglingFavorites: string[] = currentFavorites.filter(
        (name) => !localModels.some((m) => m.name === name),
    );

    const runHfSearch = async (query: string) => {
        if (!window.electronAPI) return;
        const q = query.trim();
        if (!q) return;
        setHfSearching(true);
        setHfSearchError(null);
        try {
            const results = await window.electronAPI.hfSearchGGUFModels({ query: q });
            setHfResults(results || []);
        } catch (e: any) {
            setHfSearchError(e?.message || 'Failed to search Hugging Face');
        } finally {
            setHfSearching(false);
        }
    };

    const handleHfSearch = async () => {
        const q = hfQuery.trim();
        if (!q) return;
        await runHfSearch(q);
    };

    const handleHfPresetSearch = async (query: string) => {
        setHfQuery(query);
        await runHfSearch(query);
    };

    const handleHfDownload = async (result: HfGGUFSearchResult, fileOverride?: string) => {
        if (!window.electronAPI) return;
        const fileNameToUse = fileOverride || result.recommendedFile || result.ggufFiles[0];
        if (!fileNameToUse) {
            setError('No GGUF file found for this model');
            return;
        }
        setHfDownloadingRepo(result.repoId);
        setError(null);
        setDownloadMessage(null);
        try {
            const url = `https://huggingface.co/${result.repoId}/resolve/main/${encodeURIComponent(
                fileNameToUse,
            )}`;
            await window.electronAPI.downloadLlamaModel({
                url,
                fileName: fileNameToUse,
            });
            if (settings) {
                const next: LlamaSettings = { ...settings, defaultModel: fileNameToUse };
                await window.electronAPI.saveLlamaSettings(next);
                setSettings(next);
            }
            await loadSettingsAndStatus();
            setDownloadMessage(
                `Downloaded ${fileNameToUse} from ${result.repoId} and set as default model`,
            );
        } catch (e: any) {
            setError(e?.message || 'Failed to download model from Hugging Face');
        } finally {
            setHfDownloadingRepo(null);
        }
    };

    const handleDownload = async () => {
        if (!window.electronAPI) return;
        if (!downloadUrl.trim()) return;
        setDownloading(true);
        setDownloadMessage(null);
        setError(null);
        try {
            const result = await window.electronAPI.downloadLlamaModel({
                url: downloadUrl.trim(),
                fileName: downloadFileName.trim() || undefined,
            });
            setDownloadMessage(`Downloaded to ${result.path}`);
        } catch (e: any) {
            setError(e?.message || 'Failed to download model');
        } finally {
            setDownloading(false);
        }
    };

    const handleSetDefaultModel = async (model: LocalLlamaModel) => {
        if (!window.electronAPI || !settings) return;
        setSaving(true);
        setError(null);
        try {
            const next: LlamaSettings = { ...settings, defaultModel: model.name };
            await window.electronAPI.saveLlamaSettings(next);
            setSettings(next);
            await loadSettingsAndStatus();
        } catch (e: any) {
            setError(e?.message || 'Failed to update default model');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteModel = async (model: LocalLlamaModel) => {
        if (!window.electronAPI) return;
        const confirmed = window.confirm(
            `Delete model "${model.name}" from disk? This cannot be undone.`,
        );
        if (!confirmed) return;
        setLocalModelsBusy(true);
        setError(null);
        try {
            await window.electronAPI.deleteLlamaModel({ path: model.path });
            if (settings && settings.defaultModel === model.name) {
                const next: LlamaSettings = { ...settings, defaultModel: '' };
                await window.electronAPI.saveLlamaSettings(next);
                setSettings(next);
            }
            await loadSettingsAndStatus();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete model');
        } finally {
            setLocalModelsBusy(false);
        }
    };

    const handleToggleFavorite = async (model: LocalLlamaModel) => {
        if (!window.electronAPI || !settings) return;
        setSaving(true);
        setError(null);
        try {
            const existing = Array.isArray(settings.favorites) ? settings.favorites : [];
            const isFav = existing.includes(model.name);
            const nextFavorites = isFav
                ? existing.filter((name) => name !== model.name)
                : [...existing, model.name];
            const next: LlamaSettings = { ...settings, favorites: nextFavorites };
            await window.electronAPI.saveLlamaSettings(next);
            setSettings(next);
        } catch (e: any) {
            setError(e?.message || 'Failed to update favorites');
        } finally {
            setSaving(false);
        }
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
                            <rux-icon icon="memory" size="large"></rux-icon>
                            LOCAL AI <span className="text-green-400 text-lg font-mono font-normal opacity-80">// LLAMA.CPP</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            MANAGE LOCAL LLM MODELS AND RUNTIME SERVER
                        </p>
                    </div>
                    {settings && (
                        <div className="flex items-center gap-2">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${running
                                    ? 'bg-green-900/30 border-green-500/50 text-green-400'
                                    : 'bg-red-900/30 border-red-500/50 text-red-400'
                                }`}>
                                {running ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
                            </div>
                        </div>
                    )}
                </div>

                {loading && <p className="text-gray-400 font-mono text-sm">INITIALIZING RUNTIME...</p>}
                {error && <p className="text-red-400 font-mono text-sm mb-4">ERROR: {error}</p>}

                {!loading && settings && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Management */}
                        <div className="space-y-6">
                            {/* Status Panel */}
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${running ? 'bg-green-500' : 'bg-red-500'} opacity-60 group-hover:opacity-100`}></div>

                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-green-400 font-bold tracking-widest text-xs uppercase">
                                        <rux-icon icon="settings-input-component" size="extra-small"></rux-icon>
                                        Runtime Status
                                    </div>
                                    <button
                                        onClick={refreshStatus}
                                        disabled={statusLoading}
                                        className="text-gray-400 hover:text-white transition-colors"
                                        title="Refresh Status"
                                    >
                                        <rux-icon icon="refresh" size="small" className={statusLoading ? "animate-spin" : ""}></rux-icon>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-black/20 p-3 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500 font-mono uppercase mb-1">Active Model</div>
                                        <div className="text-xs text-gray-200 font-mono truncate" title={status?.model || 'None'}>
                                            {status?.model || '—'}
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-lg border border-gray-800">
                                        <div className="text-[10px] text-gray-500 font-mono uppercase mb-1">Port / PID</div>
                                        <div className="text-xs text-gray-200 font-mono">
                                            {status?.port || '—'} <span className="text-gray-600">/</span> {status?.pid || '—'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <PrimaryButton
                                        onClick={running ? handleStop : handleStart}
                                        disabled={statusLoading}
                                        tone={running ? 'red' : 'green'}
                                        className="flex-1 justify-center"
                                    >
                                        {statusLoading ? (
                                            <span className="flex items-center gap-2"><rux-icon icon="refresh" size="extra-small" className="animate-spin"></rux-icon> PROCESSING...</span>
                                        ) : running ? (
                                            <span className="flex items-center gap-2"><rux-icon icon="stop" size="extra-small"></rux-icon> STOP SERVER</span>
                                        ) : (
                                            <span className="flex items-center gap-2"><rux-icon icon="play-arrow" size="extra-small"></rux-icon> START SERVER</span>
                                        )}
                                    </PrimaryButton>
                                </div>
                                {status?.lastError && (
                                    <div className="mt-3 text-[10px] text-red-400 font-mono bg-red-900/10 p-2 rounded border border-red-900/30">
                                        LAST ERROR: {status.lastError}
                                    </div>
                                )}
                            </div>

                            {/* Local Models */}
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col max-h-[600px]">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase">
                                        <rux-icon icon="storage" size="extra-small"></rux-icon>
                                        Local Models
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500">{localModels.length} FOUND</span>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                    {localModels.length === 0 ? (
                                        <div className="text-center py-8 text-gray-600">
                                            <p className="text-xs font-mono">NO MODELS FOUND</p>
                                            <p className="text-[10px] text-gray-700 mt-1">Download models to get started</p>
                                        </div>
                                    ) : (
                                        localModels.map((model) => {
                                            const isFavorite = currentFavorites.includes(model.name);
                                            const isDefault = settings.defaultModel === model.name;
                                            return (
                                                <div key={model.path} className={`p-3 rounded-lg border transition-all ${isDefault ? 'bg-blue-900/10 border-blue-500/30' : 'bg-black/20 border-gray-800 hover:border-gray-700'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="min-w-0 flex-1 mr-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-gray-200 truncate" title={model.name}>{model.name}</span>
                                                                {isDefault && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">DEFAULT</span>}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                                {(model.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB • {new Date(model.mtime).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleFavorite(model)}
                                                            disabled={saving}
                                                            className={`text-gray-500 hover:text-yellow-400 transition-colors ${isFavorite ? 'text-yellow-400' : ''}`}
                                                        >
                                                            <rux-icon icon={isFavorite ? "star" : "star-border"} size="small"></rux-icon>
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        {!isDefault && (
                                                            <button
                                                                onClick={() => handleSetDefaultModel(model)}
                                                                disabled={saving}
                                                                className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-mono tracking-wide"
                                                            >
                                                                SET DEFAULT
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteModel(model)}
                                                            disabled={localModelsBusy}
                                                            className="text-[10px] text-red-400 hover:text-red-300 uppercase font-mono tracking-wide"
                                                        >
                                                            DELETE
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Configuration */}
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
                                <div className="flex items-center gap-2 text-gray-400 font-bold tracking-widest text-xs uppercase mb-4">
                                    <rux-icon icon="tune" size="extra-small"></rux-icon>
                                    Configuration
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="section-label">Server Path</label>
                                        <input
                                            type="text"
                                            value={settings.serverPath}
                                            onChange={(e) => handleSettingsChange({ serverPath: e.target.value })}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="Path to llama-server..."
                                        />
                                    </div>
                                    <div>
                                        <label className="section-label">Models Directory</label>
                                        <input
                                            type="text"
                                            value={settings.modelsDir}
                                            onChange={(e) => handleSettingsChange({ modelsDir: e.target.value })}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="Path to models..."
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="section-label">Port</label>
                                            <input
                                                type="number"
                                                value={settings.port}
                                                onChange={(e) => handleSettingsChange({ port: Number(e.target.value) || 0 })}
                                                className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            />
                                        </div>
                                        <div className="flex items-end pb-2">
                                            <label className="flex items-center gap-2 cursor-pointer group/check">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.autoStart}
                                                    onChange={(e) => handleSettingsChange({ autoStart: e.target.checked })}
                                                    className="hidden"
                                                />
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${settings.autoStart ? 'bg-blue-500 border-blue-500' : 'border-gray-600 group-hover/check:border-blue-400'}`}>
                                                    {settings.autoStart && <rux-icon icon="check" size="extra-small" className="text-black"></rux-icon>}
                                                </div>
                                                <span className="text-xs font-mono text-gray-300">AUTO-START</span>
                                            </label>
                                        </div>
                                    </div>
                                    <PrimaryButton onClick={handleSave} disabled={saving} className="w-full justify-center mt-2">
                                        {saving ? 'SAVING...' : 'SAVE CONFIGURATION'}
                                    </PrimaryButton>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Discovery */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col h-full min-h-[600px]">
                                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 opacity-60"></div>

                                <div className="flex items-center gap-2 text-yellow-400 font-bold tracking-widest text-xs uppercase mb-6">
                                    <rux-icon icon="cloud-download" size="extra-small"></rux-icon>
                                    Model Discovery
                                </div>

                                <div className="space-y-6 flex-1 flex flex-col">
                                    <div>
                                        <label className="section-label">Hugging Face Search</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={hfQuery}
                                                onChange={(e) => setHfQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleHfSearch()}
                                                className="flex-1 rounded-lg px-3 py-2 input-base font-mono text-sm"
                                                placeholder="Search GGUF models..."
                                            />
                                            <SecondaryButton onClick={handleHfSearch} disabled={hfSearching || !hfQuery.trim()}>
                                                {hfSearching ? <rux-icon icon="refresh" size="small" className="animate-spin"></rux-icon> : <rux-icon icon="search" size="small"></rux-icon>}
                                            </SecondaryButton>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {['Llama 3.1 8B Instruct', 'Phi-2', 'Mistral 7B', 'CodeLlama'].map(preset => (
                                                <button
                                                    key={preset}
                                                    onClick={() => handleHfPresetSearch(`${preset} GGUF`)}
                                                    className="px-2 py-1 rounded border border-gray-700 bg-gray-800/50 hover:bg-gray-700 text-[10px] text-gray-300 font-mono transition-colors"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {hfSearchError && (
                                        <div className="p-3 rounded bg-red-900/20 border border-red-500/30 text-red-300 text-xs font-mono">
                                            {hfSearchError}
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2 space-y-3 min-h-[200px]">
                                        {hfResults.length === 0 && !hfSearching ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                                <rux-icon icon="search" size="large" className="mb-2"></rux-icon>
                                                <p className="text-xs font-mono">SEARCH FOR MODELS</p>
                                            </div>
                                        ) : (
                                            hfResults.map((result) => {
                                                const selectedFile = hfSelectedFiles[result.repoId] || result.recommendedFile || result.ggufFiles[0];
                                                const isDownloading = hfDownloadingRepo === result.repoId;

                                                return (
                                                    <div key={result.repoId} className="p-4 rounded-lg bg-black/20 border border-gray-800 hover:border-gray-600 transition-colors">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="text-sm font-bold text-gray-200 truncate pr-4" title={result.repoId}>{result.repoId}</h4>
                                                            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
                                                                <span title="Downloads"><rux-icon icon="download" size="extra-small" className="inline mr-1 align-text-bottom"></rux-icon>{result.downloads?.toLocaleString() || 0}</span>
                                                                <span title="Likes"><rux-icon icon="favorite" size="extra-small" className="inline mr-1 align-text-bottom"></rux-icon>{result.likes?.toLocaleString() || 0}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {result.architecture && <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 border border-gray-700">{result.architecture}</span>}
                                                            {result.contextLength && <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 border border-gray-700">{(result.contextLength / 1000).toFixed(0)}k ctx</span>}
                                                        </div>

                                                        <div className="flex gap-2 items-center mt-3 pt-3 border-t border-gray-800">
                                                            <select
                                                                value={selectedFile || ''}
                                                                onChange={(e) => setHfSelectedFiles(prev => ({ ...prev, [result.repoId]: e.target.value }))}
                                                                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-yellow-500"
                                                            >
                                                                {result.ggufFiles.map(file => (
                                                                    <option key={file} value={file}>
                                                                        {file} {file === result.recommendedFile ? '(Recommended)' : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleHfDownload(result, selectedFile)}
                                                                disabled={isDownloading}
                                                                className="px-3 py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wide transition-colors"
                                                            >
                                                                {isDownloading ? 'DOWNLOADING...' : 'GET'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-gray-800">
                                        <label className="section-label">Direct Download URL</label>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={downloadUrl}
                                                onChange={(e) => setDownloadUrl(e.target.value)}
                                                className="flex-1 rounded-lg px-3 py-2 input-base font-mono text-xs"
                                                placeholder="https://..."
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={downloadFileName}
                                                onChange={(e) => setDownloadFileName(e.target.value)}
                                                className="flex-1 rounded-lg px-3 py-2 input-base font-mono text-xs"
                                                placeholder="Filename (optional)..."
                                            />
                                            <SecondaryButton onClick={handleDownload} disabled={downloading || !downloadUrl.trim()}>
                                                {downloading ? '...' : 'DOWNLOAD'}
                                            </SecondaryButton>
                                        </div>
                                        {downloadMessage && (
                                            <p className="text-[10px] text-green-400 font-mono mt-2 truncate">{downloadMessage}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
};

export default LocalLlama;
