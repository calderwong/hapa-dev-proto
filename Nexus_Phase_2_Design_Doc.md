# Nexus Phase 2 — Performance, Infinite Library Loading, Richer Card Faces

## 0) Goals

- Reduce perceived and actual load time for the 3D Nexus.
- Make `LOCAL ↔ GLOBAL` transitions feel seamless (no “frozen UI”).
- Support an effectively infinite library by loading *incrementally* and *on demand*.
- Upgrade the 3D card face to show more meaningful content beyond title:
  - Lore
  - Skills
  - Truth analysis: facts + desires

## 1) Non‑Goals (for Phase 2)

- Perfect graph/physics simulation for extremely large graphs.
- Full “search across infinite library” UX polish (we’ll provide backend hooks and a workable UI).
- Replacing the rendering engine (we’ll keep React Three Fiber / Three.js).

## 2) Current State (Observed)

### Renderer data loading
- `src/pages/Nexus.tsx` currently calls `window.electronAPI.p2pRead('card-library')` without paging.
  - This returns the entire hypercore history for the card library.
  - Renderer then JSON-parses and de-dupes in JS.

### Why GLOBAL is slow / UI freezes
- Switching to GLOBAL causes a large increase in:
  - Number of `Card3D` components mounted.
  - Formation position computation (`calculateFormationPositions` over all global cards).
  - Connection edge computation (capped, but still iterates `filteredCards`).
  - Texture resolution attempts for thumbnails for many cards.
- Even if React state updates are “fast”, the burst of CPU + GC can block the UI thread.

## 3) Phase 2 Architecture Overview

Phase 2 introduces a dedicated Nexus Data API layer (IPC), plus a renderer-side loader + caches.

### 3.1 Principles
- Do **not** load/parse the entire card-library in the renderer.
- Push “scan + de-dupe” work into the **main process**.
- Use **paged/streamed** reads and **batched hydration**.
- Render progressively: show something quickly, then refine.

## 4) Backend (Electron Main) — New IPC API

We already have primitives:
- `p2pRead(name, options)` -> `readCore(name, { start, end, reverse, limit })`
- `p2pGetLength(name)`

Phase 2 adds Nexus-focused endpoints to avoid renderer parsing and to support infinite loading.

### 4.1 `nexus:indexPage` (paged, de-duped)

**Goal:** Return *N unique* card index entries efficiently.

- **Request**
  - `coreName: string` (default: `card-library`)
  - `cursor?: number` (hypercore position / “end index”) 
  - `limit: number` (e.g. 120)
  - `direction: 'reverse' | 'forward'` (default: `reverse` for “most recent first”)

- **Response**
  - `items: IndexEntry[]` (unique by `cardId`)
  - `nextCursor?: number`
  - `hasMore: boolean`

- **Algorithm (main process)**
  - Read blocks in windows using `readCore` with `{ reverse: true, start, end, limit: windowSize }`.
  - Parse JSON and keep only `type === 'card-index'`.
  - De-dupe by `cardId/coreName` by taking the first encountered in reverse order.
  - Continue reading additional windows until `items.length === limit` or you hit `0`.

This avoids the renderer loading/parsing the full history and aligns with infinite library.

### 4.2 `nexus:cardLatestBatch` (batched hydration)

**Goal:** Fetch the latest record for a set of cores efficiently.

- **Request**
  - `coreNames: string[]` (card cores)

- **Response**
  - `recordsById: Record<string, any>`

- **Implementation**
  - For each core: `readCore(coreName, { reverse: true, limit: 1 })`, parse last JSON object.
  - Concurrency-limited (e.g. 4–8) to avoid disk thrash.

This is the authoritative place to get lore/skills/facts/desires for the richer card face.

### 4.3 Optional (future) — Persistence-backed queries

There is an existing SQLite projection engine (`persistence:*` IPC). Phase 2 can optionally route:
- “global feed” = persistence query (sorted by recency/relevance)
- “local constellation” = neighbor query

