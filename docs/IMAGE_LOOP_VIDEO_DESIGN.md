# Image Loop Video Generation Feature

## Overview

One-click creation of looping videos from card images, with inline hover preview and navigation to video card.

## User Story

> As a user, I want to quickly create a mesmerizing looping video from any AI-generated image in my card's image set, see it play on hover, and navigate to its dedicated card page when clicked.

---

## UX Flow

### 1. Discovery & Trigger
```
┌─────────────────────────────────────────────┐
│ AI IMAGES (3)                               │
├─────────────────────────────────────────────┤
│ ┌──────┐  ┌──────┐  ┌──────┐               │
│ │ ★    │  │ 🔄   │  │      │               │
│ │ img1 │  │ img2 │  │ img3 │               │
│ │ #1   │  │ #2   │  │ #3   │               │
│ └──────┘  └──────┘  └──────┘               │
│                                             │
│ Hover on img2 shows: [🎬 Create Loop]      │
│ img2 has 🔄 icon = loop video exists       │
└─────────────────────────────────────────────┘
```

### 2. States

| State | Visual | User Action |
|-------|--------|-------------|
| **No Loop** | Image only | Hover shows "Create Loop" button |
| **Generating** | Pulsing border + spinner | Wait, see progress |
| **Has Loop** | 🔄 icon badge | Hover plays video, click navigates |
| **Error** | Red icon briefly | Retry button appears |

### 3. Hover Behavior (When Loop Exists)

```
┌────────────────┐
│ 🔄 ┌─────────┐ │
│    │ VIDEO   │ │  ← Video plays inline on hover
│    │ PREVIEW │ │    (muted, looping)
│    │         │ │
│    └─────────┘ │
│ #2             │
└────────────────┘
```

- Video overlays the image thumbnail
- Plays muted, loops continuously
- Stops when mouse leaves
- Click navigates to video card

### 4. Click Navigation

Clicking on an image that has a loop video:
- Navigate to the video's Card page in Card Library
- Video card is a child of the parent card
- Shows full video player, metadata, etc.

---

## Data Model

### Image Record Enhancement
```typescript
interface GeneratedImage {
  id: string;
  localPath: string;
  mimeType: string;
  craftedPrompt: string;
  generatedAt: string;
  creationOrder: number;
  // NEW: Loop video reference
  loopVideo?: {
    cardId: string;         // Child card ID for the video
    localPath: string;      // Video file path
    generatedAt: string;    // When video was created
    status: 'generating' | 'complete' | 'error';
    error?: string;
  };
}
```

### Video Card Record (Child)
```typescript
{
  cardId: "video-{timestamp}",
  name: "{parentCardName} - Loop #{imageOrder}",
  mediaKind: "video",
  mediaLocalPath: "/path/to/loop.mp4",
  parentCardId: "{parentCardId}",
  sourceImage: {
    imageId: "{imageId}",
    imagePath: "{imagePath}",
    craftedPrompt: "{original image prompt}"
  },
  generationParams: {
    model: "veo-2.0-generate-001",
    loopMode: true,
    sourcePrompt: "{loop-optimized prompt}"
  }
}
```

---

## Pipeline Design

### Step 1: Context Gathering
```
Image → Extract:
  - Original image path (first frame)
  - Original crafted prompt
  - Parent card context (name, type, themes)
```

### Step 2: Loop Prompt Crafting
```
LLM receives:
  - Original image prompt
  - Card context
  - Loop-specific instructions

LLM outputs:
  - Optimized prompt for seamless looping
  - Focus on subtle motion, atmospheric effects
```

### Step 3: Video Generation
```
Call Veo API with:
  - First frame: The source image
  - Prompt: Loop-optimized prompt
  - Loop mode: true
  - Duration: Short (for seamless loop)
```

### Step 4: Card Creation & Linking
```
1. Save video to: {userData}/wormhole/card-videos/{cardId}.mp4
2. Create video card in Hypercore
3. Add to card library index
4. Update parent image with loopVideo reference
5. Update parent card record
```

---

## Prompt Engineering for Loops

### System Prompt for Loop Video Crafting
```
You are crafting a prompt for a SEAMLESS LOOPING VIDEO.

The video will be generated from this still image prompt:
"{originalImagePrompt}"

Create a video prompt that:
1. Describes SUBTLE, CONTINUOUS motion that loops seamlessly
2. Focus on: gentle movements, atmospheric effects, ambient motion
3. Avoid: drastic changes, scene transitions, sudden movements
4. Good loop elements:
   - Floating particles, dust motes
   - Gentle breathing/pulsing of light
   - Slow camera drift or parallax
   - Ambient effects (fog, smoke, aurora)
   - Subtle environmental motion (leaves, water ripples)
5. Keep the core subject STATIC but environment ALIVE
6. Output ONLY the video prompt, under 100 words
```

