// @ts-nocheck
import React, { useState } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';

interface SpriteAnimationGeneratorProps {
    seedCard: any;
    onGenerate: (prompt: string, model: string) => void;
    onCancel: () => void;
    lastResult?: { imageUrl: string; prompt: string; cardId: string } | null;
    onView?: (imageUrl: string) => void;
}

export const SpriteAnimationGenerator: React.FC<SpriteAnimationGeneratorProps> = ({ seedCard, onGenerate, onCancel, lastResult, onView }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini'); // Default to Cloud (Gemini)

    // Clear prompt when a new result arrives (optional, but good for "next" flow)
    // Actually, we might want to keep the prompt if they want to tweak it. 
    // But usually "next" means "new action". Let's clear it if result changes.
    React.useEffect(() => {
        if (lastResult) {
            setIsGenerating(false);
            setPrompt(''); // Clear prompt for next action
        }
    }, [lastResult]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            await onGenerate(prompt, selectedModel);
        } catch (e) {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 p-6 bg-gray-900/50 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-right-4 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <rux-icon icon="movie-filter" size="small" className="text-purple-400"></rux-icon>
                        Generate Animation
                    </h3>
                    <p className="text-xs text-gray-400">Create a sprite sheet animation from this seed.</p>
                </div>
                <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors" title="Close">
                    <rux-icon icon="close" size="small"></rux-icon>
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-6">
                {/* Last Result Display */}
                {lastResult && (
                    <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-green-400 uppercase flex items-center gap-1">
                                <rux-icon icon="check-circle" size="extra-small"></rux-icon>
                                Generated Successfully
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[150px]">
                                {lastResult.prompt}
                            </span>
                        </div>
                        <div className="relative aspect-square w-full bg-black/50 rounded border border-gray-700 overflow-hidden group">
                            <img 
                                src={lastResult.imageUrl} 
                                alt="Result" 
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={() => onView && onView(lastResult.imageUrl)}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                                <div className="pointer-events-auto">
                                    <PrimaryButton onClick={() => onView && onView(lastResult.imageUrl)} title="View Full Size">
                                        <rux-icon icon="fullscreen" size="small" className="mr-1"></rux-icon>
                                        VIEW
                                    </PrimaryButton>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Seed Preview Context */}
                <div className="flex items-center gap-4 p-3 bg-black/30 rounded border border-white/5">
                    <img 
                        src={seedCard.data?.imageUrl || seedCard.data?.url} 
                        alt="Seed" 
                        className="w-12 h-12 object-contain rounded bg-black"
                    />
                    <div>
                        <div className="text-xs font-bold text-gray-300 uppercase">Sprite Seed</div>
                        <div className="text-sm text-white truncate max-w-[200px]">{seedCard.data?.title || 'Untitled'}</div>
                    </div>
                </div>

                {/* Prompt Input */}
                <div className="space-y-2 flex-1 flex flex-col">
                    <label className="text-xs uppercase text-gray-500 font-bold flex items-center gap-2">
                        Animation Description
                        <span className="text-[10px] normal-case font-normal text-gray-600">(e.g., "Walk cycle side view", "Jump attack")</span>
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the animation you want..."
                        className="flex-1 w-full bg-black/20 border border-gray-700 rounded-lg p-4 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                    />
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-500 font-bold">Provider</label>
                        <div className="relative">
                            <select 
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white appearance-none cursor-pointer hover:border-gray-600"
                                title="Select Generation Provider"
                            >
                                <option value="local-vision">Local (SDXL Turbo)</option>
                                <option value="gemini">Cloud (Gemini / Nano Banana)</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <rux-icon icon="expand-more" size="extra-small"></rux-icon>
                            </div>
                        </div>
                    </div>
                    
                    {/* Future: Saved Prompts Dropdown */}
                    <div className="space-y-2 opacity-50 pointer-events-none">
                        <label className="text-xs uppercase text-gray-500 font-bold">Saved Prompts</label>
                         <div className="relative">
                            <select 
                                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-400 appearance-none"
                                title="Select Saved Prompt"
                            >
                                <option>None</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <rux-icon icon="expand-more" size="extra-small"></rux-icon>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-700 flex justify-between items-center">
                <div className="text-xs text-gray-500">
                    Cost: ~2s (Local) / 1 Banana
                </div>
                <div className="flex gap-3">
                     <SecondaryButton onClick={() => {}} disabled={!prompt} title="Save this prompt for later">
                        SAVE PROMPT
                    </SecondaryButton>
                    <PrimaryButton onClick={handleGenerate} disabled={isGenerating || !prompt}>
                        {isGenerating ? (
                            <div className="flex items-center gap-2">
                                <rux-icon icon="autorenew" size="small" className="animate-spin"></rux-icon>
                                GENERATING...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <rux-icon icon="auto-awesome" size="small"></rux-icon>
                                GENERATE
                            </div>
                        )}
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );
};
