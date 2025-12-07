# Card Inspector Bug Fixes - 2025-12-06

## Issues Reported

### Issue 1: "Create Image" Button Fails
**Symptom:** Card Inspector "Create Image" button fails with error
**Console Error:** `Vertex AI Image Generation failed: Error: No image data in response`
**Root Cause:** TBD - investigating

### Issue 2: "Create Loop Video" Button Fails
**Symptom:** Button doesn't work
**Console Error:** TBD
**Root Cause:** TBD

### Issue 3: Hell Week Cards Missing Parent
**Symptom:** Cards show "Original (No Parent)" instead of Set Card parent
**Expected:** Cards created by Hell Week should reference their Set Card as parent
**Root Cause:** TBD - checking pipeline code

### Issue 4: Hell Week Data Not Displayed
**Symptom:** Skills, lore, and other Hell Week data not showing in Card Inspector
**Expected:** Card data (lore, skills, stats) should be visible
**Root Cause:** TBD - checking if data is stored/retrieved correctly

---

## Investigation Log

### Issue 1 Analysis
From console output:
```
[ImageGen] Using Vertex AI for image generation
[ImageGen] Vertex AI Image Generation failed: Error: No image data in response
  at VertexAIClient.generateImageGemini (vertexai.js:336:19)
```

**Finding:** The Card Inspector is calling `generateImageGemini()` with `common-image` shorthand.
However, `gemini-2.0-flash-exp` is a MULTIMODAL model (can analyze images) but CANNOT GENERATE images.

**Hell Week Pipeline uses:** `generateImageImagen()` with `pro-image` → `imagen-4.0-generate-001`

**Fix Required:** Card Inspector must use `generateImageImagen()` or a similar Imagen-based call.

---

## Fix Tracker

| Issue | Status | Fix Applied | Verified |
|-------|--------|-------------|----------|
| 1. Create Image | ✅ Fixed | Use `generateImageImagen` with `pro-image` | Pending |
| 2. Create Loop Video | ✅ Fixed | Updated to write children to card-library index | Pending |
| 3. Missing Parent | ✅ Fixed | Added `parentCardId: setCardId` to pipeline | Pending |
| 4. Hell Week Data | ✅ Fixed | Added `cardData` and `mediaPrompts` to index | Pending |

---

## Fixes Applied

### Issue 1: Create Image - FIXED
**Root Cause:** `generate-image-for-card` was calling `generateImageGemini()` with `common-image` shorthand, but Gemini Flash cannot generate images - only analyze them.

**Fix:** Changed to `generateImageImagen()` with `pro-image` shorthand, same as Hell Week pipeline.

**File:** `electron/main.ts` line ~2329

```typescript
// BEFORE (broken):
const result = await vertexClient.generateImageGemini(craftedPrompt, 'common-image');

// AFTER (fixed):
const result = await vertexClient.generateImageImagen(craftedPrompt, 'pro-image', {
    aspectRatio: '1:1',
    sampleCount: 1,
});
```

### Issue 3: Missing Parent - FIXED
**Root Cause:** Pipeline did not set `parentCardId` on standard cards.

**Fix:** Added `parentCardId: setCardId` to card index entries.

**File:** `electron/pipeline.ts` line ~926

### Issue 4: Hell Week Data Not Displayed - FIXED
**Root Cause:** Two problems:
1. Pipeline wasn't including `cardData` (skills, lore, stats) in card index
2. Frontend wasn't extracting new fields from card index

**Fixes:**
1. Pipeline now includes full `cardData` and `mediaPrompts` in card index
2. Frontend `loadCards()` now extracts all new fields
3. Frontend `enrichWithCardRecords()` merges index data with hypercore data

**Files:**
- `electron/pipeline.ts` - Added cardData, mediaPrompts to card index
- `src/pages/CardLibrary.tsx` - Updated loadCards and enrichWithCardRecords

---

### Issue 2: Loop Video Not Showing Behind Hero - FIXED
**Root Cause:** Loop video children were written to a hypercore with the card's ID, but Hell Week cards don't have individual hypercores - they're stored in the card-library index.

**Fix:** Updated loop video handler to write children to the card-library index entry, which is where Hell Week cards are read from.

**File:** `electron/main.ts` lines ~2778-2865

### Issue 5: Retroactive Parent Fix - ADDED
**Feature:** Added `repair-hell-week-parents` IPC handler that:
1. Scans all cards in card-library
2. Finds cards with `setId` but no `parentCardId`
3. Sets `parentCardId = setId` and adds `memberOfSets[]`
4. Appends corrected entries to card-library

**Usage:** Click "Recover" button in Card Library (now runs both recovery and repair)

**Files:**
- `electron/main.ts` - Added `repair-hell-week-parents` IPC handler
- `electron/preload.ts` - Exposed `repairHellWeekParents`
- `src/pages/CardLibrary.tsx` - Updated Recover button to also run repair

---

## Files Modified

- `electron/main.ts` - IPC handler `generate-image-for-card` (Issue 1), loop video children (Issue 2), repair handler (Issue 5)
- `electron/pipeline.ts` - Card creation with parentCardId and cardData (Issues 3, 4)
- `electron/preload.ts` - Exposed repairHellWeekParents (Issue 5)
- `src/pages/CardLibrary.tsx` - Card loading, display, and Recover button (Issues 2, 3, 4, 5)

