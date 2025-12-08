# Drag System Debug Plan & Resolution

## Problem Analysis
The user reports "ghost card" behavior despite implementing a custom pointer-based drag system. This indicates the **Native HTML5 Drag & Drop API** is still activating, superseding our custom pointer logic.

### Symptoms
- Translucent "ghost" copy of the element appears during drag.
- Custom Anime.js animations (scale, rotation, glow) are likely not triggering or are hidden behind the ghost.
- Indicates `pointerdown` is either:
    1. Not preventing default behavior effectively.
    2. Not firing before the browser decides to start a native drag.
    3. Being ignored due to conflict with existing drag handlers.

## Root Cause Hypotheses

1.  **Image Dragging Persistence**: The card contains an `<img>`. Browsers natively allow dragging images. Even with `draggable={false}` on the img tag, it might be propagating or behaving unexpectedly if the parent `div` doesn't explicitly block `dragstart`.
2.  **Event Listener Race/Binding**: The `pointerdown` listener is attached via `useEffect` (imperatively). React's synthetic events or other props might be interfering.
3.  **Missing Global Blockers**: We are relying on `e.preventDefault()` in `pointerdown` to stop native drag. Some browsers require explicitly cancelling the `dragstart` event.
4.  **CSS `user-select` Failure**: If text/content is selectable, the browser might interpret the drag as a selection or native drag.

## Resolution Plan

### 1. Hard Kill Native Drag
We will add an explicit `dragstart` listener that unconditionally calls `preventDefault()` and returns `false`. This is the nuclear option for native drag.

### 2. Move Event Handlers to JSX (React Way)
Instead of attaching listeners in `useEffect` (which is brittle and disconnects the React data flow), we will pass the handlers directly to the `div` in `CardHand.tsx`.
- `onPointerDown={handlePointerDown}`
- `onDragStart={(e) => e.preventDefault()}` <- CRITICAL

### 3. Refactor Hook to `useDraggableCard`
Simplify the hook to return the *props* needed for the card, rather than imperatively binding them.
```typescript
const { dragProps, isDragging } = useDraggableCard(cardId, { ...config });
// ...
<div {...dragProps}>
```
This ensures React is aware of the handlers and they are properly bound in the render cycle.

### 4. Verify CSS
Ensure `touch-action: none` is inline or reliably applied to prevent scroll/zoom interference on touch devices (which triggers native behaviors).

## Execution Steps

1.  **Refactor `useAnime.ts`**: Change `useDraggableCards` to expose a single-card logic or a prop-getter. actually, since we have a list, a hook that returns a map of handlers or a single handler we can call is better.
    *   *Decision*: Let's keep the global document listeners for `move`/`up` in the hook (for window-level tracking), but move the `down` handler to be returned by the hook so we can attach it in JSX.

2.  **Update `CardHand.tsx`**:
    *   Attach `onDragStart={(e) => e.preventDefault()}` to the card wrapper.
    *   Attach the `onPointerDown` from our hook.
    *   Remove manual `addEventListener` logic from the hook.

3.  **Test**: This should result in:
    *   Native drag IMPOSSIBLE (due to `onDragStart` block).
    *   Pointer events capturing completely.

## Future Prevention
- Never mix imperative DOM listeners with React unless absolutely necessary.
- Always explicitly block `dragstart` when implementing custom drag on elements that might be interpreted as draggable (images, links, selected text).
