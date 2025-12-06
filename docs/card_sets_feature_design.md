# Card Sets Feature Design Document

## Overview

Card Sets provide a grouping mechanism for cards created during Hell Week pipeline runs. Each pipeline execution produces a "Card Set" - a named collection that represents a coherent body of work derived from a single artifact.

---

## Core Concepts

### 1. Card Set Definition

A **Card Set** is:
- A named collection of cards created from a single Leo/Thor pipeline run
- Identified by a unique `setId` (e.g., `set-{timestamp}-{hash}`)
- Named automatically by Leo based on artifact analysis (e.g., "HAPA Protocol Architecture", "Project Roadmap Q4")
- Immutable once created - original cards maintain sovereignty

### 2. Set Hierarchy

```
Card Set
├── Card A (parent)
│   ├── Loop Video (child)
│   └── Extracted Image (child)
├── Card B (parent)
└── Card C (parent)
    └── Summary Card (child)
```

### 3. Merged Sets (Meta-Sets)

A **Merged Set** is:
- A virtual grouping that references multiple Card Sets
- Does NOT copy or modify original cards
- Acts as a "view" or "playlist" of existing sets
- Can be named and saved for quick access
- Supports nested merges (merge of merges)

```
Merged Set: "Complete Documentation"
├── References: Card Set "Architecture Docs"
├── References: Card Set "API Reference"
└── References: Card Set "User Guide"
```

---

## Data Model

### CardSet Schema

```typescript
interface CardSet {
  setId: string;              // Unique identifier
  name: string;               // Leo-derived name
  description?: string;       // Leo-derived description
  artifactName: string;       // Original artifact filename
  artifactHash?: string;      // Hash of source artifact
  
  // Provenance
  runId: string;              // Pipeline run ID
  createdAt: string;          // ISO timestamp
  leoContext: any;            // Full Leo analysis output
  
  // Contents
  cardIds: string[];          // Direct member card IDs
  cardCount: number;          // Total cards in set
  
  // Metadata
  tags?: string[];            // User-defined tags
  thumbnail?: string;         // Representative image path
  
  // Stats
  imageCount: number;         // Cards with generated images
  videoCount: number;         // Cards with loop videos
}

interface MergedSet {
  mergedSetId: string;        // Unique identifier
  name: string;               // User-defined name
  description?: string;       
  
  // References (not copies)
  sourceSetIds: string[];     // Card Sets included
  sourceMergedSetIds?: string[]; // Nested merged sets
  
  createdAt: string;
  updatedAt: string;
  
  // Computed (not stored, derived at runtime)
  // totalCardCount, totalSets, etc.
}
```

### Storage Strategy

Card Sets stored in dedicated Hypercore: `card-sets`
- Each entry is a CardSet or MergedSet record
- Index maintained in `card-library` with `type: 'card-set-index'`

Cards reference their set via `setId` field added to card records.

---

## UI/UX Design

### Card Library Enhancements

#### 1. Set Selector (New Header Component)

Location: Above the card grid, below search bar

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search cards...                     [Filter] [Sync]     │
├─────────────────────────────────────────────────────────────┤
│  📚 CARD SETS:  [All Cards ▾]  │  + New Merged Set          │
│                                                             │
│  Recent Sets:                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 🎴 Protocol  │ │ 🎴 Dev       │ │ 🎴 Roadmap   │        │
│  │ Architecture │ │ Journal      │ │ Q4 2024      │        │
│  │ 32 cards     │ │ 18 cards     │ │ 12 cards     │        │
│  │ Dec 5, 2025  │ │ Dec 4, 2025  │ │ Dec 3, 2025  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Behaviors:**
- Clicking a set filters to only those cards + children
- "All Cards" shows everything (default)
- Multiple sets can be selected (hold Ctrl/Cmd)
- Selected sets glow with accent color

#### 2. Set Filter Mode Indicator

When a set is active, show clear indicator:

```
┌─────────────────────────────────────────────────────────────┐
│  📚 Viewing: "Protocol Architecture" (32 cards)     [✕ Clear]│
│  └─ Includes 8 child cards (videos, extractions)            │
├─────────────────────────────────────────────────────────────┤
│  [Type ▾] [Tier ▾] [Date ▾]  ← Other filters work within set│
└─────────────────────────────────────────────────────────────┘
```

#### 3. Set Management Panel

