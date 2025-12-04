# Debug Report: Sprite Animation Image Failure

## Issue Description
The user reports that the LLM prompt refinement step succeeds (logs show "Chat with Gemini requested... Received response"), but the process fails during the subsequent **Image Generation** step. The error dialog "Failed to generate animation" appears.

The terminal logs provided in the screenshot show the successful chat completion but DO NOT show the specific error from `generate-image-for-card`. The previous Llama error was suppressed, so the console is cleaner, but now we lack visibility into the *actual* crash.

## Updated Analysis (Dec 3)
The user confirmed that the **Image Generation** step is failing, while the LLM step succeeds. They also noted that the **Card Library** image generation feature works correctly using the same `generateImageForCard` pipeline.

This implies:
1.  The `generateImageForCard` function itself is functional (correct API keys, valid default models).
2.  The **inputs** provided by `CardWorkspace` (Sprite Animation) are likely causing the failure.
3.  The current implementation performs "Double Refinement":
    *   Renderer: Refines "idle" -> "Pixel art sprite sheet..."
    *   Main: Takes "Pixel art sprite sheet..." -> Refines AGAIN -> Image Gen.
    
    This redundancy might be introducing artifacts (e.g., markdown formatting, quotes, or confusing the second LLM) or simply over-complicating the context.
    
4.  **Hypothesis**: The failure is caused by the input `text` passed to `generateImageForCard`. By aligning the `CardWorkspace` flow to match `CardLibrary` (Single Pass), we can rely on the proven `generateImageForCard` logic.

## Fix Strategy
Refactor `CardWorkspace.tsx` to:
1.  **Remove** the renderer-side `chatWithGemini` call.
2.  **Construct** the context text by prepending the specific Sprite Animation requirements to the user's input.
    *   e.g. `text: "REQUIREMENT: Create a pixel-art sprite sheet animation (grid layout) on a white background. \n\nUSER REQUEST: ${prompt}"`
3.  **Call** `generateImageForCard` directly with this text.

This makes the pipeline identical to `CardLibrary`: Raw Text Context -> `generateImageForCard` (LLM Refinement -> Image Gen).
