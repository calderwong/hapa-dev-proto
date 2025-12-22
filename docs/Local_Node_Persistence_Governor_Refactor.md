# Local Node Persistence as Governor (Refactor Plan)

## Goal
Make the **local node persistence layer** (SQLite) act as the user’s persistent “local truth” / memory ledger of **all cards the node has ever seen**, while **P2P Hypercore** remains the network source-of-truth that can override/update state.

This should:
- Improve startup and Card Library load performance (query local DB first).
- Prevent “forgetting” cards the node has seen (even if the card’s Hypercore is not locally present).
- Allow nodes to store partial knowledge (DIDs + metadata) for remote cards.

## Definitions
- **Network Truth (P2P Truth)**: authoritative state as represented by Hypercore append-only logs. This can correct or override the local snapshot.
- **Local Truth (User Truth)**: persisted SQLite snapshot of what this node knows. This should be queryable fast and survive restarts.
- **Seen Card**: any card ID/DID the node has encountered via:
  - Local creation
  - `card-library` index observation
  - Peer discovery / gossip / registry updates (future)

## Current State (Audit)
- There is an existing SQLite projection engine:
  - `electron/persistence.ts` (singleton)
  - `electron/SqliteAdapter.ts` (better-sqlite3)
  - Schema includes `cards`, `card_fts`, wiki tables.
- The current adapter design comment describes SQLite as a **rebuildable cache** over Hypercore.
- The Card Library paging/count logic is currently driven by Hypercore reads (`nexus:index-page`) and frontend paging.

## Key Problem
- Paging/counts and many UI views depend on scanning Hypercore directly.
- This makes the UI sensitive to cursor semantics and expensive to compute on startup.
- It also prevents the node from efficiently persisting knowledge about remote cards.

## Target Architecture
### 1) SQLite becomes the governor for local queries
- Card Library paging/counts should come from SQLite.
- SQLite stores at minimum:
  - `cardId` / DID
  - `createdAt` and last-known metadata
  - `coreName` if known
  - `mediaKind`, `thumbnail`, `parentCardId`, etc.
  - tombstone status (deleted) without losing the record

### 2) P2P reconciliation updates the local snapshot
- When the node sees new `card-index` records (local write or remote replication), it updates SQLite.
- When the node learns more detail (e.g. reads the card’s own core), it enriches the SQLite record.
- When P2P provides a delete/tombstone, SQLite marks the record as deleted (does not drop).

### 3) Monotonic ingestion / “don’t re-scan everything”
- Maintain per-core cursor/seq checkpoints in SQLite (`projection_meta`).
- On startup, read only new blocks since last checkpoint and project into SQLite.

## Where This Paradigm Should Apply
- **Card Library paging/counts** (primary user pain)
- **Search / RAG / wiki** (already routed through persistence IPC; ensure it’s actually populated)
- **Sets / lineage / metadata panels** (prefer DB-first for fast load)
- **Peer discovery** (future): record “seen” DIDs even without local Hypercore content

## Plan (Incremental)
### Phase A — Make SQLite authoritative for Card Library paging/counts
- Add DB columns needed for Card Library listing.
- Project `card-library` `card-index` entries into SQLite.
- Update `nexus:index-page` to query SQLite when ready.

### Phase B — Add background reconciliation + checkpoints
- Store last processed `card-library` seq in SQLite.
- On startup, ingest new index blocks since last seq.
- On each `p2p-append` to `card-library`, update SQLite immediately.

### Phase C — Expand “seen card” sources
- Add pathways for peer discovery / DID registry to insert stub cards into SQLite.
- Add “local snapshot override” rules: P2P wins when conflicts appear.

## Acceptance Criteria
- Card Library loads fast and paginates beyond a single page.
- Card counts reflect SQLite state and persist across restarts.
- Node does not forget cards it has seen even if their individual cores are missing.
- No regressions to current P2P append/write pathways.
