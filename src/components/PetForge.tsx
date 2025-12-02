// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { PrimaryButton, SecondaryButton } from './Button';

// --- Types ---

interface Asset {
    id: string;
    url: string;
    name: string;
    type: 'gif' | 'image';
}

interface PetModule {
    id: string; // Slot ID
    asset: Asset | null;
    trigger: 'default' | 'random' | 'click' | 'command';
    triggerValue?: string;
    probability?: number;
}

interface PetConfig {
    name: string;
    scale: number;
    speed: number;
    modules: Record<string, PetModule>;
}

const ITEM_TYPE = 'ASSET';

// --- Components ---

// 1. Draggable Asset Card
const AssetCard: React.FC<{ asset: Asset }> = ({ asset }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ITEM_TYPE,
        item: { asset },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        <div
            ref={drag}
            className={`
                relative w-16 h-16 bg-gray-800 border border-gray-600 rounded cursor-move 
                hover:border-astro-primary hover:shadow-[0_0_10px_rgba(79,172,254,0.3)] transition-all
                flex items-center justify-center overflow-hidden
                ${isDragging ? 'opacity-50' : 'opacity-100'}
            `}
            title={asset.name}
        >
            <img src={asset.url} alt={asset.name} className="max-w-full max-h-full object-contain" />
        </div>
    );
};

// 2. Chassis Slot (Drop Target)
const ChassisSlot: React.FC<{
    id: string;
    label: string;
    module: PetModule;
    onDrop: (asset: Asset) => void;
    onSelect: () => void;
    isSelected: boolean;
    required?: boolean;
}> = ({ id, label, module, onDrop, onSelect, isSelected, required }) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ITEM_TYPE,
        drop: (item: { asset: Asset }) => onDrop(item.asset),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    return (
        <div
            ref={drop}
            onClick={onSelect}
            className={`
                relative w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all
                ${isSelected
                    ? 'border-astro-primary bg-astro-primary/10 shadow-[0_0_15px_rgba(79,172,254,0.4)]'
                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                }
                ${isOver ? 'border-green-400 bg-green-400/10' : ''}
            `}
        >
            {module.asset ? (
                <div className="w-full h-full p-2 flex items-center justify-center">
                    <img src={module.asset.url} alt="Equipped" className="max-w-full max-h-full object-contain" />
                </div>
            ) : (
                <div className="flex flex-col items-center text-gray-600">
                    <rux-icon icon="add" size="small"></rux-icon>
                    <span className="text-[10px] uppercase font-bold mt-1">{label}</span>
                </div>
            )}

            {required && !module.asset && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Required"></div>
            )}

            <div className="absolute -bottom-6 text-xs font-mono text-gray-400 uppercase tracking-wider">{label}</div>
        </div>
    );
};

// --- Main Forge Component ---

interface PetForgeProps {
    onClose: () => void;
    onSave: (config: PetConfig) => void;
}

