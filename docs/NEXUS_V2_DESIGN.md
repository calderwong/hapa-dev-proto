# Nexus V2 Design Doc — Card Materiality, Identity, and Relationship UX

## 0. Why this doc (intent)
The current 3D Nexus experience is already functional (GLOBAL/LOCAL, camera focus presets, LOD, edge caps, multi-formations, ship mode). This V2 effort is about **making cards feel valuable and real**, while improving the **readability of relationships** and the **flow between views**.

Primary user goals:
- **Treasure**: cards feel collectible, crafted, rare, and emotionally “worth owning.”
- **Tool**: cards feel useful, legible, and operational: “what is this, what can I do with it?”
- **System coherence**: the Nexus feels like one product language (homogeneous), while each card’s identity still shines.

## 1. North Star (experience)
When you enter Nexus, it should feel like stepping into a **vault-workshop**:
- A vault of artifacts (valuable, rare, curated)
- A workshop bench (tools, parts, actionable knowledge)
- A mission console (Astro/ops vibes: clean hierarchy, dense but readable)

## 2. Visual language: “Treasure-Tool Chassis”
Treat every card as a consistent **hardware chassis** that can be decorated.

### 2.1 Chassis layers (3D)
- **Base body**: heavy, dark, durable material (ceramic / carbon / obsidian composite).
- **Beveled frame**: catches light, communicates thickness and “object-ness.”
- **Tier trim**: colored metal/energy inlay. This is the “rarity plating.”
- **Front glass**: subtle protective lens (clearcoat/glass), giving depth and reflections.
- **Media window**: the “face” where identity shows (image/video/placeholder glyph).
- **Seal / stamp**: a tiny emblem that communicates “this belongs to the system.”

### 2.2 Identity channels (what makes a card feel like itself)
- **Hero media** (thumbnail) is the strongest identity signal.
- **Type + role**: the next strongest (Tool/Technique/Concept/Entity/Principle). If not available now, infer from `mediaKind` and metadata presence.
- **Key terms**: become “engraved tags” (compact, high signal).
- **Skills**: become “capability chips” (tool feel).
- **Lore**: becomes “artifact flavor” (treasure feel) but must not dominate.

### 2.3 Homogeneity rules
- Shared dimensions, consistent margins, consistent badge shapes.
- Shared lighting response (same material model family).
- Shared hierarchy: Title > capability chips > key terms > lore.
- Rarity tier affects trim/glow, not layout.

## 3. Motion design (feel)
V2 should lean into motion as evidence of material quality.

### 3.1 Micro-interactions
- **Hover**: gentle tilt/parallax + slightly increased specular/clearcoat + rim glow.
- **Focus**: stronger lift, slightly slower “float,” crisp outline, and a stable focus ring.
- **Select**: subtle “snap” (spring-like) into a stable pose.

### 3.2 Attention guidance
- Use **animated sheen** sparingly: only on focused/hovered, only in small amplitude.
- Keep far-away cards calm; keep near/active cards alive.

## 4. Relationship visualization (edges) — clarity first
Current edges are readable but uniform. V2 aims to make relationship types more legible.

### 4.1 Relationship semantics
- **Parent-child**: structural lineage. Should feel like a “spine” or “beam.” Direction matters.
- **Card-component**: internal anatomy. Should feel like “wiring” (thin, subtle).
- **Derived-from / extraction / generated**: processing lineage. Should feel like “data flow.”
- **Sibling**: lateral association. Should feel like “tension cable.”
- **Reference**: hyperlink. Should feel like “signal.”

### 4.2 Encoding strategy (non-verbal)
- **Color**: keep current palette, but harmonize intensity.
- **Width**: parent-child thickest; card-component thinnest.
- **Dash**: reference/extraction dashed.
- **Particles**: data-flow edges get particles; structural edges minimal particles.
- **Endpoints**: arrowhead or directional glow for flow edges.

### 4.3 Legends + filters
- Small legend in rail (or toggleable) mapping edge styles to meaning.
- Filters per edge type (and preserve existing global edge cap).

## 5. UX flows between views
### 5.1 GLOBAL → LOCAL
- Should feel like “entering a constellation bay.”
- Keep the selected card centered and keep context: parent/children/siblings appear in consistent positions.

### 5.2 Inspector relationship to card
- Inspector should mirror the card’s identity cues (same tier color, same chips).
- Clicking a chip (skill / key term) should be a future affordance to navigate/filter.

### 5.3 Ship mode
- Ship mode is a playful “explore” mode. It should not degrade card readability.
- Reticle + shots should visually match the same system palette.

## 6. Performance constraints
- Preserve label LOD; expand it to include “rich overlays” only when near/focused.
- Avoid heavy transparency stacks at distance.
- Prefer a small number of meshes per card; reuse geometry/materials where possible.

## 7. Implementation plan (incremental)
### Phase A — Card3D Materiality Pass (highest impact)
- Introduce rounded/beveled body.
- Use `meshPhysicalMaterial` / clearcoat for “manufactured object.”
- Improve front face composition: tier trim, media window, corner stamp.
- Upgrade overlay typography + badge hierarchy.

### Phase B — Relationship/Edge Pass
- Edge widths/dash per type.
- Optional arrowheads and/or endpoint glows per type.
- Add legend + filters.

### Phase C — Flow polish
- Transition cues between GLOBAL/LOCAL.
- Better focus transitions and consistent “focus state.”

