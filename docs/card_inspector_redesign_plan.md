# Card Inspector Redesign Plan

## Objective
Merge Card Inspector (CardLibrary) with Card Details (CardDetails/Peruser) into a single, comprehensive, futuristic RPG card viewer.

---

## Current State Analysis

### Card Inspector (CardLibrary.tsx selected card view)
**Location**: Right panel in Card Library when card selected
**Features**:
- Card image display (small)
- Card name, type, ID, created date
- AI Images section (Gemini/Local Vision toggle, Create Image button)
- Card Lineage (parent/child relationships)
- Wormhole Actions (summarization, key terms, wiki update)
- Image set management (hero image, reorder)
- Loop video generation
- Scroll attachment

**Missing**:
- Stats display
- Skills/abilities
- Lore text
- Truth analysis (facts/desires)
- Model provenance tracking
- Quality bar/rarity indicator
- Lightbox (click to enlarge)
- RPG aesthetic

### Card Details (CardDetails.tsx - Peruser)
**Location**: Modal overlay in Pipeline page
**Features**:
- Holographic border effect
- Quality bar with rarity stars
- Stats bars (Power, Wisdom, Speed, Magic)
- Skills with badges (Passive/Active)
- Full lore text
- Lineage & Heritage (Leo/Thor provenance)
- Truth Analysis (Facts/Desires)
- Evolution state indicator
- Lightbox (click to enlarge)
- Video generation button
- Pipeline status footer

**Missing**:
- AI image generation (Gemini/Local Vision)
- Wormhole actions
- Image set management
- Loop video creation UI
- Scroll attachment

---

## Redesign Goals

1. **Unified Experience**: One component that works in both contexts
2. **Rich Data Display**: Show ALL available card data
3. **Futuristic RPG Aesthetic**: Holographic borders, quality bars, stat bars, skill badges
4. **ASTROS Design**: Dark backgrounds, glowing accents, monospace fonts
5. **Full Functionality**: Keep ALL features from both components

---

## New Layout Design

