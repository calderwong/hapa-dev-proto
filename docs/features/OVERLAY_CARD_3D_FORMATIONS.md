# Overlay Cards: Z-Axis Hover + Formations (Main App)

## Context
The main app already supports “cards that stay on top of the UI” via the global drag overlay:
- `DragCanvasProvider` (`src/contexts/DragCanvasContext.tsx`)
- `DragCanvas` (`src/components/DragCanvas.tsx`)
- `FloatingCard` (`src/components/cards/FloatingCard.tsx`)
- Spawners: `useGlobalDrag` + `DraggableHandCard` + `DraggableGridCard`

These overlay cards are DOM elements (not Three.js). They are positioned by applying `translateX/Y` transforms during pointer drag.

Overlay state persistence:
- Overlay cards and their free positions, `overlayLayout`, and per-card `zOffsets` are persisted to `localStorage`.

## Goal
Enable these overlay cards to:
1. **Hover on Z-axis** (depth above the UI) while remaining in the overlay.
2. **Snap into formations** (fan/line/stack/arc/ring) as a group.
3. **Return to free mode** (restore their previous positions) and optionally **snap back into the hand**.

## Key Design Choice
### DOM 3D transforms (not Three.js)
We implement 3D depth using CSS transforms:
- Container: `perspective` + `transform-style: preserve-3d`
- Card visual: `translateZ(...)` and small `rotateZ(...)`

This works across all pages because the overlay is global and fixed-position.

## Data Model Extensions
Overlay-level state (in `DragCanvasContext`):
- `overlayLayout`: `{ mode, hover }`
  - `mode`: `free | fan | line | stack | arc | ring`
  - `hover`: enables Z-depth in formation mode
- `selectedItemId`: selected overlay item (for Z testing)
- `zOffsets`: per-item Z adjustment for testing (mouse wheel)

## Formation Controller (POC)
Implement small HUD attached to `DragCanvas` (only visible if overlay has items):
- Toggle: **Hover** (applies Z-depth to formation)
- Buttons: **Fan / Line / Stack / Arc / Ring**
- Button: **Free** (return to saved free positions)

Selection/Z testing controls:
- `Shift+Click` an overlay card to select/deselect it.
- Mouse wheel over the selected card adjusts per-item `translateZ`.
- HUD shows selected card id prefix and current Z value, with **Z Reset** and **Clear**.

Formation computation is based on viewport coordinates:
- Anchor defaults near top center.
- If the hand dock snap zone (`hand-dock`) is available, formations anchor to the hand dock position (so formations appear where the hand lives).
- Layout per item in order of `items[]`
- Convert target absolute positions to per-item translate offsets.

Keyboard shortcuts (for testing):
- `H`: toggle hover
- `0`: free
- `1`: fan
- `2`: line
- `3`: stack
- `4`: arc
- `5`: ring
- `Esc`: clear selection

## Snap to Hand
The hand registers snap zones in `CardHand`:
- `hand-dock` (always registered, even when collapsed)
- `hand-slot-*` (registered when expanded)

`FloatingCard` snap behavior:
- Snap detection prefers **rectangle overlap** (fallback to center distance threshold).
- On snap: animate translate into the zone center and shrink to the zone size, then:
  - call `zone.onSnap(item)`
  - remove the floating overlay card

`CardHand`’s `handleSnap` accepts `DragItem` and:
- For `LIBRARY_CARD`: adds a `HandCard`.
- For `HAND_CARD`: no-op (overlay removal reveals the original hand card).

## Acceptance Criteria
- With 2+ overlay cards active, you can press formation buttons and see:
  - Cards move together into formation.
  - Cards show Z-axis separation/hover (depth layering).
- Clicking **Free** returns cards to their prior positions.
- Dragging still works.
- Dropping a library card overlay onto the hand snaps and adds to hand.
- Dropping a hand overlay card onto the hand snaps and dismisses the overlay.
- `Shift+Click` + mouse wheel can change a selected card’s Z for perspective testing.
