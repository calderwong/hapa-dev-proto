# Derivative Card Taxonomy - Design Document

## Date: Dec 3, 2025
## Status: Planning

---

## Core Principle

> **Every AI-generated derivative gets its own Card and Hypercore.**
> 
> All derivatives maintain parent-child relationships, enabling:
> - Click-through navigation
> - Provenance tracking
> - Independent metadata/XP/affixes
> - P2P sync of individual assets

---

## Current State Analysis

### How It Works Now
```
📄 Parent Card (e.g., document, audio file)
    ├── imageVersions: ["url1", "url2", "url3"]     ← EMBEDDED, not separate cards
    ├── loopVideos: [{url, prompt}]                  ← EMBEDDED arrays
    └── data.imageUrl (single thumbnail)
```

### Problems
1. **Images aren't clickable cards** - they're just URLs in an array
2. **No individual metadata** - images can't have their own XP, tags, affixes
3. **No provenance chain** - can't track "this video came from THIS image"
4. **Inconsistent** - loop videos ARE cards (Image 3 shows this), but source images aren't

---

## Proposed Taxonomy

### New Hierarchy
```
📄 Source Card (document, audio, etc.)
    │
    ├── 📷 Image Card #1 (type: 'image', subType: 'generated')
    │       ├── 🎬 Loop Video Card (type: 'video', subType: 'loop-video')
    │       └── 📷 Upscaled Image (type: 'image', subType: 'upscaled')
    │
    ├── 📷 Image Card #2 (type: 'image', subType: 'generated')
    │       └── 🎬 Loop Video Card
    │
    └── 📷 Image Card #3 (type: 'image', subType: 'generated')
```

### Card Data Structure

#### Image Card
```typescript
{
  id: "img-1733282400000",
  type: "card",
  mediaType: "image",
  subType: "generated",  // or "upscaled", "sprite-sheet", "seed", etc.
  
  parentId: "source-card-id",  // Links to source document
  
  title: "Generated Image #1",
  thumbnail: "data:image/...",
  
  wormhole: {
    ingest: {
      originalPath: "/path/to/image.png"
    }
  },
  
  // Generation metadata
  generationPrompt: "A futuristic card game...",
  generationModel: "gemini-2.0-flash-exp",
  generationIndex: 1,  // Which # in sequence
  
  // Child references
  children: [
    { cardId: "loop-123", type: "loop-video", label: "Loop Video" }
  ],
  
  // Standard card fields
  tags: ["generated", "ai-image"],
  createdAt: "2025-12-03T..."
}
```

#### Parent Card Updated
```typescript
{
  id: "parent-card-id",
  // ... existing fields ...
  
  children: [
    { cardId: "img-1", type: "image", label: "Generated Image #1" },
    { cardId: "img-2", type: "image", label: "Generated Image #2" },
    { cardId: "loop-1", type: "loop-video", label: "Loop Video" }  // Legacy support
  ],
  
  // DEPRECATED - keep for backwards compat but don't add new items
  imageVersions: ["url1", "url2"]  // Will be migrated to children
}
```

---

## UI/UX Changes

### 1. Card Inspector Gallery (CARD INSPECTOR in screenshots)

**Current:** Images displayed in grid, clicking does... nothing? or selects?
**New:** 
- Each image is **clickable** → opens Image Card detail view
- Shows small "child count" badge if image has derivatives (loop videos)
- Hover still shows loop video preview if available

```
┌─────────────────┐
│  [Image #1]     │  ← Click → Opens Image Card Detail
│     🎬 1        │  ← Badge shows 1 loop video child
└─────────────────┘
```

### 2. Image Card Detail Page

New page/view for `mediaType: 'image'`:

```
┌────────────────────────────────────────────────────┐
│  CARD INSPECTOR                              [X]   │
├────────────────────────────────────────────────────┤
│                                                    │
│        ┌──────────────────────┐                    │
│        │                      │                    │
│        │    [Large Image]     │     CARD NAME      │
│        │                      │     Generated      │
│        │                      │     Image #1       │
│        └──────────────────────┘                    │
│                                         Created    │
│  [🔄 Generate Loop Video]               12/3/2025  │
│  [🔍 Upscale Image]                              │
│  [✨ Create Variation]                  Parent Card │
│                                   [← View Parent]  │
│                                                    │
│  ─────────────────────────────────                 │
│  GENERATION DETAILS                                │
│  Model: Gemini 2.0 Flash                          │
│  Prompt: "A futuristic card game..."              │
│                                                    │
│  ─────────────────────────────────                 │
│  DERIVED ASSETS (1)                               │
│  ┌────────────┐                                   │
│  │ 🎬 Loop    │                                   │
│  │   Video    │                                   │
│  └────────────┘                                   │
└────────────────────────────────────────────────────┘
```

### 3. Image Generation Flow (Updated)

**When "GENERATE NEXT IMAGE" is clicked:**

1. Generate image via AI
2. **Create new Hypercore** for image card
3. **Ingest image** via Wormhole (saves file)
4. **Create Image Card** with:
   - `mediaType: 'image'`
   - `subType: 'generated'`
   - `parentId: <source card id>`
   - Generation metadata
5. **Update parent card's children array**
6. **Add to card-library index**
7. Display in gallery (now as clickable card)

### 4. Loop Video Generation Flow (Updated)

