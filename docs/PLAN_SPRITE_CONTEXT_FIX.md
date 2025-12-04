# Sprite Animation Fix Plan

## Issues
1.  **Lost Context / Hardcoded Hallucination**: The generated animation features a "Seedling Knight" instead of the user's "Orange Cat". This suggests the LLM is not receiving the visual context of the seed card, or is receiving a generic title ("Animation Seed") which causes it to hallucinate a default character.
2.  **Missing Child Links**: Generated cards are not appearing as children of the original card, meaning the P2P update logic for linking might be failing or the UI isn't refreshing to show them.

## Analysis Steps
1.  **Analyze `electron/main.ts`**:
    *   Check `generateImageForCard` implementation.
    *   Does it support **multimodal input** (passing the seed image to Gemini along with the prompt)?
    *   If not, we are doing Text-to-Image based solely on the title/text, which explains why "Untitled Card" (or "Animation Seed") results in a random/hallucinated character.
    *   We must ensure the seed image is passed to `generateContent` if available.

2.  **Analyze `CardWorkspace.tsx`**:
    *   Check how `generateImageForCard` is called.
    *   Are we passing the image data?
    *   Check the `p2pAppend` logic for updating the parent card.
    *   Verify if `parentId` and `children` array are being written correctly.

## Proposed Fixes

### 1. Fix Context (Multimodal Prompting)
*   **In `CardWorkspace.tsx`**: Pass the seed image path or base64 data to `generateImageForCard`.
*   **In `electron/main.ts`**: Update `generateImageForCard` to accept an input image.
    *   If an input image is provided, read it and include it in the `parts` array sent to Gemini (`inlineData`).
    *   This changes the request from Text-to-Image (via prompt crafting) to **Image-to-Text-to-Image** (Prompt Crafting with visual context) OR **Image-to-Image**?
    *   Actually, for *Prompt Crafting*, we want Gemini to SEE the cat and describe it ("A pixel art sprite sheet of an orange tabby cat...").
    *   So the **LLM Step** in `generateImageForCard` must be multimodal.
    *   And then the **Image Gen Step**? The user says "use the cat as the character".
    *   If we just get a text description ("Orange Cat"), the new image will be *an* orange cat, but not necessarily *the* orange cat (consistency issue).
    *   Ideally, we want **Image-to-Image** generation (sending the seed image to the image model).
    *   Does the configured Image Model support img2img?
    *   If not, a detailed description from the Multimodal LLM is the best fallback.

### 2. Fix Child Linking
*   Ensure `p2pAppend` is awaiting correctly.
*   Verify the structure of the `children` array matches what `CardLibrary` expects.
*   The user mentioned "Card Inspector" in the screenshot. We might need to update the `children` field in a way that UI recognizes.

## Plan
1.  **Check `main.ts`** to see if `generateImageForCard` handles input images for the LLM context.
2.  **Modify `main.ts`** to support Multimodal Prompt Crafting (sending the seed image to the LLM to get a description).
3.  **Modify `CardWorkspace.tsx`** to pass the `localPath` or `imageUrl` of the seed card to `generateImageForCard`.
4.  **Review P2P Logic**: Check why the child link isn't persisting.
