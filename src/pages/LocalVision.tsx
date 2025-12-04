// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { LocalVisionSettings, LocalVisionStatus, VisionModel } from '../types';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import PageContainer from '../components/PageContainer';

const LocalVision: React.FC = () => {
    const [settings, setSettings] = useState<LocalVisionSettings | null>(null);
    const [status, setStatus] = useState<LocalVisionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [models, setModels] = useState<VisionModel[]>([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

    const DEFAULT_MODEL_ID = "stabilityai/sdxl-turbo";

    const loadSettingsAndStatus = async () => {
        if (!window.electronAPI) return;
        setLoading(true);
        setError(null);
        try {
            const [s, st] = await Promise.all([
                window.electronAPI.getLocalVisionSettings(),
                window.electronAPI.getLocalVisionStatus(),
            ]);
            setSettings(s);
            setStatus(st);
            
            if (st.running) {
                fetchModels();
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load vision runtime state');
        } finally {
            setLoading(false);
        }
    };

    const fetchModels = async () => {
        if (!window.electronAPI) return;
        setModelsLoading(true);
        try {
            const m = await window.electronAPI.listVisionModels();
            setModels(m || []);
        } catch (e: any) {
            console.error("Failed to list models", e);
            // Don't set global error here, just log it, as server might be initializing
        } finally {
            setModelsLoading(false);
        }
    };

    useEffect(() => {
        loadSettingsAndStatus();
        
        // Poll status and models every 5 seconds
        const interval = setInterval(async () => {
            if (!window.electronAPI) return;
            try {
                const st = await window.electronAPI.getLocalVisionStatus();
                setStatus(st);
                if (st.running) {
                    // Silently fetch models to update list (e.g. after download)
                    const m = await window.electronAPI.listVisionModels();
                    setModels(m || []);
                }
            } catch (e) {
                // Ignore polling errors
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSettingsChange = (patch: Partial<LocalVisionSettings>) => {
        setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    const handleSave = async () => {
        if (!window.electronAPI || !settings) return;
        setSaving(true);
        setError(null);
        try {
            await window.electronAPI.saveLocalVisionSettings(settings);
            await loadSettingsAndStatus();
        } catch (e: any) {
            setError(e?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const refreshStatus = async (silent = false) => {
        if (!window.electronAPI) return;
        if (!silent) setStatusLoading(true);
        try {
            const st = await window.electronAPI.getLocalVisionStatus();
            setStatus(st);
            if (st.running && !silent) {
                fetchModels();
            }
        } catch (e: any) {
            if (!silent) setError(e?.message || 'Failed to refresh status');
        } finally {
            if (!silent) setStatusLoading(false);
        }
    };

    const handleStart = async () => {
        if (!window.electronAPI) return;
        setStatusLoading(true);
        setError(null);
        try {
            const st = await window.electronAPI.startLocalVision();
            setStatus(st);
            // Wait a bit for server to spin up before fetching models
            setTimeout(fetchModels, 2000);
        } catch (e: any) {
            setError(e?.message || 'Failed to start vision server');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleStop = async () => {
        if (!window.electronAPI) return;
        setStatusLoading(true);
        setError(null);
        try {
            const st = await window.electronAPI.stopLocalVision();
            setStatus(st);
        } catch (e: any) {
            setError(e?.message || 'Failed to stop vision server');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleDownloadDefault = async () => {
        if (!window.electronAPI) return;
        if (!status?.running) {
            setError("Server must be running to download models (it handles the HF logic).");
            return;
        }
        
        setDownloading(true);
        setDownloadMessage("Starting download of Z-Image-Turbo... check server logs for details.");
        setError(null);
        try {
            await window.electronAPI.downloadVisionModel({ repo_id: DEFAULT_MODEL_ID, variant: 'fp16' });
            setDownloadMessage("Download started in background. Check server logs.");
            
            // Update active model setting
            if (settings) {
                handleSettingsChange({ activeModel: DEFAULT_MODEL_ID });
                await window.electronAPI.saveLocalVisionSettings({ ...settings, activeModel: DEFAULT_MODEL_ID });
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to trigger download');
            setDownloadMessage(null);
        } finally {
            setDownloading(false);
        }
    };

    const running = status?.running;

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
            `}</style>

            <div className="w-full max-w-[1600px] mx-auto pb-24">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <rux-icon icon="visibility" size="large"></rux-icon>
                            LOCAL VISION <span className="text-purple-400 text-lg font-mono font-normal opacity-80">// DIFFUSERS</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            MANAGE LOCAL IMAGE GENERATION PIPELINES
                        </p>
                    </div>
                    {settings && (
                        <div className="flex items-center gap-2">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${running
                                    ? 'bg-green-900/30 border-green-500/50 text-green-400'
                                    : 'bg-red-900/30 border-red-500/50 text-red-400'
                                }`}>
                                {running ? 'BRIDGE ONLINE' : 'BRIDGE OFFLINE'}
                            </div>
                        </div>
                    )}
                </div>

                {loading && <p className="text-gray-400 font-mono text-sm">INITIALIZING RUNTIME...</p>}
                {error && <p className="text-red-400 font-mono text-sm mb-4">ERROR: {error}</p>}

                {!loading && settings && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Status & Controls */}
                        <div className="space-y-6">
                            {/* Status Panel */}
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                                <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${running ? 'bg-purple-500' : 'bg-red-500'} opacity-60 group-hover:opacity-100`}></div>

                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-purple-400 font-bold tracking-widest text-xs uppercase">
                                        <rux-icon icon="settings-input-component" size="extra-small"></rux-icon>
                                        Python Bridge Status
                                    </div>
                                    <button
                                        onClick={() => refreshStatus(false)}
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
                                            {status?.model || settings.activeModel || '—'}
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
                                        tone={running ? 'red' : 'purple'}
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

                            {/* Configuration */}
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
                                <div className="flex items-center gap-2 text-gray-400 font-bold tracking-widest text-xs uppercase mb-4">
                                    <rux-icon icon="tune" size="extra-small"></rux-icon>
                                    Configuration
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="section-label">Python Executable Path</label>
                                        <input
                                            type="text"
                                            value={settings.pythonPath}
                                            onChange={(e) => handleSettingsChange({ pythonPath: e.target.value })}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="e.g. python or /usr/bin/python3"
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1">Must have: torch, diffusers, transformers, fastapi, uvicorn</p>
                                    </div>
                                    <div>
                                        <label className="section-label">Models Cache Directory</label>
                                        <input
                                            type="text"
                                            value={settings.modelsDir}
                                            onChange={(e) => handleSettingsChange({ modelsDir: e.target.value })}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="Path to HF cache..."
                                        />
                                    </div>
                                    <div>
                                        <label className="section-label">Active Model ID</label>
                                        <input
                                            type="text"
                                            value={settings.activeModel}
                                            onChange={(e) => handleSettingsChange({ activeModel: e.target.value })}
                                            className="w-full rounded-lg px-3 py-2 input-base font-mono text-xs"
                                            placeholder="e.g. Tongyi-MAI/Z-Image-Turbo"
                                        />
                                    </div>
                                    
                                    <PrimaryButton onClick={handleSave} disabled={saving} className="w-full justify-center mt-2">
                                        {saving ? 'SAVING...' : 'SAVE CONFIGURATION'}
                                    </PrimaryButton>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Models */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col h-full min-h-[600px]">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-60"></div>

                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase">
                                        <rux-icon icon="library-add" size="extra-small"></rux-icon>
                                        Model Library
                                    </div>
                                    <button 
                                        onClick={fetchModels} 
                                        disabled={!running || modelsLoading}
                                        className="text-gray-500 hover:text-white"
                                    >
                                        <rux-icon icon="refresh" size="small" className={modelsLoading ? "animate-spin" : ""}></rux-icon>
                                    </button>
                                </div>

                                <div className="space-y-4 flex-1">
                                    {/* Quick Install */}
                                    <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-lg">
                                        <h3 className="text-sm font-bold text-blue-200 mb-1">Recommended: Z-Image-Turbo</h3>
                                        <p className="text-[10px] text-blue-300/70 mb-3">
                                            High-quality, fast generation (4 steps). Best balance for local use.
                                        </p>
                                        <PrimaryButton 
                                            onClick={handleDownloadDefault} 
                                            disabled={downloading || !running}
                                            className="w-full justify-center text-xs"
                                        >
                                            {downloading ? 'DOWNLOADING...' : 'DOWNLOAD & SET ACTIVE'}
                                        </PrimaryButton>
                                        {downloadMessage && (
                                            <p className="text-[10px] text-blue-300 mt-2 font-mono animate-pulse">
                                                {downloadMessage}
                                            </p>
                                        )}
                                    </div>

                                    {/* Models List */}
                                    <div className="mt-6">
                                        <label className="section-label">Cached Models</label>
                                        <div className="space-y-2">
                                            {!running ? (
                                                <div className="text-center py-8 text-gray-600 text-xs font-mono border border-dashed border-gray-800 rounded-lg">
                                                    START SERVER TO VIEW MODELS
                                                </div>
                                            ) : models.length === 0 ? (
                                                <div className="text-center py-8 text-gray-600 text-xs font-mono border border-dashed border-gray-800 rounded-lg">
                                                    NO MODELS FOUND IN CACHE
                                                </div>
                                            ) : (
                                                models.map((m) => (
                                                    <div key={m.repo_id} className="p-3 bg-black/20 border border-gray-800 rounded-lg flex justify-between items-center">
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-gray-300 truncate" title={m.repo_id}>{m.repo_id}</div>
                                                            <div className="text-[10px] text-gray-500 font-mono">{m.size}</div>
                                                        </div>
                                                        {settings.activeModel !== m.repo_id && (
                                                            <button
                                                                onClick={() => {
                                                                    handleSettingsChange({ activeModel: m.repo_id });
                                                                    handleSave();
                                                                }}
                                                                className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-mono border border-blue-900/50 px-2 py-1 rounded"
                                                            >
                                                                ACTIVATE
                                                            </button>
                                                        )}
                                                        {settings.activeModel === m.repo_id && (
                                                            <span className="text-[10px] text-green-400 font-mono px-2 py-1 bg-green-900/20 rounded border border-green-900/50">ACTIVE</span>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
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

export default LocalVision;
