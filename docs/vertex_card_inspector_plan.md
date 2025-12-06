# Card Inspector - Vertex AI Integration Plan

## Objective
Fix Video Loop generation and ensure both Image and Video generation in Card Inspector use Vertex AI (same as Hell Week pipeline).

---

## Current State Analysis

### 1. Video Loop Generation (Card Inspector)
**Current Handler:** `handleHellWeekVideoGenerate()` in CardLibrary.tsx
```typescript
const handleHellWeekVideoGenerate = async () => {
    if (!selected) return;
    const rec = selected.cardRecord || {};
    const imagePath = rec.mediaPrompts?.generated_image_local || selected.mediaLocalPath;
    if (!imagePath || !window.electronAPI?.generateLoopVideo) return;
    
    setHwVideoGenStatus('generating');
    try {
        await window.electronAPI.generateLoopVideo({
            imagePath,
            cardName: rec.cardData?.name || selected.name,
            prompt: rec.mediaPrompts?.video_loop || `Subtle animation of ${selected.name}`,
        });
        setHwVideoGenStatus('complete');
    } catch (err) {
        setHwVideoGenStatus('error');
    }
};
```

**Questions to investigate:**
- Does `generateLoopVideo` IPC handler exist?
- Does it use Vertex AI or legacy Gemini/AI Studio?
- What's the correct Veo API endpoint for Vertex?

### 2. Image Generation (Card Inspector)
**Current Handler:** `handleGenerateImage()` in CardLibrary.tsx
**Questions to investigate:**
- Does it use Vertex AI or legacy AI Studio?
- What provider does it call?

---

## API Reference (from Memory)

### Model Shorthand Naming
- **Pro Image** → `imagen-4.0-generate-001`
- **Video** → `veo-3.1-generate-preview`

### Vertex AI Endpoints
- Image: `https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/imagen-4.0-generate-001:predict`
- Video: `https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/veo-3.1-generate-preview:generateVideo`

---

## Implementation Steps

### Step 1: Audit Current IPC Handlers
- [ ] Find `generateLoopVideo` in preload.ts
- [ ] Find the backend handler in main process
- [ ] Check if it uses Vertex AI

### Step 2: Audit Image Generation
- [ ] Find `generateImageForCard` in preload.ts
- [ ] Find the backend handler
- [ ] Check if it uses Vertex AI

### Step 3: Update Video Generation to Vertex AI
- [ ] Ensure Veo uses Vertex AI client from vertexai.ts
- [ ] Use correct model ID: `veo-3.1-generate-preview`
- [ ] Handle image-to-video input correctly

### Step 4: Update Image Generation to Vertex AI
- [ ] Ensure Imagen uses Vertex AI client from vertexai.ts
- [ ] Use correct model ID: `imagen-4.0-generate-001`
- [ ] Maintain fallback to AI Studio if Vertex not configured

### Step 5: Test Both Functions
- [ ] Test video loop generation on a Hell Week card
- [ ] Test image generation on any card

---

## Files to Check/Modify

1. `electron/preload.ts` - IPC bindings
2. `electron/main.ts` or `electron/handlers/` - Backend handlers
3. `electron/vertexai.ts` - Vertex AI client
4. `electron/gemini.ts` - Legacy Gemini handlers (may need to redirect to Vertex)
5. `src/pages/CardLibrary.tsx` - Frontend handlers

---

---

## Implementation Complete ✅

### Changes Made

**1. Fixed Video Loop Generation Button (CardLibrary.tsx)**
- Changed from non-existent `generateLoopVideo` to existing `createLoopVideoForImage` API
- Passes correct parameters: `parentCardId`, `imageId`, `imagePath`, `imageNumber`, `cardName`

**2. Updated Loop Video to Use Vertex AI (main.ts)**
- Added `isVertexAIConfigured()` check before video generation
- If Vertex configured: Uses `vertexClient.generateVideo()` with loop mode
- If Vertex fails or not configured: Falls back to AI Studio endpoint
- Updated polling to use `vertexClient.pollVideoOperation()` for Vertex paths
- Added progress broadcasting during generation

**3. Image Generation (Already Correct)**
- Verified `generate-image-for-card` handler already uses Vertex AI when configured (line 2324)
- Falls back to AI Studio if Vertex not configured
- No changes needed

### API Endpoints

| Feature | Vertex AI Endpoint | AI Studio Fallback |
|---------|-------------------|-------------------|
| **Video** | `{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/veo-3.1-generate-preview:predictLongRunning` | `generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning` |
| **Image** | Via `vertexClient.generateImageGemini()` | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |

### Files Modified
- `src/pages/CardLibrary.tsx` - Fixed `handleHellWeekVideoGenerate()` to use correct API
- `electron/main.ts` - Added Vertex AI branch to `create-loop-video-for-image` handler

### Testing
- Click "Generate Video Loop" button on a Hell Week card with an image
- Should use Vertex AI if configured in Admin settings
- Progress updates should appear in terminal logs
