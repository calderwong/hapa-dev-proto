# Anime.js Animation Guide for Hapa Card System

## Overview

This document defines our animation philosophy and implementation patterns using **anime.js v4** for the Card Library, The Hand, and all card-related UI. Our goal is to create a visceral, tactile experience that blends:

- **Futuristic Light Interface** - Neon glows, scanlines, holographic effects
- **Physical Card Game Feel** - Weight, momentum, snap, shuffle
- **RPG/Gacha Energy** - Rarity reveals, legendary effects, loot anticipation
- **Smooth Data Visualization** - Information that flows, pulses, breathes

---

## Core Anime.js V4 Imports

```typescript
import {
  animate,           // Core animation function
  createTimeline,    // Sequenced animation chains
  stagger,           // Cascading delays for arrays
  createDraggable,   // Physics-based drag
  onScroll,          // Scroll-triggered animations
  utils,             // $, get, set, lerp, clamp, etc.
  eases,             // Built-in easing functions
} from 'animejs';
```

---

## Animation Principles

### 1. **Anticipation → Action → Follow-through**
Every significant animation has three phases:
- **Anticipation**: Subtle wind-up (scale down slightly, glow intensifies)
- **Action**: The main movement (card flies, drawer opens)
- **Follow-through**: Overshoot and settle (bounce, wobble, fade)

### 2. **Stagger Everything**
Card grids should never appear all at once. Use `stagger()` with:
- `from: 'center'` for ripple effects
- `from: 'first'` for cascade reveals
- Grid-aware staggering for 2D layouts

### 3. **Spring Physics for Tactile Feel**
Use spring easing for anything the user "touches":
```typescript
ease: 'spring(mass, stiffness, damping, velocity)'
ease: 'spring(1, 80, 10, 0)'  // Snappy card snap
ease: 'spring(1, 40, 8, 0)'   // Soft drawer open
```

### 4. **Neon Glow as Feedback**
Glow intensity communicates state:
- **Idle**: Subtle ambient glow
- **Hover**: Intensified edge glow
- **Active/Selected**: Pulsing core glow
- **Processing**: Scanning/sweeping glow
- **Success**: Flash and fade

### 5. **Z-Depth Through Motion**
Cards exist in 3D space mentally. Communicate depth with:
- Scale changes (closer = larger)
- Shadow intensity changes
- Blur on background elements
- Perspective transforms on drag

---

## Animation Recipes

### Card Grid Load (Staggered Reveal)

```typescript
// Cards fade in with staggered scale
animate('.card-grid-item', {
  opacity: [0, 1],
  scale: [0.8, 1],
  translateY: [20, 0],
  delay: stagger(50, { from: 'center', grid: [cols, rows] }),
  duration: 400,
  ease: 'outExpo',
});
```

### Card Hover (Lift Effect)

```typescript
// Card lifts on hover with glow intensification
animate(cardElement, {
  scale: 1.05,
  translateY: -8,
  boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(34,211,238,0.3)',
  duration: 200,
  ease: 'outQuad',
});
```

### Card Click (Pulse Confirm)

```typescript
// Quick pulse to confirm selection
const tl = createTimeline({ autoplay: true });
tl.add(cardElement, {
  scale: [1, 0.95],
  duration: 80,
  ease: 'inQuad',
})
.add(cardElement, {
  scale: [0.95, 1.02],
  duration: 150,
  ease: 'outBack',
})
.add(cardElement, {
  scale: 1,
  duration: 100,
  ease: 'outQuad',
});
```

### Card to Hand (Arc Flight)

```typescript
// Card flies in arc from library to hand
const tl = createTimeline({ autoplay: true });
const rect = cardElement.getBoundingClientRect();
const handRect = handContainer.getBoundingClientRect();

tl.add(cardElement, {
  translateX: handRect.left - rect.left,
  translateY: handRect.top - rect.top - 50, // Arc up first
  scale: 0.6,
  rotate: -15,
  duration: 300,
  ease: 'outQuad',
})
.add(cardElement, {
  translateY: '+=50', // Then down into hand
  rotate: 0,
  duration: 200,
  ease: 'inQuad',
});
```

### Rarity Reveal (Gacha Pull)

