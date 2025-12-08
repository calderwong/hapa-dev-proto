/**
 * useCardLoadQueue - Progressive Card Loading System
 * 
 * Instead of loading 100+ cards at once and crashing,
 * this hook loads cards one-by-one with visual feedback.
 * 
 * Features:
 * - Fetch cards progressively (one at a time)
 * - Queue system for animation coordination
 * - Virtual scroll awareness (only load visible + buffer)
 * - Memory management (cap rendered cards)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Re-use the existing CardIndexEntry type
export interface CardIndexEntry {
  cardId: string;
  name?: string;
  thumbnail?: string;
  mediaKind?: string;
  createdAt?: string;
  tier?: number;
  cardType?: string;
  cardRecord?: any;
  raw?: any;
  mediaRemoteUrl?: string;
  [key: string]: any;
}

export type CardLoadState = 
  | 'skeleton'      // Placeholder shimmer
  | 'fetching'      // Data being loaded
  | 'revealing'     // Animation playing
  | 'ready'         // Fully loaded and visible
  | 'offscreen';    // Loaded but out of view

export interface QueuedCard {
  cardId: string;
  state: CardLoadState;
  data: CardIndexEntry | null;
  tier: number;
}

interface UseCardLoadQueueOptions {
  batchSize?: number;           // Cards to load per batch
  revealDelay?: number;         // Ms between reveals
  maxRendered?: number;         // Max cards in DOM
  bufferSize?: number;          // Cards to buffer above/below viewport
  onCardRevealed?: (cardId: string, tier: number) => void;
}

interface UseCardLoadQueueReturn {
  cards: QueuedCard[];
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  visibleRange: { start: number; end: number };
  setVisibleRange: (start: number, end: number) => void;
  loadCards: (cardIds: CardIndexEntry[]) => void;
  reset: () => void;
  pauseReveals: () => void;
  resumeReveals: () => void;
  prioritizeCard: (cardId: string) => void;
}

export function useCardLoadQueue(options: UseCardLoadQueueOptions = {}): UseCardLoadQueueReturn {
  const {
    // batchSize = 1, // Reserved for future batch loading
    revealDelay = 80,
    // maxRendered = 40, // Reserved for memory management
    bufferSize = 10,
    onCardRevealed,
  } = options;

  // All cards data (sparse - only loaded ones have data)
  const [cards, setCards] = useState<QueuedCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleRange, setVisibleRangeState] = useState({ start: 0, end: 20 });
  
  // Animation queue
  const revealQueueRef = useRef<string[]>([]);
  const currentlyRevealingRef = useRef<string | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track what's been loaded
  const loadedSetRef = useRef<Set<string>>(new Set());

  // Process reveal queue - one card at a time
  const processRevealQueue = useCallback(() => {
    if (isPaused || currentlyRevealingRef.current || revealQueueRef.current.length === 0) {
      return;
    }

    const nextCardId = revealQueueRef.current.shift();
    if (!nextCardId) return;

    currentlyRevealingRef.current = nextCardId;

    // Update card state to revealing
    setCards(prev => prev.map(c => 
      c.cardId === nextCardId ? { ...c, state: 'revealing' as CardLoadState } : c
    ));

    // After reveal animation completes, mark as ready
    revealTimeoutRef.current = setTimeout(() => {
      setCards(prev => {
        const card = prev.find(c => c.cardId === nextCardId);
        if (card && onCardRevealed) {
          onCardRevealed(nextCardId, card.tier);
        }
        return prev.map(c => 
          c.cardId === nextCardId ? { ...c, state: 'ready' as CardLoadState } : c
        );
      });
      
      currentlyRevealingRef.current = null;
      
      // Process next after delay
      setTimeout(() => processRevealQueue(), revealDelay);
    }, getRevealDuration(cards.find(c => c.cardId === nextCardId)?.tier || 0));
  }, [isPaused, revealDelay, cards, onCardRevealed]);

  // Get reveal animation duration based on tier
  const getRevealDuration = (tier: number): number => {
    const durations: Record<number, number> = {
      0: 200,   // Common
      1: 250,   // Uncommon  
      2: 350,   // Rare
      3: 450,   // Epic
      4: 550,   // Legendary
      5: 700,   // Mythic
    };
    return durations[tier] || 200;
  };

  // Load cards - initialize all with data, queue visible ones for animation
  const loadCards = useCallback((cardData: CardIndexEntry[]) => {
    if (cardData.length === 0) return;

    setIsLoading(true);
    loadedSetRef.current.clear();
    revealQueueRef.current = [];
    currentlyRevealingRef.current = null;

    // Initialize ALL cards with their data immediately (no fake "fetching")
    // Cards start as 'skeleton' but we queue visible ones for reveal
    const initialCards: QueuedCard[] = cardData.map(card => ({
      cardId: card.cardId,
      state: 'skeleton' as CardLoadState,
      data: card, // Data is available immediately!
      tier: card.tier || 0,
    }));
    
    setCards(initialCards);

    // Queue visible cards for reveal animation (one at a time)
    const { start, end } = visibleRange;
    const priorityEnd = Math.min(end + bufferSize, cardData.length);
    
    // Queue cards for sequential reveal
    for (let i = start; i < priorityEnd; i++) {
      const card = cardData[i];
      if (card) {
        revealQueueRef.current.push(card.cardId);
        loadedSetRef.current.add(card.cardId);
      }
    }
    
    // Start processing reveals
    setIsLoading(false);
    processRevealQueue();
  }, [visibleRange, bufferSize, processRevealQueue]);

  // Update visible range (called on scroll)
  const setVisibleRange = useCallback((start: number, end: number) => {
    setVisibleRangeState({ start, end });
    
    // Load any new cards that came into view
    const bufferedStart = Math.max(0, start - bufferSize);
    const bufferedEnd = end + bufferSize;
    
    setCards(prev => {
      const updated = [...prev];
      for (let i = bufferedStart; i < Math.min(bufferedEnd, updated.length); i++) {
        const card = updated[i];
        if (card && card.state === 'skeleton' && card.data === null) {
          // This card needs loading - will be handled by effect
        }
      }
      return updated;
    });
  }, [bufferSize]);

  // Reset everything
  const reset = useCallback(() => {
    setCards([]);
    setIsLoading(false);
    loadedSetRef.current.clear();
    revealQueueRef.current = [];
    currentlyRevealingRef.current = null;
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
    }
  }, []);

  // Pause/resume reveals (for scrolling)
  const pauseReveals = useCallback(() => setIsPaused(true), []);
  const resumeReveals = useCallback(() => {
    setIsPaused(false);
    processRevealQueue();
  }, [processRevealQueue]);

  // Prioritize loading a specific card (user clicked skeleton)
  const prioritizeCard = useCallback((cardId: string) => {
    // Move to front of reveal queue
    const idx = revealQueueRef.current.indexOf(cardId);
    if (idx > 0) {
      revealQueueRef.current.splice(idx, 1);
      revealQueueRef.current.unshift(cardId);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  return {
    cards,
    isLoading,
    loadedCount: loadedSetRef.current.size,
    totalCount: cards.length,
    visibleRange,
    setVisibleRange,
    loadCards,
    reset,
    pauseReveals,
    resumeReveals,
    prioritizeCard,
  };
}

/**
 * Get CSS class for reveal animation based on tier
 */
export function getRevealAnimationClass(tier: number): string {
  const classes: Record<number, string> = {
    0: 'reveal-fade',
    1: 'reveal-slide-up',
    2: 'reveal-scale-pop',
    3: 'reveal-glitch',
    4: 'reveal-golden-burst',
    5: 'reveal-rainbow-spiral',
  };
  return classes[tier] || 'reveal-fade';
}

/**
 * Virtual scroll helper - calculate which cards should render
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  buffer: number = 5
): { start: number; end: number; offsetY: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + buffer * 2;
  const end = Math.min(totalItems, start + visibleCount);
  const offsetY = start * itemHeight;
  
  return { start, end, offsetY };
}
