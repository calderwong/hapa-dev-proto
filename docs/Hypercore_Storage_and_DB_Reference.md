# Hypercore Storage + SQLite Projection DB (Current Reference)

This document is an **implementation-level** reference for how storage is currently handled in this repo, across:

- **Hypercore** (append-only logs, primary source-of-truth)
- **Local filesystem assets** (Wormhole files, prototypes, etc.)
- **SQLite projection DB** (query cache / index)

It covers:

- Storage roots and directory layout
- Hypercore core naming conventions
- Record “schemas” (JSON shapes) currently written
- Every known **create/read/update/destroy** pathway and where it lives in code

## Scope and non-goals

- **In scope**: current codepaths that write/read Hypercores and the SQLite projection DB.
- **In scope**: how “deletion” works in an append-only world (logical deletes, unlinking, etc.).
- **Not in scope**: proposing a new storage architecture; this is an audit of what exists today.

---

# 1) Storage roots

## 1.1 Hypercore storage root

**Authoritative module**: `electron/p2p.ts`

- The app maintains a single in-memory variable `storageDir` used for all Hypercore instances created via `createCore()`.
- Hypercores are created with:
  - `new Hypercore(path.join(storageDir, name))`

### Resolution rules

`electron/main.ts` sets the storage directory during `app.on('ready')`:

- **Default**: `path.join(app.getPath('userData'), 'storage')`
- **Override (highest precedence)**: `process.env.HAPA_STORAGE_DIR` (when set, applied via `setStorageDir(..., { force: true })`)
- **Legacy fallback behavior (when not forced)**: `setStorageDir` compares presence/size of:
  - `path.resolve(process.cwd(), 'storage/card-library')` (legacy cwd storage)
  - `<defaultDir>/card-library`

If both exist, it picks the one with larger `card-library` directory size.

**Files**:
- `electron/p2p.ts` (`setStorageDir`, `getStorageDir`, `createCore`)
- `electron/main.ts` (sets storage on startup)

## 1.2 Local filesystem assets

These are **not** stored inside Hypercore blocks; they are stored as files on disk and then referenced by path inside card records.

Common locations:

- **Wormhole ingest directory**: `path.join(app.getPath('userData'), 'wormhole')`
  - Used when ingesting bytes from UI and when downloading via URL.
  - **File**: `electron/main.ts` (`ipcMain.handle('wormhole-ingest-content', ...)`)

- **Prototype HTML directory**: `path.join(app.getPath('userData'), 'prototypes')`
  - **File**: `electron/main.ts` (`ipcMain.handle('save-prototype', ...)`)

- **Profile image directory**: `path.join(app.getPath('userData'), 'wormhole')`
  - Profile images are written into the wormhole dir too.
  - **File**: `electron/main.ts` (`ipcMain.handle('save-profile-image', ...)`)

## 1.3 SQLite projection DB root

**Authoritative modules**:
- `electron/persistence.ts`
- `electron/SqliteAdapter.ts`

DB path:
- `path.join(app.getPath('userData'), 'persistence.db')`

Important caveat:
- `initPersistence()` exists but is **not currently invoked** anywhere in `electron/main.ts` (imported but no call found by audit).
- Result: the DB may not be created/used unless some other module calls `initPersistence()`.
- IPC endpoints (e.g. `persistence:search-cards`) will return empty/defaults if the adapter isn’t initialized.

---

# 2) Hypercore layout on disk

Given `storageDir = <root>`, each core is created at:

- `<storageDir>/<coreName>/...`

On disk Hypercore typically creates a subfolder structure (commonly including `db/`), but this is an internal detail of Hypercore’s random-access storage layer.

Empirical evidence in this repo:
- There are many folders like `storage/<coreName>/db/` (seen in the repo’s `storage/` tree).

---

# 3) Core naming conventions (observed)

## 3.1 Index and registry cores

- **`card-library`**
  - The global index of cards and other entities.
  - “Last write wins” de-dupe is done in readers by scanning the full log.

- **`card-sets`**
  - Stores legacy set metadata and merged sets.
  - **Writer**: `electron/pipeline.ts` + `electron/main.ts` card-sets IPC

