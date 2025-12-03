# Card 3D Viewer - Feature Design Document

## Vision Statement
A mesmerizing 3D card visualization system that transforms the card library into an explorable universe. Cards exist as holographic entities in space, connected by neon energy lines showing their relationships. The viewer simplifies complexity through spatial organization while maximizing the "wow factor" of each card's media and metadata.

---

## Core Philosophy

### ASTROS Alignment
- **Atmospheric**: Deep space environment with nebula backgrounds and particle effects
- **Sci-Fi**: Holographic projections, energy connections, futuristic UI elements
- **Terminal-like**: Sharp geometric shapes, grid overlays, data readouts
- **Robust**: Smooth 60fps performance, graceful degradation
- **Organized**: Clear spatial hierarchy, intuitive navigation
- **Smooth**: Fluid camera transitions, eased animations

### Design Metaphor: "The Card Nexus"
Cards are not just files—they're nodes in a living network of information. The 3D viewer reveals this network, showing how knowledge flows between cards through parent-child relationships, extractions, and generated media.

---

## View Modes

### 1. Constellation View (Macro)
**Purpose**: See the big picture of card relationships

```
                    ╭─────╮
                   ╱       ╲
              ╭───●─────────●───╮
             ╱    │         │    ╲
        ╭───●     │    ◉    │     ●───╮
        │        ╱│╲   │   ╱│╲        │
        ●───────● ● ●──┼──● ● ●───────●
                      ★
                   [FOCUS]
```

- **Parent cards** appear above
- **Current card** at center (larger, glowing)
- **Children** orbit below in a ring
- **Siblings** on same horizontal plane
- **Connection lines** pulse with energy flow direction

### 2. Card Focus View (Standard)
**Purpose**: Examine a single card in detail

```
        ┌─────────────────────────────────┐
        │     ╭───────────────────╮       │
        │     │    ★ MYTHIC ★     │       │
        │     │ ═══════════════════│       │
        │     │                   │       │
        │     │   [CARD MEDIA]    │  ← Floating media panels
        │     │                   │       │
        │     │ ───────────────── │       │
        │     │ 📊 XP: 1250      │       │
        │     │ 🏷️ Tags: AI, Art │       │
        │     ╰───────────────────╯       │
        │                                 │
        │  [IMG] [IMG] [VID]  ← Media orbit
        └─────────────────────────────────┘
```

- Card floats at center, slightly tilted for 3D effect
- Media (images, videos) orbit around card
- Badges float as holographic icons
- Tier indicator glows from quality bar
- Stats displayed on floating HUD panels

### 3. Media Theatre View (Cinematic)
**Purpose**: Showcase all videos in sequence

```
        ╔═══════════════════════════════════╗
        ║                                   ║
        ║     ┌───────────────────────┐     ║
        ║     │                       │     ║
        ║     │    NOW PLAYING        │     ║
        ║     │    Loop Video #3      │     ║
        ║     │                       │     ║
        ║     └───────────────────────┘     ║
        ║                                   ║
        ║  [1] [2] [▶3] [4] [5]  ← Queue   ║
        ╚═══════════════════════════════════╝
```

- Videos arranged in a curved screen layout
- Auto-play when entering view
- Smooth transitions between videos
- Queue showing all videos in family tree
- Picture-in-picture for current vs next

### 4. Lineage Path View (Narrative)
**Purpose**: Follow the creation story of a card

```
        ORIGIN ──────────────────────────────► NOW
        
        ┌───┐      ┌───┐      ┌───┐      ┌───┐
        │ ★ │ ───► │IMG│ ───► │VID│ ───► │IMG│
        │DOC│      │ 1 │      │ 1 │      │ 2 │
        └───┘      └───┘      └───┘      └───┘
          │          │          │          │
          ▼          ▼          ▼          ▼
        Created   Generated  Loop Made  Generated
        Jan 15    Jan 16     Jan 17     Jan 18
```

- Timeline flows left to right
- Camera follows the path
- Each node expands on hover/focus
- Shows what action created each child

### 5. Badge Galaxy View (Collection)
**Purpose**: Visualize all affixes/badges across cards

```
              🔮 MYTHIC (2)
                   │
         ┌────────┼────────┐
         │        │        │
        📝       🎬       🎵
      Summary   Video    Audio
       (15)     (8)      (3)
         │
    ┌────┴────┐
    │         │
   Card1    Card2
```

- Badges as floating crystals/orbs
- Size indicates count
- Click to filter cards with that badge
- Connections show badge relationships

---

## Visual Design

### Card Rendering
```typescript
interface Card3DAppearance {
  // Base card
  geometry: 'rounded-rectangle' | 'hexagon' | 'custom';
  thickness: number; // Card depth in 3D
  
  // Tier effects
  tierGlow: {
    common: '#6b7280',      // Gray
    uncommon: '#10b981',    // Green  
    rare: '#3b82f6',        // Blue
    epic: '#a855f7',        // Purple
    legendary: '#f97316',   // Orange
    mythic: 'gradient-rainbow' // Animated gradient
  };
  
  // Surface
  holographicSheen: boolean;
  reflectivity: number;
  
  // Effects
  particleAura: boolean; // For legendary+
  floatAnimation: boolean;
  tiltOnHover: boolean;
}
```

