# Feature Design: Multimodal Summarization & Scroll Attachments

**Created:** 2025-12-04
**Status:** In Planning
**Author:** Cascade AI

---

## 1. Problem Statement

Currently, the Wormhole processing pipeline (Summarization, Key Terms, Wiki Update) only works with:
- Text/Markdown files (read directly)
- Audio files (via transcription)

**Missing capabilities:**
- IMAGE cards cannot be summarized (visual analysis)
- VIDEO cards cannot be summarized (video+audio analysis)
- Cards without associated text have no way to add contextual text for LLM analysis
- No "Default LLM" setting that applies across all wormhole operations

---

## 2. Research: Gemini Multimodal Capabilities

### Supported Models for Image + Video Analysis
From Google's official documentation (Dec 2024):

| Model | Image | Video | Audio | Text | Best For |
|-------|-------|-------|-------|------|----------|
| **gemini-2.5-pro** | ✅ | ✅ | ✅ | ✅ | Complex reasoning, analysis |
| **gemini-2.5-flash** | ✅ | ✅ | ✅ | ✅ | Fast, cost-effective |
| **gemini-2.0-flash** | ✅ | ✅ | ✅ | ✅ | Balanced performance |
| **gemini-1.5-pro** | ✅ | ✅ | ✅ | ✅ | Long context (1M tokens) |

### Video Understanding Capabilities
- Describe, segment, and extract information from videos
- Answer questions about video content
- Process both audio AND visual streams
- 1 frame per second sampling rate
- Supports: MP4, MPEG, MOV, AVI, FLV, MPG, WEBM, WMV, 3GPP

### Image Understanding Capabilities
- Scene description
- Object detection
- Color palette analysis
- Theme/mood identification
- Text extraction (OCR)
- People/face analysis

---

## 3. Feature Design

### 3.1 Multimodal Summarization

**Goal:** Enable "Run Summarization" for IMAGE and VIDEO cards.

**New Prompt Strategy for Visual Content:**
```
Analyze this [image/video] and provide:

1. **Visual Description**: What is shown? Describe the scene, subjects, and composition.
2. **Colors & Palette**: What are the dominant colors? What mood do they create?
3. **Themes & Mood**: What themes, emotions, or atmosphere does this convey?
4. **People/Characters**: If present, describe appearance, actions, expressions.
5. **Text Content**: Any visible text, titles, or labels?
6. **Technical Aspects**: Style (photo, illustration, 3D), quality, notable techniques.

If a scroll/context document is attached, also analyze how this visual relates to that text.

CONTEXT DOCUMENT (if provided):
{scrollText}

Provide a cohesive summary that captures the essence of this visual content.
```

**Output Structure (saved to Hypercore):**
```typescript
interface VisualSummary {
  id: string;
  kind: 'visual-analysis';
  description: string;      // Main visual description
  colors: string[];         // Dominant colors
  themes: string[];         // Identified themes
  mood: string;             // Overall mood/atmosphere
  people?: string;          // People description if present
  textContent?: string;     // OCR'd text if present
  technicalStyle: string;   // Art style, technique
  contextualAnalysis?: string; // Analysis with scroll context
  provider: 'gemini';
  model: string;
  createdAt: string;
}
```

### 3.2 Scroll Attachment System

**Concept:** A "Scroll" is a TEXT or MARKDOWN card that can be attached to any card to provide context for LLM operations.

**Use Cases:**
- Attach meeting notes to an audio recording
- Attach a script to a video card
- Attach character backstory to an image card
- Attach product specs to a product image

**Card Record Schema Addition:**
```typescript
interface CardRecord {
  // ... existing fields
  scrolls?: ScrollAttachment[];
}

interface ScrollAttachment {
  cardId: string;           // The text/markdown card ID
  label?: string;           // User-provided label
  attachedAt: string;       // ISO timestamp
  includeInSummarization: boolean;
  includeInKeyTerms: boolean;
  includeInWikiUpdate: boolean;
}
```

**UI Flow:**
1. In Card Inspector, add "📜 SCROLLS" section
2. Show "No scrolls attached" if empty
3. "Attach Scroll" button opens card picker (filtered to text/markdown)
4. Attached scrolls show with name, toggle options, remove button
5. When running LLM operations, include scroll text in prompt

### 3.3 Default LLM Setting

**Goal:** Add a global "Default LLM" setting that applies to all wormhole operations unless overridden.

**Settings Schema Update:**
```typescript
interface WormholeSettings {
  defaultModel?: {
    provider: WormholeProviderId;
    model: string;
  };
  transcription: { provider: WormholeProviderId; model: string };
  summarization: { provider: WormholeProviderId; model: string };
  keyTerms: { provider: WormholeProviderId; model: string };
  wikiUpdate: { provider: WormholeProviderId; model: string };
}
```

