// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/PageContainer';
import type { WormholeSettings, WormholeProviderId } from '../types';

interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
}

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

    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
    const [openaiModels, setOpenaiModels] = useState<ModelInfo[]>([]);
    const [llamaModels, setLlamaModels] = useState<ModelInfo[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    
    // Admin: Prompt Templates
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const defaultSpritePrompt = `REQUIREMENT: Create a pixel-art sprite sheet animation arranged in a grid layout (e.g. 4x4 or 3x3).

CRITICAL RULES:
- SOLID BACKGROUND ONLY: Use a plain, solid color background (white or single flat color). NO grid lines, NO guidelines, NO patterns.
- NO TEXT: Do not include any text, labels, titles, frame numbers, or annotations anywhere on the image.
- EVENLY SPACED FRAMES: All animation frames must be perfectly aligned in a uniform grid with equal spacing between each frame.
- CONSISTENT SIZE: Each frame must be the exact same dimensions.
- CONSISTENT STYLE: Maintain the same art style, colors, and proportions across all frames.

The sprites should show the character in fluid motion (e.g. walking cycle, attack sequence, idle animation).

USER REQUEST: {{USER_PROMPT}}`;
    const [spritePromptTemplate, setSpritePromptTemplate] = useState(defaultSpritePrompt);

    const loadModels = useCallback(async () => {
        if (!window.electronAPI) return;
        setIsLoadingModels(true);
        try {
            console.log('Fetching available models...');
            if (window.electronAPI.listGeminiModels) {
                const gModels = await window.electronAPI.listGeminiModels();
                console.log('Gemini Models:', gModels);
                setGeminiModels(gModels || []);
            }
            if (window.electronAPI.listOpenAIModels) {
                const oModels = await window.electronAPI.listOpenAIModels();
                console.log('OpenAI Models:', oModels);
                setOpenaiModels(oModels || []);
            }
            if (window.electronAPI.listLlamaModels) {
                const lModels = await window.electronAPI.listLlamaModels();
                console.log('Llama Models:', lModels);
                setLlamaModels(lModels || []);
            }
        } catch (err) {
            console.error('Failed to load models:', err);
        } finally {
            setIsLoadingModels(false);
        }
    }, []);

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
            
            // Load prompt templates from localStorage
            const storedSpritePrompt = localStorage.getItem('spriteSheetPromptTemplate');
            if (storedSpritePrompt) {
                setSpritePromptTemplate(storedSpritePrompt);
            }
        };
        loadSettings();
        loadModels();
    }, [loadModels]);

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
            setStatus('Configuration Saved');
            setTimeout(() => setStatus(''), 3000);
        } else {
            setStatus('Electron API not available');
        }
    };

    const renderModelSelector = (
        stepKey: keyof WormholeSettings,
        currentProvider: WormholeProviderId,
        currentModel: string
    ) => {
        if (currentProvider === 'none') {
            return (
                <input
                    type="text"
                    disabled
                    value=""
                    className="bg-gray-900/30 border border-gray-700 rounded px-3 py-2 text-xs text-gray-500 cursor-not-allowed w-full font-mono"
                    placeholder="DISABLED"
                />
            );
        }

        let models: ModelInfo[] = [];
        if (currentProvider === 'gemini') models = geminiModels;
        else if (currentProvider === 'openai') models = openaiModels;
        else if (currentProvider === 'llama-local') models = llamaModels;

        if (models.length > 0) {
            return (
                <div className="relative">
                    <select
                        value={currentModel}
                        onChange={(e) =>
                            setWormhole((prev) => {
                                const base = ensureWormholeDefaults(prev);
                                return {
                                    ...base,
                                    [stepKey]: {
                                        ...base[stepKey],
                                        model: e.target.value,
                                    },
                                };
                            })
                        }
                        className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-astro-primary transition-colors appearance-none font-mono"
                    >
                        <option value="" disabled>SELECT MODEL</option>
                        {models.map((m) => (
                            <option key={m.name} value={m.name}>
                                {m.displayName || m.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <rux-icon icon="arrow-drop-down" size="small"></rux-icon>
                    </div>
                </div>
            );
        }

        return (
            <input
                type="text"
                value={currentModel}
                onChange={(e) =>
                    setWormhole((prev) => {
                        const base = ensureWormholeDefaults(prev);
                        return {
                            ...base,
                            [stepKey]: {
                                ...base[stepKey],
                                model: e.target.value,
                            },
                        };
                    })
                }
                className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-astro-primary transition-colors font-mono"
                placeholder={isLoadingModels ? "LOADING..." : "MODEL ID"}
            />
        );
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
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div className="w-full max-w-[1600px] mx-auto pb-24">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-gray-800 pb-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <rux-icon icon="settings" size="large"></rux-icon>
                            SETTINGS <span className="text-blue-400 text-lg font-mono font-normal opacity-80">// SYSTEM CONFIGURATION</span>
                        </h2>
                        <p className="text-gray-400 mt-2 font-mono text-xs tracking-wide pl-12">
                            MANAGE API KEYS, PROVIDERS, AND NEURAL PATHWAYS
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Neural Uplinks */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-xs uppercase mb-2">
                            <rux-icon icon="security" size="extra-small"></rux-icon>
                            Neural Uplinks
                        </div>

                        {/* Gemini */}
                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    Google Gemini
                                </h4>
                                <rux-icon icon="satellite" size="small" className="text-blue-400 opacity-50"></rux-icon>
                            </div>
                            <div className="space-y-1">
                                <label className="section-label">API Key</label>
                                <input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    className="w-full rounded-lg px-4 py-2.5 input-base font-mono text-sm"
                                    placeholder="Enter Gemini API Key"
                                />
                            </div>
                        </div>

                        {/* OpenAI */}
                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    OpenAI
                                </h4>
                                <rux-icon icon="memory" size="small" className="text-emerald-400 opacity-50"></rux-icon>
                            </div>
                            <div className="space-y-1">
                                <label className="section-label">API Key</label>
                                <input
                                    type="password"
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    className="w-full rounded-lg px-4 py-2.5 input-base font-mono text-sm"
                                    placeholder="Enter OpenAI API Key"
                                />
                            </div>
                        </div>

                        {/* Revid.ai */}
                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-pink-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    Revid.ai
                                </h4>
                                <rux-icon icon="videocam" size="small" className="text-pink-400 opacity-50"></rux-icon>
                            </div>
                            <div className="space-y-1">
                                <label className="section-label">API Key</label>
                                <input
                                    type="password"
                                    value={revidKey}
                                    onChange={(e) => setRevidKey(e.target.value)}
                                    className="w-full rounded-lg px-4 py-2.5 input-base font-mono text-sm"
                                    placeholder="Enter Revid API Key"
                                />
                                <p className="text-[10px] text-gray-500 mt-2 font-mono">
                                    * Calls consume credits based on your plan.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Data Core & Protocols */}
                    <div className="space-y-8">
                        {/* Data Core */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-orange-400 font-bold tracking-widest text-xs uppercase mb-2">
                                <rux-icon icon="storage" size="extra-small"></rux-icon>
                                Data Core
                            </div>

                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                        Firebase
                                    </h4>
                                    <rux-icon icon="cloud-queue" size="small" className="text-orange-400 opacity-50"></rux-icon>
                                </div>
                                <div className="space-y-1">
                                    <label className="section-label">Configuration (JSON)</label>
                                    <textarea
                                        value={firebaseConfig}
                                        onChange={(e) => setFirebaseConfig(e.target.value)}
                                        className="w-full h-32 rounded-lg px-4 py-2.5 input-base font-mono text-xs leading-relaxed"
                                        placeholder='{"apiKey": "...", "authDomain": "..."}'
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Wormhole Protocols */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-purple-400 font-bold tracking-widest text-xs uppercase">
                                    <rux-icon icon="timeline" size="extra-small"></rux-icon>
                                    Wormhole Protocols
                                </div>
                                <button
                                    onClick={loadModels}
                                    className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
                                    title="Refresh Models"
                                >
                                    <rux-icon icon="refresh" size="small" className={isLoadingModels ? "spin" : ""}></rux-icon>
                                </button>
                            </div>

                            <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-60"></div>
                                <p className="text-xs text-gray-400 mb-6 font-mono border-b border-gray-800 pb-4">
                                    CONFIGURE PROCESSING PIPELINE PROVIDERS AND MODELS
                                </p>

                                <div className="space-y-6">
                                    {/* Transcription */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">Transcription</div>
                                            <div className="text-[10px] text-gray-500 font-mono">AUDIO/VIDEO → TEXT</div>
                                        </div>
                                        <div className="md:col-span-2 flex gap-2">
                                            <div className="relative w-1/3">
                                                <select
                                                    value={wormhole.transcription?.provider || 'openai'}
                                                    onChange={(e) => setWormhole(prev => {
                                                        const base = ensureWormholeDefaults(prev);
                                                        return { ...base, transcription: { ...base.transcription, provider: e.target.value as WormholeProviderId, model: '' } };
                                                    })}
                                                    className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 appearance-none font-mono"
                                                >
                                                    <option value="gemini">GEMINI</option>
                                                    <option value="openai">OPENAI</option>
                                                    <option value="llama-local">LLAMA</option>
                                                    <option value="none">OFF</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                {renderModelSelector('transcription', wormhole.transcription?.provider || 'openai', wormhole.transcription?.model || '')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summarization */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">Summarization</div>
                                            <div className="text-[10px] text-gray-500 font-mono">CONTENT REDUCTION</div>
                                        </div>
                                        <div className="md:col-span-2 flex gap-2">
                                            <div className="relative w-1/3">
                                                <select
                                                    value={wormhole.summarization?.provider || 'gemini'}
                                                    onChange={(e) => setWormhole(prev => {
                                                        const base = ensureWormholeDefaults(prev);
                                                        return { ...base, summarization: { ...base.summarization, provider: e.target.value as WormholeProviderId, model: '' } };
                                                    })}
                                                    className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 appearance-none font-mono"
                                                >
                                                    <option value="gemini">GEMINI</option>
                                                    <option value="openai">OPENAI</option>
                                                    <option value="llama-local">LLAMA</option>
                                                    <option value="none">OFF</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                {renderModelSelector('summarization', wormhole.summarization?.provider || 'gemini', wormhole.summarization?.model || '')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key Terms */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">Key Terms</div>
                                            <div className="text-[10px] text-gray-500 font-mono">ENTITY EXTRACTION</div>
                                        </div>
                                        <div className="md:col-span-2 flex gap-2">
                                            <div className="relative w-1/3">
                                                <select
                                                    value={wormhole.keyTerms?.provider || 'gemini'}
                                                    onChange={(e) => setWormhole(prev => {
                                                        const base = ensureWormholeDefaults(prev);
                                                        return { ...base, keyTerms: { ...base.keyTerms, provider: e.target.value as WormholeProviderId, model: '' } };
                                                    })}
                                                    className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 appearance-none font-mono"
                                                >
                                                    <option value="gemini">GEMINI</option>
                                                    <option value="openai">OPENAI</option>
                                                    <option value="llama-local">LLAMA</option>
                                                    <option value="none">OFF</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                {renderModelSelector('keyTerms', wormhole.keyTerms?.provider || 'gemini', wormhole.keyTerms?.model || '')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Wiki Updates */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">Wiki / Graph</div>
                                            <div className="text-[10px] text-gray-500 font-mono">KNOWLEDGE GRAPH</div>
                                        </div>
                                        <div className="md:col-span-2 flex gap-2">
                                            <div className="relative w-1/3">
                                                <select
                                                    value={wormhole.wikiUpdate?.provider || 'gemini'}
                                                    onChange={(e) => setWormhole(prev => {
                                                        const base = ensureWormholeDefaults(prev);
                                                        return { ...base, wikiUpdate: { ...base.wikiUpdate, provider: e.target.value as WormholeProviderId, model: '' } };
                                                    })}
                                                    className="w-full bg-gray-900/50 border border-gray-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 appearance-none font-mono"
                                                >
                                                    <option value="gemini">GEMINI</option>
                                                    <option value="openai">OPENAI</option>
                                                    <option value="llama-local">LLAMA</option>
                                                    <option value="none">OFF</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                {renderModelSelector('wikiUpdate', wormhole.wikiUpdate?.provider || 'gemini', wormhole.wikiUpdate?.model || '')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin Panel - Prompt Templates */}
                <div className="mt-8">
                    <button
                        onClick={() => setShowAdminPanel(!showAdminPanel)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                    >
                        <rux-icon icon={showAdminPanel ? "expand-less" : "expand-more"} size="small"></rux-icon>
                        <span className="text-xs uppercase font-bold tracking-wider">Admin: Prompt Templates</span>
                        <rux-icon icon="admin-panel-settings" size="small"></rux-icon>
                    </button>
                    
                    {showAdminPanel && (
                        <div className="glass-panel rounded-xl p-6 border border-orange-500/30">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded bg-orange-900/30 border border-orange-500/30 text-orange-400">
                                    <rux-icon icon="code" size="small"></rux-icon>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Sprite Sheet Generation Prompt</h3>
                                    <p className="text-xs text-gray-500 font-mono">CONTROLS AI IMAGE GENERATION</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="text-xs text-gray-400 mb-2">
                                    <span className="text-orange-400 font-bold">{'{{USER_PROMPT}}'}</span> will be replaced with the user's animation request.
                                </div>
                                
                                <textarea
                                    value={spritePromptTemplate}
                                    onChange={(e) => setSpritePromptTemplate(e.target.value)}
                                    className="w-full h-64 bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-orange-500 transition-colors resize-y"
                                    placeholder="Enter prompt template..."
                                />
                                
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => {
                                            setSpritePromptTemplate(defaultSpritePrompt);
                                            localStorage.removeItem('spriteSheetPromptTemplate');
                                            setStatus('Prompt Reset to Default');
                                            setTimeout(() => setStatus(''), 3000);
                                        }}
                                        className="px-4 py-2 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded transition-colors"
                                    >
                                        <rux-icon icon="restore" size="extra-small" className="mr-1"></rux-icon>
                                        Reset to Default
                                    </button>
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('spriteSheetPromptTemplate', spritePromptTemplate);
                                            setStatus('Prompt Template Saved');
                                            setTimeout(() => setStatus(''), 3000);
                                        }}
                                        className="px-4 py-2 text-xs text-orange-400 hover:text-white border border-orange-500/50 hover:border-orange-500 rounded transition-colors bg-orange-900/20"
                                    >
                                        <rux-icon icon="save" size="extra-small" className="mr-1"></rux-icon>
                                        Save Prompt
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Floating Action Button */}
                <div className="fixed bottom-8 right-8 z-50 flex items-center gap-4">
                    {status && (
                        <div className="bg-gray-900/90 backdrop-blur border border-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm font-mono shadow-xl animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2">
                                <rux-icon icon="check-circle" size="small"></rux-icon>
                                {status}
                            </div>
                        </div>
                    )}
                    <rux-button
                        icon="save"
                        size="large"
                        onClick={handleSave}
                        className="shadow-2xl shadow-blue-500/20"
                    >
                        Save System Config
                    </rux-button>
                </div>
            </div>
        </PageContainer>
    );
};

export default Settings;
