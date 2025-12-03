# Hapa's Forge & System Hardening Plan

## 1. Contextual Intelligence Validation
**Hypothesis:** The "Soul Forge" LLM prompt is receiving empty or shallow data because `cardRecord` properties might be missing or structure varies (e.g., `text` vs `content` vs `description`).
**Validation:**
- Add debug logging to `formatStack` to see exactly what string is being generated for the prompt.
- Inspect the `inventory` state to see what `cardRecord` actually contains for the cards being dragged.
**Hardening:**
- Improve `formatStack` to aggressively hunt for context: check `text`, `content`, `description`, `tags`, `extractedText` (OCR), and even `name`.
- If a card is an image without text, pass "Image: [filename] - [tags]" to give the model *something*.

## 2. UI/UX Modernization (ASTROS)
**Goal:** Eliminate native OS alerts (`alert()`) and replace them with an immersive, sci-fi notification system.
**Plan:**
- **Create `ToastContext`**: Global state management for notifications.
- **Create `Toast` Component**: Dark, glass-morphism, glowing borders (Cyan/Blue for Info, Red for Error, Green for Success).
- **Animation**: Slide-in from top-right or bottom-center, highly animated.
- **Integration**: Wrap `App.tsx` and replace all `alert()` calls in `Forge.tsx` (and eventually globally) with `toast.show()`.

## 3. Video Manifestation State Persistence
**Hypothesis:**
- The video is generated successfully (file exists), but the React state `generatedVisualUrl` might be getting lost or failing to render due to `file://` URL quirks or React re-renders.
- The "duplicate" prevention mentioned by the user implies they want the "Manifest" button to reflect "Done" state clearly or update the Avatar object itself so the video persists even if they navigate away (though Forge clears on exit currently).
**Validation:**
- Check if `setGeneratedVisualUrl` actually updates the render.
- Verify the video path formatting.
**Hardening:**
- When video is generated, update the local `forgedAvatar` state object to include the video path immediately, not just separate state variables.
- Ensure the video player has an `onError` handler to fallback gracefully (or show an error toast) rather than breaking the layout.
- Add a "Regenerate" option (small icon) in case they *do* want to retry, but default to showing the video.

## 4. Execution Steps
1.  **Scaffold Toast System**: Create `src/context/ToastContext.tsx` and `src/components/ui/Toast.tsx`.
2.  **Integrate Toast**: Update `App.tsx`.
3.  **Update Forge.tsx**:
    -   Inject `useToast`.
    -   Replace alerts.
    -   Enhance `formatStack` to be context-rich.
    -   Refactor `handleManifestAppearance` to update a `video` property on `forgedAvatar` directly, ensuring state consistency.
    -   Add logging to prompt construction.
