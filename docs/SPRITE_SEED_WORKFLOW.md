# Sprite Seed & Animation Workflow Design

## Overview
The goal is to establish a dedicated workflow for creating and managing sprite animations using AI agents. This involves designating specific image cards as "Sprite Seeds", using them as a reference context for LLM-driven animation requests, and creating a structured way to save, reuse, and manage these animation definitions.

## Core Concepts

### 1. Sprite Seed Card
- **Definition:** An existing Image Card that has been explicitly designated as a "Sprite Seed".
- **Significance:** It serves as the visual "Source of Truth" for all derived animations.
- **Data Model Changes:**
    - New tag: `sprite-seed`.
    - New metadata field: `isSpriteSeed: true`.

### 2. Animation Request (Prompt Card)
- **Definition:** A reusable text definition of an animation (e.g., "Walk cycle, side view, 8 frames").
- **Usage:** Users define these once and can apply them to any Sprite Seed.
- **Storage:** Saved as a `text` card (or specialized `prompt` card) in the library, tagged with `animation-prompt`.

### 3. Animation Workflow (The "Make it Move" Flow)
1.  **User Input:**
    - Selects a Sprite Seed card.
    - Enters a natural language description of the animation (or selects a saved Prompt Card).
    - Clicks "Generate Animation".
2.  **LLM Processing (Agentic Layer):**
    - System constructs a prompt for the default LLM (Gemini/OpenAI).
    - Context provided:
        - Original Sprite Seed image (base64 or description).
        - User's specific animation request.
        - System Prompt: "You are an expert sprite animator. Convert this request into a specific prompt for an image generation model (like SDXL or Nano Banana) that will produce a sprite sheet..."
    - **Output:** A refined, technical image generation prompt.
3.  **Image Generation:**
    - The refined prompt + Original Image (ControlNet/Img2Img context) is sent to the Image Model.
    - Result: A Sprite Sheet image.
4.  **Card Creation:**
    - A new `sprite-sheet` card is created.
    - Linked as a child of the Sprite Seed.
    - Metadata includes the `prompt` used and the `animation-definition`.

### 4. Animation Behavior & Instruction Cards
- **Behavior Definition:**
    - Users can define how an animation behaves (Loop, Ping-pong, Speed, Trigger Events).
    - This data is stored on the Animation Card itself.
- **AI Agent Instructions:**
    - Users can leave "Notes for Agents" (e.g., "Use this animation when the pet is hungry").
    - These notes are saved as separate `text` cards tagged `agent-instruction`.
    - Linked to the Animation Card.

## Implementation Plan

### Phase 1: Sprite Seed Designation
- **UI:** Add "Mark as Sprite Seed" button to Image Card Workspace.
- **Logic:** Update card metadata with `isSpriteSeed: true` and tag `sprite-seed`.
- **View:** Create a specialized view for Sprite Seed cards that highlights their role as a parent.

### Phase 2: Animation Request Interface
- **UI:** Add "Generate Animation" panel to Sprite Seed view.
    - Text Area for prompt.
    - "Save as Prompt Card" button.
    - Dropdown/Library to select existing Prompt Cards.
- **Logic:** 
    - Save inputs as new cards if requested.
    - Query existing `animation-prompt` cards for the dropdown.

### Phase 3: LLM & Image Gen Integration
- **Logic:**
    - Create `generateAnimationPrompt(seedCard, userRequest)` function using the configured Chat Provider.
    - Connect to `generateImage(refinedPrompt, seedImage)` using the configured Image Provider.
- **Flow:**
    - User clicks "Generate" -> LLM Refines Prompt -> Image Model Generates -> New Card Created.

### Phase 4: Behavior & Instructions
- **UI:** Add "Behavior Editor" to the resulting Animation Card view.
    - Fields: Frame Rate, Loop Style.
    - "Agent Instructions" text area.
- **Logic:**
    - Save behavior settings to card metadata.
    - Save Agent Instructions as new linked text cards.

## Data Structures

### Sprite Seed Metadata (on Image Card)
```json
{
  "isSpriteSeed": true,
  "tags": ["sprite-seed", "image"],
  "children": [
    { "cardId": "anim-1", "type": "sprite-animation", "label": "Walk Cycle" }
  ]
}
```

### Animation Card Metadata
```json
{
  "type": "image",
  "subType": "sprite-animation", // or sprite-sheet
  "parentId": "seed-card-1",
  "animationBehavior": {
    "fps": 12,
    "loop": "infinite", // or "once", "ping-pong"
    "trigger": "idle" // default trigger
  },
  "generationMetadata": {
    "originalRequest": "Make it walk",
    "refinedPrompt": "Sprite sheet of a cat walking, side view, 8 frames, white background...",
    "model": "sdxl-turbo"
  }
}
```

### Agent Instruction Card
```json
{
  "type": "text",
  "subType": "agent-instruction",
  "content": "This animation signifies the pet is hungry. Use it when hunger < 20%.",
  "parentId": "anim-card-1", // Linked to the specific animation
  "tags": ["agent-instruction", "ai-memory"]
}
```
