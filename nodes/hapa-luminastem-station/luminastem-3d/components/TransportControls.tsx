
import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../services/audioService';
import { sessionService } from '../services/sessionService';
import { LoopClip, TempoConfig, KeyframeMeta } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TransportControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    totalDuration: number;
    currentTime: number;
    loops: LoopClip[];
    onLoopSelect: (loop: LoopClip) => void;
    onToggleKeyframes: () => void;
    isKeyframesOpen: boolean;
}

const TransportControls: React.FC<TransportControlsProps> = ({ 
    isPlaying, onPlayPause, totalDuration, currentTime, loops, onLoopSelect, onToggleKeyframes, isKeyframesOpen
}) => {
    const [dragTime, setDragTime] = useState<number | null>(null);
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);
    const [loopName, setLoopName] = useState("");
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    
    const [keyframes, setKeyframes] = useState<KeyframeMeta[]>([]);
    
    // Tempo UI State
    const [tempo, setTempo] = useState<TempoConfig>(audioService.getTempoConfig());
    const tapTimes = useRef<number[]>([]);

    useEffect(() => {
        setTempo(audioService.getTempoConfig());
        // Simple poll for UI update
        const interval = setInterval(() => {
            setKeyframes([...sessionService.getKeyframes()]);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const displayTime = dragTime !== null ? dragTime : currentTime;
    const progress = Math.max(0, Math.min(1, displayTime / (totalDuration || 1)));

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        let t = p * totalDuration;
        if (tempo.snapEnabled) {
            t = audioService.snapTime(t);
        }
        setDragTime(t);
        const event = new CustomEvent('hapa-seek', { detail: t });
        window.dispatchEvent(event);
    };
    
    const markIn = () => { 
        const t = tempo.snapEnabled ? audioService.snapTime(displayTime) : displayTime;
        setLoopStart(t); 
    };
    
    const markOut = () => { 
        const t = tempo.snapEnabled ? audioService.snapTime(displayTime) : displayTime;
        setLoopEnd(t); 
    };
    
    const saveLoop = () => {
        if (loopStart !== null && loopEnd !== null) {
            const clip: LoopClip = {
                id: uuidv4(),
                name: loopName || `Loop ${loops.length + 1}`,
                start: Math.min(loopStart, loopEnd),
                end: Math.max(loopStart, loopEnd)
            };
            sessionService.addLoop(clip);
            setShowSaveDialog(false);
            setLoopName("");
            setLoopStart(null);
            setLoopEnd(null);
        }
    };

    const handleRenderLoop = async () => {
        if (loopStart === null || loopEnd === null || isRendering) return;
        setIsRendering(true);
        const start = Math.min(loopStart, loopEnd);
        const end = Math.max(loopStart, loopEnd);
        const duration = end - start;
        if (duration <= 0) return;

        sessionService.logEvent('RENDER_REQUESTED', { scope: 'LOOP', start, end });
        
        const evt = new CustomEvent('hapa-render', { 
            detail: { 
                scope: 'LOOP', 
                start, 
                duration 
            } 
        });
        window.dispatchEvent(evt);
        setTimeout(() => setIsRendering(false), 2000);
    };
    
    const handleAddKeyframe = () => {
        const evt = new CustomEvent('hapa-request-snapshot', {
             detail: { label: `Snapshot @ ${formatTime(displayTime)}`, kind: 'manual' }
        });
        window.dispatchEvent(evt);
        if (!isKeyframesOpen) onToggleKeyframes();
    };

    const handleTapTempo = () => {
        const now = Date.now();
        if (tapTimes.current.length > 0 && now - tapTimes.current[tapTimes.current.length - 1] > 2000) {
            tapTimes.current = [];
        }
        tapTimes.current.push(now);
        if (tapTimes.current.length > 4) tapTimes.current.shift(); 
        
        if (tapTimes.current.length > 1) {
            let sum = 0;
            for(let i=1; i<tapTimes.current.length; i++) {
                sum += tapTimes.current[i] - tapTimes.current[i-1];
            }
            const avgMs = sum / (tapTimes.current.length - 1);
            const bpm = Math.round(60000 / avgMs);
            updateTempo({ bpm });
        }
    };

    const updateTempo = (update: Partial<TempoConfig>) => {
        const newTempo = { ...tempo, ...update };
        setTempo(newTempo);
        sessionService.updateTempo(newTempo);
    };

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 10);
        return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="pointer-events-auto absolute bottom-0 left-0 w-full bg-black/90 border-t border-gray-800 p-2 z-40 flex flex-col gap-2 backdrop-blur-xl">
            {/* Timeline */}
            <div 
                className="relative w-full h-8 bg-gray-900 rounded cursor-pointer overflow-hidden group border border-gray-700 hover:border-green-500/50 transition-colors"
                onClick={handleSeek}
            >
                <div className="absolute top-0 left-0 h-full bg-green-500/20 pointer-events-none" style={{ width: `${progress * 100}%` }}></div>
                <div className="absolute top-0 h-full w-0.5 bg-green-400 shadow-[0_0_10px_#00ff88] pointer-events-none transition-all duration-75" style={{ left: `${progress * 100}%` }}></div>
                
                {/* Loop Clips */}
                {loops.map(l => (
                    <div 
                        key={l.id} 
                        className="absolute top-1 bottom-1 bg-cyan-500/30 border-l border-r border-cyan-400/50 hover:bg-cyan-500/50 z-10"
                        style={{ left: `${(l.start/totalDuration)*100}%`, width: `${((l.end-l.start)/totalDuration)*100}%` }}
                        onClick={(e) => { e.stopPropagation(); onLoopSelect(l); }}
                        title={l.name}
                    ></div>
                ))}
                
                {/* Keyframe Markers */}
                {keyframes.map(kf => (
                    <div
                        key={kf.id}
                        className="absolute top-0 h-2 w-0.5 bg-yellow-400 z-20 hover:h-full hover:w-1 transition-all cursor-pointer"
                        style={{ left: `${(kf.t_ms / 1000 / totalDuration) * 100}%` }}
                        title={kf.label}
                        onClick={(e) => { e.stopPropagation(); }}
                    />
                ))}
                
                {loopStart !== null && (
                    <div className="absolute top-0 h-full w-0.5 bg-yellow-400 z-10" style={{ left: `${(loopStart/totalDuration)*100}%` }}></div>
                )}
                {loopEnd !== null && (
                    <div className="absolute top-0 h-full w-0.5 bg-yellow-400 z-10" style={{ left: `${(loopEnd/totalDuration)*100}%` }}></div>
                )}
            </div>

            {/* Controls Row */}
            <div className="flex justify-between items-center px-2">
                
                <div className="flex gap-2 items-center">
                    <button onClick={onPlayPause} className={`w-8 h-8 rounded flex items-center justify-center border ${isPlaying ? 'bg-green-500 text-black border-green-500' : 'bg-gray-800 text-green-500 border-gray-700'}`}>
                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <div className="font-mono text-green-400 text-lg w-20 text-center">{formatTime(displayTime)}</div>
                    
                    <div className="h-6 w-[1px] bg-gray-700 mx-2"></div>
                    
                    <button onClick={markIn} className="text-[10px] bg-gray-800 hover:bg-yellow-900/40 text-gray-300 border border-gray-700 px-2 py-1 rounded">IN</button>
                    <button onClick={markOut} className="text-[10px] bg-gray-800 hover:bg-yellow-900/40 text-gray-300 border border-gray-700 px-2 py-1 rounded">OUT</button>
                    
                    {(loopStart !== null && loopEnd !== null) && (
                        <div className="flex gap-1">
                            <button onClick={() => setShowSaveDialog(true)} className="text-[10px] bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-2 py-1 rounded">SAVE</button>
                            <button 
                                onClick={handleRenderLoop} 
                                className={`text-[10px] border px-2 py-1 rounded font-bold transition flex items-center gap-1 ${isRendering ? 'bg-cyan-500 text-black border-cyan-400 animate-pulse' : 'bg-gray-800 text-cyan-400 border-cyan-500/30 hover:bg-cyan-900/50'}`}
                            >
                                {isRendering ? 'RENDERING...' : <><i className="fas fa-compact-disc"></i> BOUNCE LOOP</>}
                            </button>
                        </div>
                    )}
                </div>
                
                {/* KEYFRAME CONTROLS */}
                <div className="flex gap-1 items-center bg-yellow-900/20 px-2 py-1 rounded border border-yellow-500/30">
                     <button onClick={handleAddKeyframe} className="text-yellow-500 hover:text-white px-2 text-xs"><i className="fas fa-camera"></i> SNAPSHOT</button>
                     <div className="h-4 w-[1px] bg-yellow-500/30"></div>
                     <button onClick={onToggleKeyframes} className={`text-xs px-2 rounded ${isKeyframesOpen ? 'bg-yellow-500 text-black' : 'text-yellow-500'}`}><i className="fas fa-history"></i></button>
                </div>

                <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded border border-gray-700/50">
                    <div className="flex flex-col items-center">
                        <label className="text-[8px] text-gray-500 font-bold tracking-widest">BPM</label>
                        <input 
                            type="number" 
                            value={tempo.bpm} 
                            onChange={(e) => updateTempo({ bpm: Math.max(1, parseFloat(e.target.value)) })}
                            className="w-12 bg-transparent text-center text-xs font-bold text-cyan-400 outline-none border-b border-gray-700 focus:border-cyan-500"
                        />
                    </div>
                    <button onClick={handleTapTempo} className="px-3 py-2 bg-gray-800 hover:bg-cyan-900 text-[10px] text-cyan-300 rounded border border-gray-700 active:bg-cyan-500 active:text-black">TAP</button>
                    
                    <div className="h-4 w-[1px] bg-gray-700 mx-1"></div>
                    
                    <button 
                         onClick={() => updateTempo({ metronomeEnabled: !tempo.metronomeEnabled })}
                         className={`px-2 py-1 rounded text-[10px] font-bold border ${tempo.metronomeEnabled ? 'bg-purple-500 text-white border-purple-400' : 'bg-transparent text-gray-500 border-gray-700'}`}
                         title="Toggle Metronome"
                    >
                        METRO
                    </button>
                    
                    <button 
                         onClick={() => updateTempo({ snapEnabled: !tempo.snapEnabled })}
                         className={`px-2 py-1 rounded text-[10px] font-bold border ${tempo.snapEnabled ? 'bg-green-500 text-black border-green-400' : 'bg-transparent text-gray-500 border-gray-700'}`}
                         title="Snap to Grid"
                    >
                        SNAP
                    </button>
                    
                    <select 
                        value={tempo.subdivision} 
                        onChange={(e) => updateTempo({ subdivision: parseInt(e.target.value) })}
                        className="bg-gray-800 text-[10px] text-gray-300 border border-gray-700 rounded outline-none h-6"
                    >
                        <option value={4}>1/4</option>
                        <option value={8}>1/8</option>
                        <option value={16}>1/16</option>
                    </select>
                </div>
            </div>

            {showSaveDialog && (
                <div className="absolute bottom-12 left-4 bg-black border border-yellow-500 p-2 rounded shadow-xl flex gap-2">
                    <input 
                        type="text" 
                        value={loopName} 
                        onChange={e => setLoopName(e.target.value)} 
                        placeholder="Loop Name" 
                        className="bg-gray-900 text-white text-xs p-1 border border-gray-700 outline-none"
                    />
                    <button onClick={saveLoop} className="bg-yellow-500 text-black text-xs font-bold px-2 rounded">OK</button>
                    <button onClick={() => setShowSaveDialog(false)} className="bg-gray-800 text-white text-xs px-2 rounded">X</button>
                </div>
            )}
        </div>
    );
};

export default TransportControls;