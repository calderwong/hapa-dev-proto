# Set Cards Architecture Plan

## Current State Analysis

### Problem: Centralized Index Model
Currently, card-to-set relationships are managed by a **centralized index** (`card-sets-index.json`):

```
card-sets-index.json          card-index.json (per card)
┌─────────────────────┐       ┌─────────────────────┐
│ setId: "set-123"    │       │ cardId: "card-456"  │
│ cardIds: [          │       │ setId: "set-123"    │ ← One-way reference
│   "card-456",       │       │ ...                 │
│   "card-789"        │       └─────────────────────┘
│ ]                   │
│ name: "My Set"      │       ┌─────────────────────┐
│ type: "card-set"    │       │ cardId: "card-789"  │
└─────────────────────┘       │ setId: "set-123"    │
                              └─────────────────────┘
```

**Issues:**
1. If `card-sets-index` is lost, we lose set metadata (names, descriptions)
2. Cards only store `setId` (singular) - can't belong to multiple sets
3. Sets are NOT cards - no media, no XP, no skills, can't display in library
4. Rebuilding requires both indexes to be intact

---

## Target State: Self-Contained Model

### Goal: Each Hypercore Knows Its Full State
If we rebuild from scratch, each card's hypercore should be able to:
1. Know which sets it belongs to (`memberOfSets[]`)
2. If it IS a set card, know its contained cards (`containedCards[]`)
3. Reconstruct the full graph without external indexes

### New Architecture

```
Individual Card Hypercore          Set Card Hypercore
┌───────────────────────────┐     ┌───────────────────────────┐
│ cardId: "card-456"        │     │ cardId: "set-123"         │
│ cardType: "standard"      │     │ cardType: "set"           │
│ memberOfSets: [           │     │ name: "The Archi-Deck"    │
│   {                       │     │ tier: 2                   │
│     setCardId: "set-123", │     │ xp: 0                     │
│     joinedAt: "2025-..."  │     │ mediaPath: "/path/to..."  │
│   }                       │     │ skills: [                 │
│ ]                         │     │   { name: "Contain",      │
│ ...card data...           │     │     type: "passive",      │
└───────────────────────────┘     │     desc: "Holds cards"   │
                                  │   },                      │
                                  │   { name: "Consume",      │
                                  │     type: "active",       │
                                  │     desc: "Add card"      │
                                  │   }                       │
                                  │ ]                         │
                                  │ containedCards: [         │
                                  │   {                       │
                                  │     cardId: "card-456",   │
                                  │     addedAt: "2025-...",  │
                                  │     addedBy: "pipeline"   │
                                  │   }                       │
                                  │ ]                         │
                                  │ memberOfSets: []          │ ← Sets can be in sets!
                                  └───────────────────────────┘
```

---

## Set Card Type Specification

### Properties (Mirrors Standard Cards)
| Property | Type | Description |
|----------|------|-------------|
| `cardId` | string | Unique ID (format: `set-{timestamp}-{random}`) |
| `cardType` | `"set"` | Distinguishes from standard cards |
| `name` | string | Set name (from Leo or user) |
| `tier` | number | 1-6 (Common to Mythic) - based on contained cards |
| `xp` | number | Gained when contained cards are used |
| `level` | number | Derived from XP |
| `mediaPath` | string | Cover image for the set |
| `mediaKind` | `"image"` | Generated cover art |
| `skills` | Skill[] | Contain (passive), Consume (active) |
| `containedCards` | ContainedCard[] | Cards in this set |
| `memberOfSets` | SetMembership[] | Sets this set belongs to |
| `provenance` | Provenance | Creation metadata |
| `createdAt` | ISO string | When set was created |

### Skills

#### Contain (Passive)
- **Type:** Passive
- **Description:** This set holds and organizes cards
- **Effect:** Cards in this set gain +10% XP when used
- **Visual:** Glowing border around contained cards

