// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import PageContainer from '../components/PageContainer';
import { PetController } from '../components/pets/PetController';
import Pet from '../components/pets/Pet';
import type { PetInstance, PetConfig, PetCard, PetZone } from '../components/pets/types';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import PetForge from '../components/PetForge';
import { 
    createPetCard, 
    loadPetsByZone, 
    updatePetLocation,
    petCardToConfig,
    parsePetDragData,
    hasPetDragData,
    createPetDragData 
} from '../utils/petCardUtils';

const Pets: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<PetController | null>(null);
    const [pets, setPets] = useState<PetInstance[]>([]);
    const [petCards, setPetCards] = useState<Map<string, PetCard>>(new Map());
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [newPetName, setNewPetName] = useState('');
    const [newPetType, setNewPetType] = useState<'dog' | 'crab' | 'fox' | 'clippy' | 'chicken' | 'cockatiel' | 'deno' | 'horse' | 'panda' | 'snake' | 'totoro' | 'custom'>('dog');
    const [newPetColor, setNewPetColor] = useState('black');

    // Custom Pet Files
    const [customIdle, setCustomIdle] = useState<File | null>(null);
    const [customWalk, setCustomWalk] = useState<File | null>(null);
    const [customRun, setCustomRun] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isForgeOpen, setIsForgeOpen] = useState(false);

    // Load sanctuary pets from card library
    const loadSanctuaryPets = useCallback(async () => {
        if (!containerRef.current || !controllerRef.current) return;
        
        try {
            const sanctuaryPets = await loadPetsByZone('sanctuary');
            const cardMap = new Map<string, PetCard>();
            
            sanctuaryPets.forEach((petCard) => {
                cardMap.set(petCard.id, petCard);
                const config = petCardToConfig(petCard);
                controllerRef.current?.addPet(config);
            });
            
            setPetCards(cardMap);
            setPets([...controllerRef.current.getPets()]);
            console.log(`Loaded ${sanctuaryPets.length} pets from sanctuary`);
        } catch (e) {
            console.error('Failed to load sanctuary pets:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize controller
        const { clientWidth, clientHeight } = containerRef.current;
        controllerRef.current = new PetController(clientWidth, clientHeight);

        // Load pets from card library
        loadSanctuaryPets();

        // Game Loop
        const interval = setInterval(() => {
            if (controllerRef.current) {
                controllerRef.current.tick();
                setPets([...controllerRef.current.getPets()]); // Trigger re-render
            }
        }, 100); // 10fps update for logic

        // Resize handler
        const handleResize = () => {
            if (containerRef.current && controllerRef.current) {
                controllerRef.current.updateDimensions(
                    containerRef.current.clientWidth,
                    containerRef.current.clientHeight
                );
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
        };
    }, [loadSanctuaryPets]);

    const getAvailableColors = (type: string) => {
        switch (type) {
            case 'dog': return ['black'];
            case 'crab': return ['red'];
            case 'fox': return ['red'];
            case 'clippy': return ['black'];
            case 'chicken': return ['white'];
            case 'cockatiel': return ['gray'];
            case 'deno': return ['green'];
            case 'horse': return ['black'];
            case 'panda': return ['black'];
            case 'snake': return ['green'];
            case 'totoro': return ['gray'];
            case 'custom': return ['custom'];
            default: return ['black'];
        }
    };

    // Update color when type changes
    useEffect(() => {
        const colors = getAvailableColors(newPetType);
        if (!colors.includes(newPetColor)) {
            setNewPetColor(colors[0]);
        }
    }, [newPetType]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/gif;base64, prefix
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const ingestAsset = async (file: File): Promise<string> => {
        const base64 = await fileToBase64(file);
        const result = await window.electronAPI.wormholeIngestContent({
            bytesBase64: base64,
            fileName: file.name,
            mediaType: 'image', // Assuming GIFs are images
            sourceLabel: 'custom-pet-asset'
        });

        // We need the local path to display it. 
        // Read the card back to get the path.
        const records = await window.electronAPI.p2pRead(result.cardId);
        let path = '';
        for (const record of records) {
            try {
                const parsed = JSON.parse(record);
                if (parsed.type === 'card' && parsed.wormhole?.ingest?.originalPath) {
                    path = parsed.wormhole.ingest.originalPath;
                    break;
                }
            } catch (e) { }
        }

        // Convert to file URL
        return `file://${path.replace(/\\/g, '/')}`;
    };

    const handleAddPet = async () => {
        if (!controllerRef.current) return;

        if (newPetType === 'custom') {
            if (!customIdle || !customWalk || !customRun) {
                alert('Please upload all required animations (Idle, Walk, Run).');
                return;
            }

            setIsCreating(true);
            try {
                const idleUrl = await ingestAsset(customIdle);
                const walkUrl = await ingestAsset(customWalk);
                const runUrl = await ingestAsset(customRun);

                const petName = newPetName || 'Custom Pet';
                const petId = `pet-${Date.now()}`;

                // Create pet config
                const petConfig: PetConfig = {
                    id: petId,
                    type: 'custom',
                    color: 'custom',
                    name: petName,
                    speed: 3,
                    size: 1.0,
                    assets: {
                        idle: idleUrl,
                        walk: walkUrl,
                        run: runUrl
                    }
                };

                // Save as a proper pet card
                const petCard = await createPetCard(petConfig, { zone: 'sanctuary', enteredAt: Date.now() });
                
                if (petCard) {
                    setPetCards(prev => new Map(prev).set(petCard.id, petCard));
                    controllerRef.current.addPet(petConfig);
                    setPets([...controllerRef.current.getPets()]);
                }

                setShowAddModal(false);
                setNewPetName('');
                setCustomIdle(null);
                setCustomWalk(null);
                setCustomRun(null);
            } catch (error) {
                console.error('Failed to create custom pet:', error);
                alert('Failed to create custom pet. See console for details.');
            } finally {
                setIsCreating(false);
            }
        } else {
            // Standard Pet Logic - save as card
            setIsCreating(true);
            try {
                const petId = `pet-${Date.now()}`;
                const petConfig: PetConfig = {
                    id: petId,
                    type: newPetType,
                    color: newPetColor,
                    name: newPetName || `My ${newPetType}`,
                    speed: 3,
                    size: 1.0
                };
                
                const petCard = await createPetCard(petConfig, { zone: 'sanctuary', enteredAt: Date.now() });
                
                if (petCard) {
                    setPetCards(prev => new Map(prev).set(petCard.id, petCard));
                    controllerRef.current.addPet(petConfig);
                    setPets([...controllerRef.current.getPets()]);
                }
                
                setShowAddModal(false);
                setNewPetName('');
            } catch (error) {
                console.error('Failed to create pet:', error);
            } finally {
                setIsCreating(false);
            }
        }
    };

    const handleForgeSave = async (config: any) => {
        const assets: any = {};
        const modules: any = {};

        // Build assets map
        if (config.modules.idle.asset) assets.idle = config.modules.idle.asset.url;
        if (config.modules.walk.asset) assets.walk = config.modules.walk.asset.url;
        if (config.modules.run.asset) assets.run = config.modules.run.asset.url;
        if (config.modules.sit.asset) assets.lie = config.modules.sit.asset.url;
        if (config.modules.special?.asset) assets.special = config.modules.special.asset.url;

        // Build modules map with trigger logic
        for (const [key, mod] of Object.entries(config.modules) as [string, any][]) {
            if (mod.asset) {
                modules[key] = {
                    id: key,
                    assetUrl: mod.asset.url,
                    trigger: mod.trigger || 'default',
                    probability: mod.probability,
                    triggerValue: mod.triggerValue
                };
            }
        }

        const newPetId = Date.now().toString();
        const newPetConfig: PetConfig = {
            id: newPetId,
            type: 'custom',
            color: 'white',
            name: config.name,
            speed: config.speed,
            size: config.scale,
            assets: assets,
            modules: modules
        };

        // Save as a proper pet card
        const petCard = await createPetCard(newPetConfig, { zone: 'sanctuary', enteredAt: Date.now() });
        
        if (petCard && controllerRef.current) {
            setPetCards(prev => new Map(prev).set(petCard.id, petCard));
            controllerRef.current.addPet(newPetConfig);
            setPets([...controllerRef.current.getPets()]);
        }

        setIsForgeOpen(false);
    };

    const handlePetClick = (petId: string) => {
        if (controllerRef.current) {
            controllerRef.current.triggerClick(petId);
            setPets([...controllerRef.current.getPets()]); // Force re-render
        }
    };

    // Handle pet drag start from sanctuary
    const handlePetDragStart = useCallback((petId: string, e: React.DragEvent) => {
        const petCard = petCards.get(petId);
        if (!petCard) return;

        const dragData = createPetDragData(petCard, 'sanctuary');
        e.dataTransfer.setData('application/x-pet-card', dragData);
        e.dataTransfer.setData('application/json', dragData);
        e.dataTransfer.effectAllowed = 'move';
    }, [petCards]);

    // Handle drop - return pet from header to sanctuary
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const parsed = parsePetDragData(e.dataTransfer);
        if (!parsed) return;

        const { petCard, sourceZone } = parsed;
        
        // Only accept drops from header
        if (sourceZone !== 'header') return;

        // Update pet location to sanctuary
        const updatedCard = await updatePetLocation(petCard, 'sanctuary');
        if (updatedCard && controllerRef.current) {
            const config = petCardToConfig(updatedCard);
            controllerRef.current.addPet(config);
            
            setPetCards(prev => new Map(prev).set(updatedCard.id, updatedCard));
            setPets([...controllerRef.current.getPets()]);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (hasPetDragData(e.dataTransfer)) {
            e.dataTransfer.dropEffect = 'move';
        }
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (hasPetDragData(e.dataTransfer)) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    }, []);

    return (
        <div className="h-full flex flex-col bg-astro-dark relative overflow-hidden">
            {/* Header */}
            <div className="flex-none px-6 py-4 border-b border-astro-border bg-gray-900/50 backdrop-blur flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <rux-icon icon="pets" size="small" className="text-astro-primary"></rux-icon>
                    <h1 className="text-xl font-bold text-white tracking-widest uppercase">Pet Sanctuary</h1>
                </div>

                <div className="flex gap-2">
                    <PrimaryButton onClick={() => setIsForgeOpen(true)}>
                        <rux-icon icon="build" size="small"></rux-icon> Forge Pet
                    </PrimaryButton>
                    <PrimaryButton onClick={() => setShowAddModal(true)}>
                        <rux-icon icon="add" size="small"></rux-icon> Adopt Standard
                    </PrimaryButton>
                </div>
            </div>

            {/* Game Area - Drop zone for pets returning from header */}
            <div 
                ref={containerRef} 
                className={`flex-1 relative overflow-hidden bg-[url('/grid-pattern.png')] bg-center transition-all duration-200 ${
                    isDragOver ? 'ring-2 ring-inset ring-astro-primary bg-astro-primary/5' : ''
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-transparent to-gray-900/80 pointer-events-none"></div>

                {/* Loading state */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-gray-400 text-sm">Loading pets...</div>
                    </div>
                )}

                {/* Drop zone indicator */}
                {isDragOver && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="bg-astro-primary/20 px-6 py-3 rounded-lg border border-astro-primary">
                            <span className="text-astro-primary font-bold text-lg">Drop pet here to return to Sanctuary</span>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && pets.length === 0 && !isDragOver && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <rux-icon icon="pets" size="large" className="text-gray-600 mb-2"></rux-icon>
                            <p className="text-gray-500 text-sm">No pets in the sanctuary</p>
                            <p className="text-gray-600 text-xs mt-1">Adopt a pet or drag one from the header portal</p>
                        </div>
                    </div>
                )}

                {pets.map(pet => (
                    <Pet 
                        key={pet.id} 
                        pet={pet} 
                        onPetClick={handlePetClick}
                        onDragStart={(e) => handlePetDragStart(pet.id, e)}
                        draggable={!!petCards.get(pet.id)}
                    />
                ))}

                {/* Status Overlay */}
                <div className="absolute bottom-4 left-4 p-4 bg-gray-900/80 border border-astro-border rounded backdrop-blur-sm">
                    <h3 className="text-xs font-bold text-astro-off uppercase mb-2">Sanctuary Status</h3>
                    <div className="flex gap-4">
                        <div className="bg-black/50 p-2 rounded border border-gray-700 min-w-[80px] text-center">
                            <div className="text-2xl font-mono text-white">{pets.length}</div>
                            <div className="text-[10px] text-gray-500 uppercase">Active Pets</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pet Forge Modal */}
            {isForgeOpen && (
                <PetForge onClose={() => setIsForgeOpen(false)} onSave={handleForgeSave} />
            )}

            {/* Add Pet Modal (Standard) */}
            <rux-dialog open={showAddModal} onRuxdialogclosed={() => setShowAddModal(false)}>
                <div slot="header">Add a New Friend</div>
                <div className="p-4 space-y-4 min-w-[400px]">
                    <rux-input
                        label="Pet Name"
                        placeholder="Name your pet..."
                        value={newPetName}
                        onRuxinput={(e: any) => setNewPetName(e.target.value)}
                    ></rux-input>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Pet Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['dog', 'crab', 'fox', 'clippy', 'chicken', 'cockatiel', 'deno', 'horse', 'panda', 'snake', 'totoro', 'custom'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setNewPetType(type as any)}
                                    className={`
                                        px-3 py-2 rounded text-xs font-bold uppercase transition-colors border
                                        ${newPetType === type
                                            ? 'bg-astro-primary text-black border-astro-primary'
                                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}
                                    `}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {newPetType === 'custom' ? (
                        <div className="space-y-3 border-t border-gray-700 pt-3">
                            <p className="text-xs text-gray-400">Upload GIF assets for your custom pet.</p>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Idle Animation (Required)</label>
                                <input type="file" accept="image/gif" onChange={(e) => setCustomIdle(e.target.files?.[0] || null)} className="text-xs text-gray-300" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Walk Animation (Required)</label>
                                <input type="file" accept="image/gif" onChange={(e) => setCustomWalk(e.target.files?.[0] || null)} className="text-xs text-gray-300" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Run Animation (Required)</label>
                                <input type="file" accept="image/gif" onChange={(e) => setCustomRun(e.target.files?.[0] || null)} className="text-xs text-gray-300" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">Color Variant</label>
                            <div className="flex flex-wrap gap-2">
                                {getAvailableColors(newPetType).map(color => (
                                    <button
                                        key={color}
                                        onClick={() => setNewPetColor(color)}
                                        className={`
                                            px-3 py-1 rounded-full text-xs border capitalize
                                            ${newPetColor === color
                                                ? 'bg-white text-black border-white'
                                                : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}
                                        `}
                                    >
                                        {color}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div slot="footer" className="flex justify-end gap-2">
                    <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={handleAddPet} disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Adopt'}
                    </PrimaryButton>
                </div>
            </rux-dialog>
        </div>
    );
};

export default Pets;
