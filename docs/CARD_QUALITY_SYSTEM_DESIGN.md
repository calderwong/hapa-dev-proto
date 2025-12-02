# Card Library Quality, Rarity & Filter System Design

> **Design Document v1.0**
> Inspired by: Diablo loot systems, Path of Exile item quality, Destiny engrams, 
> Borderlands weapon rarities, and TCG card rarity tiers

---

## 1. Overview

This system creates a visual hierarchy for cards based on how "complete" or "enriched" they are. Cards gain quality tiers as more attributes are filled in, similar to how gear in action RPGs gains power through affixes, enchantments, and upgrades.

### Design Philosophy
- **Progression feels rewarding**: Cards visibly "level up" as you work on them
- **Visual hierarchy at a glance**: Border colors and glow effects communicate quality instantly
- **Gamification without clutter**: Quality indicators should enhance, not overwhelm
- **Consistent with Astro UXDS**: Use Astro color palette and iconography

---

## 2. Card Types (Primary Classification)

Based on `mediaKind` and source, cards are classified into types:

| Type Icon | Type Name | Source / Criteria |
|-----------|-----------|-------------------|
| 🖼️ | **IMAGE** | `mediaKind === 'image'` |
| 🎬 | **VIDEO** | `mediaKind === 'video'` |
| 🔊 | **AUDIO** | `mediaKind === 'audio'` |
| 📄 | **TEXT** | No media, text-only content |
| 🌀 | **EXTRACTED** | `subType === 'first-frame' \| 'last-frame' \| 'audio-extract'` |
| ✨ | **SPRITE** | `subType === 'sprite-sheet'` (animated GIF) |

### Type Filters
```typescript
type CardType = 'image' | 'video' | 'audio' | 'text' | 'extracted' | 'sprite';
```

---

## 3. Quality Attributes (Affixes)

Each attribute is like an "affix" that adds to the card's overall quality score:

| Affix | Field Path | Points | Visual Indicator |
|-------|-----------|--------|------------------|
| 📷 **Has Media** | `mediaKind !== undefined` | +1 | Media type icon |
| 🔁 **Has Loop** | `derivedGif \|\| subType === 'sprite-sheet'` | +1 | GIF badge |
| 📝 **Has Summary** | `cardRecord?.summaries?.length > 0` | +2 | Cyan subject icon |
| 🏷️ **Has Key Terms** | `cardRecord?.keyTerms?.length > 0` | +2 | Purple tag icon |
| 📖 **Has Wiki Entry** | `cardRecord?.wormhole?.wikiEntries?.length > 0` | +2 | Emerald wiki icon |
| 🎤 **Has Transcript** | `cardRecord?.transcripts?.length > 0` | +2 | Yellow transcript icon |
| 📛 **Has Name** | `name !== undefined && name !== ''` | +1 | — (implicit) |
| 🔗 **Has Parent** | `parentCardId !== undefined` | +1 | Chain link icon |

**Maximum Quality Score: 13 points**

---

## 4. Quality Tiers (Rarity System)

Based on total quality score, cards are assigned a rarity tier:

| Tier | Score Range | Border Color | Glow Effect | Name |
|------|-------------|--------------|-------------|------|
| ⬜ | 0-1 | `gray-600` | None | **Common** |
| 🟢 | 2-3 | `emerald-500` | Subtle pulse | **Uncommon** |
| 🔵 | 4-5 | `blue-500` | Soft glow | **Rare** |
| 🟣 | 6-8 | `purple-500` | Medium glow | **Epic** |
| 🟠 | 9-11 | `orange-500` | Strong glow + shimmer | **Legendary** |
| 🔴 | 12-13 | `rose-500` → `amber-500` gradient | Breathing glow + particles | **Mythic** |

### Visual Implementation

```css
/* Common - No special effects */
.card-tier-common {
  border-color: rgb(75, 85, 99); /* gray-600 */
}

/* Uncommon - Subtle emerald */
.card-tier-uncommon {
  border-color: rgb(16, 185, 129); /* emerald-500 */
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
}

/* Rare - Blue glow */
.card-tier-rare {
  border-color: rgb(59, 130, 246); /* blue-500 */
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
}

/* Epic - Purple glow */
.card-tier-epic {
  border-color: rgb(168, 85, 247); /* purple-500 */
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.4);
  animation: epic-pulse 3s ease-in-out infinite;
}

/* Legendary - Orange with shimmer */
.card-tier-legendary {
  border-color: rgb(249, 115, 22); /* orange-500 */
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.5);
  animation: legendary-shimmer 2s ease-in-out infinite;
}

/* Mythic - Gradient border with particles */
.card-tier-mythic {
  border-image: linear-gradient(135deg, #f43f5e, #f59e0b, #f43f5e) 1;
  box-shadow: 
    0 0 24px rgba(244, 63, 94, 0.5),
    0 0 48px rgba(245, 158, 11, 0.3);
  animation: mythic-breathe 4s ease-in-out infinite;
}

@keyframes epic-pulse {
  0%, 100% { box-shadow: 0 0 16px rgba(168, 85, 247, 0.4); }
  50% { box-shadow: 0 0 24px rgba(168, 85, 247, 0.6); }
}

@keyframes legendary-shimmer {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.1); }
}

@keyframes mythic-breathe {
  0%, 100% { 
    box-shadow: 0 0 24px rgba(244, 63, 94, 0.5), 0 0 48px rgba(245, 158, 11, 0.3);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 32px rgba(244, 63, 94, 0.7), 0 0 64px rgba(245, 158, 11, 0.5);
    transform: scale(1.01);
  }
}
```

