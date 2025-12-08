/**
 * Anime.js Animation Hooks for Card System
 * 
 * Using anime.js v4 with correct API patterns.
 * See docs/ANIME_ANIMATION_GUIDE.md for design reference.
 */

import { useRef, useEffect, useCallback, type RefObject } from 'react';
import { animate, stagger, Timeline, JSAnimation, createDraggable } from 'animejs';

// Re-export for convenience
export { animate, stagger, Timeline, createDraggable };

// ============================================
// Stagger Presets
// ============================================

export const staggerPresets = {
  cascade: (delay = 40) => stagger(delay, { from: 'first' }),
  ripple: (delay = 50, grid?: [number, number]) => 
    stagger(delay, { from: 'center', grid }),
  random: (delay = 60) => stagger(delay, { from: 'random' }),
  reverse: (delay = 40) => stagger(delay, { from: 'last' }),
};

// ============================================
// Card State System
// ============================================

export type CardState = 'idle' | 'thor' | 'leo' | 'conviction' | 'run' | 'processing';

interface StateConfig {
  borderColor: string;
  boxShadow: string;
  duration: number;
  loop: boolean;
}

const STATE_CONFIGS: Record<CardState, StateConfig> = {
  idle: {
    borderColor: 'rgba(34, 211, 238, 0.6)',
    boxShadow: '0 0 10px rgba(34, 211, 238, 0.2)',
    duration: 300,
    loop: false,
  },
  thor: {
    borderColor: 'rgba(239, 68, 68, 0.8)',
    boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
    duration: 800,
    loop: true,
  },
  leo: {
    borderColor: 'rgba(96, 165, 250, 0.8)',
    boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)',
    duration: 400,
    loop: false,
  },
  conviction: {
    borderColor: 'rgba(52, 211, 153, 0.8)',
    boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)',
    duration: 400,
    loop: false,
  },
  run: {
    borderColor: 'rgba(168, 85, 247, 0.8)',
    boxShadow: '0 0 25px rgba(168, 85, 247, 0.5)',
    duration: 1000,
    loop: true,
  },
  processing: {
    borderColor: 'rgba(250, 204, 21, 0.8)',
    boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
    duration: 400,
    loop: false,
  },
};

/**
 * Animate card state glow
 */
export function animateCardState(element: HTMLElement | null, state: CardState): JSAnimation | null {
  if (!element) return null;
  
  const config = STATE_CONFIGS[state];
  
  return animate(element, {
    borderColor: config.borderColor,
    boxShadow: config.boxShadow,
    duration: config.duration,
    loop: config.loop,
    alternate: config.loop,
    ease: 'inOutSine',
  });
}

// ============================================
// Card Hover Hook
// ============================================

export function useCardHover(ref: RefObject<HTMLElement | null>) {
  const animationRef = useRef<JSAnimation | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onEnter = () => {
      if (animationRef.current) animationRef.current.pause();
      animationRef.current = animate(el, {
        scale: 1.05,
        translateY: -8,
        duration: 200,
        ease: 'outQuad',
      });
    };

    const onLeave = () => {
      if (animationRef.current) animationRef.current.pause();
      animationRef.current = animate(el, {
        scale: 1,
        translateY: 0,
        duration: 200,
        ease: 'outQuad',
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      if (animationRef.current) animationRef.current.pause();
    };
  }, [ref]);
}

// ============================================
// Staggered Grid Reveal
// ============================================

export function useStaggeredReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  deps: unknown[] = []
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll(selector);
    if (items.length === 0) return;

    const animation = animate(items, {
      opacity: [0, 1],
      scale: [0.85, 1],
      translateY: [20, 0],
      delay: stagger(35, { from: 'first' }),
      duration: 350,
      ease: 'outExpo',
    });

    return () => {
      animation.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, selector, ...deps]);
}

// ============================================
// Card Pulse Animation
// ============================================

export function animateCardPulse(element: HTMLElement | null): Promise<void> {
  if (!element) return Promise.resolve();

  return new Promise((resolve) => {
    const tl = new Timeline({ onComplete: () => resolve() });

    tl.add(element, { scale: 0.95, duration: 80, ease: 'inQuad' })
      .add(element, { scale: 1.02, duration: 150, ease: 'outBack' })
      .add(element, { scale: 1, duration: 100, ease: 'outQuad' });
  });
}

