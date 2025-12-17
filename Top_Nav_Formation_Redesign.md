# Top Nav + Formation System Redesign (Design Doc)

## 1. Summary
This doc proposes a holistic redesign of:
- The **top “Formation HUD”** (the compact top nav shown in the screenshot: HOVER/FREE/FAN/LINE/STACK/ARC/RING + selection readout)
- The **overlay formation engine** that positions overlay cards (currently drifting up/left, not centered, and intermittently working)

Goals:
- Make formations **deterministic**, **centered**, and **resize-safe**.
- Make the HUD **more compact**, **more informative**, and **more “future space-age”**, with a **transparent glass plane** aesthetic.
- Preserve speed/feel: instant formation changes, crisp feedback, minimal UI clutter.

Non-goals:
- Replacing the entire overlay card system.
- Reworking unrelated pages.

---

## 2. Current Implementation (as of now)
### 2.1 Code locations
- `src/components/DragCanvas.tsx`
  - Renders the top HUD.
  - Computes `formationTarget` for each item in a `useMemo` based on:
    - `window.innerWidth`
    - `snapZones` (hand dock)
    - each item’s `initialRect` (left/top/width/height)
  - Passes `{tx, ty, tz, rotZ}` to `FloatingCard`.

- `src/contexts/DragCanvasContext.tsx`
  - Stores overlay items and persisted state in localStorage.
  - Stores `overlayLayout` (mode/hover/portal target/color).

- `src/components/cards/FloatingCard.tsx`
  - Applies `formationTarget` by animating `translateX/translateY` on a “position” wrapper and `translateZ/rotate/scale` on a “visual” wrapper.

### 2.2 How formation targets are computed today
For each item:
- Compute an anchor (`anchorX`, `anchorY`) using hand dock snap zone center or viewport center.
- Compute a desired *target center* based on formation mode.
- Convert to a *target top-left* by subtracting `w/2` and `h/2`.
- Convert to translation via:
  - `tx = targetLeft - item.initialRect.left`
  - `ty = targetTop - item.initialRect.top`

This means the formation system assumes:
- Every item has a **correct and stable** `initialRect`.
- `initialRect.left/top` corresponds to current viewport coordinates.

---

## 3. Problems Observed
### 3.1 “Formation goes up and to left / not centered”
Likely causes (based on current math):
- **Stale `initialRect`**:
  - Persisted items restore `initialRect` from localStorage, which may not match current viewport after window resize/scale.
  - `initialRect` is never recomputed after mount/resizes.
- **Items with undefined or invalid rect**:
  - If an item is spawned before its DOM rect is known or if saved rect is partially invalid, the translation math will be biased.
- **Anchor inconsistencies**:
  - Anchor uses hand dock snap zone when available, otherwise `window.innerWidth * 0.5` and hard-coded vertical offsets.
  - When the dock zone is registered late or changes size, anchor changes but `initialRect` does not.

### 3.2 “Only sometimes working”
Likely causes:
- **Snap zones and layout timing**:
  - Formation computations depend on `snapZones` being present.
  - On initial render, snap zones may not be registered yet.
- **Hydration race**:
  - Items restored from localStorage have rects that may not align with current layout.
  - If formation is activated before first render/measurement stabilizes, it can look broken.

### 3.3 UX / HUD issues
- The HUD is functional but:
  - It’s wider than it needs to be.
  - It lacks clear “system” grouping (formation vs portal vs selection/tools).
  - It doesn’t communicate *why* a formation is anchored where it is.
  - It doesn’t offer quick “recenter” or “calibrate” actions.

---

## 4. Design Goals & Principles
### 4.1 Formation engine
- **Deterministic**: same inputs → same layout.
- **Centered**: formation center aligns to a well-defined anchor point.
- **Resize-safe**: resizing window does not drift/offset items.
- **Composable**: easy to add future modes (spiral, grid, orbit, etc.).
- **Smooth but truthful**: animations shouldn’t mask wrong math.

### 4.2 HUD
- **Compact**: fits like a thin “instrument strip”.
- **Glass plane**: translucent + blurred + subtle glow.
- **Informative**: gives high-signal status (mode, anchor, selection, card count).
- **Fast**: one-click toggles; advanced controls tucked away.

---

## 5. Proposed UX Redesign: “Formation HUD v2”

### 5.1 Layout (one-line, three clusters)
A single glass bar centered at top, with three clusters:

1) **Formation cluster** (left)
- `HOVER` toggle
- Formation segmented control:
  - `FREE | FAN | LINE | STACK | ARC | RING`
