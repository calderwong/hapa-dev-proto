# Phamiliar System Plan: "Pets as Agents" (v2.0)

## Overview
We are shifting from global "Default Models" to a "Phamiliar" architecture where specific Pets (Agents) carry their own execution configurations, memories, and personalities. This system is operationalized through **"Camp Refactor"**, a training ground where Pets learn skills (Capabilities) and are configured with state-specific animations.

## 1. Data Structures

### New Interface: `PetCapability`
We will extend `PetCard` to include a `capabilities` field.

```typescript
export interface PetCapability {
  id: string;              // Unique ID for this capability instance
  name: string;            // e.g., "Creative Writer", "Code Assistant"
  provider: 'aimlapi' | 'vertex' | 'openai' | 'anthropic';
  modelId: string;         // e.g., "gpt-4o", "gemini-1.5-pro"
  
  // Hard Constraints / Options
  config: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    responseFormat?: 'text' | 'json_object';
  };

  // Subjective Personality / Instructions
  systemPrompt?: string;   // The "Soul" of the capability
  appendPrompt?: string;   // Text appended to every user query
}
```

### Updated `PetCard`
```typescript
export interface PetCard {
  // ... existing fields ...
  capabilities?: PetCapability[]; // List of skills this pet has
  activeCapabilityId?: string;    // Default/Active skill
  
  // Memory
  memoryCoreName?: string;        // Dedicated hypercore for this pet's memories

  // Agentic Animation States (Camp Refactor)
  // New optional animations for specific agent states
  agentStateAnimations?: {
    listening?: string;         // "Listen to User's request"
    requesting?: string;        // "Going out and requesting inference"
    waiting?: string;           // "Waiting for Inference"
    communicating?: string;     // "Communicating with other Phamiliars"
    responding?: string;        // "Request returned to user"
  };
}
```

## 2. Infrastructure: AIMLAPI.com & Camp Refactor

### Admin Panel
- Add "AIMLAPI.com" section to `src/pages/Admin.tsx` (Completed).
- Store `aimlapiKey` in `electron-store`.
- Base URL: `https://api.aimlapi.com/v1`.

### Camp Refactor (New Feature)
**Menu Item**: "Camp Refactor" (Icon: `school` / `graduation-cap`)
**Concept**: A "Training Camp" UI where users drag Pets to "train" them.

#### Core Features:
1.  **Drop Zone**: Drag a pet from the library/sidebar into the "Training Ring".
2.  **Skill Acquisition**: Assign "Base Skills" to the Pet.
    *   *Google Gemini 3 Pro (Smart LLM)*
    *   *Google Gemini 2.5 Flash (Fast LLM)*
    *   *Google Veo 3.1-fast (Fast Video)*
    *   *Google Veo 3.1-quality (Quality Video)*
    *   *Open AI ChatGPT 5.1 (Bard Class)* (Mapped to latest available high-tier model)
3.  **Animation Lab**: UI to upload/assign sprites to the 5 Agent States:
    *   *Listening*
    *   *Requesting*
    *   *Waiting*
    *   *Communicating*
    *   *Responding*

## 3. UI: Phamiliar Configurator (`PetCapabilitiesEditor`)
Refine the existing editor to include:
1.  **Skills Tab**: 
    - Quick-add buttons for the "Base Skills".
    - Detailed config (Temp, Prompts) for each.
2.  **Appearance Tab (Animation Lab)**:
    - Grid of the 5 agent states.
    - Drag-and-drop file upload for each state.
    - Preview of the animation.

## 4. Implementation Plan
1.  **Types**: Update `PetCard` schema in `src/components/pets/types.ts` with `agentStateAnimations`.
2.  **Navigation**: Add "Camp Refactor" to `Sidebar` / `App` routes.
3.  **UI Construction**:
    - Create `src/pages/CampRefactor.tsx`.
    - Enhance `PetCapabilitiesEditor.tsx` to support the Animation Lab and Base Skills presets.
4.  **Backend**: Ensure `aimlapi.ts` maps the specific model names correctly (e.g., mapping "ChatGPT 5.1" to a real model ID if necessary, or passing it through if AIMLAPI supports aliases).

## 5. Execution Logic (Future)
- When Pet is in state `listening` (user typing/talking), play `listening` animation.
- When `submit` happens, transition to `requesting` -> `waiting`.
- If multi-agent, `communicating`.
- On streaming start/done, `responding`.
