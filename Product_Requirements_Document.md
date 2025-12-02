# Product Requirements Document – Hapa AG

## 1. Overview (What & Why)
Hapa AG is a desktop Electron application that provides a local-first workspace for interacting with AI models (Google Gemini, OpenAI, and local llama.cpp) and experimenting with P2P data sharing via Hypercore/Hyperswarm.

Goals:
- Provide a clean, keyboard-friendly chat interface to multiple providers (Gemini, OpenAI, local llama.cpp) with rich markdown and media support.
- Make it easy to configure and swap models and backends (Gemini, OpenAI, local llama.cpp, Firebase-backed services, etc.).
- Explore distributed, append-only logs using Hypercore via a simple "P2P Hypercore Manager" UI.

## 2. Primary Features (v0)

### 2.1 Gemini Chat
- Send text messages to a selected Gemini model.
- Display responses rendered as Markdown (with GFM: lists, code, links, images).
- Support image/video/audio attachments uploaded from disk or via drag-and-drop.
- Show loading indicators while the model is generating a response.

### 2.4 Multi-provider Chat & Audio Modes
- Allow the user to configure multiple LLM providers (at minimum Google Gemini and OpenAI) via Settings.
- In the chat UI, allow selection of provider family (Gemini vs OpenAI) and model within that family.
- Support multi-modal messages (text + images + audio) with provider-specific formatting handled in the Electron main process.
- Provide an admin-only setting to control audio handling mode ("transcribe first" vs a future "realtime" mode stub) stored locally and applied consistently across providers.

### 2.5 Local llama.cpp Provider
- Treat a local llama.cpp server as a first-class provider option alongside Gemini and OpenAI.
- Provide a dedicated "Local AI (llama.cpp)" page to:
  - Configure the `llama-server` binary path, models directory, default model, and port.
  - Start/stop the llama.cpp server and show basic status (running, PID, port, last error).
  - Download GGUF models to the configured models directory from URLs (e.g., Hugging Face file URLs).
  - List, set default, and delete local GGUF models.
- Integrate the local provider into the existing Chat UI so users can switch providers without leaving the conversation view.

### 2.2 Settings
- Input fields for:
  - Gemini API key.
  - Firebase configuration JSON.
- Persist settings locally via the Electron backend.
- On app startup, automatically:
  - Load stored settings.
  - Initialize Firebase if a config is present.

### 2.3 P2P Hypercore Manager
- Create or join a Hypercore by name.
- Display core metadata (key, discovery key if available, length).
- Append new entries to a core.
- View core contents as a scrollable log.
- Sync with peers over Hyperswarm.

## 3. Non-Functional Requirements

- **Platform**: Desktop (Electron; Windows-focused, but cross-platform where possible).
- **Performance**: Responsive UI for chat and log viewing; background P2P should not block the renderer.
- **Security & Privacy**:
  - Never hard-code API keys; store them only locally on the user's machine.
  - Minimize logging of sensitive data to console or disk.
  - Keep Electron `contextIsolation` enabled and expose a narrow, typed preload bridge.
- **UX/UI Standards**:
  - **Drag & Drop**: Any feature involving file ingestion (uploading images, documents, media) MUST support drag-and-drop functionality in addition to standard file pickers.
  - **Feedback**: Provide immediate visual feedback for user actions (hover states, loading spinners, success/error toasts).

- **Maintainability**:
  - TypeScript across renderer and Electron where possible.
  - Flat ESLint config enforced via `npm run lint`.

## 4. Open Questions / Future Work

- Broader support for additional backends (e.g., Vertex AI vs Gemini, more local runtimes) beyond the current Gemini + OpenAI + llama.cpp stack.
- Richer conversation management (named chats, history persistence).
- Stronger encryption / authentication for P2P data.
- Better onboarding and documentation inside the app.
