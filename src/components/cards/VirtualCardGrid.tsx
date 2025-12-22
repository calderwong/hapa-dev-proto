/**
 * VirtualCardGrid - Performance-optimized card grid with progressive loading
 * 
 * Features:
 * - Virtual scrolling (only renders visible cards + buffer)
 * - Progressive loading with queued animations
 * - One card animates at a time (no performance bombs)
 * - Rarity-based reveal animations
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useCardLoadQueue, getRevealAnimationClass } from '../../hooks/useCardLoadQueue';
import type { QueuedCard, CardIndexEntry } from '../../hooks/useCardLoadQueue';
import { DraggableGridCard } from './DraggableGridCard';
import type { PortalColorMode } from '../../contexts/DragCanvasContext';

interface VirtualCardGridProps {
  cards: CardIndexEntry[];
  onCardClick?: (card: CardIndexEntry, event: React.MouseEvent) => void;
  onCardDragStart?: (event: React.DragEvent, card: CardIndexEntry) => void;
  selectedCardId?: string | null;
  renderCard: (card: CardIndexEntry, index: number) => React.ReactNode;
  getPortalColorMode?: (card: CardIndexEntry) => PortalColorMode | undefined;
  className?: string;
  cardHeight?: number;    // Approx card height for virtual scroll calc
  columns?: number;       // Number of columns in grid
  bufferRows?: number;    // Rows to buffer above/below viewport
  bufferScreens?: number; // Buffer by N viewport-heights on each side
  onRequestMore?: () => void;
  isFetchingMore?: boolean;
}

// Skeleton placeholder component
const CardSkeleton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <div 
    className="card-skeleton rounded-lg aspect-[3/4] cursor-pointer"
    onClick={onClick}
  >
    <div className="h-full flex flex-col">
      <div className="flex-1 bg-gray-800/50 rounded-t-lg"></div>
      <div className="p-2 space-y-2">
        <div className="h-2 bg-gray-700/50 rounded w-3/4"></div>
        <div className="h-2 bg-gray-700/50 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

// Card wrapper with reveal animation
// Note: animatedCards set is passed from parent to persist across re-renders
const CardWithReveal: React.FC<{
  queuedCard: QueuedCard;
  card: CardIndexEntry | null;
  children: React.ReactNode;
  onPrioritize?: () => void;
  animatedCards: Set<string>;
}> = ({ queuedCard, card, children, onPrioritize, animatedCards }) => {
  const { state, tier } = queuedCard;
  const cardId = card?.cardId || queuedCard.cardId || '';
  
  // Check if already animated (persisted in parent's Set)
  const wasAnimated = animatedCards.has(cardId);
  
  // Mark as animated when revealing
  if (state === 'revealing' && cardId && !wasAnimated) {
    animatedCards.add(cardId);
  }
  
  // Show skeleton only if NO data at all
  if (!card && !queuedCard.data) {
    return <CardSkeleton onClick={onPrioritize} />;
  }
  
  // If still waiting to be revealed (queued but not processed yet), show skeleton
  if (state === 'skeleton' && !wasAnimated) {
    return <CardSkeleton onClick={onPrioritize} />;
  }
  
  // Determine animation class - only animate if just revealed, not if already animated
  const shouldAnimate = state === 'revealing' && !wasAnimated;
  const animClass = shouldAnimate ? getRevealAnimationClass(tier) : '';
  
  return (
    <div className={animClass}>
      {children}
    </div>
  );
};

export const VirtualCardGrid: React.FC<VirtualCardGridProps> = ({
  cards,
  onCardClick,
  onCardDragStart,
  selectedCardId,
  renderCard,
  getPortalColorMode,
  className = '',
  cardHeight = 280,
  columns = 5,
  bufferRows = 2,
  bufferScreens = 3,
  onRequestMore,
  isFetchingMore = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);
  const requestMoreLockRef = useRef(false);
  const resumeTimeoutRef = useRef<number | null>(null);
  const [measuredColumns, setMeasuredColumns] = useState(columns);
  const effectiveColumns = Math.max(1, measuredColumns || columns || 1);
  
  // Track which cards have been animated (persists across virtual scroll re-renders)
  const animatedCardsRef = useRef<Set<string>>(new Set());
  
  // Progressive loading queue
  const {
    cards: queuedCards,
    isLoading,
    loadedCount,
    totalCount,
    setVisibleRange,
    loadCards,
    pauseReveals,
    resumeReveals,
    prioritizeCard,
  } = useCardLoadQueue({
    revealDelay: 60,
    bufferSize: effectiveColumns * bufferRows,
    onCardRevealed: (cardId, tier) => {
      console.log(`[VirtualGrid] Card revealed: ${cardId} (tier ${tier})`);
    },
  });
  
  // Calculate row height and total height
  const rowHeight = cardHeight + 16; // card height + gap
  const totalRows = Math.ceil(cards.length / effectiveColumns);
  const totalHeight = totalRows * rowHeight;
  
  // Calculate visible range
  const visibleRange = useMemo(() => {
    const bufferPx = Math.max(0, bufferScreens) * containerHeight;
    const bufferByRows = Math.max(0, bufferRows);
    const bufferByScreensRows = Math.ceil(bufferPx / rowHeight);
    const buffer = Math.max(bufferByRows, bufferByScreensRows);

    const startPx = Math.max(0, scrollTop - bufferPx);
    const endPx = scrollTop + containerHeight + bufferPx;

    const startRow = Math.max(0, Math.floor(startPx / rowHeight) - buffer);
    const endRow = Math.min(totalRows, Math.ceil(endPx / rowHeight) + buffer);
    
    return {
      startIndex: startRow * effectiveColumns,
      endIndex: Math.min(cards.length, endRow * effectiveColumns),
      offsetY: startRow * rowHeight,
    };
  }, [scrollTop, containerHeight, rowHeight, bufferRows, bufferScreens, totalRows, cards.length, effectiveColumns]);
  
  // Load cards ONCE when cards first arrive (not on every change)
  const lastLoadedLengthRef = useRef(0);
  useEffect(() => {
    if (cards.length <= 0) return;
    if (cards.length === lastLoadedLengthRef.current) return;

    // When the parent increments the list over time (paged loads), re-sync the queue.
    // This intentionally rehydrates the queue so newly appended cards can reveal.
    lastLoadedLengthRef.current = cards.length;
    loadCards(cards);
  }, [cards.length, loadCards]); // Only depend on length, not cards array reference
  
  // Update visible range when scroll changes
  useEffect(() => {
    setVisibleRange(visibleRange.startIndex, visibleRange.endIndex);
  }, [visibleRange, setVisibleRange]);
  
  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    
    // Pause reveals during scroll, resume after
    pauseReveals();

    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    resumeTimeoutRef.current = window.setTimeout(() => {
      resumeTimeoutRef.current = null;
      resumeReveals();
    }, 150);
  }, [pauseReveals, resumeReveals]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isFetchingMore) return;
    requestMoreLockRef.current = false;
  }, [cards.length, isFetchingMore]);

  useEffect(() => {
    if (!onRequestMore) return;
    if (isFetchingMore) return;
    if (cards.length <= 0) return;

    if (totalHeight <= containerHeight) return;

    const remainingPx = totalHeight - (scrollTop + containerHeight);
    const thresholdPx = containerHeight * 1.5;

    if (remainingPx <= thresholdPx) {
      if (!requestMoreLockRef.current) {
        requestMoreLockRef.current = true;
        onRequestMore();
      }
    } else {
      requestMoreLockRef.current = false;
    }
  }, [cards.length, containerHeight, isFetchingMore, onRequestMore, scrollTop, totalHeight]);
  
  // Measure container on mount/resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);

        const grid = gridRef.current;
        if (grid && typeof window !== 'undefined') {
          const computed = window.getComputedStyle(grid);
          const cols = computed.gridTemplateColumns
            .split(' ')
            .map((c) => c.trim())
            .filter(Boolean).length;
          if (cols > 0) {
            setMeasuredColumns((prev) => (prev === cols ? prev : cols));
          }
        }
      }
    });
    
    observer.observe(container);
    setContainerHeight(container.clientHeight);
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxScrollTop = Math.max(0, totalHeight - containerHeight);
    const actualScrollTop = container.scrollTop;
    const next = Math.max(0, Math.min(actualScrollTop, maxScrollTop));

    if (actualScrollTop !== next) {
      container.scrollTop = next;
    }

    if (scrollTop !== next) {
      setScrollTop(next);
    }
  }, [containerHeight, scrollTop, totalHeight]);
  
  // Get visible cards to render
  const visibleCards = useMemo(() => {
    const visible: Array<{ card: CardIndexEntry; queued: QueuedCard; index: number }> = [];
    
    for (let i = visibleRange.startIndex; i < visibleRange.endIndex; i++) {
      const card = cards[i];
      const queued = queuedCards[i];
      if (card && queued) {
        visible.push({ card, queued, index: i });
      }
    }
    
    return visible;
  }, [visibleRange, cards, queuedCards]);
  
  return (
    <div className={`relative ${className}`}>
      {/* Loading progress indicator */}
      {isLoading && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur rounded-full border border-cyan-500/30">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          <span className="text-xs font-mono text-cyan-400">
            {loadedCount}/{totalCount}
          </span>
        </div>
      )}
      
      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto custom-scrollbar"
        onScroll={handleScroll}
      >
        {/* Virtual spacer for total height */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Positioned grid for visible cards */}
          <div
            className="card-grid absolute left-0 right-0"
            style={{ transform: `translateY(${visibleRange.offsetY}px)` }}
            ref={gridRef}
          >
            {visibleCards.map(({ card, queued, index }) => {
              const RenderPreview: React.FC<{ data: any }> = ({ data }) => (
                <>{renderCard(data as CardIndexEntry, index)}</>
              );

              return (
                <CardWithReveal
                  key={card.cardId}
                  queuedCard={queued}
                  card={queued.data}
                  onPrioritize={() => prioritizeCard(card.cardId)}
                  animatedCards={animatedCardsRef.current}
                >
                  <DraggableGridCard
                    card={card}
                    renderPreview={RenderPreview}
                    onClick={(e) => onCardClick?.(card, e)}
                    draggable={!!onCardDragStart}
                    onDragStart={(e) => onCardDragStart?.(e, card)}
                    portalColorMode={getPortalColorMode?.(card)}
                    className={`
                      group relative bg-gray-900/40 border-2 rounded-lg 
                      cursor-grab active:cursor-grabbing 
                      hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200
                      flex flex-col overflow-hidden
                      ${selectedCardId === card.cardId ? 'card-selected' : ''}
                    `}
                  >
                    {renderCard(card, index)}
                  </DraggableGridCard>
                </CardWithReveal>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualCardGrid;
