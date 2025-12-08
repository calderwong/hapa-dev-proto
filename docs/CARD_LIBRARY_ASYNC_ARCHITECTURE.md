# Card Library Async Architecture Plan

## Problem Statement

The current Card Library loads ALL cards at once and attempts to animate them simultaneously, causing:
- **Memory overload**: 100+ cards in DOM with animations
- **UI crashes**: Too many concurrent CSS animations (box-shadow, filters, transforms)
- **Slow initial load**: Blocking while fetching entire index

## Goals

1. **Progressive Loading**: Fetch cards one-by-one with visual feedback
2. **Animated Reveals**: Each card gets its own "materialization" animation when loaded
3. **Virtual Scrolling**: Only render cards in viewport + buffer
4. **Rarity-Based Animations**: Different reveal effects per card tier
5. **Memory Management**: Cap DOM cards, recycle off-screen cards
6. **Preserve All Animations**: Keep existing hover/click/state animations, just don't run all at once

## Architecture Design

### 1. Card Loading Queue

```typescript
interface CardLoadQueue {
  pending: string[];        // Card IDs waiting to load
  loading: string | null;   // Currently loading card
  loaded: Map<string, CardIndexEntry>;  // Fully loaded cards
  visible: Set<string>;     // Cards currently in viewport
  animating: string | null; // Card currently animating reveal
}
```

### 2. Loading States per Card

```typescript
type CardLoadState = 
  | 'skeleton'      // Placeholder shimmer
  | 'fetching'      // Data being loaded
  | 'revealing'     // Animation playing
  | 'ready'         // Fully loaded and visible
  | 'offscreen';    // Loaded but virtualized out
```

### 3. Reveal Animations by Rarity

| Rarity     | Animation Name        | Effect |
|------------|----------------------|--------|
| Common     | `reveal-fade`        | Simple fade in (200ms) |
| Uncommon   | `reveal-slide-up`    | Slide up + fade (300ms) |
| Rare       | `reveal-scale-pop`   | Scale from 0.5 + bounce (400ms) |
| Epic       | `reveal-glitch`      | Glitch flicker + scale (500ms) |
| Legendary  | `reveal-golden-burst`| Gold particle burst + glow (600ms) |
| Mythic     | `reveal-rainbow-spiral` | Rainbow edge trace + spiral (800ms) |

### 4. Virtual Scroll Strategy

```
┌─────────────────────────────────────┐
│  BUFFER ZONE (recycled placeholders)│  ← 10 cards above viewport
├─────────────────────────────────────┤
│                                     │
│         VISIBLE VIEWPORT            │  ← Actually rendered cards
│         (12-20 cards max)           │
│                                     │
├─────────────────────────────────────┤
│  BUFFER ZONE (skeleton loading)     │  ← 10 cards below viewport
├─────────────────────────────────────┤
│                                     │
│         NOT RENDERED                │  ← Cards exist in index only
│         (virtual height)            │
│                                     │
└─────────────────────────────────────┘
```

### 5. Memory Budget

- **Max rendered cards**: 40 (viewport + buffers)
- **Max concurrent animations**: 1 (reveal) + 3 (hover/click interactions)
- **Recycle threshold**: When scrolling moves cards >2 viewports away

## Implementation Plan

### Phase 1: Card Load Queue Hook
- [ ] Create `useCardLoadQueue` hook
- [ ] Implement progressive fetch (one card at a time)
- [ ] Add loading state management
- [ ] Emit events for animation triggers

### Phase 2: Reveal Animations
- [ ] Create `RevealAnimation` component wrapper
- [ ] Implement 6 rarity-based reveal animations
- [ ] Queue animations so only one plays at a time
- [ ] Add completion callbacks to trigger next card

### Phase 3: Virtual Scroll Integration
- [ ] Calculate visible range based on scroll position
- [ ] Render skeleton placeholders outside visible range
- [ ] Implement card recycling for off-screen cards
- [ ] Add scroll listener with debounce

### Phase 4: Memory Optimization
- [ ] Implement card DOM recycling
- [ ] Add image lazy loading with blur-up
- [ ] Monitor memory usage
- [ ] Add debug overlay for performance metrics

## Key Files to Modify/Create

```
src/
├── hooks/
│   ├── useCardLoadQueue.ts      # NEW: Progressive loading logic
│   ├── useVirtualScroll.ts      # NEW: Virtual scroll calculations
│   └── useAnime.ts              # UPDATE: Add reveal animations
├── components/
│   └── cards/
│       ├── CardReveal.tsx       # NEW: Animated card wrapper
│       ├── CardSkeleton.tsx     # NEW: Placeholder component
│       └── VirtualCardGrid.tsx  # NEW: Virtual scroll container
└── pages/
    └── CardLibrary.tsx          # UPDATE: Use new architecture
```

## Animation Queue Contract

```typescript
// Only one card animates reveal at a time
const animationQueue = {
  current: null as string | null,
  queue: [] as string[],
  
  enqueue(cardId: string, rarity: string) {
    this.queue.push({ cardId, rarity });
    this.processNext();
  },
  
  processNext() {
    if (this.current || this.queue.length === 0) return;
    const next = this.queue.shift();
    this.current = next.cardId;
    playRevealAnimation(next.cardId, next.rarity, () => {
      this.current = null;
      this.processNext();
    });
  }
};
```

## Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Initial load | 3-5s (crashes) | <500ms to first card |
| Cards in DOM | 100+ | Max 40 |
| Concurrent animations | 100+ | Max 4 |
| Memory usage | ~500MB | <150MB |
| FPS during scroll | <10 | 60 |

## Rollback Plan

Keep the old loading code behind a feature flag:
```typescript
const USE_ASYNC_LOADING = true; // Toggle if issues arise
```

## Notes

- Each card reveal animation should be SHORT (200-800ms max)
- Stagger between card reveals: 50-100ms
- User scrolling should pause new reveals until scroll stops
- Clicking a skeleton should prioritize loading that card
- Filter/search changes should reset the queue and re-fetch

---

*Created: Dec 7, 2025*
*Status: PLANNING*
