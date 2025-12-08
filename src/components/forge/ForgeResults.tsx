// @ts-nocheck
/**
 * ForgeResults - Displays newly forged cards from Thor's Hamma
 * 
 * Renders the set card prominently with child cards in a grid,
 * includes staggered reveal animations.
 */

import React, { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { useNavigate } from 'react-router-dom';

// Types
interface ForgedSkill {
  name: string;
  description?: string;
  type: 'Active' | 'Passive' | 'Triggered';
}

interface ForgedCard {
  cardId: string;
  name: string;
  subtitle?: string;
  lore: string;
  tier: number;
  thumbnail: string;
  skills?: ForgedSkill[];
  truths?: string[];
  desires?: string;
  synergies?: string[];
  howToUse?: string;
}

interface ForgeResult {
  setCard: ForgedCard;
  childCards: ForgedCard[];
  stats: {
    totalCards: number;
    totalSkills: number;
    totalSynergies: number;
  };
  sourceUrl: string;
}

interface ForgeResultsProps {
  result: ForgeResult;
  onForgeAnother: () => void;
}

// Tier styling
const TIER_CONFIG = [
  { label: 'COMMON', color: 'text-gray-400', border: 'border-gray-500/50', glow: '' },
  { label: 'UNCOMMON', color: 'text-green-400', border: 'border-green-500/50', glow: 'shadow-green-500/20' },
  { label: 'RARE', color: 'text-blue-400', border: 'border-blue-500/50', glow: 'shadow-blue-500/20' },
  { label: 'EPIC', color: 'text-purple-400', border: 'border-purple-500/50', glow: 'shadow-purple-500/30' },
  { label: 'LEGENDARY', color: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-amber-500/30' },
  { label: 'MYTHIC', color: 'text-pink-400', border: 'border-pink-500/50', glow: 'shadow-pink-500/30' },
];

// Child card preview component
const ForgedCardPreview: React.FC<{ 
  card: ForgedCard; 
  index: number;
  onSelect: (card: ForgedCard) => void;
}> = ({ card, index, onSelect }) => {
  const tier = TIER_CONFIG[card.tier] || TIER_CONFIG[0];
  const skillCount = card.skills?.length || 0;
  
  return (
    <div 
      className={`
        forged-card group relative
        bg-gray-900/90 rounded-lg overflow-hidden
        border ${tier.border} ${tier.glow}
        cursor-pointer transition-all duration-300
        hover:scale-105 hover:shadow-lg hover:z-10
      `}
      onClick={() => onSelect(card)}
      data-index={index}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] relative overflow-hidden">
        <img 
          src={`file://${card.thumbnail}`}
          alt={card.name}
          className="w-full h-full object-cover"
        />
        {/* Tier badge */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold ${tier.color} bg-black/70 border ${tier.border}`}>
          {tier.label}
        </div>
        {/* Skill count badge */}
        {skillCount > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-[10px] text-cyan-300 font-mono">
            {skillCount} {skillCount === 1 ? 'skill' : 'skills'}
          </div>
        )}
      </div>
      
      {/* Card info */}
      <div className="p-3 space-y-1">
        <h4 className="font-bold text-sm text-white truncate group-hover:text-cyan-300 transition-colors">
          {card.name}
        </h4>
        {card.subtitle && (
          <p className="text-[10px] text-gray-500 truncate">{card.subtitle}</p>
        )}
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
          {card.lore}
        </p>
      </div>
    </div>
  );
};

// Main component
const ForgeResults: React.FC<ForgeResultsProps> = ({ result, onForgeAnother }) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<ForgedCard | null>(null);
  const [showIframe, setShowIframe] = useState(false);
  
  const { setCard, childCards, stats, sourceUrl } = result;
  const setTier = TIER_CONFIG[setCard.tier] || TIER_CONFIG[0];

  // Animate cards on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Animate set card
    const setCardEl = containerRef.current.querySelector('.set-card');
    if (setCardEl) {
      animate(setCardEl, {
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 400,
        easing: 'outQuad',
      });
    }

    // Animate child cards with stagger
    const childCardEls = containerRef.current.querySelectorAll('.forged-card');
    if (childCardEls.length > 0) {
      animate(childCardEls, {
        opacity: [0, 1],
        translateY: [30, 0],
        delay: stagger(80, { start: 300 }),
        duration: 400,
        easing: 'outQuad',
      });
    }
  }, []);

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <rux-icon icon="auto-awesome" size="small" className="text-white"></rux-icon>
          </div>
          <div>
            <h2 className="text-lg font-bold text-cyan-400 tracking-wide">FORGE COMPLETE</h2>
            <p className="text-xs text-cyan-600/70">
              {stats.totalCards} cards · {stats.totalSkills} skills · {stats.totalSynergies} synergies
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowIframe(!showIframe)}
          className="
            px-3 py-1.5 rounded-lg text-xs font-mono
            bg-gray-800 hover:bg-gray-700
            border border-cyan-500/30 hover:border-cyan-500/50
            text-cyan-400 hover:text-cyan-300
            transition-all duration-200
            flex items-center gap-2
          "
        >
          <rux-icon icon={showIframe ? 'visibility-off' : 'visibility'} size="extra-small"></rux-icon>
          {showIframe ? 'Hide Source' : 'View Source'}
        </button>
      </div>

      {/* Source URL Iframe (collapsible) */}
      {showIframe && (
        <div className="source-iframe bg-gray-900/80 rounded-xl overflow-hidden border border-cyan-500/30">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500/70"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/70"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/70"></span>
              </div>
              <span className="text-xs text-cyan-500 font-mono ml-2 truncate max-w-md">{sourceUrl}</span>
            </div>
            <a 
              href={sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
            >
              Open in Browser ↗
            </a>
          </div>
          <div className="relative h-[400px]">
            <iframe
              src={sourceUrl}
              className="w-full h-full bg-white"
              title="Source Preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
            {/* Overlay for iframe interaction hint */}
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-[10px] text-gray-400 pointer-events-none">
              Scroll to interact
            </div>
          </div>
        </div>
      )}

      {/* Set Card (Prominent) */}
      <div className={`
        set-card
        relative bg-gray-900/80 rounded-xl overflow-hidden
        border-2 ${setTier.border}
        shadow-lg ${setTier.glow}
      `}>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
        
        <div className="relative p-6 flex gap-6">
          {/* Set thumbnail */}
          <div className="w-32 h-40 rounded-lg overflow-hidden border border-gray-700/50 flex-shrink-0">
            <img 
              src={`file://${setCard.thumbnail}`}
              alt={setCard.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Set info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏛️</span>
              <div>
                <h3 className="text-xl font-bold text-white">{setCard.name}</h3>
                {setCard.subtitle && (
                  <p className="text-sm text-gray-400">{setCard.subtitle}</p>
                )}
              </div>
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${setTier.color} bg-black/50 border ${setTier.border}`}>
                {setTier.label} SET
              </span>
            </div>
            
            <p className="text-gray-300 text-sm leading-relaxed">
              {setCard.lore}
            </p>
            
            {setCard.desires && (
              <p className="text-purple-400/80 text-sm italic">
                "{setCard.desires}"
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-800">
              <span>{childCards.length} cards</span>
              <span>·</span>
              <span>{stats.totalSkills} skills</span>
              <span>·</span>
              <span>{stats.totalSynergies} synergies</span>
            </div>
          </div>
        </div>
      </div>

      {/* Child Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {childCards.map((card, i) => (
          <ForgedCardPreview 
            key={card.cardId} 
            card={card} 
            index={i}
            onSelect={setSelectedCard}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <button
          onClick={() => navigate('/cards')}
          className="
            px-6 py-3 rounded-lg
            bg-gray-800 hover:bg-gray-700
            border border-gray-600 hover:border-gray-500
            text-gray-300 hover:text-white
            font-mono text-sm uppercase tracking-wider
            transition-all duration-200
          "
        >
          View in Library
        </button>
        <button
          onClick={onForgeAnother}
          className="
            px-6 py-3 rounded-lg
            bg-cyan-600 hover:bg-cyan-500
            text-black font-bold
            font-mono text-sm uppercase tracking-wider
            shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]
            transition-all duration-200
          "
        >
          Forge Another
        </button>
      </div>

      {/* Selected Card Inspector (simple modal) */}
      {selectedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)}
        >
          <div 
            className="bg-gray-900 rounded-xl border border-cyan-500/40 p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-cyan-400">{selectedCard.name}</h3>
              <button 
                onClick={() => setSelectedCard(null)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400"
              >
                ✕
              </button>
            </div>
            
            {selectedCard.subtitle && (
              <p className="text-sm text-gray-500 mb-3">{selectedCard.subtitle}</p>
            )}
            
            <p className="text-gray-300 mb-4">{selectedCard.lore}</p>
            
            {/* Skills */}
            {selectedCard.skills && selectedCard.skills.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-cyan-500 uppercase tracking-widest mb-2">Skills</h4>
                <div className="space-y-2">
                  {selectedCard.skills.map((skill, i) => (
                    <div key={i} className="bg-gray-800/50 rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{skill.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                          {skill.type}
                        </span>
                      </div>
                      {skill.description && (
                        <p className="text-xs text-gray-400 mt-1">{skill.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Desires */}
            {selectedCard.desires && (
              <div className="mb-4">
                <h4 className="text-xs text-purple-400 uppercase tracking-widest mb-2">Desires</h4>
                <p className="text-sm text-gray-400 italic">"{selectedCard.desires}"</p>
              </div>
            )}
            
            {/* Truths */}
            {selectedCard.truths && selectedCard.truths.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs text-emerald-400 uppercase tracking-widest mb-2">Truths</h4>
                <ul className="space-y-1">
                  {selectedCard.truths.map((truth, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                      {truth}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* How to Use */}
            {selectedCard.howToUse && (
              <div className="mb-4">
                <h4 className="text-xs text-amber-400 uppercase tracking-widest mb-2">How To Use</h4>
                <p className="text-sm text-gray-300">{selectedCard.howToUse}</p>
              </div>
            )}
            
            {/* Synergies */}
            {selectedCard.synergies && selectedCard.synergies.length > 0 && (
              <div>
                <h4 className="text-xs text-pink-400 uppercase tracking-widest mb-2">Synergies</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.synergies.map((syn, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-pink-500/10 border border-pink-500/30 text-pink-300">
                      {syn}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForgeResults;
