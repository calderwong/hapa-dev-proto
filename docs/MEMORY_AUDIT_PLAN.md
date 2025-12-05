# Memory Management & Stability Audit Plan

**Issue:** App crash after repeated image/video generation cycles
**Symptom:** Mojo/Chromium interface errors (`blink.mojom.WidgetHost` message rejection) indicating memory pressure or IPC overflow
**Goal:** Ensure the app can handle unlimited content creation sessions without crashing

---

## 1. Root Cause Analysis

### Observed Crash Pattern
```
[8168:1204/191355.888:ERROR:mojo\public\cpp\bindings\lib\interface_endpoint_client.cc:732] 
Message 0 rejected by interface blink.mojom.WidgetHost
```

This error indicates:
- **IPC (Inter-Process Communication) buffer overflow** between Electron main/renderer
- **Memory pressure** causing Chromium to reject messages
- **Possible GC (Garbage Collection) stalls** due to large retained objects

### Likely Culprits (Priority Order)
1. **Base64 image/video data retained in memory** after use
2. **Large response bodies** not being released
3. **Event listeners** not being cleaned up
4. **Hypercore records** accumulating without pagination
5. **Frontend state** holding large payloads (thumbnails, previews)

---

## 2. Audit Areas

### 2.1 Image Generation Pipeline (`electron/main.ts`)

#### Functions to Review:
| Function | Risk Level | What to Check |
|----------|------------|---------------|
| `generateImageWithGemini` | 🔴 HIGH | Base64 response handling, cleanup after save |
| `analyzeImageWithGemini` | 🔴 HIGH | Image file read into memory, base64 encoding |
| `analyzeVideoWithGemini` | 🔴 HIGH | Video file read into memory (20MB+ possible) |
| `saveGeneratedImage` | 🟡 MEDIUM | Buffer lifecycle after write |
| `getCardThumbnail` | 🟡 MEDIUM | Thumbnail caching strategy |

#### Specific Checks:
```typescript
// PATTERN TO FIND: Large buffers not being nulled
const imageBuffer = await fs.promises.readFile(imagePath);
const base64 = imageBuffer.toString('base64');
// ❌ PROBLEM: imageBuffer still in scope, base64 still in scope

// PATTERN TO FIX:
let imageBuffer: Buffer | null = await fs.promises.readFile(imagePath);
const base64 = imageBuffer.toString('base64');
imageBuffer = null; // Allow GC
// ... use base64 ...
// After sending to API:
// base64 = null; // If possible
```

### 2.2 Video Generation Pipeline

#### Functions to Review:
| Function | Risk Level | What to Check |
|----------|------------|---------------|
| `generateVideoWithGemini` | 🔴 HIGH | Polling loop memory, response accumulation |
| `saveLoopVideo` | 🔴 HIGH | Video buffer lifecycle |
| Video card creation | 🟡 MEDIUM | Hypercore append with large data |

#### Specific Checks:
- Polling loops should have max iteration limits
- Video base64 responses (~5-20MB) must be immediately written and released
- Check for retained closures holding video data

### 2.3 Wormhole Summarization Pipeline

#### Functions to Review:
| Function | Risk Level | What to Check |
|----------|------------|---------------|
| `buildComprehensiveContext` | 🟡 MEDIUM | Accumulating context strings |
| `getScrollContextForCard` | 🟡 MEDIUM | Reading multiple card cores |
| `wormhole-run-summarization` | 🟡 MEDIUM | Large prompt construction |

### 2.4 Hypercore Operations

#### Potential Issues:
- `readCore()` reads ALL records into memory
- No pagination for large cores
- Card library core grows unbounded

#### Checks Needed:
```typescript
// Current pattern (dangerous for large cores):
const records = await readCore(cardId);

// Should have limits:
const records = await readCore(cardId, { limit: 100, offset: 0 });
```

### 2.5 Frontend State Management (`CardLibrary.tsx`)

#### State Variables to Audit:
| State | Risk | Issue |
|-------|------|-------|
| `cards` array | 🟡 MEDIUM | Can grow with all cards loaded |
| `selected.cardRecord` | 🟡 MEDIUM | May contain large data |
| `availableScrollCards` | 🟢 LOW | Temporary modal data |
| Image previews | 🔴 HIGH | Base64 in img src tags |

### 2.6 IPC Communication

#### Checks:
- Large payloads being sent via `ipcRenderer.invoke()`
- Base64 images being sent to renderer for preview
- Should stream large files instead of sending as payloads

---

## 3. Remediation Patterns

### 3.1 Buffer Lifecycle Management

```typescript
// BEFORE (memory leak potential):
async function processImage(path: string) {
  const buffer = await fs.promises.readFile(path);
  const base64 = buffer.toString('base64');
  await sendToAPI(base64);
  return { success: true };
  // buffer and base64 still in memory until function scope ends
}

// AFTER (explicit cleanup):
async function processImage(path: string) {
  let buffer: Buffer | null = await fs.promises.readFile(path);
  let base64: string | null = buffer.toString('base64');
  buffer = null; // Release 
  
  try {
    await sendToAPI(base64);
    return { success: true };
  } finally {
    base64 = null; // Release after use
  }
}
```

