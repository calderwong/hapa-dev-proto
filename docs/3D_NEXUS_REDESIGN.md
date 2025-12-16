# 3D Nexus Redesign – “Nexus OS”

## 0. Intent
Turn **3D Nexus** from a cool modal into a **first-class control surface** for exploring and managing:
- Cards (media, lore, mechanics)
- Relationships (lineage + derived-from + references)
- Artifacts (summaries, key terms, transcripts, images, videos)
- Time (evolution across generations)

The target is: **as powerful and important as admin panels**, while feeling more like an **interactive sci-fi instrument** than a static graph.

This doc is a redesign proposal grounded in:
- Current implementation (`src/components/Card3DViewer/*`, launched from Card Library)
- Prior design docs (`docs/CARD_3D_VIEWER_DESIGN.md`, lineage/pipeline plans)
- Primary-source inspiration (Cosmograph, sigma.js, react-force-graph)


## 1. Current State Audit (What we have now)

### 1.1 Entry point
- Launched from `CardLibrary.tsx` via a top-right button: **“3D Nexus”**.
- Viewer is lazy-loaded and displayed as a full-screen modal.

### 1.2 Rendering stack
- **React Three Fiber** (`@react-three/fiber`, `three`, `@react-three/drei`, `@react-three/postprocessing`)
- Visual elements:
  - `Card3D`: a 3D card mesh with a texture (if a thumbnail exists)
  - `CardConnections`: curved lines + animated particles along edges
  - `ComponentNode3D`: non-card nodes (images, videos, summaries, etc.) as 3D shapes
  - `NexusNavigator`: bottom-left hover-expanding controls

### 1.3 Data model
- Viewer receives `cards` as a simplified mapping of Card Library entries.
- Relationships are inferred mostly from `parentCardId` / `cardRecord.parentCardId`.
- “Component graph” is extracted from a single focused card (`extractGraphFromCard`), plus minimal parent/child card nodes.

### 1.4 Interaction model
- OrbitControls (pan/zoom/rotate)
- Click a card → focus
- Keyboard shortcuts (arrows, R, M, Esc)
- View modes exist in state but are not fully distinct render modes yet.

### 1.5 Strengths
- The vibe is already close to ASTROS.
- Lazy-loading isolates risk.
- Component extraction is a solid foundation: cards are more than just nodes.

### 1.6 Gaps / pain points
- **Not a true “nexus” yet**: mostly a focused-card constellation, not “all connections”.
- **No large-graph mode**: hundreds/thousands of cards will not be navigable.
- **No global search/filter** within Nexus.
- **No inspector** that feels as powerful as the rest of the app.
- **No concept of layers** (lineage vs references vs artifacts vs tags).
- **No persistence** of user-created maps, bookmarks, named constellations.


## 2. Redesign Philosophy

### 2.1 “The Map IS the Territory”
Nexus OS should be the place you can:
- Find things
- Understand provenance
- See relationships
- Act on the graph

Not just look.

### 2.2 Multi-view, one mental model
3D is for **presence** and **focus**.
2D is for **scale**, **search**, and **precision**.
Timeline is for **narrative**.
The inspector is for **truth**.

### 2.3 Progressive disclosure
- Start focused and comprehensible.
- Let the user expand scope intentionally:
  - local graph → neighborhood → cluster → all

### 2.4 Performance-first UX
If it isn’t smooth, it’s not “cool”.


## 3. “Nexus OS” – Proposed UI

### 3.1 Layout
A full-screen workspace with **four stable regions**:
- **(A) Main Surface**: 3D or 2D graph canvas
- **(B) Left Tool Rail**: modes + layers + filters (collapsible)
- **(C) Right Inspector**: selected node/card details + actions
- **(D) Bottom Scrubber**: time + lineage + breadcrumbs (context-aware)

Key idea: the viewer becomes a **workspace**, not a modal toy.

### 3.2 Modes (views) – all share selection state
- **3D Focus**: immersive, cinematic focus on a selected cluster
- **2D Atlas**: large-graph exploration for hundreds/thousands of nodes
- **Lineage Path**: narrative left→right or bottom→top lineage traversal
- **Theatre**: media-centric view (videos/images) across a lineage or cluster
- **Badge/Facet Galaxy**: facet-first navigation (tier, provider, tags, mediaKind, artifacts)
- **Time Spiral / Timeline**: time-scrubbed evolution (creation times, generation times)

A mode switch never “teleports” you away; it re-renders the same selection state.

### 3.3 Layers (toggleable)
Layers are the key to “all connections” without chaos:
- **Lineage**: parent-child edges
- **Derived-from**: extraction/generation edges
- **References**: wiki links, citations, explicit relationships
- **Artifacts**: card → summary/keyterms/transcripts/media nodes
- **Similarity (future)**: embeddings/semantic similarity edges

### 3.4 Core interactions
- **Search**: type to highlight + focus + show neighborhood
- **Pin / Bookmark**: save a node/cluster as a “Constellation”
- **Expand**: expand neighborhood by radius or edge-types
- **Focus**: isolate selection (dim everything else)
- **Lasso / box select (2D Atlas)**: select cluster + create a constellation
- **Breadcrumbs**: jump back through navigation history
- **Mini-map (2D Atlas)**: don’t get lost