**When loop video is generated FROM an image:**

1. Generate video via AI
2. Create new Hypercore for video card
3. Ingest video via Wormhole
4. **Create Video Card** with:
   - `mediaType: 'video'`
   - `subType: 'loop-video'`
   - `parentId: <IMAGE card id>` ← **KEY CHANGE: parent is IMAGE, not source**
5. **Update IMAGE card's children array**
6. Add to card-library index

### 5. Hover Preview Behavior (Keep As-Is)

When hovering over an image (in gallery or anywhere):
- Check if image card has children with `type: 'loop-video'`
- If yes, play video as background
- This works the same, just uses new data structure

---

## Implementation Plan

### Phase 1: Data Model Updates
- [ ] Update TypeScript interfaces for Image Card type
- [ ] Add `generationPrompt`, `generationModel`, `generationIndex` fields
- [ ] Update card creation utilities

### Phase 2: Image Generation Refactor
- [ ] Modify `handleGenerateImage` to create separate Image Cards
- [ ] Each image gets own Hypercore via `p2pCreateCore`
- [ ] Link via children array, not imageVersions
- [ ] Backwards compat: keep reading imageVersions for old cards

### Phase 3: Image Card Detail View
- [ ] Create or extend CardWorkspace for `mediaType: 'image'`
- [ ] Display generation metadata
- [ ] Add "Generate Loop Video" button
- [ ] Show derived assets (child videos)

### Phase 4: Gallery Click-Through
- [ ] Make gallery images clickable
- [ ] Navigate to Image Card detail on click
- [ ] Show child count badges

### Phase 5: Loop Video Parent Update
- [ ] When generating loop video, parent is now IMAGE card
- [ ] Update the image card's children array
- [ ] "View Parent Card" on video goes to IMAGE, not source

### Phase 6: Migration (Optional)
- [ ] Script to migrate old `imageVersions` to child Image Cards
- [ ] Preserve URLs, create cards retroactively

---

## Relationship Graph

```
                    ┌─────────────────┐
                    │  Source Card    │
                    │  (Document)     │
                    └────────┬────────┘
                             │ children
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Image #1 │   │ Image #2 │   │ Image #3 │
        │  (Card)  │   │  (Card)  │   │  (Card)  │
        └────┬─────┘   └──────────┘   └──────────┘
             │ children
             ▼
        ┌──────────┐
        │ Loop Vid │
        │  (Card)  │
        └──────────┘
```

---

## Hover Preview Logic (Pseudocode)

```typescript
function getLoopVideoForImage(imageCard: Card): string | null {
  // Find child loop video
  const loopVideoChild = imageCard.children?.find(c => c.type === 'loop-video');
  if (!loopVideoChild) return null;
  
  // Fetch the video card to get URL
  const videoCard = await getCard(loopVideoChild.cardId);
  return videoCard?.data?.videoUrl || videoCard?.wormhole?.ingest?.originalPath;
}

// In thumbnail component:
onHover={() => {
  const videoUrl = getLoopVideoForImage(imageCard);
  if (videoUrl) playVideoBackground(videoUrl);
}}
```

---

## Backwards Compatibility

### Reading Old Cards
```typescript
// When loading gallery images:
function getCardImages(card: Card): ImageReference[] {
  const images: ImageReference[] = [];
  
  // NEW: From children array
  const imageChildren = card.children?.filter(c => c.type === 'image') || [];
  images.push(...imageChildren.map(c => ({ cardId: c.cardId, isCard: true })));
  
  // LEGACY: From imageVersions array
  if (card.imageVersions?.length) {
    images.push(...card.imageVersions.map((url, i) => ({ 
      url, 
      isCard: false,
      legacyIndex: i 
    })));
  }
  
  return images;
}
```

### Writing New Data
- Always create Image Cards for new generations
- Never add to `imageVersions` array (deprecated)

---

## Success Criteria

- [ ] Every generated image is its own Card with Hypercore
- [ ] Images are clickable and open detail view
- [ ] Loop videos correctly parent to IMAGE cards, not source
- [ ] "View Parent Card" on loop video goes to image
- [ ] Hover preview still works using new data structure
- [ ] Old cards with `imageVersions` still display correctly
- [ ] Card count in library reflects image cards

---

## Open Questions

1. **Gallery thumbnail source**: When showing source card in library, which image is the thumbnail?
   - Option A: First child image card's thumbnail
   - Option B: Dedicated `thumbnail` field on parent
   - **Recommendation**: Keep parent's thumbnail separate, let user choose

2. **Orphan images**: What if parent card is deleted?
   - Keep image cards as orphans (parentId points to deleted)
   - Or cascade delete?
   - **Recommendation**: Keep orphans, mark as "unlinked"

3. **Batch operations**: Generate 6 images at once
   - Create 6 separate cards in parallel
   - Show progress for each
   - **Recommendation**: Yes, parallel creation with batch UI

---

## Files to Modify

1. `src/components/CardWorkspace.tsx` - Image generation flow
2. `src/pages/CardLibrary.tsx` - Gallery click handling  
3. `src/components/CardInspector.tsx` - If separate from workspace
4. `src/types/` - Add Image Card interfaces
5. `electron/wormhole.ts` - May need updates for new card types
6. `electron/p2p.ts` - Hypercore creation for images
