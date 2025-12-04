# Sprite Sheet Background Removal Research & Plan

## Problem Statement
The user is trying to create a transparent animated GIF from a sprite sheet. The sprite sheet has a solid green background (chroma key style). The current "Remove Background" feature uses a general-purpose AI model (`@imgly/background-removal`) which is too aggressive and removes parts of the character or fails to correctly identify the solid background on a grid of sprites.

## Analysis
- **Current Approach:** AI Segmentation. Good for photos, bad for pixel art/sprites with solid backgrounds.
- **Desired Approach:** Chroma Key (Color Keying). Remove a specific color (e.g., green #00FF00) within a tolerance range.

## Solution Strategy: Chroma Key Implementation

### Algorithm
1.  **Input:** Source Image (Canvas/ImageData), Target Color (RGB), Tolerance.
2.  **Process:**
    - Iterate through every pixel `(r, g, b, a)`.
    - Calculate distance between pixel color and Target Color (Euclidean distance or simple difference).
    - If distance < Tolerance, set `a = 0` (Transparent).
    - Else, keep pixel as is.
3.  **Output:** Processed Image (transparent).

### UI Changes (`SpriteSheetConverter.tsx`)
1.  **Removal Method Selector:**
    - Option A: "AI Model" (Existing)
    - Option B: "Color Key" (New) - Default for sprites? Or distinct toggle?
2.  **Color Key Controls:**
    - **Color Picker:** To select the background color.
    - **Auto-Detect Button:** Sample the top-left pixel (0,0) as the background color (common convention).
    - **Tolerance Slider:** 0-100 range to handle compression artifacts or slight color variations.

## Implementation Plan

1.  **Create Utility Function:**
    - File: `src/utils/imageProcessing.ts` (New file)
    - Function: `applyChromaKey(image: HTMLImageElement, color: {r,g,b}, tolerance: number): Promise<HTMLImageElement>`

2.  **Update `SpriteSheetConverter.tsx`:**
    - Add state for `removalMode` ('ai' | 'chroma').
    - Add state for `keyColor` (default green or auto).
    - Add state for `tolerance` (default ~10-20).
    - Add UI controls under the "Transparency" section.
    - Update `handleRemoveBackground` to route to the correct logic.
    - **Real-time Preview:** For chroma key, since it's fast (unlike AI), we can potentially update the preview live as the slider moves, or at least faster than the AI loading bar.

3.  **Verify:**
    - Test with the user's green-screen sprite sheet assumption.

## Detailed Steps
1.  Create `src/utils/imageProcessing.ts` with `chromaKey` logic.
2.  Modify `src/components/SpriteSheetConverter.tsx` to integrate the new mode.
3.  Refine the "Remove Background" UI to be a collapsible section or more structured options panel.
