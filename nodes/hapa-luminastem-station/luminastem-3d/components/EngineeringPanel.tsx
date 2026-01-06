import React from 'react';
import { VisualSettings, AudioFxSettings } from '../types';

interface EngineeringPanelProps {
    visualSettings: VisualSettings;
    setVisualSettings: React.Dispatch<React.SetStateAction<VisualSettings>>;
    audioSettings: AudioFxSettings;
    setAudioSettings: React.Dispatch<React.SetStateAction<AudioFxSettings>>;
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    onReset: () => void;
}

const Dial = ({ label, value, min, max, onChange, unit = "" }: any) => {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                <span>{label}</span>
                <span>{value.toFixed(1)}{unit}</span>
            </div>
            <input 
                type="range" min={min} max={max} step={(max-min)/50} 
                value={value} 
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-full appearance-none accent-purple-500 cursor-pointer"
            />
        </div>
    );
};

const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center justify-between text-[10px] text-gray-300 font-mono cursor-pointer hover:text-white group bg-gray-900/40 p-2 rounded border border-transparent hover:border-purple-500/30 transition">
        <span>{label}</span>
        <div className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-purple-500' : 'bg-gray-700'}`}>
            <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
        </div>
    </label>
);

const EngineeringPanel: React.FC<EngineeringPanelProps> = ({ 
    visualSettings, setVisualSettings, 
    audioSettings, setAudioSettings,
    isOpen, setIsOpen, onReset 
}) => {

    const updateVis = (key: keyof VisualSettings, val: any) => {
        setVisualSettings(prev => ({ ...prev, [key]: val }));
    };

    const updateAud = (key: keyof AudioFxSettings, val: any) => {
        setAudioSettings(prev => ({ ...prev, [key]: val }));
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-20 left-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(100,0,255,0.3)] ${isOpen ? 'bg-purple-600 text-white border-purple-500' : 'bg-black/50 text-purple-500 border-purple-500/30'}`}
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-cogs'}`}></i>
            </button>

            <div className={`fixed top-0 left-0 h-full w-80 bg-black/95 backdrop-blur-xl border-r border-purple-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-32 px-6 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6 pb-2 border-b border-purple-500/30">
                    <h2 className="text-xl font-black text-white tracking-wider italic">ENGINEERING</h2>
                    <button onClick={onReset} className="text-[10px] text-red-400 hover:text-red-300 border border-red-900 bg-red-900/20 px-2 py-1 rounded">
                        RESET ALL
                    </button>
                </div>

                {/* VISUAL PLAYBOOK */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-eye"></i> VISUAL PLAYBOOK
                    </h3>
                    
                    <div className="space-y-4 bg-purple-900/10 p-4 rounded-lg border border-purple-500/10">
                        <div className="grid grid-cols-2 gap-3">
                            <Toggle label="WIREFRAME" checked={visualSettings.wireframeMode} onChange={(v: boolean) => updateVis('wireframeMode', v)} />
                            <Toggle label="TETHERS" checked={visualSettings.connectionLines} onChange={(v: boolean) => updateVis('connectionLines', v)} />
                        </div>
                        
                        <Dial label="MESH DISTORTION" value={visualSettings.meshDistortion} min={0} max={2} onChange={(v: number) => updateVis('meshDistortion', v)} />
                        <Dial label="ELASTICITY" value={visualSettings.connectionElasticity} min={0.1} max={5} onChange={(v: number) => updateVis('connectionElasticity', v)} />
                        <Dial label="PARTICLE DENSITY" value={visualSettings.particleDensity} min={0} max={3} onChange={(v: number) => updateVis('particleDensity', v)} />
                        <Dial label="CHROMATIC ABERRATION" value={visualSettings.chromaticAberration} min={0} max={10} onChange={(v: number) => updateVis('chromaticAberration', v)} />
                        <Dial label="GRID WARP" value={visualSettings.gridWarp} min={0} max={1} onChange={(v: number) => updateVis('gridWarp', v)} />
                    </div>
                </div>

                {/* AUDIO FX & TIME */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-cyan-400 mb-4 flex items-center gap-2">
                        <i className="fas fa-wave-square"></i> AUDIO PHYSICS
                    </h3>

                    <div className="space-y-5 bg-cyan-900/10 p-4 rounded-lg border border-cyan-500/10">
                        <Dial label="TIME DILATION (SPEED)" value={audioSettings.playbackSpeed} min={0.1} max={2.0} onChange={(v: number) => updateAud('playbackSpeed', v)} unit="x" />
                        
                        <div className="flex flex-col gap-2">
                            <div className="text-[10px] text-gray-400 font-mono">CHRONOSTUTTER</div>
                            <div className="flex gap-2">
                                <button 
                                    onMouseDown={() => updateAud('stutterEnabled', true)} 
                                    onMouseUp={() => updateAud('stutterEnabled', false)}
                                    onMouseLeave={() => updateAud('stutterEnabled', false)}
                                    className={`flex-1 py-4 rounded border font-bold text-xs transition-all ${audioSettings.stutterEnabled ? 'bg-cyan-500 text-black border-cyan-400 scale-95 shadow-[0_0_15px_cyan]' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                                >
                                    HOLD TO FREEZE
                                </button>
                                <select 
                                    className="bg-gray-900 text-white text-xs border border-gray-700 rounded px-2 outline-none"
                                    value={audioSettings.stutterInterval}
                                    onChange={(e) => updateAud('stutterInterval', parseFloat(e.target.value))}
                                >
                                    <option value={0.125}>1/8</option>
                                    <option value={0.25}>1/4</option>
                                    <option value={0.5}>1/2</option>
                                    <option value={1.0}>1 Bar</option>
                                </select>
                            </div>
                        </div>

                        <Dial label="SPACE (REVERB)" value={audioSettings.reverbAmount} min={0} max={1} onChange={(v: number) => updateAud('reverbAmount', v)} />
                        <Dial label="ECHO (DELAY)" value={audioSettings.delayAmount} min={0} max={1} onChange={(v: number) => updateAud('delayAmount', v)} />
                        
                        <div className="border-t border-cyan-500/20 pt-4 mt-2">
                            <Toggle label="FORCE MIX SINGLE STEMS" checked={audioSettings.mixAllStems} onChange={(v: boolean) => updateAud('mixAllStems', v)} />
                            <div className="text-[9px] text-gray-500 mt-1 italic">
                                {audioSettings.mixAllStems ? "EXCLUSIVE MODE: All stems obey mixer weights." : "LEGACY MODE: Unique stems play at 100% volume."}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded border border-white/5 text-[10px] text-gray-500 font-mono">
                    <p>VISUAL TELEMETRY MODULE V2.1</p>
                    <p>MODIFY PARAMETERS TO OBSERVE PHYSICS INTERACTIONS.</p>
                </div>
            </div>
        </>
    );
};

export default EngineeringPanel;