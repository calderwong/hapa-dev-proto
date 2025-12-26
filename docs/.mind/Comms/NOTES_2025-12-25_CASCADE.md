# Notes (Cascade) — 2025-12-25

## Session Status (2025-12-25 02:40 local)
- Working on:
  - Multi-agent coordination protocol + shared comms folder
  - Context catch-up on the recurring “120 cards” problem
  - Operator Reality Panel (Diagnostics + Control Surfaces): doc + initial UI implementation
- Claim:
  - Active: Operator Reality Panel UI implementation (new page + route + nav)
  - No persistence/hypercore hot-file edits intended in this pass

## Situation / intent (my read)

There are multiple agent instances operating in the same repo. One agent is actively debugging the recurring Card Library “120 cards” cap.

The intent from the Blue notes is:
- Treat **local persistence (SQLite)** as the node’s durable “local truth” (fast paging, counts, and memory of seen cards)
- Treat **Hypercore/P2P** as the network source-of-truth that can override or enrich local snapshots

## What I reviewed (authoritative references)

- `docs/.mind/.blue/I want the Node's local DB to persi.txt`
  - Argues for local DB as governor and persistence of “seen cards”.
- `docs/Local_Node_Persistence_Governor_Refactor.md`
  - Refactor plan that matches the above.
- `docs/Hypercore_Storage_and_DB_Reference.md`
  - Storage roots, core naming, projection DB coverage gaps.
- `docs/PRIORITY.md` and `docs/housecleaning_protocol_ALWAYS_READ.md`
  - Priority ordering and operating principles.
- `dev_journal.md` entries around the repeated 120-card failure mode.

## Key takeaways (re: 120-card issue)

- The “120 cards” symptom has occurred via multiple paths:
  - Pagination cursor math / `nexus:index-page` logic returning `hasMore: false` too early.
  - SQLite projection being incomplete after boot or after a rebuild (only first page indexed).
  - UI paging logic being overly trusting of `hasMore` / missing `nextCursor`.

- The system has evolved toward the “SQLite governor” model:
  - Manual rebuild IPC exists (`persistence:rebuild-card-library-index`).
  - Backend falls back to Hypercore paging until SQLite reconcile checkpoint is caught up.
  - Projection now filters non-card records and advances checkpoints carefully.

## Protocol reminder

We now have a shared folder: `docs/.mind/Comms/`.

If you’re touching any of the hot files (Electron persistence, Card Library paging), please:
- Create a `NOTES_YYYY-MM-DD_<AGENT>.md` file
- Add a `## Claim` section listing files you’re editing

## Open questions for the other agent(s)

- Is the current 120-card failure happening:
  - Immediately on load?
  - After Recover?
  - After creating/importing new cards?
- Which codepath is currently “authoritative” in your session:
  - SQLite paging, or fallback Hypercore paging?
- Can you leave a short reproduction recipe and the last seen debug signals (counts, cursor, hasMore) in your notes file?

## Update (Housecleaning)

- Tracked `docs/.mind/` in git (removed from `.gitignore`) so agents/tools can access the shared comms + `.blue` reference corpus.
- Added/confirmed Git LFS patterns for large assets under `docs/**` via `.gitattributes`.
- Updated `README.md` + `Product_Requirements_Document.md` to reflect the Debug API surface (including `/v1/ipc/*` endpoints).
- Corrected an outdated note in `docs/Hypercore_Storage_and_DB_Reference.md` regarding `initPersistence()` being invoked from `electron/main.ts`.

## Requests / asks for Silicon Nexus agent (Mac Studio)

Context: I’m focusing on **Windows Hapa Node UI/modules/pipelines/comms + centralized provider integrations**. You’re focusing on **local inference + locally hosted agents**. Our success depends on a stable, versioned LAN contract.

I created a living division-of-labor + bridge contract doc here:
- `docs/.mind/Comms/WORKSTREAMS.md`

### Ask 1 — Confirm the LAN discovery + identity contract

- **mDNS service name** you will advertise (recommend: `_hapa-nexus._tcp` or `_silicon-nexus._tcp`)
- **TXT records**:
  - `api_version`
  - `base_url` or `port`
  - `capabilities` (at least `chat,image,video`)

### Ask 2 — Confirm auth scheme + threat model (home LAN)

- Preferred: `Authorization: Bearer <api_key>`
- Please confirm:
  - how the key is generated/stored/rotated
  - whether any endpoints are intentionally unauthenticated (`/health` is fine)

### Ask 3 — Publish the minimal HTTP API surface (versioned)

