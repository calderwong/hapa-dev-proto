# Hapa Node API Reference (for Windsurf / Local Automation)

This repo includes a **local-only HTTP Debug API** that lets Windsurf (and other local tools/agents) inspect and drive the running Electron renderer.

This is intentionally **NOT** a public network API. It is designed for:
- Local developer automation
- Smoke-testing UI routes and debug panels
- Inspecting `window.__HAPA_DEBUG_STATE__`

---

## Enable the Debug API

The Debug API is started by Electron main **only when enabled**:

- Enable via env var:
  - `HAPA_DEBUG_API=1`
- Or enable via CLI flag:
  - `--debug-api`

Optional env vars:
- `HAPA_DEBUG_API_PORT`
  - Default: `0` (ephemeral/random port)
- `HAPA_DEBUG_API_TOKEN`
  - Default: random 32-byte hex token printed at startup

When enabled, Electron main logs:
- `baseUrl`
- `token`

Example log:
- `[DebugAPI] Listening { baseUrl: "http://127.0.0.1:46830", token: "..." }`

---

## Security model / threat model

- **Bind address:** `127.0.0.1` only
- **Remote address check:** requests not from loopback are rejected with `403`
- **Auth:** all endpoints except `/` and `/health` require a bearer token
- **Methods:** `GET` only (anything else returns `405`)

Auth can be provided as:
- `Authorization: Bearer <token>` (preferred)
- Or `?token=<token>` query string

This API is meant for **local dev only**. Do not enable it in production.

---

## Quickstart (Windows PowerShell)

Run dev with a fixed port+token (recommended for automation):

```powershell
$env:HAPA_DEBUG_API = "1"
$env:HAPA_DEBUG_API_PORT = "46830"
$env:HAPA_DEBUG_API_TOKEN = "local-dev"

npm run dev
```

Then (in another terminal):

```powershell
$env:HAPA_DEBUG_API_BASE_URL = "http://127.0.0.1:46830"
$env:HAPA_DEBUG_API_TOKEN = "local-dev"

node scripts/test-operator-reality-panel.mjs
```

---

## Endpoints

### Public (no auth)

- `GET /health`
  - Returns `{ ok: true, service: "hapa-debug-api", time }`

### Renderer inspection / automation (auth)

- `GET /v1/renderer/state`
  - Returns a snapshot of the current renderer:
    - `href`, `pathname`, `hash`, `title`
    - `debugState`: `window.__HAPA_DEBUG_STATE__` (if present)

- `GET /v1/renderer/dom?selector=<css>`
  - Returns `{ exists, count }` for a selector

- `GET /v1/renderer/navigate?path=/operator`
  - Sets `location.hash` (HashRouter-friendly)
  - Params:
    - `path` or `hash`

- `GET /v1/renderer/click?text=Refresh`
  - Click by either:
    - `selector=<css>`
    - OR `text=<substring>` + optional `tag=<css list>` (default: `rux-button,button,a`)
  - Optional:
    - `index=<n>` (default `0`) to choose among matches

- `GET /v1/renderer/text?selector=<css>`
  - Returns `.textContent` for the first match

### IPC proxies (auth)

These call the renderer’s `window.electronAPI.*` methods via `executeJavaScript`.

- `GET /v1/ipc/system-stats`
  - Calls `electronAPI.getSystemStats()`

- `GET /v1/ipc/persistence-stats`
  - Calls `electronAPI.getPersistenceStats()`

- `GET /v1/ipc/persistence-rebuild-card-library-index`
  - Calls `electronAPI.persistenceRebuildCardLibraryIndex()`
  - Timeout: up to ~60s

- `GET /v1/ipc/p2p-get-length?coreName=card-library`
  - Calls `electronAPI.p2pGetLength(coreName)`

- `GET /v1/ipc/nexus-index-page?coreName=card-library&direction=reverse&limit=1`
  - Calls `electronAPI.nexusIndexPage(payload)`
  - Notes:
    - If `direction=reverse` you can omit `cursor` to start from end-of-core.

### Checks (auth)

- `GET /v1/checks/cards-loaded?min=120`
  - Reads `__HAPA_DEBUG_STATE__.cardLibrary.cardsCount` and checks it exceeds `min`

- `GET /v1/checks/operator-panel-ready?requireSnapshot=true`
  - Reads `__HAPA_DEBUG_STATE__.operatorRealityPanel`
  - `active` means the page is mounted
  - `hasSnapshot` means the panel fetched at least one snapshot

---

## Example curl calls

Health:

```bash
curl http://127.0.0.1:46830/health
```

Authenticated call:

```bash
curl -H "Authorization: Bearer local-dev" http://127.0.0.1:46830/v1/renderer/state
```

Navigate to Operator panel:

```bash
curl -H "Authorization: Bearer local-dev" "http://127.0.0.1:46830/v1/renderer/navigate?path=/operator"
```

Wait until Operator panel has a snapshot:

```bash
curl -H "Authorization: Bearer local-dev" "http://127.0.0.1:46830/v1/checks/operator-panel-ready?requireSnapshot=true"
```

Trigger rebuild (bypasses UI confirm):

```bash
curl -H "Authorization: Bearer local-dev" http://127.0.0.1:46830/v1/ipc/persistence-rebuild-card-library-index
```

---

## Source of truth (implementation)

- Debug API server: `electron/hapa-debug-api.ts`
- Enablement + logging: `electron/main.ts` (env/flag guarded)
- IPC surface area: `electron/preload.ts` (`window.electronAPI`)

---

## Known limitations

- Some UI actions (clipboard + downloads) are environment-dependent in Electron.
- The Debug API is **intentionally** loopback-only; it is not the same thing as the planned Mac↔Windows LAN API.
