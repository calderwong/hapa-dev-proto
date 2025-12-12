# 🥋 Battle Space: The "Antigravity" Cultivation (v2)

> "Empty your mind, be formless, shapeless — like water. Now you put water in a cup, it becomes the cup... Now water can flow or it can crash. Be water, my friend." — Bruce Lee

**Cultivation Pass**: v2 (Claude 4.5 Sonnet with Deep Reasoning)  
**Based On**: Original requirements conversation + current codebase state  
**Model Observations**: Integration points, architectural coherence, memory safety

---

## 0. Cultivation Notes: What Changed in v2

### 🔍 Discoveries from Codebase Analysis

1. **You Already Have a "Floating Layer"**: `DragCanvas` + `FloatingCard` system is operational
   - Uses `pointer-events: none` container with `auto` on items (EXACTLY what we need)
   - Already implements drag, glow effects, and anime.js animations
   - **Implication**: We don't start from zero. We **extend** this system into 3D.

2. **The R3F Stack is Already Installed**
   - `@react-three/fiber` v9.4.2 ✅
   - `@react-three/drei` v10.7.7 ✅
   - `@react-three/postprocessing` v3.0.4 ✅
   - `animejs` v4.2.2 (your current animation engine) ✅
   - **Implication**: No new dependencies needed for MVP.

3. **Flow Forger Already Solved "Visual Connections"**
   - You're using ReactFlow for node graphs (see `FlowForger.tsx`)
   - It renders animated edges, pets, and state-driven visuals
   - **Implication**: Battle Space and Flow Forger should **share concepts**, not compete. A card in 3D space could BE a Flow node.

4. **Memory Leak History**
   - The cultivation notes warn about memory leaks in `electron/main.ts`
   - You recently fixed Base64 retention during Vertex polling
   - **Implication**: We MUST avoid holding textures/geometries in closures. R3F handles this well, but we need explicit cleanup on card removal.

5. **The `HapaCard` Type is Clean**
   - The unified card model in `types/models.ts` is well-designed
   - **Critical Gap**: It has NO spatial data (X, Y, Z, Rotation)
   - **Implication**: We need a separate spatial layer (confirmed in v1 plan, now validated).

---

## 1. Vision: The Volumetric Liberation (Unchanged)

Battle Space is the **liberation of data** from the 2D plane. Cards float in a Z-axis "Operational Theater" where they feel tangible and dangerous.

---

## 2. Strategic Architecture (Enhanced)

### Layer Harmony: Integrating with DragCanvas

**Current State**:
```tsx
// DragCanvas.tsx (Line 11)
<div className="fixed inset-0 z-[99999] pointer-events-none">
  {items.map(item => <FloatingCard key={item.id} item={item} />)}
</div>
```

**Enhancement**: The Battle Layer slots BETWEEN the DOM and DragCanvas:

```
Layer 0: DOM (Sidebar, Grids)               z-index: 1
Layer 1: BattleCanvas (3D R3F)              z-index: 50000 (NEW)
Layer 2: DragCanvas (2D Floaters)           z-index: 99999 (existing)
```

**Why This Ordering?**
- **DragCanvas on Top**: Allows users to "summon" a card from 2D, which then transitions DOWN into the 3D layer.
- **Separation of Concerns**: 2D floaty feedback (DragCanvas) vs. persistent spatial positioning (BattleCanvas).

### The Data Split (Validated)

```typescript
// In types/models.ts (existing, unchanged)
export type HapaCard = StandardCard | PetCard | SetCard;

// NEW: types/battle.ts
export interface BattleEntity {
  id: string;              // Unique entity ID (not the card ID)
  cardRef: string;         // Points to HapaCard.id
  
  // Spatial State (ephemeral)
  position: [number, number, number];  // X, Y, Z in world space
  rotation: [number, number, number];  // Euler angles
  
  // Engagement State
  mode: 'idle' | 'selected' | 'attacking' | 'defending' | 'linked';
  targetId?: string;       // If attacking/linked, what entity?
  
  // Visual Overrides
  glow?: string;           // Hex color for emission
  scale?: number;          // Size multiplier
}

// NEW: contexts/BattleContext.tsx
export const useBattleSpace = () => {
  const [entities, setEntities] = useState<BattleEntity[]>([]);
  const { cards } = useCardLibrary(); // Access to persistent data
  
  const summonCard = (cardId: string, position: [number, number, number]) => {
    // Creates a BattleEntity that references the HapaCard
  };
  
  const dismissEntity = (entityId: string) => {
    // Removes from spatial layer, card persists in library
  };
  
  return { entities, summonCard, dismissEntity };
};
```

