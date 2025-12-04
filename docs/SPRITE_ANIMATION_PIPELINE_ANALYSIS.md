# Sprite Animation Pipeline - Deep Analysis & Fix Plan

## Date: Dec 3, 2025

## Current State: BROKEN

### Observed Problems
1. **VIEW button does nothing** - Placeholder `onClick={() => {}}` with no implementation
2. **MAKE GIF button disappears** - When animation generator opens, button is hidden (intentional but confusing UX)
3. **Generated cards NOT appearing in Library** - New cards aren't visible in the card grid
4. **Generated cards NOT linked to parent** - "Derived Assets" shows "No derived assets"
5. **Generated image IS appearing** - The walk cycle sprite sheet IS being generated and displayed in the success view

---

## CRITICAL FINDING: `wormholeIngestContent` Does NOT Support Images!

Looking at `electron/main.ts` lines 3400-3414:
```typescript
const ext = path.extname(filePath || '').toLowerCase();
let inferredMediaType: 'text' | 'markdown' | 'pdf' | 'audio' | 'video' = 'text';
// NO 'image' TYPE!
```

And lines 3420-3425:
```typescript
let kind: 'document' | 'audio' | 'video' = 'document';
// NO 'image' KIND!
```

When we pass `mediaType: 'image'`, it's NOT recognized! The card is created as a 'document'.
This is why cards might not display correctly in the library.

## CRITICAL FINDING 2: The `card.children` Prop is STALE

- `CardWorkspace` receives `card` as a prop from `CardLibrary`
- When we `p2pAppend()` to add children, the P2P store is updated
- BUT the `card` JavaScript object in memory is NOT updated
- So `card.children` will ALWAYS be undefined until the component re-mounts
- The `onUpdate()` callback refreshes the library, but CardWorkspace keeps the old prop

---

## Root Cause Analysis

### The Pipeline Should Work Like This:
```
User has Seed Card (Orange Cat)
    ↓
Click "Generate Animation" 
    ↓
Enter prompt ("idle animation") + Click GENERATE
    ↓
Backend: generateImageForCard() → Returns { localPath, success }
    ↓
Frontend: Fetch image from localPath → Convert to base64
    ↓
Frontend: wormholeIngestContent() → SHOULD create new card core → Returns { cardId }
    ↓
Frontend: p2pAppend() to NEW card → Add metadata (parentId, subType)
    ↓
Frontend: p2pAppend() to PARENT card → Add child link to children[]
    ↓
Frontend: p2pAppend() to card-library → Add index entry
    ↓
UI: Show success + Update "Derived Assets" list
```

### Where It's Failing:

#### Problem 1: `wormholeIngestContent` Behavior Unknown
- Does it actually create a P2P core? 
- Does it automatically add to card-library?
- What structure does it return?
- We're assuming it returns `{ cardId }` but haven't verified.

#### Problem 2: The `card` Prop is STALE
- `CardWorkspace` receives `card` as a prop from `CardLibrary`
- When we do `p2pAppend()` to the parent, it updates the P2P store
- BUT the `card` JavaScript object in memory is NOT updated
- So `card.children` will ALWAYS be undefined until parent component re-renders with fresh data
- `onUpdate()` triggers library refresh, but does it reload the specific card?

#### Problem 3: Local State Not Tracking Children
- We set `lastAnimationResult` for the preview
- But we DON'T track generated children in local state
- Even if P2P works, the UI won't show them until page refresh

#### Problem 4: Card Library Index Structure Mismatch?
- We append to `card-library` with `type: 'card-index'`
- But does CardLibrary.tsx read this format correctly?
- CardLibrary might expect different fields

## The Fix

### Fix 1: Track Generated Children Locally
Instead of relying on `card.children` (which is stale), maintain local state:
```typescript
const [generatedChildren, setGeneratedChildren] = useState<any[]>(card.children || []);
```
After successful generation, update this local array.

### Fix 2: Make VIEW Button Functional
Open the image in a modal or navigate to the new card.

### Fix 3: Fix MAKE GIF UX
Keep the button visible or show "CLOSE GENERATOR" instead of hiding.

### Fix 4: Verify wormholeIngestContent
Check if it's actually creating cards. Add console logs.

### Fix 5: Verify CardLibrary Index Update
Ensure the structure matches what CardLibrary expects.

## Fixes Applied (Dec 3, 2025)

### 1. Backend: `wormholeIngestContent` Image Support
- Added 'image' to `inferredMediaType` union type
- Added image extension detection (.png, .jpg, .jpeg, .gif, .webp, .bmp, .svg)
- Added 'image' to `kind` union type
- Added image data handling (localPath, url, imageUrl, mimeType)

### 2. Frontend: Local Children State Tracking
- Added `generatedChildren` state to CardWorkspace (initializes from `card.children`)
- Added `viewingImage` state for lightbox modal
- Updated `handleGenerateAnimation` to add children to local state immediately

### 3. Frontend: VIEW Button Functionality
- Added `onView` prop to SpriteAnimationGenerator
- VIEW button now opens a full-screen lightbox modal
- Clicking the generated image also opens the lightbox

### 4. Frontend: Button UX Improvements
- GENERATE ANIMATION button now toggles to "CLOSE GENERATOR" when open
- MAKE GIF button now toggles to "CLOSE" when open
- Buttons show highlighted border when their panel is active

### 5. Frontend: Derived Assets Display
- Updated to use `generatedChildren` instead of stale `card.children` prop
- Shows count in header: "Derived Assets (N)"
- Each child shows thumbnail preview
- Clicking a child opens the lightbox
- Added helpful message when empty

## Implementation Checklist
- [x] Add local `generatedChildren` state to CardWorkspace
- [x] Update state when animation is generated  
- [x] Display `generatedChildren` instead of `card.children`
- [x] Make VIEW button open a modal with the full image
- [x] Fix MAKE GIF button visibility (now toggles)
- [x] Add image support to wormholeIngestContent
- [ ] Verify cards appear in library after generation (requires testing)
