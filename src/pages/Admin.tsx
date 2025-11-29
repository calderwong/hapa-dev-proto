import React, { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';
import { PrimaryButton } from '../components/Button';

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
        <PageContainer noPadding>
            <div className="flex h-full">
                <div className="w-72 border-r border-gray-800 bg-gray-900 p-4 overflow-y-auto">
                <h2 className="text-xl font-semibold mb-4">Gemini Requests</h2>
                {entries.length === 0 ? (
                    <p className="text-sm text-gray-500">No requests have been logged yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {entries.map((entry) => (
                            <li key={entry.id}>
                                <button
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                        entry.id === selectedId
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                    }`}
                                    onClick={() => handleSelect(entry)}
                                >
                                    <div className="truncate">
                                        {entry.model || 'model?'}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate">
                                        {entry.createdAt}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="flex-1 p-4 flex flex-col bg-gray-900">
                <div className="mb-4 p-3 rounded-lg bg-gray-800 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-semibold">Admin Settings</h2>
                        {settingsStatus && (
                            <span className="text-xs text-green-400">{settingsStatus}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-200">
                        <span>Audio mode:</span>
                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="audio-mode"
                                value="transcribe"
                                checked={audioMode === 'transcribe'}
                                onChange={() => handleAudioModeChange('transcribe')}
                                disabled={settingsSaving}
                            />
                            <span>Transcribe first</span>
                        </label>
                        <label className="inline-flex items-center gap-1">
                            <input
                                type="radio"
                                name="audio-mode"
                                value="realtime"
                                checked={audioMode === 'realtime'}
                                onChange={() => handleAudioModeChange('realtime')}
                                disabled={settingsSaving}
                            />
                            <span>Realtime (stub)</span>
                        </label>
                    </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-xl font-semibold">Request JSON</h2>
                        {selectedEntry && (
                            <p className="text-xs text-gray-400 mt-1">
                                id: {selectedEntry.id}
                            </p>
                        )}
                    </div>
                    <PrimaryButton
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !editorValue}
                        className="px-4 py-2 text-sm font-medium"
                    >
                        {isSaving ? 'Saving…' : 'Save'}
                    </PrimaryButton>
                </div>
                {error && (
                    <div className="mb-3 text-sm text-red-400">
                        {error}
                    </div>
                )}
                <div className="flex-1">
                    <textarea
                        className="w-full h-full bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-100 resize-none"
                        value={editorValue}
                        onChange={(e) => setEditorValue(e.target.value)}
                        aria-label="Gemini request JSON"
                        placeholder="Edit Gemini request JSON payload"
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
        </PageContainer>
    );
};

export default Admin;
