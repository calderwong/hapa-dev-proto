import React from 'react';
import { useViewer3DStore } from './viewer3DStore';
import type { ViewMode } from './viewer3DStore';

interface NexusNavigatorProps {
    onNavigateParent?: () => void;
    onNavigateChild?: (index: number) => void;
    onNavigateNext?: () => void;
    onNavigatePrev?: () => void;
    hasParent?: boolean;
    hasChildren?: boolean;
    hasSiblings?: boolean;
    childCount?: number;
}

const VIEW_MODES: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'constellation', icon: '🌌', label: 'Constellation' },
    { mode: 'focus', icon: '📍', label: 'Focus' },
    { mode: 'theatre', icon: '🎬', label: 'Theatre' },
    { mode: 'lineage', icon: '📈', label: 'Lineage' },
    { mode: 'badges', icon: '🏷️', label: 'Badges' },
];

export const NexusNavigator: React.FC<NexusNavigatorProps> = ({
    onNavigateParent,
    onNavigateChild,
    onNavigateNext,
    onNavigatePrev,
    hasParent = false,
    hasChildren = false,
    hasSiblings = false,
    childCount = 0,
}) => {
    const { viewMode, setViewMode, resetView, globalMuted, setGlobalMuted } = useViewer3DStore();
    
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-gray-900/90 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-500/20">
                    <span className="text-cyan-400 text-lg">◉</span>
                    <span className="text-cyan-300 font-mono text-sm font-bold tracking-wider">NEXUS NAVIGATOR</span>
                </div>
                
                {/* Navigation Controls */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {/* Top row - Parent */}
                    <div></div>
                    <button
                        onClick={onNavigateParent}
                        disabled={!hasParent}
                        className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                            hasParent 
                                ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300' 
                                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                        }`}
                        title="Go to Parent"
                    >
                        <span className="text-lg">↑</span>
                        <span className="text-[10px] font-mono">PARENT</span>
                    </button>
                    <div></div>
                    
                    {/* Middle row - Prev, Focus, Next */}
                    <button
                        onClick={onNavigatePrev}
                        disabled={!hasSiblings}
                        className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                            hasSiblings 
                                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' 
                                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                        }`}
                        title="Previous Sibling"
                    >
                        <span className="text-lg">←</span>
                        <span className="text-[10px] font-mono">PREV</span>
                    </button>
                    
                    <button
                        onClick={resetView}
                        className="flex flex-col items-center gap-1 p-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-all"
                        title="Reset View"
                    >
                        <span className="text-lg">◉</span>
                        <span className="text-[10px] font-mono">RESET</span>
                    </button>
                    
                    <button
                        onClick={onNavigateNext}
                        disabled={!hasSiblings}
                        className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                            hasSiblings 
                                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' 
                                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                        }`}
                        title="Next Sibling"
                    >
                        <span className="text-lg">→</span>
                        <span className="text-[10px] font-mono">NEXT</span>
                    </button>
                    
                    {/* Bottom row - Children */}
                    <div></div>
                    <button
                        onClick={() => onNavigateChild?.(0)}
                        disabled={!hasChildren}
                        className={`flex flex-col items-center gap-1 p-2 rounded transition-all ${
                            hasChildren 
                                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' 
                                : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                        }`}
                        title={`Go to Child (${childCount})`}
                    >
                        <span className="text-lg">↓</span>
                        <span className="text-[10px] font-mono">CHILD{childCount > 1 ? `(${childCount})` : ''}</span>
                    </button>
                    <div></div>
                </div>
                
                {/* View Mode Selector */}
                <div className="flex gap-1 p-1 bg-gray-800/50 rounded">
                    {VIEW_MODES.map(({ mode, icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`flex-1 flex flex-col items-center gap-0.5 p-1.5 rounded transition-all ${
                                viewMode === mode
                                    ? 'bg-cyan-500/30 text-cyan-300'
                                    : 'hover:bg-gray-700/50 text-gray-400'
                            }`}
                            title={label}
                        >
                            <span className="text-sm">{icon}</span>
                            <span className="text-[8px] font-mono">{label.slice(0, 4).toUpperCase()}</span>
                        </button>
                    ))}
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-2 mt-3 pt-2 border-t border-cyan-500/20">
                    <button
                        onClick={() => setGlobalMuted(!globalMuted)}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 rounded transition-all ${
                            globalMuted 
                                ? 'bg-gray-700/50 text-gray-400' 
                                : 'bg-green-500/20 text-green-300'
                        }`}
                        title={globalMuted ? 'Unmute' : 'Mute'}
                    >
                        <span>{globalMuted ? '🔇' : '🔊'}</span>
                        <span className="text-[10px] font-mono">{globalMuted ? 'MUTED' : 'SOUND'}</span>
                    </button>
                </div>
            </div>
            
            {/* Keyboard hints */}
            <div className="mt-2 text-center">
                <span className="text-gray-500 text-[10px] font-mono">
                    [1-5] Views • [Space] Play • [R] Reset • [M] Mute
                </span>
            </div>
        </div>
    );
};

export default NexusNavigator;