```typescript
// Legendary card reveal sequence
const tl = createTimeline({ autoplay: true });

// Phase 1: Suspense buildup
tl.add('.card-reveal-glow', {
  opacity: [0, 1],
  scale: [0.5, 1.5],
  duration: 800,
  ease: 'inExpo',
})
// Phase 2: Flash
.add('.card-reveal-flash', {
  opacity: [0, 1, 0],
  duration: 200,
  ease: 'linear',
})
// Phase 3: Card appears with bounce
.add('.card-reveal-card', {
  opacity: [0, 1],
  scale: [0.3, 1],
  rotate: [10, 0],
  duration: 500,
  ease: 'spring(1, 80, 12, 0)',
})
// Phase 4: Particles burst
.add('.card-reveal-particles', {
  translateY: stagger([-100, -200], { from: 'random' }),
  translateX: stagger([-50, 50], { from: 'random' }),
  opacity: [1, 0],
  scale: [1, 0],
  duration: 1000,
  ease: 'outExpo',
}, '-=400');
```

### Hand Card Reorder (Shuffle)

```typescript
// Cards shift positions with physics
animate('.hand-card', {
  translateX: (el, i) => newPositions[i].x,
  translateY: (el, i) => newPositions[i].y,
  rotate: stagger([-3, 3], { from: 'center' }),
  duration: 300,
  ease: 'spring(1, 100, 15, 0)',
  delay: stagger(30),
});
```

### Processing State (Scanning Effect)

```typescript
// Sweeping scan line on processing card
animate('.card-scan-line', {
  translateY: ['-100%', '100%'],
  opacity: [0, 1, 1, 0],
  duration: 1500,
  loop: true,
  ease: 'linear',
});
```

### Lineage Badge Pulse

```typescript
// Badge pulses when lineage count changes
animate('.lineage-badge', {
  scale: [1, 1.2, 1],
  boxShadow: [
    '0 0 5px currentColor',
    '0 0 20px currentColor',
    '0 0 5px currentColor',
  ],
  duration: 600,
  ease: 'outElastic(1, .5)',
});
```

### Inspector Open (Drawer Slide)

```typescript
// Inspector slides in from right
const tl = createTimeline({ autoplay: true });

tl.add('.inspector-panel', {
  translateX: ['100%', '0%'],
  opacity: [0.5, 1],
  duration: 350,
  ease: 'outExpo',
})
.add('.inspector-content > *', {
  opacity: [0, 1],
  translateY: [10, 0],
  delay: stagger(40),
  duration: 200,
}, '-=200');
```

### Filter/Sort Transition

```typescript
// Cards reorganize with stagger
animate('.card-grid-item', {
  opacity: 0,
  scale: 0.8,
  duration: 150,
  ease: 'inQuad',
  complete: () => {
    // Reorder DOM, then...
    animate('.card-grid-item', {
      opacity: [0, 1],
      scale: [0.8, 1],
      delay: stagger(30, { from: 'first' }),
      duration: 250,
      ease: 'outBack',
    });
  }
});
```

---

## Draggable Cards

```typescript
import { createDraggable } from 'animejs';

const draggable = createDraggable('.hand-card', {
  trigger: '.hand-card',
  container: '.hand-container',
  
  // Snap to grid positions
  x: { snap: 60 },  // Card width + gap
  y: { snap: 0 },   // Lock vertical
  
  // Physics
  releaseMass: 1,
  releaseStiffness: 200,
  releaseDamping: 20,
  releaseEase: 'outElastic(1, .6)',
  
  // Callbacks
  onGrab: (self) => {
    animate(self.target, {
      scale: 1.1,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      zIndex: 100,
      duration: 150,
    });
  },
  onRelease: (self) => {
    animate(self.target, {
      scale: 1,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 1,
      duration: 200,
    });
  },
  onSnap: (self) => {
    // Play snap sound, update state
  },
});
```

---

## Scroll-Based Animations

```typescript
import { onScroll } from 'animejs';

// Cards reveal as you scroll
onScroll({
  target: '.card-grid-item',
  container: '.card-library-scroll',
  enter: 'bottom',
  leave: 'top-=100',
  onEnter: (self) => {
    animate(self.target, {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 400,
      ease: 'outQuad',
    });
  },
});
```

---

## State-Based Color Animations

### Card State Glow System