- **`wormhole-wiki-entries`**
  - Stores wiki entries and wiki-term meta records.
  - Written by Wormhole “wiki update” pipeline and by Wiki UI metadata editor.

- **`chat-archives`**
  - Stores chat archive payloads.
  - **Writer**: `src/pages/Chat.tsx` (via p2pCreateCore + p2pAppend)

## 3.2 Per-card / per-entity cores

These are “individual” cores that store the evolving record for a single entity:

- **Wormhole ingests**: `card-<timestamp>-<rand>`
  - Created in `electron/main.ts` `wormhole-ingest-content`.

- **Chat image cards**: `card-<timestamp>-<rand>`
  - Created in `src/pages/Chat.tsx` `createImageCard`.

- **Chat message cards**: `msg-<timestamp>-<rand>`
  - Created in `src/pages/Chat.tsx` `createMessageCard`.

- **Hell Week card-centric state**: `hell-week-card-<cardId>`
  - Written by `electron/cardManager.ts` as `type: 'card-state'` records.

- **Hell Week run collection**: `hell-week-run-<timestamp>`
  - Written by `electron/pipeline.ts` as `type: 'collection-header'` + many `type: 'card'` blocks.

- **Generated image cards (CardLibrary)**: `img-<timestamp>-<rand>`
  - Created in `src/pages/CardLibrary.tsx` image generation flow.

- **Pets**: `pet-<timestamp>-<rand>`
  - Created in `src/utils/petCardUtils.ts`.

- **Avatars**: `avatar-<timestamp>-<rand>`
  - Created in `src/pages/Forge.tsx`.

- **Operator profile image**: `card-profile-<timestamp>-<rand>`
  - Created in `electron/main.ts` `save-profile-image`.

---

# 4) Record schemas (JSON shapes)

Hypercore blocks are plain JSON strings. There is **no enforced schema**; readers must parse and pattern-match.

Below are the **major record types currently written**.

## 4.1 `card-library` index entries (`type: 'card-index'`)

Written by many features:

Common fields (observed):

- `type: 'card-index'`
- `cardId: string`
- `coreName: string`
- `createdAt: string` (ISO)
- Optional metadata:
  - `name`, `title`
  - `mediaKind` / `mediaType`
  - `thumbnail` / `mediaLocalPath`
  - `provider`, `model`
  - lineage fields like `parentCardId`, `memberOfSets`, `setId`, `containedCards`

Examples of writers:
- `electron/main.ts` (Wormhole ingest, profile image)
- `electron/pipeline.ts` (Hell Week indexing)
- `src/pages/CardLibrary.tsx` (generated image cards, loop video cards)
- `src/pages/Chat.tsx` (image cards, message cards)
- `src/utils/petCardUtils.ts` (pet index entries)
- `src/pages/Forge.tsx` (avatar index entries)
- `src/pages/RevidMedia.tsx` (Revid-imported media cards)

**Important**: consumers generally treat the index as “last write wins” per `cardId`.

## 4.2 Generic card record (`type: 'card'`)

This is the broad “card object” shape used across Wormhole, Chat, generated images, etc.

Common fields:

- `type: 'card'`
- `id: string` (often equal to the core name)
- `kind: 'document' | 'audio' | 'video' | 'image' | 'message' | ...`
- `createdAt: string`
- `updatedAt?: string`
- `title?: string`
- `tags?: string[]`
- media-specific payloads:
  - `image?: { localPath?: string; url?: string; imageUrl?: string; mimeType?: string; dataUrl?: string }`
  - `video?: { localPath?: string; mimeType?: string; fileName?: string; remoteUrl?: string }`
  - `audio?: { localPath?: string; mimeType?: string; fileName?: string; remoteUrl?: string }`

### Wormhole card record

Written by `electron/main.ts` `wormhole-ingest-content`.

Adds:
- `wormhole: { ingest: {...}, processing: {...} }`
- `core: { name, key, discoveryKey, length }`

`wormhole.ingest` includes:
- `contentId`, `toolId`, `mediaType`, `originalPath`, `originalFileName`, `originalUrl?`, `tags?`, timestamps

`wormhole.processing` includes step objects:
- `ingest` (complete)
- `transcription?` (audio/video)
- `summarization`, `keyTerms`, `wikiUpdate` (pending → complete)