### Example Outputs
- Input: "Cyberpunk city at night with neon signs"
- Output: "Gentle rain falling through neon light beams, puddles reflecting pulsing signs, steam rising from vents, subtle flickering of distant holograms, atmospheric fog drifting slowly"

---

## UI Implementation

### Image Gallery Enhancement
```tsx
// In the image gallery grid
{imageSet.displayOrder.map((imgIdx, displayPos) => {
  const img = imageSet.images[imgIdx];
  const hasLoop = img.loopVideo?.status === 'complete';
  const isGeneratingLoop = img.loopVideo?.status === 'generating';
  
  return (
    <div className="relative group">
      {/* Image */}
      <img src={img.localPath} />
      
      {/* Loop indicator badge */}
      {hasLoop && (
        <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-1">
          <LoopIcon />
        </div>
      )}
      
      {/* Generating indicator */}
      {isGeneratingLoop && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Spinner className="animate-spin text-purple-400" />
        </div>
      )}
      
      {/* Hover video preview */}
      {hasLoop && isHovering && (
        <video 
          src={img.loopVideo.localPath}
          autoPlay
          loop
          muted
          className="absolute inset-0 object-cover"
        />
      )}
      
      {/* Hover controls */}
      <div className="hover-controls">
        {!hasLoop && !isGeneratingLoop && (
          <button onClick={() => handleCreateLoop(imgIdx)}>
            <MovieIcon /> Create Loop
          </button>
        )}
      </div>
    </div>
  );
})}
```

### Progress Animation
- Border pulses purple during generation
- Spinner icon in center
- Status text below: "Creating loop..."

### Completion Animation
- Brief glow effect
- Loop icon fades in
- Optional: Auto-play preview for 2 seconds

---

## Backend IPC Handler

### New Handler: `create-loop-video-for-image`

```typescript
ipcMain.handle('create-loop-video-for-image', async (_event, {
  parentCardId,
  imageId,
  imagePath,
  originalPrompt,
  cardContext,
}) => {
  // 1. Validate inputs
  // 2. Craft loop-optimized prompt via LLM
  // 3. Call video generation API with image as first frame
  // 4. Save video file
  // 5. Create child video card
  // 6. Return video card info
});
```

---

## Error Handling

| Error | User Feedback | Recovery |
|-------|---------------|----------|
| No API key | "Configure Gemini API in Settings" | Link to Settings |
| Image not found | "Source image unavailable" | None |
| Video generation failed | "Failed to create loop" | "Retry" button |
| Save failed | "Couldn't save video" | Retry |

---

## Animation Timing

| Phase | Duration | Animation |
|-------|----------|-----------|
| Click to start | 0ms | Immediate feedback |
| Show "Crafting..." | 500ms | Text + brain icon |
| Show "Generating..." | Until done | Spinner + progress |
| Completion | 2000ms | Glow + checkmark |
| Return to idle | - | Loop icon visible |

---

## Implementation Checklist

### Backend
- [ ] Add `create-loop-video-for-image` IPC handler
- [ ] Implement loop prompt crafting LLM call
- [ ] Implement video generation with image as first frame
- [ ] Create video child card
- [ ] Update parent card with loop reference

### Frontend
- [ ] Add loop state tracking per image
- [ ] Add "Create Loop" button to image hover controls
- [ ] Add loop icon badge for images with loops
- [ ] Implement hover video preview
- [ ] Add click navigation to video card
- [ ] Add progress animations

### Preload
- [ ] Expose new IPC method

---

## Files to Modify

1. **`electron/main.ts`** - Add IPC handler
2. **`electron/preload.ts`** - Expose new method
3. **`src/pages/CardLibrary.tsx`** - UI for loop creation and preview
4. **`src/index.css`** - New animations for loop generation

---

## Testing Scenarios

1. **Happy path**: Create loop → see progress → loop plays on hover → click navigates
2. **No API key**: Shows settings prompt
3. **Generation failure**: Shows error, allows retry
4. **Multiple loops**: Each image can have its own loop independently
5. **Navigation**: Click loop image → goes to video card → back button returns

---

## Future Enhancements

- Batch loop creation for all images
- Loop quality/duration settings
- Loop style presets (atmospheric, energetic, subtle)
- Export loop as GIF
- Loop gallery view
