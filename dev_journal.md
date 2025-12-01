# Development Journal

## Entry 1 – Familiarize yourself with the current project
**Prompt:** "Familiarize yourself with the current project"

**Summary of actions:**
- Scanned the project structure and key files (`package.json`, Electron entrypoints, React pages).
- Identified the main technologies (Electron, React, Vite, Gemini-related libraries, Hypercore, Firebase).
- Assessed current docs/meta status and noted missing pieces (project-specific README, dev journal, PRD, APPLES, license, git).

**Tags:** #setup #analysis
**Est. Avg. Human Dev Time:** 0.5 hours

## Entry 2 – docs/meta setup
**Prompt:** "docs/meta setup"

**Summary of actions:**
- Created the /APPLES directory with BANANAS.md and ROSES.md scaffolding.
- Wrote initial versions of `dev_journal.md`, `Product_Requirements_Document.md`, a project-specific `README.md`, and a modified MIT `LICENSE`.
- Proposed initializing git for this repo to start tracking changes.

**Tags:** #setup #docs
**Est. Avg. Human Dev Time:** 0.5 hours

## Entry 3 – Pear / Hypercore reference
**Prompt:** "Can you thoroughly review the "pear" documentation with Bare.js, Hypercore, etc. and create a reference doc for you and future models to refer to when working with it within the context of this app?"

**Summary of actions:**
- Reviewed Pear, Bare runtime, Hypercore, and Hyperswarm documentation from pears.com.
- Mapped key concepts to the existing `electron/p2p.ts` and `src/pages/P2P.tsx` implementation.
- Created `Pear_Hypercore_Reference.md` in the repo root as a focused reference for this app's P2P features and future enhancements.

**Tags:** #docs #p2p #hypercore
**Est. Avg. Human Dev Time:** 0.75 hours

## Entry 4 – Multi-provider chat (OpenAI + Gemini) & audio modes
**Prompt:** "Please review and cultivate the OpenAI API documentation, then create a reference doc and a development plan to (1) enable a user to add their OpenAI API key in addition to their Google Gemini Key, (2) be able to select OpenAI models in the chat interface, (3) be able to select between OpenAI and Google family of models in the selector, and make it so the chat interface supports all media and message types in the appropriate format for each API/model/protocol. Then start implementing."

**Summary of actions:**
- Extended shared Electron/renderer types to support OpenAI keys, model listing, chat IPC, and admin audio settings.
- Updated Electron main process to store an OpenAI key, list OpenAI models, handle `chat-with-openai` including image + audio attachments with transcription via Whisper, and persist an admin `audioMode` setting.
- Updated the preload bridge to expose `listOpenAIModels`, `chatWithOpenAI`, and admin settings IPC.
- Updated the React Settings page to manage both Gemini and OpenAI keys.
- Updated the Chat UI to support provider selection (Gemini/OpenAI), model selection per provider, multi-modal attachments, and routing chat requests to the correct IPC channel.
- Extended the Admin page to surface and toggle the global audio mode (`transcribe` vs `realtime` stub).

**Tags:** #feature #llm #openai #gemini #audio
**Est. Avg. Human Dev Time:** 2.0 hours

## Entry 5 – Streaming UX & Realtime mode stub
**Prompt:** "Can you research both Google and OpenAI APIs, and then enable both offerings to toggle between 'Real Time / Streaming' input with mic and camera OR request/response? Also fix the OpenAI streaming duplication issue."

**Summary of actions:**
- Refactored Electron chat handlers for Gemini and OpenAI to use streaming APIs and emit incremental chunks over an IPC `chat-stream` channel.
- Implemented robust SSE parsing and delta computation for OpenAI streaming to avoid duplicated text when models resend the full buffer.
- Wired the renderer Chat page to create a placeholder assistant message and append streamed deltas in real time, with a stop/cancel control tied to the active request.
- Added a UI-level "Request/Response vs Realtime" mode toggle and basic mic/camera capture that feeds attachments into the existing pipeline (backend still request/response with streaming output).

**Tags:** #feature #llm #streaming #realtime #ux
**Est. Avg. Human Dev Time:** 2.0 hours

## Entry 6 – Local llama.cpp provider & management UI
**Prompt:** "Can you actually get llama.cpp inside this app, or attached/bundled? Please design a UI/flow to manage llama.cpp and bring it into the repo so I can download models locally and chat with them alongside Gemini/OpenAI."

**Summary of actions:**
- Designed a local provider architecture where a llama.cpp `llama-server` instance exposes an OpenAI-compatible `/v1/chat/completions` and `/v1/models` API.
- Extended Electron main to add `list-llama-models` and `chat-with-llama` IPC handlers, sharing the existing OpenAI streaming parser for incremental deltas.
- Added persistent llama runtime settings (server path, models directory, default model, port, auto-start) and process lifecycle helpers to start/stop the server and report status.
- Implemented a new `LocalLlama` React page with runtime status, configuration form, a GGUF model downloader (from URLs into the models directory), and a local models registry (list/set-default/delete).
- Integrated a third provider option ("Local (llama.cpp)") into the Chat UI with model loading and streaming behavior consistent with Gemini/OpenAI.