---

## 5. Quality Calculation Function

```typescript
interface CardQualityResult {
  score: number;
  tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  affixes: string[];
  tierColor: string;
  tierGlow: string;
}

function calculateCardQuality(card: CardIndexEntry): CardQualityResult {
  let score = 0;
  const affixes: string[] = [];

  // Media (+1)
  if (card.mediaKind) {
    score += 1;
    affixes.push('media');
  }

  // Loop/GIF (+1)
  if (card.derivedGif || card.subType === 'sprite-sheet') {
    score += 1;
    affixes.push('loop');
  }

  // Name (+1)
  if (card.name && card.name.trim() !== '') {
    score += 1;
    affixes.push('named');
  }

  // Parent relationship (+1)
  if (card.cardRecord?.parentCardId) {
    score += 1;
    affixes.push('linked');
  }

  // Summary (+2)
  if (card.cardRecord?.summaries?.length > 0) {
    score += 2;
    affixes.push('summarized');
  }

  // Key Terms (+2)
  if (card.cardRecord?.keyTerms?.length > 0) {
    score += 2;
    affixes.push('tagged');
  }

  // Wiki Entries (+2)
  if (card.cardRecord?.wormhole?.wikiEntries?.length > 0) {
    score += 2;
    affixes.push('wiki');
  }

  // Transcript (+2)
  if (card.cardRecord?.transcripts?.length > 0) {
    score += 2;
    affixes.push('transcribed');
  }

  // Determine tier
  let tier: CardQualityResult['tier'];
  let tierColor: string;
  let tierGlow: string;

  if (score >= 12) {
    tier = 'mythic';
    tierColor = 'from-rose-500 to-amber-500';
    tierGlow = 'shadow-[0_0_24px_rgba(244,63,94,0.5)]';
  } else if (score >= 9) {
    tier = 'legendary';
    tierColor = 'border-orange-500';
    tierGlow = 'shadow-[0_0_20px_rgba(249,115,22,0.5)]';
  } else if (score >= 6) {
    tier = 'epic';
    tierColor = 'border-purple-500';
    tierGlow = 'shadow-[0_0_16px_rgba(168,85,247,0.4)]';
  } else if (score >= 4) {
    tier = 'rare';
    tierColor = 'border-blue-500';
    tierGlow = 'shadow-[0_0_12px_rgba(59,130,246,0.3)]';
  } else if (score >= 2) {
    tier = 'uncommon';
    tierColor = 'border-emerald-500';
    tierGlow = 'shadow-[0_0_8px_rgba(16,185,129,0.2)]';
  } else {
    tier = 'common';
    tierColor = 'border-gray-600';
    tierGlow = '';
  }

  return { score, tier, affixes, tierColor, tierGlow };
}
```

---

## 6. Sort Options

| Sort Key | Description | Icon |
|----------|-------------|------|
| `newest` | By creation date, newest first | 📅 |
| `oldest` | By creation date, oldest first | 📅 |
| `quality-high` | By quality score, highest first | ⭐ |
| `quality-low` | By quality score, lowest first | ⭐ |
| `name-az` | Alphabetically A-Z | 🔤 |
| `name-za` | Alphabetically Z-A | 🔤 |
| `type` | Grouped by media type | 📁 |
| `provider` | Grouped by AI provider | 🤖 |

```typescript
type SortKey = 
  | 'newest' | 'oldest' 
  | 'quality-high' | 'quality-low'
  | 'name-az' | 'name-za'
  | 'type' | 'provider';
```

---

## 7. Filter System

### Filter Categories

```typescript
interface CardFilters {
  // Type filters (multi-select)
  types: CardType[];
  
  // Quality tier filters (multi-select)
  tiers: CardQualityTier[];
  
  // Affix filters (has/doesn't have)
  hasMedia: boolean | null;
  hasLoop: boolean | null;
  hasSummary: boolean | null;
  hasKeyTerms: boolean | null;
  hasWiki: boolean | null;
  hasTranscript: boolean | null;
  hasName: boolean | null;
  
  // Provider filter
  providers: string[];
  
  // Date range
  dateFrom: Date | null;
  dateTo: Date | null;
  
  // Text search
  searchQuery: string;
}
```

