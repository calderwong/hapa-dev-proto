
import React, { useEffect, useState } from 'react';
import { audioService } from '../services/audioService';
import { AutomationLane, ShowScriptV1 } from '../types';
import { sessionService } from '../services/sessionService';
import { showScriptEngine } from '../services/showScriptEngine';

interface AutomationPanelProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    isPlaying: boolean;
}

const AutomationPanel: React.FC<AutomationPanelProps> = ({ isOpen, setIsOpen, isPlaying }) => {
    const [lanes, setLanes] = useState<AutomationLane[]>([]);
    const [scripts, setScripts] = useState<ShowScriptV1[]>([]);

    useEffect(() => {
        if (isOpen) {
            const update = () => {
                setLanes([...audioService.getLanes()]);
                setScripts([...sessionService.getShowScripts()]);
            };
            // Initial load
            update();
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const setMode = (id: string, mode: 'READ' | 'WRITE' | 'OFF') => {
        audioService.setLaneMode(id, mode);
        setLanes([...audioService.getLanes()]); // force refresh UI
    };

    const clearLane = (id: string) => {
        if(confirm("Clear automation points for this lane?")) {
            audioService.clearLane(id);
            setLanes([...audioService.getLanes()]);
        }
    };
    
    const runScript = (script: ShowScriptV1) => {
        showScriptEngine.setActiveScript(script);
        sessionService.logEvent('SHOW_SCRIPT_APPLY', { scriptId: script.id });
    };

    return (
        <>
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-36 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,100,0,0.3)] ${isOpen ? 'bg-orange-600 text-white border-orange-500' : 'bg-black/50 text-orange-500 border-orange-500/30'}`}
                title="Automation"
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-robot'}`}></i>
            </button>

            <div className={`fixed top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-orange-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-20 px-4 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6 border-b border-orange-500/30 pb-2">
                    <h2 className="text-xl font-black text-white tracking-wider italic">AUTOMATION</h2>
                    <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
                </div>
                
                {/* SHOW SCRIPTS */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-orange-400 mb-2">SHOW SCRIPTS</h3>
                    <div className="space-y-2">
                        {scripts.length === 0 && <div className="text-[10px] text-gray-600">No scripts generated. Use Vibe Panel {'>'} Audio Intelligence.</div>}
                        {scripts.map(s => (
                            <div key={s.id} className="flex justify-between items-center bg-orange-900/10 p-2 rounded border border-orange-500/20">
                                <div>
                                    <div className="text-xs text-white font-bold">{s.name}</div>
                                    <div className="text-[9px] text-gray-500">{s.events.length} EVENTS • {s.tempo_ref} BPM</div>
                                </div>
                                <button onClick={() => runScript(s)} className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] px-2 py-1 rounded">RUN</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 mb-2">PARAMETRIC LANES</h3>
                    {lanes.length === 0 && <div className="text-xs text-gray-500 text-center py-4">Interact with controls to create lanes.</div>}
                    
                    {lanes.map(lane => (
                        <div key={lane.id} className="bg-gray-900/50 border border-gray-800 rounded p-3">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lane.color }}></div>
                                    <span className="text-xs font-bold text-gray-300">{lane.label}</span>
                                </div>
                                <span className="text-[9px] font-mono text-gray-500">{lane.points.length} PTS</span>
                            </div>
                            
                            <div className="flex gap-1 mb-2">
                                <button onClick={() => setMode(lane.id, 'OFF')} className={`flex-1 py-1 text-[9px] rounded border ${lane.mode === 'OFF' ? 'bg-gray-600 text-white border-gray-500' : 'bg-transparent text-gray-500 border-gray-700'}`}>OFF</button>
                                <button onClick={() => setMode(lane.id, 'READ')} className={`flex-1 py-1 text-[9px] rounded border ${lane.mode === 'READ' ? 'bg-green-600 text-white border-green-500' : 'bg-transparent text-green-700 border-gray-700'}`}>READ</button>
                                <button onClick={() => setMode(lane.id, 'WRITE')} className={`flex-1 py-1 text-[9px] rounded border ${lane.mode === 'WRITE' ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-transparent text-red-700 border-gray-700'}`}>WRITE</button>
                            </div>
                            
                            <button onClick={() => clearLane(lane.id)} className="w-full text-[9px] text-gray-500 hover:text-white hover:bg-red-900/50 py-1 rounded transition">CLEAR DATA</button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-8 p-3 bg-orange-900/10 border border-orange-500/20 rounded text-[9px] text-orange-400 font-mono">
                    <p className="mb-1"><i className="fas fa-info-circle mr-1"></i> INSTRUCTIONS</p>
                    <p>1. Set lane to <span className="text-red-500 font-bold">WRITE</span></p>
                    <p>2. Play audio & move controls</p>
                    <p>3. Set to <span className="text-green-500 font-bold">READ</span> to replay</p>
                </div>
            </div>
        </>
    );
};

export default AutomationPanel;