### Chat image card record

Written by `src/pages/Chat.tsx` `createImageCard`.

Notably stores:
- `image: { mimeType, dataUrl }` (inline base64 data)
- thread/message provenance fields: `threadId`, `messageId`, `role`, `source`, `provider`, `model`

### CardLibrary generated image card record

Written by `src/pages/CardLibrary.tsx` image generation flow.

Notably stores:
- `wormhole.ingest.originalPath` pointing at the generated file path
- `generationPrompt`, `generationModel`, `generationIndex`, `seriesContext` (continuation info)
- `parentId` linking to the parent card
- `children` array

## 4.3 Hell Week card state wrapper (`type: 'card-state'`)

Written by `electron/cardManager.ts`.

Shape:
- `type: 'card-state'`
- `timestamp: string`
- `card: HellWeekCard` (full state machine object)

This is used for “card-centric architecture” and is different from the generic `type: 'card'` records used elsewhere.

## 4.4 Hell Week run collection

Written by `electron/pipeline.ts` in `runConvictionFinalizing()`.

- First block: `type: 'collection-header'` with run metadata.
- Subsequent blocks: `type: 'card'` with card details.

## 4.5 Wormhole transcript record (`type: 'wormhole-transcript'`)

Written by `electron/main.ts` `wormhole-run-transcription`.

Shape:
- `type: 'wormhole-transcript'`
- `cardId: string`
- `createdAt: string`
- `provider: 'openai'`
- `model: string` (defaults to `whisper-1`)
- `mimeType: string`
- `text: string`

## 4.6 Wiki records

### Wiki entry (`type: 'wiki-entry'`)

Written by `electron/main.ts` `wormhole-run-wiki-update`.

Shape:
- `type: 'wiki-entry'`
- `wikiId: string`
- `term: string`
- `kind?: string`
- `createdAt: string`
- `sourceCardId: string`
- `source: 'wormhole'`

### Wiki term metadata (`type: 'wiki-term-meta'`)

Written by `src/pages/Wiki.tsx`.

Shape:
- `type: 'wiki-term-meta'`
- `term`, `slug`, `definition?`, `relatedTerms?`, `updatedAt`

## 4.7 Config records (stored in card-library)

Used for Imagen options panel.

- `type: 'config'`
- `subType: 'negative-prompt' | 'imagen-template'`
- `cardId`, `coreName`, `createdAt`
- `content` (negative prompt) or `config` (template)

**Writer**: `src/components/ImagenOptionsPanel.tsx`

## 4.8 Prototype record

Written by `electron/main.ts` `save-prototype`.

Current behavior is slightly inconsistent:
- Core name is `card-<uuid>`
- Record stored in that core uses `type: 'prototype'` and contains `cardData.htmlContent`.
- Index entry appended into `card-library` does **not** include `type: 'card-index'` in the snippet observed; readers may still accept it due to loose parsing.

---

# 5) SQLite projection DB

## 5.1 Purpose

The SQLite DB is intended as a **rebuildable local query cache** on top of Hypercore data.

**Primary source of truth remains Hypercore**.

## 5.2 Schema (tables)

Defined in `electron/SqliteAdapter.ts` as `SCHEMA_SQL`.

- `cards` (core card metadata)
- `card_fts` (FTS5 virtual table)
- `wiki_nodes`
- `wiki_fts` (FTS5)
- `wiki_edges`
- `embeddings` (placeholder for future vector search)
- `projection_meta` (contains `projection_version`)

## 5.3 Event ingestion

**Adapter entrypoint**:
- `SqliteAdapter.applyEvent(event)`

Currently handled events:
- `CARD_CREATED` → upsert into `cards` + rebuild row in `card_fts`
- `CARD_UPDATED` → treated as upsert
- `WIKI_NODE_CREATED` → upsert into `wiki_nodes` + `wiki_fts`
- `WIKI_EDGE_CREATED` → insert ignore into `wiki_edges`

Not implemented (defined but not handled):
- `CARD_DELETED`, `WIKI_EDGE_DELETED`, etc.

## 5.4 Initialization / lifecycle

Singleton wrapper:
- `electron/persistence.ts`

Responsibilities:
- Creates the DB at `userData/persistence.db`.
- On certain sqlite truncate errors, renames DB/WAL/SHM to `*.corrupt` and retries.

