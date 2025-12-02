# Pet Forge: RPG-Style Custom Pet Creator

## 1. Concept
The **Pet Forge** is a specialized UI for assembling custom desktop pets using sprite assets. Inspired by RPG inventory screens (like Diablo), it treats animated GIFs as "equipment" that can be slotted into specific behavior nodes (Idle, Walk, Run, Special).

## 2. UI Layout
The interface is divided into three main columns, evoking a "character sheet" feel.

### A. The Asset Bay (Left Panel)
*   **Function**: Acts as the "Inventory" or "Stash".
*   **Content**: Displays a grid of available "Sprite Cards" (GIFs) sourced from the user's Card Library.
*   **Interaction**: Draggable items.
*   **Filters**: Toggle between "All Images" and "Sprite Sheets" (created via the Converter).

### B. The Chassis Configuration (Center Panel)
*   **Function**: The "Paper Doll" or Character Sheet.
*   **Visuals**: A central preview area showing the pet in its current state.
*   **Slots**: Surrounding the preview are specific "Equipment Slots" for animations:
    *   **Core Systems**: `Idle` (Required), `Walk`, `Run`.
    *   **Expansion Slots**: `Sit`, `Sleep`, `Emote/Special`.
*   **Metadata**: Inputs for `Pet Name`, `Scale/Size`, and `Speed`.

### C. Behavior Logic (Right Panel)
*   **Function**: Item property editor.
*   **Context**: Appears when a specific Slot is selected or hovered.
*   **Controls**:
    *   **Trigger Condition**: When does this play? (e.g., "Randomly", "On Click", "On Keyword").
    *   **Probability**: Slider for how often it occurs (if random).
    *   **Sound**: Optional sound effect to pair with the animation.

## 3. User Flow
1.  **Open Forge**: User clicks "Forge New Pet" in the Sanctuary.
2.  **Select Assets**: User drags a GIF from the **Asset Bay** to the **Idle Slot**.
3.  **Preview**: The central preview immediately starts looping the Idle GIF.
4.  **Equip Movement**: User drags a walking GIF to the **Walk Slot**.
5.  **Configure Special**: User drags a dancing GIF to a **Special Slot**.
    *   In the Right Panel, they set Trigger to "On Click".
6.  **Save**: User clicks "Initialize Pet".
    *   System saves the configuration.
    *   Pet is spawned into the Sanctuary.

## 4. Technical Implementation

### Data Structure
We will extend the `PetConfig` to support this modular structure.

```typescript
interface PetModule {
  id: string; // Slot ID (e.g., 'idle', 'special_1')
  assetUrl: string; // Local path to GIF
  trigger: 'default' | 'random' | 'click' | 'command';
  triggerValue?: string; // e.g., command keyword
  probability?: number; // 0-1
}

interface CustomPetConfig {
  id: string;
  name: string;
  scale: number;
  speed: number;
  modules: Record<string, PetModule>;
}
```

### Components
1.  **`PetForge.tsx`**: Main container.
2.  **`AssetGrid.tsx`**: Draggable grid of library cards.
3.  **`ChassisSlot.tsx`**: Drop target that accepts GIFs.
4.  **`BehaviorEditor.tsx`**: Form for editing module properties.

### Drag and Drop
We will use standard HTML5 Drag and Drop API for simplicity and performance, avoiding heavy dependencies if possible, or `react-dnd` if complex sorting is needed (likely not needed here, just simple drop targets).

## 5. Visual Style
*   **Theme**: "Cyber-Inventory". Dark backgrounds, grid lines, glowing borders for active slots.
*   **Empty Slots**: Show wireframe icons (e.g., a wireframe running dog for 'Run' slot).
*   **Filled Slots**: Show the thumbnail of the GIF.
*   **Reference**: Diablo II Inventory, but with Astro UXDS colors (Cyan/Dark Blue).
