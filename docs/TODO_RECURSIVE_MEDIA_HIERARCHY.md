# TODO: Recursive Media Hierarchy & Enhanced Card Details

## Problem Statement
Video cards created from loop generation need full card functionality:
- Image generation with parent+self context
- Own image set/gallery
- Loop video creation from those images
- Recursive parent-child relationships
- Proper UI for all card types

## Current Issues
1. ❌ Images created on video cards disappear (not saved to video card's record)
2. ❌ Video cards don't have full AI Images panel functionality
3. ❌ No visual indicator for images that have loop videos (besides badge)
4. ❌ Video cards don't auto-play/loop
5. ❌ No global mute state management

---

## Implementation Plan

### Phase 1: Fix Video Card Image Generation
**Goal:** Images generated on video cards persist and display correctly

- [ ] 1.1 Update `handleGenerateImage` to work for ANY card type (not just parent cards)
- [ ] 1.2 Ensure video cards have proper `coreName` for Hypercore saves
- [ ] 1.3 Include parent context when generating images for child cards
  - Traverse up parent chain to collect context
  - Pass combined context to LLM for richer prompts
- [ ] 1.4 Test: Generate image on video card → image persists and displays

### Phase 2: Unified Image Gallery for All Cards
**Goal:** Every card type shows its image set with full controls

- [ ] 2.1 Refactor AI Images panel to work for all card types
- [ ] 2.2 Video cards show their own `imageSet` gallery
- [ ] 2.3 Loop video buttons work on video card images too
- [ ] 2.4 Recursive: Video → Image → Video → Image... all linked

### Phase 3: Enhanced Visual Indicators
**Goal:** Images with loop videos are visually distinct

- [ ] 3.1 Add neon glow border to images with loop videos
  - Purple/magenta glow using box-shadow
  - CSS class: `has-loop-video`
- [ ] 3.2 Keep LOOP badge but make border the primary indicator
- [ ] 3.3 Animate glow subtly (pulse or shimmer)

### Phase 4: Card Lineage Display
**Goal:** Show parent-child hierarchy clearly

- [ ] 4.1 "Card Lineage" section in all card details
- [ ] 4.2 Show parent card (clickable, with thumbnail)
- [ ] 4.3 Show children cards (clickable list with thumbnails)
- [ ] 4.4 Breadcrumb-style lineage path at top

### Phase 5: Video Auto-Play & Global Mute
**Goal:** Video cards play automatically, respecting user volume preference

- [ ] 5.1 Add global mute state (persisted to localStorage)
- [ ] 5.2 Video card detail view auto-plays video (looping)
- [ ] 5.3 Mute button in video player respects global state
- [ ] 5.4 Header mute button affects all videos app-wide

### Phase 6: Data Schema Updates
**Goal:** Clean parent-child relationships in Hypercore

- [ ] 6.1 Ensure all cards have: `parentCardId`, `childCardIds[]`
- [ ] 6.2 When creating child card, update parent's `childCardIds`
- [ ] 6.3 Migration for existing cards without these fields

---

## Technical Details

### Parent Context Collection
```typescript
const collectParentContext = async (card: CardIndexEntry): Promise<string[]> => {
  const contexts: string[] = [];
  let current = card;
  
  while (current.parentCardId) {
    const parent = await loadCardById(current.parentCardId);
    if (parent) {
      contexts.unshift(parent.name || '');
      if (parent.cardRecord?.summaries) {
        contexts.unshift(parent.cardRecord.summaries.join(' '));
      }
      current = parent;
    } else break;
  }
  
  return contexts;
};
```

### Image with Loop Video Styling
```css
.image-has-loop {
  border: 2px solid transparent;
  box-shadow: 
    0 0 10px rgba(168, 85, 247, 0.5),
    0 0 20px rgba(168, 85, 247, 0.3),
    0 0 30px rgba(168, 85, 247, 0.2);
  animation: loop-glow 2s ease-in-out infinite alternate;
}

@keyframes loop-glow {
  from { box-shadow: 0 0 10px rgba(168, 85, 247, 0.5); }
  to { box-shadow: 0 0 20px rgba(168, 85, 247, 0.8); }
}
```

### Global Mute State
```typescript
// In a context or global state
const [globalMuted, setGlobalMuted] = useState(() => {
  return localStorage.getItem('globalMuted') === 'true';
});

useEffect(() => {
  localStorage.setItem('globalMuted', String(globalMuted));
}, [globalMuted]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `CardLibrary.tsx` | Fix image save for video cards, parent context, unified gallery |
| `main.ts` | Update child card creation to include childCardIds on parent |
| `index.css` | Add loop-glow animation and has-loop-video class |
| `App.tsx` or Context | Global mute state |

---

## Testing Checklist

- [ ] Create image on video card → persists and displays
- [ ] Create loop video from video card's image → new video card created
- [ ] Navigate between parent/child cards
- [ ] Images with loops have glowing border
- [ ] Video cards auto-play (looping, respecting mute)
- [ ] Mute state persists across app reload
- [ ] Deep hierarchy: Card → Image → Video → Image → Video... all linked

---

## Review Notes

### Potential Issues to Watch For:
1. **Infinite loops** - Don't allow circular parent references
2. **Performance** - Deep hierarchies may slow context collection
3. **Core naming** - Ensure unique core names for each card
4. **Race conditions** - Image save vs display timing

### Improvements Made During Review:
1. Added breadcrumb lineage for easier navigation
2. Added childCardIds[] for bidirectional relationships
3. Added animation for loop glow (not just static)
4. Added localStorage persistence for mute state

---

## Priority Order

1. **Phase 1** - Critical: Fix disappearing images
2. **Phase 3** - Visual: Neon glow for loop images
3. **Phase 5** - UX: Auto-play videos
4. **Phase 2** - Feature: Unified gallery
5. **Phase 4** - Feature: Lineage display
6. **Phase 6** - Technical: Schema cleanup