### Filter UI Component Sketch

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search cards...                              [X] │
├─────────────────────────────────────────────────────┤
│ TYPE        ○ All  ○ Image  ○ Video  ○ Audio       │
├─────────────────────────────────────────────────────┤
│ QUALITY     ⬜ ⬜ 🟢 🟢 🔵 🔵 🟣 🟣 🟠 🟠 🔴 🔴     │
│             Common → → → → → → → → → → → Mythic    │
├─────────────────────────────────────────────────────┤
│ ATTRIBUTES  ☑ Summary  ☑ Key Terms  ☐ Wiki        │
│             ☐ Transcript  ☐ Loop  ☐ Named          │
├─────────────────────────────────────────────────────┤
│ SORT BY     [Quality ▼]  [Descending ▼]            │
└─────────────────────────────────────────────────────┘
```

---

## 8. Visual Badge System

Each card displays small badges indicating its attributes:

```
┌────────────────────────────────┐
│  ┌──────────────────────────┐  │
│  │                          │  │
│  │      [Card Thumbnail]    │  │
│  │                          │  │
│  └──────────────────────────┘  │
│  Card Name                     │
│  card-1234567890-abcdef        │
│                                │
│  GEMINI    📝2  🏷️3  📖1  🎬  │ ← Affix badges
│                                │
│  ════════════════════════════  │ ← Quality border color
└────────────────────────────────┘
        ↑ Epic purple glow
```

### Badge Icons (Astro UXDS)

| Affix | Icon | Color |
|-------|------|-------|
| Summary | `subject` | Cyan-400 |
| Key Terms | `local-offer` | Purple-400 |
| Wiki | `public` | Emerald-400 |
| Transcript | `mic` | Yellow-400 |
| Loop/GIF | `animation` | Pink-400 |
| Media Type | `image` / `videocam` / `audiotrack` | Gray-500 |

---

## 9. Tier Indicator Component

A small visual indicator showing the tier:

```typescript
const TierBadge: React.FC<{ tier: CardQualityTier }> = ({ tier }) => {
  const config = {
    common: { label: 'C', bg: 'bg-gray-700', text: 'text-gray-400' },
    uncommon: { label: 'U', bg: 'bg-emerald-900', text: 'text-emerald-400' },
    rare: { label: 'R', bg: 'bg-blue-900', text: 'text-blue-400' },
    epic: { label: 'E', bg: 'bg-purple-900', text: 'text-purple-400' },
    legendary: { label: 'L', bg: 'bg-orange-900', text: 'text-orange-400' },
    mythic: { label: 'M', bg: 'bg-gradient-to-r from-rose-900 to-amber-900', text: 'text-rose-400' },
  };

  const c = config[tier];
  return (
    <span className={`${c.bg} ${c.text} px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider`}>
      {c.label}
    </span>
  );
};
```

---

## 10. Implementation Phases

### Phase 1: Quality Calculation ✅
- [x] Add `calculateCardQuality()` utility function → `src/utils/cardQuality.ts`
- [x] Add quality score and tier to card display
- [x] Add quality border styling to card grid

### Phase 2: Visual Indicators ✅
- [x] Implement tier-based border colors
- [x] Add glow animations for Epic+ tiers → `src/index.css`
- [x] Add affix badge row to card UI (transcript, loop, summary, key terms, wiki)

### Phase 3: Filter System ✅
- [x] Add filter state to CardLibrary
- [x] Implement filter UI panel with tier and type toggles
- [x] Add filter button in header with active indicator

### Phase 4: Sort System ✅
- [x] Add sort dropdown (newest, oldest, quality high/low, name A-Z/Z-A)
- [x] Implement all sort options
- [x] Integrated with filter panel

### Phase 5: Polish
- [ ] Add filter/sort persistence to localStorage
- [ ] Add "quick filter" buttons for common presets
- [x] Add tier distribution stats in filter panel
- [ ] Consider adding sound effects for tier reveals (optional)

---

## 11. Future Enhancements

- **Card Sets**: Group related cards (e.g., all extracts from one video)
- **Achievement System**: Unlock badges for creating first Mythic, etc.
- **Quality Progression Tracking**: Show quality history over time
- **Bulk Actions**: Select multiple cards to run Wormhole enrichment
- **Card Comparison**: Side-by-side comparison of card attributes

---

## 12. Astro UXDS Color Reference

For consistency with Astro Design System:

| Status | Color | Use For |
|--------|-------|---------|
| Critical | `#ff3838` | Errors, urgent |
| Caution | `#fce83a` | Warnings |
| Normal | `#56f000` | Success, complete |
| Standby | `#2dccff` | Ready, idle |
| Off | `#a4abb6` | Disabled, inactive |

Adapt rarity colors to complement these while maintaining distinctiveness.

---

*Document created: December 2025*
*Author: Hapa AI System Design*