**Why This Works**:
- `HapaCard` stays pure (no UI pollution in the data model)
- `BattleEntity` is a "view model" that gets garbage collected when battles end
- Multiple entities can reference the same card (e.g., a card "in your hand" and "in battle")

---

## 3. Implementation Plan (The Katas) - REVISED

### Kata 1: The Ghost Layer (2-3 hours)
**Goal**: Render a 3D scene WITHOUT breaking existing UI.

**Tasks**:
- [ ] Create `components/battle/BattleCanvas.tsx`
  - Transparent R3F Canvas at `z-index: 50000`
  - `pointer-events: none` on container, `auto` on meshes (same pattern as DragCanvas)
- [ ] Create `contexts/BattleContext.tsx`
  - State for `BattleEntity[]`
  - Methods: `summonCard()`, `dismissEntity()`, `linkEntities()`
- [ ] Add `<BattleCanvas />` to `Layout.tsx` (after DOM, before DragCanvas)
- [ ] **Test**: Place a spinning cube. Verify clicks pass through empty space to buttons below.

**Deliverable**: A 3D cube floats over the app. You can click the sidebar through the empty space.

---

### Kata 2: The Transition (4-5 hours)
**Goal**: Bridge 2D → 3D. When you drag a card from the library, it becomes a 3D object.

**Tasks**:
- [ ] Create `components/battle/Card3D.tsx`
  - Takes `BattleEntity` as props
  - Renders a thin `BoxGeometry` (not a plane)
  - Uses `drei`'s `<Html>` to embed the **existing** `HandCardView` component inside the mesh
    - **Why**: We reuse the card rendering logic you already have. No duplication.
- [ ] Hook into `DragCanvasContext.spawnItem()`:
  - When a card is spawned in `DragCanvas`, also call `summonCard()` in `BattleContext`
  - The card appears in BOTH layers temporarily (2D shimmer + 3D solid)
  - After 0.5s, remove from DragCanvas, leaving only 3D
- [ ] **Visual**: The card "falls" into the 3D layer (Z position animates from 50 to 10)

**Deliverable**: Drag a card from the library. It transitions from 2D floater → 3D volumetric object.

---

### Kata 3: The Manipulation (3-4 hours)
**Goal**: Full 3D control (XYZ movement, rotation).

**Tasks**:
- [ ] Use `drei`'s `<PivotControls>` or custom `useGesture` for:
  - **Drag**: X/Y movement (locked to view plane initially)
  - **Shift + Scroll**: Z-depth adjustment
  - **Right-drag**: Rotation on local axis
- [ ] **Visual Feedback**:
  - Cards "closer" to camera (higher Z) are larger and brighter
  - Cards "further" (lower Z) dim slightly
- [ ] **Hover State**: Edge glow intensity doubles, card lifts 0.5 units

**Deliverable**: You can move cards in all 3 axes and rotate them freely.

---

### Kata 4: The Connections (4-5 hours)
**Goal**: Vector linking between cards + anchoring to DOM elements.

**Tasks**:
- [ ] Create `components/battle/VectorLine.tsx`
  - Uses `drei`'s `<Line>` component
  - Takes two `BattleEntity` refs, draws curved beam between them
  - **Elastic**: If source/target moves, line updates in real-time
- [ ] Implement "Tether to DOM":
  - User right-clicks a 3D card → context menu → "Anchor to Element"
  - Crosshair appears, click a DOM element (e.g., "Gemini" sidebar icon)
  - Use `element.getBoundingClientRect()` + `camera.unproject()` to convert screen coords → 3D world point
  - Draw a ghostly beam from card to that point
- [ ] **Integration with Flow Forger**:
  - Add a button "Export to Flow Graph"
  - Converts the 3D spatial arrangement into ReactFlow nodes/edges
  - Saves the graph to `FlowForger.tsx` state

**Deliverable**: Cards connected by glowing lines. A card tethered to the Gemini icon with a beam of light.

---

### Kata 5: The Combat (3-4 hours)
**Goal**: Visual drama (post-processing, particles, sound).

**Tasks**:
- [ ] Apply `@react-three/postprocessing`:
  - `<Bloom>` effect (makes emissive materials glow)
  - `<EffectComposer>` wraps the scene
- [ ] Create `components/battle/ParticleEmitter.tsx`:
  - Simple particle system for "battle" effects
  - Triggered when `entity.mode === 'attacking'`
- [ ] **Sound Integration**:
  - Import your existing `utils/audio.ts` functions
  - Play a "whoosh" when cards move
  - Play a "clash" when two cards' bounding boxes overlap
- [ ] **Shader Polish** (Optional):
  - Cards have a subtle "hologram" shader (scanlines, transparency pulse)

**Deliverable**: It looks like Cyberpunk 2077. Glowing cards, particle trails, cinematic.

---

