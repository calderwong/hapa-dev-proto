---
description: Implementation plan for refactoring the Chat interface and main view with Astro UXDS.
---

# Chat & Main View Refactor Plan (Astro UXDS)

## Objective
Transform the Hapa Node Chat interface into a professional, "space-system" grade command center. The goal is to reduce cognitive load while increasing functionality, making the app feel like a sturdy, reliable tool for mission-critical AI operations.

## Design Philosophy
-   **Aesthetics:** "Dark Mode First". Deep space backgrounds (`astro-dark`), high-contrast text, and electric blue accents (`astro-primary`).
-   **Structure:** "Heads-Up Display". Controls should be grouped logically. Status should be visible at a glance.
-   **Interaction:** "Tactile & Responsive". Buttons should feel clickable. Inputs should feel ready.

## Proposed Changes

### 1. Main Layout (`src/components/Layout.tsx`)
-   **Status Bar:** Ensure `rux-global-status-bar` is the anchor of the top view.
-   **Sidebar:** Already refactored (icons fixed). Ensure background matches the new deep dark theme.
-   **Content Area:** Remove double scrollbars. The main content area should be the only scrollable region (or specific panels within it).

### 2. Chat Interface (`src/pages/Chat.tsx`)

#### A. Header (The "Comms Panel")
-   **Current:** A simple row of dropdowns.
-   **New:** A dedicated control bar using `rux-global-status-bar` (or a sub-bar styled similarly).
    -   **Left:** "Chat" label + Connection Status (Green/Red dot).
    -   **Center/Right:** Model Selectors using `rux-select` and `rux-option`.
    -   **Actions:** "Archive" button using `rux-button` (secondary/outline).

#### B. Message Stream (The "Log")
-   **Container:** Full height, scrollable, pinned to bottom.
-   **Empty State:** A "System Ready" dashboard look.
    -   Large Astro Icon (e.g., `satellite` or `hub`).
    -   "System Online" text.
    -   Quick start chips (e.g., "Analyze File", "Draft Wiki Entry").
-   **User Message:**
    -   Right-aligned.
    -   Color: `astro-primary` (Blue) background with white text.
    -   Shape: Rounded corners, distinct from AI.
-   **AI Message:**
    -   Left-aligned.
    -   Color: `astro-surface` (Dark Blue/Grey) background.
    -   Avatar: `rux-icon` (e.g., `processor` or `smart-toy`).
    -   Content: Markdown rendered clearly. Code blocks with syntax highlighting (using existing `ReactMarkdown` setup but styled).
    -   **Attachments/Cards:** Rendered as `rux-card` mini-previews.

#### C. Input Console (The "Command Deck")
-   **Container:** Fixed at the bottom, distinct background (`astro-surface`).
-   **Input:**
    -   Replace standard `<input>` with `<rux-textarea>` (auto-expanding) or a styled `div` wrapper around a textarea for more control.
    -   *Decision:* `rux-input` might be too simple for multi-line chat. We might need a custom wrapper that *looks* like Astro but behaves like a chat input. Let's try `rux-textarea` first or a custom styled textarea that matches Astro tokens.
-   **Controls:**
    -   **Left:** "Attach" button (`rux-button` icon-only: `attach-file`).
    -   **Right:**
        -   "Voice" button (`rux-button` icon-only: `mic` / `stop`).
        -   "Send" button (`rux-button` icon-only: `send`).
-   **Drag & Drop Overlay:** A full-screen "holographic" overlay when dragging files (`astro-hover` color with opacity).

### 3. Astro Component Integration
-   **`rux-button`**: For all actions.
-   **`rux-icon`**: For all visual indicators.
-   **`rux-select`**: For model dropdowns.
-   **`rux-card`**: For file previews and rich content.
-   **`rux-status`**: For connection/recording state.

## Implementation Steps

1.  **Refactor `Chat.tsx` Structure:**
    -   Replace HTML `<header>` with a styled flex container using Astro tokens.
    -   Replace `<select>` with `<rux-select>`.
    -   Replace `<button>` with `<rux-button>`.
2.  **Implement Message Bubbles:**
    -   Create a `MessageBubble` component (internal to Chat.tsx or separate) that handles the styling logic.
3.  **Build the Input Console:**
    -   Create a robust input area with `rux-button` groups and the text input.
    -   Handle the "Recording" state visually (pulsing red ring or `rux-status`).
4.  **Polish:**
    -   Check spacing (margins/padding).
    -   Ensure "Scroll to bottom" works with the new layout.
    -   Verify "Archive" functionality.

## Color Palette Reference (Tailwind + Astro)
-   `bg-astro-dark` (Main background)
-   `bg-astro-surface` (Panels, AI bubbles)
-   `text-astro-primary` (Accents, User bubbles)
-   `border-astro-border` (Dividers)

