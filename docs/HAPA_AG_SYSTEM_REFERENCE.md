# Hapa AG System Reference
## Comprehensive Snapshot for Developers & AI Agents

**Last Updated:** December 6, 2025  
**Version:** v0.1.0-alpha  
**Status:** Active Development

---

# Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Implemented Features](#2-implemented-features)
3. [System Architecture](#3-system-architecture)
4. [Data Models & Storage](#4-data-models--storage)
5. [Key Components Deep Dive](#5-key-components-deep-dive)
6. [Current State Assessment](#6-current-state-assessment)
7. [Priority Roadmap](#7-priority-roadmap)
8. [Quick Reference](#8-quick-reference)

---

# 1. Executive Summary

## What is Hapa AG?

Hapa AG is an **Electron desktop application** that serves as a local-first AI workspace combining:

- **Multi-provider AI Chat** - Unified interface for Google Gemini, OpenAI, and local llama.cpp models
- **Card Library** - A knowledge management system where all content becomes reusable "Cards"
- **Hell Week Pipeline** - Automated content processing that transforms documents into multimedia cards
- **P2P Sync** - Experimental peer-to-peer data sharing via Hypercore/Hyperswarm

## Core Value Proposition

1. **Local-First**: All data stored locally, user controls their data
2. **Provider Agnostic**: Use any AI provider without lock-in
3. **Card-Based Knowledge**: Everything is a reusable, composable card
4. **Multimedia Rich**: Images, videos, audio - not just text
5. **Future P2P**: Designed for decentralized sharing

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Electron 39 |
| **Frontend** | React 19, TypeScript 5.9, Vite 7 |
| **Styling** | Tailwind CSS, Astro UXDS components |
| **AI - Cloud** | Google Gemini/Vertex AI, OpenAI API |
| **AI - Local** | llama.cpp (OpenAI-compatible API) |
| **Storage** | Hypercore (append-only logs), electron-store |
| **P2P** | Hyperswarm (discovery), Hypercore (replication) |

---

# 2. Implemented Features

## 2.1 Multi-Provider AI Chat

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Provider Switching** | Toggle between Gemini, OpenAI, Local llama in header | Use best model for task |
| **Model Selection** | Dynamic model lists from each provider | Access latest models |
| **Streaming Responses** | SSE parsing, incremental rendering | Real-time feedback |
| **Media Attachments** | Image, video, audio via file picker or drag-drop | Multimodal conversations |
| **Audio Transcription** | Whisper API for audio → text | Voice input support |

**Files:** `src/pages/Chat.tsx`, `electron/main.ts` (IPC handlers)

## 2.2 Image Generation (Imagen 4)

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Imagen Models** | imagen-4.0-generate-001, fast, ultra variants | High-quality image gen |
| **Options Panel** | Aspect ratio, resolution, count, negative prompts | Full control |
| **Style Reference** | Optional reference image upload | Consistent style |
| **Save to Library** | One-click save as Card | Reusable assets |

**Files:** `src/components/ImagenOptionsPanel.tsx`, `electron/main.ts`

## 2.3 Video Generation (Veo)

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Veo Models** | veo-3.1-generate-preview, veo-3.0, veo-2.0 | AI video creation |
| **Image-to-Video** | Start frame, end frame support | Controlled generation |
| **Loop Mode** | Same image as start+end for seamless loops | Animation assets |
| **Frame Selection** | Pick frames from Card Library | Zero-friction workflow |
| **Async Polling** | Background status checks, progress events | Non-blocking UX |

**Files:** `src/components/VeoOptionsPanel.tsx`, `electron/main.ts`

## 2.4 Card Library & Knowledge Management

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Drag & Drop Import** | Files become Cards automatically | Frictionless ingestion |
| **Card Types** | image, video, audio, message, text, sprite, set | Organized taxonomy |
| **Quality/Rarity System** | 6 tiers (Common→Mythic), 8 affixes | Gamified progression |
| **Visual Filtering** | Filter by type, tier, affix badges | Find content fast |
| **Card Inspector** | Detail panel with all metadata | Deep inspection |
| **Lineage Tracking** | Parent/child relationships, extraction history | Full provenance |
| **3D Viewer** | Three.js card visualization | Immersive browsing |

**Files:** `src/pages/CardLibrary.tsx`, `src/utils/cardQuality.ts`

## 2.5 Hell Week Pipeline

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Document Ingestion** | Drag text files to start | Easy content import |
| **Leo Phase (Love)** | Smart LLM summarizes, extracts context | Understanding |
| **Thor Phase (Truth)** | Chunks → Card Data + Image Prompts | Content creation |
| **Conviction Phase (Do)** | Write Cards to Hypercore, create Sets | Persistence |
| **Image Generation** | Imagen 4 generates card artwork | Visual assets |
| **Set Cards** | Collection cards that group related content | Organization |

**Files:** `electron/pipeline.ts`, `src/pages/Pipeline.tsx`

## 2.6 Wormhole Processing

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Summaries** | AI-generated content summaries | Quick understanding |
| **Key Terms** | Extracted concepts and definitions | Knowledge graph |
| **Wiki Entries** | Auto-generated wiki nodes | Connected knowledge |
| **Transcripts** | Audio/video transcription | Searchable media |
| **Status Badges** | Visual indicators of processed state | Progress tracking |

**Files:** `src/pages/Wormhole.tsx`, `electron/main.ts`

## 2.7 Video Extraction

| Feature | Implementation | Value |
|---------|----------------|-------|
| **First Frame** | Extract opening frame as image card | Thumbnails, Veo input |
| **Last Frame** | Extract closing frame as image card | Loop creation |
| **Audio Extract** | Extract audio track as audio card | Sound assets |
| **Parent/Child Links** | Bidirectional references | Full lineage |

**Files:** `src/pages/CardLibrary.tsx` (`handleExtract`)

## 2.8 Loop Video Creation

| Feature | Implementation | Value |
|---------|----------------|-------|
| **One-Click Loop** | Button on image cards | Instant animation |
| **AI Motion Prompt** | LLM crafts looping motion description | Better loops |
| **Veo Integration** | Same image as start+end frame | Seamless loops |
| **Child Card** | Loop video linked as child of source image | Organized assets |

**Files:** `electron/main.ts` (`create-loop-video-for-image`)

## 2.9 Pet System (Forge)

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Pet Forge** | Create animated companions from sprites | Desktop pets |
| **Module System** | Click, random, command triggers | Interactive behaviors |
| **Sprite Animation** | GIF generation from sprite sheets | Animation assets |
| **Background Removal** | AI-powered transparency | Clean sprites |

**Files:** `src/pages/Forge.tsx`, `src/pages/Pets.tsx`

## 2.10 Profile & Identity

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Avatar Upload** | Image becomes Card, updates Hypercore | Persistent identity |
| **Neural Persona** | Customizable AI context | Personalized responses |
| **System Stats** | Storage, card count, P2P status | Dashboard overview |

**Files:** `src/pages/Profile.tsx` (Renamed to "Operator Profile")

## 2.11 Local AI (llama.cpp)

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Server Management** | Start/stop local llama-server | Local inference |
| **Model Downloads** | GGUF from Hugging Face URLs | Easy model access |
| **Model Registry** | List, set default, delete | Model management |
| **Chat Integration** | Same UI as cloud providers | Seamless switching |

**Files:** `src/pages/LocalLlama.tsx`, `electron/main.ts`

## 2.12 Diagrams (Mermaid)

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Live Editor** | Split-pane code/preview with debounce | Rapid diagramming |
| **Themes** | 5+ themes (dark, forest, etc.) | Professional aesthetics |
| **Templates** | Flowchart, Sequence, Gantt, etc. | Quick start |
| **Export** | PNG/JPG at 3x resolution | High-quality assets |

**Files:** `src/pages/Mermaid.tsx`

## 2.13 P2P Hypercore

| Feature | Implementation | Value |
|---------|----------------|-------|
| **Core Creation** | Named append-only logs | Persistent storage |
| **Peer Discovery** | Hyperswarm DHT | Decentralized sync |
| **Replication** | Automatic core sync | Data sharing |

**Files:** `electron/p2p.ts`, `src/pages/P2P.tsx`

---

# 3. System Architecture

## 3.1 Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   main.ts   │  │ pipeline.ts │  │  p2p.ts     │              │
│  │ IPC Handlers│  │  Pipeline   │  │ Hypercore   │              │
│  │ AI Clients  │  │  Manager    │  │ Hyperswarm  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ vertexai.ts │  │cardManager  │                               │
│  │ Vertex AI   │  │  Card Ops   │                               │
│  └─────────────┘  └─────────────┘                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (preload.ts bridge)
┌────────────────────────────▼────────────────────────────────────┐
│                       RENDERER PROCESS                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Chat.tsx  │  │CardLibrary  │  │ Pipeline    │              │
│  │   Forge.tsx │  │  Wiki.tsx   │  │   .tsx      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Shared Components                   │            │
│  │  VeoOptionsPanel, ImagenOptionsPanel, etc.      │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## 3.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│    Files, Text, Voice, Screenshots, Clipboard                   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                              │
│    Drag-Drop, Paste, File Picker, Hell Week Pipeline            │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI PROCESSING                                │
│    Gemini (LLM/Vision), Vertex AI, OpenAI, Local llama.cpp      │
│    Imagen (images), Veo (video), Whisper (audio)                │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CARD CREATION                                │
│    Cards with metadata, lineage, quality scoring                │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     HYPERCORE STORAGE                            │
│    card-library index, individual card cores, collections       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     P2P LAYER (Optional)                         │
│    Hyperswarm discovery, Core replication                       │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 IPC Communication

All renderer ↔ main communication goes through `preload.ts`:

```typescript
window.electronAPI = {
  // Chat
  chatWithGemini, chatWithOpenAI, chatWithLlama,
  listGeminiModels, listOpenAIModels, listLlamaModels,
  
  // Media Generation
  generateVideoWithGemini, generateImageForCard,
  createLoopVideoForImage,
  
  // Card Operations
  p2pRead, p2pAppend, wormholeIngestContent,
  wormholeRunSummary, wormholeRunWikiUpdate,
  
  // Pipeline
  pipelineStart, pipelineStop, pipelineAdvance,
  pipelineRecoverCards, repairHellWeekParents,
  
  // Settings
  saveSettings, getSettings,
  getVertexAISettings, saveVertexAISettings,
  
  // ... and more
}
```

---

# 4. Data Models & Storage

## 4.1 Card Index Entry (card-library core)

```typescript
interface CardIndexEntry {
  type: 'card-index';
  cardId: string;
  cardType?: 'standard' | 'set' | 'merged-set';
  name?: string;
  createdAt: string;
  
  // Media
  mediaKind?: 'image' | 'video' | 'audio' | 'message';
  mediaLocalPath?: string;
  thumbnail?: string;
  
  // Lineage
  parentCardId?: string;
  memberOfSets?: SetMembership[];
  
  // Set Card specific
  containedCards?: ContainedCard[];
  containedCardCount?: number;
  skills?: Skill[];
  
  // Hell Week data
  cardData?: {
    name: string;
    lore: string;
    skills: Skill[];
    stats: Record<string, number>;
  };
  mediaPrompts?: {
    base_image: string;
    generated_image_local: string;
  };
  
  // Quality
  tier?: number;
  
  // Hypercore reference
  coreName?: string;
  coreKey?: string;
}
```

## 4.2 Set Membership

```typescript
interface SetMembership {
  setCardId: string;
  joinedAt: string;
  addedBy?: string;
}

interface ContainedCard {
  cardId: string;
  addedAt: string;
  order?: number;
}
```

## 4.3 Skill System

```typescript
interface Skill {
  id: string;
  name: string;
  type: 'passive' | 'active' | 'triggered';
  description: string;
  effects?: SkillEffect[];
  cooldownMs?: number;
}
```

## 4.4 Storage Locations

| Data | Location | Format |
|------|----------|--------|
| **Card Index** | `storage/card-library/` | Hypercore |
| **Individual Cards** | `storage/{cardId}/` | Hypercore |
| **Media Files** | `userData/wormhole/` | Binary files |
| **Settings** | electron-store | JSON |
| **Hell Week Runs** | `storage/{runId}/` | Hypercore |

---

# 5. Key Components Deep Dive

## 5.1 Hell Week Pipeline (`electron/pipeline.ts`)

The pipeline is a **state machine** that transforms documents into cards:

```
IDLE → LEO_INGESTION → LEO_ANALYSIS → LEO_REVIEW
                                         ↓
THOR_REVIEW ← THOR_PROCESSING ← THOR_CHUNKING
     ↓
CONVICTION → COMPLETE
```

**Key Classes:**
- `PipelineManager` - State machine, orchestrates phases
- `CardManager` - Manages card creation, image queue

**Model Configuration:**
```typescript
MODEL_SHORTHAND_MAP = {
  'smart-llm': 'gemini-2.5-pro',
  'fast-llm': 'gemini-2.5-flash',
  'pro-image': 'imagen-4.0-generate-001',
  'video': 'veo-2.0-generate-001',
}
```

## 5.2 Vertex AI Client (`electron/vertexai.ts`)

Unified client for Google's Vertex AI platform:

```typescript
class VertexAIClient {
  generateContent(prompt, modelShorthand)     // LLM
  generateImageImagen(prompt, modelShorthand) // Images
  generateVideo(prompt, options)              // Video
  pollVideoOperation(operationName)           // Async video
}
```

## 5.3 Card Quality System (`src/utils/cardQuality.ts`)

Gamified quality scoring:

```typescript
// Affixes (attributes)
MEDIA: 2 points     // Has primary media
LOOP: 2 points      // Has loop video/GIF
SUMMARY: 1 point    // Has AI summary
KEY_TERMS: 1 point  // Has extracted terms
WIKI: 1 point       // Has wiki entries
TRANSCRIPT: 2 points // Has transcript
NAMED: 1 point      // Has custom name
LINKED: 2 points    // Has parent/child

// Tiers (max 13 points)
Common: 0-1      Uncommon: 2-3    Rare: 4-5
Epic: 6-8        Legendary: 9-11  Mythic: 12-13
```

---

# 6. Current State Assessment

## 6.1 What's Working Well ✅

| Area | Status | Notes |
|------|--------|-------|
| **Multi-provider Chat** | Stable | Gemini, OpenAI, Local all functional |
| **Card Library** | Stable | Core CRUD, filtering, quality system |
| **Hell Week Pipeline** | Functional | End-to-end document → cards works |
| **Image Generation** | Stable | Imagen 4 via Vertex AI |
| **Video Generation** | Functional | Veo via Vertex/AI Studio |
| **Loop Video Creation** | Recently Fixed | Now writes to correct store |
| **Card Lineage** | Functional | Parent/child relationships |
| **3D Viewer** | Functional | Basic card visualization |

## 6.2 Recent Fixes (Dec 6, 2025)

1. **Create Image Button** - Now uses Imagen 4 (was incorrectly using Gemini Flash)
2. **Loop Video Children** - Now saved to card-library index (was wrong hypercore)
3. **Hell Week Parents** - Cards now get `parentCardId` set to Set Card
4. **Hell Week Data** - `cardData` (skills, lore, stats) now included in index
5. **Retroactive Repair** - Added `repair-hell-week-parents` IPC handler

## 6.3 Known Issues / Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| **No Authentication** | High | P2P has no encryption/auth |
| **Memory Leaks** | Medium | Long video polling can accumulate |
| **Pre-existing Lint Warnings** | Low | CSS inline styles, accessibility |
| **No Automated Tests** | Medium | Risk with refactoring |
| **Fragile Hypercore Refs** | Medium | Some cards reference wrong cores |

---

# 7. Priority Roadmap

## 7.1 Current Understanding of End Goals

Based on the codebase and documentation, the production goals appear to be:

1. **Sovereign AI Workspace** - Users own their data, can run locally
2. **Knowledge Cards** - All content as reusable, composable cards
3. **P2P Trading** - Cards tradeable between peers
4. **Gamified Progression** - XP, leveling, skills, evolution
5. **"The Garden"** - A navigable graph of all knowledge

## 7.2 Priority Ranking

### 🔴 P0 - Critical Path to Production

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | **Stability Pass** | Fix known bugs, add error boundaries |
| 2 | **Data Integrity** | Ensure all card relationships are correct |
| 3 | **Offline Mode** | Full functionality without cloud APIs |
| 4 | **Performance Audit** | Memory leaks, large library handling |

### 🟠 P1 - High Value Features

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 5 | **Card Evolution** | Core gamification mechanic |
| 6 | **Skill System** | Cards with abilities/effects |
| 7 | **Search & Discovery** | Find content in large libraries |
| 8 | **Export/Backup** | User data portability |

### 🟡 P2 - Enhanced Experience

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 9 | **3D Vault** | Immersive card browsing |
| 10 | **P2P Trading** | Decentralized card exchange |
| 11 | **Card Crafting** | Combine cards into new ones |
| 12 | **Onboarding Flow** | New user experience |

### 🟢 P3 - Polish & Expansion

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 13 | **Mobile Companion** | View cards on mobile |
| 14 | **Plugin System** | Extensibility |
| 15 | **Theming** | Customizable appearance |
| 16 | **Localization** | Multi-language support |

---

# 8. Quick Reference

## 8.1 Key Files

| Purpose | File |
|---------|------|
| Electron Main | `electron/main.ts` |
| IPC Bridge | `electron/preload.ts` |
| P2P/Hypercore | `electron/p2p.ts` |
| Hell Week Pipeline | `electron/pipeline.ts` |
| Vertex AI Client | `electron/vertexai.ts` |
| Card Library UI | `src/pages/CardLibrary.tsx` |
| Chat UI | `src/pages/Chat.tsx` |
| Pipeline UI | `src/pages/Pipeline.tsx` |
| Diagrams UI | `src/pages/Mermaid.tsx` |
| Card Quality | `src/utils/cardQuality.ts` |
| Card Types | `src/types/cardSet.ts` |

## 8.2 Key IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `p2p-read` | Main→Renderer | Read hypercore |
| `p2p-append` | Main←Renderer | Write to hypercore |
| `chat-stream` | Main→Renderer | Streaming AI response |
| `pipeline:status` | Main→Renderer | Pipeline state updates |
| `loop-video-progress` | Main→Renderer | Video generation progress |

## 8.3 Development Commands

```bash
npm run dev          # Start Electron + Vite dev server
npm run build        # Build for production
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript check
```

## 8.4 Key Hypercores

| Core Name | Purpose |
|-----------|---------|
| `card-library` | Index of all cards |
| `wiki-index` | Wiki entries |
| `card-sets` | Legacy set metadata |
| `{cardId}` | Individual card data |
| `{runId}` | Hell Week run data |

---

## Document Maintenance

This document should be updated when:
- Major features are added
- Architecture changes significantly
- New data models are introduced
- Priority assessment changes

**Maintained by:** AI Assistant (Cascade)  
**Source:** `docs/HAPA_AG_SYSTEM_REFERENCE.md`