```typescript
const STATE_ANIMATIONS = {
  idle: {
    borderColor: 'rgba(34, 211, 238, 0.6)',
    boxShadow: '0 0 10px rgba(34, 211, 238, 0.2)',
  },
  thor: {
    borderColor: ['rgba(239, 68, 68, 0.6)', 'rgba(239, 68, 68, 1)'],
    boxShadow: ['0 0 10px rgba(239, 68, 68, 0.3)', '0 0 25px rgba(239, 68, 68, 0.5)'],
    duration: 800,
    loop: true,
    alternate: true,
    ease: 'inOutSine',
  },
  leo: {
    borderColor: 'rgba(96, 165, 250, 0.8)',
    boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)',
    filter: 'hue-rotate(0deg)',
    // Add holographic shimmer
  },
  conviction: {
    borderColor: 'rgba(52, 211, 153, 0.8)',
    boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)',
  },
  run: {
    borderColor: ['rgba(168, 85, 247, 0.6)', 'rgba(168, 85, 247, 1)'],
    boxShadow: ['0 0 10px rgba(168, 85, 247, 0.3)', '0 0 30px rgba(168, 85, 247, 0.6)'],
    duration: 1000,
    loop: true,
    alternate: true,
    ease: 'inOutQuad',
  },
  processing: {
    borderColor: 'rgba(250, 204, 21, 0.8)',
    boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
    // Combine with scan line animation
  },
};

function setCardState(element: HTMLElement, state: CardState) {
  const config = STATE_ANIMATIONS[state];
  animate(element, config);
}
```

---

## Utility Hooks for React

```typescript
// useAnime.ts
import { useRef, useEffect } from 'react';
import { animate, createTimeline } from 'animejs';

export function useCardHover(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onEnter = () => {
      animate(el, {
        scale: 1.05,
        translateY: -8,
        duration: 200,
        ease: 'outQuad',
      });
    };

    const onLeave = () => {
      animate(el, {
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
    };
  }, [ref]);
}

export function useStaggeredReveal(containerRef: RefObject<HTMLElement>, selector: string) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll(selector);
    animate(items, {
      opacity: [0, 1],
      scale: [0.8, 1],
      translateY: [20, 0],
      delay: stagger(40, { from: 'first' }),
      duration: 350,
      ease: 'outExpo',
    });
  }, [containerRef, selector]);
}
```

---

## Animation Zones

### Zone 1: Card Library Grid
| Trigger | Animation |
|---------|-----------|
| Page load | Staggered fade-in from center |
| Filter change | Fade out → reorder → stagger in |
| Card hover | Lift + glow intensify |
| Card click | Pulse + inspector open |
| Drag start | Lift + shadow + ghost trail |
| Drag over zone | Zone highlight pulse |

### Zone 2: The Hand
| Trigger | Animation |
|---------|-----------|
| Card added | Arc flight → snap into place |
| Card removed | Shrink + fade → others slide |
| Hover card | Lift above others |
| State change | Border color transition + pulse |
| Collapse | Cards stack with fan effect |
| Expand | Fan out with spring |

### Zone 3: Inspector Panel
| Trigger | Animation |
|---------|-----------|
| Open | Slide from right + content stagger |
| Close | Slide out + blur |
| Tab switch | Crossfade content |
| Video play | Thumbnail → fullscreen morph |

### Zone 4: Rarity/Quality Indicators
| Trigger | Animation |
|---------|-----------|
| Common | Subtle pulse |
| Rare | Shimmer sweep |
| Epic | Glow burst |
| Legendary | Rainbow edge trace |
| Mythic | Full holographic + particle burst |

---

## Performance Guidelines

1. **Use `will-change`** on animated elements
2. **Prefer `transform` and `opacity`** over layout properties
3. **Cancel animations** when components unmount
4. **Use `autoplay: false`** and trigger manually for controlled sequences
5. **Batch animations** with Timeline instead of multiple `animate()` calls
6. **Use hardware acceleration** via WAAPI for scroll-linked animations

---

## Implementation Priority

### Phase 1: Foundation
1. Create `useAnime.ts` utility hooks
2. Add card hover animations
3. Implement staggered grid reveal

### Phase 2: The Hand
1. Card state glow system
2. Card add/remove animations
3. Collapse/expand animations
4. Drag reorder with snap

### Phase 3: Library Polish
1. Filter/sort transitions
2. Inspector open/close
3. Rarity-based effects

### Phase 4: Gacha/Reveal
1. Card reveal sequences
2. Legendary effects
3. Particle systems

---

## Color Palette Reference

| State | Primary | Glow | Accent |
|-------|---------|------|--------|
| Idle/Cyan | `#22d3ee` | `rgba(34,211,238,0.3)` | `#06b6d4` |
| Thor/Red | `#ef4444` | `rgba(239,68,68,0.4)` | `#dc2626` |
| Leo/Blue | `#60a5fa` | `rgba(96,165,250,0.4)` | `#3b82f6` |
| Conviction/Green | `#34d399` | `rgba(52,211,153,0.4)` | `#10b981` |
| Run/Purple | `#a855f7` | `rgba(168,85,247,0.4)` | `#9333ea` |
| Processing/Yellow | `#facc15` | `rgba(250,204,21,0.4)` | `#eab308` |

---

*Last updated: December 2024*
*Anime.js Version: 4.0.0*