Accessible via "Manage Sets" button or dedicated tab:

```
┌─────────────────────────────────────────────────────────────┐
│  CARD SETS                                    [+ Create Merge]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ORIGINAL SETS (from Pipeline runs)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ☑ Protocol Architecture          32 cards    Dec 5      ││
│  │ ☐ Development Journal            18 cards    Dec 4      ││
│  │ ☑ Q4 Roadmap                     12 cards    Dec 3      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  MERGED SETS                                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📁 Complete Docs (3 sets, 62 cards)         Dec 5       ││
│  │    └─ Protocol + Journal + Roadmap                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Create Merged Set from 2 Selected]                        │
└─────────────────────────────────────────────────────────────┘
```

#### 4. Merge Set Creation Modal

```
┌─────────────────────────────────────────────────────────────┐
│  CREATE MERGED SET                                    [✕]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Name: [Complete Documentation____________]                 │
│                                                             │
│  Description: [Optional description...____]                 │
│                                                             │
│  Including:                                                 │
│  ├─ ✓ Protocol Architecture (32 cards)                     │
│  ├─ ✓ Development Journal (18 cards)                       │
│  └─ ✓ Q4 Roadmap (12 cards)                                │
│                                                             │
│  Total: 62 cards from 3 sets                               │
│                                                             │
│  ⓘ Original cards remain unchanged. This creates a         │
│    reference-based collection for easy access.              │
│                                                             │
│                              [Cancel]  [Create Merged Set]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Pipeline Integration

### 1. Leo Phase Enhancement

Leo should output a suggested set name:

```typescript
interface LeoOutput {
  // ... existing fields
  suggestedSetName: string;      // e.g., "Protocol Architecture Guide"
  suggestedSetDescription: string;
  artifactType: 'documentation' | 'code' | 'notes' | 'other';
}
```

### 2. Conviction Phase Enhancement

When minting cards, also create the CardSet record:

```typescript
// In runConvictionFinalizing()
const cardSet: CardSet = {
  setId: `set-${Date.now()}-${shortHash}`,
  name: this.state.leoOutput.suggestedSetName || `Set from ${artifactName}`,
  description: this.state.leoOutput.suggestedSetDescription,
  artifactName: this.state.parentArtifact,
  runId: this.state.runId,
  createdAt: new Date().toISOString(),
  leoContext: this.state.leoOutput,
  cardIds: mintedCardIds,
  cardCount: mintedCardIds.length,
  // ... stats
};

await appendToCore('card-sets', JSON.stringify(cardSet));
```

### 3. Pipeline Completion UI

Update "View in Library" to navigate with set filter:

```typescript
// Navigate to Card Library with set filter
navigate(`/cards?setId=${createdSetId}`);
```

Show set info in completion screen:

```
┌─────────────────────────────────────────────────────────────┐
│                        ✓ VAULTED                            │
│                                                             │
│  Created Card Set: "Protocol Architecture"                  │
│  32 cards minted successfully                               │
│                                                             │
│  [View Set in Library]  [New Run]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Filtering Logic

### Set Filter Behavior

When a set is selected:

```typescript
function filterBySet(cards: Card[], setId: string): Card[] {
  const set = getCardSet(setId);
  const setCardIds = new Set(set.cardIds);
  
  return cards.filter(card => {
    // Direct member
    if (setCardIds.has(card.cardId)) return true;
    
    // Child of a member (loop videos, extractions, etc.)
    if (card.parentCardId && setCardIds.has(card.parentCardId)) return true;
    
    return false;
  });
}
```

### Merged Set Resolution

```typescript
function resolveCardIds(mergedSet: MergedSet): string[] {
  const allCardIds: Set<string> = new Set();
  
  // Add cards from source sets
  for (const setId of mergedSet.sourceSetIds) {
    const set = getCardSet(setId);
    set.cardIds.forEach(id => allCardIds.add(id));
  }
  
  // Recursively resolve nested merged sets
  for (const nestedId of mergedSet.sourceMergedSetIds || []) {
    const nested = getMergedSet(nestedId);
    resolveCardIds(nested).forEach(id => allCardIds.add(id));
  }
  
  return Array.from(allCardIds);
}
```

### Combined Filtering

Other filters apply WITHIN the set context:

```typescript
function applyFilters(cards: Card[], filters: Filters): Card[] {
  let result = cards;
  
  // 1. Apply set filter first (narrows scope)
  if (filters.setId) {
    result = filterBySet(result, filters.setId);
  }
  
  // 2. Then apply other filters within that scope
  if (filters.tier) {
    result = result.filter(c => getTier(c) === filters.tier);
  }
  if (filters.type) {
    result = result.filter(c => c.mediaKind === filters.type);
  }
  if (filters.search) {
    result = result.filter(c => matchesSearch(c, filters.search));
  }
  
  return result;
}
```

---

## Implementation Plan

### Phase 1: Data Model & Storage (Backend)

1. **Create CardSet storage**
   - Add `card-sets` Hypercore
   - Add IPC handlers: `card-sets:create`, `card-sets:list`, `card-sets:get`
   - Add `setId` field to card records during pipeline

2. **Update Pipeline**
   - Add `suggestedSetName` to Leo prompt/output
   - Create CardSet record in Conviction phase
   - Store setId in each minted card

### Phase 2: Basic Set Filtering (Frontend)

3. **Card Library Updates**
   - Add set selector component
   - Implement URL-based set filtering (`?setId=...`)
   - Update filter logic to respect set boundaries

4. **Pipeline Completion**
   - Show set name in completion screen
   - Update "View in Library" to include setId param

### Phase 3: Set Management UI

5. **Set Management Panel**
   - List all sets with stats
   - Allow selection for merge
   - Show set details on click

6. **Merged Set Creation**
   - Modal for creating merged sets
   - Name and description input
   - Preview of included cards

### Phase 4: Polish & Advanced Features

7. **Set Thumbnails**
   - Auto-select representative image
   - Allow user override

8. **Set Actions**
   - Rename set
   - Add/remove tags
   - Delete merged set (originals preserved)

---

## Design Principles Alignment

### ASTROS Compliance

- **Atmospheric**: Set cards with glowing borders, smooth hover states
- **Sci-Fi**: Futuristic set badges, holographic merge animations
- **Terminal-like**: Monospace set IDs, technical stats display
- **Robust**: Non-destructive operations, sovereignty preservation
- **Organized**: Clear hierarchy, intuitive grouping
- **Smooth**: Animated transitions between set views

### Card Sovereignty

- Original cards are NEVER modified by set operations
- Sets are references/pointers, not containers
- Deleting a merged set leaves originals intact
- Each card knows its origin set via `setId` field

### Holo-Rare Aesthetic

- Sets can have rarity based on content (rare artifact = rare set)
- Set badges show aggregate stats (total power, etc.)
- Visual distinction between original sets and merged sets

---

## Files to Modify

### Backend (electron/)
- `pipeline.ts` - Add set creation in Conviction
- `main.ts` - Add card-sets IPC handlers
- `cardManager.ts` - Add setId to card creation

### Frontend (src/)
- `pages/CardLibrary.tsx` - Set selector, filtering
- `components/CardSetSelector.tsx` - NEW: Set picker component
- `components/CardSetManager.tsx` - NEW: Set management panel
- `components/MergeSetModal.tsx` - NEW: Merge creation modal

### Types
- `types/cardSet.ts` - NEW: CardSet and MergedSet interfaces

---

## Success Criteria

1. ✅ Pipeline creates named CardSet on completion
2. ✅ Card Library shows set selector with recent sets
3. ✅ Clicking a set filters to only those cards + children
4. ✅ Other filters work within set context
5. ✅ Multiple sets can be selected simultaneously
6. ✅ Users can create merged sets from selections
7. ✅ Merged sets resolve correctly to all member cards
8. ✅ Original cards unchanged by all operations
9. ✅ "View in Library" from pipeline shows new set
10. ✅ UI follows ASTROS design principles

---

## Open Questions

1. Should merged sets be persisted or session-only?
   - **Recommendation**: Persisted, but clearly marked as "virtual"

2. Can a card belong to multiple original sets?
   - **Recommendation**: No - one origin set, but can be in multiple merged sets

3. How to handle orphan cards (created before sets feature)?
   - **Recommendation**: Create "Legacy Cards" pseudo-set for pre-existing cards

4. Should sets have their own detail page?
   - **Recommendation**: Future enhancement - for now, sets are filters

---

*Document Version: 1.0*
*Created: December 5, 2025*
*Author: Cascade AI*
