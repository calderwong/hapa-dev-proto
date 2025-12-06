// @ts-nocheck
import React, { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';

interface GeminiRequestEntry {
    id: string;
    createdAt: string;
    updatedAt?: string;
    model?: string;
    payload?: any;
    [key: string]: any;
}

interface ImageGenSettings {
    defaultImageModel: string;
    defaultPromptLLM: string;
}

interface PipelineSettings {
    thorThrottleMs: number;
    mediaThrottleMs: number;
}

const DEFAULT_IMAGE_GEN_SETTINGS: ImageGenSettings = {
    defaultImageModel: 'gemini-2.0-flash-preview-image-generation',
    defaultPromptLLM: 'gemini-1.5-pro',
};

const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
    thorThrottleMs: 2000,
    mediaThrottleMs: 3000,
};

const Admin: React.FC = () => {
    const [entries, setEntries] = useState<GeminiRequestEntry[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [audioMode, setAudioMode] = useState<'transcribe' | 'realtime'>('transcribe');
    const [settingsStatus, setSettingsStatus] = useState('');
    const [settingsSaving, setSettingsSaving] = useState(false);
    
    // Image Generation Settings
    const [imageGenSettings, setImageGenSettings] = useState<ImageGenSettings>(DEFAULT_IMAGE_GEN_SETTINGS);
    const [availableModels, setAvailableModels] = useState<{name: string, displayName: string}[]>([]);
    const [imageGenStatus, setImageGenStatus] = useState('');
    
    // Pipeline Settings (Hell Week)
    const [pipelineSettings, setPipelineSettings] = useState<PipelineSettings>(DEFAULT_PIPELINE_SETTINGS);
    const [pipelineStatus, setPipelineStatus] = useState('');

    // Vertex AI Settings
    const [vertexSettings, setVertexSettings] = useState({
        enabled: false,
        projectId: '',
        region: 'us-central1',
        apiKey: '',
        defaultSmartLLM: 'gemini-3.0-pro',
        defaultFastLLM: 'gemini-2.5-flash-lite',
        defaultProImage: 'imagen-4.0-generate-001',
        defaultCommonImage: 'gemini-2.0-flash-exp',
        defaultVideo: 'veo-3.1-generate-preview',
    });
    const [vertexStatus, setVertexStatus] = useState('');
    const [vertexSaving, setVertexSaving] = useState(false);
    const [vertexTesting, setVertexTesting] = useState(false);

    const loadEntries = async () => {
        if (!window.electronAPI || !window.electronAPI.geminiListRequests) {
            return;
        }
        const data = await window.electronAPI.geminiListRequests();
        if (Array.isArray(data)) {
            const sorted = [...data].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            setEntries(sorted);
            if (!selectedId && sorted.length > 0) {
                const first = sorted[0];
                setSelectedId(first.id);
                setEditorValue(JSON.stringify(first, null, 2));
                setError('');
            } else if (selectedId) {
                const existing = sorted.find((e) => e.id === selectedId);
                if (existing) {
                    setEditorValue(JSON.stringify(existing, null, 2));
                }
            }
        }
    };

    useEffect(() => {
        loadEntries();
        const loadAdminSettings = async () => {
            if (!window.electronAPI || !window.electronAPI.getAdminSettings) {
                return;
            }
            try {
                const settings = await window.electronAPI.getAdminSettings();
                if (settings && (settings.audioMode === 'transcribe' || settings.audioMode === 'realtime')) {
                    setAudioMode(settings.audioMode);
                }
                // Load image gen settings
                if (settings?.imageGenSettings) {
                    setImageGenSettings({
                        defaultImageModel: settings.imageGenSettings.defaultImageModel || DEFAULT_IMAGE_GEN_SETTINGS.defaultImageModel,
                        defaultPromptLLM: settings.imageGenSettings.defaultPromptLLM || DEFAULT_IMAGE_GEN_SETTINGS.defaultPromptLLM,
                    });
                }
                // Load pipeline settings
                if (settings?.pipelineSettings) {
                    setPipelineSettings({
                        thorThrottleMs: settings.pipelineSettings.thorThrottleMs ?? DEFAULT_PIPELINE_SETTINGS.thorThrottleMs,
                        mediaThrottleMs: settings.pipelineSettings.mediaThrottleMs ?? DEFAULT_PIPELINE_SETTINGS.mediaThrottleMs,
                    });
                }
            } catch (err) {
                console.error('Failed to load admin settings', err);
            }
        };
        loadAdminSettings();
        
        // Load available models
        const loadModels = async () => {
            if (window.electronAPI?.listGeminiModels) {
                try {
                    const models = await window.electronAPI.listGeminiModels();
                    setAvailableModels(models.filter((m: any) => !m.isVideoModel));
                } catch (e) {
                    console.error('Failed to load models', e);
                }
            }
        };
        loadModels();

        // Load Vertex AI settings
        const loadVertexSettings = async () => {
            if (window.electronAPI?.getVertexAISettings) {
                try {
                    const settings = await window.electronAPI.getVertexAISettings();
                    if (settings) {
                        setVertexSettings(prev => ({ ...prev, ...settings }));
                    }
                } catch (e) {
                    console.error('Failed to load Vertex AI settings', e);
                }
            }
        };
        loadVertexSettings();
    }, []);

    const handleSelect = (entry: GeminiRequestEntry) => {
        setSelectedId(entry.id);
        setEditorValue(JSON.stringify(entry, null, 2));
        setError('');
    };

    const handleAudioModeChange = async (mode: 'transcribe' | 'realtime') => {
        setAudioMode(mode);
        if (!window.electronAPI || !window.electronAPI.saveAdminSettings) {
            return;
        }
        try {
            setSettingsSaving(true);
            setSettingsStatus('');
            await window.electronAPI.saveAdminSettings({ audioMode: mode });
            setSettingsStatus('Audio mode saved');
            setTimeout(() => setSettingsStatus(''), 3000);
        } catch (err) {
            console.error('Failed to save admin settings', err);
            setSettingsStatus('Failed to save audio mode');
        } finally {
            setSettingsSaving(false);
        }
    };

    // Vertex AI handlers
    const handleSaveVertexSettings = async () => {
        if (!window.electronAPI?.saveVertexAISettings) return;
        try {
            setVertexSaving(true);
            setVertexStatus('');
            await window.electronAPI.saveVertexAISettings(vertexSettings);
            setVertexStatus('Saved successfully!');
            setTimeout(() => setVertexStatus(''), 3000);
        } catch (err) {
            console.error('Failed to save Vertex AI settings', err);
            setVertexStatus('Failed to save settings');
        } finally {
            setVertexSaving(false);
        }
    };

    const handleTestVertexConnection = async () => {
        if (!window.electronAPI?.testVertexAIConnection) return;
        try {
            setVertexTesting(true);
            setVertexStatus('Testing connection...');
            const result = await window.electronAPI.testVertexAIConnection();
            if (result.success) {
                setVertexStatus(`✓ Connection successful! ${result.message}`);
            } else {
                setVertexStatus(`✗ Connection failed: ${result.message}`);
            }
        } catch (err: any) {
            console.error('Failed to test Vertex AI connection', err);
            setVertexStatus(`✗ Error: ${err.message || 'Unknown error'}`);
        } finally {
            setVertexTesting(false);
        }
    };
    
    const handleImageGenSettingsChange = async (key: keyof ImageGenSettings, value: string) => {
        const newSettings = { ...imageGenSettings, [key]: value };
        setImageGenSettings(newSettings);
        
        if (!window.electronAPI || !window.electronAPI.saveAdminSettings) {
            return;
        }
        try {
            setImageGenStatus('Saving...');
            await window.electronAPI.saveAdminSettings({ imageGenSettings: newSettings });
            setImageGenStatus('Saved');
            setTimeout(() => setImageGenStatus(''), 2000);
        } catch (err) {
            console.error('Failed to save image gen settings', err);
            setImageGenStatus('Failed to save');
        }
    };
    
    // Filter models for image generation (contains 'image' or 'nano-banana')
    const imageModels = availableModels.filter(m => 
        m.name.toLowerCase().includes('image') || m.name.toLowerCase().includes('nano-banana')
    );
    
    // Filter models for LLM (text models, not image or video)
    const llmModels = availableModels.filter(m => 
        !m.name.toLowerCase().includes('image') && 
        !m.name.toLowerCase().includes('nano-banana') &&
        !m.name.toLowerCase().includes('veo')
    );

    const handleSave = async () => {
        if (!window.electronAPI || !window.electronAPI.geminiSaveRequest) {
            return;
        }
        try {
            setIsSaving(true);
            setError('');
            const parsed = JSON.parse(editorValue);
            const saved = await window.electronAPI.geminiSaveRequest(parsed);
            const next = [...entries];
            const index = next.findIndex((e) => e.id === saved.id);
            if (index >= 0) {
                next[index] = saved;
            } else {
                next.unshift(saved);
            }
            setEntries(next);
            setSelectedId(saved.id);
            setEditorValue(JSON.stringify(saved, null, 2));
        } catch (err: any) {
            setError(err?.message || 'Failed to save entry');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedEntry = selectedId
        ? entries.find((e) => e.id === selectedId) || null
        : null;

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
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #60a5fa;
                    transition: all 0.2s;
                }
                .btn-primary:hover {
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
                            <rux-icon icon="settings-remote" size="large"></rux-icon>
                            ADMIN CONSOLE <span className="text-red-400 text-lg font-mono font-normal opacity-80">// SYSTEM OVERVIEW</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            MANAGE SYSTEM SETTINGS AND INSPECT REQUEST LOGS
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-250px)]">
                    {/* Left Column: Controls & Logs */}
                    <div className="space-y-6 flex flex-col h-full">
                        {/* System Controls */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="tune" size="extra-small"></rux-icon>
                                System Controls
                            </div>
                            <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500 opacity-60"></div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-white">AUDIO PROCESSING MODE</span>
                                    {settingsStatus && (
                                        <span className="text-[10px] text-green-400 font-mono animate-pulse">{settingsStatus}</span>
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <label className={`flex-1 cursor-pointer p-2 rounded border transition-all ${audioMode === 'transcribe' ? 'bg-red-500/20 border-red-500/50' : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'}`}>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="audio-mode"
                                                value="transcribe"
                                                checked={audioMode === 'transcribe'}
                                                onChange={() => handleAudioModeChange('transcribe')}
                                                disabled={settingsSaving}
                                                className="hidden"
                                            />
                                            <div className={`w-2 h-2 rounded-full ${audioMode === 'transcribe' ? 'bg-red-400' : 'bg-gray-600'}`}></div>
                                            <span className="text-xs font-mono text-gray-300">TRANSCRIBE</span>
                                        </div>
                                    </label>
                                    <label className={`flex-1 cursor-pointer p-2 rounded border transition-all ${audioMode === 'realtime' ? 'bg-red-500/20 border-red-500/50' : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'}`}>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="audio-mode"
                                                value="realtime"
                                                checked={audioMode === 'realtime'}
                                                onChange={() => handleAudioModeChange('realtime')}
                                                disabled={settingsSaving}
                                                className="hidden"
                                            />
                                            <div className={`w-2 h-2 rounded-full ${audioMode === 'realtime' ? 'bg-red-400' : 'bg-gray-600'}`}></div>
                                            <span className="text-xs font-mono text-gray-300">REALTIME</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Vertex AI Configuration - PRIMARY PROVIDER */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="cloud" size="extra-small"></rux-icon>
                                Vertex AI (Default Provider)
                            </div>
                            <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-60"></div>
                                
                                {/* Enable Toggle */}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-white">ENABLE VERTEX AI</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={vertexSettings.enabled}
                                            onChange={(e) => setVertexSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>

                                {/* Project ID */}
                                <div className="mb-3">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">
                                        Google Cloud Project ID
                                    </label>
                                    <input
                                        type="text"
                                        value={vertexSettings.projectId}
                                        onChange={(e) => setVertexSettings(prev => ({ ...prev, projectId: e.target.value }))}
                                        placeholder="my-gcp-project-id"
                                        className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>

                                {/* Region */}
                                <div className="mb-3">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">
                                        Region
                                    </label>
                                    <select
                                        value={vertexSettings.region}
                                        onChange={(e) => setVertexSettings(prev => ({ ...prev, region: e.target.value }))}
                                        className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                    >
                                        <option value="us-central1">US Central (Iowa)</option>
                                        <option value="us-east4">US East (Virginia)</option>
                                        <option value="us-west1">US West (Oregon)</option>
                                        <option value="europe-west4">Europe West (Netherlands)</option>
                                        <option value="asia-northeast1">Asia Northeast (Tokyo)</option>
                                    </select>
                                </div>

                                {/* API Key */}
                                <div className="mb-4">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">
                                        Vertex AI API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={vertexSettings.apiKey}
                                        onChange={(e) => setVertexSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="Enter your Vertex AI API key"
                                        className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>

                                {/* Model Shortcuts */}
                                <div className="border-t border-gray-700 pt-3 mb-3">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Default Models</div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="flex justify-between items-center bg-gray-800/50 rounded px-2 py-1">
                                            <span className="text-emerald-300">Smart LLM</span>
                                            <span className="text-gray-400 font-mono">Gemini 2.5 Pro</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-800/50 rounded px-2 py-1">
                                            <span className="text-emerald-300">Fast LLM</span>
                                            <span className="text-gray-400 font-mono">Gemini 2.5 Flash</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-800/50 rounded px-2 py-1">
                                            <span className="text-emerald-300">Pro Image</span>
                                            <span className="text-gray-400 font-mono">Imagen 3</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-800/50 rounded px-2 py-1">
                                            <span className="text-emerald-300">Common Image</span>
                                            <span className="text-gray-400 font-mono">Gemini 2.0 Flash</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-gray-800/50 rounded px-2 py-1 col-span-2">
                                            <span className="text-emerald-300">Video</span>
                                            <span className="text-gray-400 font-mono">Veo 2</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveVertexSettings}
                                        disabled={vertexSaving}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-xs rounded transition-colors font-mono"
                                    >
                                        {vertexSaving ? 'Saving...' : 'Save Settings'}
                                    </button>
                                    <button
                                        onClick={handleTestVertexConnection}
                                        disabled={vertexTesting || !vertexSettings.projectId || !vertexSettings.apiKey}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs rounded transition-colors font-mono"
                                    >
                                        {vertexTesting ? 'Testing...' : 'Test Connection'}
                                    </button>
                                </div>
                                {vertexStatus && (
                                    <div className={`mt-2 text-xs font-mono ${vertexStatus.includes('success') || vertexStatus.includes('Saved') ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {vertexStatus}
                                    </div>
                                )}
                                
                                <div className="mt-3 text-[9px] text-gray-500 font-mono">
                                    Vertex AI provides enterprise-grade access to Gemini 2.5, Imagen 3, and Veo 2
                                </div>
                            </div>
                        </div>
                        
                        {/* Image Generation Settings */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="image" size="extra-small"></rux-icon>
                                Image Generation (Legacy)
                            </div>
                            <div className="glass-panel p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-60"></div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-white">AI IMAGE DEFAULTS (Google AI Studio)</span>
                                    {imageGenStatus && (
                                        <span className={`text-[10px] font-mono animate-pulse ${imageGenStatus === 'Saved' ? 'text-green-400' : 'text-cyan-400'}`}>
                                            {imageGenStatus}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Image Model Selector */}
                                <div className="mb-4">
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                                        Image Generation Model
                                    </label>
                                    <select
                                        value={imageGenSettings.defaultImageModel}
                                        onChange={(e) => handleImageGenSettingsChange('defaultImageModel', e.target.value)}
                                        className="w-full bg-gray-900/80 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
                                        title="Select the model for generating images"
                                    >
                                        {imageModels.length > 0 ? (
                                            imageModels.map(m => (
                                                <option key={m.name} value={m.name}>{m.displayName}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="gemini-2.0-flash-preview-image-generation">Gemini 2.0 Flash Image</option>
                                                <option value="imagen-3.0-generate-002">Imagen 3</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                
                                {/* Prompt LLM Selector */}
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
                                        Prompt Crafting LLM
                                    </label>
                                    <select
                                        value={imageGenSettings.defaultPromptLLM}
                                        onChange={(e) => handleImageGenSettingsChange('defaultPromptLLM', e.target.value)}
                                        className="w-full bg-gray-900/80 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
                                        title="Select the LLM model for crafting image prompts"
                                    >
                                        {llmModels.length > 0 ? (
                                            llmModels.map(m => (
                                                <option key={m.name} value={m.name}>{m.displayName}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                                <option value="gemini-pro-latest">Gemini Pro Latest</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                
                                <div className="mt-3 text-[9px] text-gray-500 font-mono">
                                    Used for one-click "Create Image" on cards
                                </div>
                            </div>
                        </div>

                        {/* Hell Week Pipeline Settings */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-orange-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="rocket" size="extra-small"></rux-icon>
                                Hell Week Pipeline
                            </div>
                            <div className="glass-panel rounded-xl p-4 relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-60"></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">
                                            Thor Throttle (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={pipelineSettings.thorThrottleMs}
                                            onChange={(e) => setPipelineSettings(prev => ({ ...prev, thorThrottleMs: parseInt(e.target.value) || 0 }))}
                                            className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                                            min={0}
                                            step={500}
                                            title="Delay between chunk processing (ms)"
                                            placeholder="2000"
                                        />
                                        <div className="text-[9px] text-gray-500 mt-1">Delay between chunks</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 block">
                                            Media Throttle (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={pipelineSettings.mediaThrottleMs}
                                            onChange={(e) => setPipelineSettings(prev => ({ ...prev, mediaThrottleMs: parseInt(e.target.value) || 0 }))}
                                            className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                                            min={0}
                                            step={500}
                                            title="Delay between image generations (ms)"
                                            placeholder="3000"
                                        />
                                        <div className="text-[9px] text-gray-500 mt-1">Delay between images</div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={async () => {
                                        if (window.electronAPI?.saveAdminSettings) {
                                            setPipelineStatus('Saving...');
                                            await window.electronAPI.saveAdminSettings({ pipelineSettings });
                                            setPipelineStatus('Saved!');
                                            setTimeout(() => setPipelineStatus(''), 2000);
                                        }
                                    }}
                                    className="mt-3 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded transition-colors font-mono"
                                >
                                    Save Pipeline Settings
                                </button>
                                {pipelineStatus && (
                                    <span className="ml-2 text-xs text-orange-400">{pipelineStatus}</span>
                                )}
                                
                                <div className="mt-3 text-[9px] text-gray-500 font-mono">
                                    Throttle API calls to avoid rate limits (429 errors)
                                </div>
                            </div>
                        </div>

                        {/* Request Log */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase">
                                    <rux-icon icon="history" size="extra-small"></rux-icon>
                                    Request Log
                                </div>
                                <button
                                    onClick={loadEntries}
                                    className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                                    title="Refresh Logs"
                                >
                                    <rux-icon icon="refresh" size="small"></rux-icon>
                                </button>
                            </div>

                            <div className="glass-panel rounded-xl flex-1 overflow-hidden flex flex-col relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-60"></div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {entries.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                            <rux-icon icon="assignment" size="large" className="mb-2"></rux-icon>
                                            <p className="text-xs font-mono">NO LOGS FOUND</p>
                                        </div>
                                    ) : (
                                        entries.map((entry) => (
                                            <button
                                                key={entry.id}
                                                onClick={() => handleSelect(entry)}
                                                className={`w-full text-left p-3 rounded-lg border transition-all group ${entry.id === selectedId
                                                        ? 'bg-blue-500/20 border-blue-500/50'
                                                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-xs font-bold font-mono ${entry.id === selectedId ? 'text-blue-300' : 'text-gray-300 group-hover:text-white'}`}>
                                                        {entry.model || 'UNKNOWN_MODEL'}
                                                    </span>
                                                    <rux-icon icon="chevron-right" size="extra-small" className={`transition-transform ${entry.id === selectedId ? 'text-blue-400 rotate-90' : 'text-gray-600'}`}></rux-icon>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono truncate">
                                                    ID: {entry.id}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-mono mt-1">
                                                    {new Date(entry.createdAt).toLocaleString()}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Payload Inspector */}
                    <div className="lg:col-span-2 flex flex-col h-full min-h-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-purple-400 font-bold tracking-widest text-xs uppercase">
                                <rux-icon icon="code" size="extra-small"></rux-icon>
                                Payload Inspector
                            </div>
                            <div className="flex items-center gap-2">
                                {error && (
                                    <span className="text-xs text-red-400 font-mono bg-red-900/20 px-2 py-1 rounded border border-red-900/50">
                                        {error}
                                    </span>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !editorValue}
                                    className="btn-primary px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <rux-icon icon="save" size="extra-small"></rux-icon>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>

                        <div className="glass-panel rounded-xl flex-1 overflow-hidden relative flex flex-col">
                            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60"></div>
                            {selectedEntry ? (
                                <textarea
                                    className="flex-1 w-full bg-black/30 p-4 font-mono text-xs text-gray-300 resize-none focus:outline-none custom-scrollbar leading-relaxed"
                                    value={editorValue}
                                    onChange={(e) => setEditorValue(e.target.value)}
                                    spellCheck={false}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50">
                                    <rux-icon icon="touch-app" size="large" className="mb-2"></rux-icon>
                                    <p className="text-xs font-mono">SELECT A REQUEST TO INSPECT</p>
                                </div>
                            )}

                            {selectedEntry && (
                                <div className="bg-black/40 border-t border-gray-800 p-2 flex justify-between items-center text-[10px] font-mono text-gray-500 px-4">
                                    <span>JSON EDITOR MODE</span>
                                    <span>{editorValue.length} BYTES</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default Admin;
