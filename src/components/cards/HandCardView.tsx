// @ts-nocheck
/**
 * HandCardView - Compact card detail panel for hand cards
 * 
 * Displays key card info in a sleek, terminal-style overlay:
 * - Name & Tier
 * - Thumbnail
 * - Skills, Desires, Truths
 * - Quick actions
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HandCard } from '../../contexts/HandContext';
import { animate } from 'animejs';

interface HandCardViewProps {
  card: HandCard | null;
  onClose: () => void;
  onViewFull?: (card: HandCard) => void;
}

const HandCardView: React.FC<HandCardViewProps> = ({ card, onClose, onViewFull }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalOpen, setPortalOpen] = useState(false);

  // Animate in on mount
  useEffect(() => {
    if (card && panelRef.current) {
      animate(panelRef.current, {
        translateX: [20, 0],
        opacity: [0, 1],
        duration: 250,
        easing: 'outQuad',
      });
    }
  }, [card]);

  if (!card) return null;

  // Get tier info
  const tierLabels = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
  const tierColors = [
    'text-gray-400 border-gray-500/50',
    'text-green-400 border-green-500/50',
    'text-blue-400 border-blue-500/50',
    'text-purple-400 border-purple-500/50',
    'text-amber-400 border-amber-500/50',
    'text-pink-400 border-pink-500/50',
  ];
  const tier = card.tier || 0;
  const tierLabel = tierLabels[tier] || 'COMMON';
  const tierColor = tierColors[tier] || tierColors[0];

  // Extract real data from card or metadata
  const metadata = (card as any).metadata || {};
  const skills = (card as any).skills || metadata.skills || [];
  const desires = (card as any).desires || metadata.desires || 'Awaiting purpose...';
  const truths = (card as any).truths || metadata.truths || [];
  const howToUse = (card as any).howToUse || metadata.howToUse || '';
  const synergies = (card as any).synergies || metadata.synergies || [];
  
  // Check for iframe/portal mode
  const iframeMode = metadata.iframeMode === true;
  const sourceUrl = metadata.url || metadata.sourceUrl || '';
  const hasPortal = iframeMode && sourceUrl;
  
  // Format skills for display - handle both string[] and object[]
  const formattedSkills = skills.map((s: any) => 
    typeof s === 'string' ? s : s.name || 'Unknown Skill'
  );

  const handleClose = () => {
    if (panelRef.current) {
      animate(panelRef.current, {
        translateX: [0, 20],
        opacity: [1, 0],
        duration: 150,
        easing: 'inQuad',
        complete: onClose,
      });
    } else {
      onClose();
    }
  };

  // Use portal to escape parent stacking context
  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-start justify-end pointer-events-none"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" />
      
      {/* Panel */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative m-4 mt-16
          bg-gray-900/95 backdrop-blur-xl
          border border-cyan-500/40 rounded-lg
          shadow-[0_0_40px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]
          overflow-hidden pointer-events-auto
          transition-all duration-300 ease-out
          ${portalOpen 
            ? 'w-[80vw] max-w-5xl max-h-[85vh]' 
            : 'w-80 max-h-[calc(100vh-5rem)]'
          }
        `}
      >
        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        </div>

        {/* Header */}
        <div className="relative px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-900/20 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Terminal prompt icon */}
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse" />
              <h3 className="font-mono text-sm font-bold text-white truncate tracking-wide">
                {card.name || 'UNNAMED CARD'}
              </h3>
            </div>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${tierColor} bg-black/30`}>
              {tierLabel}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {/* Thumbnail + Skills */}
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-700/50 flex-shrink-0 bg-gray-800">
              {card.thumbnail ? (
                <img src={card.thumbnail} alt={card.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded border border-gray-600 bg-gray-700/50" />
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-cyan-500/70 uppercase tracking-widest mb-1.5">
                Skills {formattedSkills.length > 0 && `(${formattedSkills.length})`}
              </div>
              <div className="space-y-1">
                {formattedSkills.length > 0 ? (
                  formattedSkills.map((skill: string, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
                      <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
                      {skill}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 italic">No skills yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Desires */}
          <div>
            <div className="font-mono text-[10px] text-purple-400/70 uppercase tracking-widest mb-1.5">
              Desires
            </div>
            <p className="text-xs text-gray-400 italic leading-relaxed">
              "{desires}"
            </p>
          </div>

          {/* Truths */}
          {truths.length > 0 && (
            <div>
              <div className="font-mono text-[10px] text-emerald-400/70 uppercase tracking-widest mb-1.5">
                Truths
              </div>
              <div className="space-y-1">
                {truths.map((truth: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/60 mt-1.5 flex-shrink-0" />
                    <span>{truth}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How To Use */}
          {howToUse && (
            <div>
              <div className="font-mono text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5">
                How To Use
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {howToUse}
              </p>
            </div>
          )}

          {/* Synergies */}
          {synergies.length > 0 && (
            <div>
              <div className="font-mono text-[10px] text-pink-400/70 uppercase tracking-widest mb-1.5">
                🔗 Synergies
              </div>
              <div className="flex flex-wrap gap-1">
                {synergies.map((syn: string, i: number) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-300">
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Portal/Iframe View (when expanded) */}
          {hasPortal && portalOpen && (
            <div className="mt-4 rounded-lg overflow-hidden border border-purple-500/30">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-800/80 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/70"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/70"></span>
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono truncate max-w-[300px]">{sourceUrl}</span>
                </div>
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-500 hover:text-purple-400 transition-colors"
                >
                  External ↗
                </a>
              </div>
              <div className="relative h-[50vh] bg-white">
                <iframe
                  src={sourceUrl}
                  className="w-full h-full"
                  title="Portal View"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-cyan-500/20 bg-gradient-to-t from-gray-900 to-transparent">
          <div className="flex gap-2">
            {/* Portal Toggle Button (for iframe-capable cards) */}
            {hasPortal && (
              <button
                onClick={() => setPortalOpen(!portalOpen)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-3 py-2
                  rounded text-xs font-mono
                  transition-all duration-200
                  ${portalOpen 
                    ? 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 hover:border-purple-400/70 text-purple-400 hover:text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                    : 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 hover:border-purple-400/60 text-purple-400 hover:text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                  }
                `}
              >
                <span>🌀</span>
                <span>{portalOpen ? 'CLOSE PORTAL' : 'OPEN PORTAL'}</span>
              </button>
            )}
            <button
              onClick={() => onViewFull?.(card)}
              className={`
                ${hasPortal ? '' : 'flex-1'} flex items-center justify-center gap-1.5 px-3 py-2
                bg-cyan-500/10 hover:bg-cyan-500/20
                border border-cyan-500/40 hover:border-cyan-400/60
                rounded text-xs font-mono text-cyan-400 hover:text-cyan-300
                transition-all duration-200
                shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]
              `}
            >
              <span>VIEW FULL</span>
              <span className="text-cyan-500/60">▸</span>
            </button>
            <button
              onClick={handleClose}
              className="
                px-3 py-2
                bg-gray-800/50 hover:bg-gray-700/50
                border border-gray-600/40 hover:border-gray-500/60
                rounded text-xs font-mono text-gray-400 hover:text-gray-300
                transition-all duration-200
              "
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HandCardView;
