# Vertex AI Integration Plan

**Created**: December 5, 2025  
**Status**: Planning → Implementation  
**Priority**: High - This will become the default provider

---

## Executive Summary

This document outlines the plan to integrate **Google Cloud Vertex AI** as the primary/default AI provider for Hapa AG, replacing the current Google AI Studio (Gemini API) integration. The goal is to provide enterprise-grade access to Google's latest models with simplified naming conventions for end users.

---

## 1. Model Naming Convention (User-Friendly)

| Shorthand Name | Actual Model ID | Use Case |
|----------------|-----------------|----------|
| **Video (Veo3.1)** | `veo-3.1-generate-preview` | Video generation, loops |
| **Smart LLM** | `gemini-3.0-pro` | Complex reasoning, analysis |
| **Pro Image** | `gemini-3.0-pro-vision` (image gen) | High-quality image generation |
| **Common Image** | `gemini-2.5-flash-preview-image-generation` | Fast image generation |
| **Fast LLM** | `gemini-2.5-flash-lite` | Quick responses, simple tasks |

### Model Mapping Constants
```typescript
const VERTEX_MODEL_MAP = {
  'video': 'veo-3.1-generate-preview',
  'smart-llm': 'gemini-3.0-pro',
  'pro-image': 'imagen-4.0-generate-001', // or gemini-3.0-pro with image gen
  'common-image': 'gemini-2.5-flash-preview-image-generation',
  'fast-llm': 'gemini-2.5-flash-lite',
};
```

---

## 2. Key Differences: Google AI Studio vs Vertex AI

| Aspect | Google AI Studio (Current) | Vertex AI (New Default) |
|--------|---------------------------|-------------------------|
| **Authentication** | Simple API Key | API Key OR Service Account + OAuth |
| **Endpoint Base** | `generativelanguage.googleapis.com` | `{REGION}-aiplatform.googleapis.com` |
| **URL Format** | `/v1beta/models/{model}:generateContent?key={KEY}` | `/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/{MODEL}:generateContent` |
| **Headers** | `x-goog-api-key` | `Authorization: Bearer {TOKEN}` or `x-goog-api-key` |
| **Project Scope** | Implicit (tied to API key) | Explicit `PROJECT_ID` required |
| **Region** | Global | Region-specific (`us-central1`, `europe-west4`, etc.) |
| **Imagen Access** | Limited | Full Imagen 4 access |
| **Veo Access** | Via Gemini API | Native Veo 3.1 support |
| **Rate Limits** | Consumer tier | Enterprise tier (higher) |
| **Data Privacy** | May train on data | Enterprise data isolation |

### API Endpoint Comparison

**Current (Google AI Studio):**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=API_KEY
```

**New (Vertex AI with API Key):**
```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:generateContent
Header: x-goog-api-key: {VERTEX_API_KEY}
```

**New (Vertex AI with OAuth):**
```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:generateContent
Header: Authorization: Bearer {ACCESS_TOKEN}
```

---

## 3. Configuration Requirements

### New Settings to Store
```typescript
interface VertexAISettings {
  enabled: boolean;                    // Master toggle
  projectId: string;                   // Google Cloud Project ID
  region: string;                      // e.g., 'us-central1'
  apiKey?: string;                     // Vertex AI API Key (simpler auth)
  serviceAccountJson?: string;         // Service account JSON (enterprise auth)
  
  // Model preferences (using shorthand names)
  defaultSmartLLM: string;             // Default: 'gemini-3.0-pro'
  defaultFastLLM: string;              // Default: 'gemini-2.5-flash-lite'
  defaultProImage: string;             // Default: 'imagen-4.0-generate-001'
  defaultCommonImage: string;          // Default: 'gemini-2.5-flash-preview-image-generation'
  defaultVideo: string;                // Default: 'veo-3.1-generate-preview'
}
```

### Region Options
- `us-central1` (Iowa) - Recommended default
- `us-east4` (Virginia)
- `us-west1` (Oregon)
- `europe-west4` (Netherlands)
- `asia-northeast1` (Tokyo)

---

## 4. Implementation Plan

### Phase 1: Core Infrastructure (Priority: HIGH)

#### 1.1 Create Vertex AI Service Module
**File**: `electron/vertexai.ts`

```typescript
// Core Vertex AI client abstraction
export class VertexAIClient {
  private projectId: string;
  private region: string;
  private apiKey?: string;
  private accessToken?: string;
  
