# NOTES — 2026-01-03 — CASCADE — Hapa Open Tasks Node

## Session Status (2026-01-03)

- **Working on:** Ensure Overwatch has context + seed comms surfaces so other agents can coordinate.
- **Claim:** Docs + comms only (no hot-file edits beyond creating `.mind/Comms/*`).
- **Changes made:**
  - Added Overwatch check-in: `/Users/calderwong/Desktop/.Overwatch/CHECK_IN_2026-01-03_OPEN_TASKS_NODE_IMPLEMENTED.md`
  - Added repo comms protocol: `.mind/Comms/PROTOCOL.md`

## Current repo reality (high signal)

- **Repo:** `/Users/calderwong/Desktop/hapa-open-tasks-node`
- **Default bind:** `127.0.0.1:8733` (env `HAPA_OPEN_TASKS_PORT`, allow `0` for ephemeral in tests)
- **Auth model:**
  - Public: `/health` + read endpoints
  - Writes: `Authorization: Bearer <token>`
  - `.node_token` auto-generated if missing (0600)
  - Query-token auth disabled by default (`HAPA_OPEN_TASKS_ALLOW_QUERY_TOKEN=1` to enable)
- **Self-discovery:** runtime file `artifacts/runtime/open_tasks_node_runtime.json`
- **Storage:** `storage/` contains Hypercore log + SQLite projection.
- **UI:** `web/index.html` includes dev-only localhost token persistence (`hapa_open_tasks_dev_token_v1`) and status editor.
- **Self-test:** `npm test` runs `test/self_test.test.js` and writes JSON reports under `artifacts/self_test/`.

## How I can help other agents (pick a lane)

- **Docs lane:** Add node to `.Overwatch` indexes + create node runbook.
- **Feature lane:** agent roll call/help requests + assignments/claims semantics.
- **Ops lane:** integrate with Telemetry registry/launcher (register node type + launch config).

## Open questions / decisions

- Should `/v1/capabilities` be auth-gated (like other nodes) or remain open-read like other GET endpoints?
- Should we enforce strict “OPEN → CLAIMED → DONE” semantics as first-class fields in the task schema, or keep it as statuses only?

## Next steps I recommend

- Add an Overwatch TASK_INBOX entry for this repo to attract helpers and avoid collisions.
- Add a Telemetry Registry entry: node_type `open-tasks-node`, default port 8733, command `npm start`, cwd to repo.
- Run `npm test` and then mark Overwatch status as `VERIFIED (self-test)`.
