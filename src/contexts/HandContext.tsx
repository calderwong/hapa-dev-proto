/**
 * Hand Context
 * 
 * Global state management for "The Hand" - a persistent collection of cards
 * that follows the user across the UI.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// Card state types for visual indicators
export type CardState = 'idle' | 'thor' | 'leo' | 'conviction' | 'run' | 'processing';

// Simplified card type for the hand (we don't need all CardIndexEntry fields)
export interface HandCard {
  cardId: string;
  name?: string;
  thumbnail?: string;
  mediaKind?: string;
  createdAt?: string;
  tier?: number;
  state?: CardState;  // Visual state indicator
}

interface HandContextType {
  cards: HandCard[];
  isCollapsed: boolean;
  maxCapacity: number;
  
  // Actions
  addCard: (card: HandCard) => boolean;  // Returns false if at capacity
  removeCard: (cardId: string) => void;
  clearHand: () => void;
  toggleCollapse: () => void;
  hasCard: (cardId: string) => boolean;
  reorderCards: (fromIndex: number, toIndex: number) => void;
  
  // State management (scaffolding for Thor/Leo/Conviction/Run integration)
  setCardState: (cardId: string, state: CardState) => void;
  getCardState: (cardId: string) => CardState;
}

const HAND_STORAGE_KEY = 'hapa-card-hand';
const HAND_COLLAPSED_KEY = 'hapa-card-hand-collapsed';
const DEFAULT_MAX_CAPACITY = 7;

const HandContext = createContext<HandContextType | null>(null);

export const useHand = (): HandContextType => {
  const context = useContext(HandContext);
  if (!context) {
    throw new Error('useHand must be used within a HandProvider');
  }
  return context;
};

interface HandProviderProps {
  children: ReactNode;
  maxCapacity?: number;
}

export const HandProvider: React.FC<HandProviderProps> = ({ 
  children, 
  maxCapacity = DEFAULT_MAX_CAPACITY 
}) => {
  // Initialize from localStorage
  const [cards, setCards] = useState<HandCard[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(HAND_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(HAND_COLLAPSED_KEY) === 'true';
  });

  // Persist cards to localStorage
  useEffect(() => {
    localStorage.setItem(HAND_STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(HAND_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const addCard = useCallback((card: HandCard): boolean => {
    // Check if already in hand
    if (cards.some(c => c.cardId === card.cardId)) {
      return true; // Already there, consider it a success
    }
    
    // Check capacity
    if (cards.length >= maxCapacity) {
      return false;
    }

    setCards(prev => [...prev, card]);
    return true;
  }, [cards, maxCapacity]);

  const removeCard = useCallback((cardId: string) => {
    setCards(prev => prev.filter(c => c.cardId !== cardId));
  }, []);

  const clearHand = useCallback(() => {
    setCards([]);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const hasCard = useCallback((cardId: string): boolean => {
    return cards.some(c => c.cardId === cardId);
  }, [cards]);

  const reorderCards = useCallback((fromIndex: number, toIndex: number) => {
    setCards(prev => {
      const newCards = [...prev];
      const [removed] = newCards.splice(fromIndex, 1);
      newCards.splice(toIndex, 0, removed);
      return newCards;
    });
  }, []);

  // Set a card's state (for Thor/Leo/Conviction/Run visual indicators)
  const setCardState = useCallback((cardId: string, state: CardState) => {
    setCards(prev => prev.map(c => 
      c.cardId === cardId ? { ...c, state } : c
    ));
  }, []);

  // Get a card's current state
  const getCardState = useCallback((cardId: string): CardState => {
    const card = cards.find(c => c.cardId === cardId);
    return card?.state || 'idle';
  }, [cards]);

  const value: HandContextType = {
    cards,
    isCollapsed,
    maxCapacity,
    addCard,
    removeCard,
    clearHand,
    toggleCollapse,
    hasCard,
    reorderCards,
    setCardState,
    getCardState,
  };

  return (
    <HandContext.Provider value={value}>
      {children}
    </HandContext.Provider>
  );
};

export default HandContext;
