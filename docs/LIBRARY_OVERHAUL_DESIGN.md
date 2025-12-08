# Card Library Overhaul - Design Document
> Version 1.0 | Created: 2025-12-07 | Status: IMPLEMENTATION IN PROGRESS

## Executive Summary

Transform the Card Library from a flat chronological list into an immersive, game-like collection management system with:
- **Abstraction Layers**: Smart groupings (Sets, Rarity, Recency, Source)
- **Lineage Badges**: Visual ancestry/descendant tracking per card
- **Card Physics**: Satisfying drag-and-drop with inertia and tilt
- **The Hand**: Persistent card dock for cross-UI card operations

---

## 1. Research Analysis

### 1.1 Card Game Library Patterns Studied

| Game | Key Pattern | Applicable Insight |
|------|-------------|-------------------|
| **MTG Arena** | Collection by set + wildcards | Set-based grouping with "cover card" |
| **Hearthstone** | Class tabs + mana curve display | Filter tabs with visual stats |
| **Slay the Spire** | Draw/Discard/Exhaust piles | Card state stacks |
| **Genshin Impact** | Constellation levels + artifacts | Lineage as "power level" |
| **Pokemon TCG Live** | Binder view + set completion % | Progress tracking per set |
| **Inscryption** | Sacrificial card stacking | Cards with depth/weight |
| **Balatro** | Hand management + joker deck | Persistent "Hand" mechanic |

### 1.2 Key Insights

1. **Stacks > Lists**: Card games show cards in "stacks" with a featured card and count badge
2. **Lineage = Power**: Games use ancestry (evolutions, sacrifices) as power metrics
3. **Physics = Satisfaction**: Card movement with tilt/shadow/snap creates dopamine
4. **Hand = Agency**: Holding cards across screens gives user control/planning

---

## 2. Feature Specifications

### 2.1 Abstraction Layers (View Modes)

```
┌─────────────────────────────────────────────────────────────────────┐
│ VIEW MODES                                                          │
├─────────────────────────────────────────────────────────────────────┤
│ [📚 All Cards] [🎴 By Set] [💎 By Rarity] [🕐 Recent] [🔥 Hot]      │
└─────────────────────────────────────────────────────────────────────┘
```

**A. All Cards (Current Default)**
- Flat grid, sorted by date/name/quality
- Enhanced with lineage badges

**B. By Set (NEW)**
- Cards grouped into visual "deck stacks"
- Each stack shows:
  - Cover Card (first/hero image)
  - Set Name
  - Card Count Badge
  - Rarity Distribution Mini-bar
  - Click to expand/view set contents

**C. By Rarity (NEW)**
- Horizontal lanes per tier (Mythic → Common)
- Cards flow left-to-right in each lane
- Lane headers show count and tier color

**D. Recently Worked (NEW)**
- Cards with recent modifications/children
- Activity indicator (pulse animation)

**E. Hot/Active (NEW)**
- Cards currently in processing pipelines
- Cards with pending operations

### 2.2 Deck Stack Component

```
┌──────────────────────────────┐
│ ╔════════════════════════╗   │  ← Shadow layers (stack depth)
│ ║                        ║   │
│ ║    [COVER CARD IMG]    ║   │
│ ║                        ║   │
│ ╠════════════════════════╣   │
│ ║ THE URIAH INVERSION    ║   │  ← Set Name
│ ╠════════════════════════╣   │
│ ║ 📦 42 Cards            ║   │  ← Count
│ ║ ████░░░░ (Rarity)      ║   │  ← Rarity bar (gold/purple/blue/gray)
│ ╚════════════════════════╝   │
└──────────────────────────────┘
```

**Visual Details:**
- 3-5 shadow cards behind (slight offset, decreasing opacity)
- Hover: cards "fan out" slightly
- Click: expand to show all cards in set
- Drag: entire stack is draggable

### 2.3 Lineage Badges

Every card displays two badges:

```
┌─────────────────────────────────────┐
│ ┌───────┐                   ┌───────┤
│ │ ⬆ 3   │   [CARD IMAGE]   │ ⬇ 12  │
│ └───────┘                   └───────┤
│              Card Name              │
└─────────────────────────────────────┘
```

**⬆ Ancestors Badge (Top-Left)**
- Count of cards in upward lineage to root
- 0 = Root card (wormhole ingestion, original upload)
- Higher = deeper in lineage tree
- Color: Blue → Cyan gradient based on depth
- Tooltip: "3 generations from source"