This can become the long-term scalable solution if hypercore scans become expensive.

## 5) Renderer — Loader + Caches + Progressive Rendering

### 5.1 A Nexus Loader state machine

Add a renderer-side loader (hook or store) with:
- `indexPages` (paged list)
- `indexById` (deduped map)
- `recordCache` (LRU)
- `inFlight` tracking

### 5.2 Loading strategy
- Initial load: request `nexus:indexPage(limit=120)`.
- Immediately render with minimal data (name/thumbnail/tier).
- Background hydration:
  - Fetch card records for:
    - focused card
    - top N visible cards
    - a small prefetch window (e.g. 24–48)

### 5.3 Infinite library
- As user searches / changes formation / scrolls UI list:
  - Request next page(s) using `nextCursor`.
- Hard cap “rendered at once” for GLOBAL (configurable), even if library infinite.

## 6) Perceived Performance — Seamless LOCAL ↔ GLOBAL Switch

### 6.1 Immediate overlay paint
When toggling scope:
- Set `isSwitchingScope=true` *first*.
- Yield a frame so the overlay renders.
- Then perform the heavy state update (scope change + recompute).

Implementation approach:
- Use `requestAnimationFrame(() => startTransition(() => setScopeMode(next)))`.
- Keep overlay visible until:
  - next render completes
  - and minimum display time passes (e.g. 250ms) to avoid flicker.

### 6.2 Progressive global reveal
- In GLOBAL, render in waves:
  - Wave 1: focused + recent 60
  - Wave 2: +60, etc.
- This prevents a single massive mount.

## 7) Richer Card Faces (without killing FPS)

`Card3D` already has props for `skills`, `lore`, `keyTerms`.
Phase 2 expands the card face content and introduces LOD-based text density.

### 7.1 Data model mapping
- `cardRecord` should feed:
  - `name`
  - `lore`
  - `skills[]`
  - `truth_analysis.facts[]`
  - `truth_analysis.desires[]`

Source of truth may vary by card type:
- Pipeline/HellWeek cards store these fields in their card record.
- Other card types may not have them — UI should degrade gracefully.

### 7.2 LOD levels
- **LOD0 (focused)**
  - Title
  - 2–4 line lore excerpt
  - up to 3 skills (name + short description)
  - facts/desires chips (top 2 each)

- **LOD1 (near)**
  - Title
  - 1 line lore excerpt
  - up to 2 skill names

- **LOD2 (far)**
  - Title only (current)

### 7.3 Rendering constraints
- Prefer the existing `Html` overlay for text.
- Strict truncation and small lists to avoid huge DOM.
- Only compute derived “preview strings” in `useMemo`.

## 8) Implementation Plan (after approval)

### Milestone A — Backend API
- Add IPC handlers in `electron/main.ts`:
  - `nexus:indexPage`
  - `nexus:cardLatestBatch`

### Milestone B — Renderer data loader
- Update `src/pages/Nexus.tsx` to use paged index loading.
- Add incremental state updates (no full-library parse).

### Milestone C — Seamless scope transitions
- Add scope-switch overlay to `Card3DViewer`.
- Switch scope via `requestAnimationFrame + startTransition`.
- Optional progressive global reveal (waves).

### Milestone D — Richer card faces
- Update `Card3DViewer` to pass richer data into `Card3D`.
- Update `Card3D` to render LOD0/LOD1/LOD2.

## 9) Open Questions (need your confirmation)

- In GLOBAL mode, do you want:
  - **All cards ever** (but only render a capped window), or
  - A **feed** of “most recent / most relevant” (preferred for infinite scaling)?

- What should the default GLOBAL window be?
  - 200 / 500 / 1000?

- Should search in GLOBAL:
  - filter only loaded pages (fast), or
  - invoke persistence search (scalable, best UX)?
