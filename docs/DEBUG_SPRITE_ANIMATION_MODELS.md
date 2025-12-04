# Debug Report: Sprite Animation Model Configuration Issue

## Issue Description
The user reported a `404 Not Found` error when attempting to generate a sprite animation. The error message indicated that the model `gemini-1.5-pro` (or `gemini-1.5-flash` in the previous attempt) was not found or supported for the `generateContent` method on API version `v1beta`.

The user explicitly stated that the system should use the "default LLM" and "default Image model" configured in the application, similar to other "one-click-create" features (likely referring to the generic Image Generation or Wormhole ingestion flows).

## Root Cause Analysis
1.  **Hardcoded Model Names**: The `CardWorkspace.tsx` component was hardcoding the model name for the prompt refinement step:
    *   Initially `gemini-1.5-flash`
    *   Then patched to `gemini-1.5-pro`
    *   Neither matched the user's configured or available environment, causing the 404.

2.  **Ignoring System Settings**: The application has a centralized configuration for these defaults in `AdminSettings` (persisted in `electron-store`). The `generate-image-for-card` handler in the main process correctly respects these settings:
    *   `defaultPromptLLM`: Used for refining prompts.
    *   `defaultImageModel`: Used for the actual image generation.
    
    However, the renderer-side logic in `CardWorkspace.tsx` was bypassing these settings and calling `chatWithGemini` with a hardcoded model.

## Fix Strategy
To align with the user's expectations and system architecture:

1.  **Fetch Admin Settings**: The `CardWorkspace` component must fetch the global `AdminSettings` via `window.electronAPI.getAdminSettings()`.
2.  **Use Configured Models**:
    *   For **Prompt Refinement**: Use `settings.imageGenSettings.defaultPromptLLM`.
    *   For **Image Generation**: Map the UI selection ("Cloud" vs "Local") to the appropriate provider (`'gemini'` or `'local-vision'`). The specific model used by the `'gemini'` provider is already handled by the backend using `defaultImageModel`.
3.  **Remove Hardcoding**: Eliminate any hardcoded model strings like `'gemini-1.5-pro'` from the component logic.

## Reference: Correct Model Configuration
For future reference, feature implementation should always defer to these settings:

*   **LLM for Prompts**: `adminSettings.imageGenSettings.defaultPromptLLM`
*   **Image Model (Cloud)**: `adminSettings.imageGenSettings.defaultImageModel`
*   **Image Model (Local)**: Configured via `LocalVisionSettings` (active model).

## Implementation Plan
1.  Modify `CardWorkspace.tsx` to load `adminSettings`.
2.  Update `handleGenerateAnimation` to use the loaded `defaultPromptLLM`.
3.  Ensure `SpriteAnimationGenerator` passes the correct provider string (`'gemini'` or `'local-vision'`) instead of arbitrary model names like `'nano-banana'`, relying on the backend to pick the specific model based on settings.