### Connection Lines
```
Parent ══════════════════════ Child
       ↑                    ↑
   Thicker line        Thinner line
   Brighter glow       Dimmer glow
   
Types:
  ═══════  Solid: Direct parent-child
  ─ ─ ─ ─  Dashed: Extraction source
  ≈≈≈≈≈≈≈  Wave: Generated from (AI)
```

### Lighting
- **Ambient**: Deep blue space ambiance
- **Point lights**: From card tier glows
- **Spotlights**: On focused card
- **Emissive**: Connection lines, badges
- **Bloom**: Post-processing for glow effects

---

## Navigation & Controls

### Camera Modes
| Mode | Control | Description |
|------|---------|-------------|
| Orbit | Drag | Rotate around focal point |
| Pan | Shift+Drag | Move focal point |
| Zoom | Scroll | Distance to focal point |
| Fly | WASD | Free-form navigation |

### Quick Navigation (ASTROS Panel)
```
┌─────────────────────────────────────┐
│  ◉ NEXUS NAVIGATOR                  │
├─────────────────────────────────────┤
│                                     │
│  [↑] Parent    [⟲] Reset View       │
│                                     │
│  [←] Prev   [◉] Focus   [→] Next    │
│                                     │
│  [↓] Child    [⊞] Theatre           │
│                                     │
├─────────────────────────────────────┤
│  Views: [🌌] [📍] [🎬] [📈] [🏷️]    │
│         Const Focus Thtr Line Badge │
└─────────────────────────────────────┘
```

### Keyboard Shortcuts
- `1-5`: Switch view modes
- `Space`: Play/pause focused video
- `Enter`: Enter focused card
- `Backspace`: Go to parent
- `Tab`: Cycle through children
- `R`: Reset camera
- `M`: Toggle mute
- `F`: Fullscreen

---

## Performance Strategy

### Level of Detail (LOD)
```
Distance from camera:
  0-5 units:   Full detail, videos play, particles active
  5-15 units:  Medium detail, video thumbnails, no particles
  15-30 units: Low detail, card silhouette, tier color only
  30+ units:   Point/icon only
```

### Resource Management
- **Video textures**: Only 3 active at a time (focused + 2 nearest)
- **Instanced rendering**: For connection lines and particles
- **Frustum culling**: Don't render off-screen cards
- **Texture atlasing**: Combine card thumbnails
- **Web Workers**: Relationship calculations off main thread

### Target Performance
- 60 FPS on mid-range hardware
- Graceful degradation to 30 FPS on low-end
- Initial load < 2 seconds for 100 cards
- Memory < 500MB for large collections

---

## Implementation Plan

### Phase 1: Foundation (MVP)
- [ ] Set up React Three Fiber in CardLibrary
- [ ] Basic 3D card component with texture
- [ ] Camera controls (orbit, zoom)
- [ ] Single card view mode
- [ ] Tier glow effects

### Phase 2: Relationships
- [ ] Parent-child positioning
- [ ] Connection lines with animation
- [ ] Constellation view
- [ ] Navigation between cards
- [ ] Lineage path view

### Phase 3: Media Integration
- [ ] Video textures on cards
- [ ] Auto-play when in view
- [ ] Media orbit around cards
- [ ] Theatre view mode
- [ ] Audio visualization

### Phase 4: Polish
- [ ] Particle effects
- [ ] Holographic sheen
- [ ] Badge visualization
- [ ] ASTROS control panel
- [ ] Keyboard navigation
- [ ] Performance optimization

### Phase 5: Advanced
- [ ] Badge galaxy view
- [ ] Search/filter in 3D
- [ ] Card actions (create loop, extract)
- [ ] Export/share views
- [ ] VR mode (future)

---

## Technical Architecture

### Dependencies
```json
{
  "@react-three/fiber": "^8.x",
  "@react-three/drei": "^9.x",
  "@react-three/postprocessing": "^2.x",
  "three": "^0.160.x",
  "zustand": "^4.x" // For 3D state management
}
```

### Component Structure
```
src/components/Card3DViewer/
├── Card3DViewer.tsx        # Main container
├── Card3D.tsx              # Individual card mesh
├── CardConnections.tsx     # Relationship lines
├── MediaOrbit.tsx          # Orbiting media elements
├── NexusNavigator.tsx      # ASTROS control panel
├── ViewModes/
│   ├── ConstellationView.tsx
│   ├── FocusView.tsx
│   ├── TheatreView.tsx
│   ├── LineageView.tsx
│   └── BadgeGalaxyView.tsx
├── effects/
│   ├── TierGlow.tsx
│   ├── ConnectionBeam.tsx
│   ├── ParticleAura.tsx
│   └── HolographicShader.tsx
├── hooks/
│   ├── useCardPositions.ts
│   ├── useVideoTexture.ts
│   └── useCameraAnimation.ts
└── store/
    └── viewer3DStore.ts
```

