# Design Doc: The Neural Artifact Inspector (Card Inspector Redesign)

**Objective:** Transform the functional "Card Inspector" into an immersive, futuristic "Neural Artifact Inspector" that aligns with an RPG/Sci-Fi control node aesthetic.

**Core Philosophy:**
The user isn't just "viewing a record"; they are **analyzing a captured memory** in the Hapa Neural Network. The UI should feel like a high-tech diagnostic tool used by a frantic operator (CJ/Leo) to inspect stability and attributes.

---

## 1. Visual Language & Aesthetics

*   **Theme:** "Cyber-Arcane Interface"
*   **Palette:**
    *   *Void:* `#050510` (Deep background)
    *   *Structure:* `#0f172a` (Panels)
    *   *Data:* `#00f0ff` (Cyan - Information)
    *   *Exotic:* `#a855f7` (Purple - Magic/Lore)
    *   *Warning:* `#f59e0b` (Amber - Sets/Alerts)
*   **Shapes:**
    *   45-degree chamfered corners (no soft rounded rectangles).
    *   Thin 1px borders with glowing segments.
    *   "Tech-lines" (decorative SVG paths connecting elements).
*   **Typography:**
    *   Headers: Uppercase, tracking-widest, bold.
    *   Data: Monospace, small, dim (opacity 0.7).

## 2. Component Redesign

### A. The Container (The "Deck")
*   **Current:** Slide-over panel.
*   **New:** A floating "Diagnostic Slate" that slides in but has a distinct physical presence (drop shadows, glowing border).
*   **Background:** Animated subtle grid or "digital noise" texture opacity 0.05.

### B. The Holo-Projector (Image View)
*   **Concept:** The image is being "projected" by the system.
*   **Effect:**
    *   CRT Scanline overlay (opacity 0.1).
    *   Corner brackets (targeting reticle style).
    *   On load: "Glitch" or "Materialize" effect.
    *   Hover: "Active Scan" (a horizontal line moving up and down).
*   **Video Integration:** Re-use the "Gacha" reveal and video overlay logic I just built, but style the video container to look like a screen.

### C. Data Matrices (Stats)
*   **Concept:** Power readings.
*   **Visual:**
    *   Bars should have "segments" or tick marks.
    *   "Charging" animation on load (0% -> Value).
    *   Numeric value displayed in a digital font counter.

### D. The Lore Terminal
*   **Concept:** Decoded text.
*   **Visual:**
    *   Darker background inset.
    *   Typing effect (fast) for the description/lore? (Maybe too annoying? Let's stick to a "Decode" fade-in).
    *   Blinking cursor at the end.

## 3. Layout Strategy

**Header:**
*   Title: "ARTIFACT ANALYSIS // [ID]"
*   Actions: Compact, icon-only buttons with tooltips.

**Body (2-Column Grid):**
*   **Left (Visuals):** Holo-Projector + Evolution State Pipeline (Circuit board style).
*   **Right (Data):** Name (Editable), Type, Stats (Matrix), Skills/Lore (Terminal).

## 4. Animation & FX Plan
1.  **Entry Sequence:**
    *   Panel slides in.
    *   Grid background fades in.
    *   Image "snaps" on (scale 0.9 -> 1.0 + flash).
    *   Stats bars fill up.
    *   Text staggers in.
2.  **Interactive:**
    *   Buttons glow/fill on hover.
    *   Inputs look like command lines (`> _`).

---

## 5. Execution Plan

1.  **Refactor Structure:**
    *   Isolate the Inspector into a sub-component (`src/components/CardInspector.tsx`) if possible, or keep in `CardLibrary.tsx` but organized.
    *   *Decision:* Keep in `CardLibrary.tsx` to avoid prop drilling hell for now, but rewrite the rendering block completely.

2.  **Implementation Steps:**
    *   **Step 1:** Build the new "Shell" (Container, Grid background, Header).
    *   **Step 2:** Build the "Holo-Projector" (Image, Scanlines, Video Overlay).
    *   **Step 3:** Build the "Data Matrix" (Stats with animation).
    *   **Step 4:** Build the "Terminal" (Lore/Skills).
    *   **Step 5:** Polish (Animations, Glitch effects).

3.  **Dependencies:**
    *   Tailwind `animate-*` classes.
    *   `rux-icon`.
    *   Standard CSS for scanlines/grids.

## 6. Review Notes
*   *Performance:* Ensure heavy animations don't lag the slide-in. Use `will-change`.
*   *Clarity:* Don't sacrifice readability for "cool". Text must be legible. High contrast.

