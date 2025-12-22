import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '../components/PageContainer';
// @ts-ignore
import defaultProtoHtml from '../../docs/features/card_set_battler_proto.html?raw';

interface PrototypeEntry {
    id: string;
    title: string;
    description: string;
    htmlContent: string | null; // Null if not loaded yet
    createdAt: number;
    coreName?: string; // For P2P loading
    path?: string;
    isDefault?: boolean;
}

const Prototypes: React.FC = () => {
    const [prototypes, setPrototypes] = useState<PrototypeEntry[]>([]);
    const [activeId, setActiveId] = useState<string>('default');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationLogs, setGenerationLogs] = useState<string[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);

    const defaultProto: PrototypeEntry = {
        id: 'default',
        title: 'Card Set Battler (Default)',
        description: '3D Volumetric Ops Terminal Example',
        htmlContent: defaultProtoHtml,
        createdAt: 0,
        isDefault: true
    };

    const loadP2PPrototypes = useCallback(async () => {
        if (!window.electronAPI?.p2pRead) return;
        setIsLoadingList(true);
        try {
            const raw = await window.electronAPI.p2pRead('card-library');
            const map = new Map<string, PrototypeEntry>();

            // Process oldest to newest to let updates override
            for (const r of raw) {
                if (!r) continue;
                try {
                    const data = JSON.parse(r);
                    // Check if it's a prototype card
                    if (data.mediaKind === 'html' || data.cardData?.mediaKind === 'html' ||
                        data.cardData?.type === 'prototype' || data.tags?.includes('prototype')) {

                        map.set(data.cardId, {
                            id: data.cardId,
                            title: data.name || data.title || 'Untitled Prototype',
                            description: data.description || 'Saved Prototype',
                            htmlContent: null, // Load on demand
                            createdAt: data.timestamp || Date.now(),
                            coreName: data.coreName,
                            path: data.mediaLocalPath
                        });
                    }
                } catch (e) {
                    console.warn("Failed to parse prototype entry", e);
                }
            }

            // Convert map to array and sort by date desc
            const sorted = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            setPrototypes([defaultProto, ...sorted]);
        } catch (error) {
            console.error("Failed to load prototypes:", error);
            setGenerationLogs(prev => [...prev, `Error loading library: ${error}`]);
        } finally {
            setIsLoadingList(false);
        }
    }, []);

    useEffect(() => {
        loadP2PPrototypes();
    }, [loadP2PPrototypes]);

    const activeProto = prototypes.find(p => p.id === activeId);

    // Deep load content if missing
    useEffect(() => {
        const loadContent = async () => {
            if (activeProto && !activeProto.htmlContent && activeProto.coreName && window.electronAPI?.p2pRead) {
                try {
                    setGenerationLogs(prev => [...prev, `Loading content from core: ${activeProto.coreName}...`]);
                    const records = await window.electronAPI.p2pRead(activeProto.coreName);
                    // Find the record with htmlContent
                    let content = null;
                    // Iterate backwards
                    for (let i = records.length - 1; i >= 0; i--) {
                        try {
                            const rec = JSON.parse(records[i]);
                            if (rec.cardData?.htmlContent) {
                                content = rec.cardData.htmlContent;
                                break;
                            }
                        } catch { }
                    }

                    if (content) {
                        setPrototypes(prev => prev.map(p =>
                            p.id === activeProto.id ? { ...p, htmlContent: content } : p
                        ));
                        setGenerationLogs(prev => [...prev, `Content loaded for ${activeProto.title}`]);
                    } else {
                        setGenerationLogs(prev => [...prev, `Error: No HTML content found in core for ${activeProto.title}`]);
                    }
                } catch (e) {
                    setGenerationLogs(prev => [...prev, `Error loading core: ${e}`]);
                }
            }
        };
        loadContent();
    }, [activeId, activeProto?.coreName]); // Only re-run if active ID changes or we discover coreName

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setGenerationLogs(prev => [...prev, `Initializing generation sequence: "${prompt}"...`]);

        try {
            if (window.electronAPI?.chatWithGemini) {
                const systemPrompt = `
                    You are an expert Frontend Developer and UI/UX Designer specializing in single-file HTML prototypes.
                    Your task is to create a SELF-CONTAINED HTML file (including CSS and JS) based on the user's request.
                    
                    RULES:
                    1. Output ONLY valid HTML code. Start with <!DOCTYPE html>.
                    2. Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
                    3. Use React/Babel via CDN if complex logic needed:
                       <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
                       <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
                       <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                    4. Make it look PREMIUM, Sci-Fi, Dark Mode, and "Hapa AI" styled (Cyberpunk/Astro aesthetics).
                    5. Ensure it is responsive and interactive.
                    6. DO NOT use markdown code fences. Just the raw HTML.
                 `;

                const response = await window.electronAPI.chatWithGemini({
                    message: prompt,
                    history: [{ role: 'user', parts: [{ text: systemPrompt }] }],
                    model: 'gemini-2.0-flash-thinking-exp-1219'
                });

                // @ts-ignore - Electron API types might be slightly off in dev
                let content = response.content || response.response;

                if (content.includes('```html')) {
                    content = content.split('```html')[1].split('```')[0];
                } else if (content.includes('```')) {
                    content = content.split('```')[1].split('```')[0];
                }

                setGenerationLogs(prev => [...prev, "Generation complete. Accessing Neural Storage..."]);

                // Save to Card Library
                if (window.electronAPI.savePrototype) {
                    const title = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
                    setGenerationLogs(prev => [...prev, `Minting Prototype Card: "${title}"...`]);

                    const result = await window.electronAPI.savePrototype({
                        title,
                        content
                    });

                    if (result.success) {
                        setGenerationLogs(prev => [...prev, `Success! Card ID: ${result.cardId}`]);
                        // Reload list
                        await loadP2PPrototypes();

                        // Optimistically add just in case reload is slow or eventual
                        const newProto: PrototypeEntry = {
                            id: result.cardId || `temp-${Date.now()}`,
                            title,
                            description: 'Just Minted',
                            htmlContent: content,
                            createdAt: Date.now(),
                            coreName: `card-${result.cardId}`
                        };
                        setPrototypes(prev => [defaultProto, newProto, ...prev.filter(p => !p.isDefault)]);
                        setActiveId(newProto.id);
                        // Wait 1s and reload again
                        setTimeout(loadP2PPrototypes, 1000);
                    } else {
                        setGenerationLogs(prev => [...prev, `Save failed: ${result.error}`]);
                    }
                } else {
                    setGenerationLogs(prev => [...prev, "Error: savePrototype API not available."]);
                }
            }
        } catch (error: any) {
            setGenerationLogs(prev => [...prev, `Error: ${error.message}`]);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <PageContainer title="Prototypes" icon="science">
            <div className="flex h-full gap-4 overflow-hidden">
                {/* Sidebar List */}
                <div className="w-80 flex flex-col gap-4 bg-gray-900/50 p-4 border-r border-gray-800">
                    <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg">
                        <h3 className="text-sm font-bold text-astro-primary mb-2 uppercase tracking-wider">New Prototype</h3>
                        <textarea
                            className="w-full bg-gray-900 text-white text-xs p-3 rounded-lg border border-gray-700 focus:border-astro-primary outline-none resize-none h-24 mb-2"
                            placeholder="Describe the interface you want to build..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            disabled={isGenerating}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isLoadingList || !prompt}
                            className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${isGenerating
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-astro-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-900/50 relative overflow-hidden group'
                                }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            {isGenerating ? (
                                <span className="flex items-center justify-center gap-2">
                                    <rux-icon icon="cached" className="animate-spin" size="extra-small"></rux-icon>
                                    Forging...
                                </span>
                            ) : (
                                "Generate"
                            )}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {prototypes.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setActiveId(p.id)}
                                className={`p-3 rounded-lg cursor-pointer border transition-all ${activeId === p.id
                                    ? 'bg-astro-primary/20 border-astro-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                    : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`font-bold text-xs ${activeId === p.id ? 'text-white' : 'text-gray-300'} truncate`}>
                                        {p.title}
                                    </span>
                                    <rux-icon icon="code" size="extra-small" className={activeId === p.id ? 'text-astro-primary' : 'text-gray-600'}></rux-icon>
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">{p.description}</div>
                                <div className="text-[9px] text-gray-600 mt-1 font-mono">
                                    {p.createdAt > 0 ? new Date(p.createdAt).toLocaleDateString() : 'SYSTEM'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Console Log Area */}
                    <div className="h-32 bg-black/80 rounded-lg p-3 font-mono text-[10px] text-green-500 overflow-y-auto border border-gray-800 shadow-inner">
                        <div className="opacity-50 mb-1 border-b border-gray-800 pb-1 flex justify-between">
                            <span>SYSTEM LOGS</span>
                            {isGenerating && <span className="animate-pulse text-astro-primary">PROCESSING</span>}
                        </div>
                        {generationLogs.map((log, i) => (
                            <div key={i} className="mb-0.5 break-words">&gt; {log}</div>
                        ))}
                        {isGenerating && <div className="animate-pulse">&gt; _</div>}
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex-1 bg-black rounded-xl border border-gray-800 overflow-hidden relative shadow-2xl flex flex-col">
                    <div className="h-8 bg-gray-900 flex items-center px-4 border-b border-gray-800 z-10 select-none">
                        <div className="flex gap-1.5 mr-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono flex-1 text-center opacity-50 truncate">
                            {activeProto ? `preview://${activeProto.id}.html` : 'preview://waiting'}
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono">
                            {activeProto?.htmlContent ? `${activeProto.htmlContent.length} bytes` : '---'}
                        </div>
                    </div>

                    <div className="flex-1 relative bg-white">
                        {activeProto ? (
                            activeProto.htmlContent ? (
                                <iframe
                                    srcDoc={activeProto.htmlContent}
                                    title="Prototype Preview"
                                    className="w-full h-full border-0"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-4 bg-gray-50 animate-pulse">
                                    <rux-icon icon="cloud-download" size="large"></rux-icon>
                                    <span className="text-sm font-mono uppercase tracking-widest">Fetching Source...</span>
                                </div>
                            )
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-900 border-t border-gray-800">
                                <rux-icon icon="science" size="large"></rux-icon>
                                <span className="text-sm font-mono uppercase tracking-widest">No Prototype Selected</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    );
};

export default Prototypes;
