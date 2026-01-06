import React, { useState, useEffect, useRef } from 'react';
import { MediaClip, MediaClipType, MediaPlacement } from '../types';
import { mediaCaptureService } from '../services/mediaCaptureService';
import { sessionService } from '../services/sessionService';
import { v4 as uuidv4 } from 'uuid';

interface MediaDockProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    onPlaceClip: (clip: MediaClip, mode: 'world' | 'camera' | 'fleetA' | 'fleetB' | 'fleetC') => void;
    onAddStem: (clip: MediaClip) => void;
}

type TabMode = 'CAPTURE' | 'LIBRARY' | 'PLACEMENTS';
type FilterType = 'ALL' | 'SCREEN' | 'WEBCAM' | 'MIC' | 'IMPORTED';
type SortType = 'NEWEST' | 'OLDEST' | 'LONGEST' | 'SHORTEST';

const getBlobDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
        if (blob.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            video.onerror = () => resolve(0);
            video.src = URL.createObjectURL(blob);
        } else if (blob.type.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };
            audio.onerror = () => resolve(0);
            audio.src = URL.createObjectURL(blob);
        } else {
            resolve(0);
        }
    });
};

const MediaDock: React.FC<MediaDockProps> = ({ isOpen, setIsOpen, onPlaceClip, onAddStem }) => {
    const [activeTab, setActiveTab] = useState<TabMode>('CAPTURE');
    
    // Capture State
    const [captureMode, setCaptureMode] = useState<MediaClipType>('webcam');
    const [isRecording, setIsRecording] = useState(false);
    const [timer, setTimer] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [autoPlaceEnabled, setAutoPlaceEnabled] = useState(false);
    const [lastPlacementMode, setLastPlacementMode] = useState<'world' | 'camera' | 'fleetA' | 'fleetB' | 'fleetC'>('world');
    const quickTakeTimeout = useRef<number | null>(null);

    // Library State
    const [clips, setClips] = useState<MediaClip[]>([]);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [sort, setSort] = useState<SortType>('NEWEST');
    const [search, setSearch] = useState("");
    const [expandedClip, setExpandedClip] = useState<string | null>(null);

    // Placements State
    const [placements, setPlacements] = useState<MediaPlacement[]>([]);
    const [editingPlacement, setEditingPlacement] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timerRef = useRef<number>();

    // Initial Load & Refresh
    useEffect(() => {
        if(isOpen) {
            refreshData();
        }
    }, [isOpen]);

    const refreshData = () => {
        setClips([...sessionService.getMediaClips()]);
        setPlacements([...sessionService.getMediaPlacements()]);
    };

    // Stream Management
    useEffect(() => {
        if (!isOpen || activeTab !== 'CAPTURE') {
            mediaCaptureService.stopStream();
            setStream(null);
            return;
        }

        const initStream = async () => {
            try {
                let s: MediaStream | null = null;
                if (captureMode === 'webcam') s = await mediaCaptureService.getWebcamStream();
                if (captureMode === 'screen') s = await mediaCaptureService.getScreenStream({ audio: true });
                if (captureMode === 'mic') s = await mediaCaptureService.getMicStream();
                
                setStream(s);
                if (videoRef.current && s) {
                    videoRef.current.srcObject = s;
                }
            } catch (e) {
                console.error("Stream error", e);
            }
        };
        initStream();

        return () => {
            if(!isRecording) mediaCaptureService.stopStream();
        };
    }, [isOpen, activeTab, captureMode]);

    const startRecording = () => {
        if (!stream || isRecording) return;
        mediaCaptureService.startRecording(stream);
        setIsRecording(true);
        setTimer(0);
        timerRef.current = window.setInterval(() => setTimer(t => t + 0.1), 100);
        sessionService.logEvent('MEDIA_RECORD_START', { mode: captureMode });
    };

    const stopRecording = async () => {
        if (!isRecording) return;
        clearInterval(timerRef.current);
        if (quickTakeTimeout.current) {
            clearTimeout(quickTakeTimeout.current);
            quickTakeTimeout.current = null;
        }
        setIsRecording(false);
        
        try {
            const { blob, mimeType, durationSec } = await mediaCaptureService.stopRecording();
            const hash = await sessionService.computeHash(blob);
            let thumb = "";
            
            if (captureMode !== 'mic') {
                thumb = await mediaCaptureService.generateThumbnail(blob);
            }

            const clip: MediaClip = {
                id: uuidv4(),
                hash,
                mimeType,
                kind: captureMode,
                createdAt: Date.now(),
                durationSec,
                label: `${captureMode.toUpperCase()} - ${new Date().toLocaleTimeString()}`,
                thumbnailDataUrl: thumb,
                blob
            };

            sessionService.addMediaClip(clip);
            refreshData();
            setTimer(0);
            sessionService.logEvent('MEDIA_RECORD_STOP', { id: clip.id, duration: durationSec });

            if (autoPlaceEnabled) {
                onPlaceClip(clip, lastPlacementMode);
            }
        } catch(e) {
            console.error("Stop recording failed", e);
        }
    };

    const handleQuickTake = (seconds: number) => {
        startRecording();
        quickTakeTimeout.current = window.setTimeout(() => {
            stopRecording();
        }, seconds * 1000);
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        
        try {
            const hash = await sessionService.computeHash(file);
            const thumb = file.type.startsWith('video/') ? await mediaCaptureService.generateThumbnail(file) : "";
            const duration = await getBlobDuration(file);
            
            const clip: MediaClip = {
                id: uuidv4(),
                hash,
                mimeType: file.type,
                kind: 'imported',
                createdAt: Date.now(),
                durationSec: duration,
                label: file.name,
                thumbnailDataUrl: thumb,
                blob: file
            };
            sessionService.addMediaClip(clip);
            refreshData();
            alert("Clip Imported");
        } catch(err) {
            console.error(err);
            alert("Import failed");
        }
    };

    const handleDeletePlacement = (id: string) => {
        if (confirm("Remove this placement?")) {
            sessionService.removeMediaPlacement(id);
            refreshData();
        }
    };

    const updatePlacement = (id: string, updates: Partial<MediaPlacement>) => {
        sessionService.updateMediaPlacement(id, updates);
        refreshData();
    };

    // Filter Logic
    const filteredClips = clips
        .filter(c => filter === 'ALL' || c.kind.toUpperCase() === filter)
        .filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'NEWEST') return b.createdAt - a.createdAt;
            if (sort === 'OLDEST') return a.createdAt - b.createdAt;
            if (sort === 'LONGEST') return b.durationSec - a.durationSec;
            if (sort === 'SHORTEST') return a.durationSec - b.durationSec;
            return 0;
        });

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-4 left-52 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] ${isOpen ? 'bg-gray-200 text-black border-white' : 'bg-black/50 text-white border-white/30'}`}
                title="Media Suite v2"
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-video'}`}></i>
            </button>

            <div className={`fixed top-20 left-1/2 -translate-x-1/2 w-[700px] h-[600px] bg-black/95 backdrop-blur-xl border border-gray-700 rounded-xl z-40 transform transition-all duration-300 shadow-2xl overflow-hidden flex flex-col ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
                
                {/* TABS */}
                <div className="flex border-b border-gray-800 bg-black/50">
                    <button onClick={() => setActiveTab('CAPTURE')} className={`flex-1 py-3 text-xs font-bold tracking-widest ${activeTab === 'CAPTURE' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}>CAPTURE</button>
                    <button onClick={() => setActiveTab('LIBRARY')} className={`flex-1 py-3 text-xs font-bold tracking-widest ${activeTab === 'LIBRARY' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}>LIBRARY ({clips.length})</button>
                    <button onClick={() => setActiveTab('PLACEMENTS')} className={`flex-1 py-3 text-xs font-bold tracking-widest ${activeTab === 'PLACEMENTS' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}>PLACEMENTS ({placements.length})</button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto bg-black/20 relative">
                    
                    {/* --- CAPTURE TAB --- */}
                    {activeTab === 'CAPTURE' && (
                        <div className="flex flex-col h-full">
                            <div className="relative flex-1 bg-gray-900 flex items-center justify-center overflow-hidden">
                                {captureMode !== 'mic' ? (
                                    <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500 animate-pulse">
                                        <i className="fas fa-microphone text-6xl mb-4"></i>
                                        <div className="text-xs font-mono">AUDIO INPUT ACTIVE</div>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs text-red-500 font-mono border border-red-900/50">
                                    {isRecording ? `REC ${timer.toFixed(1)}s` : 'STANDBY'}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-800 bg-black/40">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex bg-gray-800 rounded-lg p-1">
                                        {['webcam', 'screen', 'mic'].map((m) => (
                                            <button 
                                                key={m}
                                                onClick={() => !isRecording && setCaptureMode(m as any)}
                                                className={`px-4 py-2 rounded-md text-[10px] font-bold transition ${captureMode === m ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {m.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer">
                                            <input type="checkbox" checked={autoPlaceEnabled} onChange={(e) => setAutoPlaceEnabled(e.target.checked)} />
                                            AUTO-PLACE
                                        </label>
                                        <select 
                                            disabled={!autoPlaceEnabled}
                                            value={lastPlacementMode} 
                                            onChange={(e) => setLastPlacementMode(e.target.value as any)}
                                            className="bg-gray-800 text-gray-300 text-[10px] border border-gray-700 rounded p-1 outline-none"
                                        >
                                            <option value="world">WORLD</option>
                                            <option value="camera">HUD</option>
                                            <option value="fleetA">DECK A</option>
                                            <option value="fleetB">DECK B</option>
                                            <option value="fleetC">DECK C</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 justify-center">
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => handleQuickTake(3)} disabled={isRecording} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] px-3 py-1 rounded border border-gray-700">3s TAKE</button>
                                        <button onClick={() => handleQuickTake(5)} disabled={isRecording} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] px-3 py-1 rounded border border-gray-700">5s TAKE</button>
                                        <button onClick={() => handleQuickTake(10)} disabled={isRecording} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] px-3 py-1 rounded border border-gray-700">10s TAKE</button>
                                    </div>

                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 bg-red-900/20 shadow-[0_0_20px_red]' : 'border-white bg-white/10 hover:bg-white/20'}`}
                                    >
                                        <div className={`rounded transition-all ${isRecording ? 'w-6 h-6 bg-red-500 rounded-sm' : 'w-12 h-12 bg-red-600 rounded-full scale-75'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- LIBRARY TAB --- */}
                    {activeTab === 'LIBRARY' && (
                        <div className="p-4 flex flex-col h-full">
                            <div className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    placeholder="Search clips..." 
                                    value={search} 
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 text-xs text-white outline-none focus:border-white/50"
                                />
                                <label className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-2 rounded cursor-pointer flex items-center gap-2">
                                    <i className="fas fa-file-import"></i> IMPORT
                                    <input type="file" accept="video/*,audio/*" className="hidden" onChange={handleImportFile} />
                                </label>
                            </div>
                            
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                                {['ALL', 'SCREEN', 'WEBCAM', 'MIC', 'IMPORTED'].map(f => (
                                    <button key={f} onClick={() => setFilter(f as any)} className={`px-2 py-1 rounded text-[9px] font-bold border ${filter === f ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-700'}`}>{f}</button>
                                ))}
                                <div className="w-[1px] bg-gray-700 mx-2"></div>
                                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-gray-900 text-gray-400 text-[9px] border border-gray-700 rounded outline-none">
                                    <option value="NEWEST">NEWEST</option>
                                    <option value="OLDEST">OLDEST</option>
                                    <option value="LONGEST">LONGEST</option>
                                    <option value="SHORTEST">SHORTEST</option>
                                </select>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {filteredClips.length === 0 && <div className="text-center text-gray-600 text-xs py-10">No clips found.</div>}
                                {filteredClips.map(clip => (
                                    <div key={clip.id} className="bg-gray-900/50 p-2 rounded border border-gray-800 hover:border-gray-600 group transition">
                                        <div className="flex gap-3">
                                            <div className="w-20 h-12 bg-black rounded overflow-hidden flex-shrink-0 relative">
                                                {clip.thumbnailDataUrl ? (
                                                    <img src={clip.thumbnailDataUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-700"><i className="fas fa-music"></i></div>
                                                )}
                                                <div className="absolute bottom-0 right-0 bg-black/80 text-[8px] text-white px-1">{clip.durationSec.toFixed(1)}s</div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div className="text-xs font-bold text-gray-300 truncate" title={clip.label}>{clip.label}</div>
                                                    <span className="text-[8px] px-1 bg-gray-800 text-gray-500 rounded">{clip.kind.toUpperCase()}</span>
                                                </div>
                                                <div className="text-[9px] text-gray-600 font-mono mt-0.5">{new Date(clip.createdAt).toLocaleString()}</div>
                                                
                                                <div className="flex flex-wrap gap-1 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => onPlaceClip(clip, 'world')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded text-gray-300">World</button>
                                                    <button onClick={() => onPlaceClip(clip, 'camera')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded text-gray-300">HUD</button>
                                                    <button onClick={() => setExpandedClip(expandedClip === clip.id ? null : clip.id)} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded text-gray-300">Attach...</button>
                                                    <button onClick={() => onAddStem(clip)} className="text-[9px] bg-gray-800 hover:bg-cyan-500 hover:text-black px-2 py-0.5 rounded text-gray-300">To Stem</button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Expandable Placement Options */}
                                        {expandedClip === clip.id && (
                                            <div className="mt-2 pt-2 border-t border-gray-800 flex gap-2">
                                                <button onClick={() => onPlaceClip(clip, 'fleetA')} className="flex-1 text-[9px] bg-cyan-900/30 text-cyan-300 hover:bg-cyan-500 hover:text-black px-2 py-1 rounded">DECK A</button>
                                                <button onClick={() => onPlaceClip(clip, 'fleetB')} className="flex-1 text-[9px] bg-purple-900/30 text-purple-300 hover:bg-purple-500 hover:text-black px-2 py-1 rounded">DECK B</button>
                                                <button onClick={() => onPlaceClip(clip, 'fleetC')} className="flex-1 text-[9px] bg-green-900/30 text-green-300 hover:bg-green-500 hover:text-black px-2 py-1 rounded">DECK C</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- PLACEMENTS TAB --- */}
                    {activeTab === 'PLACEMENTS' && (
                        <div className="p-4 h-full flex flex-col">
                            {placements.length === 0 && <div className="text-center text-gray-600 text-xs py-10">No active placements in scene.</div>}
                            
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {placements.map(p => {
                                    const clip = clips.find(c => c.hash === p.clipHash);
                                    const isEditing = editingPlacement === p.id;
                                    
                                    return (
                                        <div key={p.id} className={`bg-gray-900/50 rounded border transition p-2 ${isEditing ? 'border-blue-500' : 'border-gray-800 hover:border-gray-600'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-xs font-bold text-gray-300">{clip ? clip.label : 'Unknown Clip'}</div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => setEditingPlacement(isEditing ? null : p.id)} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${isEditing ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}><i className="fas fa-sliders-h"></i></button>
                                                    <button onClick={() => handleDeletePlacement(p.id)} className="w-5 h-5 rounded flex items-center justify-center text-[10px] bg-gray-800 text-red-400 hover:bg-red-900"><i className="fas fa-trash"></i></button>
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-gray-500 font-mono mb-1">MODE: {p.attachMode.toUpperCase()}</div>
                                            
                                            {isEditing && (
                                                <div className="mt-2 pt-2 border-t border-gray-800 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] text-gray-400">SCALE</span>
                                                        <input type="range" min="0.1" max="5" step="0.1" value={p.scale.x} onChange={(e) => updatePlacement(p.id, { scale: { x: parseFloat(e.target.value), y: parseFloat(e.target.value), z: 1 } })} className="w-24 h-1" />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] text-gray-400">OPACITY</span>
                                                        <input type="range" min="0" max="1" step="0.05" value={p.opacity} onChange={(e) => updatePlacement(p.id, { opacity: parseFloat(e.target.value) })} className="w-24 h-1" />
                                                    </div>
                                                    <label className="flex items-center gap-2 text-[9px] text-gray-400">
                                                        <input type="checkbox" checked={p.loop} onChange={(e) => updatePlacement(p.id, { loop: e.target.checked })} />
                                                        LOOP VIDEO
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
};

export default MediaDock;