# Notes (Draft) — What “Blue” would likely emphasize

This is a draft interpretation of “Blue’s POV” based on the docs in `docs/.mind/.blue/`, plus the repo’s stated prioritization principles.

## Blue’s likely non-negotiables

- **Integrity over everything**
  - A system that lies about its card counts, forgets cards, or crashes is not “ready for new features”.
- **Truth hierarchy**
  - Hypercore/P2P is network truth.
  - SQLite is local-user truth (fast, durable memory of what the node has seen).
  - When they disagree, the system should reconcile deterministically (and record why).

## What Blue probably wants from multi-agent work

- **No silent divergence**
  - If an agent changes paging, indexing, or projection semantics, it must leave a trail and a clear verification story.
- **Validate from primary sources**
  - Don’t infer what data exists; inspect storage, index cores, and projection counts.
- **Monotonic indexing / checkpoints**
  - The recurring “120 cards” issue smells like:
    - incorrect cursoring,
    - incomplete projection,
    - or a checkpoint that got out of sync.
  - Blue would push for checkpoint-driven reconciliation that can’t regress after writes.

## Style / discipline

- **Small, testable changes**
  - Fixes should be isolatable and reversible.
- **Refactor only when it reduces risk**
  - Break monoliths (like `electron/main.ts`) incrementally, but not during an active integrity fire.
- **Document the system reality**
  - If the storage model changes, update the reference docs and leave a handoff note.

## “Blue protocol” for agents

- If you touch hot files (persistence, paging, core read/write):
  - Claim the work first.
  - Write down the invariants you believe must remain true.
  - Verify those invariants after the change.