### State Management
```typescript
interface Viewer3DState {
  // View
  viewMode: 'constellation' | 'focus' | 'theatre' | 'lineage' | 'badges';
  focusedCardId: string | null;
  selectedCardIds: string[];
  
  // Camera
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  cameraTransitioning: boolean;
  
  // Media
  playingVideoIds: string[];
  globalMuted: boolean;
  
  // Performance
  lodLevel: 'high' | 'medium' | 'low';
  particlesEnabled: boolean;
  
  // Actions
  focusCard: (cardId: string) => void;
  setViewMode: (mode: ViewMode) => void;
  navigateToParent: () => void;
  navigateToChild: (index: number) => void;
  playAllVideos: () => void;
}
```

---

## Integration Points

### Entry Points
1. **Card Inspector**: "View in 3D" button
2. **Card Grid**: Right-click → "Explore in 3D"
3. **Lineage Panel**: "Visualize Lineage" button
4. **Keyboard**: `Ctrl+3` from anywhere in Card Library

### Actions Available in 3D
- View card details (opens inspector)
- Navigate to card (makes it the 2D selection too)
- Create loop video (triggers generation)
- Extract media (triggers extraction)
- Share view (export camera position URL)
- Screenshot (capture current view)

### Data Flow
```
CardLibrary.cards ──► Viewer3DStore ──► Three.js Scene
       │                    │
       └────────────────────┘
              Sync selected card
```

---

## Creative Feature Ideas 🍌

### 1. "Time Spiral" View
Cards arranged in a 3D spiral based on creation time. Newest at center, oldest at edges. Zoom to travel through time.

### 2. "Card DNA" Visualization
When viewing a generated card, show a "DNA helix" of the prompts/context that created it. Each segment is a piece of context.

### 3. "Constellation Naming"
Let users name groups of related cards as "constellations" that persist. "The Genesis Cluster", "The Loop Collection".

### 4. "Energy Flow" Animation
Animated particles flow along connection lines showing the direction of "influence" (parent → child).

### 5. "Card Echo"
When focusing on a card, faint "echoes" of its children appear behind it, showing its legacy.

### 6. "Rarity Aurora"
Mythic cards emit aurora borealis-style effects that illuminate nearby cards.

### 7. "Media Symphony"
In Theatre view, videos play in musical sequence, with visual transitions synced to their audio.

### 8. "Badge Magnet"
Toggle to pull all cards with a specific badge toward center, revealing patterns.

### 9. "Generational Rings"
Like tree rings, show card "generations" as concentric rings around the origin.

### 10. "Ghost Cards"
Show placeholder "ghost" cards for potential children (what could be generated/extracted).

---

## Review & Critique

### Potential Issues

**Issue 1**: Performance with many cards
- **Critique**: 100+ cards with videos could crush performance
- **Solution**: Aggressive LOD, max 3 video textures, instancing

**Issue 2**: Learning curve for 3D navigation
- **Critique**: Users unfamiliar with 3D may get lost
- **Solution**: Clear ASTROS panel, "Reset View" always visible, guided mode

**Issue 3**: Mobile/touch support
- **Critique**: 3D navigation on mobile is tricky
- **Solution**: Simplified touch controls, auto-rotate mode, preset views

**Issue 4**: Accessibility
- **Critique**: 3D is inherently less accessible
- **Solution**: Keyboard navigation, screen reader descriptions, 2D fallback

**Issue 5**: Integration complexity
- **Critique**: Adding Three.js to existing React app could cause issues
- **Solution**: Lazy load 3D viewer, isolated component, error boundaries

### Overcoming Critiques

1. **Make it optional**: 3D viewer is enhancement, not replacement
2. **Progressive enhancement**: Start simple, add effects based on hardware
3. **Clear escape hatch**: Easy return to 2D view
4. **Guided tours**: First-time tutorial showing key features
5. **Preset views**: One-click to useful perspectives

---

## Success Metrics

- [ ] Renders 50 cards at 60fps on M1 Mac
- [ ] Initial load under 2 seconds
- [ ] Users can find specific card in under 10 seconds
- [ ] Video playback smooth in Theatre mode
- [ ] All keyboard shortcuts functional
- [ ] Works in latest Chrome, Firefox, Safari
- [ ] Memory usage under 500MB

---

## Implementation Order

1. **Create component structure** - Empty shells
2. **Basic Three.js setup** - Canvas, camera, lights
3. **Single card rendering** - Card mesh with texture
4. **Tier glow shader** - Visual feedback
5. **Camera controls** - Orbit, zoom, pan
6. **Card positioning** - Parent/child layout
7. **Connection lines** - Basic lines first
8. **Focus view mode** - Complete single-card experience
9. **Constellation view** - Relationship visualization
10. **Video textures** - Media playback
11. **Theatre view** - Cinematic mode
12. **ASTROS panel** - Navigation UI
13. **Animations** - Smooth transitions
14. **Effects** - Particles, bloom, holographic
15. **Polish** - Performance, edge cases

---

*Ready to enter the Nexus? Let's build this.* 🚀