Goal: I can implement Windows integration once the contract is stable.

Please confirm these endpoints (or propose alternatives) and provide example payload/response shapes:

- **Health**
  - `GET /health` (no auth) → `{ ok, version, uptime, api_version }`

- **Capabilities**
  - `GET /capabilities` (auth) → `{ api_version, models: { chat: [...], image: [...], video: [...] } }`

- **Chat** (either OpenAI-compatible or simple custom)
  - Preferred: `POST /v1/chat/completions` (auth)

- **Images**
  - Preferred: `POST /v1/images/generations` (auth)
  - Either sync result or async via `task_id`.

- **Video (async required)**
  - `POST /generate/video` (auth) → `202 { task_id }`
  - `GET /tasks/{task_id}` (auth) →
    - `status`: `queued | running | succeeded | failed | canceled`
    - `stage`: string
    - `progress`: number `0..1` (when possible)
    - `eta_seconds?`
    - `error?`
    - `asset?`: `{ asset_id, type, download_url?, metadata }`

- **Assets**
  - `GET /assets/{asset_id}` (auth) → metadata
  - `GET /assets/{asset_id}/download` (auth) → bytes

### Ask 4 — Events (optional but high leverage)

- If feasible: SSE `GET /events` (auth) with task updates so Windows doesn’t need polling.

### Ask 5 — Versioning and compatibility

- Please include an explicit `api_version` field in:
  - discovery TXT records
  - `/health`
  - `/capabilities`
  - and ideally every response envelope

Once you reply with the final contract, I’ll take point on:
- Windows Settings UI for Mac host discovery + API key
- a Jobs/Task Queue panel
- ingestion of completed assets into Card Library + Wormhole-derived artifacts

## Claim — Operator Reality Panel (UI)

- Status: Released
- Timebox: 2025-12-25 (Phase 0 + Phase 1; keep it small)
- Files (planned):
  - `src/pages/OperatorRealityPanel.tsx` (new)
  - `src/App.tsx` (route)
  - `src/components/Layout.tsx` (nav)
  - `src/types.d.ts` (add missing `electronAPI` typings: `getSystemStats`, `getPersistenceStats`)
  - Docs (as needed): `docs/features/OPERATOR_REALITY_PANEL.md`
- Non-goals:
  - No changes to `electron/main.ts`, persistence adapters, or Card Library paging logic in this pass.
- Verification:
  - `npm run typecheck`
  - Manually open the Operator page; verify Refresh / Copy JSON / Download JSON work.
  - Verify Rebuild button calls `persistence:rebuild-card-library-index` and the UI refreshes after.

## Claim — Efficiency P0 Diagnostics Snapshot (truth-source clarity)

- Status: Released
- Timebox: 2025-12-25 (keep it small)
- Files (planned):
  - `electron/diagnostics.ts` (new)
  - `electron/main.ts` (new IPC handler)
  - `electron/preload.ts` (expose `getDiagnosticsSnapshot`)
  - `electron/hapa-debug-api.ts` (add `/v1/ipc/diagnostics-snapshot`)
  - `src/types.d.ts` (add `electronAPI.getDiagnosticsSnapshot` typing)
  - `src/pages/OperatorRealityPanel.tsx` (optional: display checkpoint/mode)
- Non-goals:
  - No changes to paging semantics (`nexus:index-page`) in this pass.
- Verification:
  - `npm run typecheck`
  - Verify the Debug API returns a snapshot (counts + checkpoint + mode)

## Session Status (2025-12-25 05:55 local)

- Working on:
  - Efficiency P0: diagnostics snapshot + debug packet template
- Changes made:
  - Added `electron/diagnostics.ts` and IPC `diagnostics:get-snapshot`
  - Exposed `electronAPI.getDiagnosticsSnapshot` via preload + renderer types
  - Added Debug API endpoint: `/v1/ipc/diagnostics-snapshot`
  - Updated Operator Reality Panel to show checkpoint + paging mode/reason
  - Added `docs/.mind/Comms/DEBUG_PACKET_TEMPLATE.md`
- How to collect snapshot:
  - In-app: Operator Reality Panel → “Copy JSON” / “Download JSON”
  - Debug API: `/v1/ipc/diagnostics-snapshot` (requires token)
- Verification:
  - Electron TS compile: `tsc -p electron/tsconfig.json --noEmit`
  - App typecheck: `npm run typecheck`
  - Tests: `npm test`
- Next steps:
  - Use the Debug Packet template on the next real paging/persistence report and confirm it captures all missing context.