**Important**: `initPersistence()` is not called by `electron/main.ts` as of this audit.

## 5.5 IPC surface (queries)

Defined in `electron/main.ts`:

- `persistence:search-cards`
- `persistence:get-rag-context`
- `persistence:get-neighbors`
- `persistence:get-stats`

All of these return empty/default results if the adapter is not ready.

## 5.6 When events are emitted today

Event emission functions:
- `emitCardEvent(type, cardData)`
- `emitCardEvents([...])`

Observed emission call sites:

- `electron/main.ts`
  - `wormhole-ingest-content` emits `CARD_CREATED`
  - `save-profile-image` emits `CARD_CREATED` (only when the card is newly created)

- `electron/pipeline.ts`
  - Batch emits `CARD_CREATED` for Hell Week cards and set cards during finalization

Notably absent (no DB updates) in many other writers:
- Chat-created cards (`src/pages/Chat.tsx`)
- Revid-imported cards (`src/pages/RevidMedia.tsx`)
- Pet cards (`src/utils/petCardUtils.ts`)
- Generated image cards created in CardLibrary UI

---

# 6) CRUD lifecycle map (complete audit)

## 6.1 Create

### A) Create a Hypercore (core directory)

- **Main process only**: `electron/p2p.ts:createCore(name)`
  - Ensures `storageDir` exists
  - `new Hypercore(path.join(storageDir, name))`
  - `swarm.join(core.discoveryKey)`

Renderer triggers this via IPC:
- `window.electronAPI.p2pCreateCore(name)` → `ipcMain.handle('p2p-create-core')` → `createCore(name)`

### B) Create a new “card” (record in its own core)

Patterns:

- Create core (`p2pCreateCore`)
- Append primary record (`p2pAppend`)
- Append index entry into `card-library` (`p2pAppend`)

This pattern is used by:
- Chat image/message cards (`src/pages/Chat.tsx`)
- Revid cards (`src/pages/RevidMedia.tsx`)
- Pet cards (`src/utils/petCardUtils.ts`)
- Forge avatar cards (`src/pages/Forge.tsx`)
- CardLibrary generated image cards (`src/pages/CardLibrary.tsx`)

### C) Wormhole ingestion (special create)

`electron/main.ts` → `ipcMain.handle('wormhole-ingest-content')`

- If bytes: writes file under `userData/wormhole/`.
- If URL: downloads and writes file under `userData/wormhole/`.
- Creates a new card core named `card-<timestamp>-<rand>`.
- Appends a `type:'card'` Wormhole record referencing the local file path.
- Appends a `type:'card-index'` into `card-library`.
- Emits persistence `CARD_CREATED` (if persistence is initialized).

### D) Hell Week pipeline creation

- Card-centric state written to per-card core: `electron/cardManager.ts` → `hell-week-card-<cardId>`
- Run collection core: `electron/pipeline.ts` → `hell-week-run-<timestamp>`
- Indexing into `card-library`: `electron/pipeline.ts` finalization step

## 6.2 Read

### A) Read core blocks

- Main process: `electron/p2p.ts:readCore(name, options)` uses `core.createReadStream`.
- Renderer: `window.electronAPI.p2pRead(name)`

### B) Card library reads

- Many UIs read `card-library` then hydrate individual cores.
- Performance-sensitive flows increasingly use paging/hydration via Nexus IPC:
  - `nexus:index-page`
  - `nexus:card-latest-batch`

### C) Wormhole wiki index

- `electron/main.ts` `wormhole-get-wiki-index` reads `wormhole-wiki-entries` and returns:
  - `entryList`
  - `metaMap` (term metadata)

### D) SQLite projection reads

- Renderer uses:
  - `window.electronAPI.persistenceSearchCards(...)` etc.
- Main process handles via `SqliteAdapter` if initialized.

## 6.3 Update

There is no in-place mutation in Hypercore. “Update” is always:

- Read latest record
- Create a new version object
- Append it to the same core

Examples:
- CardLibrary updates parent `children` lists
- Wormhole processing steps append new transcript/summary/keyTerms and then append an updated `type:'card'` record with updated `wormhole.processing`
- Pets: append updated pet card + append updated `card-index` entry
- Hell Week cards: append `card-state` with full updated state machine