**Tags:** #feature #llm #llama #local #infrastructure
**Est. Avg. Human Dev Time:** 3.0 hours

## Entry 7 – Card Library Enhancements & Wiki Optimization
**Prompt:** "Card Run States Badges", "Video cards are being treated as text", "Can we get rid of this top bar", "Wiki still seems to be loading excessively slow"

**Summary of actions:**
- **Card Library:**
    - Implemented visual badges on card thumbnails to show Wormhole run states (Summaries, Key Terms, Wiki Entries) with counts.
    - Added a "Run Stats" section to the Card Inspector.
    - Fixed video card playback by correctly identifying media types and using `file://` URLs with `webSecurity: false` in Electron.
- **Wiki:**
    - Optimized Wiki loading by moving aggregation logic to the backend (`wormhole-get-wiki-index`), replacing hundreds of P2P requests with a single IPC call.
- **Electron/UI:**
    - Hidden the default Electron menu bar (`autoHideMenuBar: true`).
    - Disabled automatic DevTools opening and added a manual toggle button in the UI layout.

**Tags:** #feature #ui #optimization #electron #wormhole
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 8 – Dropdown audio cues for Astro selects
**Prompt:** "Add Dropdown Audio Feedback"

**Summary of actions:**
- Inspected Astro `rux-select` implementation to confirm available custom events and shadow DOM structure.
- Augmented global sound effect hook to detect dropdown open, option hover, and selection using pointer events and composed paths.
- Wired new Web Audio helpers for dropdown open/hover/select tones, respecting the existing mute toggle.

**Tags:** #feature #audio #ux
**Est. Avg. Human Dev Time:** 0.75 hours

## Entry 9 – Profile Page & System Stats
**Prompt:** "Create a plan for a 'Profile Page' accessible via the current 'Profile' icon... And then implement using Astros' paradigm and your design philosophy."

**Summary of actions:**
- **Backend:**
    - Implemented `get-profile` and `save-profile` IPC handlers using `electron-store`.
    - Implemented `get-system-stats` IPC to aggregate storage usage, card/wiki counts, and P2P connectivity status.
    - Added `getP2PStats` helper in `p2p.ts` to expose swarm peer count and public key.
- **Frontend:**
    - Created `src/pages/Profile.tsx` using Astro UXDS components (`rux-card`, `rux-input`, `rux-textarea`).
    - Designed a dashboard layout featuring:
        - **Identity:** Avatar, Display Name, and "Neural Persona" context field.
        - **Network:** Live P2P swarm status and Public Key display.
        - **Stats:** Visual counters for Cards, Wiki Nodes, and Storage usage.
    - Wired the top-right profile icon in `Layout.tsx` to the new `/profile` route.

**Tags:** #feature #ui #astro #profile #p2p
**Est. Avg. Human Dev Time:** 2.0 hours

## Entry 10 – Profile Image Upload & Hypercore Integration
**Prompt:** "Can you make it so I can add a profile picture that creates a card and a hypercore. If I add another profile picture, update that hypercore with the new one vs. creating a new one though."

**Summary of actions:**
- **Backend (`electron/main.ts`):**
    - Implemented `save-profile-image` IPC handler.
    - Logic to check for an existing `profileCardId` in the user profile.
    - If existing, reuses the Hypercore to append the new image card record (maintaining history).
    - If new, creates a new Hypercore and appends it to the main `card-library` index.
    - Saves image binary to `userData/wormhole/` and updates the profile with the local file path.
- **Frontend (`src/pages/Profile.tsx`):**
    - Added a hidden file input triggered by clicking the avatar.
    - Implemented image upload handler that reads the file as Base64 and calls the backend.
    - Added visual feedback (hover overlay with upload icon) to the avatar component.
    - **Drag & Drop:** Added `onDragOver`, `onDragLeave`, and `onDrop` handlers to the avatar container to support dragging image files directly onto the profile picture area.
- **Types:** Updated `UserProfile` to track `profileCardId`.

**Tags:** #feature #profile #hypercore #p2p #images #ux
**Est. Avg. Human Dev Time:** 1.25 hours

## Entry 11 – Pet Forge Refinement & Chat Image Overlay
**Prompt:** "Chat Image Hover Overlay", "Pet Forge UI refinements"

**Summary of actions:**
- **Pet Forge:** Refined chassis slot layout to prevent bleeding, implemented asset filtering to show only relevant sprite animations, added hover tooltips for asset names, and automated 'sprite' tagging for generated GIFs to ensure immediate availability.
- **Chat UI:** Overhauled the image hover experience for both AI-generated images and file attachments. Replaced static overlay with expanding, interactive buttons (Download, Save to Library).
- **Polish:** Implemented a robust flexbox-based button layout to ensure pixel-perfect icon centering in the collapsed state and smooth expansion on hover, addressing user feedback on visual alignment.
- **Protocol:** Recorded a Rose for the user (for identifying the visual misalignment) and a Banana for the assistant (for the final implementation) in the project's `APPLES` logs.

**Tags:** #feature #ui #ux #pet-forge #chat #polish
**Est. Avg. Human Dev Time:** 1.5 hours
