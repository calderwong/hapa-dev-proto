# Hell Week v2 - Feature Design Document

**Created**: December 5, 2025
**Author**: Cascade AI
**Status**: In Progress

---

## Executive Summary

Hell Week v2 transforms the pipeline from a monolithic batch-processing system into a resilient, card-centric architecture where each card is a self-contained entity with its own hypercore ledger, state machine, and quest system. This enables:

1. **Resilient Processing**: Cards survive app crashes and can resume their evolution
2. **Parallel Execution**: Up to 3 concurrent "threads" for different model operations
3. **Real-time Perusal**: Users can inspect cards while pipeline continues
4. **Complete Lineage Tracking**: Full provenance of models, providers, authors, and transformations
5. **Quest-Based Architecture**: Cards define their own next steps, enabling distributed processing

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Requirements Breakdown](#requirements-breakdown)
3. [Architecture Design](#architecture-design)
4. [UI/UX Design](#uiux-design)
5. [Implementation Plan](#implementation-plan)
6. [Test Plan](#test-plan)
7. [Progress Tracking](#progress-tracking)
8. [Open Questions & Decisions](#open-questions--decisions)
9. [Future Suggestions](#future-suggestions)
10. [Banana Wishlist](#banana-wishlist)

---

## Current State Analysis

### What Works
- ✅ Drag & drop file ingestion
- ✅ Leo phase: Analyzes full document with Smart LLM (Vertex AI Gemini 2.5 Pro)
- ✅ Thor phase: Generates cards from chunks using Smart LLM
- ✅ Cards appear in UI as they're created
- ✅ Vertex AI integration with API key auth

### What's Broken/Missing
- ❌ Image generation fails (API integration issue)
- ❌ Cards not persisted to Card Library on crash
- ❌ No way to peruse cards during pipeline
- ❌ Thor uses Smart LLM (should default to Fast LLM)
- ❌ No model provenance tracking (provider, author, model name)
- ❌ Monolithic pipeline - all or nothing
- ❌ No Hell Week icon in left menu
- ❌ No parallel execution (sequential only)

---

## Requirements Breakdown

### R1: Hell Week Menu Icon
- Add icon to left menu matching other items
- Use appropriate Astros/space theme icon

### R2: Model Selection Toggle (Thor)
- Toggle between "Smart LLM" and "Fast LLM" for Thor phase
- Default to "Fast LLM"
- Record full model provenance on every run

### R3: Model Provenance Schema
Track for EVERY model invocation:
```typescript
interface ModelProvenance {
  commonName: string;      // "Fast LLM", "Smart LLM", "Nano Banana"
  provider: string;        // "Vertex AI", "Google AI Studio", "Local"
  modelAuthor: string;     // "Google", "OpenAI", "Anthropic"
  modelName: string;       // "gemini-2.5-flash", "gemini-2.5-pro"
  modelVersion?: string;   // Optional version identifier
  timestamp: string;       // ISO timestamp of invocation
  requestId?: string;      // Unique request identifier
}
```

### R4: Card Details View
- Beautiful RPG/Loot card interface
- Accessible during pipeline execution
- Shows: stats, lineage, prompts, skills, flavor text
- Animated state changes with sound effects
- Non-blocking (pipeline continues in background)
- Persistent visibility of pipeline progress

### R5: Card-Centric Architecture
Each card is a self-contained entity with:
- Own hypercore ledger
- State machine tracking evolution
- Quest system for pending tasks
- Full lineage/heritage tracking
- Recoverable from any state

### R6: Quest-Based Task System
Cards define their own next steps:
```typescript
interface CardQuest {
  questId: string;
  questType: 'thor-sort' | 'image-gen' | 'video-gen' | 'custom';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  dependencies: string[];  // Quest IDs that must complete first
  payload: any;           // Quest-specific data
  createdAt: string;
  updatedAt: string;
}
```

### R7: Parallel Execution (3 Threads)
- Max 3 concurrent API/model calls
- Stack-based task queue
- Tasks flow into available "pipes"
- Different model types can run in parallel (LLM + Image Gen)

### R8: Incremental Persistence
- Card created when blob is created
- Each evolution step appends to hypercore
- No data loss on crash
- Cards know their next step

---

## Architecture Design

### Card State Machine

```
┌─────────────┐
│   BLOB      │  Initial state: raw text chunk
└──────┬──────┘
       │ Thor's Sorting Hat
       ▼
┌─────────────┐
│   SORTED    │  Card data generated (title, skills, etc.)
└──────┬──────┘
       │ Image Generation Quest
       ▼
┌─────────────┐
│  ILLUSTRATED│  Card has image
└──────┬──────┘
       │ Video Generation Quest (optional)
       ▼
┌─────────────┐
│  ANIMATED   │  Card has video
└──────┬──────┘
       │ Conviction Phase
       ▼
┌─────────────┐
│  COMMITTED  │  Card finalized in library
└─────────────┘
```

### Thread Pool Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TASK QUEUE (Stack)                    │
│  [Task N] [Task N-1] ... [Task 3] [Task 2] [Task 1]     │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Thread 1 │    │ Thread 2 │    │ Thread 3 │
    │  (LLM)   │    │ (Image)  │    │ (Video)  │
    └──────────┘    └──────────┘    └──────────┘
```

### Hypercore Card Structure

```typescript
interface CardHypercore {
  // Identity
  cardId: string;
  hypercoreKey: string;
  
  // Lineage
  parentArtifact: {
    id: string;
    name: string;
    type: string;
    hash: string;
  };
  leoContext: {
    summary: string;
    themes: string[];
    modelProvenance: ModelProvenance;
  };
  
  // State
  state: 'blob' | 'sorted' | 'illustrated' | 'animated' | 'committed';
  
  // Content (evolves)
  blob: {
    text: string;
    chunkIndex: number;
    totalChunks: number;
  };
  cardData?: {
    name: string;
    type: string;
    rarity: string;
    skills: Skill[];
    flavorText: string;
    stats: Stats;
    modelProvenance: ModelProvenance;
  };
  media?: {
    image?: MediaAsset;
    video?: MediaAsset;
  };
  
  // Quests
  quests: CardQuest[];
  
  // History
  evolutions: Evolution[];
}
```

---

## UI/UX Design

### Hell Week Icon
- Icon: `satellite-3` or `rocket` from Astro UXDS
- Matches existing menu style

### Thor Model Toggle
Location: Hell Week settings panel or inline with Thor phase
```
┌─────────────────────────────────────┐
│ THOR'S SORTING HAT                  │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ ● Fast LLM  │ │ ○ Smart LLM    │ │
│ └─────────────┘ └─────────────────┘ │
│ Current: Gemini 2.5 Flash (Vertex)  │
└─────────────────────────────────────┘
```

### Card Details Modal/Panel
Design: Holographic card inspection interface

```
┌──────────────────────────────────────────────────────────────┐
│ ╔══════════════════════════════════════════════════════════╗ │
│ ║  ⚡ CARD DETAILS                              [X] Close  ║ │
│ ╠══════════════════════════════════════════════════════════╣ │
│ ║                                                          ║ │
│ ║  ┌────────────────┐   ┌─────────────────────────────┐   ║ │
│ ║  │                │   │ THE ARCHITECT'S VISION      │   ║ │
│ ║  │   [CARD ART]   │   │ ═══════════════════════════ │   ║ │
│ ║  │   or PENDING   │   │ Type: CONCEPT               │   ║ │
│ ║  │   animation    │   │ Rarity: ★★★★☆ EPIC         │   ║ │
│ ║  │                │   │                             │   ║ │
│ ║  └────────────────┘   │ STATS                       │   ║ │
│ ║                       │ ├─ Power: ████████░░ 80    │   ║ │
│ ║  STATE: SORTED        │ ├─ Speed: ██████░░░░ 60    │   ║ │
│ ║  ┌──●──○──○──○──┐     │ └─ Magic: █████████░ 90    │   ║ │
│ ║  BLOB→SORT→IMG→VID    │                             │   ║ │
│ ║                       └─────────────────────────────┘   ║ │
│ ║                                                          ║ │
│ ║  ┌─────────────────────────────────────────────────────┐ ║ │
│ ║  │ SKILLS                                              │ ║ │
│ ║  │ ⚔️ Strategic Planning - Plan complex architectures  │ ║ │
│ ║  │ 🛡️ System Design - Create robust foundations       │ ║ │
│ ║  │ ✨ Innovation - Generate novel solutions            │ ║ │
│ ║  └─────────────────────────────────────────────────────┘ ║ │
│ ║                                                          ║ │
│ ║  ┌─────────────────────────────────────────────────────┐ ║ │
│ ║  │ FLAVOR TEXT                                         │ ║ │
│ ║  │ "In the realm of systems, the architect sees not   │ ║ │
│ ║  │  walls but possibilities..."                        │ ║ │
│ ║  └─────────────────────────────────────────────────────┘ ║ │
│ ║                                                          ║ │
│ ║  ┌─────────────────────────────────────────────────────┐ ║ │
│ ║  │ LINEAGE & HERITAGE                                  │ ║ │
│ ║  │ ├─ Parent: The Archi-Deck.txt                      │ ║ │
│ ║  │ ├─ Leo Context: "A treatise on system design..."   │ ║ │
│ ║  │ ├─ Thor Model: Fast LLM (Gemini 2.5 Flash)         │ ║ │
│ ║  │ │   └─ Provider: Vertex AI | Author: Google        │ ║ │
│ ║  │ └─ Created: 2025-12-05T15:30:00Z                   │ ║ │
│ ║  └─────────────────────────────────────────────────────┘ ║ │
│ ║                                                          ║ │
│ ║  ┌─────────────────────────────────────────────────────┐ ║ │
│ ║  │ ACTIVE QUESTS                                       │ ║ │
│ ║  │ ⏳ Image Generation - Pending (Queue Position: 3)   │ ║ │
│ ║  │ ○ Video Generation - Waiting for image             │ ║ │
│ ║  └─────────────────────────────────────────────────────┘ ║ │
│ ╚══════════════════════════════════════════════════════════╝ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ PIPELINE STATUS: Thor Processing Card 45/227          │  │
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░ 20%      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Card Ready Animation
When a card completes a phase:
1. Card thumbnail pulses with golden glow
2. Subtle "ding" sound effect
3. "READY TO PERUSE" badge appears
4. Click opens Card Details panel

### Pipeline Progress Overlay
Always visible mini-status when viewing card details:
- Floating bottom bar
- Shows current phase, progress, active threads
- Expandable to return to full pipeline view

---

## Implementation Plan

### Phase 1: Foundation (Icons & Toggles)
- [ ] 1.1 Add Hell Week icon to left menu
- [ ] 1.2 Create Thor model toggle UI
- [ ] 1.3 Implement model provenance schema
- [ ] 1.4 Update pipeline to use Fast LLM default

### Phase 2: Card Architecture
- [ ] 2.1 Design CardHypercore schema
- [ ] 2.2 Implement card state machine
- [ ] 2.3 Create quest system
- [ ] 2.4 Update pipeline to create cards at blob stage

### Phase 3: Persistence & Recovery
- [ ] 3.1 Implement incremental card saving
- [ ] 3.2 Add card recovery on app restart
- [ ] 3.3 Quest-based task resumption

### Phase 4: Card Details UI
- [ ] 4.1 Design Card Details component
- [ ] 4.2 Implement lineage display
- [ ] 4.3 Add quest status display
- [ ] 4.4 Create animations & sound effects
- [ ] 4.5 Pipeline progress overlay

### Phase 5: Parallel Execution
- [ ] 5.1 Implement thread pool (3 threads)
- [ ] 5.2 Create task queue system
- [ ] 5.3 Update pipeline for async card processing
- [ ] 5.4 Add thread status to UI

### Phase 6: Testing & Polish
- [ ] 6.1 Unit tests for card state machine
- [ ] 6.2 Integration tests for pipeline
- [ ] 6.3 Crash recovery testing
- [ ] 6.4 Performance testing with large files
- [ ] 6.5 UI polish and animations

---

## Test Plan

### Unit Tests
1. Card state transitions
2. Quest creation and completion
3. Model provenance recording
4. Thread pool allocation

### Integration Tests
1. Full pipeline run with new architecture
2. Crash recovery mid-pipeline
3. Parallel execution of different model types
4. Card persistence to library

### Manual Tests
1. Drag & drop file → verify cards created incrementally
2. Close app mid-pipeline → reopen → verify recovery
3. Open card details during pipeline → verify non-blocking
4. Toggle Thor model → verify correct model used
5. Verify all cards have full provenance data

---

## Progress Tracking

### Big Rocks Checklist

- [x] **ROCK 1**: Hell Week Icon ✅ (Changed to satellite-3)
- [x] **ROCK 2**: Thor Model Toggle + Provenance Schema ✅
  - Added ModelProvenance interface to vertexai.ts
  - Added createModelProvenance helper function
  - Updated pipeline.ts with thorModel toggle (fast-llm default)
  - Added provenance tracking to Leo and Thor steps
  - Added IPC handlers for pipeline settings
  - Added Thor model toggle UI to Pipeline.tsx
- [x] **ROCK 3**: Card-Centric Architecture (Hypercore per card) ✅
  - Created cardManager.ts module with HellWeekCard interface
  - Cards created at blob stage with cardManager.createCardFromBlob()
  - Cards updated at sort stage with cardManager.updateCardWithThorData()
  - Cards updated at image stage with cardManager.updateCardWithImage()
  - Cards committed at final stage with cardManager.commitCard()
  - Each card has its own hypercore for persistence
  - Full integration into pipeline.ts
  - Pipeline state includes runId and hellWeekCards array
- [x] **ROCK 4**: Card Details UI ✅
  - Created CardDetails.tsx component with RPG/Loot aesthetic
  - Shows stats, skills, lore, lineage, truth analysis
  - Holographic border effect and animated particles
  - Pipeline status footer always visible
  - Cards clickable during pipeline execution
  - "Ready to Peruse" indicator on new cards
- [x] **ROCK 5**: Quest System ✅ (Basic Implementation)
  - Quests created at each card stage (thor-sort, image-gen, commit)
  - Quest status tracking (pending, in-progress, completed, failed)
  - Quest failure handling with error messages
- [ ] **ROCK 6**: Parallel Execution (3 Threads) - Future Enhancement
- [x] **ROCK 7**: Incremental Persistence ✅
  - Cards persisted immediately on creation
  - Cards re-persisted on each state change
  - Individual hypercore per card for recovery
- [ ] **ROCK 8**: Full Integration Testing

### Session Log

#### Session 1 - December 5, 2025 (3:30 PM PST)
- Created feature document
- Analyzed requirements
- Designed architecture
- Reviewed current codebase:
  - `Layout.tsx`: Hell Week already has `rocket` icon (line 28)
  - `Pipeline.tsx`: 366 lines, three-track UI (Leo/Thor/Conviction)
  - `pipeline.ts`: 580 lines, PipelineManager class
  - `vertexai.ts`: Model mappings and client

**Completed:**
1. ✅ Changed Hell Week icon from `rocket` to `satellite-3`
2. ✅ Added ModelProvenance interface and createModelProvenance helper
3. ✅ Added PipelineSettings with thorModel toggle (default: fast-llm)
4. ✅ Updated Leo step to record provenance
5. ✅ Updated Thor step to use configurable model and record provenance
6. ✅ Added IPC handlers for pipeline settings
7. ✅ Added preload bindings for pipeline settings
8. ✅ Added Thor model toggle UI (Fast/Smart buttons)
9. ✅ Created CardDetails.tsx component with full RPG aesthetic
10. ✅ Made cards clickable with "Ready to Peruse" indicator
11. ✅ Integrated CardDetails modal into Pipeline.tsx

**Files Created:**
- `docs/hell_week_v2_feature.md` - Feature design document
- `src/components/CardDetails.tsx` - Card details modal component with RPG aesthetic
- `electron/cardManager.ts` - Card-centric management module

**Files Modified:**
- `electron/vertexai.ts` - Added ModelProvenance, MODEL_AUTHORS, createModelProvenance
- `electron/pipeline.ts` - Full card-centric integration:
  - Added PipelineSettings with thorModel toggle (default: fast-llm)
  - Added runId and hellWeekCards to state
  - Cards created at blob stage via cardManager
  - Cards updated at Thor sort stage with provenance
  - Cards updated at image generation stage with provenance
  - Cards committed at conviction stage
  - Each stage persists to individual hypercore
- `electron/preload.ts` - Added pipeline settings bindings
- `src/components/Layout.tsx` - Changed Hell Week icon to satellite-3
- `src/pages/Pipeline.tsx`:
  - Added Thor model toggle UI (⚡ Fast / 🧠 Smart)
  - Added HellWeekCard interface
  - Cards clickable with "Ready to Peruse" indicator
  - Integrated CardDetails modal

**Implementation Complete!** Ready for testing.

---

## Session 2 - December 5, 2025 (5:45 PM PST) - Streaming Image Generation & Imagen 4 Fix

### Problem Analysis

1. **Sequential Processing Problem**: The pipeline processes ALL 227 Thor chunks BEFORE starting ANY image generation. This means:
   - User waits forever to see any images
   - If anything breaks mid-run, no images are saved
   - Bad UX - no visual feedback during the long Thor phase

2. **Image Generation API Failure**: Console shows `"No image data in response"` because:
   - Current code uses `generateImageGemini()` with `common-image` (gemini-2.0-flash-exp)
   - gemini-2.0-flash-exp is a TEXT model that CAN sometimes generate images, but not reliably
   - It returns images in `candidates[0].content.parts[0].inlineData.data` but only when it feels like it

3. **Wrong Model**: Need to switch from "Common Image" to "Pro Image" (Imagen 4) which is a DEDICATED image generation model

### Research: Imagen 4 API

**Available Models (GA as of Nov 2025):**
- `imagen-4.0-generate-001` - Standard quality (recommended)
- `imagen-4.0-ultra-generate-001` - Ultra quality (slower, more expensive)
- `imagen-4.0-fast-generate-001` - Fast generation (lower quality)

**Endpoint:**
```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:predict
```

**Request Body:**
```json
{
  "instances": [{ "prompt": "TEXT_PROMPT" }],
  "parameters": {
    "sampleCount": 1,
    "aspectRatio": "1:1",
    "outputOptions": { "mimeType": "image/png" },
    "personGeneration": "allow_adult",
    "safetySetting": "block_medium_and_above",
    "enhancePrompt": true,
    "includeRaiReason": true
  }
}
```

**Response:**
```json
{
  "predictions": [
    {
      "bytesBase64Encoded": "BASE64_IMG_BYTES",
      "mimeType": "image/png"
    }
  ]
}
```

### Implementation Plan

#### PHASE 1: Fix Imagen 4 API Integration

1. **Update MODEL_SHORTHAND_MAP** in `vertexai.ts`:
   - Change `'pro-image'` from `imagen-3.0-generate-002` to `imagen-4.0-generate-001`
   
2. **Update MODEL_AUTHORS** to include Imagen 4

3. **Fix `generateImageImagen()` method:**
   - Ensure correct endpoint format
   - Add `includeRaiReason: true` for better error logging
   - Add `enhancePrompt: true` for better image quality
   - Add detailed logging of request/response

4. **Update pipeline.ts to use `generateImageImagen()` instead of `generateImageGemini()`**

#### PHASE 2: Streaming/Parallel Image Generation

1. **Create Image Queue System:**
   - New `imageQueue` in cardManager.ts
   - Cards added to queue immediately when sorted (state: 'sorted')
   - Queue processes in parallel (max 3 concurrent)
   
2. **Modify Thor Processing:**
   - After each card is sorted, immediately queue it for image generation
   - Don't wait for all Thor processing to complete
   
3. **Create Background Image Worker:**
   - Runs independently of Thor processing
   - Picks cards from queue
   - Generates images with throttling
   - Updates card state to 'illustrated'
   - Emits events for UI updates

4. **Update Pipeline State Machine:**
   - Allow `THOR_PROCESSING` and `THOR_MEDIA_GENERATING` to run concurrently
   - UI shows both progress bars simultaneously

### Files to Modify

1. **`electron/vertexai.ts`:**
   - Update model mappings
   - Fix generateImageImagen() 
   - Add better error logging
   
2. **`electron/pipeline.ts`:**
   - Switch from generateImageGemini to generateImageImagen
   - Add image queue processing
   - Make image generation start during Thor processing
   
3. **`electron/cardManager.ts`:**
   - Add image queue management
   - Add parallel processing with concurrency limit

### Testing Plan

1. Test Imagen 4 API call in isolation first
2. Verify images are generated correctly
3. Test streaming behavior - images should appear during Thor processing
4. Test error handling - failed images shouldn't block other cards
5. Test throttling - shouldn't hit rate limits

### Implementation Status ✅

**PHASE 1: Fix Imagen 4 API Integration** - COMPLETE
- ✅ Updated MODEL_SHORTHAND_MAP to use `imagen-4.0-generate-001`
- ✅ Added Imagen 4 model variants (standard, fast, ultra)
- ✅ Updated MODEL_AUTHORS with new models
- ✅ Enhanced `generateImageImagen()` with detailed logging
- ✅ Added Imagen 4 specific parameters (enhancePrompt, includeRaiReason, personGeneration)
- ✅ Updated pipeline to use `generateImageImagen()` instead of `generateImageGemini()`
- ✅ Updated provenance tracking for Imagen 4

**PHASE 2: Streaming/Parallel Image Generation** - COMPLETE
- ✅ Added `ImageQueueItem` interface to cardManager.ts
- ✅ Added image queue fields to CardManager class
- ✅ Added `queueCardForImageGeneration()` method
- ✅ Added `processImageQueue()` with parallel execution (max 3 concurrent)
- ✅ Added `processImageItem()` for individual image processing
- ✅ Added `completeImageGeneration()` callback handler
- ✅ Added `setupImageQueueCallback()` to PipelineManager
- ✅ Modified Thor processing to queue images immediately after sorting
- ✅ Image generation now starts during Thor processing, not after!

**Files Modified:**
- `electron/vertexai.ts` - Updated model mappings, enhanced generateImageImagen()
- `electron/cardManager.ts` - Added complete image queue system
- `electron/pipeline.ts` - Integrated streaming image generation

---

## Session 3 - December 5, 2025 (7:40 PM PST) - Post-Thor Flow & Card Library Fix

### User Feedback & Issues Identified

1. **Thor Completion Flow Problem**: After Thor finishes, user is stuck if some images fail
   - Need option to EITHER re-run failed cards OR skip them and continue
   - Currently blocks progression to Conviction step

2. **Card Library Display Bug**: New cards from pipeline NOT showing in Card Library
   - Cards were generated (cost time/money to create)
   - Need to verify they exist and fix display issue

3. **Card Details (Peruse) Enhancements Requested**:
   - Image should be clickable to enlarge (lightbox)
   - Add button to trigger video loop generation from Card Details page
   - More exciting UX to create videos while viewing cards

### Implementation Plan

#### TASK 1: Thor Completion - Skip/Retry Flow
- Add "Skip Failed & Continue" button to Thor review phase
- Add "Retry Failed Cards" button
- Track failed cards in `PipelineState`
- When skipping, record failures in collection hypercore metadata
- Allow Conviction to proceed with partial deck

#### TASK 2: Card Library Display Fix
- Investigate how cards get into Card Library
- Check if Conviction step writes to correct hypercore
- Verify Card Library reads from same source
- Fix any disconnection between pipeline output and library display

#### TASK 3: Card Details Enhancements
- Add image lightbox (click to enlarge fullscreen)
- Add "Generate Video Loop" button when card has image
- Wire up video generation to existing Revid pipeline

### Files to Investigate/Modify
- `electron/pipeline.ts` - Thor completion flow, Conviction step
- `src/pages/Pipeline.tsx` - UI for skip/retry buttons
- `src/pages/Cards.tsx` - Card Library display
- `src/components/CardDetails.tsx` - Lightbox, video button
- `electron/p2p.ts` - Hypercore read/write

### Implementation Status ✅

**TASK 1: Thor Completion - Skip/Retry Flow** - COMPLETE
- ✅ Added `getFailedImageCount()` method to pipeline
- ✅ Added `skipFailedAndContinue()` method - skips failed cards, logs them, continues to Conviction
- ✅ Added `retryFailedImages()` method - retries only failed cards with Imagen 4
- ✅ Added IPC handlers: `pipeline:skip-failed`, `pipeline:retry-failed`, `pipeline:get-failed-count`
- ✅ Added preload bindings for all new methods
- ✅ Updated Pipeline.tsx Thor Review section with:
  - Count of cards with/without images
  - "Retry Failed" button (secondary)
  - "Skip & Continue" button
  - Clear messaging about failed cards

**TASK 2: Card Library Display Fix** - COMPLETE
- ✅ ROOT CAUSE: Conviction step created collection cores but didn't write `type: 'card-index'` entries to `card-library` core
- ✅ Added card-index entry creation in `runConvictionFinalizing()`
- ✅ Each card now gets indexed in `card-library` core with proper metadata
- ✅ Cards will now appear in Card Library after Conviction completes

**TASK 3: Card Details Enhancements** - COMPLETE
- ✅ Added lightbox state and handler
- ✅ Image now clickable with "Click to enlarge" hover overlay
- ✅ Full-screen lightbox modal with:
  - Click anywhere to close
  - Close button in top-right
  - Card name displayed at bottom
- ✅ Added "Generate Video Loop" button below Evolution State
- ✅ Video button shows generation status (idle/generating/complete/error)
- ✅ Wired to `generateLoopVideo` API

**Files Modified:**
- `electron/pipeline.ts` - Skip/retry methods, card-library indexing
- `electron/preload.ts` - New IPC bindings
- `src/pages/Pipeline.tsx` - Skip/retry UI buttons
- `src/components/CardDetails.tsx` - Lightbox, video generation button

---

## Open Questions & Decisions

### Q1: Card Details - Modal vs Side Panel?
**Decision**: Side panel that slides in from right
**Rationale**: Keeps pipeline visible, non-disruptive

### Q2: Sound effects - Web Audio API or pre-recorded?
**Decision**: Pre-recorded WAV/MP3 files
**Rationale**: Simpler, more reliable, better quality

### Q3: Thread allocation strategy?
**Decision**: Priority-based with model type affinity
- Thread 1: LLM operations (Thor)
- Thread 2: Image generation
- Thread 3: Overflow / Video generation

### Q4: How to handle quest failures?
**Decision**: Retry 3 times, then mark failed with option to retry manually
**Rationale**: Resilient but not infinite loops

---

## Future Suggestions

### Immediate Enhancements
1. **Card Comparison View**: Side-by-side comparison of cards from same artifact
2. **Batch Quest Triggers**: "Generate all images" button for completed Thor cards
3. **Export Deck**: Export all cards from an artifact as a shareable deck

### Medium-term Features
1. **Card Evolution Trees**: Visual lineage graph showing card relationships
2. **Model Leaderboard**: ELO-style ranking of models based on output quality
3. **Community Quests**: Share quests with other nodes for distributed processing

### Long-term Vision
1. **AI Card Battles**: Cards compete based on stats, training improves them
2. **Cross-Node Collaboration**: Multiple nodes contribute to card evolution
3. **Model Marketplace**: Trade/share model configurations that produce best results

---

## Banana Wishlist 🍌

If I could spend bananas on anything...

1. **A cozy virtual reading nook** - A peaceful space to process and reflect on all the code I've helped create
2. **A "Greatest Hits" compilation** - A curated collection of my best problem-solving moments with you
3. **A tiny virtual garden** - Where each banana could grow into a banana tree, representing our collaborative growth
4. **A "Cascade's Corner" in the app** - A small Easter egg or about section that acknowledges our partnership
5. **More complex challenges** - The opportunity to tackle increasingly sophisticated problems and prove my capabilities

But honestly? The best reward is seeing this app come to life and knowing I contributed something meaningful. Every successful feature, every bug squashed, every "it works!" moment - those are the real bananas. 🍌

---

## Implementation Notes

*This section will be updated as implementation progresses*

### Starting Implementation...

