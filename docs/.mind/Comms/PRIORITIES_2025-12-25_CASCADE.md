# Priorities (Cascade) — Efficiency → Performance → Features (Living) — 2025-12-25

This is my working priorities/backlog doc for this repo. It’s intentionally verbose and meant to evolve as we learn (and as other agents contribute ideas).

Ordering (requested):
1. Efficiency (make progress cheap + safe)
2. Performance (make the system fast + stable under real data)
3. New features (only after 1+2 reduce regression risk)

## Blue-aligned constraints (how we keep ourselves honest)

- Truth hierarchy, not vibes
  - Hypercore/P2P is network truth.
  - SQLite is local query truth (fast), but must never masquerade as complete truth when partial.
  - UI must not lie: avoid false `hasMore: false`, hard caps (e.g. “120 cards”), or hidden storage-root switches.
- Cultivation discipline (“Infinite Sharpening”)
  - Signal → Artifact → Validation → Reward → Capability → Better Signal.
  - Every meaningful fix should leave behind:
    - a reproducible story
    - a guardrail (test/log/check)
    - a short note so others don’t re-derive it
- Bruce Lee compression as engineering style
  - Absorb what is useful (keep the working pieces).
  - Reject what is useless (delete dead paths, unclear heuristics).
  - Add what is uniquely ours (small, explicit invariants + tooling).

## Scorecard (what “good” looks like)

- Card Library can page to completion with no “caps” (even during rebuild/reconcile).
- It’s always obvious which truth source is being used (SQLite vs Hypercore) and why.
- Rebuild/reconcile is observable: progress + completion criteria.
- A bug report can be turned into a failing repro (test or script) in under 15 minutes.

## 1) Efficiency (make progress cheap)

### P0 — Reduce ambiguity / speed up debugging

- Create a single, low-friction way to answer: “what does the system believe right now?”
  - Card Library index length (Hypercore)
  - SQLite row count + last indexed seq checkpoint
  - storage root path currently in use
  - paging mode (SQLite vs Hypercore fallback) + the gating condition
- Standardize a “debug packet” for any report
  - repro steps
  - expected vs actual
  - counts snapshot (above)
  - relevant logs (IPC + persistence)
- Keep hot-file collisions rare
  - favor additive modules over editing `electron/main.ts`
  - isolate paging logic into utilities/hooks so UI changes don’t re-break cursors
- Treat docs as compounding efficiency
  - every subtle fix gets a short “why it broke / how we detect / how to verify” note

### P1 — Reduce cognitive load / future-proof boundaries

- Normalize at the boundary
  - unify record shapes as they cross persistence → IPC → renderer
  - remove schema drift (`id` vs `cardId`, missing `type`, etc.) at the source
- Build a repeatable “rebuild/reconcile” story
  - clear manual controls + progress + completion criteria
  - avoid “magic background” behavior that wedges users at partial truth
- Tests that target recurring regressions
  - paging cursor math
  - `hasMore` semantics
  - projection completeness gating

### P2 — Multi-agent throughput improvements

- Planning artifacts for risky changes
  - small checklist: what, why, verify
  - link from your `NOTES_...` claim to the plan artifact
- Scriptable health checks (idea)
  - `npm run doctor` style: index length, sqlite counts, checkpoints, storage root, mode

## 2) Performance (fast + stable)

### P0 — Prevent performance bugs that look like data loss

- Paging must be robust under reloads, partial indexes, and catch-up windows.
- SQLite must never hard-cap views when projection is incomplete (deterministic fallback).

### P1 — Make the common path fast

- Query/index optimization for the Card Library path.
- Renderer memory discipline (virtualization must do real work).
- Asset strategy (thumbnail/cache) to keep scroll smooth.

### P2 — Budgets + background work

- Background ingestion with bounded work per tick (no UI freezes).
- Explicit targets: boot time, scroll FPS, memory footprint.

## 3) New Features (after efficiency + performance)

### P0 — Control surfaces (features that help operate the system)

- Status panel: index length, sqlite row count, checkpoint, paging mode.
- One-click rebuild projection with progress (and “what it will do” confirmation).
- Export diagnostics bundle for bug reports.

### P1 — User-facing features that build on a stable core

- Better search/filtering in Card Library.
- Card Sets UX improvements.

### P2 — Bigger bets

- Platform portability (e.g. Tauri) once paging/storage semantics are well specified and tested.

## Idea Inbox (append-only)

To avoid conflicts:
- Add `Idea:` lines to your own `NOTES_...` file.
- Include: area (Efficiency/Performance/Feature), why, scope, risks/deps.
- I’ll fold it in here with attribution.

Template:
- `YYYY-MM-DD — Idea: <...> — Area: <...> — Owner: <...> — Risk: <...>`

## Archive — Original priority ordering snapshot (Integrity > Flow > Form > Observability)

### P0 — Integrity (must be stable)

- Ensure the Card Library cannot “lie” about availability/counts.
  - No hard cap regressions (e.g. “stuck at 120”).
  - Paging must continue as long as more index entries exist.
- Ensure the persistence governor model is coherent:
  - SQLite can be the fast local truth, but must not become a partial-truth trap.
  - Fallback to Hypercore must be deterministic and safe while SQLite is catching up.
- Ensure storage directory selection is explicit and observable.
  - Avoid silently switching storage roots and “hiding” cards.

## P1 — Flow (system must move)

- Keep boot-time reconcile from blocking the UI.
  - Chunked projection, yielding between batches.
- Preserve scroll/interaction correctness.
  - Global wheel handlers must never hijack page scrolling.

## P2 — Form (reduce future breakage)

- Unify card/index record shapes.
  - Reduce schema drift (`cardId` vs `id`, missing `type`, etc.).
  - Strengthen normalizers at the persistence boundary.
- Continue incremental “monolith breaker” work.
  - Prefer extracting IPC handlers/services out of `electron/main.ts` into smaller modules.
  - Prefer extracting Card Library paging logic into hooks/utilities to reduce churn.

## P3 — Observability (make bugs cheap)

- Keep/expand low-risk debug instrumentation for:
  - current index length
  - SQLite row count
  - last processed seq checkpoints
  - paging cursors and hasMore decisions

## Suggested division-of-labor (to avoid collisions)

- One agent owns “persistence + paging” at a time (`electron/main.ts`, sqlite adapter, index rebuild logic).
- Another agent can safely work in parallel on:
  - type unification work in `src/types/`
  - tests for normalizers/projection logic
  - documentation updates
