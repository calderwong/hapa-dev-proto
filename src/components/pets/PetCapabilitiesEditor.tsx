import React, { useState } from 'react';
import type { PetCard, PetCapability } from './types';

interface PetCapabilitiesEditorProps {
    pet: PetCard;
    onSave: (updatedPet: PetCard) => void;
    onClose: () => void;
}

// Base Skills Presets
const BASE_SKILLS: Array<Partial<PetCapability>> = [
    { name: 'Gemini 3 Pro (Smart)', provider: 'vertex', modelId: 'gemini-3-pro-preview', config: { temperature: 0.7 } },
    { name: 'Gemini 2.5 Flash (Fast)', provider: 'vertex', modelId: 'gemini-2.5-flash', config: { temperature: 0.7 } },
    { name: 'Veo 3.1 Fast (Video)', provider: 'vertex', modelId: 'veo-3.1-generate-preview', config: { temperature: 0.7 } }, // Video models don't use temp but kept for schema
    { name: 'Veo 3.1 Quality (Video)', provider: 'vertex', modelId: 'veo-3.1-generate-preview', config: { temperature: 0.7 } },
    { name: 'ChatGPT 5.1 (Bard Class)', provider: 'aimlapi', modelId: 'gpt-4o', config: { temperature: 0.7 } }, // Mapped to gpt-4o for now
];

const ANIMATION_STATES = [
    { key: 'listening', label: "Listening to User's Request" },
    { key: 'requesting', label: "Requesting Inference" },
    { key: 'waiting', label: "Waiting for Inference" },
    { key: 'communicating', label: "Communicating with Phamiliars" },
    { key: 'responding', label: "Request Returned to User" },
];

