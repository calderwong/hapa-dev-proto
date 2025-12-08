# Drag System V2: The Clone Strategy

## Problem
The previous "position: fixed" strategy on the original element is fragile because:
1. **Stacking Contexts**: If any parent has `transform`, `filter`, or `perspective`, `position: fixed` becomes relative to that parent, not the viewport. `CardHand` uses `backdrop-blur` (filter) and scale transforms.
2. **Layout Shift**: removing the element from flow causes siblings to jump (unless we placeholder it, which we didn't).
3. **Ghosting**: HTML5 drag might still be fighting us.

## The Solution: Clone & Portal
We will implement a standard "Lift & Clone" approach.

### 1. The Hook (`useDraggableCards`)
**On Pointer Down:**
1.  Call `preventDefault()` & `stopPropagation()`.
2.  Create a **Clone** of the target element.
3.  Style the Clone:
    *   `position: fixed`
    *   `z-index: 99999`
    *   `top/left`: Match original element's screen coordinates.
    *   `pointer-events: none` (so mouse events pass through to document for tracking).
    *   Append to `document.body`.
4.  Style the **Original**:
    *   `opacity: 0` (Invisible but takes up space).
    *   `pointer-events: none`? No, maybe keep it to maintain flow.
5.  Start tracking `pointermove` on `document`.

**On Pointer Move:**
1.  Update Clone's `transform` to follow mouse.
2.  Perform **Collision Detection** with registered Drop Zones.
    *   Fire `onDragEnter` / `onDragLeave` callbacks.

**On Pointer Up:**
1.  Check Drop Zone.
2.  **Animate Clone** to drop target (or back to original).
3.  On animation complete:
    *   Remove Clone.
    *   Restore Original `opacity: 1`.
    *   Trigger `onDrop` action.

### 2. The Components
**`CardHand.tsx`**:
- Registers as a Drop Zone via the hook (or we pass the state up).
- Updates `isDragOver` state based on hook callbacks.

## Why this fixes it
- **No Ghost**: We explicitly create our own "ghost" (the clone) and hide the original. HTML5 drag never starts because we prevent it.
- **No Clipping**: Clone is at `body` level, above everything.
- **No Layout Jumps**: Original element stays in flow (just invisible).

## Implementation Details
We will modify `useDraggableCards` to handle this logic.
We need to handle the `onDragStart` event on the original element to kill native drag definitively.
