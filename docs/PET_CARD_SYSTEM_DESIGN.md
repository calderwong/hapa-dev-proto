# Pet Card System Design Document

## Overview

This document outlines the architecture for evolving the Pet system into a Card-based entity framework. Pets become the first implementation of **Avatar Cards** - persistent, interactive entities that can be positioned across the application, carry state, and eventually serve as visual representations for AI agents.

---

## Design Philosophy

### Core Principles

1. **Cards as Universal Containers**: Everything is a card. Pets, agents, tools, behaviors, and configurations are all cards that can be composed, attached, and referenced.

2. **Location as State**: Where an entity exists in the UI (Header, Sanctuary, Hidden) represents its operational state. This creates an intuitive spatial metaphor for deployment/activation.

3. **Decentralized by Default**: All pet data lives in Hypercore, enabling future P2P pet sharing, trading, and collaborative AI agent networks.

4. **Composability**: Pet Cards can have child cards attached (animations, behaviors, tools, memories) creating a tree structure for complex agent definitions.

5. **Drag-Drop as Primary Interaction**: Moving entities between zones is the primary way to change their state - intuitive and visual.

---

## Data Architecture

### Pet Card Schema

```typescript
interface PetCard {
  // Card Identity
  type: 'pet';
  id: string;                    // Unique identifier
  coreName: string;              // Hypercore name for this pet
  
  // Display
  name: string;
  species: string;               // 'dog', 'cat', 'custom', etc.
  thumbnail?: string;            // Base64 or URL for card display
  
  // Animation Configuration
  animations: {
    idle: AnimationAsset;
    walk: AnimationAsset;
    run?: AnimationAsset;
    lie?: AnimationAsset;
    special?: AnimationAsset[];
  };
  
  // Module System (from Pet Forge)
  modules?: Record<string, ModuleConfig>;
  
  // Behavior Profile
  behavior: {
    speed: number;               // Movement speed (1-10)
    scale: number;               // Size multiplier
    restFrequency: number;       // How often to rest (0-1)
    playfulness: number;         // Activity level (0-1)
    // Future: personality traits for AI agent behavior
  };
  
  // Location State
  location: PetLocation;
  
  // Card Relationships (for agent composition)
  attachedCards?: CardRef[];     // Tools, behaviors, memories attached
  parentCards?: CardRef[];       // Lineage tracking
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface AnimationAsset {
  url: string;                   // Local file:// or remote URL
  cardRef?: CardRef;             // If sourced from a card
  frames?: number;               // Frame count for timing
  duration?: number;             // Animation duration in ms
}

interface PetLocation {
  zone: 'sanctuary' | 'header' | 'hidden';
  position?: { x: number; y: number };  // Last position in zone
  enteredAt: number;             // Timestamp
}

interface CardRef {
  cardId: string;
  coreName: string;
  relation?: string;             // 'animation', 'behavior', 'tool', etc.
}
```

### Card Library Index Entry

```typescript
interface PetCardIndexEntry {
  type: 'card-index';
  cardId: string;
  coreName: string;
  mediaKind: 'pet';              // New mediaKind for filtering
  name: string;
  species: string;
  thumbnail?: string;
  location: PetLocation;
  createdAt: number;
  updatedAt: number;
}
```

---

## UI Components

### 1. Header Pet Area ("Pet Portal")

A dedicated zone in the global header where active pets roam, creating a persistent companion presence.

**Location**: Between logo and system indicators in the header bar.

**Dimensions**: ~200-300px width × full header height (~40px)

**Design**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo]  │    🌿 PET PORTAL 🌿     │  NET:ONLINE  SYS:NOMINAL  [Clock] │
│         │  ┌──────────────────┐   │                                    │
│  HAPA   │  │  🐕 ← pet walks  │   │                                    │
│   AI    │  │  grass/sky bg    │   │                                    │
│         │  └──────────────────┘   │                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Visual Features**:
- Subtle inset border with glow (like a window/portal)
- Parallax background layers (sky, ground, decorations)
- Environment themes (day/night, seasons, custom)
- Pets scaled to fit (~24-32px)
- Drop zone highlight when dragging

**Interaction**:
- Drag pet TO portal → Pet enters "active/deployed" state
- Drag pet FROM portal → Return to sanctuary or hide
- Click pet → Trigger special animation / open pet details
- Right-click → Context menu (settings, remove, details)

### 2. Enhanced Sanctuary

The main pet management area, now with Card-aware features.

**Additions**:
- Pet list sidebar showing all pets as mini-cards
- Drag pets from list into main area
- Visual distinction for pets in different zones
- "Recall All" button to bring all pets to sanctuary

### 3. Pet Mini-Card Component

Reusable card representation for pets appearing in:
- Sanctuary sidebar
- Card Library (filtered by `mediaKind: 'pet'`)
- Media sidebar in Chat
- Any card picker/browser

**Design**:
```
┌─────────────────────┐
│ ┌─────┐             │
│ │ 🐕  │  Hapa Dog   │
│ │ gif │  ──────────  │
│ └─────┘  📍 Header  │
└─────────────────────┘
```

---

## State Management

### Global Pet State

```typescript
interface GlobalPetState {
  // All registered pets
  pets: Map<string, PetCard>;
  
  // Pets by location for quick access
  headerPets: string[];          // Pet IDs in header
  sanctuaryPets: string[];       // Pet IDs in sanctuary
  
  // Active controller instances
  headerController: PetController | null;
  sanctuaryController: PetController | null;
  
  // Environment settings
  headerEnvironment: EnvironmentTheme;
}

interface EnvironmentTheme {
  id: string;
  name: string;
  background: string;            // CSS gradient or image
  groundColor: string;
  ambientParticles?: boolean;    // Floating leaves, stars, etc.
}
```