**⬇ Descendants Badge (Top-Right)**  
- Count of all cards spawned below (recursive)
- 0 = Leaf card (no children yet)
- Higher = more generative/productive card
- Color: Orange → Red gradient based on spawn count
- Tooltip: "12 cards spawned from this"

**Badge Styling (RPG Power Level):**
```css
.lineage-badge {
  /* Hexagonal or diamond shape */
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: linear-gradient(135deg, #1e3a5f, #0d1b2a);
  border: 1px solid rgba(0, 255, 255, 0.5);
  font-family: 'Orbitron', monospace;
  text-shadow: 0 0 10px currentColor;
}
```

**Calculation Logic:**
```typescript
// Ancestors: Walk up parentCardId chain
function countAncestors(cardId: string, cardMap: Map<string, Card>): number {
  let count = 0;
  let current = cardMap.get(cardId);
  while (current?.parentCardId) {
    count++;
    current = cardMap.get(current.parentCardId);
  }
  return count;
}

// Descendants: Recursive count of children
function countDescendants(cardId: string, childrenMap: Map<string, string[]>): number {
  const children = childrenMap.get(cardId) || [];
  return children.reduce((sum, childId) => {
    return sum + 1 + countDescendants(childId, childrenMap);
  }, 0);
}
```

### 2.4 Card Physics Drag System

**Goals:**
- Cards feel like physical objects
- Movement responds to velocity
- Satisfying "snap" when dropped

**Physics Properties:**
```typescript
interface CardDragState {
  isDragging: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;      // Tilt based on horizontal velocity
  scale: number;         // Slightly larger when dragged
  shadowDepth: number;   // Deeper shadow when lifted
}
```

**Behaviors:**
1. **Lift**: Card scales up 1.05x, shadow deepens, slight upward animation
2. **Move**: Card tilts ±15° based on horizontal velocity
3. **Trail**: Subtle motion blur or ghost trail
4. **Drop**: Card snaps to grid with bounce easing
5. **Cancel**: Card floats back to origin with spring physics

**Implementation Approach:**
- Use `framer-motion` for physics animations
- Track mouse velocity for tilt calculation
- CSS transforms for performance

### 2.5 The Hand - Persistent Card Dock

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              MAIN UI CONTENT                               │
│                                                                            │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────── THE HAND ───────────────────────────────────┐│
│ │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐               [+] Drop Zone   [🗑]  ││
│ │  │Card1│  │Card2│  │Card3│  │Card4│                                     ││
│ │  └─────┘  └─────┘  └─────┘  └─────┘                                     ││
│ └─────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Persistent**: Stays visible across all pages (via Layout component)
- **Collapsible**: Click to minimize to just a badge showing count
- **Drag-In**: Drop cards from library to add to hand
- **Drag-Out**: Drag cards from hand to UI elements
- **Fan Display**: Cards overlap slightly, fan out on hover
- **Max Capacity**: 7-10 cards (configurable)
- **Clear All**: Button to empty hand
- **Persist**: Saved to localStorage between sessions

**Card Arrangement:**
```
        ┌───┐
      ┌───┐ │   ← Cards fan out when hovered
    ┌───┐ │ │
  ┌───┐ │ │ │
  │ 1 │ 2 │ 3 │ 4 │
  └───┴───┴───┴───┘
```

**Drop Targets (Future Scaffolding):**
- Chat input: Attach card context to message
- Pipeline: Add card to processing queue
- Wiki: Link card to wiki entry
- Other cards: Create relationship

---

## 3. Implementation Phases

### Phase 1: Lineage Badges (Foundation) ✅ COMPLETE
- [x] Add lineage calculation utilities (`src/utils/cardLineage.ts`)
- [x] Create `LineageBadge` component (`src/components/cards/LineageBadge.tsx`)
- [x] Integrate into card grid (corners layout)
- [x] Add tooltips with lineage explanation

### Phase 2: Card Physics Drag 🔄 PARTIAL
- [ ] Install/configure framer-motion (FUTURE - using CSS for now)
- [x] Add drag-to-hand data in drag events
- [x] Add CSS animations for drag effects
- [ ] Implement full tilt/scale physics (FUTURE)

### Phase 3: The Hand ✅ COMPLETE
- [x] Create `CardHand` global component (`src/components/cards/CardHand.tsx`)
- [x] Create `HandContext` for state management (`src/contexts/HandContext.tsx`)
- [x] Add to Layout component
- [x] Implement drag-in functionality
- [x] Add localStorage persistence
- [x] Create collapse/expand behavior
- [x] Add "In Hand" indicator on cards in grid

### Phase 4: Abstraction Views (FUTURE)
- [ ] Create `DeckStack` component
- [ ] Add view mode tabs to library
- [ ] Implement "By Set" view
- [ ] Implement "By Rarity" lanes
- [ ] Add "Recently Worked" logic