  constructor(config: VertexAISettings) { ... }
  
  // Core methods
  async generateContent(model: string, prompt: string, options?: GenerateOptions): Promise<GenerateResponse>;
  async generateImage(model: string, prompt: string, options?: ImageOptions): Promise<ImageResponse>;
  async generateVideo(model: string, prompt: string, options?: VideoOptions): Promise<VideoResponse>;
  
  // Utility methods
  resolveModelName(shorthand: string): string;
  buildEndpoint(model: string, action: string): string;
  getAuthHeaders(): Record<string, string>;
}
```

#### 1.2 Add Settings Storage
**File**: `electron/main.ts`

- Add `VERTEX_AI_SETTINGS_KEY` constant
- Add `getVertexAISettings()` and `saveVertexAISettings()` functions
- Add IPC handlers for settings

#### 1.3 Create Admin UI Panel
**File**: `src/pages/Admin.tsx`

New section: "Vertex AI Configuration"
- Project ID input
- Region dropdown
- API Key input (masked)
- Optional: Service Account JSON upload
- Test Connection button
- Model preference dropdowns with shorthand names

### Phase 2: Model Integration (Priority: HIGH)

#### 2.1 Update Pipeline to Use Vertex AI
**File**: `electron/pipeline.ts`

- Replace `GoogleGenerativeAI` SDK calls with `VertexAIClient`
- Update `getDefaultGeminiModel()` to use Vertex model mapping
- Leo phase: Use "Smart LLM" (Gemini 3 Pro)
- Thor phase: Use "Smart LLM" for analysis, "Common Image" for generation
- Media phase: Use "Pro Image" or "Common Image" based on quality setting

#### 2.2 Update Main Process Handlers
**File**: `electron/main.ts`

Replace all `generativelanguage.googleapis.com` calls:
- `chat-with-gemini` → Use VertexAIClient
- `generate-image-for-card` → Use Vertex Imagen 4 / Gemini image
- `create-loop-video-for-image` → Use Vertex Veo 3.1
- `generate-video-with-gemini` → Use Vertex Veo 3.1
- `list-gemini-models` → List Vertex models

#### 2.3 Update Preload API
**File**: `electron/preload.ts`

Add new IPC bindings:
- `getVertexAISettings`
- `saveVertexAISettings`
- `testVertexAIConnection`
- `listVertexModels`

### Phase 3: UI Updates (Priority: MEDIUM)

#### 3.1 Settings Page Updates
**File**: `src/pages/Settings.tsx`

- Add Vertex AI section with shorthand model selectors
- Show "Video (Veo3.1)", "Smart LLM", etc. in dropdowns
- Hide technical model IDs from regular users

#### 3.2 Pipeline UI Updates
**File**: `src/pages/Pipeline.tsx`

- Show which models are being used (shorthand names)
- Add model selection override for power users

### Phase 4: Fallback & Migration (Priority: MEDIUM)

#### 4.1 Graceful Fallback
- If Vertex AI is not configured, fall back to Google AI Studio
- Show warning that Vertex AI is recommended
- Maintain backward compatibility with existing API keys

#### 4.2 Migration Helper
- Detect existing Google AI Studio configuration
- Prompt user to upgrade to Vertex AI
- Provide setup instructions

---

## 5. File Changes Summary

| File | Changes |
|------|---------|
| `electron/vertexai.ts` | **NEW** - Vertex AI client module |
| `electron/main.ts` | Add Vertex settings, update API calls |
| `electron/pipeline.ts` | Use VertexAIClient, update model selection |
| `electron/preload.ts` | Add Vertex IPC bindings |
| `src/pages/Admin.tsx` | Add Vertex AI configuration panel |
| `src/pages/Settings.tsx` | Add shorthand model selectors |
| `src/types.ts` | Add VertexAISettings interface |

---

## 6. API Request Examples

### Text Generation (Smart LLM)
```typescript
// Vertex AI endpoint
const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/gemini-3.0-pro:generateContent`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  })
});
```

