# Card Lineage & Extraction System Design

> **Design Document v1.0**  
> Video decomposition, parent-child relationships, and animated card navigation

---

## 1. Overview

This system enables **video cards** to be decomposed into child cards (first frame, last frame, audio), creating a **family tree** of related media. Cards maintain bidirectional relationships, and the UI provides smooth, animated navigation between related cards.

### Core Concepts

```
┌─────────────────────────────────────────────────────────┐
│                    VIDEO CARD (Parent)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ First Frame │ │ Last Frame  │ │    Audio        │   │
│  │   (Child)   │ │   (Child)   │ │    (Child)      │   │
│  └──────┬──────┘ └──────┬──────┘ └────────┬────────┘   │
│         │               │                  │            │
│         └───────────────┼──────────────────┘            │
│                         ▼                               │
│              All point back to parent                   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### Card Relationship Fields

```typescript
interface CardRecord {
  // Existing fields...
  type: 'card';
  id: string;
  kind: 'image' | 'video' | 'audio' | 'text';
  
  // NEW: Relationship fields
  parentCardId?: string;        // ID of parent card (for extracted children)
  childCardIds?: string[];      // IDs of child cards (for video parents)
  extractionSource?: {
    type: 'first-frame' | 'last-frame' | 'audio';
    extractedAt: string;        // ISO timestamp
    sourceVideoPath?: string;   // Original video path
  };
  
  // Existing media fields
  image?: { localPath?: string; dataUrl?: string; mimeType?: string };
  video?: { localPath?: string; mimeType?: string };
  audio?: { localPath?: string; dataUrl?: string; mimeType?: string };
}
```

### Relationship Types

| Relationship | Direction | Description |
|--------------|-----------|-------------|
| `parentCardId` | Child → Parent | Points to the source video card |
| `childCardIds` | Parent → Children | Array of extracted card IDs |
| `extractionSource.type` | Metadata | What kind of extraction |

---

## 3. Extraction Workflow

### 3.1 Extract from Card Library

When a video card is selected in the Card Inspector:

```
┌──────────────────────────────────────────────────────────┐
│  CARD INSPECTOR: "leo-demon-transform"                   │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              [Video Thumbnail/Player]              │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ EXTRACT MEDIA ───────────────────────────────────┐   │
│  │                                                   │   │
│  │  [🎬 First Frame]  [🎬 Last Frame]  [🔊 Audio]   │   │
│  │                                                   │   │
│  │  Status: Ready to extract                         │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ LINEAGE ─────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  Parent: None (Original)                          │   │
│  │  Children: 0                                      │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Extraction Process

```typescript
async function extractFromVideoCard(
  videoCard: CardIndexEntry,
  extractType: 'first-frame' | 'last-frame' | 'audio'
) {
  // 1. Call Electron API to extract
  const result = await window.electronAPI.extractVideoFrame/Audio({
    videoPath: videoCard.mediaLocalPath
  });
  
  // 2. Create new card with parent reference
  const childCardId = `card-${Date.now()}-${randomId()}`;
  const childRecord = {
    type: 'card',
    id: childCardId,
    kind: extractType === 'audio' ? 'audio' : 'image',
    parentCardId: videoCard.cardId,  // ← Link to parent
    extractionSource: {
      type: extractType,
      extractedAt: new Date().toISOString(),
      sourceVideoPath: videoCard.mediaLocalPath
    },
    // ... media data
  };
  
  // 3. Update parent card with child reference
  const updatedParent = {
    ...videoCard.cardRecord,
    childCardIds: [...(videoCard.cardRecord?.childCardIds || []), childCardId]
  };
  
  // 4. Persist both to P2P
  await p2pAppend(childCardId, childRecord);
  await p2pAppend(videoCard.coreName, updatedParent);
  
  // 5. Update card-library index
  await p2pAppend('card-library', { type: 'card-index', cardId: childCardId, ... });
}
```

---

## 4. Lineage Display

### 4.1 Family Tree View

In the Card Inspector, show visual lineage:

