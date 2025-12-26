# Plan (Cascade) — Research → Design → Development → Implementation — 2025-12-25

This is a living plan derived from:
- `docs/.mind/Comms/PRIORITIES_2025-12-25_CASCADE.md`
- Blue-aligned invariants (Truth hierarchy + TLC + “Cultivate, validate, commit”)

It’s written to be executable by multiple agents with minimal collisions.

## How to use this plan (multi-agent safe)

- **Before touching hot files**, write a `## Claim` in your own `NOTES_...` file and optionally update `ACTIVE_CLAIMS.md`.
- Prefer **additive modules** + small glue edits in hot files.
- Each step below includes:
  - Research
  - Design
  - Dev
  - Verify
  - Artifacts (what to leave behind)

## Invariants / non-negotiables (Blue-aligned)

- **Truth hierarchy**
  - Hypercore/P2P = network truth.
  - SQLite = local query truth (fast), but must be treated as *partial* until it is caught up.
  - The UI must never “lie” by implying completeness or `hasMore: false` when more exists.
- **TLC gating**
  - Love: safety + user trust + non-corrupt experience.
  - Truth: provenance, counts, checkpoints, explicit states.
  - Conviction: small commits, verified, leave trails.
- **Cultivation discipline**
  - Signal → Artifact → Validation → Reward → Capability → Better Signal.

## Current target: Top priorities sequence

1. **Efficiency P0** (observability + debug packet + truth-source clarity)
2. **Performance P0/P1** (make the common paging path fast/stable)
3. **Features P0** (control surfaces that operationalize the above)

---

# Phase 0 — Reality refresh (research baseline)

## 0.1 Research

- Re-read key docs (quick pass):
  - `docs/Hypercore_Storage_and_DB_Reference.md`
  - `docs/Local_Node_Persistence_Governor_Refactor.md`
  - recent `dev_journal.md` entries about Card Library paging + “120 cards”
- Map the *current* Card Library data-flow:
  - Renderer page(s) → preload API → IPC handler(s) → persistence layer → SQLite + Hypercore

## 0.2 Design

- Define a single canonical diagram:
  - “Card Library Query Path (SQLite) + Fallback Path (Hypercore)”
  - Include gating criteria (what “caught up” means)

## 0.3 Dev

- No code changes. This is docs-only.

## 0.4 Verify

- Confirm the diagram matches actual code (grep references, file names, IPC channel names).

## 0.5 Artifacts

- Add a short section to your `NOTES_...` file:
  - what you learned
  - which files are authoritative
  - any mismatches between docs vs reality

---

# Phase 1 — Efficiency (make progress cheap)

## Goal

Make it easy (for humans and agents) to answer:
- “What does the system believe right now?”
- “Which truth source is active (SQLite vs Hypercore), and why?”
- “If someone reports missing cards, what debug packet do we request?”

## 1.1 Efficiency P0 — Diagnostics snapshot (“what does the system believe?”)

### Research

- Locate existing places where these values are already computed:
  - storage root path
  - Hypercore `card-library` length
  - SQLite card rows count
  - reconcile/index checkpoints (e.g. `card_library_index_last_seq` or similar)
  - any existing IPC endpoints for rebuild/reconcile

### Design

- Define a single diagnostics shape (TypeScript type) returned by the backend.
  - Must include:
    - storage root
    - hypercore index length
    - sqlite row count
    - last processed seq/checkpoint
    - whether projection is “caught up”
    - paging mode selected + reason (explicit string)
- Decide where to expose it:
  - **P0**: IPC endpoint returning JSON snapshot
  - **P1**: UI surface to display it

### Development

- Backend:
  - Add a small diagnostics module (new file) that gathers counts and checkpoint state.
  - Add an IPC handler that returns the diagnostics snapshot.
- Frontend:
  - Expose the IPC via preload + types.

### Verify

- Manual: trigger diagnostics and confirm numbers look reasonable.
- Regression: ensure the new endpoint doesn’t slow boot or spam logs.

### Artifacts

- Add a short note:
  - “How to collect a diagnostics snapshot”
  - “How to interpret ‘caught up’”

## 1.2 Efficiency P0 — Standard “Debug Packet” template

### Research