### 3.5 Inspector (Right panel)
The inspector needs to feel like a powerful admin tool:
- **Card header**: name, id, tier, provider, timestamps
- **Media**: preview (image/video/audio) with controls
- **Artifacts**: summaries/keyterms/transcripts; show counts + quick open
- **Relationships**:
  - parent
  - children
  - siblings
  - derived-from
  - references
- **Actions** (existing app actions surfaced here):
  - open in Card Library inspector
  - create loop video
  - extract first/last frame / audio
  - run wormhole pipeline
  - attach scroll/context
  - export media

### 3.6 “Nexus HUD” (top)
- active mode
- node/edge counts
- FPS / quality tier
- quick toggles: particles, bloom, labels, reduce motion


## 4. Data Model & Graph Construction

### 4.1 Normalize node types
We already have `GraphNode`/`GraphEdge`. Expand to a single “NexusGraph”:
- **Card nodes**: every card
- **Artifact nodes**: summary/keyterm/transcript/wiki
- **Media nodes**: image/video/audio items as explicit nodes when needed

### 4.2 Normalize edge types
Use a stable vocabulary:
- `lineage`: parent-child
- `derived_from`: extraction/generation
- `references`: wiki/reference edges
- `contains`: card → component (artifact/media)

### 4.3 Graph scopes
- **Local graph**: focused card + neighborhood
- **Cluster graph**: a saved constellation
- **Global graph**: all cards (2D atlas only)

### 4.4 Performance strategy for graph building
- Build global graph incrementally (progressive enrichment)
- Cache adjacency lists
- Move heavy layout work to a Web Worker when possible


## 5. Rendering Strategy (Bruce Lee-ing best tools)

### 5.1 Keep 3D Focus (R3F)
The current `react-three-fiber` approach is already aligned with ASTROS.
Use 3D for:
- focused clusters
- cinematic transitions
- rich visuals

### 5.2 Add a 2D Atlas for scale (WebGL)
For thousands of nodes, 3D becomes a tax.
We should add a high-performance 2D WebGL graph mode.

Primary-source inspiration:
- **Cosmograph**: emphasizes GPU speed, filtering, timeline, and large graphs.
- **sigma.js**: WebGL graph rendering with graphology; excellent for large networks.
- **react-force-graph**: flexible interactions (hover/click/drag), DAG modes, camera controls.

Recommendation for Hapa:
- **sigma.js + graphology** for the 2D Atlas mode.
  - Pros: proven WebGL performance, flexible styling, good ecosystem for interactions.
  - Cons: custom UI integration work.

### 5.3 Shared selection model
A single store (Zustand) should own:
- selected node ids
- focused card id
- active layers
- active mode
- graph scope
- filters/search


## 6. UX Details to Make It “Cooler”

### 6.1 “Energy semantics”
Edges should communicate meaning:
- lineage edges: cyan “flow” parent→child
- derived-from: purple “alchemy” pulses
- references: blue “data cable”

### 6.2 “Instrument-grade” navigation
- Hold `Space`: temporarily switch to “grab” pan
- Hold `Shift`: lasso select (Atlas)
- Double-click node: focus
- `F`: focus mode
- `G`: toggle global/local
- `L`: cycle layers

### 6.3 “Constellation naming”
User can save named constellations:
- persisted locally (start with localStorage; later move to persistence DB)
- shown as a list in the left rail

### 6.4 Time as a first-class dimension
Add a time scrubber that can:
- filter nodes by creation time
- animate “construction” of a lineage


## 7. Implementation Plan (Phased, safe)

### Phase 0 – Stabilize current 3D Nexus (1–2 sessions)
- Harden thumbnail/video preview handling
- Clean up store usage (viewMode actually changes behavior)
- Add basic in-view search (filter list in the navigator)

### Phase 1 – Nexus OS Shell (layout + inspector)
- Convert modal to a workspace-like shell inside the modal
- Add left rail (modes/layers) and right inspector
- Introduce unified store for selection + filters

### Phase 2 – Graph construction + layers
- Build a normalized `NexusGraph` from `cards`
- Add toggles for layers
- Add expand-neighborhood interaction

### Phase 3 – 2D Atlas mode
- Implement sigma.js-based atlas view
- Lasso select + search highlight
- Minimap + cluster selection

### Phase 4 – Persistence of user maps
- Persist named constellations, pinned nodes, saved camera positions

### Phase 5 – The “wow” layer
- Animated camera transitions
- Shaders/auroras for mythic tiers
- Edge energy flow that reflects “influence” direction


## 8. Compatibility / Integration Review

### 8.1 Don’t break core workflows
- Card Library remains primary for editing/exporting
- Nexus is a power lens, not a replacement

### 8.2 Avoid known crash vectors
- Don’t introduce ToastProvider usage (known renderer crash risk)

### 8.3 Icon validation
Any new Astro icons must be verified against the primary icon library before commit.


## 9. Open Questions (for you)
- Do you want Nexus to be only inside Card Library, or promoted to a top-level route?
- Should “constellations” be tied to Card Sets, or independent?
- What’s the priority between:
  - large-scale global graph
  - lineage storytelling
  - artifact/component visibility


## 10. Next Actions
1. Implement Phase 0 + Phase 1 (shell + inspector + store)
2. Add 2D Atlas proof-of-concept behind a feature toggle
3. Iterate on interaction feel + performance