```
┌─ LINEAGE ─────────────────────────────────────────────────┐
│                                                           │
│  ┌─────────────────────┐                                  │
│  │ 📹 leo-demon-video  │ ← PARENT (click to navigate)    │
│  │     (Video)         │                                  │
│  └──────────┬──────────┘                                  │
│             │                                             │
│  ┌──────────┼──────────┬──────────────────┐              │
│  ▼          ▼          ▼                  │              │
│ ┌────┐   ┌────┐   ┌────┐                  │              │
│ │🖼️ │   │🖼️ │   │🔊 │  ← SIBLINGS       │              │
│ │1st │   │Last│   │Aud │    (click any)   │              │
│ └────┘   └────┘   └────┘                  │              │
│   ▲                                        │              │
│   │                                        │              │
│   YOU ARE HERE                             │              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Compact Lineage Badges

For card grid thumbnails, show relationship indicators:

```
┌─────────────────────────┐
│  [E]          [👨‍👧‍👦 3]  │ ← Tier badge + child count
│  ┌───────────────────┐  │
│  │                   │  │
│  │   [Video Thumb]   │  │
│  │                   │  │
│  └───────────────────┘  │
│  leo-demon-transform    │
│  card-1234...           │
│                         │
│  GEMINI    🔗↑          │ ← "Has parent" indicator
└─────────────────────────┘
```

---

## 5. Animated Navigation

### 5.1 Card Transition Effects

When navigating between related cards:

| Transition | Animation | Duration |
|------------|-----------|----------|
| Parent → Child | Zoom in + fade | 300ms |
| Child → Parent | Zoom out + fade | 300ms |
| Sibling → Sibling | Slide horizontal | 250ms |
| Unrelated → Card | Morph/crossfade | 400ms |

### 5.2 CSS Animations

```css
/* Zoom into child card */
@keyframes zoom-to-child {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* Zoom out to parent */
@keyframes zoom-to-parent {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.7);
    opacity: 0;
  }
}