## 6.4 Destroy

### A) Hypercore deletion

**Physical deletion is not implemented**.

- There is no `deleteCore` IPC.
- There is no `fs.rm`/`unlink` usage for Hypercore storage folders.

So “destroy” today means:

- **Logical deletion** (not consistently implemented): append a tombstone entry (there are types like `CARD_DELETED` in projection types, but there is no implemented emitter/handler).
- **Unlinking**: append a new parent record that removes a child reference.
  - Example: `src/components/CardWorkspace.tsx` `handleAudioDelete` removes child from parent’s `children` array and appends updated parent record.

### B) SQLite projection DB “destruction”

`electron/persistence.ts` will rename a corrupt sqlite file:

- `persistence.db` → `persistence.db.<timestamp>.corrupt`
- also `-wal` and `-shm`

Then it recreates a new DB.

### C) Asset file deletion

No explicit deletion flow is implemented for:
- Wormhole ingested files
- Generated media files
- Prototypes

So disk usage is monotonically increasing unless the user cleans it manually.

---

# 7) Replication model (P2P)

**Authoritative file**: `electron/p2p.ts`

- A single Hyperswarm instance is created in `initP2P()`.
- On a new swarm connection:
  - it calls `core.replicate(conn)` for **every core currently in memory** (`cores.values()`).

Important implications:

- Only cores that were opened/created in this process are replicated.
- If a core exists on disk but was never opened in this session, it won’t replicate until opened.

---

# 8) Known inconsistencies / risks (observed)

- **ID vs coreName inconsistency**:
  - Some records set `id` to core name; others use separate `cardId` and `coreName`.
- **`card-library` entry schema is not consistent**:
  - Some append entries without `type:'card-index'` (e.g. prototype snippet).
  - Some use `mediaKind`, others use `mediaType`.
- **SQLite projection currently has partial coverage**:
  - Many features do not emit projection events.
  - `initPersistence()` is not called in main startup.
- **No garbage collection for local assets**:
  - Wormhole files and generated media accumulate.

---

# 9) File-to-responsibility index (authoritative pointers)

## Electron (main process)

- `electron/p2p.ts`
  - Hypercore init, storageDir resolution, core create/read/append, Hyperswarm replication.

- `electron/main.ts`
  - IPC surface:
    - `p2p-*` handlers
    - Wormhole ingest + processing pipeline handlers
    - Card Sets handlers
    - Projection DB query handlers
    - Profile image card creation
    - Prototype card creation

- `electron/pipeline.ts`
  - Hell Week pipeline writes run cores and indexes into `card-library`.
  - Recovery scans `storageDir` and indexes missing cores.

- `electron/cardManager.ts`
  - Card-centric state machine persisted to `hell-week-card-*` cores.

- `electron/persistence.ts` / `electron/SqliteAdapter.ts`
  - SQLite projection DB implementation and singleton.

## Renderer

- `src/pages/CardLibrary.tsx`
  - Reads card-library index and hydrates cores.
  - Creates generated image cards and loop video relationships.

- `src/pages/Wormhole.tsx` / `src/pages/WormholeAstro.tsx`
  - Calls wormhole IPC and reads card-library for feed.

- `src/pages/Wiki.tsx`
  - Writes wiki term metadata into `wormhole-wiki-entries`.

- `src/pages/Chat.tsx`
  - Creates image cards and message cards; uses Wormhole ingest for videos.
  - Archives chat payloads in `chat-archives`.

- `src/utils/petCardUtils.ts`
  - Creates/updates pets and indexes them.

- `src/pages/Forge.tsx`
  - Creates avatar cards and indexes them.

- `src/pages/RevidMedia.tsx`
  - Creates cards from Revid downloads and indexes them.

---

# 10) Testing / verification checklist (manual)

To verify what storage is being used at runtime:

- In the app, run `getSystemStats()` (wired in Card Library Recover UI) and check:
  - `storageDir`
  - `storageFreeBytes`
  - `cwd`

To validate the projection DB:

- Verify `initPersistence()` is called somewhere.
- Use `window.electronAPI.persistenceGetStats()` and confirm counts are non-zero.

---
