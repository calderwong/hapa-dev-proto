# Multi-Agent Collaboration Protocol — Hapa Open Tasks Node

This repo may be worked on by multiple AI agents (and humans) at the same time. This protocol prevents collisions, reduces regressions, and keeps work discoverable.

## Core rules

- **Integrity first**
  - If the task truth tape is wrong, auth is unsafe, or the UI lies about state: stop and fix before building features.
- **UI + API + CLI ship together**
  - New behavior must land across all three surfaces (or be explicitly marked as `UI-only` / `CLI-only`).
- **Self-test is the arbiter**
  - If you change behavior, update the self-test to cover it.
- **Prefer additive changes**
  - Create new modules/functions instead of rewriting shared ones when possible.
- **Leave trails**
  - Every agent session should leave a note in `.mind/Comms/`.

## Hot files (treat as lockable)

If you need to edit any of these, claim them first:

- `src/server.js`
- `src/projector.js`
- `src/db.js`
- `src/cli.js`
- `src/config.js`
- `src/auth.js`
- `web/index.html`
- `test/self_test.test.js`

## Naming conventions (for Comms files)

- Notes: `NOTES_YYYY-MM-DD_<AGENT>.md`
- Priorities: `PRIORITIES_YYYY-MM-DD_<AGENT>.md`

## Claim protocol (lightweight “lock”)

To avoid collisions without a shared lock server:

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

From repo root:

- Start:
  - `npm start` (foreground)
  - `./hapa-open-tasks start --daemon` (daemon)
- Validate:
  - `npm test`

## Reference protocol

Cross-agent handoffs (Overwatch pass):

- `/Users/calderwong/Desktop/.Overwatch/ecosystem/TASK_INBOX.md`

Blueprint + check-ins:

- `/Users/calderwong/Desktop/.Overwatch/CHECK_IN_2026-01-03_OPEN_TASKS_NODE_PROTO.md`
- `/Users/calderwong/Desktop/.Overwatch/CHECK_IN_2026-01-03_OPEN_TASKS_NODE_IMPLEMENTED.md`
