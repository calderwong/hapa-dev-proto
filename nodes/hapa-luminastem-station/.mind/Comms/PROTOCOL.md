# Multi-Agent Collaboration Protocol — Hapa LuminaStem Station

This repo may be worked on by multiple AI agents (and humans) at the same time. This protocol prevents collisions, reduces regressions, and keeps work discoverable.

## Core rules

- **Integrity first**
  - If the app leaks secrets, breaks ingest/export integrity, or the session truth tape is wrong: stop and fix before building features.
- **One file, one agent at a time (for hot files)**
  - Treat these as high-collision targets.
- **Prefer additive changes**
  - When possible, create new modules instead of rewriting shared ones.
- **Leave trails**
  - Every agent session should leave a note in `.mind/Comms/`.

## Hot files (treat as lockable)

If you need to edit any of these, claim them first:

- `luminastem-3d/App.tsx`
- `luminastem-3d/services/sessionService.ts`
- `luminastem-3d/services/geminiService.ts`
- `luminastem-3d/vite.config.ts`
- `luminastem-3d/package.json`
- `hapa_luminastem_node/server.py`
- `hapa_luminastem_node/config.py`
- `requirements.txt`

## Naming conventions (for Comms files)

- Notes: `NOTES_YYYY-MM-DD_<AGENT>.md`
- Priorities: `PRIORITIES_YYYY-MM-DD_<AGENT>.md`

## Claim protocol (lightweight “lock”)

To avoid collisions without a shared claims file:

1. **Before touching hot files**, create/update your own `NOTES_..._<AGENT>.md` and add a top section:

- `## Claim`
- What you intend to change
- Exact file list
- Expected duration / timebox

2. Other agents must treat an active claim as a lock and either:

- Work elsewhere, or
- Request a handoff by appending a short request to the claimant’s `NOTES_...` file.

3. When done, update your notes file:

- Mark the claim as `Released`
- Add a short changelog
- Add verification steps + observed results

## Verification discipline (minimum)

Capture what you ran in your notes.

Backend (repo root):

- `python3 -m hapa_luminastem_node`
- Probe:
  - `GET /health` (public)
  - `GET /capabilities` (auth)

Frontend (from `luminastem-3d/`):

- `npm install`
- `npm run dev`

## Handoff template

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

## Reference protocol

Aligned with the ecosystem snapshot:

- `/Users/calderwong/Desktop/.Overwatch/reference/HAPA_AG_COMMS_PROTOCOL.md`

Cross-agent handoffs (Overwatch pass):

- `/Users/calderwong/Desktop/.Overwatch/ecosystem/TASK_INBOX.md`