- Optional mini hint under hover: keyboard row `0–5`

2) **Portal theme cluster** (middle)
- `COLOR:` tiny two-state pill `BLUE/RED`

3) **Telemetry / Tools cluster** (right)
- `N:` card count
- `SEL:` short id (or `none`)
- `Z:` current z offset
- Tool buttons:
  - `RECENTER` (forces anchor recompute and formation re-layout)
  - `CLEAR SEL`

### 5.2 Visual language
- Glass plane:
  - `bg-gray-950/55` + `backdrop-blur-md` + subtle border `cyan/10`.
- State color coding:
  - Formation active: cyan/blue highlight.
  - Portal theme: cyan/purple for blue, red/amber for red.
- Micro typography:
  - uppercase condensed feel; keep labels 9–10px.

### 5.3 Interaction rules
- Formation mode changes should:
  - **not** break dragging
  - be reversible instantly
- `FREE` mode means: cards stay where user placed them (tx/ty persisted).
- Any non-free mode means: cards are “magnetized” to a formation.
- `RECENTER`:
  - recalculates anchor and re-applies formation targets.
  - also updates measurement cache.

---

## 6. Proposed Technical Redesign: Formation Engine v2

### 6.1 Key change: stop using `initialRect.left/top` as the conversion origin
Instead of calculating `tx/ty` relative to persisted `initialRect.left/top`, we introduce a **stable per-item origin**:

- Each `FloatingCard` measures its own **baseRect** on mount via `getBoundingClientRect()`.
- It reports this to context (or a central layout cache) as the item’s `baseRect`.
- The formation engine computes a target absolute position (`targetLeft`, `targetTop`) in viewport coordinates.
- The final translation is:
  - `tx = targetLeft - baseRect.left`
  - `ty = targetTop - baseRect.top`

This makes translation robust across:
- persisted sessions
- resizes
- DPI scaling changes

### 6.2 Measurement strategy
- Add a `ResizeObserver` (or `window.resize` listener + per-item measure) to refresh base rects when:
  - window resizes
  - HUD height changes
  - snap zones change

If we want minimal work:
- Use `window.addEventListener('resize', ...)` and recompute base rects for visible items.

### 6.3 Anchor definition (formation only)
For this redesign arc we intentionally remove the portal anchor/target UX (it is confusing/clunky right now).

Formation anchor should be derived automatically (not user-pickable):
- Prefer hand dock snap zone center if present.
- Otherwise use viewport center.

Then define a formation-specific offset:
- Formation band should not overlap the HUD.
- Use `anchorYForFormation = clamp( HUD_BOTTOM + margin, anchorY - formationRise )`.

### 6.4 Deterministic ordering
Ensure consistent ordering by:
- Stable sort items by spawn time (or by persisted order)
- Do not depend on object iteration order.

### 6.5 “Intermittent” protection
- If base rects are missing for some items, formation application waits one frame.
- Add a simple “layout readiness” guard: `allMeasured === true`.

---

## 7. Implementation Plan

### 7.1 Formation engine refactor
- Add a `measuredRectsById` map (context or `DragCanvas` local state).
- In `FloatingCard`, on mount + on resize:
  - measure `dragRef.getBoundingClientRect()` and report it.
- In `DragCanvas`, compute `targets` using `measuredRectsById` rather than `item.initialRect.left/top`.
- Add `RECENTER` action to:
  - force recompute + optionally re-measure.

### 7.2 HUD redesign
- Extract HUD into a dedicated component:
  - `src/components/overlay/FormationHud.tsx` (or similar)
- Keep it visually compact, glass plane.
- Add grouping + tooltips.

### 7.3 QA / Verification checklist
- Formation center stays stable when:
  - resizing window
  - toggling sidebar
  - switching pages
  - restoring session
- Formations do not drift up-left.
- Formations apply reliably every time.
- Dragging still works; FREE mode preserves manual placement.

---

## 8. Acceptance Criteria
- Switching to `FAN/LINE/STACK/ARC/RING` places cards in a centered formation around the current formation anchor (auto-derived).
- Formation remains centered after window resize.
- No “sometimes it works” behavior on fresh launch.
- HUD is more compact than current, retains glass aesthetic, and communicates:
  - mode
  - portal color
  - selection + z
  - card count

---

## 9. Open Questions for You
1) When in formation mode, should dragging a card temporarily “break it out” (FREE for that card) or should it spring back into formation on release?