const PetCapabilitiesEditor: React.FC<PetCapabilitiesEditorProps> = ({ pet, onSave, onClose }) => {
    const [activeTab, setActiveTab] = useState<'skills' | 'animations'>('skills');
    
    // Skills State
    const [capabilities, setCapabilities] = useState<PetCapability[]>(pet.capabilities || []);
    const [activeId, setActiveId] = useState<string | undefined>(pet.activeCapabilityId);
    const [editingCap, setEditingCap] = useState<PetCapability | null>(null);

    // Form State (Skill)
    const [formName, setFormName] = useState('');
    const [formProvider, setFormProvider] = useState<'aimlapi' | 'vertex' | 'openai'>('aimlapi');
    const [formModel, setFormModel] = useState('');
    const [formTemp, setFormTemp] = useState(0.7);
    const [formSystem, setFormSystem] = useState('');
    const [formAppend, setFormAppend] = useState('');

    // Animation State
    const [animStates, setAnimStates] = useState(pet.agentStateAnimations || {});

    // --- Skill Logic ---

    const startEditing = (cap?: PetCapability) => {
        if (cap) {
            setEditingCap(cap);
            setFormName(cap.name);
            setFormProvider(cap.provider as any);
            setFormModel(cap.modelId);
            setFormTemp(cap.config.temperature ?? 0.7);
            setFormSystem(cap.systemPrompt || '');
            setFormAppend(cap.appendPrompt || '');
        } else {
            setEditingCap({ id: 'new', name: '', provider: 'aimlapi', modelId: '', config: {} });
            setFormName('New Skill');
            setFormProvider('aimlapi');
            setFormModel('gpt-4o'); 
            setFormTemp(0.7);
            setFormSystem('');
            setFormAppend('');
        }
    };

    const quickAddSkill = (preset: Partial<PetCapability>) => {
        const newCap: PetCapability = {
            id: `cap-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: preset.name || 'New Skill',
            provider: preset.provider as any || 'aimlapi',
            modelId: preset.modelId || 'gpt-4o',
            config: preset.config || { temperature: 0.7 },
            systemPrompt: '',
            appendPrompt: '',
        };
        const newCaps = [...capabilities, newCap];
        setCapabilities(newCaps);
        if (newCaps.length === 1) setActiveId(newCap.id);
    };

    const saveCapability = () => {
        if (!editingCap) return;

        const newCap: PetCapability = {
            id: editingCap.id === 'new' ? `cap-${Date.now()}` : editingCap.id,
            name: formName,
            provider: formProvider,
            modelId: formModel,
            config: {
                temperature: formTemp,
            },
            systemPrompt: formSystem,
            appendPrompt: formAppend,
        };

        let newCaps;
        if (editingCap.id === 'new') {
            newCaps = [...capabilities, newCap];
        } else {
            newCaps = capabilities.map(c => c.id === newCap.id ? newCap : c);
        }

        setCapabilities(newCaps);
        if (newCaps.length === 1) setActiveId(newCap.id);
        setEditingCap(null);
    };

    const deleteCapability = (id: string) => {
        const newCaps = capabilities.filter(c => c.id !== id);
        setCapabilities(newCaps);
        if (activeId === id) {
            setActiveId(newCaps.length > 0 ? newCaps[0].id : undefined);
        }
    };

    // --- Animation Logic ---

    const updateAnimState = (key: string, value: string) => {
        setAnimStates(prev => ({ ...prev, [key]: value }));
    };

    const handleSavePet = () => {
        const updatedPet: PetCard = {
            ...pet,
            capabilities: capabilities,
            activeCapabilityId: activeId,
            agentStateAnimations: animStates,
        };
        onSave(updatedPet);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header & Tabs */}
                <div className="bg-gray-900/50 border-b border-gray-800">
                    <div className="flex justify-between items-center p-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-purple-400">⚡</span> 
                            Camp Refactor: {pet.name}
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    
                    <div className="flex px-4 gap-4">
                        <button 
                            onClick={() => setActiveTab('skills')}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                                activeTab === 'skills' 
                                ? 'border-purple-500 text-white' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Skills Training
                        </button>
                        <button 
                            onClick={() => setActiveTab('animations')}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                                activeTab === 'animations' 
                                ? 'border-purple-500 text-white' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Animation Lab
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {activeTab === 'skills' ? (
                        <div className="h-full flex">
                            {/* Sidebar: List */}
                            <div className="w-1/3 border-r border-gray-800 p-4 overflow-y-auto bg-gray-900/30">
                                {/* Quick Add */}
                                <div className="mb-6">
                                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">Base Skills (Quick Add)</div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {BASE_SKILLS.map((preset, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => quickAddSkill(preset)}
                                                className="text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-xs text-gray-300 transition-colors flex items-center gap-2"
                                            >
                                                <span className="text-purple-400">+</span> {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">My Capabilities</div>
                                <div className="space-y-2">
                                    {capabilities.map(cap => (
                                        <div 
                                            key={cap.id}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                activeId === cap.id ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                                            }`}
                                            onClick={() => setActiveId(cap.id)}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-bold text-sm text-white">{cap.name}</div>
                                                <div className="text-[10px] bg-gray-900 px-1.5 py-0.5 rounded text-gray-400 uppercase">
                                                    {cap.provider}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{cap.modelId}</div>
                                            
                                            <div className="flex gap-2 mt-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startEditing(cap); }}
                                                    className="text-[10px] text-cyan-400 hover:underline"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); deleteCapability(cap.id); }}
                                                    className="text-[10px] text-red-400 hover:underline"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button 
                                        onClick={() => startEditing()}
                                        className="w-full py-2 border-2 border-dashed border-gray-700 rounded-lg text-gray-500 hover:border-gray-500 hover:text-gray-300 text-xs font-bold transition-colors"
                                    >
                                        + Custom Skill
                                    </button>
                                </div>
                            </div>

                            {/* Main: Editor */}
                            <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
                                {editingCap ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <h3 className="text-lg font-bold text-white mb-4">
                                            {editingCap.id === 'new' ? 'New Capability' : 'Edit Capability'}
                                        </h3>

                                        <div className="space-y-1">
                                            <label className="text-xs uppercase text-gray-500 font-bold">Skill Name</label>
                                            <input 
                                                value={formName}
                                                onChange={e => setFormName(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-purple-500 outline-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase text-gray-500 font-bold">Provider</label>
                                                <select 
                                                    value={formProvider}
                                                    onChange={e => setFormProvider(e.target.value as any)}
                                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-purple-500 outline-none"
                                                >
                                                    <option value="aimlapi">AIMLAPI.com</option>
                                                    <option value="vertex">Vertex AI</option>
                                                    <option value="openai">OpenAI</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs uppercase text-gray-500 font-bold">Model ID</label>
                                                <input 
                                                    value={formModel}
                                                    onChange={e => setFormModel(e.target.value)}
                                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-purple-500 outline-none font-mono text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs uppercase text-gray-500 font-bold flex justify-between">
                                                <span>Temperature</span>
                                                <span className="text-white">{formTemp}</span>
                                            </label>
                                            <input 
                                                type="range" min="0" max="2" step="0.1"
                                                value={formTemp}
                                                onChange={e => setFormTemp(parseFloat(e.target.value))}
                                                className="w-full accent-purple-500"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs uppercase text-gray-500 font-bold">System Prompt (The Soul)</label>
                                            <textarea 
                                                value={formSystem}
                                                onChange={e => setFormSystem(e.target.value)}
                                                className="w-full h-32 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-purple-500 outline-none font-mono text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs uppercase text-gray-500 font-bold">Append Prompt (The Default)</label>
                                            <textarea 
                                                value={formAppend}
                                                onChange={e => setFormAppend(e.target.value)}
                                                className="w-full h-20 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-purple-500 outline-none font-mono text-sm"
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-4">
                                            <button onClick={saveCapability} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold">Save Skill</button>
                                            <button onClick={() => setEditingCap(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center p-8">
                                        <div className="text-6xl mb-4">🎓</div>
                                        <h3 className="text-xl font-bold text-gray-400 mb-2">Welcome to Camp Refactor</h3>
                                        <p className="max-w-md">Assign skills to {pet.name} using the presets on the left or create your own.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full p-8 overflow-y-auto bg-gray-900">
                            <div className="max-w-3xl mx-auto">
                                <h3 className="text-xl font-bold text-white mb-6">Agent State Animations</h3>
                                <p className="text-gray-400 text-sm mb-8">
                                    Define how {pet.name} looks during different stages of the agentic workflow.
                                    Provide a URL or local path to a GIF or image.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {ANIMATION_STATES.map((state) => (
                                        <div key={state.key} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="font-bold text-white text-sm">{state.label}</label>
                                                <div className="text-[10px] text-gray-500 uppercase bg-gray-900 px-2 py-0.5 rounded">{state.key}</div>
                                            </div>
                                            
                                            <div className="flex gap-4">
                                                <div className="w-24 h-24 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border border-gray-700 flex-shrink-0">
                                                    {(animStates as any)[state.key] ? (
                                                        <img 
                                                            src={(animStates as any)[state.key]} 
                                                            alt={state.label} 
                                                            className="w-full h-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="text-gray-700 text-2xl">?</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <input 
                                                        type="text"
                                                        value={(animStates as any)[state.key] || ''}
                                                        onChange={(e) => updateAnimState(state.key, e.target.value)}
                                                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono"
                                                        placeholder="/path/to/anim.gif"
                                                    />
                                                    <div className="text-[10px] text-gray-500">
                                                        Accepts local paths (file://) or URLs.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Close</button>
                    <button onClick={handleSavePet} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow-lg shadow-emerald-900/20">Save Phamiliar</button>
                </div>
            </div>
        </div>
    );
};

export default PetCapabilitiesEditor;
