import React, { useState } from 'react';
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
    cardName?: string;
}

const VIEW_MODES: { mode: ViewMode; icon: string; label: string; key: string }[] = [
    { mode: 'constellation', icon: '◈', label: 'Constellation', key: '1' },
    { mode: 'focus', icon: '◉', label: 'Focus', key: '2' },
    { mode: 'theatre', icon: '▶', label: 'Theatre', key: '3' },
    { mode: 'lineage', icon: '⋔', label: 'Lineage', key: '4' },
    { mode: 'badges', icon: '✦', label: 'Badges', key: '5' },
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
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div 
            className="absolute bottom-4 left-4 z-50"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            {/* Minimal collapsed state */}
            <div className={`bg-gray-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg transition-all duration-300 ${
                expanded ? 'p-3 w-48' : 'p-2 w-auto'
            }`}>
                {/* Always visible: Direction controls */}
                <div className="flex items-center gap-1">
                    {/* Parent */}
                    <button
                        onClick={onNavigateParent}
                        disabled={!hasParent}
                        className={`p-1.5 rounded text-xs transition-all ${
                            hasParent 
                                ? 'text-cyan-400 hover:bg-cyan-500/20' 
                                : 'text-gray-600 cursor-not-allowed'
                        }`}
                        title="Parent [↑]"
                    >▲</button>
                    
                    {/* Prev */}
                    <button
                        onClick={onNavigatePrev}
                        disabled={!hasSiblings}
                        className={`p-1.5 rounded text-xs transition-all ${
                            hasSiblings 
                                ? 'text-purple-400 hover:bg-purple-500/20' 
                                : 'text-gray-600 cursor-not-allowed'
                        }`}
                        title="Previous [←]"
                    >◀</button>
                    
                    {/* Reset/Center */}
                    <button
                        onClick={resetView}
                        className="p-1.5 rounded text-cyan-400 hover:bg-cyan-500/20 transition-all"
                        title="Reset [R]"
                    >⟲</button>
                    
                    {/* Next */}
                    <button
                        onClick={onNavigateNext}
                        disabled={!hasSiblings}
                        className={`p-1.5 rounded text-xs transition-all ${
                            hasSiblings 
                                ? 'text-purple-400 hover:bg-purple-500/20' 
                                : 'text-gray-600 cursor-not-allowed'
                        }`}
                        title="Next [→]"
                    >▶</button>
                    
                    {/* Child */}
                    <button
                        onClick={() => onNavigateChild?.(0)}
                        disabled={!hasChildren}
                        className={`p-1.5 rounded text-xs transition-all ${
                            hasChildren 
                                ? 'text-purple-400 hover:bg-purple-500/20' 
                                : 'text-gray-600 cursor-not-allowed'
                        }`}
                        title={`Children (${childCount}) [↓]`}
                    >▼{childCount > 0 && <span className="text-[8px] ml-0.5">{childCount}</span>}</button>
                    
                    {/* Mute toggle */}
                    <button
                        onClick={() => setGlobalMuted(!globalMuted)}
                        className={`p-1.5 rounded text-xs transition-all ${
                            globalMuted ? 'text-gray-500' : 'text-green-400'
                        }`}
                        title={globalMuted ? 'Unmute [M]' : 'Mute [M]'}
                    >{globalMuted ? '🔇' : '🔊'}</button>
                </div>
                
                {/* Expanded: View modes */}
                {expanded && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                        <div className="flex gap-1 flex-wrap">
                            {VIEW_MODES.map(({ mode, icon, label, key }) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all ${
                                        viewMode === mode
                                            ? 'bg-cyan-500/30 text-cyan-300'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'
                                    }`}
                                    title={`${label} [${key}]`}
                                >
                                    <span>{icon}</span>
                                    <span className="hidden sm:inline">{label.slice(0, 4)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 text-[9px] text-gray-600 font-mono">
                            Arrows: Navigate • R: Reset • M: Mute
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NexusNavigator;
