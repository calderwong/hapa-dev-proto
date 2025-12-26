# Operator Reality Panel (Diagnostics + Control Surfaces) — Feature Design

**Status:** Draft
**Owner:** Cascade (Windows Hapa Node)
**Date:** 2025-12-25

---

## 1) The Big Rock

This is a “control surface” feature that makes the system’s *current truth* obvious.

It directly supports the top priorities:
- **Efficiency P0:** reduce ambiguity / speed up debugging
- **Performance P0:** prevent “performance bugs that look like data loss”
- **Integrity:** UI must not lie about truth source, counts, or availability

---

## 2) Bruce Lee Compression (Absorb → Reject → Add)

### Absorb (keep what works)

- Existing IPC surfaces:
  - `getSystemStats()`
  - `getPersistenceStats()`
  - `p2pGetLength(coreName)`
  - `nexusIndexPage(payload)`
- Existing debug state patterns:
  - `window.__HAPA_DEBUG_STATE__` (when present)
- Existing comms protocol:
  - `docs/.mind/Comms/PROTOCOL.md`

### Reject (remove the failure mode)

- “Hidden truth” debugging where:
  - you can’t tell if SQLite is caught up
  - paging silently flips sources
  - the UI *looks* like data loss
- Fix-by-guessing (“maybe it’s capped at 120… again”) instead of instrumented truth.

### Add (uniquely ours)

- A first-class **Operator Reality Panel** that:
  - exposes the truth hierarchy (SQLite vs Hypercore)
  - provides an exportable **debug packet**
  - includes safe operator actions (e.g., rebuild projection)

---

## 3) Cultivation Loop Mapping (Signal → Artifact → Validation → Reward → Capability)

- **Signal:** user reports symptoms (e.g., “stuck at 120 cards”), logs, counts.
- **Artifact:** a structured snapshot (“debug packet”) + a panel that renders it.
- **Validation:** reproducible checks (counts, checkpoints, paging mode).
- **Reward:** faster debugging + fewer regressions.
- **Capability:** new control surface that keeps compounding.

---

## 4) Problem Statement

We repeatedly hit expensive ambiguity:
- card counts disagree (Hypercore vs SQLite vs UI)
- paging can falsely stop (hasMore/cursor)
- storage roots can diverge
- rebuild/reconcile status is opaque

Also: different “counts” are often measuring different things:
- **Hypercore core length** is *append-only log length* (includes tombstones/deletes/edits).
- **SQLite card count** is *current projection state* (usually “not deleted”).
- **UI visible cards** can be filtered/sorted and can differ again.

When operators (humans or agents) don’t know what the system believes, they guess, and we re-derive old bugs.

---

## 5) Goals / Non-Goals

### Goals

- Provide a single UI that answers: **“What does the system believe right now?”**
- Make it obvious which truth source is active and why.
- Produce a copy/exportable “debug packet” for bug reports.
- Provide safe control actions:
  - rebuild Card Library projection
  - refresh snapshot

### Non-goals

- Not a replacement for DevTools.
- Not remote admin.
- Not a place to show secrets (API keys, tokens).
- Not a new data pipeline by itself — it’s an operator layer.

---

## 6) What it Does / Costs / Proves / Unlocks

### What it does

- Renders a **snapshot** of:
  - **Storage root**
  - **Hypercore index lengths** (`card-library`, etc.)
  - **SQLite counts + checkpoints**
  - **Paging mode** (SQLite vs Hypercore fallback) and reason
  - Optional: last known Card Library UI paging state if available

It should explicitly label the meaning of each count (log length vs projected rows vs UI filtered).

### What it costs

- A small amount of new UI surface area and a small polling/refresh loop.
- Some TypeScript surface area for a stable snapshot schema.

### What it proves

- We can make truth obvious without touching hot files.
- We can reduce “infinite debugging loops” by giving operators a shared reality.

### What it unlocks

- Exportable diagnostics bundles.
- Safer large refactors (because reality is observable).
- Smooth Mac Nexus integration (queue/status fits naturally into this panel).

---

## 7) UX / UI

### Surface location

Proposed: a new sidebar route (e.g. **Operator**) that opens the panel.

Fallback: integrate into the existing Profile page if we want fewer nav items.

### Sections

- **Reality Snapshot (top)**
  - last updated timestamp
  - Refresh button
  - Copy JSON button

- **Truth Sources**
  - Hypercore: card-library length
  - SQLite: cards row count, checkpoints

- **Paging Mode**
  - result of `nexusIndexPage({ limit: 1 })`:
    - source
    - hasMore
    - nextCursor
    - totalLength
    - reason (if provided)

- **Actions (safe)**
  - Rebuild Card Library projection (`persistence:rebuild-card-library-index`)

---

## 8) Data Contract

### Snapshot shape (proposed)

A stable TS type for UI rendering:

- `time`
- `system`: `{ platform, versions?, storageDir?, userDataPath? }`
- `hypercore`: `{ cardLibraryLogLength? }`
- `sqlite`: `{ cardCount?, dbSizeBytes?, projectionVersion?, lastUpdated? }`
- `paging`: `{ source?, hasMore?, nextCursor?, totalLength?, reason? }`
- `ui?`: optional `window.__HAPA_DEBUG_STATE__` summary if present

---

## 9) Implementation Plan (phased)

### Phase 0 — Read-only panel

- Add `src/pages/OperatorRealityPanel.tsx`.
- Add route + nav item.
- Gather data using existing `window.electronAPI` calls.

### Phase 1 — Debug packet export

- Provide “Copy JSON” and “Download JSON”.

### Phase 2 — Safe controls

- Add rebuild projection button with progress indicator.

### Phase 3 — Mac Nexus integration hooks

- Show Mac online/offline and queue counts once the LAN contract stabilizes.

---

## 10) Risks / Critique (self-review)

### Critique 1 — Scope creep

This can balloon into a full admin console.

**Response:** Keep Phase 0 minimal (read-only truth snapshot), then iterate.

### Critique 2 — Polling can cause performance noise

A tight interval could stress IPC/persistence.

**Response:** Default to manual refresh + optional low-frequency polling (e.g. 5–10s) with a toggle.

### Critique 3 — Data exposure

We must not leak secrets into a “copy JSON” button.

**Response:** Explicitly omit API keys/tokens. Only include counts, paths, modes.

### Critique 6 — Misleading counts (log length vs visible cards)

If the panel shows a single “card count” without labeling it, it can recreate the same confusion we’re trying to remove.

**Response:** Always show:
- Hypercore `card-library` **log length** (append-only blocks)
- SQLite **projected card count** (not deleted)
- Nexus paging `totalLength` (what the paging API believes)
- Optional UI `filteredCardsLength` (what the user is actually seeing)

### Critique 4 — Hot-file collisions

Adding new IPC endpoints risks touching hot files.

**Response:** Phase 0 uses existing IPC surfaces only. If new data is needed, propose it in Comms first.

### Critique 5 — UX duplication (Profile page already has stats)

This could overlap with Profile.

**Response:** Treat Profile as “identity + personal stats” and Operator as “system truth + controls.” If overlap grows, merge later.

---

## 11) Open Questions

- Should this be a dedicated route or embedded in Profile?
- What is the minimal snapshot schema we can commit to long-term?
- Do we want a single “Export debug packet” that includes:
  - snapshot JSON
  - recent IPC logs
  - persistence stats

---

## 12) Comms Protocol (before implementation)

Before touching hot files (or anything that may collide), we will:
- add a `## Claim` section to `docs/.mind/Comms/NOTES_2025-12-25_CASCADE.md`
- list exact files to touch
- timebox the change
- add verification steps