const PetForge: React.FC<PetForgeProps> = ({ onClose, onSave }) => {
    // State
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const [config, setConfig] = useState<PetConfig>({
        name: 'New Pet',
        scale: 1.0,
        speed: 5,
        modules: {
            idle: { id: 'idle', asset: null, trigger: 'default' },
            walk: { id: 'walk', asset: null, trigger: 'default' },
            run: { id: 'run', asset: null, trigger: 'default' },
            sit: { id: 'sit', asset: null, trigger: 'random', probability: 0.3 },
            special: { id: 'special', asset: null, trigger: 'click' },
        }
    });

    // Load Assets (Integrated with CardLibrary)
    useEffect(() => {
        const loadLibraryAssets = async () => {
            if (window.electronAPI?.p2pRead) {
                try {
                    const libraryCore = await window.electronAPI.p2pRead('card-library');
                    const loadedAssets: Asset[] = [];

                    // We need to fetch the actual card data for each index entry to get the full metadata
                    // This mirrors the enrichment logic in CardLibrary.tsx
                    for (const record of libraryCore) {
                        try {
                            const indexData = JSON.parse(record);
                            if (indexData.type === 'card-index' && indexData.coreName) {
                                // Fetch the actual card core
                                const cardRecords = await window.electronAPI.p2pRead(indexData.coreName);
                                let cardData: any = null;

                                // Find the latest 'card' type record
                                for (const r of cardRecords) {
                                    try {
                                        const p = JSON.parse(r);
                                        if (p.type === 'card') cardData = p;
                                    } catch { }
                                }

                                if (cardData) {
                                    // Determine if this is a valid asset for the forge
                                    const isImage = cardData.mediaType === 'image' || cardData.mimeType?.startsWith('image/');
                                    const isSprite = cardData.subType === 'sprite-sheet' || cardData.tags?.includes('sprite');

                                    // Resolve the image URL
                                    let imageUrl = cardData.thumbnail || cardData.imageUrl || cardData.url;

                                    // If it's a Wormhole ingestion, use the local path
                                    if (!imageUrl && cardData.wormhole?.ingest?.originalPath) {
                                        // Convert local path to file:// URL for rendering
                                        imageUrl = `file://${cardData.wormhole.ingest.originalPath.replace(/\\/g, '/')}`;
                                    }

                                    if (imageUrl && (isImage || isSprite)) {
                                        loadedAssets.push({
                                            id: cardData.id || indexData.cardId,
                                            url: imageUrl,
                                            name: cardData.title || cardData.model || 'Unknown Asset',
                                            type: 'image'
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to process library record", e);
                        }
                    }
                    setAssets(loadedAssets.reverse()); // Newest first
                } catch (e) {
                    console.warn("Could not load library assets", e);
                }
            }
        };
        loadLibraryAssets();
    }, []);

    const handleDrop = (slotId: string, asset: Asset) => {
        setConfig(prev => ({
            ...prev,
            modules: {
                ...prev.modules,
                [slotId]: {
                    ...prev.modules[slotId],
                    asset
                }
            }
        }));
        setSelectedSlot(slotId);
    };

    const handleModuleChange = (slotId: string, updates: Partial<PetModule>) => {
        setConfig(prev => ({
            ...prev,
            modules: {
                ...prev.modules,
                [slotId]: {
                    ...prev.modules[slotId],
                    ...updates
                }
            }
        }));
    };

    const handleSave = () => {
        if (!config.modules.idle.asset) {
            alert("An Idle animation is required!");
            return;
        }
        onSave(config);
    };

    const activeModule = selectedSlot ? config.modules[selectedSlot] : null;

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="w-[1200px] h-[800px] bg-gray-900 rounded-xl border border-astro-border shadow-2xl flex overflow-hidden relative">

                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 h-14 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between px-6 z-10">
                        <div className="flex items-center gap-3">
                            <rux-icon icon="build" size="small" className="text-astro-primary"></rux-icon>
                            <h2 className="text-xl font-bold text-white tracking-widest uppercase">Pet Forge <span className="text-xs text-astro-primary ml-2">v1.0</span></h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <rux-icon icon="close" size="large"></rux-icon>
                        </button>
                    </div>

                    {/* Left Panel: Asset Bay */}
                    <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col pt-14">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                            <h3 className="text-xs font-bold text-astro-primary uppercase tracking-wider mb-2">Asset Bay</h3>
                            <input
                                type="text"
                                placeholder="Search assets..."
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-astro-primary outline-none"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-3 gap-3">
                                {assets.map(asset => (
                                    <AssetCard key={asset.id} asset={asset} />
                                ))}
                                {assets.length === 0 && (
                                    <div className="col-span-3 text-center py-10 text-gray-600 text-xs">
                                        No assets found in Library.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center Panel: Chassis */}
                    <div className="flex-1 bg-[url('/grid-pattern.png')] bg-center relative pt-14 flex flex-col items-center">
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-transparent to-gray-900/80 pointer-events-none"></div>

                        {/* Pet Name & Stats */}
                        <div className="w-full max-w-md mt-8 z-10 flex flex-col gap-4">
                            <input
                                type="text"
                                value={config.name}
                                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                className="bg-transparent text-center text-3xl font-bold text-white border-b border-gray-700 focus:border-astro-primary outline-none pb-2 font-mono"
                                placeholder="ENTER PET NAME"
                            />
                            <div className="flex gap-4 justify-center">
                                <div className="flex flex-col items-center">
                                    <label className="text-[10px] text-astro-off uppercase mb-1">Scale</label>
                                    <input
                                        type="range" min="0.5" max="2.0" step="0.1"
                                        value={config.scale}
                                        onChange={(e) => setConfig({ ...config, scale: parseFloat(e.target.value) })}
                                        className="w-32 accent-astro-primary"
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <label className="text-[10px] text-astro-off uppercase mb-1">Speed</label>
                                    <input
                                        type="range" min="1" max="10" step="1"
                                        value={config.speed}
                                        onChange={(e) => setConfig({ ...config, speed: parseInt(e.target.value) })}
                                        className="w-32 accent-astro-primary"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* The "Paper Doll" Layout - Fixed Container for Stability */}
                        <div className="flex-1 flex items-center justify-center w-full z-10 overflow-hidden">
                            <div className="relative w-[500px] h-[500px] flex-none">

                                {/* Center Preview (Absolute Center of Wrapper) */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-astro-primary/30 rounded-full flex items-center justify-center bg-astro-primary/5 shadow-[0_0_50px_rgba(79,172,254,0.1)]">
                                    {config.modules.idle.asset ? (
                                        <img
                                            src={config.modules.idle.asset.url}
                                            alt="Preview"
                                            style={{ transform: `scale(${config.scale})` }}
                                            className="max-w-[80%] max-h-[80%] object-contain pixelated"
                                        />
                                    ) : (
                                        <div className="text-astro-primary/30 text-6xl opacity-20">?</div>
                                    )}

                                    {/* Connecting Lines */}
                                    <div className="absolute top-1/2 left-[-80px] right-[-80px] h-px bg-astro-primary/20 -z-10"></div>
                                    <div className="absolute top-[-80px] bottom-[-80px] left-1/2 w-px bg-astro-primary/20 -z-10"></div>
                                </div>

                                {/* Slots Positioning - Relative to the 500x500 Wrapper */}

                                {/* Top: Idle (Core) */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                                    <ChassisSlot
                                        id="idle" label="Idle Core" module={config.modules.idle}
                                        onDrop={(a) => handleDrop('idle', a)}
                                        onSelect={() => setSelectedSlot('idle')}
                                        isSelected={selectedSlot === 'idle'}
                                        required
                                    />
                                </div>

                                {/* Left: Walk */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                                    <ChassisSlot
                                        id="walk" label="Locomotion" module={config.modules.walk}
                                        onDrop={(a) => handleDrop('walk', a)}
                                        onSelect={() => setSelectedSlot('walk')}
                                        isSelected={selectedSlot === 'walk'}
                                    />
                                </div>

                                {/* Right: Run */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                    <ChassisSlot
                                        id="run" label="Sprint" module={config.modules.run}
                                        onDrop={(a) => handleDrop('run', a)}
                                        onSelect={() => setSelectedSlot('run')}
                                        isSelected={selectedSlot === 'run'}
                                    />
                                </div>

                                {/* Bottom Left: Sit */}
                                <div className="absolute bottom-0 left-12">
                                    <ChassisSlot
                                        id="sit" label="Rest Mode" module={config.modules.sit}
                                        onDrop={(a) => handleDrop('sit', a)}
                                        onSelect={() => setSelectedSlot('sit')}
                                        isSelected={selectedSlot === 'sit'}
                                    />
                                </div>

                                {/* Bottom Right: Special */}
                                <div className="absolute bottom-0 right-12">
                                    <ChassisSlot
                                        id="special" label="Special" module={config.modules.special}
                                        onDrop={(a) => handleDrop('special', a)}
                                        onSelect={() => setSelectedSlot('special')}
                                        isSelected={selectedSlot === 'special'}
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="w-full p-6 flex justify-center gap-4 z-10">
                            <SecondaryButton onClick={onClose} className="w-32">Cancel</SecondaryButton>
                            <PrimaryButton onClick={handleSave} className="w-48">Initialize Pet</PrimaryButton>
                        </div>
                    </div>

                    {/* Right Panel: Logic Editor */}
                    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col pt-14 transition-all duration-300 transform translate-x-0">
                        <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                            <h3 className="text-xs font-bold text-astro-primary uppercase tracking-wider">Module Logic</h3>
                        </div>

                        {activeModule ? (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 bg-black rounded border border-gray-700 flex items-center justify-center">
                                        {activeModule.asset ? (
                                            <img src={activeModule.asset.url} className="max-w-full max-h-full" />
                                        ) : (
                                            <rux-icon icon="help" className="text-gray-700"></rux-icon>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white uppercase">{activeModule.id} Module</div>
                                        <div className="text-xs text-gray-500">{activeModule.asset ? 'Asset Loaded' : 'Empty Slot'}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase text-gray-500 font-bold">Trigger Condition</label>
                                        <select
                                            value={activeModule.trigger}
                                            onChange={(e) => handleModuleChange(activeModule.id, { trigger: e.target.value as any })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-astro-primary outline-none"
                                        >
                                            <option value="default">Default / Loop</option>
                                            <option value="random">Random Chance</option>
                                            <option value="click">On Click</option>
                                            <option value="command">Chat Command</option>
                                        </select>
                                    </div>

                                    {activeModule.trigger === 'random' && (
                                        <div className="space-y-2">
                                            <label className="text-xs uppercase text-gray-500 font-bold">Probability ({Math.round((activeModule.probability || 0) * 100)}%)</label>
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={activeModule.probability || 0}
                                                onChange={(e) => handleModuleChange(activeModule.id, { probability: parseFloat(e.target.value) })}
                                                className="w-full accent-astro-primary"
                                            />
                                        </div>
                                    )}

                                    {activeModule.trigger === 'command' && (
                                        <div className="space-y-2">
                                            <label className="text-xs uppercase text-gray-500 font-bold">Command Keyword</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 'sit', 'dance'"
                                                value={activeModule.triggerValue || ''}
                                                onChange={(e) => handleModuleChange(activeModule.id, { triggerValue: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-astro-primary outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-gray-800">
                                    <button
                                        onClick={() => handleModuleChange(activeModule.id, { asset: null })}
                                        className="w-full py-2 text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:bg-red-900/20 rounded transition-colors"
                                    >
                                        Eject Module
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
                                <rux-icon icon="touch-app" size="large" className="mb-4 opacity-50"></rux-icon>
                                <p className="text-sm">Select a module slot to configure its logic parameters.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </DndProvider>
    );
};

export default PetForge;
