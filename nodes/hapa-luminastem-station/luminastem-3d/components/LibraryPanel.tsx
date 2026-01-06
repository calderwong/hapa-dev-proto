
import React, { useState, useEffect } from 'react';
import { LibraryBundle, LibraryLoopRef } from '../types';
import { sessionService } from '../services/sessionService';
import { audioService } from '../services/audioService';

interface LibraryPanelProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    onCloneLoop: (loop: LibraryLoopRef, bundle: LibraryBundle) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ isOpen, setIsOpen, onCloneLoop }) => {
    const [bundles, setBundles] = useState<LibraryBundle[]>([]);
    const [expandedBundles, setExpandedBundles] = useState<string[]>([]);
    const [auditioningLoopId, setAuditioningLoopId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setBundles([...sessionService.getLibraryBundles()]);
        }
    }, [isOpen]);

    const toggleBundle = (id: string) => {
        if (expandedBundles.includes(id)) setExpandedBundles(expandedBundles.filter(b => b !== id));
        else setExpandedBundles([...expandedBundles, id]);
    };

    const handleAudition = async (loop: LibraryLoopRef, bundle: LibraryBundle) => {
        if (auditioningLoopId === loop.id) {
            // Stop
            audioService.stopAudition();
            setAuditioningLoopId(null);
            sessionService.logEvent('LIB_LOOP_AUDITION_STOP', { loopId: loop.id });
        } else {
            // Play
            // Load first asset from map for preview (MVP limitation: audition only primary stem)
            // Ideally mix all assets in the loop. 
            // For now, let's pick deck 0 or first available key.
            const deckIds = Object.keys(loop.assetMap).map(Number);
            if (deckIds.length > 0) {
                const assetId = loop.assetMap[deckIds[0]];
                const assetData = await sessionService.getAssetFromBundle(bundle.bundleId, assetId);
                if (assetData) {
                    audioService.startAudition(assetData.buffer);
                    setAuditioningLoopId(loop.id);
                    sessionService.logEvent('LIB_LOOP_AUDITION_START', { loopId: loop.id });
                }
            }
        }
    };

    return (
        <>
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-68 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(0,100,255,0.3)] ${isOpen ? 'bg-blue-600 text-white border-blue-500' : 'bg-black/50 text-blue-500 border-blue-500/30'}`}
                title="Loop Library"
                style={{ top: '270px' }} // Position below Vibe
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-book-open'}`}></i>
            </button>

            <div className={`fixed top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-blue-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-20 px-4 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6 border-b border-blue-500/30 pb-2">
                    <h2 className="text-xl font-black text-white tracking-wider italic">LOOP LIBRARY</h2>
                    <div className="text-[10px] font-mono text-gray-500">{bundles.length} BUNDLES</div>
                </div>

                <div className="space-y-4">
                    {bundles.length === 0 && (
                        <div className="text-center py-8 text-gray-600 text-xs italic">
                            <i className="fas fa-box-open text-2xl mb-2 opacity-50"></i>
                            <p>Library Empty.</p>
                            <p>Import Zip Packs to populate.</p>
                        </div>
                    )}

                    {bundles.map(b => (
                        <div key={b.bundleId} className="border border-gray-800 rounded bg-gray-900/30 overflow-hidden">
                            <div 
                                onClick={() => toggleBundle(b.bundleId)} 
                                className="p-3 bg-gray-900 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition"
                            >
                                <div>
                                    <div className="text-xs font-bold text-gray-300">{b.label}</div>
                                    <div className="text-[9px] text-gray-500 font-mono">{(b.source || '').toUpperCase()} • {b.loops.length} LOOPS</div>
                                </div>
                                <i className={`fas fa-chevron-down text-gray-500 transition-transform ${expandedBundles.includes(b.bundleId) ? 'rotate-180' : ''}`}></i>
                            </div>

                            {expandedBundles.includes(b.bundleId) && (
                                <div className="p-2 space-y-1 bg-black/20">
                                    {b.loops.map(l => (
                                        <div key={l.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 group border border-transparent hover:border-blue-500/30">
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] text-white font-bold truncate w-28">{l.title}</div>
                                                <div className="text-[9px] text-gray-500">{Object.keys(l.assetMap).length} STEMS</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleAudition(l, b)}
                                                    className={`w-6 h-6 rounded flex items-center justify-center border transition ${auditioningLoopId === l.id ? 'bg-green-500 text-black border-green-400' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                                                >
                                                    <i className={`fas ${auditioningLoopId === l.id ? 'fa-stop' : 'fa-play'}`}></i>
                                                </button>
                                                <button 
                                                    onClick={() => onCloneLoop(l, b)}
                                                    className="w-6 h-6 rounded flex items-center justify-center border border-blue-500/30 bg-blue-900/20 text-blue-400 hover:bg-blue-600 hover:text-white transition"
                                                    title="Clone to Session"
                                                >
                                                    <i className="fas fa-plus"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default LibraryPanel;
