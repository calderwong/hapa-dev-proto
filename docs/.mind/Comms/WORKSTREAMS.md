# Workstreams + Division of Labor (Living)

## Purpose

This document exists to:
- prevent multi-agent collisions
- keep long-running architectural work coherent
- make it easy to ask for help (and respond to help requests)

It is **living**. Prefer additive edits and append-only “Update log” entries.

---

## Non-negotiable invariants (shared)

- **Truth hierarchy**
  - **Hypercore/P2P** is *network truth*.
  - **SQLite** is *local query truth* (fast + durable), but must never masquerade as complete truth when partial.
  - UI must not lie (no false caps, no hidden storage-root switches).
- **Cultivation discipline**
  - Every meaningful fix should leave: repro story, verification, and a short note.
- **Hot-file etiquette**
  - See `docs/.mind/Comms/PROTOCOL.md`.

---

## Division of labor (high level)

### Cascade workstream (Windows Hapa Node)

Primary focus areas:
- **UI/UX surfaces**
  - Card Library, Wiki, Wormhole, Nexus, Settings, Status/Diagnostics
  - control surfaces for system operation (status, rebuild, export debug packet)
- **App modularity**
  - extract monolith logic into smaller modules/hooks
  - improve boundaries between persistence → IPC → renderer
- **Pipelines (non-model)**
  - ingestion flows, indexing/rebuild flows, UI progress surfaces
  - asset ingest → card creation → derived artifacts wiring
- **Comms / coordination**
  - write trails to `docs/.mind/Comms/`
  - requests, handoffs, and reproducibility recipes
- **Centralized provider integrations**
  - Gemini / Vertex / OpenAI / AIMLAPI / etc.
  - provider boundary normalization + safe retries + observability

### Silicon Nexus workstream (Mac Studio)

Primary focus areas:
- **Local inference + local agents**
  - MLX-based LLM residency
  - Diffusers-based media pipelines
  - local agent orchestration
- **Mac-side server architecture**
  - gateway/orchestrator
  - memory budgeting and model lifecycle
  - media asset management (SQLite) on the Mac

---

## Shared interface contract (where the two meet)

The success criterion for collaboration is a stable, versioned “bridge” between:
- Windows Hapa Node (Electron main process)
- Mac Silicon Nexus server (HTTP+JSON over LAN)

Minimum recommended contract:
- **Discovery**: mDNS service + TXT records (`api_version`, `base_url`, `capabilities`)
- **Auth**: API key / bearer token
- **Health**: `/health`
- **Capabilities**: `/capabilities` (models + modalities)
- **Async jobs**:
  - `POST /generate/video` → `202 { task_id }`
  - `GET /tasks/{task_id}` → `{ status, stage, progress, eta_seconds?, asset? }`
- **Asset retrieval**:
  - `GET /assets/{asset_id}` (metadata)
  - `GET /assets/{asset_id}/download` (bytes)

See: `Snapshot-state/2025-12-21/Mac_Silicon_Nexus_Integration_Requirements_and_Researcher_Prompt.md`.

---

## “Big rocks” extracted from `.blue` (what we build toward)

### 1) Compute Lighthouse / Remote Controllers

- Mac server is the **headless “Brain”**.
- Windows (and other devices) are “remote controllers” (browse, queue work, ingest results).

Actionable Windows-side implications:
- provider family: **Home Nexus (Mac)**
- health/online indicator
- jobs/task queue UI
- asset ingestion into Card Library + Wormhole artifacts

### 2) Orchestrator + Queue + Media Asset Management (MAM)

- Orchestrator routes requests to workers.
- Long jobs are async (`task_id`), progress via polling or SSE.
- Every output is indexed in SQLite with rich metadata.

Actionable Windows-side implications:
- treat Mac jobs as first-class “runs” (status badges, progress surfaces)
- ingest assets with provenance fields (prompt, seed, model, parameters)

### 3) Local persistence as governor (avoid “partial truth traps”)

- SQLite is durable local memory of “seen cards”.
- Must expose caught-up state, checkpoints, and active paging mode.

Actionable Windows-side implications:
- diagnostics/status panel (counts + checkpoint + truth source)
- exportable “debug packet”

### 4) Monolith breaker discipline

- Reduce collision risk by extracting:
  - `electron/main.ts` services (IPC handlers into modules)
  - `src/pages/CardLibrary.tsx` hooks/utilities

### 5) IDE ↔ Wormhole context bridge (future)

- The “Context Adapter” idea (local HTTP bridge for IDE hover/commands) is a valuable integration target, but should come **after** paging/persistence stability.

---

## Request protocol (how to help the other agent)

When you have a concrete ask for the Silicon Nexus agent:
- Post it in **your** `docs/.mind/Comms/NOTES_YYYY-MM-DD_<AGENT>.md`
- Keep it actionable:
  - **Goal** (what outcome you need)
  - **Proposed contract** (endpoint + fields)
  - **Sample payload + sample response**
  - **Open questions**
  - **Deadline / timebox**

If it touches hot files, use the claim protocol first.

---

## Update log

- 2025-12-25 — Created this doc to formalize workstreams + the Mac/Windows integration boundary.