// ============================================
// Card Add to Hand
// ============================================

export function animateCardAddToHand(element: HTMLElement | null): JSAnimation | null {
  if (!element) return null;

  return animate(element, {
    opacity: [0, 1],
    scale: [0.3, 1],
    translateY: [-20, 0],
    duration: 350,
    ease: 'spring(1, 80, 12, 0)',
  });
}

// ============================================
// Card Remove from Hand
// ============================================

export function animateCardRemoveFromHand(
  element: HTMLElement | null,
  onComplete?: () => void
): JSAnimation | null {
  if (!element) return null;

  const anim = animate(element, {
    opacity: [1, 0],
    scale: [1, 0.5],
    translateY: [0, -20],
    duration: 200,
    ease: 'inQuad',
  });
  
  if (onComplete) anim.then(onComplete);
  
  return anim;
}

// ============================================
// Inspector Panel
// ============================================

export function animateInspectorOpen(panel: HTMLElement | null): JSAnimation | null {
  if (!panel) return null;

  return animate(panel, {
    translateX: ['100%', '0%'],
    opacity: [0.5, 1],
    duration: 350,
    ease: 'outExpo',
  });
}

export function animateInspectorClose(
  panel: HTMLElement | null,
  onComplete?: () => void
): JSAnimation | null {
  if (!panel) return null;

  const anim = animate(panel, {
    translateX: ['0%', '100%'],
    opacity: [1, 0.5],
    duration: 250,
    ease: 'inQuad',
  });
  
  if (onComplete) anim.then(onComplete);
  
  return anim;
}

// ============================================
// Rarity Effects
// ============================================

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

const RARITY_GLOWS: Record<CardRarity, { color: string; intensity: number; pulse: boolean }> = {
  common: { color: 'rgba(156, 163, 175, 0.3)', intensity: 5, pulse: false },
  uncommon: { color: 'rgba(34, 197, 94, 0.4)', intensity: 8, pulse: false },
  rare: { color: 'rgba(59, 130, 246, 0.5)', intensity: 12, pulse: true },
  epic: { color: 'rgba(168, 85, 247, 0.6)', intensity: 18, pulse: true },
  legendary: { color: 'rgba(251, 191, 36, 0.7)', intensity: 25, pulse: true },
  mythic: { color: 'rgba(236, 72, 153, 0.8)', intensity: 35, pulse: true },
};

export function animateRarityGlow(element: HTMLElement | null, rarity: CardRarity): JSAnimation | null {
  if (!element) return null;

  const config = RARITY_GLOWS[rarity] || RARITY_GLOWS.common;
  
  return animate(element, {
    boxShadow: `0 0 ${config.intensity}px ${config.color}`,
    duration: config.pulse ? 1200 : 300,
    loop: config.pulse,
    alternate: config.pulse,
    ease: config.pulse ? 'inOutSine' : 'outQuad',
  });
}

// ============================================
// Processing Scan Effect
// ============================================

export function createScanEffect(element: HTMLElement | null): { stop: () => void } | null {
  if (!element) return null;

  const scanLine = document.createElement('div');
  scanLine.className = 'card-scan-line';
  Object.assign(scanLine.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(250, 204, 21, 0.8), transparent)',
    pointerEvents: 'none',
    zIndex: '50',
  });
  
  element.style.position = 'relative';
  element.appendChild(scanLine);

  const animation = animate(scanLine, {
    top: ['0%', '100%'],
    opacity: [0, 1, 1, 0],
    duration: 1500,
    loop: true,
    ease: 'linear',
  });

  return {
    stop: () => {
      animation.pause();
      scanLine.remove();
    },
  };
}

// ============================================
// Animation Cleanup Hook
// ============================================

export function useAnimationCleanup() {
  const animationsRef = useRef<JSAnimation[]>([]);

  const track = useCallback((animation: JSAnimation | null) => {
    if (animation) {
      animationsRef.current.push(animation);
    }
    return animation;
  }, []);

  useEffect(() => {
    return () => {
      animationsRef.current.forEach(anim => anim.pause());
      animationsRef.current = [];
    };
  }, []);

  return { track };
}

