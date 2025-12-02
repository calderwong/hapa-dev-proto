# Google Imagen Integration Plan

## Overview

This document outlines the plan to fully integrate Google's Imagen models (including "Nano Banana" variants) into HAPA, similar to how Veo video generation is implemented.

## Current State

The current implementation in `electron/main.ts` has basic image generation support:
- Detects image models via `lowerModel.includes('image') || lowerModel.includes('nano-banana')`
- Uses simple `generateContent` API call
- **Missing**: Advanced parameters like `numberOfImages`, `aspectRatio`, `imageSize`, `personGeneration`
- **Missing**: Image editing capabilities (inpainting, outpainting, style transfer)

## Google Imagen Model Variants

### Available Models (Gemini API)

| Model | Description | Features |
|-------|-------------|----------|
| `imagen-4.0-generate-001` | Standard quality | 1K/2K resolution |
| `imagen-4.0-ultra-generate-001` | Ultra high quality | Best for detail |
| `imagen-4.0-fast-generate-001` | Fast generation | Speed optimized |
| `imagen-3.0-generate-002` | Previous generation | Stable, well-tested |

### "Nano Banana" Models
These appear to be experimental/preview image models with the pattern:
- `nano-banana-pro-preview`
- Similar capabilities to Imagen but potentially different internals

## API Parameters

### Generation Parameters

```typescript
interface ImagenGenerationConfig {
  // Number of images to generate (1-4)
  numberOfImages: 1 | 2 | 3 | 4;
  
  // Output size (Standard/Ultra only)
  imageSize: '1K' | '2K';
  
  // Aspect ratio
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  
  // Person generation policy
  personGeneration: 'dont_allow' | 'allow_adult' | 'allow_all';
  
  // Negative prompt (what to avoid)
  negativePrompt?: string;
  
  // Output format
  outputMimeType: 'image/png' | 'image/jpeg';
  compressionQuality?: number; // 0-100 for JPEG
}
```

### Request Body Structure (REST API)

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "prompt here" }]
    }
  ],
  "generationConfig": {
    "numberOfImages": 4,
    "aspectRatio": "16:9",
    "imageSize": "1K",
    "personGeneration": "allow_adult"
  }
}
```

## Advanced Features (Phase 2)

### Image Editing Operations

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Inpainting (Insert)** | Add objects to masked areas | "Add a vase of flowers on the table" |
| **Inpainting (Remove)** | Remove objects from masked areas | "Remove the person in background" |
| **Outpainting** | Expand image beyond borders | Change aspect ratio, add context |
| **Background Replace** | Replace background only | Product photography, portraits |

### Style Customization

- **Style Transfer**: Apply style from reference image
- **Subject Customization**: Generate images of specific subject
- **Control-based**: Use control images (drawings, edge maps)

## Implementation Plan

### Phase 1: ImagenOptionsPanel Component

Create `src/components/ImagenOptionsPanel.tsx` similar to `VeoOptionsPanel.tsx`:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎨 IMAGEN OPTIONS                                    [×] Close │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Model Tier ─────────────────────────────────────────────┐   │
│ │ ○ Fast (Speed)  ● Standard  ○ Ultra (Quality)            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Aspect Ratio ───────────────────────────────────────────┐   │
│ │ [1:1] [3:4] [4:3] [9:16] [16:9]                          │   │
│ │   □     □     □     □      ●                              │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Output Settings ────────────────────────────────────────┐   │
│ │ Resolution: [1K ▼]    Format: [PNG ▼]    Count: [4 ▼]    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Person Generation ──────────────────────────────────────┐   │
│ │ ○ Don't Allow  ● Adults Only  ○ Allow All                │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Negative Prompt ────────────────────────────────────────┐   │
│ │ [blurry, low quality, distorted...                     ] │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ Reference Image (Optional) ─────────────────────────────┐   │
│ │ [+ Drop image or click to select from library]           │   │
│ │     Style reference for generation                       │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Backend Updates

#### 1. Update `electron/main.ts`

```typescript
// Add to chat-with-gemini handler for image models
if (isImageModel) {
  const generationConfig: any = {};
  
  if (imagenOptions) {
    generationConfig.numberOfImages = imagenOptions.numberOfImages || 4;
    generationConfig.aspectRatio = imagenOptions.aspectRatio || '1:1';
    generationConfig.imageSize = imagenOptions.imageSize || '1K';
    generationConfig.personGeneration = imagenOptions.personGeneration || 'allow_adult';
  }
  
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  
  // Include negative prompt if provided
  if (imagenOptions?.negativePrompt) {
    body.contents[0].parts.push({ text: `Avoid: ${imagenOptions.negativePrompt}` });
  }
  
  // API call with full config
}
```

#### 2. Add IPC Handler for Imagen-specific Generation

```typescript
ipcMain.handle('generate-image-with-imagen', async (_event, {
  prompt,
  modelName,
  options
}: {
  prompt: string;
  modelName: string;
  options: ImagenGenerationConfig;
}) => {
  // Implementation
});
```

### Phase 3: UI Integration in Chat.tsx

1. **Detect Imagen Models**: Similar to Veo detection
2. **Show Options Panel**: When Imagen model selected
3. **Pass Options to Backend**: Include in generation request
4. **Display Results**: Show all generated images in grid

### Phase 4: Image Editing (Future)

1. **Add mask editor component**
2. **Implement inpainting API calls**
3. **Add outpainting UI for aspect ratio changes**
4. **Style transfer from Card Library images**

## Files to Create/Modify

### New Files
- `src/components/ImagenOptionsPanel.tsx` - Options panel component
- `src/types/imagen.ts` - TypeScript interfaces

### Modified Files
- `electron/main.ts` - Backend API integration
- `electron/preload.ts` - IPC channel exposure
- `src/pages/Chat.tsx` - UI integration
- `src/components/ChatInput.tsx` - Options trigger

## Model Detection Logic

```typescript
const isImagenModel = (modelName: string): boolean => {
  const lower = modelName.toLowerCase();
  return (
    lower.includes('imagen') ||
    lower.includes('nano-banana') ||
    lower.includes('image-generation') ||
    (lower.includes('image') && !lower.includes('video'))
  );
};

const getImagenModelTier = (modelName: string): 'fast' | 'standard' | 'ultra' => {
  const lower = modelName.toLowerCase();
  if (lower.includes('fast')) return 'fast';
  if (lower.includes('ultra')) return 'ultra';
  return 'standard';
};
```

## API Endpoint Reference

### Gemini API (generativelanguage.googleapis.com)
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

### Vertex AI API (aiplatform.googleapis.com)
```
POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:predict
```

## Success Criteria

1. ✅ Imagen models detected and trigger options panel
2. ✅ All generation parameters configurable via UI
3. ✅ Multiple images generated and displayed
4. ✅ Images saved to Card Library
5. ✅ Negative prompts working
6. ✅ Aspect ratio changes reflected in output
7. ✅ Resolution selection working (1K/2K)

## Timeline Estimate

- **Phase 1** (Options Panel): ~2 hours
- **Phase 2** (Backend): ~1 hour
- **Phase 3** (UI Integration): ~2 hours
- **Phase 4** (Image Editing): ~4 hours (future)

---

*Document created: December 2, 2025*
*Author: Cascade AI Assistant*
