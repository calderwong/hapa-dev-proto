# Hapa AG – Electron AI + P2P Sandbox

Hapa AG is a desktop Electron application that combines:

- **Multi-provider Chat** – a rich chat UI for Google Gemini, OpenAI, and local llama.cpp models with Markdown rendering, media attachments, and streaming.
- **Card Library & Wormhole** – a knowledge management system where "Cards" are processed through a "Wormhole" pipeline to generate summaries, key terms, and wiki entries.
- **Wiki Browser** – a neural archive of knowledge nodes generated from your cards.
- **Settings** – a simple place to configure and persist your Gemini and OpenAI API keys and Firebase configuration.
- **Local AI (llama.cpp)** – an in-app control panel for configuring, starting/stopping, and managing local llama.cpp models.
- **P2P Hypercore Manager** – an experimental UI for creating/joining Hypercore logs and syncing them over Hyperswarm.

The app is built with **Electron**, **React + TypeScript**, and **Vite**.

---

## Features

- **Multi-provider Chat (Gemini, OpenAI, Local llama.cpp)**
  - Choose from available models per provider (queried via the Electron backend for Gemini/OpenAI and a local llama.cpp server).
  - Toggle between providers in the chat header while keeping a unified message history UI.
  - Send text messages with streaming-style UI feedback.
  - Render responses as GitHub-flavored Markdown (code blocks, lists, links, images).
  - Attach image / video / audio files via file picker or drag-and-drop (converted to Base64 for the backend).
  - Global neon-inspired UX polish with hover/click tones, dropdown audio feedback, and a mute toggle persisted to local storage.

- **Card Library & Wormhole**
  - **Drag & Drop Import**: Easily import text, images, and videos as cards.
  - **Wormhole Pipeline**: Process cards to automatically generate summaries, extract key terms, and create wiki entries.
  - **Status Badges**: Visual indicators on cards show which artifacts have been generated.
  - **Video Playback**: Native support for playing local video files directly within the workspace.
  - **Run Stats**: Inspect the generation counts for any card.
  - **Incremental Loading**: The Card Library loads the index in pages and hydrates card records in batches to stay responsive with large libraries.

- **Wiki Browser**
  - **Neural Index**: Browse a graph of terms and definitions generated from your content.
  - **Optimized Loading**: Fast, backend-aggregated loading of thousands of wiki entries.
  - **Search & Filter**: Quickly find terms or related concepts.

- **Profile Page**
  - **Identity Hub**: Manage your agent's display name, avatar, and neural persona context.
  - **System Stats**: View real-time storage usage, card/wiki counts, and P2P network status.
  - **Data Management**: (Planned) Tools to export data or clear local storage.

- **Settings**
  - Store a Gemini API key.
  - Store an OpenAI API key.
  - Store Firebase configuration JSON.
  - Persist settings locally via the Electron backend.
  - Automatically initialize Firebase on app startup when a config is present.

- **Local AI (llama.cpp)**
  - Configure the path to a local `llama-server` binary and a models directory.
  - Download GGUF models from URLs (e.g., Hugging Face file links) directly into the models directory.
  - View and manage local models (.gguf files) from the UI (set default model, delete).
  - Start/stop the local llama.cpp server and view its status (port, PID, last error).

- **P2P Hypercore Manager**
  - Create or join a Hypercore by name.
  - Append new log entries.
  - View all entries for a core in a scrollable log.
  - Backed by **hypercore** and **hyperswarm** in the Electron process.

- **3D Nexus (Card Constellation Viewer)**
  - Immersive 3D visualization of your card library and relationships.
  - **LOCAL mode**: Focused constellation with parent/child/sibling cards arranged around the selected card.
  - **GLOBAL mode**: Spiral layout of all cards with search filtering and tunable edge rendering.
  - Smooth camera navigation with focus, top, and wide presets.
  - Deep-linkable from Chat, Wiki, and Card Library (`/nexus?cardId=...`).
  - Distance-based label LOD for performance with large libraries.

- **Boot Splash (Vibes)**
  - On app launch, a lightweight splash screen plays videos from `.vibes` immediately.
  - The main window loads hidden in the background and is only shown once the renderer signals it is ready.

- **Debug API (local-only, opt-in)**
  - Optional localhost HTTP API in the Electron main process for querying safe app/renderer state during debugging.
  - Token-authenticated, **read-only**, and bound to `127.0.0.1`.

---

## Tech Stack

- **Shell / Runtime**: Electron 39, electron-builder.
- **Frontend**: React 19, React Router 6 (HashRouter), Tailwind CSS, React Markdown + remark-gfm.
- **AI / Backend**: @google/generative-ai, @google-cloud/vertexai, OpenAI Chat Completions API (via HTTPS from Electron), and a local llama.cpp server exposing an OpenAI-compatible API.
- **P2P**: hypercore, hyperswarm, b4a.
- **Config / Storage**: electron-store (for settings), Firebase JS SDK.
- **Tooling**: Vite 7, TypeScript 5.9, ESLint flat config.

---

## Getting Started

### Prerequisites

- Node.js 18+ recommended.
- npm (or a compatible package manager).

### Install dependencies

```bash
npm install
```

### Run in Electron (recommended)

```bash
npm run dev
```

This will:

- Start the Vite dev server on port 5173.
- Compile the Electron TypeScript files.
- Launch the Electron app pointing at `http://localhost:5173`.

