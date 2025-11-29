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

const Admin: React.FC = () => {
    const [entries, setEntries] = useState<GeminiRequestEntry[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editorValue, setEditorValue] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [audioMode, setAudioMode] = useState<'transcribe' | 'realtime'>('transcribe');
    const [settingsStatus, setSettingsStatus] = useState('');
    const [settingsSaving, setSettingsSaving] = useState(false);

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
            } catch (err) {
                console.error('Failed to load admin settings', err);
            }
        };
        loadAdminSettings();
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
