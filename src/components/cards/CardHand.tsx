// @ts-nocheck
/**
 * CardHand Component v2 - "The Light Deck"
 * 
 * A sleek, top-right mini-dock with neon state indicators.
 * Minimal footprint, maximum elegance.
 * 
 * Card State Colors:
 *   - Default: Cyan glow (in hand, idle)
 *   - Thor: Red/Orange pulsing (assigned to Thor)
 *   - Leo: Blue holographic (assigned to Leo)  
 *   - Conviction: Green steady (assigned to Conviction)
 *   - Run: Purple pulsing (attached to active run)
 *   - Processing: Yellow scanning (being processed)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useHand } from '../../contexts/HandContext';
import { useDragCanvas } from '../../contexts/DragCanvasContext';
import type { DragItem } from '../../contexts/DragCanvasContext';
import type { HandCard, CardState } from '../../contexts/HandContext';
import { DEFAULT_CARD_POSE } from '../../contexts/DragCanvasContext';
import { 
  animateCardState, 
  animateCardAddToHand, 
  createFlyingCardClone,
  useAnimationCleanup,
  animate
} from '../../hooks/useAnime';
import { AttachedHandCardDetails } from './AttachedHandCardDetails';
import { DraggableHandCard } from './DraggableHandCard';

// State color configurations
const STATE_COLORS: Record<CardState, { border: string; glow: string; pulse: boolean; label: string }> = {
  idle: { border: 'border-cyan-500/60', glow: 'shadow-cyan-500/30', pulse: false, label: 'In Hand' },
  thor: { border: 'border-red-500/80', glow: 'shadow-red-500/50', pulse: true, label: 'With Thor' },
  leo: { border: 'border-blue-400/80', glow: 'shadow-blue-400/50', pulse: false, label: 'With Leo' },
  conviction: { border: 'border-emerald-500/80', glow: 'shadow-emerald-500/50', pulse: false, label: 'Conviction' },
  run: { border: 'border-purple-500/80', glow: 'shadow-purple-500/50', pulse: true, label: 'Active Run' },
  processing: { border: 'border-yellow-500/80', glow: 'shadow-yellow-500/50', pulse: true, label: 'Processing' },
};

interface CardHandProps {
  className?: string;
}

const CardHand: React.FC<CardHandProps> = ({ className = '' }) => {
  const { cards, isCollapsed, maxCapacity, removeCard, clearHand, toggleCollapse, hasCard, addCard } = useHand();
  const { registerSnapZone, unregisterSnapZone, items: overlayItems, spawnItem, removeItem, overlayLayout, setOverlayLayout, poses, setPoses } = useDragCanvas();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [prevCardCount, setPrevCardCount] = useState(cards.length);
  const [selectedCard, setSelectedCard] = useState<HandCard | null>(null);
  const [selectedAnchorRect, setSelectedAnchorRect] = useState<DOMRect | null>(null);
  
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const { track } = useAnimationCleanup();

  useEffect(() => {
    if (isCollapsed) {
      setSelectedCard(null);
      setSelectedAnchorRect(null);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!selectedCard) {
      setSelectedAnchorRect(null);
      return;
    }

    const idx = cards.findIndex((c) => c.cardId === selectedCard.cardId);
    const el = idx >= 0 ? slotRefs.current[idx] : null;
    const rect = el?.getBoundingClientRect() || null;
    setSelectedAnchorRect(rect);
  }, [selectedCard, cards]);

  const isSelectedCardInFormation = !!selectedCard && overlayItems.some((i) => i.id === selectedCard.cardId);

  const selectedPose = selectedCard
    ? {
        ...DEFAULT_CARD_POSE,
        ...(poses[selectedCard.cardId] || {}),
      }
    : DEFAULT_CARD_POSE;

  const setSelectedPose = (next: any) => {
    if (!selectedCard) return;
    setPoses((prev) => {
      const current = { ...DEFAULT_CARD_POSE, ...(prev[selectedCard.cardId] || {}) };
      return {
        ...prev,
        [selectedCard.cardId]: { ...current, ...next },
      };
    });
  };

  const renderOverlayClone = (card: HandCard) => (
    <div className="relative w-12 h-16 rounded-md overflow-hidden border border-cyan-500/30 bg-gray-900/80 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
      {card.thumbnail ? (
        <img src={card.thumbnail} alt={card.name || 'Card'} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
          <div className="w-4 h-4 rounded border border-gray-600 bg-gray-800/50" />
        </div>
      )}
    </div>
  );

  // Register Snap Zones for all 7 slots
  useEffect(() => {
    const handleSnap = (item: DragItem) => {
      if (!item) return;
      if (item.type === 'HAND_CARD') {
        // Returning a hand card overlay back to hand: no-op.
        // The FloatingCard removal restores the original card visibility.
        return;
      }

      if (item.type === 'LIBRARY_CARD') {
        const data: any = item.data;
        if (!data?.cardId) return;
        if (hasCard(data.cardId)) return;

        const handCard: HandCard = {
          cardId: data.cardId,
          name: data.name || data.cardId.substring(0, 8),
          thumbnail: data.thumbnail,
          mediaKind: data.mediaKind,
          createdAt: data.createdAt,
          tier: data.tier,
        };
        addCard(handCard);
      }
    };

    const registerZones = () => {
      const handRect = handContainerRef.current?.getBoundingClientRect();
      if (handRect) {
        registerSnapZone({
          id: 'hand-dock',
          rect: { left: handRect.left, top: handRect.top, width: handRect.width, height: handRect.height },
          threshold: 140,
          onSnap: handleSnap
        });
      }

      if (!isCollapsed) {
        slotRefs.current.forEach((el, index) => {
          if (el) {
            const rect = el.getBoundingClientRect();
            registerSnapZone({
              id: `hand-slot-${index}`,
              rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
              threshold: 80,
              onSnap: handleSnap
            });
          }
        });
      }
    };

    // Delay slightly to ensure layout is stable
    const timer = setTimeout(registerZones, 100);

    window.addEventListener('resize', registerZones);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', registerZones);
      unregisterSnapZone('hand-dock');
      // Unregister all potential slots
      for (let i = 0; i < maxCapacity; i++) {
        unregisterSnapZone(`hand-slot-${i}`);
      }
    };
  }, [isCollapsed, maxCapacity, registerSnapZone, unregisterSnapZone, addCard, hasCard]);

  // Animate new cards when added
  useEffect(() => {
    if (cards.length > prevCardCount) {
      // A new card was added - animate the last one
      const newCard = cards[cards.length - 1];
      const el = cardRefs.current.get(newCard.cardId);
      if (el) {
        track(animateCardAddToHand(el));
      }
    }
    setPrevCardCount(cards.length);
  }, [cards.length, prevCardCount, cards, track]);

  // Animate card state changes
  useEffect(() => {
    cards.forEach(card => {
      const el = cardRefs.current.get(card.cardId);
      const state = card.state || 'idle';
      if (el && state !== 'idle') {
        track(animateCardState(el, state));
      }
    });
  }, [cards, track]);

  // Handle dropping cards into the hand (External Drops from Library)
  // Note: This is primarily for the Library drag which spawns a clone.
  // The FloatingCard snap logic handles the "drag back" case.
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.cardId) {
          const handCard: HandCard = {
            cardId: data.cardId,
            name: data.name || data.cardId.substring(0, 8),
            thumbnail: data.thumbnail,
            mediaKind: data.mediaKind,
            createdAt: data.createdAt,
            tier: data.tier,
          };
          
          const dropX = e.clientX - 30;
          const dropY = e.clientY - 42;
          const handRect = handContainerRef.current?.getBoundingClientRect();
          const targetX = handRect ? handRect.left + handRect.width / 2 - 30 : window.innerWidth - 100;
          const targetY = handRect ? handRect.top + 20 : 80;
          
          createFlyingCardClone(
            data.thumbnail,
            dropX,
            dropY,
            targetX,
            targetY,
            () => addCard(handCard)
          );
        }
      }
    } catch (err) {
      console.warn('[CardHand] Failed to parse dropped card:', err);
    }
  }, [addCard]);

  // Get card state (scaffolding for future integration)
  const getCardState = (card: HandCard): CardState => {
    return (card as any).state || 'idle';
  };

  // Get state styling for a card
  const getStateStyle = (state: CardState) => STATE_COLORS[state] || STATE_COLORS.idle;
  
  // Get CSS class for card state (for animated glow)
  const getStateCssClass = (state: CardState): string => {
    const classMap: Record<CardState, string> = {
      idle: '',
      thor: 'hand-card-state-thor',
      leo: 'hand-card-state-leo',
      conviction: 'hand-card-state-conviction',
      run: 'hand-card-state-run',
      processing: 'hand-card-state-processing',
    };
    return classMap[state] || '';
  };

  // Header-style inline component (collapsed = just icon, expanded = show cards)
  return (
    <div 
      ref={handContainerRef}
      className={`flex items-center gap-2 px-3 py-2 bg-gray-800/80 backdrop-blur-sm rounded-lg border transition-all duration-300 ${isDragOver ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] scale-105 drop-zone-active' : 'border-gray-700/50 hover:border-cyan-500/40'} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hand Icon & Count - Neon Terminal Style */}
      <button
        onClick={toggleCollapse}
        className="group flex items-center gap-2 px-2.5 py-1.5 bg-gray-900 border border-cyan-500/40 hover:border-cyan-400/70 rounded transition-all duration-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
        title={`The Hand (${cards.length}/${maxCapacity}) - Click to ${isCollapsed ? 'expand' : 'collapse'}`}
      >
        {/* Stacked card icon */}
        <div className="relative w-4 h-5">
          <div className="absolute left-0 top-0 w-3 h-4 rounded-[2px] border border-cyan-600/50 bg-gray-800" />
          <div className="absolute left-1 top-1 w-3 h-4 rounded-[2px] border border-cyan-400/60 bg-gray-800 shadow-[0_0_4px_rgba(34,211,238,0.3)]" />
        </div>
        {/* Count */}
        <span className="font-mono text-xs font-bold text-cyan-400">{cards.length}</span>
        <span className="font-mono text-[9px] text-gray-500">/{maxCapacity}</span>
        {/* Expand indicator */}
        <span className={`text-cyan-500/60 text-[10px] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}>▼</span>
      </button>

      {/* Cards Row - Only show when expanded */}
      {!isCollapsed && (
        <div className="flex items-center gap-1.5 pl-2 border-l border-gray-700/50">
          {Array.from({ length: maxCapacity }).map((_, index) => {
             const card = cards[index];
             const isHovered = hoveredIndex === index;
             const state = card ? getCardState(card) : 'idle';
             const stateStyle = getStateStyle(state);

             return (
               <div
                 key={index} // Use index as key for slots
                 ref={el => slotRefs.current[index] = el}
                 className="relative"
                 style={{ width: '48px', height: '64px' }} // Explicit dimensions for empty slots too
               >
                 {card ? (
                    <div
                      ref={(el) => {
                        if (el) cardRefs.current.set(card.cardId, el);
                        else cardRefs.current.delete(card.cardId);
                      }}
                      className="absolute inset-0"
                    >
                      <DraggableHandCard
                        card={card}
                        index={index}
                        state={state}
                        stateStyle={stateStyle}
                        getStateCssClass={getStateCssClass}
                        isHovered={isHovered}
                        setHoveredIndex={setHoveredIndex}
                        setSelectedCard={setSelectedCard}
                      />
                    </div>
                 ) : (
                    // Empty Slot
                    <div className={`
                      w-full h-full rounded-md border border-dashed border-gray-700/50
                      bg-gray-900/30
                      flex items-center justify-center
                      transition-colors duration-200
                      ${isDragOver ? 'border-cyan-500/30 bg-cyan-900/10' : ''}
                    `}>
                      <div className="w-2 h-2 rounded-full bg-gray-800/50" />
                    </div>
                 )}
               </div>
             );
          })}
        </div>
      )}

      {/* Hand Card View - appears when a card is clicked */}
      <AttachedHandCardDetails
        card={selectedCard}
        anchorRect={selectedAnchorRect}
        isInFormation={isSelectedCardInFormation}
        pose={selectedPose}
        setPose={setSelectedPose}
        onClose={() => setSelectedCard(null)}
        onReturnToHand={() => {
          if (!selectedCard) return;
          if (overlayItems.some((i) => i.id === selectedCard.cardId)) removeItem(selectedCard.cardId);
        }}
        onReturnToLibrary={() => {
          if (!selectedCard) return;
          if (overlayItems.some((i) => i.id === selectedCard.cardId)) removeItem(selectedCard.cardId);
          removeCard(selectedCard.cardId);
          setSelectedCard(null);
        }}
        onEnterFormation={() => {
          if (!selectedCard) return;
          if (overlayItems.some((i) => i.id === selectedCard.cardId)) return;

          const idx = cards.findIndex((c) => c.cardId === selectedCard.cardId);
          const slotEl = idx >= 0 ? slotRefs.current[idx] : null;
          const rect = slotEl?.getBoundingClientRect();
          if (!rect) return;

          if (overlayLayout.mode === 'free') {
            setOverlayLayout((v) => ({ ...v, mode: 'fan' }));
          }

          spawnItem({
            id: selectedCard.cardId,
            type: 'HAND_CARD',
            data: selectedCard,
            render: ({ data }) => renderOverlayClone(data),
            initialRect: rect,
            startX: rect.left + rect.width / 2,
            startY: rect.top + rect.height / 2,
          });
        }}
        onLeaveFormation={() => {
          if (!selectedCard) return;
          if (overlayItems.some((i) => i.id === selectedCard.cardId)) removeItem(selectedCard.cardId);
        }}
      />
    </div>
  );
};

export default CardHand;
