# Hapa Node – AI Agent Handoff

_Last updated: 2025‑11‑29_

This document is an orientation for an AI coding agent dropped into this repo **with no prior context**. It explains:

- What this project is and how it’s structured.
- Key features (especially **Wormhole** and **Card Library**).
- How **Astro UXDS** is being integrated.
- Conventions and files you should respect.
- Suggested areas to focus on next.

If you read only one file before acting, make it this one plus `README.md` and `wormhole_frd.md`.

---

## 1. High‑level Project Overview

This repo is the **Hapa Node** desktop app:

- **Electron shell** running a **React** frontend via **Vite**.
- Acts as a **local + cloud AI toolkit**: chat, card library, media search, Wormhole ingestion, wiki/knowledge views, etc.
- Uses **Hypercore / Hyperswarm** for local P2P data storage and replication.
- Integrates multiple AI backends:
  - **Gemini** (`@google/generative-ai` via REST from Electron).
  - **OpenAI** Chat and audio realtime.
  - **Local llama.cpp** server (OpenAI‑compatible HTTP API).
- Has an evolving **design system** story: originally Tailwind + custom components; now gradually integrating **Astro UXDS Web Components**.

You are working in TypeScript on both Electron and React sides.

---

## 2. Tech Stack & Entry Points

### 2.1 Frontend

- **Entry:** `src/main.tsx`
  - Imports `setupAstro()` and renders `<App />` into `#root`.
- **Router/App shell:** `src/App.tsx`
  - Uses `HashRouter` with routes under `/`.
  - Key routes:
    - `/` – `Chat`
    - `/cards` – `CardLibrary`
    - `/wormhole` – classic Wormhole UI
    - `/wormhole-astro` – _experimental_ Wormhole UI using Astro components
    - `/wiki` – Wiki browser
    - `/revid`, `/revid-media` – Revid video/media
    - `/local-llama`, `/p2p`, `/settings`, `/admin` – operational pages
- **Layout & navigation:** `src/components/Layout.tsx`
  - Provides shell: sidebar navigation + main content area.
  - **Important:** Sidebar now uses **Astro `rux-icon`** instead of Lucide.
  - Top of main content uses **`<rux-global-status-bar appname="Hapa AI" />`**.

### 2.2 Electron / backend

- **Main process:** `electron/main.ts`
  - Sets up Electron windows, IPC, and most backend logic.
  - Key concerns:
    - Settings via `electron-store`.
    - AI backends:
      - Chat IPC handlers: `chat-with-gemini`, `chat-with-openai`, `chat-with-llama`.
      - Gemini helpers for summarization & key‑terms with a **model resolver** that maps deprecated IDs (e.g. `gemini-pro`) to current ones (e.g. `gemini-1.5-flash`).
    - **Wormhole IPC**:
      - `wormhole-ingest-content`
      - `wormhole-run-transcription`
      - `wormhole-run-summarization`
      - `wormhole-run-keyterms`
      - `wormhole-run-wiki-update`
      - `wormhole-get-status`
      - `wormhole-get-derived-artifacts`
- **P2P / Hypercore:** `electron/p2p.ts`
  - `initP2P()` sets up `Hyperswarm`.
  - `createCore(name)`, `appendToCore(name, data)`, `readCore(name)` wrap Hypercore.
  - `readCore` has been patched to **lazily create/open cores**, so calls like `p2pRead('card-library')` won’t throw when the core hasn’t been opened in this process yet.

### 2.3 Shared types & preload

- `src/types.d.ts` – central **type definitions**:
  - Settings, Llama, Revid.
  - **Wormhole types**: `WormholeSettings`, `WormholeStepConfig`, `WormholeIngestParams`, `WormholeRunStepParams`, `WormholeStatus`, `WormholeDerivedArtifacts`, etc.
  - `ElectronAPI` interface – all IPC methods exposed to the renderer.
- `electron/preload.ts` – exposes `window.electronAPI` matching `ElectronAPI`.

---

## 3. Core Features to Know

### 3.1 Chat (`src/pages/Chat.tsx`)

- Multi‑provider chat (Gemini / OpenAI / local llama).
- Loads model lists via IPC:
  - `listGeminiModels`, `listOpenAIModels`, `listLlamaModels`.
