# Feature Requirement Document: Card Library Drag & Drop Workspace

## 1. Overview
This feature introduces a "Drag and Drop" interaction model to the Card Library. Users can drag cards from the library grid into a designated "Drop Slot" to open a detailed workspace. This workspace allows for viewing content, editing text (Markdown) with diff tracking, and managing version history, adhering to an append-only policy.

## 2. User Stories
*   **As a user**, I want to drag a card from the library and drop it into a specific area to "load" it.
*   **As a user**, I want visual feedback when I am dragging a card over the drop zone (lighting/hover effects).
*   **As a user**, I want the library to transition away and be replaced by a focused workspace when a card is dropped.
*   **As a user**, I want to edit text-based cards using a markdown editor.
*   **As a user**, I want to see my changes highlighted (e.g., red text) to distinguish them from the original content.
*   **As a user**, I want to save my changes as new versions without overwriting the original data (append-only).
*   **As a user**, I want to view a timeline of changes and revert to previous versions if needed.

## 3. Functional Requirements

### 3.1. Card Library UI Updates
*   **Draggable Cards**: All cards in the `CardLibrary` grid must be draggable.
*   **Drop Zone**: A fixed UI element (bottom-right corner) acting as the target.
    *   **Default State**: Subtle, semi-transparent glass panel.
    *   **Hover State**: Glow effect, border highlight (Neon Cyan/Green) when a card is dragged over it.
    *   **Drop State**: "Locked-in" animation, followed by page transition.

### 3.2. Workspace View (Card Detail)
*   **Transition**: Smooth fade/slide out of Library, fade/slide in of Workspace.
*   **Layout**:
    *   **Header**: Card Title, ID, Type, Close button (returns to Library).
    *   **Main Content**:
        *   **Media**: Display image/video if applicable.
        *   **Text/Markdown**: Display content in an editor.
    *   **Sidebar/Panel**: Metadata, Timeline/History controls.

### 3.3. Editing & Versioning
*   **Markdown Editor**:
    *   Simple text area or rich text editor for content.
    *   **Diff Visualization**: Visual indicator of changes (e.g., changed text in red).
*   **Persistence**:
    *   "Save Changes" button.
    *   On save: Create a new entry in the Hypercore (or append to the card's feed).
    *   **Structure**: `{ type: 'update', parentId: 'original_id', content: 'new_content', timestamp: ... }`.
*   **Timeline**:
    *   List of versions (Original -> Update 1 -> Update 2).
    *   Clicking a version loads that state into the view.

## 4. Technical Design

### 4.1. Drag and Drop
*   Use HTML5 Native DnD API.
*   `draggable` attribute on Card components.
*   `onDragStart`, `onDragOver`, `onDrop` event handlers.
*   State management to track `isDragging` and `isOverDropZone`.

### 4.2. Data Structure (Hypercore)
*   Existing `cards` core stores the initial creation.
*   New `card-updates` core (or appending to `cards` with a `ref` pointer) to store edits.
*   For this implementation, we will simulate the append-only logic using the existing P2P structure, potentially adding a `versions` array to the local state or fetching related messages.

### 4.3. Diff Logic
*   Simple string comparison or use a lightweight diff utility if needed. For now, we can just highlight the *new* block or use simple CSS styling for "edited" mode.

## 5. Design System (Astro Theme)
*   **Colors**: Dark background (`#000000`, `#111827`), Glassmorphism (`bg-opacity-60`, `backdrop-blur`), Neon Accents (Cyan `#22d3ee`, Pink `#f472b6`, Green `#4ade80`).
*   **Icons**: `rux-icons` for drag handles, save, history, close.
*   **Typography**: Monospace for IDs and code, Sans-serif for UI text.

## 6. Implementation Plan
1.  **Modify `CardLibrary.tsx`**:
    *   Add `draggable` to card items.
    *   Implement `DropZone` component.
    *   Handle drag state and transition.
2.  **Create `CardWorkspace.tsx`**:
    *   The detail view component.
    *   Receives the dropped card data.
3.  **Implement Editor & History**:
    *   State for `currentContent` vs `originalContent`.
    *   "Save" logic to append update.
    *   "Timeline" UI to switch versions.
4.  **Integration**:
    *   Ensure smooth switching between Library and Workspace.
