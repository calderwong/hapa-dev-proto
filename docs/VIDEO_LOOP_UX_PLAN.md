# Video Loop UX Enhancement Plan

**Objective:** enhance the `CardDetails` (peruse view) to support immediate video playback on hover after generation, with a "Gacha-style" reveal animation.

## 1. User Experience
1.  **Generation:** User clicks "Generate Video Loop".
2.  **Waiting:** Loading spinner (existing).
3.  **Reveal:** When complete:
    *   "Gacha" reveal animation plays (flash, particles, sound effect placeholder).
    *   "Video Generated!" success state.
4.  **Interaction:** User hovers over the card image.
    *   Video overlays the image and plays automatically.
    *   Mouse leave pauses/hides the video.

## 2. Technical Implementation

### A. State Management (`CardDetails.tsx`)
*   Add `generatedVideoPath` state (string | null).
*   Add `showReveal` state (boolean) for the animation.

### B. Logic Update
*   Modify `handleGenerateVideo` to capture the return value of `createLoopVideoForImage`.
*   Extract `videoPath` from the response.
*   Set `generatedVideoPath` (prefixed with `file://`).
*   Trigger `showReveal(true)` -> `setTimeout` -> `showReveal(false)`.

### C. UI Components
1.  **Video Overlay:**
    *   Placed inside the image container (absolute position).
    *   `video` tag with `src={generatedVideoPath}`.
    *   Classes: `absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500`.
    *   Attributes: `muted`, `loop`, `playsInline`.
    *   Event handlers: `onMouseEnter` (play), `onMouseLeave` (pause/reset).

2.  **Reveal Animation (The "Gacha" Effect):**
    *   Overlay container with high z-index.
    *   CSS animations for:
        *   `animate-ping` or custom scale/flash.
        *   "VIDEO UNLOCKED" text with glow.
        *   Particle effects (CSS only for now).

3.  **Sound Effect:**
    *   Add a simple `Audio` object or placeholder function `playRevealSound()`.
    *   Since we don't have a sound file, I'll use a silent placeholder or checking if a standard asset exists. *Decision: I will implement the function but leave the src empty/commented for the user to fill, or use a data URI if I can find a short beep.*

## 3. Execution Steps
1.  Create `docs/VIDEO_LOOP_UX_PLAN.md` (This file).
2.  Modify `src/components/CardDetails.tsx`.
3.  Test (User verification).
4.  Dollhouse Log Entry.