- Identify what’s historically been missing when debugging paging:
  - incorrect cursor math
  - partial SQLite projection presented as complete
  - storage root switches
  - UI `requestMore` locks

### Design

- Define a single markdown template that any bug report should include:
  - repro steps
  - expected vs actual
  - diagnostics snapshot
  - last 50 relevant logs (IPC + persistence)
  - screenshots (top/bottom of Card Library scroll)

### Development

- Add template to Comms (or docs) as a standalone file.
  - Keep it short enough to copy/paste.

### Verify

- Use it once on a real report or a simulated report and ensure it’s sufficient.

### Artifacts

- Template file + mention it in Comms.

## 1.3 Efficiency P1 — Boundary normalization plan

### Research

- Identify all record shapes involved in Card Library results.
  - Find where `id`/`cardId` differences originate.

### Design

- One canonical “CardIndexItem” shape for renderer.
  - Normalize at the boundary (backend → IPC), not in every UI component.

### Development

- Add normalization in one place.
- Add a tiny unit test for normalization.

### Verify

- Typecheck passes.
- No UI regressions.

### Artifacts

- A short “schema contract” note.

---

# Phase 2 — Performance (fast + stable)

## Goal

Ensure the common Card Library path is:
- stable under reload
- stable during reconcile/rebuild
- performant with large libraries

## 2.1 Performance P0 — Robust paging semantics (no false caps)

### Research

- Re-audit the paging code paths and their stop conditions.
- Identify “cap vectors”:
  - `hasMore` false when more exists
  - cursor overshoot
  - sqlite returns fewer than `limit` due to incomplete projection

### Design

- Formalize the paging contract:
  - `items`
  - `nextCursor`
  - `hasMore`
  - `source` (SQLite/Hypercore)
  - `reason`
- Define the “continue paging” rule:
  - if a full page is returned, assume more likely exists unless explicitly proven otherwise

### Development

- Harden the backend handler(s) and renderer caller(s) to obey the contract.
- Add logs guarded by a debug flag.

### Verify

- Manual scroll to completion
- Reload mid-reconcile and confirm it still pages

### Artifacts

- Contract doc section + test coverage note

## 2.2 Performance P1 — UI virtualization and memory budget

### Research

- Confirm what virtualization strategy is used and whether it’s actually limiting DOM.
- Identify hotspots:
  - image decode
  - layout thrash
  - re-render storms

### Design

- Define budgets:
  - max cards in DOM
  - max in-memory images
  - target scroll FPS

### Development

- Make small, measurable improvements.

### Verify

- Use devtools performance profiling and document results.

### Artifacts

- A “Perf notes” section: before/after metrics.

---

# Phase 3 — Features (after efficiency + performance)

## Goal

Add user-facing control surfaces that reduce confusion and make recovery deterministic.

## 3.1 Features P0 — Diagnostics UI surface

### Research

- Find best existing location in UI to show:
  - paging mode
  - counts
  - checkpoint progress

### Design

- Minimal UI:
  - a collapsible panel in Card Library or Settings
  - includes “Copy diagnostics” and “Rebuild projection” actions

### Development

- Implement UI + wiring.

### Verify

- Confirm it’s invisible/harmless for normal users, valuable for debugging.

### Artifacts

- A screenshot + usage note.

## 3.2 Features P0 — Guided rebuild/reconcile

### Research

- Ensure rebuild endpoint is safe, idempotent, and observable.

### Design

- UX steps:
  - explain what rebuild does
  - show progress
  - reload library on completion

### Development

- Add progress events or polling.

### Verify

- Run rebuild on a known-large library.

### Artifacts

- A “Recovery runbook” doc.

---

# Execution protocol (how we’ll proceed from here)

1. **Pick the next smallest high-leverage step** (Efficiency P0: diagnostics snapshot).
2. Write a **Claim** in `NOTES_..._CASCADE.md` with:
   - file list
   - timebox
   - verify steps
3. Implement with small commits.
4. Update claim as Released + leave a short handoff note.

---

# Open Questions (need confirmation / reality check)

- Where should the diagnostics UI live (Card Library page vs Settings vs a developer-only panel)?
- Do you want a “doctor” CLI script (`npm run doctor`) in addition to UI + IPC?
- Should diagnostics ever be persisted (e.g. last-known snapshot) or always live?