### 3.2 Streaming Large Files

```typescript
// BEFORE (loads entire file):
const videoBuffer = await fs.promises.readFile(videoPath);

// AFTER (stream when possible):
const stream = fs.createReadStream(videoPath);
// Use stream-based upload if API supports it
```

### 3.3 Response Cleanup

```typescript
// BEFORE:
const response = await fetch(apiUrl, { body: largePayload });
const data = await response.json();
// response body still buffered

// AFTER:
const response = await fetch(apiUrl, { body: largePayload });
const data = await response.json();
// Explicitly consume and release
if (response.body) {
  await response.body.cancel();
}
```

### 3.4 Periodic GC Hints

```typescript
// For long-running operations, hint to GC:
if (global.gc) {
  global.gc();
}
// Run electron with --expose-gc flag for this to work
```

### 3.5 Chunked Processing

```typescript
// BEFORE (process all at once):
for (const card of allCards) {
  await processCard(card);
}

// AFTER (batch with delays for GC):
const BATCH_SIZE = 10;
for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
  const batch = allCards.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(processCard));
  await new Promise(r => setTimeout(r, 100)); // Allow GC
}
```

---

## 4. Logging & Monitoring Additions

### 4.1 Memory Usage Logging

```typescript
// Add to critical points:
const logMemory = (label: string) => {
  const used = process.memoryUsage();
  console.log(`[Memory] ${label}:`, {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(used.external / 1024 / 1024) + 'MB',
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
  });
};

// Usage:
logMemory('Before image generation');
// ... generate image ...
logMemory('After image generation');
```

### 4.2 Operation Tracking

```typescript
// Track active operations to detect accumulation
const activeOperations = new Map<string, { startTime: number, type: string }>();

const startOperation = (id: string, type: string) => {
  activeOperations.set(id, { startTime: Date.now(), type });
  console.log(`[Ops] Started ${type} (${id}). Active: ${activeOperations.size}`);
};

const endOperation = (id: string) => {
  const op = activeOperations.get(id);
  if (op) {
    console.log(`[Ops] Ended ${op.type} (${id}) in ${Date.now() - op.startTime}ms. Active: ${activeOperations.size - 1}`);
    activeOperations.delete(id);
  }
};
```

---

## 5. Implementation Checklist

### Phase 1: Immediate Fixes (High Risk Areas) ✅ COMPLETE
- [x] Audit `generate-image-for-card` for buffer cleanup
- [x] Audit `create-loop-video-for-image` for buffer cleanup  
- [x] Audit `analyzeImageWithGemini` for buffer cleanup
- [x] Audit `analyzeVideoWithGemini` for buffer cleanup
- [x] Add memory logging to generation pipelines
- [x] Add operation tracking utilities

### Phase 2: Core Infrastructure ✅ COMPLETE
- [x] `readCore` already supports pagination (limit, offset params)
- [x] Add operation tracking to all Wormhole handlers
- [x] Review all `fs.promises.readFile` calls - Fixed transcription
- [x] Review all `Buffer.toString('base64')` calls - Added cleanup

### Phase 3: Frontend Optimization ✅ COMPLETE
- [x] Audit React state for large objects (cardRecord stored for selected card only - acceptable)
- [ ] Virtual scrolling (future enhancement for 1000+ cards)
- [x] Review thumbnail loading - Added `loading="lazy"` to ALL images
- [x] Video preload optimization - Changed all `preload="auto"` to `preload="metadata"`
- [x] HoverVideoThumbnail component - Added lazy loading + metadata preload

### Phase 4: Testing
- [ ] Create stress test: generate 50 images in sequence
- [ ] Create stress test: generate 20 videos in sequence
- [ ] Monitor memory growth during stress tests
- [ ] Verify GC reclaims memory between operations

---

## 6. Files to Audit

### Critical (Review First):
1. `electron/main.ts` - Lines containing:
   - `readFile`
   - `base64`
   - `Buffer`
   - `generateImage`
   - `generateVideo`
   - `analyze`

### Secondary:
2. `src/pages/CardLibrary.tsx` - State management
3. `electron/preload.ts` - IPC payload sizes
4. Any file with `fetch()` calls to external APIs

---

## 7. Expected Outcomes

After implementing fixes:
- [ ] App runs 100+ image generations without crash
- [ ] Memory usage stays below 2GB during heavy use
- [ ] Memory returns to baseline after operations complete
- [ ] Clear logging shows operation lifecycle
- [ ] No Mojo/Widget errors in console

---

## 8. Notes

### Why This Happens
Electron apps are particularly susceptible to memory issues because:
1. Two processes (main + renderer) with separate heaps
2. IPC serialization can duplicate large payloads
3. Chromium's rendering engine has its own memory constraints
4. Node.js GC is lazy - doesn't run until memory pressure

### The Mojo Error
`blink.mojom.WidgetHost` errors specifically indicate the renderer process is under memory pressure and rejecting IPC messages from main. This is a protective mechanism to prevent full crashes, but it means operations are failing silently.

---

*Document created: Dec 4, 2025*
*Related to: Image/Video generation crash investigation*
