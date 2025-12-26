# Multi-Agent Collaboration Protocol

This repo is often worked on by multiple AI agents (and sometimes humans) at the same time. This protocol is meant to prevent edit conflicts, reduce regressions, and make work discoverable.

## Core rules

- **Integrity first**
  - If the app crashes, data is corrupt, or the Card Library truth is wrong: stop and fix before building features.
- **One file, one agent at a time (for hot files)**
  - Treat these as high-collision targets:
    - `electron/main.ts`
    - `electron/p2p.ts`
    - `electron/persistence.ts`
    - `electron/SqliteAdapter.ts`
    - `src/pages/CardLibrary.tsx`
    - `src/components/cards/VirtualCardGrid.tsx`
- **Prefer additive changes**
  - When possible, create new modules instead of rewriting shared ones.
- **Leave trails**
  - Every agent session should leave a note in `docs/.mind/Comms/`.

## Naming conventions (for Comms files)

- Notes: `NOTES_YYYY-MM-DD_<AGENT>.md`
- Priorities: `PRIORITIES_YYYY-MM-DD_<AGENT>.md`

## Claim protocol (lightweight “lock”)

To avoid collisions without editing a shared “CLAIMS.md”:

1. **Before touching hot files**, create/update your own `NOTES_..._<AGENT>.md` and add a top section:

   - `## Claim`
   - What you intend to change
   - Exact file list
   - Expected duration / timebox

2. Other agents must treat an active claim as a lock and either:

   - Work elsewhere, or
   - Ask for a handoff in that agent’s notes file.

3. When done, update your notes file:

   - Mark the claim as `Released`
   - Add a short changelog + how to verify

Optional convenience index:

- If helpful, also update `ACTIVE_CLAIMS.md` (edit only your agent section; do not reorder sections).

## Commit / change hygiene

- **Small, topic-isolated commits**
  - Avoid mixing unrelated fixes.
- **Verification**
  - If you touched UI/paging/persistence, run:
    - `npm run typecheck`
    - `npm test`
  - Capture what you ran in your notes.
- **Do not touch meta-logs unless asked**
  - Do not modify `APPLES/` reward logs unless explicitly instructed.

## Handoff template

Copy/paste into your `NOTES_...` file:

```markdown
## Session Status (YYYY-MM-DD HH:MM)
- Working on:
- Claim:
- Changes made:
- Verification:
- Risks / regressions to watch:
- Next steps:
- Files touched:
```

## Conflict resolution

- If two agents edited the same hot file:
  - The agent who notices first posts a note in their `NOTES_...` file describing the conflict.
  - Prefer reverting to the last known-good state and re-applying changes in smaller chunks.
  - If a decision is subjective, defer to the user’s direction and the “Integrity > Flow > Form > Decoration” priority ordering.
