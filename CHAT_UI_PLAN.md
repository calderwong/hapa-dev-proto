---
description: Design and implementation plan for the Astro-themed Chat interface.
---

# Chat Interface UI/UX Redesign Plan

## Objective
Redesign the `Chat.tsx` interface to fully align with the Astro UXDS design system, creating a "mission-critical" command center aesthetic. The goal is to enhance usability, reduce cognitive load, and provide a sturdy, professional feel.

## Design Concept: "Orbital Command"
The interface mimics a high-fidelity space operations terminal.
-   **Theme:** Deep space darks (`astro-dark`), technical blues (`astro-primary`), and functional grays (`astro-surface`).
-   **Typography:** Monospace for data/code, clean sans-serif (Roboto/Inter) for communication.
-   **Interaction:** Tactile, distinct controls.

## Key Components & Changes

### 1. Global Header ("Comms Panel")
*   **Old:** Simple HTML header with native selects.
*   **New:** `rux-global-status-bar` style container.
    *   **Status Indicator:** `rux-status` to show system readiness/processing state.
    *   **Controls:** Grouped `rux-select` components for Provider, Model, and Mode.
    *   **Actions:** `rux-button` (secondary) for Archiving.

### 2. Message Stream ("The Log")
*   **Layout:** Full-width container with distinct separation between User (Operator) and Model (System).
*   **User Message:**
    *   Right-aligned.
    *   `astro-primary` (Blue) background.
    *   Icon: `person`.
    *   Shape: Rounded, "speech bubble" aesthetic but technical.
*   **System Message:**
    *   Left-aligned.
    *   `astro-surface` (Dark Grey) background with `astro-border`.
    *   Icon: `processor` or `smart-toy`.
    *   Content: Markdown rendering with styled code blocks.
*   **Empty State:** Large, centered "System Online" dashboard with `satellite` icon and quick status check.

### 3. Input Console ("Command Deck")
*   **Layout:** Fixed bottom bar, distinct from the message stream.
*   **Input:**
    *   Custom styled `textarea` (or `rux-textarea`) that auto-expands.
    *   Dark background, high contrast text.
*   **Integrated Controls:**
    *   **Attachments:** `rux-button` (icon-only `attach-file`) integrated into the input group.
    *   **Voice:** `rux-button` (icon-only `mic`) with active state styling (red/pulsing).
    *   **Execute:** `rux-button` (icon-only `send`) for submission.
*   **Live Feedback:** Realtime transcript display integrated into the top of the input console.

### 4. Attachments & Previews
*   **Drag & Drop:** Full-screen overlay with `cloud-upload` icon.
*   **Previews:** `rux-card` style mini-previews for images/files in the input area before sending.
*   **Modal:** Full-screen backdrop blur for detailed image viewing.

## Technical Implementation Details
*   **Components:** Use `@astrouxds/astro-web-components` directly (`rux-button`, `rux-icon`, `rux-status`, `rux-select`).
*   **Styling:** Use Tailwind with Astro design tokens (`bg-astro-dark`, `text-astro-primary`, etc.).
*   **Icons:** Ensure `RUX_ICONS_PATH` is correctly set and icons are loaded from `/icons/`.
*   **React Integration:** Use `className` for all styling to ensure React applies classes correctly to custom elements.

## Status
- [x] Plan Created
- [x] Implementation Complete (Refactored `Chat.tsx`)
- [x] Bug Fix: Resolved icon visibility issue in `Layout.tsx` by fixing prop usage (`class` -> `className`).