#### Consume (Active)
- **Type:** Active
- **Trigger:** User drags a card onto the set OR clicks "Add to Set"
- **Description:** Add a card to this set
- **Effect:** 
  1. Updates set's `containedCards[]`
  2. Updates card's `memberOfSets[]`
  3. Both hypercores are written to (self-contained)
- **Cost:** None (or small XP cost in future)

---

## Migration Plan

### Phase 1: Data Model Update
1. Add `memberOfSets[]` to all card index entries
2. Add `cardType` field to distinguish card types
3. Create `SetCard` interface extending base card

### Phase 2: Set Card Creation
1. When pipeline creates a set, create it as a `cardType: "set"` card
2. Generate cover image using Leo's set name/description
3. Store in card-library core (same as other cards)
4. Update contained cards' `memberOfSets[]`

### Phase 3: Dual-Write Protocol
When adding/removing card from set:
1. Update set card's `containedCards[]`
2. Update member card's `memberOfSets[]`
3. Both writes must succeed (transactional intent)

### Phase 4: Rebuild Capability
Add IPC handler `rebuild-from-hypercores`:
1. Read all card hypercores
2. For each card with `cardType: "set"`, create set entry
3. For each card with `memberOfSets[]`, validate memberships
4. Report orphaned references

---

## Implementation Checklist

### Phase 1: Types & Interfaces ✅ COMPLETE
- [x] Add `cardType: 'standard' | 'set' | 'merged-set'` to card interface
- [x] Add `memberOfSets: SetMembership[]` to card interface
- [x] Add `containedCards: ContainedCard[]` for set cards
- [x] Add `skills: Skill[]` for set cards
- [x] Create `SetCard` interface
- [x] Create `StandardCard` interface
- [x] Create factory functions (`createSetCard`, `migrateCardSetToSetCard`)

### Phase 2: Backend Pipeline ✅ COMPLETE
- [x] Update pipeline to create Set Cards (not just metadata)
- [x] Standard cards now have `cardType: 'standard'` and `memberOfSets[]`
- [x] Set Cards now have `cardType: 'set'`, `containedCards[]`, `skills[]`
- [x] Dual-write: Set Card + legacy card-sets for backwards compatibility
- [ ] Generate cover image for Set Cards (TODO: use Leo description)
- [ ] Add `consume-card-into-set` IPC handler
- [ ] Add `remove-card-from-set` IPC handler
- [ ] Add `rebuild-from-hypercores` IPC handler

### Phase 3: Frontend (src/) - IN PROGRESS
- [x] Display Set Cards in Card Library (distinct visual - amber glow)
- [x] Set Card badge with icon and "SET CARD" label
- [x] Contained cards count badge
- [x] CardType filter includes 'set' option
- [ ] Set Card Inspector panel (show contained cards)
- [ ] Drag-to-consume interaction
- [ ] "Add to Set" button in card context menu
- [ ] Set management UI (reorder, remove cards)

### Phase 4: Migration - PENDING
- [ ] Migrate existing card-sets-index entries to Set Cards
- [ ] Backfill `memberOfSets` on existing cards
- [ ] Deprecate old card-sets-index (keep as backup)

---

## Open Questions

1. **Should sets have their own hypercore?** 
   - Option A: Same card-library core (simpler)
   - Option B: Separate hypercore per set (more isolated)
   - **Recommendation:** Option A for now, but add core reference if needed later

2. **What happens when a card is in multiple sets?**
   - `memberOfSets[]` is an array, so this is supported
   - XP bonus stacks? Or max of one?

3. **Set tier calculation?**
   - Average tier of contained cards?
   - Highest tier in set?
   - Based on card count?

4. **Can sets contain sets?**
   - Yes, via `memberOfSets[]` on the set card
   - Enables hierarchical organization (albums > sets > cards)

---

## Priority

**Critical for rebuild-ability:**
1. `memberOfSets[]` on all cards (self-contained knowledge)
2. `containedCards[]` on set cards (dual source of truth)
3. Dual-write protocol (keep both in sync)

**Nice to have:**
1. Skills system
2. Cover image generation
3. Drag-to-consume UX

---

*Created: 2025-12-06*
*Status: Planning*