### Image Generation (Imagen 4)
```typescript
const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/imagen-4.0-generate-001:predict`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify({
    instances: [{ prompt: imagePrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputOptions: { mimeType: 'image/png' }
    }
  })
});
```

### Video Generation (Veo 3.1)
```typescript
const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/veo-3.1-generate-preview:predictLongRunning`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify({
    instances: [{
      prompt: videoPrompt,
      image: { bytesBase64Encoded: startFrameBase64 }
    }],
    parameters: {
      aspectRatio: '16:9',
      durationSeconds: 5,
      sampleCount: 1
    }
  })
});
```

---

## 7. Testing Checklist

- [ ] Vertex AI API key authentication works
- [ ] Service account authentication works (optional)
- [ ] Text generation with Gemini 3 Pro
- [ ] Text generation with Gemini 2.5 Flash-Lite
- [ ] Image generation with Imagen 4
- [ ] Image generation with Gemini 2.5 Flash Image
- [ ] Video generation with Veo 3.1
- [ ] Pipeline Leo phase with Vertex
- [ ] Pipeline Thor phase with Vertex
- [ ] Pipeline Media phase with Vertex
- [ ] Fallback to Google AI Studio when Vertex not configured
- [ ] Settings persistence across app restarts
- [ ] Error handling for invalid credentials
- [ ] Rate limit handling

---

## 8. Rollout Strategy

1. **Phase 1**: Implement core Vertex AI client (this session)
2. **Phase 2**: Update pipeline to use Vertex (this session)
3. **Phase 3**: Add Admin UI for configuration (this session)
4. **Phase 4**: Update Settings page with shorthand names
5. **Phase 5**: Test end-to-end with real Vertex credentials
6. **Phase 6**: Add fallback logic for backward compatibility
7. **Phase 7**: Documentation and user guide

---

## 9. Open Questions

1. **Imagen 4 vs Gemini 3 Pro Image**: Which should be "Pro Image" default?
   - Imagen 4 is specialized for images
   - Gemini 3 Pro has image generation but is primarily LLM
   - **Decision**: Use Imagen 4 for "Pro Image"

2. **Region Selection**: Should we auto-detect or let user choose?
   - **Decision**: Default to `us-central1`, allow override in Admin

3. **API Key vs Service Account**: Which to prioritize?
   - **Decision**: API Key for simplicity, Service Account as optional advanced feature

---

## 10. Implementation Order

1. ✅ Create this plan document
2. ✅ Create `electron/vertexai.ts` with VertexAIClient class
3. ✅ Add Vertex settings to `electron/main.ts`
4. ✅ Add Vertex IPC handlers to `electron/preload.ts`
5. ✅ Add Vertex Admin UI panel to `src/pages/Admin.tsx`
6. ✅ Update `electron/pipeline.ts` to use Vertex
7. ⏳ Update all API calls in `electron/main.ts` (chat, image gen, video gen)
8. ⏳ Test and verify
9. ⏳ Update dev_journal.md

---

## Implementation Status

### Completed (Phase 1)
- **`electron/vertexai.ts`**: Full Vertex AI client with:
  - `VertexAIClient` class for all API calls
  - Model shorthand mapping (Smart LLM, Fast LLM, Pro Image, Common Image, Video)
  - Settings management functions
  - Support for text generation, image generation (Imagen 4 + Gemini), video generation (Veo 3.1)

- **`electron/main.ts`**: Added IPC handlers:
  - `get-vertex-ai-settings`
  - `save-vertex-ai-settings`
  - `test-vertex-ai-connection`
  - `get-vertex-ai-models`

- **`electron/preload.ts`**: Added bindings for all Vertex AI IPC calls

- **`src/pages/Admin.tsx`**: New "Vertex AI (Default Provider)" panel with:
  - Enable/disable toggle
  - Project ID input
  - Region selector
  - API Key input
  - Model shorthand display
  - Save and Test Connection buttons

- **`electron/pipeline.ts`**: Updated all phases to use Vertex AI:
  - Leo phase: Uses Smart LLM (Gemini 3 Pro) via Vertex
  - Thor processing: Uses Smart LLM via Vertex
  - Media generation: Uses Common Image via Vertex
  - Fallback to Google AI Studio when Vertex not configured

### Remaining Work
- Update chat handlers in main.ts to use Vertex
- Update standalone image generation to use Vertex
- Update video generation to use Vertex Veo 3.1
- Full end-to-end testing with real Vertex credentials
