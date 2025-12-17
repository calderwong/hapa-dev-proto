# Card Details: Attached Sub-Menu Redesign

## Context / Problem
Currently, clicking a Hand card can result in an overlay-spawn + portal animation that makes the card appear to "fly away" and disappear. This conflicts with the desired details workflow.

In the current implementation:
- Hand cards use `useGlobalDrag` which (previously) spawned an overlay `FloatingCard` immediately on `pointerdown`.
- `FloatingCard` interprets a short gesture (`dist < 5`) as a click and triggers its portal VFX + `removeItem(item.id)`.
- The existing details view for Hand cards (`HandCardView`) is a **top-right overlay panel** that sits detached from the card and uses a backdrop.

You want:
- Clicking a hand card should **not** cause it to fly away / disappear.
- Clicking a hand card should open a **compact, glass-plane sub-menu** that is **attached to the card** (another floating object), *not* a top-right overlay.
- The attached details panel should include explicit controls:
  - (a) Return to hand
  - (b) Return to library
  - (c) Change Y-axis tilt
  - (d) Change X-axis tilt
  - (e) Change Z-axis rotation
  - (f) Leave formation (if in formation)
  - (g) Enter formation (if not in formation)
  - (h) Camera view: toggle “targeting reticle” perspective + zoom in/out within the sub-menu

## Status of immediate fix (already implemented)
To stop the conflicting behavior *immediately*, `useGlobalDrag` has been updated so that overlay items are spawned only after a small drag threshold. A plain click now calls `onClick` directly without spawning an overlay.

This removes the "click to fly away" conflict for Hand cards (and avoids accidental overlay spawning in other places that use `useGlobalDrag`).

## Design Goals
- **Card stays in place**: no automatic transport/disappear on click.
- **Attached UI**: details panel is spatially linked to the card (feels like an instrument pod attached to that card).
- **Consistent aesthetic**: glass plane + neon edges + compact typography (match Formation HUD and existing card visual language).
- **No disruptive global overlay**: no full-screen backdrop; interactions should remain local.
- **Clear, explicit actions**: return targets + formation controls should be visible and unambiguous.
- **Extensible**: additional controls (camera reticle, advanced transforms) should fit naturally.

## Proposed UX
### Interaction model
- **Click on Hand card**: opens the attached Card Details panel for that specific card.
- **Click elsewhere / Esc**: closes the attached panel.
- **Dragging the Hand card**: behaves as before (drag threshold spawns overlay drag representation when appropriate).

### Visual layout
- Card remains in the Hand.
- A small “connector” / proximity relationship is implied:
  - The details panel appears to the immediate left of the Hand dock (or adjacent to the card slot), aligned to the clicked card.
  - The panel shares:
    - rounded corners
    - border glow
    - subtle scanline
    - compact neon typographic system

### Panel sections
1) **Header**
- Card name (truncate)
- Tier/state indicator
- Close button

2) **Quick actions**
- Return to Hand
- Return to Library

3) **Formation**
- If card is in overlay formation: “Leave formation”
- Else: “Enter formation”

4) **Pose / Transform controls**
- X tilt slider
- Y tilt slider
- Z rotation slider
- Per-card reset

5) **Camera / Reticle mode**
- Toggle: “Camera View”
- When enabled:
  - show a reticle indicator aligned to the card direction
  - provide zoom in/out controls

## Implementation Plan (Phased)

### Phase 0: Remove conflicting flyaway behavior (DONE)
- Change `useGlobalDrag` so overlay spawn happens only after drag threshold.

### Phase 1: Introduce attached panel (no new controls yet)
- Create a new component:
  - `src/components/cards/AttachedHandCardDetails.tsx`
- Replace `HandCardView` usage in `CardHand.tsx` with the attached panel.
  - Keep the **same data extraction** logic initially (skills/truths/desires) to avoid feature regression.
- Positioning strategy:
  - Measure the clicked card slot DOMRect (we already have `slotRefs` and `cardRefs`).
  - Render the panel using `createPortal(document.body)` so it’s not clipped.
  - Compute `left/top` next to the card slot (e.g. to the left of the Hand dock, vertically aligned).

### Phase 2: Wire “return” actions
- **Return to Hand**
  - If the card is currently in overlay (drag canvas), snap/remove overlay and ensure the hand thumbnail is visible.
  - If it is already in hand, no-op.
- **Return to Library**
  - Remove the card from hand (`HandContext.removeCard(cardId)`), with a small confirmation or immediate action.

### Phase 3: Enter/Leave formation
- Define what “in formation” means:
  - If the card exists as an overlay item in `DragCanvasContext.items`, it can be in formation.
  - If it’s only a hand slot card, it is not.
- Enter formation:
  - Spawn an overlay item for the selected card at a deterministic location near the Hand dock.
  - Set `overlayLayout.mode` to last used non-`free` (or default `fan`).
- Leave formation:
  - If that overlay item exists, remove it.

### Phase 4: Pose controls (tilt/rotation)
- Extend overlay item state to support per-item pose:
  - `rotX`, `rotY`, `rotZ` (or `tiltX`, `tiltY`, `rotZ`).
- Apply transforms in `FloatingCard` visual layer.
- Persist these values with overlay persistence.

### Phase 5: Camera/Reticle mode + zoom
- Add per-card camera mode state in the attached panel.
- Reticle:
  - render an overlay reticle at the projected “forward” direction of the card.
- Zoom:
  - apply temporary scale on the card visual (or move camera perspective in the 3D transform context).

## Data/State Model
- Hand selection state currently lives inside `CardHand` via `selectedCard`.
- Proposed:
  - Keep `selectedHandCardId` in `CardHand` and pass its DOMRect to the attached panel.
  - For overlay manipulation (formation/pose), use `DragCanvasContext` as the authority.

## Risks / Questions
- **Do you want details panel only for Hand cards, or also for Library cards and overlay cards?**
- **Return to Library**: should it remove from hand immediately or ask for confirmation?
- **Enter formation**: do you want the overlay card to be a “clone” while the hand card remains, or should the hand thumbnail hide while in overlay?
- **Pose controls**: should they apply only to overlay cards (recommended) or also visually tilt the hand thumbnails?
- **Camera view**: should zoom affect the card itself (scale) or the viewport perspective?

## Acceptance Criteria
- Clicking a hand card does **not** cause it to fly away or disappear.
- Clicking a hand card opens a compact attached details panel next to the card.
- The old top-right overlay details panel is removed/unused.
- Return to hand/library buttons behave deterministically.
- Formation enter/leave works and is clearly indicated.
- Tilt/rotation controls apply to the selected card and persist (overlay).
- Camera view shows a reticle and provides zoom controls.

## Rollout / Testing
- Manual checks:
  - Click vs drag threshold behavior
  - Open/close details panel (Esc/click outside)
  - No UI clipping near window edges
  - Return actions
  - Formation toggle
  - Pose adjustments + persistence
  - Camera/reticle toggle
