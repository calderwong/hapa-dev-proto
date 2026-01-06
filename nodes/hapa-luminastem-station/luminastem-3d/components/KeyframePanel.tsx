
import React, { useEffect, useState } from 'react';
import { sessionService } from '../services/sessionService';
import { KeyframeMeta } from '../types';

interface KeyframePanelProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    onRestore: (id: string) => void;
    currentTransportTime: number;
}

const KeyframePanel: React.FC<KeyframePanelProps> = ({ isOpen, setIsOpen, onRestore, currentTransportTime }) => {
    const [keyframes, setKeyframes] = useState<KeyframeMeta[]>([]);
    const [filter, setFilter] = useState<'all' | 'manual'>('all');

    const refresh = () => {
        setKeyframes([...sessionService.getKeyframes()]);
    };

    useEffect(() => {
        if (isOpen) {
            refresh();
            const interval = setInterval(refresh, 2000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const formatTime = (ms: number) => {
        const s = ms / 1000;
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const m = Math.floor((s % 1) * 100);
        return `${min}:${sec.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}`;
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm("Delete this keyframe?")) {
            sessionService.deleteKeyframe(id);
            refresh();
        }
    };

    const filteredKeyframes = filter === 'all' ? keyframes : keyframes.filter(k => k.kind !== 'auto');

    return (
        <div className={`fixed bottom-28 left-4 z-40 bg-black/90 border border-yellow-500/30 rounded-xl p-4 w-72 backdrop-blur-md transition-all duration-300 transform origin-bottom-left ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}>
             <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <h3 className="text-xs font-bold text-yellow-500 tracking-widest"><i className="fas fa-camera mr-2"></i>TIMELINE SNAPSHOTS</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
             </div>

             <div className="flex gap-2 mb-3">
                 <button onClick={() => setFilter('all')} className={`flex-1 text-[9px] py-1 rounded border ${filter === 'all' ? 'bg-yellow-900/40 text-yellow-200 border-yellow-500/50' : 'bg-transparent text-gray-500 border-gray-700'}`}>ALL</button>
                 <button onClick={() => setFilter('manual')} className={`flex-1 text-[9px] py-1 rounded border ${filter === 'manual' ? 'bg-yellow-900/40 text-yellow-200 border-yellow-500/50' : 'bg-transparent text-gray-500 border-gray-700'}`}>MANUAL ONLY</button>
             </div>

             <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                 {filteredKeyframes.length === 0 && <div className="text-[10px] text-gray-600 text-center py-4">No snapshots recorded.</div>}
                 
                 {filteredKeyframes.map(kf => {
                     const isPast = kf.t_ms < currentTransportTime * 1000;
                     return (
                         <div 
                            key={kf.id} 
                            onClick={() => onRestore(kf.id)}
                            className="group flex items-center justify-between p-2 rounded bg-gray-900/50 border border-gray-800 hover:border-yellow-500/50 hover:bg-yellow-900/10 cursor-pointer transition"
                         >
                             <div>
                                 <div className="flex items-center gap-2">
                                     <span className={`text-[9px] font-mono font-bold ${isPast ? 'text-gray-500' : 'text-yellow-200'}`}>{formatTime(kf.t_ms)}</span>
                                     <span className={`text-[8px] px-1 rounded ${kf.kind === 'manual' ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-500'}`}>{kf.kind.toUpperCase()}</span>
                                 </div>
                                 <div className="text-[10px] text-gray-300 font-bold truncate w-32">{kf.label}</div>
                             </div>
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button className="text-yellow-500 hover:text-white" title="Restore"><i className="fas fa-history"></i></button>
                                 <button onClick={(e) => handleDelete(kf.id, e)} className="text-red-500 hover:text-red-300" title="Delete"><i className="fas fa-trash"></i></button>
                             </div>
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};

export default KeyframePanel;