---

## 4. Technical Architecture

### 4.1 New Components

```
src/components/
├── cards/
│   ├── LineageBadge.tsx       # Ancestor/Descendant badge
│   ├── DraggableCard.tsx      # Physics-enabled card wrapper
│   ├── DeckStack.tsx          # Stacked card group display
│   └── CardHand.tsx           # The persistent hand dock
├── library/
│   ├── ViewModeSelector.tsx   # Tab bar for view modes
│   ├── SetGridView.tsx        # Cards grouped by set
│   ├── RarityLanesView.tsx    # Horizontal rarity lanes
│   └── RecentActivityView.tsx # Recently modified cards
```

### 4.2 New Utilities

```
src/utils/
├── cardLineage.ts             # Ancestor/descendant calculations
├── cardPhysics.ts             # Drag physics calculations
└── handStorage.ts             # Hand persistence logic
```

### 4.3 State Management

```typescript
// Global Hand State (Context)
interface HandState {
  cards: CardIndexEntry[];
  isCollapsed: boolean;
  addCard: (card: CardIndexEntry) => void;
  removeCard: (cardId: string) => void;
  clearHand: () => void;
  toggleCollapse: () => void;
}

// Library View State
interface LibraryViewState {
  viewMode: 'all' | 'sets' | 'rarity' | 'recent' | 'hot';
  expandedSetId: string | null;
}
```

### 4.4 Lineage Data Flow

```
Cards Load → Build Lineage Maps → Calculate Counts → Render Badges
     ↓                                                     ↓
  cardMap: Map<id, Card>                              ancestorCount
  parentMap: Map<id, parentId>                        descendantCount
  childrenMap: Map<id, childId[]>
```

---

## 5. Visual Design Specs

### 5.1 Color Palette

| Element | Color | CSS Variable |
|---------|-------|--------------|
| Ancestor Badge BG | Blue gradient | `--lineage-ancestor-bg` |
| Ancestor Badge Text | Cyan | `--lineage-ancestor-text` |
| Descendant Badge BG | Orange gradient | `--lineage-descendant-bg` |
| Descendant Badge Text | Gold | `--lineage-descendant-text` |
| Hand Dock BG | Dark translucent | `rgba(10, 25, 47, 0.95)` |
| Deck Stack Shadow | Multi-layer | `0 2px 4px`, `0 4px 8px`, `0 8px 16px` |

### 5.2 Animations

| Action | Animation | Duration | Easing |
|--------|-----------|----------|--------|
| Card Lift | Scale + Shadow | 200ms | ease-out |
| Card Tilt | Rotate X/Y | Real-time | none |
| Card Drop | Bounce | 400ms | spring(1, 80, 10) |
| Hand Expand | Fan out | 300ms | ease-out |
| Badge Pulse | Glow | 2s loop | ease-in-out |
| Stack Hover | Fan | 200ms | ease-out |

### 5.3 Sound Effects (Future)

- Card pickup: Soft "whoosh"
- Card drop: Satisfying "thunk"
- Add to hand: "Click"
- Stack expand: "Shuffle"

---

## 6. Testing Strategy

### 6.1 Unit Tests
- Lineage calculation accuracy
- Drag physics calculations
- Hand state management

### 6.2 Integration Tests
- Card drag between library and hand
- View mode transitions
- Lineage badge updates on card creation

### 6.3 Visual Tests
- Badge rendering at various counts
- Physics feel at different screen sizes
- Hand behavior with 0-10 cards

---

## 7. Success Metrics

1. **Engagement**: Increased time in Card Library
2. **Usability**: Reduced clicks to find specific cards
3. **Satisfaction**: User feedback on "feel" of cards
4. **Performance**: No frame drops during drag operations

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with 1000+ cards | High | Virtual scrolling, lazy badge calculation |
| Physics causing jank | Medium | GPU-accelerated transforms only |
| Hand state loss | Low | Aggressive localStorage saving |
| Complex lineage trees | Medium | Cache calculations, update incrementally |

---

## 9. Future Enhancements

- **Card Crafting**: Combine cards in hand to create new cards
- **Deck Building**: Save hand as named deck
- **Trading**: P2P card exchange
- **Achievements**: Badges for collection milestones
- **Card Sorting**: Drag-to-reorder in hand
- **Context Drops**: Drop card on chat to inject context

---

*Document Version: 1.0*
*Author: Cascade*
*Review Status: SELF-REVIEWED, READY FOR IMPLEMENTATION*
