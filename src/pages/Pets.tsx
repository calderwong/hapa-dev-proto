// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import PageContainer from '../components/PageContainer';
import { PetController } from '../components/pets/PetController';
import Pet from '../components/pets/Pet';
import type { PetInstance, PetConfig, PetState } from '../components/pets/types';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import PetForge from '../components/PetForge';

const Pets: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const controllerRef = useRef<PetController | null>(null);
    const [pets, setPets] = useState<PetInstance[]>([]);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);

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

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize controller
        const { clientWidth, clientHeight } = containerRef.current;
        controllerRef.current = new PetController(clientWidth, clientHeight);

        // Add a default pet
        controllerRef.current.addPet({
            id: 'pet-1',
            type: 'dog',
            color: 'black',
            name: 'Hapa Dog',
            speed: 3,
            size: 1.0
        });

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
    }, []);

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

                const petData = {
                    type: 'pet',
                    id: petId,
                    name: petName,
                    createdAt: new Date().toISOString(),
                    config: {
                        type: 'custom',
                        speed: 3,
                        size: 1.0,
                        assets: {
                            idle: idleUrl,
                            walk: walkUrl,
                            run: runUrl
                        }
                    }
                };

                // Save to P2P
                const coreName = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                await window.electronAPI.p2pCreateCore(coreName);
                await window.electronAPI.p2pAppend({
                    name: coreName,
                    data: JSON.stringify(petData)
                });

                controllerRef.current.addPet({
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
                });

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
            // Standard Pet Logic
            const petId = `pet-${Date.now()}`;
            controllerRef.current.addPet({
                id: petId,
                type: newPetType,
                color: newPetColor,
                name: newPetName || `My ${newPetType}`,
                speed: 3,
                size: 1.0
            });
            setShowAddModal(false);
            setNewPetName('');
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

        if (window.electronAPI?.p2pCreateCore && window.electronAPI?.p2pAppend) {
            const coreName = `pet-${newPetId}`;
            await window.electronAPI.p2pCreateCore(coreName);
            await window.electronAPI.p2pAppend({
                name: coreName,
                data: JSON.stringify(newPetConfig)
            });

            if (controllerRef.current) {
                controllerRef.current.addPet(newPetConfig);
            }
        }

        setIsForgeOpen(false);
    };

    const handlePetClick = (petId: string) => {
        if (controllerRef.current) {
            controllerRef.current.triggerClick(petId);
            setPets([...controllerRef.current.getPets()]); // Force re-render
        }
    };

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

            {/* Game Area */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[url('/grid-pattern.png')] bg-center">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-transparent to-gray-900/80 pointer-events-none"></div>

                {pets.map(pet => (
                    <Pet key={pet.id} pet={pet} onPetClick={handlePetClick} />
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
