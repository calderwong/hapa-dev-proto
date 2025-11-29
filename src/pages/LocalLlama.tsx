import React, { useEffect, useState } from 'react';
import type { LlamaSettings, LlamaStatus, LocalLlamaModel, HfGGUFSearchResult } from '../types';
import { PrimaryButton } from '../components/Button';

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
        <div className="p-8 max-w-4xl mx-auto w-full">
            <h2 className="text-3xl font-bold mb-6">Local AI (llama.cpp)</h2>

            {loading && <p className="text-gray-400 mb-4">Loading llama runtime settings...</p>}
            {error && <p className="text-red-400 mb-4">{error}</p>}

            {!loading && settings && (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-green-400">Runtime status</h3>
                                <p className="text-sm text-gray-300">
                                    {running ? 'Llama server is running.' : 'Llama server is stopped.'}
                                </p>
                                {status?.model && (
                                    <p className="text-xs text-gray-400 mt-1">Model: {status.model}</p>
                                )}
                                {status?.port && (
                                    <p className="text-xs text-gray-400">Port: {status.port}</p>
                                )}
                                {status?.pid && (
                                    <p className="text-xs text-gray-500">PID: {status.pid}</p>
                                )}
                                {status?.lastError && (
                                    <p className="text-xs text-red-400 mt-1">Last error: {status.lastError}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                                <button
                                    onClick={running ? handleStop : handleStart}
                                    disabled={statusLoading}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                        running
                                            ? 'bg-red-600 hover:bg-red-500'
                                            : 'bg-green-600 hover:bg-green-500'
                                    }`}
                                >
                                    {statusLoading
                                        ? 'Working...'
                                        : running
                                        ? 'Stop server'
                                        : 'Start server'}
                                </button>
                                <button
                                    onClick={refreshStatus}
                                    disabled={statusLoading}
                                    className="px-3 py-1 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-100"
                                >
                                    Refresh status
                                </button>
                            </div>
                        </div>
                    </div>

                    {(favoriteModels.length > 0 || danglingFavorites.length > 0) && (
                        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-3">
                            <h3 className="text-xl font-semibold mb-2 text-pink-300">Favorite local models</h3>
                            <p className="text-xs text-gray-400">
                                Quick access to your most-used GGUF files.
                            </p>
                            {favoriteModels.length > 0 && (
                                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {favoriteModels.map((model) => (
                                        <div
                                            key={model.path}
                                            className="flex items-center justify-between rounded-lg border border-gray-700 px-3 py-2"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-100 truncate">{model.name}</p>
                                                <p className="text-[11px] text-gray-400 truncate">
                                                    {model.sizeBytes
                                                        ? `${(model.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                                                        : ''}
                                                    {model.mtime
                                                        ? ` • ${new Date(model.mtime).toLocaleString()}`
                                                        : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-3">
                                                <button
                                                    onClick={() => handleSetDefaultModel(model)}
                                                    disabled={saving}
                                                    className="px-3 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold"
                                                >
                                                    Set as default
                                                </button>
                                                <button
                                                    onClick={() => handleToggleFavorite(model)}
                                                    disabled={saving}
                                                    className="px-2 py-1 rounded-lg text-xs bg-yellow-700 hover:bg-yellow-600 disabled:bg-yellow-900 text-white font-semibold"
                                                    aria-label="Remove from favorites"
                                                    title="Remove from favorites"
                                                >
                                                    ★
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {danglingFavorites.length > 0 && (
                                <div className="mt-3 space-y-1 border-t border-gray-700 pt-3">
                                    <p className="text-xs text-yellow-300 flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-600 text-[10px]">
                                            !
                                        </span>
                                        Some favorites are missing on disk. They may have been moved or deleted.
                                    </p>
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                        {danglingFavorites.map((name) => (
                                            <div
                                                key={name}
                                                className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/60 rounded px-2 py-1"
                                            >
                                                <span className="truncate">{name}</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!window.electronAPI || !settings) return;
                                                        setSaving(true);
                                                        setError(null);
                                                        try {
                                                            const existing = Array.isArray(settings.favorites)
                                                                ? settings.favorites
                                                                : [];
                                                            const nextFavorites = existing.filter(
                                                                (fav) => fav !== name,
                                                            );
                                                            const next: LlamaSettings = {
                                                                ...settings,
                                                                favorites: nextFavorites,
                                                            };
                                                            await window.electronAPI.saveLlamaSettings(next);
                                                            setSettings(next);
                                                        } catch (e: any) {
                                                            setError(
                                                                e?.message ||
                                                                    'Failed to clear missing favorite',
                                                            );
                                                        } finally {
                                                            setSaving(false);
                                                        }
                                                    }}
                                                    className="ml-2 px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-[11px] text-gray-100"
                                                    aria-label="Remove missing favorite"
                                                    title="Remove missing favorite"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-6">
                        <h3 className="text-xl font-semibold mb-2 text-yellow-400">Model downloads</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-300">Search on Hugging Face</label>
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="text"
                                        value={hfQuery}
                                        onChange={(e) => setHfQuery(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="e.g. Llama 3 GGUF, phi-2 GGUF, Q4_K_M"
                                    />
                                    <button
                                        onClick={handleHfSearch}
                                        disabled={hfSearching || !hfQuery.trim()}
                                        className="px-4 py-2 rounded-lg text-sm bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 text-white font-semibold"
                                    >
                                        {hfSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                                    <span className="text-gray-400">Safe starter searches:</span>
                                    <button
                                        type="button"
                                        onClick={() => handleHfPresetSearch('Llama 3.1 8B Instruct GGUF')}
                                        className="px-2 py-1 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
                                    >
                                        Llama 3.1 8B
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleHfPresetSearch('phi-2 GGUF')}
                                        className="px-2 py-1 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
                                    >
                                        Phi-2
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleHfPresetSearch('CodeLlama GGUF')}
                                        className="px-2 py-1 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
                                    >
                                        Code Llama
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleHfPresetSearch('Q4_K_M GGUF')}
                                        className="px-2 py-1 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
                                    >
                                        Q4_K_M small
                                    </button>
                                </div>
                                {hfSearchError && (
                                    <p className="text-xs text-red-400 mt-1">{hfSearchError}</p>
                                )}
                                {hfResults.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-2">
                                        Showing {hfResults.length} model{hfResults.length === 1 ? '' : 's'}
                                        with GGUF files.
                                    </p>
                                )}
                            </div>

                            {hfResults.length > 0 && (
                                <div className="max-h-64 overflow-y-auto space-y-3 pr-1 mt-2">
                                    {hfResults.map((result) => {
                                        const selectedFile =
                                            hfSelectedFiles[result.repoId] ||
                                            result.recommendedFile ||
                                            result.ggufFiles[0];
                                        return (
                                            <div
                                                key={result.repoId}
                                                className="border border-gray-700 rounded-lg px-3 py-2 flex flex-col gap-1"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-gray-100 truncate">
                                                            {result.repoId}
                                                        </p>
                                                        {result.description && (
                                                            <p className="text-xs text-gray-400 truncate">
                                                                {result.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <select
                                                            value={selectedFile || ''}
                                                            onChange={(e) =>
                                                                setHfSelectedFiles((prev) => ({
                                                                    ...prev,
                                                                    [result.repoId]: e.target.value,
                                                                }))
                                                            }
                                                            className="max-w-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100"
                                                            aria-label="Select GGUF file to download for this model"
                                                            title="Select GGUF file to download for this model"
                                                        >
                                                            {result.ggufFiles.map((file) => (
                                                                <option key={file} value={file}>
                                                                    {file === result.recommendedFile
                                                                        ? `${file} (recommended)`
                                                                        : file}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleHfDownload(result, selectedFile)}
                                                            disabled={hfDownloadingRepo === result.repoId}
                                                            className="px-3 py-1 rounded-lg text-xs bg-green-600 hover:bg-green-500 disabled:bg-green-900 text-white font-semibold whitespace-nowrap"
                                                        >
                                                            {hfDownloadingRepo === result.repoId
                                                                ? 'Downloading...'
                                                                : 'Download & set default'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                                    {typeof result.downloads === 'number' && (
                                                        <span>{result.downloads.toLocaleString()} downloads</span>
                                                    )}
                                                    {typeof result.likes === 'number' && (
                                                        <span>{result.likes.toLocaleString()} likes</span>
                                                    )}
                                                    {result.architecture && (
                                                        <span>{result.architecture}</span>
                                                    )}
                                                    {typeof result.contextLength === 'number' && (
                                                        <span>
                                                            {(result.contextLength / 1000).toFixed(0)}k ctx
                                                        </span>
                                                    )}
                                                    {result.license && (
                                                        <span>License: {result.license}</span>
                                                    )}
                                                    {result.recommendedFile && (
                                                        <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-100">
                                                            {result.recommendedFile}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                                                    {result.ggufFiles.length > 1 ? (
                                                        <span className="truncate">
                                                            {result.ggufFiles.length} GGUF files available
                                                        </span>
                                                    ) : (
                                                        <span>1 GGUF file available</span>
                                                    )}
                                                    <a
                                                        href={`https://huggingface.co/${result.repoId}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 ml-2 whitespace-nowrap"
                                                    >
                                                        View on Hugging Face
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-700 mt-2 space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">
                                        Direct model URL (advanced)
                                    </label>
                                    <input
                                        type="text"
                                        value={downloadUrl}
                                        onChange={(e) => setDownloadUrl(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="https://huggingface.co/.../model.gguf"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300">
                                        Save as (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={downloadFileName}
                                        onChange={(e) => setDownloadFileName(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="Defaults to file name from URL"
                                    />
                                </div>
                                <div className="pt-2 flex items-center justify-between gap-3">
                                    <button
                                        onClick={handleDownload}
                                        disabled={downloading || !downloadUrl.trim()}
                                        className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-900 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
                                    >
                                        {downloading ? 'Downloading...' : 'Download model'}
                                    </button>
                                    {downloadMessage && (
                                        <p className="text-xs text-gray-300 truncate">{downloadMessage}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-3">
                        <h3 className="text-xl font-semibold mb-2 text-green-300">Local models</h3>
                        <p className="text-xs text-gray-400">Models in {settings.modelsDir}</p>
                        {localModels.length === 0 ? (
                            <p className="text-sm text-gray-400 mt-2">
                                No .gguf models found in this directory yet.
                            </p>
                        ) : (
                            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                                {localModels.map((model) => {
                                    const isFavorite = currentFavorites.includes(model.name);
                                    return (
                                        <div
                                            key={model.path}
                                            className="flex items-center justify-between rounded-lg border border-gray-700 px-3 py-2"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-100 truncate">{model.name}</p>
                                                <p className="text-[11px] text-gray-400 truncate">
                                                    {model.sizeBytes
                                                        ? `${(model.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                                                        : ''}
                                                    {model.mtime
                                                        ? ` • ${new Date(model.mtime).toLocaleString()}`
                                                        : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-3">
                                                <button
                                                    onClick={() => handleToggleFavorite(model)}
                                                    disabled={saving}
                                                    className="px-2 py-1 rounded-lg text-xs bg-yellow-700 hover:bg-yellow-600 disabled:bg-yellow-900 text-white font-semibold"
                                                    aria-label={
                                                        isFavorite
                                                            ? 'Remove from favorites'
                                                            : 'Add to favorites'
                                                    }
                                                    title={
                                                        isFavorite
                                                            ? 'Remove from favorites'
                                                            : 'Add to favorites'
                                                    }
                                                >
                                                    {isFavorite ? '★' : '☆'}
                                                </button>
                                                <button
                                                    onClick={() => handleSetDefaultModel(model)}
                                                    disabled={saving}
                                                    className="px-3 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold"
                                                >
                                                    Set as default
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteModel(model)}
                                                    disabled={localModelsBusy}
                                                    className="px-3 py-1 rounded-lg text-xs bg-red-700 hover:bg-red-600 disabled:bg-red-900 text-white font-semibold"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                        <h3 className="text-xl font-semibold mb-2 text-blue-400">Runtime configuration</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-300">Llama server path</label>
                                <input
                                    type="text"
                                    value={settings.serverPath}
                                    onChange={(e) => handleSettingsChange({ serverPath: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    placeholder="C:\\path\\to\\llama-server.exe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300">Models directory</label>
                                <input
                                    type="text"
                                    value={settings.modelsDir}
                                    onChange={(e) => handleSettingsChange({ modelsDir: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    placeholder="C:\\path\\to\\llama-models"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300">Default model file</label>
                                <input
                                    type="text"
                                    value={settings.defaultModel}
                                    onChange={(e) => handleSettingsChange({ defaultModel: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    placeholder="model.gguf or relative path under models directory"
                                />
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300">Port</label>
                                    <input
                                        type="number"
                                        value={settings.port}
                                        onChange={(e) => handleSettingsChange({ port: Number(e.target.value) || 0 })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        placeholder="8080"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-300 mt-5">
                                    <input
                                        type="checkbox"
                                        checked={settings.autoStart}
                                        onChange={(e) => handleSettingsChange({ autoStart: e.target.checked })}
                                        className="form-checkbox h-4 w-4 text-blue-500"
                                    />
                                    Start server automatically with app
                                </label>
                            </div>
                        </div>
                        <div className="pt-2 flex items-center justify-between">
                            <PrimaryButton
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6"
                            >
                                {saving ? 'Saving...' : 'Save configuration'}
                            </PrimaryButton>
                            <button
                                onClick={loadSettingsAndStatus}
                                disabled={loading}
                                className="text-sm text-gray-300 hover:text-white"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-2">
                        <h3 className="text-lg font-semibold text-purple-400">Next steps</h3>
                        <p className="text-sm text-gray-300">
                            Once the runtime is configured and running, select the provider
                            <span className="px-2 py-1 mx-1 rounded bg-gray-700 text-xs">Local (llama.cpp)</span>
                            in the Chat screen to talk to your local model.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocalLlama;
