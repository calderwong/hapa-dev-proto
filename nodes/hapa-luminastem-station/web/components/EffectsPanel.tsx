
import React, { useEffect, useState } from 'react';
import { effectsService } from '../services/effectsService';
import { EffectsDeckState, EffectInstance, EffectDefinition } from '../types';
import { EFFECTS_REGISTRY } from '../effects/registry';

interface EffectsPanelProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ isOpen, setIsOpen }) => {
    const [state, setState] = useState<EffectsDeckState>(effectsService.getState());

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setState({ ...effectsService.getState() });
        }, 500);
        return () => clearInterval(interval);
    }, [isOpen]);

    const toggle = (id: string, enabled: boolean) => effectsService.setEnabled(id, enabled);
    const update = (id: string, param: string, val: any) => effectsService.updateParam(id, param, val);

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed top-36 left-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,255,0,0.3)] ${isOpen ? 'bg-yellow-600 text-black border-yellow-500' : 'bg-black/50 text-yellow-500 border-yellow-500/30'}`}
                title="Effects Deck"
            >
                <i className={`fas ${isOpen ? 'fa-times' : 'fa-magic'}`}></i>
            </button>

            <div className={`fixed top-0 left-0 h-full w-80 bg-black/95 backdrop-blur-xl border-r border-yellow-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-20 px-4 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6 border-b border-yellow-500/30 pb-2">
                    <h2 className="text-xl font-black text-white tracking-wider italic">FX DECK</h2>
                    <div className="text-[10px] font-mono text-gray-500">v1.0</div>
                </div>

                <div className="space-y-6">
                    {state.instances.map(inst => {
                        const def = EFFECTS_REGISTRY[inst.effectId];
                        if (!def) return null;

                        return (
                            <div key={inst.instanceId} className={`border rounded p-3 transition-all ${inst.enabled ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-gray-800 bg-gray-900/30'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`font-bold text-xs ${inst.enabled ? 'text-white' : 'text-gray-500'}`}>{def.name.toUpperCase()}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={inst.enabled} onChange={(e) => toggle(inst.instanceId, e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                                    </label>
                                </div>

                                {inst.enabled && (
                                    <div className="space-y-2 pl-2 border-l border-yellow-500/20">
                                        {Object.entries(def.params).map(([key, schema]) => (
                                            <div key={key}>
                                                <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                                                    <span>{schema.name}</span>
                                                    <span>{inst.params[key]}</span>
                                                </div>
                                                {schema.type === 'number' && (
                                                    <input 
                                                        type="range" 
                                                        min={schema.min} 
                                                        max={schema.max} 
                                                        step={schema.step || 0.1}
                                                        value={inst.params[key]}
                                                        onChange={(e) => update(inst.instanceId, key, parseFloat(e.target.value))}
                                                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                                    />
                                                )}
                                                {schema.type === 'color' && (
                                                    <input 
                                                        type="color" 
                                                        value={inst.params[key]} 
                                                        onChange={(e) => update(inst.instanceId, key, e.target.value)}
                                                        className="w-full h-4 rounded cursor-pointer border-none"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default EffectsPanel;