### Location Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                        PET STATES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    drag to header    ┌─────────┐             │
│   │SANCTUARY│ ──────────────────▶  │ HEADER  │             │
│   │  (idle) │ ◀──────────────────  │(active) │             │
│   └─────────┘    drag to sanct     └─────────┘             │
│        │                                 │                  │
│        │ hide                      hide  │                  │
│        ▼                                 ▼                  │
│   ┌─────────────────────────────────────────┐              │
│   │              HIDDEN                      │              │
│   │   (stored but not rendered anywhere)     │              │
│   └─────────────────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Drag-Drop Architecture

### MIME Types

```typescript
const PET_CARD_MIME = 'application/x-pet-card';
const CARD_MIME = 'application/x-message-card';  // Existing
```

### Drag Data

```typescript
interface PetDragData {
  type: 'pet-card';
  petId: string;
  coreName: string;
  sourceZone: 'sanctuary' | 'header' | 'library' | 'sidebar';
  petData: PetCard;
}
```

### Drop Zones

| Zone | Accepts | Action |
|------|---------|--------|
| Header Portal | Pet cards | Move pet to header, start roaming |
| Sanctuary | Pet cards | Move pet to sanctuary |
| Chat Input | Pet cards | Attach as context (future: invoke agent) |
| Trash/Remove | Pet cards | Hide pet (soft delete) |

---

## Implementation Plan

### Phase 1: Pet Card Foundation
1. Create `PetCard` type definition
2. Update pet creation to save as proper Card
3. Add `mediaKind: 'pet'` to card library entries
4. Load existing pets on app start

### Phase 2: Header Pet Portal
1. Create `PetPortal` component
2. Add to Layout header
3. Implement mini pet rendering (scaled down)
4. Add environment background system
5. Create dedicated `HeaderPetController`

### Phase 3: Drag-Drop Integration
1. Make pets draggable from Sanctuary
2. Implement drop zone in Header Portal
3. Add drag-from-header capability
4. Persist location changes to Hypercore
5. Add visual feedback during drag

### Phase 4: Card Library Integration
1. Show pets in Card Library with `mediaKind: 'pet'` filter
2. Enable drag from Card Library to Portal/Sanctuary
3. Add pet-specific card actions (edit, duplicate, delete)

### Phase 5: Polish & Future-Proofing
1. Environment theme selector
2. Pet card detail panel
3. Attached cards UI (show tools/behaviors)
4. Export/import pet cards

---

## Component Structure

```
src/
├── components/
│   ├── pets/
│   │   ├── Pet.tsx              # Existing - pet renderer
│   │   ├── PetController.ts     # Existing - behavior logic
│   │   ├── PetPortal.tsx        # NEW - header pet area
│   │   ├── PetMiniCard.tsx      # NEW - card representation
│   │   ├── PetDragLayer.tsx     # NEW - custom drag preview
│   │   └── types.ts             # Updated with PetCard
│   └── Layout.tsx               # Updated with PetPortal
├── pages/
│   └── Pets.tsx                 # Updated sanctuary
├── hooks/
│   └── usePetState.ts           # NEW - global pet state hook
└── utils/
    └── petCardUtils.ts          # NEW - pet card CRUD helpers
```

---

## Environment Themes

Default themes for the Header Pet Portal:

```typescript
const ENVIRONMENTS: EnvironmentTheme[] = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    background: 'linear-gradient(to bottom, #87CEEB 0%, #98FB98 100%)',
    groundColor: '#228B22',
  },
  {
    id: 'night',
    name: 'Starry Night',
    background: 'linear-gradient(to bottom, #0a0a2e 0%, #1a1a3e 100%)',
    groundColor: '#2d2d4d',
    ambientParticles: true,  // Stars
  },
  {
    id: 'space',
    name: 'Space Station',
    background: 'linear-gradient(to bottom, #000 0%, #1a0a2e 100%)',
    groundColor: '#333',
  },
  {
    id: 'cyber',
    name: 'Cyber Grid',
    background: 'linear-gradient(to bottom, #0a0a1a 0%, #1a0a2e 50%, #0f0f1f 100%)',
    groundColor: '#00ffff22',
  },
];
```

---

## Future Extensions

### Agent Mode
When a pet has attached "agent cards":
- Pet becomes visual avatar for the agent
- Location determines agent activation:
  - **Header**: Agent is "on duty", responds to commands
  - **Sanctuary**: Agent is "off duty", available but idle
  - **Hidden**: Agent is disabled
- Attached tool cards define agent capabilities
- Attached behavior cards define personality/responses

### Pet-to-Pet Interaction
- Pets in same zone can interact
- Social behaviors, playing, following
- Memory cards track relationships

### Breeding/Evolution
- Combine two pet cards to create offspring
- Inheritance of animations and behaviors
- Evolution through experience/usage

---

## Technical Notes

### Performance
- Header portal uses separate, lightweight PetController
- Tick rate reduced for header (5fps vs 10fps)
- Only render visible pets
- Lazy load pet assets

### Persistence
- Pet location saved on every zone change
- Debounce rapid position updates
- Sync across windows (if multi-window support added)

### Accessibility
- Keyboard navigation for pet selection
- Screen reader announcements for pet state changes
- Reduced motion mode (disable roaming)

---

## Success Metrics

- [ ] Pets persist as Cards in Hypercore
- [ ] Pets appear in Card Library with correct filtering
- [ ] Header Pet Portal renders and accepts drops
- [ ] Drag pet from Sanctuary → Header works
- [ ] Drag pet from Header → Sanctuary works
- [ ] Pet location persists across app restarts
- [ ] Environment themes switchable
- [ ] No performance degradation with 3+ pets

---

*Document Version: 1.0*
*Created: December 2, 2025*
*Author: Cascade AI*
