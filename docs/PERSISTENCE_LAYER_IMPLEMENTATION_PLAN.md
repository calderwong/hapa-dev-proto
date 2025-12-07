# Persistence Layer Implementation Plan

**Status:** Ready to Execute  
**Date:** December 6, 2025  
**Based On:** `docs/memory-notes-12-6-2025.md`

---

## Executive Summary

Implement a SQLite-based "projection layer" that mirrors Hypercore data for fast local queries, search, and RAG. Hypercore remains the source of truth; SQLite is a rebuildable cache.

---

## Phase Breakdown

### Phase 0: Scaffolding ⏱️ ~30 min ✅ COMPLETE
- [x] Create `src/persistence/` directory
- [x] Create `PersistenceAdapter.ts` interface
- [x] Create `SqliteAdapter.ts` skeleton
- [x] Create `types.ts` for shared types
- [x] Create `electron/persistence-types.ts` for main process
- [ ] **USER ACTION**: Install `better-sqlite3` dependency

### Phase 1: SQLite Integration ⏱️ ~45 min ✅ COMPLETE
- [x] Implement DB file creation in app data directory
- [x] Implement schema creation (cards, card_fts, wiki_nodes, wiki_edges, embeddings, projection_meta)
- [x] Implement `applyEvent` handlers for card/wiki events
- [x] Implement `searchCards` with FTS + filters
- [x] Implement `getRagContext` and `getGraphNeighbors`
- [x] Wire adapter to app lifecycle in `main.ts`

### Phase 2: Projection Wiring ⏱️ ~1 hr ✅ COMPLETE
- [x] Create `emitCardEvent()` helper function
- [x] Create shared `electron/persistence.ts` singleton module
- [x] Hook into Wormhole card creation
- [x] Hook into Loop Video card creation
- [x] Hook into Hell Week pipeline (batch events)
- [x] Hook into Agent Profile card creation
- [x] Add IPC handlers for persistence queries
- [x] Add preload bridge methods

### Phase 3: Query API ⏱️ ~45 min ✅ COMPLETE (implemented in Phase 1)
- [x] Implement `searchCards` with FTS + filters
- [x] Implement `getRagContext` 
- [x] Implement `getGraphNeighbors`
- [x] Expose via IPC to renderer

### Phase 4: Embeddings (Deferred) ⏱️ ~2 hr
- [ ] Add embedding provider abstraction
- [ ] Implement embedding queue + worker
- [ ] Integrate sqlite-vec/vss extension
- [ ] Wire vector search

### Phase 5: UI Integration (Deferred) ⏱️ ~2 hr
- [ ] Create Search UI component
- [ ] Wire to searchCards API
- [ ] Add rebuild/stats to Admin panel

---

## Implementation Details

### File Structure
```
src/
├── persistence/
│   ├── types.ts              # Shared types and interfaces
│   ├── PersistenceAdapter.ts # Interface definition
│   ├── SqliteAdapter.ts      # SQLite implementation
│   └── index.ts              # Exports
electron/
└── main.ts                   # Add adapter initialization
```

### Schema (v1)
```sql
-- Core cards table
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  tier INTEGER,
  hellweek_run_id TEXT,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT
);

-- Full-text search
CREATE VIRTUAL TABLE card_fts USING fts5(
  id UNINDEXED, name, content, tokenize='porter'
);

-- Wiki graph
CREATE TABLE wiki_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE wiki_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relation)
);

-- Projection metadata
CREATE TABLE projection_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Key Design Decisions

1. **Sync vs Async**: Use `better-sqlite3` (sync) for simplicity - DB operations are local and fast
2. **Location**: Store in `userData/persistence.db` alongside other app data
3. **Rebuild**: Always derivable from Hypercores - delete DB = fresh rebuild
4. **Versioning**: `projection_meta.projection_version` triggers rebuild on schema changes

---

## Execution Plan

### Step 1: Create Foundation Files
Create the TypeScript interface and adapter skeleton.

### Step 2: Add Dependency
Install `better-sqlite3` for Node/Electron SQLite.

### Step 3: Implement Adapter
Core SQLite operations, schema creation, CRUD.

### Step 4: Wire to App
Initialize adapter in Electron main, expose via IPC.

### Step 5: Add Projection Hooks
Hook into existing Hypercore append operations.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SQLite version conflicts | Use `better-sqlite3` which bundles its own SQLite |
| Electron rebuild issues | Native modules need electron-rebuild |
| Large DB performance | FTS5 + proper indexes; can shard later |
| Embedding costs | Start with FTS only; add embeddings Phase 4 |

---

## Success Criteria

1. ✅ `PersistenceAdapter` interface defined
2. ✅ `SqliteAdapter` can create/open DB
3. ✅ Schema created on first run
4. ⬜ Cards can be indexed from Hypercore events
5. ⬜ `searchCards` returns relevant results
6. ⬜ Rebuild from Hypercores works

---

## Self-Review Checklist

- [x] **Matches intent?** Yes - provides fast local queries while Hypercore stays source of truth
- [x] **Phased approach?** Yes - can ship Phase 0-1 quickly, defer embeddings
- [x] **Future-proof?** Yes - adapter pattern allows SurrealDB swap later
- [x] **Minimal scope?** Yes - starting with FTS only, no vector yet
- [x] **Compatible with existing code?** Yes - additive, doesn't change Hypercore logic

**PLAN APPROVED - PROCEEDING TO EXECUTION**
