# Card Image Generation Feature Design

**Date:** Dec 2, 2025  
**Status:** DESIGN PHASE  
**Feature:** One-Click Image Generation from Card Context

---

## Overview

Allow users to generate images for any card with a single click. The system extracts context from the card, uses an LLM to craft an optimal image prompt, sends it to an image generation model, and updates the card with the result.

---

## User Story

> As a user, I want to click a single "Create Image" button on any card and have the system automatically generate a relevant, high-quality image based on the card's content.

---

## Settings Configuration (Admin Panel)

### New Settings Keys
```typescript
// In electron-store
'imageGenSettings': {
  defaultImageProvider: 'gemini',      // 'gemini' | 'openai' | 'local'
  defaultImageModel: 'gemini-2.0-flash-preview-image-generation',  // Imagen 3 via Gemini
  defaultPromptLLM: 'gemini-1.5-pro',  // For crafting image prompts
}
```

### Default Values
- **Image Provider:** Gemini
- **Image Model:** `gemini-2.0-flash-preview-image-generation` (Imagen 3 / "Nano Banana" equivalent)
- **Prompt Crafting LLM:** `gemini-1.5-pro` (Gemini 3 Latest equivalent)

---

## API Documentation Notes

### Gemini Image Generation Models

Based on current Gemini API:
- `gemini-2.0-flash-preview-image-generation` - Imagen 3 via Gemini 2.0
- Models containing `image` or `nano-banana` in name are treated as image generators

### Image Generation Flow (existing in main.ts)
1. Detect `isImageModel` by checking if model name contains 'image' or 'nano-banana'
2. Use `generateContent` endpoint (not streaming)
3. Response contains `inlineData` with base64 image bytes

### Response Format
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "image/png",
          "data": "<base64>"
        }
      }]
    }
  }]
}
```

---

## UX Design

### 1. Button Location
- **Card Inspector Panel** (in CardLibrary.tsx when a card is selected)
- Position: Action buttons section, alongside existing "Delete", "Edit", etc.

### 2. Button Design
```
┌─────────────────────────────────┐
│  ✨ Create Image                │  <- Neon cyan border, sparkle icon
└─────────────────────────────────┘
```
- Neon cyan glow effect on hover
- Sparkle/magic wand icon
- Disabled state if card already has an image (or offer "Regenerate")

### 3. Generation States

#### State 1: Idle
- Button shows "✨ Create Image"
- Subtle pulse animation on hover

#### State 2: Crafting Prompt (Step 1)
```
┌─────────────────────────────────┐
│  🔮 Crafting vision...          │  <- Pulsing animation
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  <- Progress indicator
└─────────────────────────────────┘
```

#### State 3: Generating Image (Step 2)
```
┌─────────────────────────────────┐
│  🎨 Manifesting image...        │  <- Color-shifting animation
│  ████████████░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────┘
```

#### State 4: Complete
- Card thumbnail updates with new image
- Brief "✓ Image created!" success flash
- Neon green glow effect

#### State 5: Error
- Red border pulse
- Error message in toast/overlay
- Retry button available

### 4. Visual Effects

#### During Generation
- Card border: Animated neon gradient (cyan → purple → pink → cyan)
- Background: Subtle particle effect or shimmer
- Overlay: Semi-transparent with "Generating..." text

#### On Success
- Flash of light effect
- Image fades in smoothly
- Success chime (if audio enabled)

---

## Pipeline Design

### Step 1: Context Extraction
Extract meaningful content from the card:
```typescript
interface CardContext {
  name: string;
  mediaKind: string;
  text?: string;           // From cardRecord.text, content, description
  tags?: string[];         // From cardRecord.tags
  messageContent?: string; // For message cards
  provider?: string;       // Context about origin
}
```

### Step 2: Prompt Crafting (LLM Call)
Send context to LLM to generate optimal image prompt:

**System Prompt:**
```
You are an expert at crafting image generation prompts. Given context about a data card, 
create a detailed, evocative prompt for an AI image generator.

Rules:
1. Output ONLY the image prompt, no explanations
2. Be specific about style, lighting, composition
3. Include artistic style keywords (digital art, concept art, etc.)
4. Keep under 200 words
5. Focus on visual elements that represent the content's essence
```

**User Input:**
```
Card Name: {name}
Card Type: {mediaKind}
Content: {text/description}
Tags: {tags}

