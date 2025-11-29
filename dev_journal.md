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