- Lets user select provider + model from dropdowns.
- Handles attachments (images/video/audio) and can create **Cards** from chat images.

### 3.2 Card Library (`src/pages/CardLibrary.tsx`)

- Browser for card records stored in a Hypercore named **`card-library`**.
- Each card:
  - Represents an image, audio, pdf, text, etc.
  - Has provenance fields and can include **Wormhole** metadata.
- Details view is now an **overlay modal**:
  - Shows primary content/preview.
  - Shows Wormhole section:
    - Ingest provenance: local path, original URL, owner DID, tags.
    - **Processing step badges** for: ingest, transcription, summarization, key terms, wiki update.
    - Buttons: **Run summarization**, **Run key terms**, **Run wiki update**.
    - Each run calls the corresponding `wormholeRun*` IPC and then refreshes the card.
  - Model overrides section:
    - Three dropdowns (or text inputs if model list not available) to override models per step.

### 3.3 Wormhole (`src/pages/Wormhole.tsx`)

This is the canonical Wormhole UI (Tailwind-based).

- **Ingestion**:
  - Accepts:
    - Local file path (`path`)
    - Dropped `File` object (converted to base64 bytes, sent as `bytesBase64` + `fileName`)
    - Remote URL (`originalUrl`)
  - Calls `wormholeIngestContent` (IPC) with `WormholeIngestParams`.
  - Creates a new Card and indexes it into `card-library` Hypercore.
- **Per‑ingest manual steps**:
  - For each recent item, user can trigger:
    - `wormholeRunTranscription` (audio only)
    - `wormholeRunSummarization` (audio+transcript or text/markdown)
    - `wormholeRunKeyTerms`
    - `wormholeRunWikiUpdate`
  - Status and errors for each step are tracked and shown inline.
- **Global ingest feed**:
  - Reads all `card-index` entries from `card-library` Hypercore.
  - Follows each card Hypercore to find latest `card` record and its Wormhole processing state.
  - Displays a compact table/list of all Wormhole cards with statuses and an **Open** button.
- **Model overrides (per‑run)**:
  - Three Gemini‑backed dropdowns, populated with `listGeminiModels`.
  - Values are passed as `overrideModel` into `wormholeRun*` IPC.

### 3.4 Wormhole Astro (`src/pages/WormholeAstro.tsx`)

- Experimental version of Wormhole UI using **Astro Web Components** (`rux-input`, `rux-select`, `rux-button`, etc.).
- Behavior mirrors `Wormhole.tsx`:
  - Same ingest logic and IPC usage.
  - Same per‑run override semantics.
  - Same global feed semantics.
- Layout:
  - Astro inputs for form controls.
  - Astro selects for model overrides.
  - Astro buttons for actions.
- Route: `/wormhole-astro` (HashRouter path `#/wormhole-astro`).

### 3.5 Wiki (`src/pages/Wiki.tsx`)

- Reads `wormhole-wiki-entries` Hypercore to display wiki terms.
- Provides:
  - Search/filter.
  - Term cards.
  - A side panel that shows all wiki entries and source cards for a chosen term.
- Wiki entries are written by the backend via `wormhole-run-wiki-update`.

---

## 4. Astro UXDS Integration

We are **mid‑migration** from a Tailwind+custom UI to an **Astro UXDS**-aligned UI.

### 4.1 What’s already integrated

- **Astro Web Components package**: `@astrouxds/astro-web-components` installed.
- **Setup:** `src/astro/setupAstro.ts`
  - Imports defineCustomElements and Astro’s base CSS.
  - `setupAstro()` is called in `src/main.tsx`.
- **Type declarations:** `src/astro/astro.d.ts`
  - Declares JSX intrinsic elements for `rux-button`, `rux-input`, `rux-select`, `rux-icon`, `rux-global-status-bar`, etc.
- **Layout shell:** `src/components/Layout.tsx`
  - Uses `rux-icon` for sidebar nav icons.
  - Adds `rux-global-status-bar appname="Hapa AI"` above the page content.
- **WormholeAstro page:** built entirely around Astro components, but still wrapped in existing `PageContainer` and Tailwind layout.

### 4.2 Design intent

- Keep **data and routing behavior** stable while evolving the look & feel.
- Move toward Astro’s patterns:
  - App shell with global status bar.
  - Astro icons and typography.
  - Astro buttons/inputs/selects for primary controls.
