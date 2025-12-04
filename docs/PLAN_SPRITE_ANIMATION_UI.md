# Sprite Animation Workflow Plan

## Goal
Enhance the Sprite Animation generation workflow to provide immediate feedback and a seamless "continuation" process, similar to the standard Image Generation workflow.

## Current Issues
1.  Upon successful generation, the generator panel closes immediately.
2.  The user cannot see the generated sprite sheet without navigating away or finding it in the library.
3.  There is no easy way to "chain" animations (e.g., generate Walk, then generate Attack) using the same context.
4.  UI feedback is limited to a spinner.

## Proposed Changes

### 1. `SpriteAnimationGenerator.tsx` (Component)
*   **Props Update**: Add `lastResult` prop containing `{ imageUrl, cardId, prompt }`.
*   **UI State - Result View**:
    *   If `lastResult` is present, split the view or show a "Result" overlay/section.
    *   Display the generated Sprite Sheet image (large preview).
    *   **Actions**:
        *   `Create Another` (Reset prompt, keep Seed context).
        *   `Use as Context` (Set this new image as the "Seed" for the next generation? - *Optional for now, user asked for "previous context" which usually means the Seed Card*).
        *   `Done` (Close generator).
*   **Loading State**: Improve the "Generating..." button state (already exists, but ensure it's robust).

### 2. `CardWorkspace.tsx` (Container)
*   **State Management**:
    *   Add `lastAnimationResult` state: `{ imageUrl: string, cardId: string, prompt: string } | null`.
*   **Logic Update (`handleGenerateAnimation`)**:
    *   On success:
        *   Construct the result object (using the base64 data or local path).
        *   `setLastAnimationResult(result)`.
        *   **REMOVE**: `setShowAnimationGenerator(false)` (Keep it open).
        *   `setIsGenerating(false)` (in the child component via prop or callback? The child handles its own loading state, but `CardWorkspace` controls the "Converting" overlay. We should sync them).
    *   On error:
        *   Show error toast/alert.
        *   Keep generator open.

### 3. UI/UX Details
*   **Success Message**: Show a success banner or checkmark when generation completes.
*   **Preview**: The generated image should be clickable (open in 3D viewer or large preview).
*   **Lineage**: Since the backend updates the P2P records, the "children" list on the main card *should* update. We need to ensure `CardWorkspace` refreshes its data. The `onUpdate` callback triggers a reload in `CardLibrary`, but `CardWorkspace` might need to refetch its own "children" list if it displays them. *Note: CardWorkspace currently doesn't seem to display a children list, just the main content.*

## Implementation Steps
1.  Modify `SpriteAnimationGenerator.tsx` to accept `lastResult` and render the success view.
2.  Modify `CardWorkspace.tsx` to manage `lastAnimationResult` and pass it down.
3.  Update `handleGenerateAnimation` to populate the result instead of closing.
