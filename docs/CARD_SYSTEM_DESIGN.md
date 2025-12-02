# Card System Design & Mechanics Principles

## Core Philosophy
The "Card" is the fundamental atomic unit of the HAPA ecosystem. It represents not just a file or a piece of data, but a **living memory object**. 
The user experience should feel less like "file management" and more like **RPG Inventory Management** or **TCG Collection Curation**.

Every interaction with a card should feel tactile, rewarding, and contribute to its growth.

## Visual & UX Design Principles

### 1. The "Holo-Rare" Aesthetic
*   **Visual Hierarchy**: Cards should visually distinguish themselves based on quality/rarity (Tier).
    *   **Common**: Utilitarian, clean, standard matte finish.
    *   **Uncommon/Rare**: Subtle glows, colored borders.
    *   **Epic/Legendary**: Animated borders, "breathing" effects, maybe subtle particle effects (CSS).
    *   **Mythic**: "Holo" effects (gradients that shift on hover/tilt), distinct geometry.
*   **The "Bar"**: A clear, centered quality header on each card establishes its status immediately (e.g., "LEGENDARY").
*   **Tactility**: 
    *   Hover states should lift the card (Z-axis).
    *   Dragging should feel weighty.
    *   Clicking should have a satisfying "snap" or expand animation.

### 2. Card Mechanics (Gamification of Knowledge)
Instead of manual metadata entry, we use **RPG Progression Mechanics**:

*   **XP & Leveling**:
    *   A card starts at Level 1 (Raw).
    *   **Gaining XP**: 
        *   Being referenced in a chat.
        *   Having a summary generated (Affix: *Summarized*).
        *   Having key terms extracted (Affix: *Indexed*).
        *   Being linked to a Wiki entry (Affix: *Wiki-Linked*).
    *   **Leveling Up**: Increases the card's Tier (Common -> Uncommon -> ...).

*   **Affixes (Badges)**:
    *   Just like an RPG item has "+5 Strength", a Card has "Has Transcript".
    *   Visual badges on the card face show these affixes (Mic icon, Text icon, Link icon).
    *   **Set Bonuses**: Grouping related cards (e.g., by Thread or Project) could unlock "Set Views" or specialized context windows.

*   **Crafting & Synthesis**:
    *   **Extraction**: "Crushing" a Video Card to extract Frames or Audio (like salvaging items for parts).
    *   **Synthesis**: Combining multiple Text Cards into a new "Summary Card" (Crafting).

### 3. The "Deck" (Workspace)
*   The Workspace/Canvas is your "Hand" or "Deck".
*   You pull cards from the Library (Collection) into your Hand to work with them.
*   Context interactions happen here. "Playing" a card into the chat window.

## Future Functionality Goals

### Short Term
*   **Visual Polish**: Implement the "Quality Bar" design (Centered, full text).
*   **Affix Clarity**: Make the icon badges for Transcripts/Summaries more prominent/tooltip-rich.
*   **Sort by Power**: Default sorting should arguably be by "Quality" (show me my best formed memories) or "Recency".

### Medium Term
*   **Card Evolution**: When a card reaches a certain tier, it visually transforms (e.g., the thumbnail gets a special frame).
*   **"Socketing"**: Allow attaching a Note card *into* a Video card (like socketing a gem).
*   **Collections/Binders**: specialized views for specific projects (e.g., "The Biology Binder").

### Long Term
*   **3D Card Vault**: A literal 3D view of the library (like a gallery).
*   **Trading/P2P**: The "Trading Card" aspect comes alive when syncing with other peers. "I'll trade you my 'Project Specs' card for your 'Meeting Notes' card."

## Technical Guidelines
*   **Performance**: Animated CSS effects (glows/gradients) should be hardware accelerated.
*   **Data**: All "progression" must be derived from actual useful metadata (don't fake levels; level = utility).
*   **Accessibility**: Colors must still be legible. Rarity colors should have backup indicators (text labels).

---
*Drafted: 2025-12-02*