/* Slide between siblings */
@keyframes slide-to-sibling-left {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

/* New card appearing */
@keyframes card-appear {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Lineage connection line pulse */
@keyframes lineage-pulse {
  0%, 100% {
    stroke-opacity: 0.3;
    stroke-width: 2px;
  }
  50% {
    stroke-opacity: 0.8;
    stroke-width: 3px;
  }
}
```

### 5.3 Navigation Flow

```typescript
function navigateToCard(
  fromCard: CardIndexEntry,
  toCard: CardIndexEntry,
  relationship: 'parent' | 'child' | 'sibling' | 'unrelated'
) {
  // 1. Determine animation type
  const exitAnimation = {
    parent: 'zoom-to-child',
    child: 'zoom-to-parent', 
    sibling: 'slide-to-sibling-left',
    unrelated: 'fade-out'
  }[relationship];
  
  // 2. Play exit animation on current card
  animateOut(fromCard, exitAnimation);
  
  // 3. After delay, show new card with enter animation
  setTimeout(() => {
    setSelectedCard(toCard);
    animateIn(toCard, 'card-appear');
  }, 300);
}
```

---

## 6. Inspector UI Enhancements

### 6.1 Extraction Panel (for Video Cards)

```tsx
{selected.mediaKind === 'video' && (
  <div className="extraction-panel">
    <h3>🎬 Extract Media</h3>
    <div className="extraction-buttons">
      <ExtractionButton 
        type="first-frame"
        icon="first-page"
        label="First Frame"
        disabled={hasChild('first-frame')}
        onClick={() => handleExtract('first-frame')}
      />
      <ExtractionButton 
        type="last-frame"
        icon="last-page"
        label="Last Frame"
        disabled={hasChild('last-frame')}
        onClick={() => handleExtract('last-frame')}
      />
      <ExtractionButton 
        type="audio"
        icon="audiotrack"
        label="Audio Track"
        disabled={hasChild('audio')}
        onClick={() => handleExtract('audio')}
      />
    </div>
  </div>
)}
```

### 6.2 Lineage Panel (for All Cards)

```tsx
<div className="lineage-panel">
  <h3>🔗 Card Lineage</h3>
  
  {/* Parent link */}
  {parentCard && (
    <div className="parent-link" onClick={() => navigateTo(parentCard, 'parent')}>
      <rux-icon icon="arrow-upward" />
      <span>Parent: {parentCard.name}</span>
      <CardMiniPreview card={parentCard} />
    </div>
  )}
  
  {/* Origin badge for root cards */}
  {!parentCard && (
    <div className="origin-badge">
      <rux-icon icon="star" />
      <span>Original (No Parent)</span>
    </div>
  )}
  
  {/* Children carousel */}
  {childCards.length > 0 && (
    <div className="children-carousel">
      <span>Children ({childCards.length})</span>
      <div className="carousel-track">
        {childCards.map(child => (
          <CardMiniPreview 
            key={child.cardId}
            card={child}
            onClick={() => navigateTo(child, 'child')}
          />
        ))}
      </div>
    </div>
  )}
  
  {/* Siblings (if has parent) */}
  {siblingCards.length > 0 && (
    <div className="siblings-row">
      <span>Siblings ({siblingCards.length})</span>
      {siblingCards.map(sibling => (
        <CardMiniPreview 
          key={sibling.cardId}
          card={sibling}
          onClick={() => navigateTo(sibling, 'sibling')}
          isActive={sibling.cardId === selected.cardId}
        />
      ))}
    </div>
  )}
</div>
```

### 6.3 Mini Card Preview Component

```tsx
const CardMiniPreview: React.FC<{card: CardIndexEntry; onClick?: () => void}> = ({card, onClick}) => (
  <div 
    className="mini-preview group cursor-pointer"
    onClick={onClick}
  >
    <div className="w-12 h-12 rounded overflow-hidden border border-gray-700 group-hover:border-purple-500 transition-all">
      {/* Thumbnail */}
    </div>
    <div className="mt-1 text-[9px] text-gray-500 truncate max-w-[60px]">
      {card.name || 'Untitled'}
    </div>
    <div className="text-[8px] text-gray-600 uppercase">
      {card.mediaKind}
    </div>
  </div>
);
```

---

## 7. Visual Design

### 7.1 Lineage Connection Lines

Use SVG paths with gradient strokes:

```css
.lineage-line {
  stroke: url(#lineageGradient);
  stroke-width: 2px;
  fill: none;
  animation: lineage-pulse 2s ease-in-out infinite;
}

/* Gradient definition */
<defs>
  <linearGradient id="lineageGradient">
    <stop offset="0%" stop-color="#a855f7" />
    <stop offset="100%" stop-color="#3b82f6" />
  </linearGradient>
</defs>
```

### 7.2 Card Relationship Indicators

| Indicator | Icon | Color | Position |
|-----------|------|-------|----------|
| Has Parent | `🔗↑` or `link` | Purple | Bottom-left |
| Has Children | `👨‍👧‍👦` + count | Cyan | Top-right |
| Is Extracted | `✂️` | Pink | Badge |

### 7.3 Extraction Button States

| State | Style | Effect |
|-------|-------|--------|
| Ready | Purple outline | Hover glow |
| Extracting | Amber pulsing | Spinner |
| Done | Emerald filled | Checkmark |
| Disabled | Gray muted | N/A |

---

## 8. Implementation Phases

### Phase 1: Data Model & Extraction ✅
- [x] Add `parentCardId` and `childCardIds` to card records
- [x] Implement extraction in Card Library Inspector
- [x] Update parent card when children are created
- [x] Index relationships in card-library core

### Phase 2: Lineage Display ✅
- [x] Create mini preview components inline
- [x] Add Lineage Panel to Card Inspector
- [x] Show parent link with navigation
- [x] Show children carousel
- [x] Show sibling navigation

### Phase 3: Grid Indicators ✅
- [x] Add child count badge to card grid
- [x] Add "has parent" indicator (link icon)
- [ ] Filter cards by relationship status

### Phase 4: Animated Navigation ✅
- [x] Implement transition animations (zoom, slide) in CSS
- [x] Add navigation state machine
- [x] Smooth card inspector transitions via `navigateToCard()`
- [ ] Breadcrumb trail for deep navigation

### Phase 5: Polish
- [ ] Lineage tree visualization mode
- [ ] Batch extraction (all 3 at once)
- [ ] Sound effects for extraction
- [ ] Keyboard navigation (↑↓ for parent/child)

---

## 9. Edge Cases

| Scenario | Handling |
|----------|----------|
| Video deleted, children exist | Children become orphans (show "Source Deleted") |
| Circular reference | Prevent - always one direction |
| Re-extract same type | Create new child, don't replace |
| Large video (slow extract) | Progress indicator + abort option |

---

## 10. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` | Navigate to parent |
| `↓` | Navigate to first child |
| `←` / `→` | Navigate siblings |
| `E` | Open extraction panel |
| `1` / `2` / `3` | Quick extract first/last/audio |
| `Esc` | Close inspector / go back |

---

*Document created: December 2025*
*Author: Hapa AI System Design*