## 8. Acceptance checklist
- Cards feel like objects (depth, specular response, bevel).
- Cards feel valuable (rarity trim/glow, emblem, polish).
- Cards feel useful (capability chips + key terms are readable, not noisy).
- System coherence (same chassis, different faces).
- Edges are more legible by type.

## 9. V2 “research” notes (where we are now)
### 9.1 Current strengths
- The 3D Nexus already has a strong “space-console” mood: stars, bloom, and dark surfaces.
- GLOBAL/LOCAL split gives a real sense of scale vs intimacy.
- Label LOD is correct: we can afford richer overlays *near* but must not pay for them *far*.
- Connection particles are a good baseline for “flow.”

### 9.2 Current weaknesses
- Cards read more like “flat UI planes” than manufactured artifacts.
- Tier identity exists but doesn’t feel like “rarity plating.”
- Relationship types exist but are not strongly encoded by thickness/shape/arrow direction.
- The overlay looks like a tooltip; we want “panel-instrumentation” while preserving the 3D object.

## 10. Card V2 visual spec (Treasure-Tool Chassis)
### 10.1 Geometry & silhouette
- **Rounded rectangle** silhouette with consistent corner radius.
- **Two depth cues**:
  - An outer rim (bevel/frame)
  - An inner face (body)
- Optional: subtle “corner stamp” geometry on the top-right.

### 10.2 Material spec (how to feel real)
- Frame: high metalness, low roughness, tier emissive accent.
- Body: low metalness, higher roughness, clearcoat for manufactured finish.
- Lens: thin plane with transmission/clearcoat (very low opacity) to sell depth.

### 10.3 Identity layout
The card should read like a tool panel:
- **Top strip**: tier label + media icon.
- **Title**: monospace “asset label.”
- **Utility row**: small icons indicating internal components (summary/keyterms/images/children).
- **Capability chips**: skills.
- **Engraving chips**: key terms.
- **Flavor**: lore (small, italic, clipped).

### 10.4 Homogeneous but expressive
- Rarity changes the *trim + glow* not the layout.
- Media changes the identity (thumbnail vs placeholder), not the chassis.
- Chips and badges are always same shapes.

## 11. Typography & information hierarchy
### 11.1 Fonts
- Primary: monospace for card “labels” and technical values.
- Secondary: minimal sans/mono mix is okay, but must feel like one system.

### 11.2 Density rules
- Overlay should be readable at arm’s length but never dominate the 3D scene.
- Favor abbreviations and clipping:
  - Titles max ~28 chars
  - Key terms max 3
  - Skills max 2
  - Lore max ~50 chars

## 12. Motion & animation spec
### 12.1 Card motion
- Idle: gentle float.
- Hover: parallax tilt toward camera, increase clearcoat/emissive slightly.
- Focus: stronger halo + slower float.

### 12.2 Relationship motion
- Structural edges (parent-child) move the least.
- Flow edges (generated/extraction/reference) can have particles.
- Avoid too much motion when GLOBAL is dense.

### 12.3 Transition language
- GLOBAL → LOCAL should feel like zooming into a “workbench bay.”
- LOCAL should feel more stable (less background chaos).

## 13. Relationship visualization V2 (detailed)
### 13.1 Encode meaning through multiple channels
- **Thickness**:
  - parent-child: thick
  - sibling: medium
  - reference/extraction: medium-thin
  - card-component: thin
- **Dash patterns**:
  - extraction/reference: dashed
  - generated: dotted or pulsing dash
- **Particles**:
  - extraction/generated/reference: yes
  - parent-child/card-component: minimal or none

### 13.2 Direction & endpoints
- For flow edges, endpoints should show direction (arrowhead mesh or brighter “head” particle).
- For parent-child, endpoints can be small nodes but should not look like flow.

### 13.3 Legend & filters
- Add a small “legend” block in the rail mapping edge style → meaning.
- Add per-edge-type toggles (future) and keep global edge cap.

## 14. UX: flows between things and views
### 14.1 Focus as the primary verb
- Every major action should reinforce focus:
  - click card → focus card
  - shoot card (ship) → focus card
  - list click → focus card

### 14.2 Inspector as a mirror
- Inspector should show:
  - Tier label (same class system)
  - Key terms / skills chips matching card overlay
  - Relationship shortcuts (parent/children/siblings)

### 14.3 Relationship affordances
- Clicking an edge is not required in V2, but we should plan for:
  - hover edge to highlight both endpoints
  - click edge to show relation detail

## 15. Implementation sequencing (how we’ll ship this safely)
### 15.1 Phase A — Card materiality (already started)
- Move card from box to beveled chassis.
- Add tier trim and lens.
- Upgrade overlay from tooltip → instrument panel.

### 15.2 Phase B — Edge semantics
- Implement widths/dashes per type.
- Optionally add arrowheads for flow edges.
- Add legend.

### 15.3 Phase C — Flow polish
- Focus transitions.
- Global/local “entry” feel.

## 16. Open questions
- Do we want card “types” (Tool/Technique/Concept/Entity/Principle) shown on the overlay once available from metadata?
- Should tiers be derived from content completeness (skills/truths/howToUse), or remain purely aesthetic?
- Should GLOBAL view be “calmer” (lower bloom) than LOCAL?

*Status: Draft V2 — expanded research notes; Phase A implementation underway.*
