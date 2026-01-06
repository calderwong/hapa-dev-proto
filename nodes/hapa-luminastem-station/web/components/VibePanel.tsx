
import React, { useEffect, useState } from 'react';
import { VibeVector, VibeMarker, AIProposal, AudioFxSettings, AudioStem, AI_VibeLabel } from '../types';
import { audioService } from '../services/audioService';
import { geminiService } from '../services/geminiService';
import { sessionService } from '../services/sessionService';
import { analysisQueueService } from '../services/analysisQueueService';
import { showScriptEngine } from '../services/showScriptEngine';
import { v4 as uuidv4 } from 'uuid';

interface VibePanelProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    stems: AudioStem[];
    mixerValues: any;
    audioSettings: AudioFxSettings;
    onApplyAction: (action: any) => void;
    isPlaying: boolean;
    currentTime: number;
}

const VectorBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="flex flex-col gap-1 mb-2">
        <div className="flex justify-between text-[9px] font-mono text-gray-500">
            <span>{label}</span>
            <span>{(value * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${value*100}%`, backgroundColor: color }}></div>
        </div>
    </div>
);

const VibePanel: React.FC<VibePanelProps> = ({ 
    isOpen, setIsOpen, stems, mixerValues, audioSettings, onApplyAction, isPlaying, currentTime 
}) => {
    const [vector, setVector] = useState<VibeVector | null>(null);
    const [markers, setMarkers] = useState<VibeMarker[]>([]);
    const [note, setNote] = useState("");
    const [proposal, setProposal] = useState<AIProposal | null>(null);
    const [loadingProposal, setLoadingProposal] = useState(false);
    
    // Audio Label State
    const [selectedStemForAnalysis, setSelectedStemForAnalysis] = useState<string>("");
    
    // Queue Status
    const [queueStatus, setQueueStatus] = useState({ pending: 0, running: false, historySize: 0 });

    useEffect(() => {
        if(isOpen) {
            setMarkers([...sessionService.getVibeMarkers()]);
            if (stems.length > 0 && !selectedStemForAnalysis) {
                setSelectedStemForAnalysis(stems[0].id);
            }
            
            // Poll Queue Status
            const interval = setInterval(() => {
                setQueueStatus(analysisQueueService.getQueueStatus());
            }, 500);
            return () => clearInterval(interval);
        }
    }, [isOpen, stems]);

    // Analyze Vibe (Realtime)
    const handleAnalyze = () => {
        const start = currentTime;
        const end = currentTime + 2.0; 
        const v = audioService.analyzeVibe(stems, start, end);
        setVector(v);
        setProposal(null);
    };

    const saveMarker = () => {
        if (!vector) return;
        const marker: VibeMarker = {
            id: uuidv4(),
            timestamp: Date.now(),
            transportTime: currentTime,
            note: note || "User Marker",
            vector,
            scope: 'MOMENT'
        };
        sessionService.addVibeMarker(marker);
        setMarkers([...sessionService.getVibeMarkers()]);
        setNote("");
    };

    const askOracle = async () => {
        if (!vector) return;
        setLoadingProposal(true);
        const context = {
            reverb: audioSettings.reverbAmount,
            delay: audioSettings.delayAmount,
            mixer: mixerValues
        };
        const prop = await geminiService.analyzeVibeVector(vector, context);
        setProposal(prop);
        setLoadingProposal(false);
    };
    
    const requestLabelJob = () => {
        const stem = stems.find(s => s.id === selectedStemForAnalysis);
        if (!stem) return;
        
        analysisQueueService.enqueueWithBuffer('GEMINI_AUDIO_LABEL', {
            scope: 'stem',
            assetHashes: [stem.hash],
            stemId: stem.id
        }, stem.buffer);
    };
    
    const requestDSPJob = () => {
        const stem = stems.find(s => s.id === selectedStemForAnalysis);
        if (!stem) return;
        
        analysisQueueService.enqueueWithBuffer('DSP_FINGERPRINT', {
            scope: 'stem',
            assetHashes: [stem.hash],
            stemId: stem.id
        }, stem.buffer);
    };
    
    const getLabel = () => {
        const stem = stems.find(s => s.id === selectedStemForAnalysis);
        if (!stem) return null;
        return sessionService.getVibeLabel(stem.hash);
    };
    
    const label = getLabel();

    const generateScriptFromLabel = async () => {
        if (!label) return;
        const script = await geminiService.generateShowScript(
            [...label.moods, label.energy_curve], 
            30
        );
        sessionService.addShowScript(script);
        showScriptEngine.setActiveScript(script);
        sessionService.logEvent('SHOW_SCRIPT_APPLY', { scriptId: script.id });
        alert(`Script "${script.name}" generated & activated!`);
    };

    const handleProposal = (accept: boolean) => {
        if (!proposal) return;
        sessionService.logEvent('AI_PROPOSAL_DECISION', { 
            proposalId: proposal.id, 
            accepted: accept,
            actions: accept ? proposal.actions : []
        }, 'USER');

        if (accept) {
            proposal.actions.forEach(action => onApplyAction(action));
            setProposal({ ...proposal, status: 'ACCEPTED' });
        } else {
            setProposal({ ...proposal, status: 'REJECTED' });
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-52 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,0,100,0.3)] ${isOpen ? 'bg-pink-600 text-white border-pink-500' : 'bg-black/50 text-pink-500 border-pink-500/30'}`}
                title="Vibe Vector"
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-fingerprint'}`}></i>
            </button>

            <div className={`fixed top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-pink-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-20 px-4 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6 border-b border-pink-500/30 pb-2">
                    <h2 className="text-xl font-black text-white tracking-wider italic">VIBE VECTOR</h2>
                    <div className="text-[10px] font-mono text-gray-500">v1.3</div>
                </div>
                
                {/* --- ANALYSIS QUEUE STATUS --- */}
                <div className="mb-4 bg-gray-900 border border-gray-800 rounded p-2 flex justify-between items-center text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${queueStatus.running ? 'bg-yellow-500 animate-pulse' : 'bg-green-800'}`}></div>
                        <span className="text-gray-400">QUEUE: {queueStatus.pending}</span>
                    </div>
                    <span className="text-gray-500">HISTORY: {queueStatus.historySize}</span>
                </div>
                
                {/* --- AUDIO LABELING --- */}
                <div className="mb-6 p-4 rounded bg-indigo-900/10 border border-indigo-500/30">
                    <h3 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-2">
                        <i className="fas fa-headphones"></i> AUDIO INTELLIGENCE
                    </h3>
                    
                    <select 
                        className="w-full bg-black border border-gray-700 text-xs text-white p-1 mb-2 rounded"
                        value={selectedStemForAnalysis}
                        onChange={(e) => setSelectedStemForAnalysis(e.target.value)}
                    >
                        {stems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <div className="flex gap-2">
                        <button 
                            onClick={requestDSPJob}
                            disabled={stems.length === 0}
                            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] font-bold rounded border border-gray-600"
                        >
                            RUN DSP
                        </button>
                        <button 
                            onClick={requestLabelJob}
                            disabled={stems.length === 0}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold rounded flex items-center justify-center gap-2"
                        >
                            GET GEMINI LABEL
                        </button>
                    </div>
                    
                    {label && (
                        <div className="mt-3 text-[10px] bg-black/50 p-2 rounded border border-indigo-500/20 animate-in fade-in">
                            <div className="font-bold text-white mb-1">"{label.text_summary}"</div>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {label.moods.map(m => <span key={m} className="px-1 bg-pink-900/50 text-pink-300 rounded">{m}</span>)}
                                <span className="px-1 bg-blue-900/50 text-blue-300 rounded">{label.energy_curve}</span>
                            </div>
                            <button onClick={generateScriptFromLabel} className="w-full mt-2 py-1 border border-indigo-500 text-indigo-400 hover:bg-indigo-900/50 rounded">
                                GENERATE SHOW SCRIPT
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-gray-900/50 rounded border border-gray-800 p-4 mb-4 text-center">
                    {!vector ? (
                        <div className="flex flex-col items-center gap-2 py-4">
                            <i className="fas fa-wave-square text-2xl text-gray-700"></i>
                            <button onClick={handleAnalyze} disabled={stems.length === 0} className="mt-2 px-4 py-2 bg-pink-900/30 hover:bg-pink-500 text-pink-300 hover:text-white border border-pink-500/30 rounded text-xs font-bold transition">
                                SCAN CURRENT VIBE
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="text-4xl mb-2 filter drop-shadow-[0_0_10px_rgba(255,0,255,0.5)]">{vector.sigil}</div>
                            <div className="text-[9px] font-mono text-gray-500 mb-4 break-all">{vector.base64}</div>
                            
                            <div className="grid grid-cols-2 gap-4 text-left mb-4">
                                <div>
                                    <VectorBar label="BASS" value={vector.bass} color="#ff0055" />
                                    <VectorBar label="MID" value={vector.mid} color="#00ff88" />
                                    <VectorBar label="HIGH" value={vector.high} color="#00ccff" />
                                </div>
                                <div>
                                    <VectorBar label="DYN" value={vector.dynamics} color="#ffffff" />
                                    <VectorBar label="BRT" value={vector.brightness} color="#ffff00" />
                                    <VectorBar label="FLUX" value={vector.flux} color="#bd00ff" />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={note} 
                                    onChange={e => setNote(e.target.value)} 
                                    placeholder="Name this vibe..."
                                    className="flex-1 bg-black text-xs text-white border border-gray-700 rounded px-2 outline-none" 
                                />
                                <button onClick={saveMarker} className="bg-gray-800 text-white text-xs px-3 rounded border border-gray-600 hover:bg-pink-600 hover:border-pink-500"><i className="fas fa-save"></i></button>
                            </div>
                            
                            <button 
                                onClick={handleAnalyze} 
                                className="w-full text-[10px] text-gray-500 hover:text-white border border-transparent hover:border-gray-700 rounded py-1"
                            >
                                RESCAN
                            </button>
                        </div>
                    )}
                </div>

                {/* ORACLE */}
                {vector && (
                    <div className="mb-6">
                         <button 
                            onClick={askOracle} 
                            disabled={loadingProposal}
                            className={`w-full py-2 rounded text-xs font-bold border flex items-center justify-center gap-2 transition ${loadingProposal ? 'bg-purple-900/50 border-purple-500 text-purple-300 animate-pulse' : 'bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/50 text-white hover:border-purple-400'}`}
                        >
                            <i className="fas fa-sparkles"></i> {loadingProposal ? 'CONSULTING AI...' : 'ASK ORACLE FOR SUGGESTIONS'}
                        </button>

                        {proposal && (
                            <div className={`mt-3 border p-3 rounded bg-black relative overflow-hidden ${proposal.status === 'ACCEPTED' ? 'border-green-500/50' : proposal.status === 'REJECTED' ? 'border-red-500/50' : 'border-purple-500'}`}>
                                <div className="text-sm font-bold text-white mb-1 flex justify-between">
                                    <span>{(proposal.vibeName || 'ANALYSIS').toUpperCase()}</span>
                                    {proposal.status !== 'PENDING' && <span className={`text-[9px] px-2 rounded ${proposal.status === 'ACCEPTED' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{proposal.status}</span>}
                                </div>
                                <p className="text-[10px] text-gray-400 italic mb-3">"{proposal.reasoning}"</p>
                                
                                <div className="space-y-1 mb-3">
                                    {proposal.actions.map((act, i) => (
                                        <div key={i} className="text-[10px] font-mono text-purple-300">
                                            <i className="fas fa-arrow-right mr-2"></i>
                                            {act.type && act.type.replace ? act.type.replace('SET_', '') : 'ACTION'} {act.target ? `(${act.target})` : ''} ➔ {act.value?.toFixed(2)}
                                        </div>
                                    ))}
                                </div>
                                
                                {proposal.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleProposal(true)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-1 rounded">ACCEPT</button>
                                        <button onClick={() => handleProposal(false)} className="flex-1 bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-white text-[10px] font-bold py-1 rounded">REJECT</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* MARKER LIST */}
                <div className="space-y-2">
                    <h3 className="text-xs font-bold text-pink-400 mb-2">SAVED VIBES</h3>
                    {markers.length === 0 && <div className="text-[10px] text-gray-600 italic">No vibe markers yet.</div>}
                    {markers.map(m => (
                        <div key={m.id} className="flex items-center gap-3 bg-gray-900/30 p-2 rounded border border-gray-800 hover:border-pink-500/30 transition">
                            <div className="text-lg">{m.vector.sigil}</div>
                            <div className="overflow-hidden">
                                <div className="text-xs text-white truncate w-32">{m.note}</div>
                                <div className="text-[9px] text-gray-500 font-mono">{(m.transportTime).toFixed(2)}s</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default VibePanel;