**Resolution Order:**
1. Per-operation override (in CardLibrary UI)
2. Per-step setting (in Settings)
3. Default LLM (new)
4. Hardcoded fallback ('gemini-2.5-flash')

---

## 4. Implementation Plan

### Phase 1: Backend Multimodal Support
- [ ] Create `analyzeMediaWithGemini()` function for images
- [ ] Create `analyzeVideoWithGemini()` function for videos
- [ ] Update `wormhole-run-summarization` to detect mediaKind
- [ ] Route to appropriate analysis function
- [ ] Save visual summaries to card Hypercore

### Phase 2: Scroll Attachment System
- [ ] Add `scrolls` field to card record schema
- [ ] Create IPC handlers: `attach-scroll`, `detach-scroll`, `get-scroll-text`
- [ ] Update LLM functions to accept scroll context parameter
- [ ] UI: Add SCROLLS section to Card Inspector
- [ ] UI: Card picker modal for selecting text cards

### Phase 3: Default LLM Setting
- [ ] Update Settings.tsx with Default LLM selector
- [ ] Update backend to check defaultModel setting
- [ ] Apply resolution order logic

### Phase 4: UI Display of Summaries
- [ ] Display visual summaries in Card Inspector
- [ ] Show colors as swatches
- [ ] Show themes as tags
- [ ] Collapsible sections for long descriptions

---

## 5. Technical Notes

### Sending Images to Gemini API
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

async function analyzeImage(imagePath: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = 'image/png'; // or detect from extension
  
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Image
      }
    }
  ]);
  
  return result.response.text();
}
```

### Sending Videos to Gemini API
```typescript
// For videos, use the Files API to upload first
import { GoogleAIFileManager } from '@google/generative-ai/server';

async function analyzeVideo(videoPath: string) {
  const fileManager = new GoogleAIFileManager(apiKey);
  
  const uploadResult = await fileManager.uploadFile(videoPath, {
    mimeType: 'video/mp4',
    displayName: 'video-for-analysis'
  });
  
  // Wait for processing
  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    file = await fileManager.getFile(uploadResult.file.name);
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent([
    { text: prompt },
    { fileData: { mimeType: file.mimeType, fileUri: file.uri } }
  ]);
  
  return result.response.text();
}
```

---

## 6. Review & Refinements

### Thought Process Review (Second Pass)

**Q: Should scrolls be bidirectional?**
A: No. A scroll is a text source attached TO a card. The text card itself doesn't need to know about attachments. This keeps the data model simple.

**Q: What if the scroll text card is deleted?**
A: On LLM run, check if scroll cardId exists. If not, show warning "Scroll [cardId] not found" and continue without it.

**Q: Should we limit scroll size?**
A: Yes. When including scroll text, cap at 32KB to stay within reasonable token limits. Show warning if truncated.

**Q: Default model - what about provider mismatch?**
A: Default model should include BOTH provider and model name. If user sets default to OpenAI but a step requires Gemini-specific features (like video), fallback to Gemini for that step.

**Q: How to handle very long videos?**
A: Gemini has a 1-hour limit for video. For longer videos, either:
1. Reject with error message
2. Auto-clip to first hour
Start with option 1 and let user re-encode if needed.

**Q: What about existing summaries?**
A: Append new summaries, don't replace. User can clear manually if needed.

---

## 7. Files to Modify

### Backend (electron/main.ts)
- Add `analyzeImageWithGemini()` function
- Add `analyzeVideoWithGemini()` function
- Update `wormhole-run-summarization` handler
- Update `wormhole-run-keyterms` handler
- Update `wormhole-run-wikiupdate` handler
- Add `attach-card-scroll` IPC handler
- Add `detach-card-scroll` IPC handler

### Frontend (src/pages/CardLibrary.tsx)
- Add SCROLLS section to Card Inspector
- Add scroll attachment modal/picker
- Update summary display for visual content
- Handle mediaKind routing for wormhole actions

### Frontend (src/pages/Settings.tsx)
- Add Default LLM selector section

### Types (src/types.ts or similar)
- Add ScrollAttachment interface
- Update WormholeSettings interface

---

## 8. Success Criteria

- [ ] Image cards can be summarized with visual description
- [ ] Video cards can be summarized with video+audio analysis
- [ ] Scrolls can be attached to any card type
- [ ] Scroll text is included in LLM operations
- [ ] Default LLM setting works across all wormhole steps
- [ ] Visual summaries display nicely in Card Inspector
- [ ] Key Terms works on image/video cards
- [ ] Wiki Update works on image/video cards

---

## 9. Next Steps

**READY FOR IMPLEMENTATION**

Starting with Phase 1: Backend Multimodal Support
