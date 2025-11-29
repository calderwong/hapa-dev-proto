# Wormhole Redesign Plan: "The Data Forge"

## Objective
Transform the Wormhole ingestion interface into a "cool", futuristic, and highly functional "Data Forge" using Astro UXDS principles. The goal is to make data ingestion feel like a sci-fi operation—uploading data into a sovereign memory core.

## Design Concept: "Cyber-Industrial Data Forge"
*   **Aesthetic**: Dark, sleek, "Heads-Up Display" (HUD) feel.
*   **Palette**: Deep space blues/grays (backgrounds), Neon Emerald (success/active), Cyan (processing), Purple (archives).
*   **Typography**: Monospace for data IDs, clean sans-serif for labels.

## Layout Strategy
The page will be divided into three main zones:

1.  **The Control Deck (Top)**:
    *   **Model Overrides**: A compact, horizontal "control bar" for setting AI models. Styled like a configuration panel on a spaceship.
    *   **Status Indicator**: A visual "System Status" display.

2.  **The Ingest Core (Middle - Split View)**:
    *   **Left: The Drop Zone (Portal)**: A large, animated area for file dropping. It should pulse when idle and glow when dragging.
    *   **Right: The Manifest (Form)**: A clean, structured form for metadata (DID, Tags, URL).

3.  **The Stream (Bottom)**:
    *   **Live Feed**: A list of recent ingests presented as "Data Cards" or a "Log Stream".
    *   **Action Hub**: Quick actions (Summarize, Transcribe) directly on the cards.

## Component Selection (Astro UXDS)
*   **Containers**: `rux-card` with custom CSS for glassmorphism/transparency.
*   **Inputs**: `rux-input`, `rux-select`, `rux-checkbox`.
*   **Buttons**: `rux-button` (Secondary for actions, Primary for "Ingest").
*   **Status**: `rux-status` for item states.
*   **Icons**: `rux-icon` for visual cues (upload, settings, memory).

## "Cool" Features & Animations
*   **Pulsing Drop Zone**: CSS animation for the border/background of the drop area.
*   **Neon Glows**: Subtle box-shadows on active elements.
*   **Transition Effects**: Smooth entry for new items in the stream.

## Implementation Steps
1.  **Refactor `WormholeAstro.tsx`**:
    *   Update layout structure to use CSS Grid/Flexbox for the "Deck" layout.
    *   Implement the "Control Bar" for model overrides.
    *   Create the "Portal" drop zone with custom CSS.
2.  **Enhance Visuals**:
    *   Apply Tailwind classes for colors and spacing.
    *   Add custom CSS for animations (in a `<style>` block or `index.css`).
3.  **Polish Interactions**:
    *   Ensure hover states are responsive.
    *   Add feedback for "Ingesting..." state (e.g., a progress bar or spinner).

## Technical Considerations
*   Keep existing logic for `electronAPI` calls.
*   Ensure types are correctly defined (or suppressed if necessary for speed, but preferably defined).
*   Maintain compatibility with the existing `WormholeIngestDisplayItem` interface.