## 4. UI/UX Design (Enhanced with Existing Patterns)

### The "Summoning Ritual" (2D → 3D Transition)

**User Flow**:
1. User drags a card from `CardLibrary.tsx`
2. `FloatingCard` appears (existing behavior)
3. User holds `Shift` while dragging → card "phases" into 3D
   - Opacity decreases in 2D layer
   - A 3D twin emerges behind it
4. User releases → 2D floater vanishes, 3D card remains

**Visual**: The 2D card "shatters" into particles that reform as the 3D object.

### Accessibility Fallback

**Problem**: Not everyone can perceive 3D depth.
**Solution**: 
- A "2D Mode" toggle in settings that disables the 3D layer
- Cards instead snap to a fixed grid in the DragCanvas layer
- Vectors render as 2D SVG lines
- **All functionality preserved, just different visualization**

---

## 5. Integration with Existing Systems

### A. Relationship to Flow Forger

**Current**: Flow Forger visualizes pipelines (LEO → THOR → MEDIA → CONVICTION)
**Future**: Battle Space visualizes **card arrangements** and **game state**

**The Bridge**:
- A card in Battle Space can "trigger" a Flow pipeline
- A Flow node can "emit" a card into Battle Space upon completion
- Example: "MEDIA (Image Gen)" node completes → card materializes in 3D space

---

### B. Relationship to P2P/Hypercore

**Current**: Cards are synced via hypercores across peers.
**Future**: Battle state might ALSO sync (e.g., multiplayer battles).

**Architecture**:
- `BattleEntity` positions are **NOT** persisted by default
- **But**: Add a `isPersistent` flag
- If true, write the entity state to a special hypercore
- Other peers subscribe and render the same spatial arrangement
- **Use Case**: "Frozen" battle scenes that can be shared/viewed later

---

## 6. Performance \u0026 Memory Safety

### The "Memory Leak Defense" Plan

**Lessons from `electron/main.ts`**:
1. Never hold textures in closures after component unmount
2. Explicitly nullify references to large objects

**R3F Patterns**:
```tsx
// Card3D.tsx
useEffect(() => {
  // Load texture
  const texture = textureLoader.load(card.thumbnail);
  
  return () => {
    // CRITICAL: Dispose on unmount
    texture.dispose();
  };
}, [card.thumbnail]);
```

**Performance Targets**:
- **Target**: 60fps on mid-range hardware (Intel i5, 16GB RAM)
- **Limit**: Max 50 cards in 3D space simultaneously
- **Optimization**: Use instanced meshes if many cards share the same geometry

---

## 7. Testing \u0026 Validation

### Acceptance Criteria

1. **Stability**: App runs for 10 minutes with 20 cards in 3D space. Memory usage is flat (no steady climb).
2. **Interactivity**: Click-through works. Selecting a sidebar item while cards are floating does NOT select a card.
3. **Visual Quality**: Bloom effect visible on card edges. Lines are smooth (anti-aliased).
4. **Cross-Feature**: A card summoned from Battle Space → Flow Forger appears as a node.

---

## 8. Extensions (Post-MVP)

Once the core is stable, we can add:

1. **Gesture Controls**: Use webcam + MediaPipe to manipulate cards with hand gestures
2. **AR Mode**: Use WebXR to render cards in physical space via phone camera
3. **Card Battles (Game Logic)**:
   - Cards have "stats" (Attack, Defense)
   - Battles are turn-based, results update the `HapaCard.stats`
4. **Persistent Scenes**: Save/load spatial arrangements (like "save states" in games)

---

## 9. Why This Plan is Better Than v1

| Aspect | v1 | v2 (This Plan) |
|--------|-----|----------------|
| **Integration** | Assumes greenfield | Builds on `DragCanvas` + `FloatingCard` |
| **Data Model** | Implied separation | Explicit `BattleEntity` type |
| **Flow Forger** | Not mentioned | Integrated (export to graph) |
| **Memory Safety** | Generic warnings | Specific disposal patterns |
| **Accessibility** | Not addressed | 2D fallback mode |
| **P2P Sync** | Not mentioned | Architecture for future sync |

---

## 10. Next Steps

**Decision Point**: 
- ✅ **Approve this plan** → I begin Kata 1 (Ghost Layer)
- 🔄 **Revise** → Tell me what to adjust

**Estimated Timeline**: 
- **Katas 1-3**: 2 days (foundation + core interactions)
- **Katas 4-5**: 2 days (polish + juice)
- **Total**: ~4 days for a battle-ready MVP

---

*Cultivated by Claude 4.5 Sonnet (Antigravity, Deep Reasoning Mode)*  
*Verified against: `DragCanvas.tsx`, `FloatingCard.tsx`, `FlowForger.tsx`, `types/models.ts`*