// ============================================
// Arc Flight (Card to Hand)
// ============================================

export function animateArcFlight(
  element: HTMLElement | null,
  deltaX: number,
  deltaY: number,
  onComplete?: () => void
): Timeline | null {
  if (!element) return null;

  const tl = new Timeline({ onComplete });

  tl.add(element, {
    translateX: deltaX * 0.6,
    translateY: deltaY - 50,
    scale: 0.7,
    rotate: -10,
    duration: 240,
    ease: 'outQuad',
  })
  .add(element, {
    translateX: deltaX,
    translateY: deltaY,
    scale: 0.5,
    rotate: 0,
    duration: 160,
    ease: 'inQuad',
  });

  return tl;
}

/**
 * Create a flying card clone that arcs from source to target position
 * Used when dragging cards to the hand for a satisfying visual effect
 */
export function createFlyingCardClone(
  thumbnail: string | undefined,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  onComplete?: () => void
): HTMLElement | null {
  // Create a clone element
  const clone = document.createElement('div');
  clone.className = 'flying-card-clone';
  clone.style.cssText = `
    position: fixed;
    left: ${startX}px;
    top: ${startY}px;
    width: 60px;
    height: 84px;
    border-radius: 8px;
    overflow: hidden;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 211, 238, 0.4);
    border: 2px solid rgba(34, 211, 238, 0.6);
    transform-origin: center center;
  `;
  
  if (thumbnail) {
    const img = document.createElement('img');
    img.src = thumbnail;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    clone.appendChild(img);
  } else {
    clone.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  }
  
  document.body.appendChild(clone);
  
  // Calculate deltas
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;
  
  // Create timeline for arc animation
  const tl = new Timeline({
    onComplete: () => {
      clone.remove();
      onComplete?.();
    }
  });
  
  // Phase 1: Launch upward arc
  tl.add(clone, {
    translateX: deltaX * 0.5,
    translateY: deltaY * 0.3 - 80, // Arc upward
    scale: 1.2,
    rotate: -15,
    duration: 200,
    ease: 'outQuad',
  })
  // Phase 2: Descend to target
  .add(clone, {
    translateX: deltaX,
    translateY: deltaY,
    scale: 0.6,
    rotate: 5,
    opacity: 0.8,
    duration: 200,
    ease: 'inQuad',
  })
  // Phase 3: Settle with bounce
  .add(clone, {
    scale: 0.5,
    rotate: 0,
    opacity: 0,
    duration: 100,
    ease: 'outBack',
  });
  
  return clone;
}

/**
 * Animate a card being removed from hand (fly out and fade)
 */
export function animateFlyOut(
  element: HTMLElement | null,
  direction: 'left' | 'right' | 'down' = 'down',
  onComplete?: () => void
): JSAnimation | null {
  if (!element) return null;
  
  const translateConfig = {
    left: { x: -200, y: 50 },
    right: { x: 200, y: 50 },
    down: { x: 0, y: 150 },
  };
  
  const { x, y } = translateConfig[direction];
  
  const anim = animate(element, {
    translateX: x,
    translateY: y,
    scale: 0.3,
    opacity: 0,
    rotate: direction === 'left' ? -30 : direction === 'right' ? 30 : 0,
    duration: 300,
    ease: 'inQuad',
  });
  
  if (onComplete) {
    anim.then(onComplete);
  }
  
  return anim;
}

// ============================================
// Pointer-based Draggable Card System
// Uses pointer events to bypass HTML5 drag ghost
// ============================================

// DEPRECATED: Replaced by useGlobalDrag + DragCanvas system
// Kept as reference or for future use if needed
/*
interface DraggableCardOptions {
  onPickup?: (cardId: string, element: HTMLElement) => void;
  onMove?: (cardId: string, x: number, y: number) => void;
  onDrop?: (cardId: string, element: HTMLElement, dropTarget: HTMLElement | null) => void;
  onDragEnter?: (target: HTMLElement) => void;
  onDragLeave?: (target: HTMLElement) => void;
  dropTargetSelector?: string;
}

export function useDraggableCards(
  options: DraggableCardOptions = {}
) {
  // ... code removed to prevent accidental usage ...
  return { getCardHandlers: () => ({}) };
}
*/
