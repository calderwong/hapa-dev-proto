# Hand Hover + Formations (3D Card Space) — Proof of Concept

## Context
The default `Card Set Battler` prototype (`docs/features/card_set_battler_proto.html`) currently renders cards as Three.js meshes with a light “bobbing” animation and click-to-focus via raycasting. There is no explicit “hand” zone yet, and there is no pointer drag/move interaction.

This doc defines a minimal, working proof-of-concept to:
1. Lift/hover a **hand** of cards together above the grid/canvas.
2. Switch between several hand **formations**.
3. Return cards back into the hand.

## Goals
- Add an explicit **zone** concept: `hand` vs `field`.
- Implement a **hand hover** state that raises hand cards along Z (and slightly in Y) relative to the grid plane.
- Implement **formation presets** that reposition hand cards as a group with sensible spacing/rotation.
- Support “return to hand” for cards currently in field.
- Keep this POC self-contained inside `card_set_battler_proto.html` with the existing React + Three.js setup.

## Non-goals (for this POC)
- Physics simulation, collision, or stacking constraints.
- Multiplayer / persistence.
- High-fidelity card-to-pointer drag with momentum.
- Complex selection gestures and multi-card lasso.

## Proposed Interaction Model
### States
- **Hand Hover**: boolean `handHoverEnabled`
- **Hand Formation**: enum `handFormation`
- **Drag**: `dragState` (active card id, plane intersection point, offsets)

### Zones
Each card in React state gets:
- `zone`: `'hand' | 'field'`
- `handIndex`: number (stable ordering for hand layout)
- `home`: `{ x, y, z, rotZ }` (optional cached “hand home”) for return animation

### Controls (HUD)
Add to the existing “Spatial Controls” HUD:
- Toggle: **Hand Hover** (on/off)
- Select: **Formation**
  - `fan`
  - `line`
  - `stack`
  - `arc`
  - `ring`
- Button: **Return All to Hand**
- Button: **Scatter to Field** (optional; helpful for demo)

### Behaviors
- **(1) Rise up and hover together**
  - When hover is enabled, all `zone === 'hand'` cards move to a raised Z/Y band near the “player” side of the board.
  - Each card retains subtle bobbing but shares a common base plane offset.

- **(2) Change formations**
  - Switching the formation recomputes target positions/rotations for all hand cards.
  - Animation uses `lerp` per-frame (already used elsewhere), so changes feel smooth.

- **(3) Put back in the hand**
  - “Return All” sets all cards to `zone: 'hand'` and assigns them a `handIndex`.
  - (Optional extra gesture) A focused card can be returned to hand via a small button next to “Active Target”.

## Layout Algorithms (Hand Formations)
All formations are computed from:
- `N`: number of hand cards
- `i`: hand index in [0..N-1]
- `t`: normalized position in [-1..1]

Suggested baseline anchor:
- `anchorY`: around `-3.5` (above the grid which is at y=-6)
- `anchorZ`: around `3` (closer to camera than the field cards)

### Fan
- x spreads left-to-right, z slightly staggers for depth.
- rotZ curves to face the camera like a hand of cards.

### Line
- straight line, minimal rotation.

### Stack
- same x/y, z offsets slightly per card, small rot jitter.

### Arc
- place on an arc segment; rotation aligns tangentially.

### Ring
- small ring around a center; rotation faces outward.

## Implementation Notes
- Add a hand layout computation function in the prototype.
- Store each mesh’s `targetX/Y/Z` and `targetRotZ` in `mesh.userData`.
- In the animation loop, lerp mesh.position and mesh.rotation.z toward targets.
- Keep the existing hover/focus scaling; ensure it composes with hand hover.

## Risks / Constraints
- This prototype runs inside an iframe with `srcDoc`; keep dependencies self-contained.
- We should avoid large textures / base64 growth (no new heavy assets).
- Pointer interaction should not break the existing HUD. We should only enable canvas pointer events when required (existing `mode !== 'ui'` pattern).

## Acceptance Criteria
- With a button click, all hand cards visibly lift above the grid and hover as a group.
- Formation changes are obvious and stable.
- Return-to-hand works and is repeatable.
- No console spam and no UI lockups.