Create an image prompt that visually represents this content.
```

### Step 3: Image Generation
Send crafted prompt to image model:
```typescript
const result = await window.electronAPI.chatWithGemini({
  message: craftedPrompt,
  model: settings.defaultImageModel,  // e.g., 'gemini-2.0-flash-preview-image-generation'
  history: []
});
// Result contains base64 image in markdown format or inlineData
```

### Step 4: Card Update
1. Save image to local storage (wormhole directory)
2. Update card's `image` field with localPath
3. Update card's `thumbnail` for display
4. Persist to Hypercore

---

## Implementation Plan

### Phase 1: Settings Infrastructure
1. [ ] Add `imageGenSettings` to Admin panel
2. [ ] Create settings UI with dropdowns for:
   - Image Provider (Gemini/OpenAI/Local)
   - Image Model (filtered list of image-capable models)
   - Prompt LLM (filtered list of text models)
3. [ ] Add IPC handlers for getting/setting these preferences

### Phase 2: Backend Logic
1. [ ] Create `generate-image-for-card` IPC handler
2. [ ] Implement context extraction function
3. [ ] Implement prompt crafting LLM call
4. [ ] Implement image generation call
5. [ ] Implement card update logic (save image, update record)

### Phase 3: Frontend UI
1. [ ] Add "Create Image" button to Card Inspector
2. [ ] Implement generation state machine
3. [ ] Add loading animations and progress indicators
4. [ ] Add neon border/glow effects during generation
5. [ ] Add success/error feedback

### Phase 4: Polish
1. [ ] Add sound effects for generation complete
2. [ ] Add particle/shimmer effects
3. [ ] Handle edge cases (no content, API errors, etc.)
4. [ ] Add "Regenerate Image" option for cards with existing images

---

## Technical Notes

### Model Detection
```typescript
const isImageModel = (modelName: string): boolean => {
  const lower = modelName.toLowerCase();
  return lower.includes('image') || lower.includes('nano-banana') || lower.includes('imagen');
};
```

### Image Storage Path
```
{userData}/wormhole/card-images/{cardId}-{timestamp}.png
```

### Error Handling
1. No API key → Prompt user to configure in Settings
2. Model unavailable → Fall back to default, notify user
3. Generation failed → Show error, offer retry
4. No card content → Show "Not enough context to generate image"

---

## Animation CSS Concepts

### Neon Border Pulse
```css
@keyframes neon-pulse {
  0%, 100% { box-shadow: 0 0 5px #00f7ff, 0 0 10px #00f7ff, 0 0 20px #00f7ff; }
  50% { box-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff, 0 0 40px #ff00ff; }
}

.generating {
  animation: neon-pulse 1.5s ease-in-out infinite;
}
```

### Color-Shifting Border
```css
@keyframes border-shift {
  0% { border-color: #00f7ff; }
  33% { border-color: #ff00ff; }
  66% { border-color: #00ff88; }
  100% { border-color: #00f7ff; }
}
```

---

## Files to Modify

1. **`electron/main.ts`** - Add `generate-image-for-card` IPC handler
2. **`src/pages/Admin.tsx`** - Add image generation settings UI
3. **`src/pages/CardLibrary.tsx`** - Add "Create Image" button to inspector
4. **`src/types/electron.d.ts`** - Add type definitions
5. **`electron/preload.ts`** - Expose new IPC methods
6. **`src/index.css`** - Add animation keyframes

---

## Success Criteria

1. ✓ User can generate image with single click
2. ✓ User sees clear progress through each step
3. ✓ Generated image displays in card thumbnail
4. ✓ Settings allow customization of models
5. ✓ Errors are handled gracefully with clear feedback
6. ✓ Visual effects make the experience feel "magical"

---

## Bugfix Notes (Dec 2, 2025)

### Issue: "Not enough context" Error for Rich Wormhole Documents

**Problem:** Cards with wormhole-processed content (summaries, key terms, wiki entries) were showing "Not enough context to generate an image" despite having rich metadata.

**Root Cause:** The context extraction in `handleGenerateImage` was only checking a narrow set of fields:
- `rec.text`, `rec.content`, `rec.description`, `rec.bio`
- `rec.tags`
- `rec.message?.content`

But wormhole documents store content differently:
- **Summaries**: `cardRecord.summaries[]` - array of {text, style} objects
- **Key Terms**: `cardRecord.keyTerms[]` - array of term strings
- **Original Text**: Stored in file at `cardRecord.wormhole.ingest.originalPath`
- **Title**: `cardRecord.name` or `cardRecord.title`
- **Kind**: `cardRecord.kind` = "document"

### Solution: Enhanced Context Extraction

Update the frontend (`CardLibrary.tsx`) and backend (`main.ts`) to extract context from ALL available sources:

```typescript
// Enhanced CardContext extraction
const extractCardContext = (card: CardIndexEntry) => {
  const rec = card.cardRecord || {};
  
  // 1. Try direct text fields
  let textContent = rec.text || rec.content || rec.description || rec.bio || '';
  
  // 2. Extract from summaries (most valuable for wormhole docs)
  if (!textContent && rec.summaries?.length > 0) {
    textContent = rec.summaries
      .map((s: any) => s.text || s.medium || s.short || '')
      .filter(Boolean)
      .join('\n');
  }
  
  // 3. Extract key terms as tags
  let tags = rec.tags || [];
  if (rec.keyTerms?.length > 0) {
    const terms = rec.keyTerms.map((kt: any) => 
      typeof kt === 'string' ? kt : kt.term || kt.name || ''
    ).filter(Boolean);
    tags = [...tags, ...terms];
  }
  
  // 4. Card title/name (always available)
  const name = card.name || rec.name || rec.title || 'Untitled';
  
  // 5. Message content for chat cards
  const messageContent = rec.message?.content || card.messageContent || '';
  
  return {
    name,
    mediaKind: card.mediaKind || rec.kind || 'unknown',
    text: textContent,
    tags,
    messageContent,
  };
};
```

### Backend Enhancement

The backend IPC handler should also be enhanced to:
1. Accept richer context from the frontend
2. Fallback to reading original file if no text content
3. Use summaries as the primary content source for document cards

### Data Flow Diagram (Updated)

```
Card Inspector
     │
     ├─► Extract Context (ENHANCED)
     │    ├─ rec.text / content / description
     │    ├─ rec.summaries[].text ← NEW
     │    ├─ rec.keyTerms[] as tags ← NEW  
     │    ├─ card.name / rec.title ← NEW
     │    └─ rec.message?.content
     │
     ├─► Frontend validation
     │    (at least name OR text OR tags)
     │
     └─► IPC: generate-image-for-card
          │
          ├─► LLM: Craft image prompt
          │
          └─► Image Model: Generate image
```

### Files Modified for Fix

1. **`src/pages/CardLibrary.tsx`**
   - Updated `handleGenerateImage` to extract summaries and keyTerms
   - Relaxed validation (name alone should be enough for simple cases)

2. **`electron/main.ts`**
   - Enhanced context handling in `generate-image-for-card`
   - Better prompt construction using all available context
