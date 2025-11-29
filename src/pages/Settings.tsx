import React, { useState, useEffect } from 'react';
import PageContainer from '../components/PageContainer';
import { PrimaryButton } from '../components/Button';
import type { WormholeSettings, WormholeProviderId } from '../types';

const ensureWormholeDefaults = (prev: WormholeSettings): WormholeSettings => ({
    transcription: prev.transcription || { provider: 'openai' as WormholeProviderId, model: '' },
    summarization: prev.summarization || { provider: 'gemini' as WormholeProviderId, model: '' },
    keyTerms: prev.keyTerms || { provider: 'gemini' as WormholeProviderId, model: '' },
    wikiUpdate: prev.wikiUpdate || { provider: 'gemini' as WormholeProviderId, model: '' },
});

const Settings: React.FC = () => {
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [firebaseConfig, setFirebaseConfig] = useState('');
    const [revidKey, setRevidKey] = useState('');
    const [wormhole, setWormhole] = useState<WormholeSettings>({
        transcription: { provider: 'openai', model: '' },
        summarization: { provider: 'gemini', model: '' },
        keyTerms: { provider: 'gemini', model: '' },
        wikiUpdate: { provider: 'gemini', model: '' },
    });
    const [status, setStatus] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            if (window.electronAPI) {
                const settings = await window.electronAPI.getSettings();
                setGeminiKey(settings.geminiKey);
                setOpenaiKey(settings.openaiKey || '');
                setFirebaseConfig(settings.firebaseConfig);
                setRevidKey(settings.revidKey || '');

                const wormholeSettings = (settings as any).wormhole || {};
                const normalizeStep = (step: any, defaultProvider: WormholeProviderId) => ({
                    provider:
                        step && typeof step.provider === 'string' && step.provider.trim().length > 0
                            ? (step.provider as WormholeProviderId)
                            : defaultProvider,
                    model: step && typeof step.model === 'string' ? step.model : '',
                });

                setWormhole({
                    transcription: normalizeStep(wormholeSettings.transcription, 'openai'),
                    summarization: normalizeStep(wormholeSettings.summarization, 'gemini'),
                    keyTerms: normalizeStep(wormholeSettings.keyTerms, 'gemini'),
                    wikiUpdate: normalizeStep(wormholeSettings.wikiUpdate, 'gemini'),
                });
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (window.electronAPI) {
            const wormholePayload = {
                transcription: wormhole.transcription,
                summarization: wormhole.summarization,
                keyTerms: wormhole.keyTerms,
                wikiUpdate: wormhole.wikiUpdate,
            };

            await window.electronAPI.saveSettings({
                geminiKey,
                openaiKey,
                firebaseConfig,
                revidKey,
                wormhole: wormholePayload,
            });
            setStatus('Settings saved!');
            setTimeout(() => setStatus(''), 3000);
        } else {
            setStatus('Electron API not available (Browser Mode)');
        }
    };

    return (
        <PageContainer>
            <div className="w-full text-white max-w-2xl">
                <h2 className="text-3xl font-bold mb-6">Settings</h2>

                <div className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-blue-400">Google Gemini</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Enter your Gemini API Key"
                        />
                    </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-pink-400">Revid.ai</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={revidKey}
                            onChange={(e) => setRevidKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-pink-500 transition-colors"
                            placeholder="Enter your Revid API Key"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Get your API key from your Revid account. Calls consume credits based on your plan and
                            options.
                        </p>
                    </div>
                </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-indigo-400">OpenAI</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">API Key</label>
                        <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Enter your OpenAI API Key"
                        />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-orange-400">Firebase</h3>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Configuration (JSON)</label>
                        <textarea
                            value={firebaseConfig}
                            onChange={(e) => setFirebaseConfig(e.target.value)}
                            className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
                            placeholder='{"apiKey": "...", "authDomain": "..."}'
                        />
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-xl font-semibold mb-4 text-emerald-400">Wormhole</h3>
                    <p className="text-xs text-gray-400 mb-4">
                        Configure which provider and model to use for each Wormhole processing step. These are
                        defaults only; each step is triggered manually on cards created via Wormhole.
                    </p>
                    <div className="space-y-4 text-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div className="font-medium text-gray-200">Transcription</div>
                                <div className="text-[11px] text-gray-500">Audio/video → text transcript</div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <select
                                    aria-label="Wormhole transcription provider"
                                    value={wormhole.transcription?.provider || 'openai'}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                transcription: {
                                                    ...base.transcription,
                                                    provider: e.target.value as WormholeProviderId,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="gemini">Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="llama-local">Local Llama</option>
                                    <option value="none">Disabled</option>
                                </select>
                                <input
                                    type="text"
                                    value={wormhole.transcription?.model || ''}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                transcription: {
                                                    ...base.transcription,
                                                    model: e.target.value,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors w-full md:w-48"
                                    placeholder="Model (optional)"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div className="font-medium text-gray-200">Summarization</div>
                                <div className="text-[11px] text-gray-500">Short/medium/outline summaries</div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <select
                                    aria-label="Wormhole summarization provider"
                                    value={wormhole.summarization?.provider || 'gemini'}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                summarization: {
                                                    ...base.summarization,
                                                    provider: e.target.value as WormholeProviderId,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="gemini">Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="llama-local">Local Llama</option>
                                    <option value="none">Disabled</option>
                                </select>
                                <input
                                    type="text"
                                    value={wormhole.summarization?.model || ''}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                summarization: {
                                                    ...base.summarization,
                                                    model: e.target.value,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors w-full md:w-48"
                                    placeholder="Model (optional)"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div className="font-medium text-gray-200">Key terms</div>
                                <div className="text-[11px] text-gray-500">Entity / concept extraction</div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <select
                                    aria-label="Wormhole key-terms provider"
                                    value={wormhole.keyTerms?.provider || 'gemini'}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                keyTerms: {
                                                    ...base.keyTerms,
                                                    provider: e.target.value as WormholeProviderId,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="gemini">Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="llama-local">Local Llama</option>
                                    <option value="none">Disabled</option>
                                </select>
                                <input
                                    type="text"
                                    value={wormhole.keyTerms?.model || ''}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                keyTerms: {
                                                    ...base.keyTerms,
                                                    model: e.target.value,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors w-full md:w-48"
                                    placeholder="Model (optional)"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div className="font-medium text-gray-200">Wiki / graph updates</div>
                                <div className="text-[11px] text-gray-500">Stub creation & cross-linking</div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <select
                                    aria-label="Wormhole wiki/graph provider"
                                    value={wormhole.wikiUpdate?.provider || 'gemini'}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                wikiUpdate: {
                                                    ...base.wikiUpdate,
                                                    provider: e.target.value as WormholeProviderId,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                                >
                                    <option value="gemini">Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="llama-local">Local Llama</option>
                                    <option value="none">Disabled</option>
                                </select>
                                <input
                                    type="text"
                                    value={wormhole.wikiUpdate?.model || ''}
                                    onChange={(e) =>
                                        setWormhole((prev: WormholeSettings): WormholeSettings => {
                                            const base = ensureWormholeDefaults(prev);
                                            return {
                                                ...base,
                                                wikiUpdate: {
                                                    ...base.wikiUpdate,
                                                    model: e.target.value,
                                                },
                                            };
                                        })
                                    }
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors w-full md:w-48"
                                    placeholder="Model (optional)"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                    <div className="flex items-center justify-between pt-4">
                        <PrimaryButton
                            type="button"
                            onClick={handleSave}
                            className="px-6 shadow-lg shadow-blue-900/20"
                        >
                            Save Settings
                        </PrimaryButton>
                        {status && <span className="text-green-400 animate-fade-in">{status}</span>}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default Settings;
