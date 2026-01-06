
import React, { useState, useEffect } from 'react';

interface LoopPackWizardProps {
    filename: string;
    files: string[];
    onConfirm: (config: { mode: 'separate' | 'combined', assignments: { [file: string]: number } }) => void;
    onCancel: () => void;
}

const LoopPackWizard: React.FC<LoopPackWizardProps> = ({ filename, files, onConfirm, onCancel }) => {
    const [mode, setMode] = useState<'separate' | 'combined'>('separate');
    const [assignments, setAssignments] = useState<{ [file: string]: number }>({});

    useEffect(() => {
        const init: any = {};
        files.slice(0, 3).forEach((f, i) => init[f] = i);
        setAssignments(init);
    }, [files]);

    const toggleAssignment = (file: string, deck: number) => {
        const next = { ...assignments };
        if (next[file] === deck) delete next[file];
        else next[file] = deck;
        setAssignments(next);
    };

    const handleConfirm = () => {
        onConfirm({ mode, assignments });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-blue-500/50 rounded-lg p-6 w-full max-w-lg shadow-[0_0_30px_rgba(0,100,255,0.2)]">
                <h3 className="text-lg font-bold text-white mb-1">IMPORT LOOP PACK</h3>
                <p className="text-xs text-blue-400 font-mono mb-4">{filename}</p>

                <div className="flex gap-4 mb-6">
                    <label className={`flex-1 cursor-pointer p-3 rounded border transition ${mode === 'separate' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        <input type="radio" name="mode" className="hidden" checked={mode === 'separate'} onChange={() => setMode('separate')} />
                        <div className="font-bold text-xs mb-1">SEPARATE LOOPS</div>
                        <div className="text-[9px] opacity-70">Import each file as its own independent loop.</div>
                    </label>
                    <label className={`flex-1 cursor-pointer p-3 rounded border transition ${mode === 'combined' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        <input type="radio" name="mode" className="hidden" checked={mode === 'combined'} onChange={() => setMode('combined')} />
                        <div className="font-bold text-xs mb-1">COMBINED STEM SET</div>
                        <div className="text-[9px] opacity-70">Combine selected files into one loop across Deck A/B/C.</div>
                    </label>
                </div>

                {mode === 'combined' && (
                    <div className="mb-6 bg-black/30 p-3 rounded border border-white/10 max-h-48 overflow-y-auto">
                        <div className="text-[9px] text-gray-500 font-bold mb-2">ASSIGN STEMS TO DECKS</div>
                        {files.map(f => (
                            <div key={f} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                                <span className="text-xs text-gray-300 truncate w-40" title={f}>{f}</span>
                                <div className="flex gap-1">
                                    {[0, 1, 2].map(deck => (
                                        <button 
                                            key={deck}
                                            onClick={() => toggleAssignment(f, deck)}
                                            className={`w-6 h-6 text-[9px] rounded font-bold transition ${assignments[f] === deck ? (deck===0?'bg-cyan-500 text-black':deck===1?'bg-purple-500 text-white':'bg-green-500 text-black') : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                        >
                                            {deck === 0 ? 'A' : deck === 1 ? 'B' : 'C'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {mode === 'separate' && (
                     <div className="mb-6 bg-black/30 p-3 rounded border border-white/10 max-h-48 overflow-y-auto">
                        <div className="text-[9px] text-gray-500 font-bold mb-2">FILES DETECTED ({files.length})</div>
                         {files.map(f => <div key={f} className="text-xs text-gray-400 py-0.5">{f}</div>)}
                     </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded text-xs text-gray-400 hover:text-white">CANCEL</button>
                    <button onClick={handleConfirm} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg">IMPORT TO LIBRARY</button>
                </div>
            </div>
        </div>
    );
};

export default LoopPackWizard;