```
┌─────────────────────────────────────────────────────────────────┐
│ ★★★★☆ UNCOMMON          CARD INSPECTOR           [Lightbox] [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────────────────────────┐│
│  │                  │   │ CARD NAME                             ││
│  │   [Card Image]   │   │ The Sovereign Card                    ││
│  │   Click to       │   │ Type: Concept  │  ID: card-1764...    ││
│  │   Enlarge        │   │ Created: 12/5/2025                    ││
│  │                  │   ├──────────────────────────────────────┤│
│  │                  │   │ ⚔️ STATS                              ││
│  │                  │   │ POWER  ████████░░ 78                  ││
│  │                  │   │ WISDOM ██████░░░░ 62                  ││
│  │                  │   │ SPEED  █████░░░░░ 54                  ││
│  │                  │   │ MAGIC  ███████░░░ 71                  ││
│  └──────────────────┘   └──────────────────────────────────────┘│
│                                                                  │
│  ┌── EVOLUTION STATE ────────────────────────────────────────┐  │
│  │ ● ILLUSTRATED  [Blob] [Sorted] [Illustrated] [ ] [ ]      │  │
│  │ [🎬 Generate Video Loop]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── SKILLS ─────────────────────────────────────────────────┐  │
│  │ 🟢 Passive: Truth Evaluation                               │  │
│  │    Assimilate incoming information, distill core truths... │  │
│  │ 🔵 Active: Card Forging Protocol                           │  │
│  │    Transform analyzed information into structured Card...  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── LORE ───────────────────────────────────────────────────┐  │
│  │ "Within the crucible of 'Hell Week', Thor, the Truth-     │  │
│  │ Seeker and Forge Master, receives the threads of raw      │  │
│  │ information..."                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── TRUTH ANALYSIS ─────────────────────────────────────────┐  │
│  │ FACTS                          │ DESIRES                   │  │
│  │ • Thor is an AI agent...       │ • Transform dense...      │  │
│  │ • Thor receives context...     │ • Ensure each card...     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── LINEAGE & HERITAGE ─────────────────────────────────────┐  │
│  │ LEO: Smart LLM (gemini-2.5-pro) via Vertex                │  │
│  │ THOR: Fast LLM (gemini-2.5-flash) via Vertex              │  │
│  │ IMAGE: Pro Image (imagen-4.0) via Vertex                  │  │
│  │ Parent: ★ Original (No Parent)                            │  │
│  │ Children: 3 derived cards                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── AI IMAGES ──────────────────────────────────────────────┐  │
│  │ [Gemini (Cloud)] [Local Vision]                           │  │
│  │ [████████████ CREATE IMAGE ████████████]                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── WORMHOLE ACTIONS ───────────────────────────────────────┐  │
│  │ [Summarize] [Extract Key Terms] [Update Wiki]             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Identify Data Sources
- `CardIndexEntry` from CardLibrary (basic info)
- `cardRecord` from hypercore (full card data including Hell Week fields)
- Detect if card is a Hell Week card (has cardData, skills, stats, etc.)

### Step 2: Conditional Rendering
- If Hell Week card: Show full RPG layout with stats, skills, lore
- If legacy card: Show existing info with graceful fallbacks

### Step 3: Visual Enhancements
- Add holographic border effect (animated gradient)
- Add quality bar with rarity stars at top
- Add stat bars with color coding
- Add skill badges with type indicators
- Add glowing section headers
- Improve typography (monospace for IDs, clean sans for text)

### Step 4: Feature Integration
- Add lightbox (click image to enlarge)
- Add video generation button
- Keep AI image generation (Gemini/Local Vision)
- Keep Wormhole actions
- Keep lineage/children display
- Add truth analysis section
- Add provenance tracking display

### Step 5: Responsive Layout
- Scrollable content area
- Collapsible sections for dense data
- Mobile-friendly breakpoints

---

## Component Structure

```tsx
<CardInspector card={selected}>
  {/* Header */}
  <QualityBar rarity={rarity} />
  <CloseButton />
  
  {/* Main Content - 2 columns on large screens */}
  <div className="flex">
    {/* Left Column */}
    <CardImage onClick={openLightbox} />
    <EvolutionState state={cardRecord?.state} />
    <VideoGenerateButton />
    
    {/* Right Column */}
    <CardIdentity name, type, id, date />
    <StatsSection stats={cardRecord?.cardData?.stats} />
  </div>
  
  {/* Full Width Sections */}
  <SkillsSection skills={cardRecord?.cardData?.skills} />
  <LoreSection lore={cardRecord?.cardData?.lore} />
  <TruthAnalysisSection facts, desires />
  <LineageSection provenance, parent, children />
  <AIImagesSection />
  <WormholeActionsSection />
  
  {/* Lightbox Modal */}
  {showLightbox && <ImageLightbox />}
</CardInspector>
```

---

## Color Scheme (ASTROS)

- **Background**: `bg-gray-900`, `bg-gray-800/50`
- **Borders**: `border-gray-700`, `border-cyan-500/30`
- **Primary Accent**: `text-cyan-400`, `bg-cyan-500`
- **Secondary Accent**: `text-purple-400`, `text-amber-400`
- **Stats Colors**:
  - Power: `bg-red-500`
  - Wisdom: `bg-blue-500`
  - Speed: `bg-green-500`
  - Magic: `bg-purple-500`
- **Rarity Colors**:
  - Common: `text-gray-400`
  - Uncommon: `text-green-400`
  - Rare: `text-blue-400`
  - Epic: `text-purple-400`
  - Legendary: `text-amber-400`

---

## Files to Modify

1. `src/pages/CardLibrary.tsx` - Replace card inspector section
2. `src/components/CardDetails.tsx` - May extract reusable pieces

---

## Estimated Time: 45-60 minutes

Ready to implement!
