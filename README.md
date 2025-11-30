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

- **Wiki Browser**
  - **Neural Index**: Browse a graph of terms and definitions generated from your content.
  - **Optimized Loading**: Fast, backend-aggregated loading of thousands of wiki entries.
  - **Search & Filter**: Quickly find terms or related concepts.

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

Tests are not yet set up. Recommended next steps:

- Add unit tests for critical logic (IPC handlers, P2P helpers, Firebase initialization).
- Add component tests for the Chat and P2P pages.

---

## Git & Workflow

- Initialize a git repository in this directory if you have not already:

```bash
git init
git add .
git commit -m "chore: initial hapa-ag setup"
```

- Track work in `dev_journal.md` and keep the PRD updated as features evolve.