- Long‑term: use Astro design tokens for colors and typography, so Tailwind config aligns with Astro’s visual system.

---

## 5. Project Conventions You Must Respect

### 5.1 APPLES / BANANAS / ROSES

At repo root you’ll see `/APPLES` with:

- `BANANAS.md` – log of “banana” rewards from the user.
- `ROSES.md` – log of “roses” when the user helps resolve a significant issue.

These files are part of the user’s meta‑tracking. **Do not modify them unless explicitly instructed.**

### 5.2 dev_journal, README, FRDs

- `dev_journal.md` (expected) – running log of prompts and steps; keep it up to date when asked.
- `README.md` – high‑level overview; keep in sync when major features change.
- `wormhole_frd.md` – **functional requirements document** for Wormhole. Treat this as the source of truth when making Wormhole changes.
- `ASTRO_UXDS_NOTES.md` – notes and integration plan for Astro UXDS.

### 5.3 Git & storage

- Git is used actively; checkpoints are created periodically.
- The `storage/` directory contains **Hypercore leveldb files**.
  - These are large and not intended to be tracked exhaustively.
  - Be careful with `git add .`; prefer adding only `src`, `electron`, docs, etc.

---

## 6. How to Think About Changes

When you’re asked to modify or extend the app, prefer this order of thought:

1. **Check the FRD / design notes**:
   - For Wormhole: `wormhole_frd.md` and `ASTRO_UXDS_NOTES.md`.
2. **Locate the relevant IPC and types**:
   - Electron handlers in `electron/main.ts`.
   - Types in `src/types.d.ts`.
   - Preload exposure in `electron/preload.ts`.
3. **Find the frontend entry point**:
   - Page under `src/pages/`.
   - Shared components under `src/components/`.
4. **Preserve IPC contracts**:
   - Don’t change IPC names or parameter shapes without updating `ElectronAPI` and the main process.

For Astro work, prefer:

- Using **Astro components** (or thin React wrappers) instead of inventing new bespoke Tailwind UIs.
- Consulting Astro’s Storybook/README for the correct props and patterns.

---

## 7. Suggested Areas to Focus On Next

If you’re asked to continue work without specific direction, here are safe, useful directions:

1. **Astro‑ify more of Wormhole and Card Library**
   - Replace standard `<input>`/`<button>` pairs with `rux-input` / `rux-button`.
   - Introduce consistent panel layouts and typography using Astro patterns.
   - Add Astro status indicators (e.g., `rux-status`) for Wormhole step statuses.

2. **Astro tokens → Tailwind bridge**
   - Investigate Astro design tokens (colors, typography).
   - Map them into `tailwind.config.*` so the rest of the app visually matches Astro.

3. **Global status in `rux-global-status-bar`**
   - Surface live status:
     - P2P / Hypercore connectivity.
     - LLM backend availability (Gemini/OpenAI/llama).
     - Wormhole ingest/processing queue health.
   - Use non‑intrusive indicators, following Astro’s guidance for global status.

4. **Accessibility and robustness**
   - Ensure all selects and important controls have `aria-label`s (some are already added).
   - Verify keyboard navigation and focus management in Astro‑based pages.

5. **Testing and logging**
   - Add or improve logging around Wormhole IPC handlers (noisy but extremely useful).
   - Consider adding lightweight unit tests where feasible (e.g., for model‑name resolution helpers).

---

## 8. Quick Checklist for Any New Work

Before you implement a feature or bugfix:

- [ ] Check if it’s already described in `wormhole_frd.md` or `ASTRO_UXDS_NOTES.md`.
- [ ] Identify the affected IPC methods and confirm their type signatures.
- [ ] Decide whether the UI should be **Tailwind-only**, **Astro-only**, or **hybrid**.
- [ ] Respect existing conventions like APPLES/BANANAS/ROSES logs.
- [ ] Avoid committing `storage/` changes unless explicitly asked.
- [ ] After significant work, update `README.md`, FRDs, and any relevant notes.

If you’re ever unsure, err on the side of:

- Reading the FRD and design notes.
- Adding clear comments where logic is non‑obvious.
- Proposing minimal, incremental UI changes rather than sweeping rewrites.

This should give you enough context to operate independently while staying aligned with the owner’s intentions and the emerging Astro‑based design system.