### Run in browser-only mode (for quick UI work)

```bash
npm run dev -- --host
```

Then open the shown URL in your browser. In this mode, the app will:

- Render the UI via Vite/React.
- Fall back to mock behavior when `window.electronAPI` is not available
  (e.g., mock responses in Chat, settings not persisted).

### Build and package

```bash
npm run build
```

This will:

- Build the renderer with Vite into `dist/`.
- Compile Electron TypeScript into `dist-electron/`.
- Run `electron-builder` to create a packaged desktop app.

---

## Configuration

All runtime configuration is done inside the **Settings** page in the app:

- **Gemini API key**: used by the Electron backend to call Gemini / Vertex AI APIs.
- **Firebase configuration (JSON)**: passed to the renderer and used by `initFirebase` to initialize Firebase.

Keys and configs are stored locally via Electron (no keys are committed to the repo).

> Security note: Avoid hard-coding API keys or secrets in source files. Use the Settings UI and local storage instead.

### Debug API (optional)

Enable the local debug API by setting an environment flag (recommended for local dev only):

- `HAPA_DEBUG_API=1` (or pass `--debug-api`)
- Optional: `HAPA_DEBUG_API_PORT=<port>` (default: random available port)
- Optional: `HAPA_DEBUG_API_TOKEN=<token>` (default: random token generated at start)

When enabled, Electron will print the URL + token in the main-process console:

- `GET /health` (no auth)
- `GET /v1/info` (auth)
- `GET /v1/renderer/state` (auth)
- `GET /v1/renderer/dom?selector=...` (auth)
- `GET /v1/renderer/navigate?path=/operator` (auth)
- `GET /v1/renderer/click?text=Refresh` (auth)
- `GET /v1/renderer/text?selector=...` (auth)
- `GET /v1/checks/cards-loaded?min=120` (auth)
- `GET /v1/checks/operator-panel-ready?requireSnapshot=true` (auth)
- `GET /v1/ipc/p2p-get-length?coreName=card-library` (auth)
- `GET /v1/ipc/system-stats` (auth)
- `GET /v1/ipc/persistence-stats` (auth)
- `GET /v1/ipc/persistence-rebuild-card-library-index` (auth)
- `GET /v1/ipc/nexus-index-page?coreName=card-library&direction=reverse&limit=120` (auth)

For the full reference (including auth examples and an Operator Reality Panel smoke-test script), see:

- `docs/reference/HAPA_NODE_API_REFERENCE.md`

Auth is via `Authorization: Bearer <token>` (preferred) or `?token=<token>`.

---

## P2P Hypercore Notes

- Hypercores are created relative to a `./storage` directory from the Electron process.
- Hyperswarm is used to discover peers and replicate log data.
- There is currently **no authentication or encryption** layer; this is an experimental sandbox only.

Use this feature only on networks and with data you are comfortable experimenting with.

---

## Project Structure (high level)

- `electron/`
  - `main.ts` – Electron app entrypoint and window creation.
  - `preload.ts` – Exposes a safe `window.electronAPI` bridge (IPC wrappers).
  - `p2p.ts` – Hypercore/Hyperswarm helpers (create/append/read).

- `src/`
  - `main.tsx` – React entrypoint.
  - `App.tsx` – Router + top-level routes.
  - `components/Layout.tsx` – Sidebar layout and navigation (Chat, P2P, Local AI, Settings, Admin).
    - Hosts global sound effect listeners (buttons + Astro dropdowns) and the audio mute toggle.
  - `pages/Chat.tsx` – Multi-provider chat UI (Gemini, OpenAI, local llama.cpp) with streaming and attachments.
  - `pages/CardLibrary.tsx` – Card management, drag & drop, and Wormhole status.
  - `pages/Wiki.tsx` – Wiki browser with optimized backend loading.
  - `pages/Settings.tsx` – Settings UI for Gemini/OpenAI keys and Firebase config.
  - `pages/LocalLlama.tsx` – Local AI (llama.cpp) runtime and model management UI.
  - `pages/P2P.tsx` – P2P Hypercore Manager UI.
  - `pages/Admin.tsx` – Admin tools (Gemini request log and audio mode).
  - `firebase.ts` – Firebase initialization helper.

- Docs & meta
  - `dev_journal.md` – Development journal with prompts and actions.
  - `Product_Requirements_Document.md` – Product requirements and scope.
  - `APPLES/BANANAS.md` – Banana rewards log.
  - `APPLES/ROSES.md` – Roses log for significant user help.
  - `LICENSE` – Modified MIT license for this project.

---

## Development

- **Lint**

```bash
npm run lint
```

- **Testing**

Unit tests are intentionally lightweight and use Node's built-in test runner.

```bash
npm test
```

Notes:

- The `test` script runs `node --test tests`.
- Keep tests pure (no network, no Electron runtime) unless explicitly writing an integration smoke test.

---

## Git & Workflow

- Initialize a git repository in this directory if you have not already:

```bash
git init
git add .
git commit -m "chore: initial hapa-ag setup"
```

- This repo uses **Git LFS** for large binary assets under `docs/` (e.g. videos, zips, images) so other contributors can pull full context without bloating git history.

```bash
git lfs install
git lfs pull
```

- Track work in `dev_journal.md` and keep the PRD updated as features evolve.
