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

### 2.6 Card Library & Media Management
- **Card Library**: Persistent storage for reusable content cards backed by Hypercore.
  - Save messages, images, videos, audio, and configuration as "cards" with metadata.
  - Browse and search saved cards in a dedicated library view.
  - Cards support parent-child lineage tracking for provenance.
- **Message Cards**: Save any chat message as a card for later reference.
  - Automatically extracts and stores generated images from AI responses.
  - Displays image thumbnails in sidebar for visual identification.
  - Supports drag-and-drop to reuse as attachments in new prompts.
- **Config Cards**: Save and reuse prompt templates and settings.
  - Negative prompts for Imagen can be saved and quickly recalled.
  - Full Imagen option templates (aspect ratio, resolution, etc.) can be saved and applied.
- **Media Sidebar**: Thread-contextual media panel showing all media in conversation.
  - Displays video thumbnails, extracted frames, audio tracks, and saved cards.
  - Drag-and-drop from sidebar to input for quick attachment.
  - Click to navigate to card details.

### 2.7 Imagen Integration (Image Generation)
- Support for Google Imagen models via Gemini API (e.g., Nano Banana Pro).
- **Image Options Panel**: Collapsible UI for configuring image generation parameters.
  - Aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
  - Resolution/output quality settings
  - Number of images to generate
  - Person generation safety controls
  - Negative prompt input with save/recall functionality
  - Style reference support (planned)
- Generated images embedded in chat responses and saveable as cards.
- Reference image support: attach images from library or sidebar to influence generation.

### 2.8 Menu Locations (Sidebar Ledges)
- The left sidebar navigation acts as a set of **Locations** (one per menu item).
- Each Location exposes a subtle, hand-card-sized **target pad** used to attach cards.
  - The affordance should be present but not visually intrusive.
  - The pad becomes visually prominent when a card is being targeted/dragged, or when occupied.
- Users can attach cards to Locations from both:
  - Overlay cards spawned from the Hand
  - Overlay cards spawned from the Card Library
- Location stacks:
  - Each Location maintains a stack of attached cards (top-down priority).
  - UI displays the top card and a stack count.
  - Hovering the Location reveals the full stack.
- Visual language:
  - While a Location is occupied, the docked card representation uses a **steady red glow**.

Planned future work:
- Persist each Location as a Hypercore-backed append-only ledger of placements.
- Append to each card’s own Hypercore journal recording placements and outcomes.
- Allow Location behavior/effects to be influenced by stacked card attributes/skills/canon, evaluated in priority order.

### 2.9 3D Nexus (Card Constellation Viewer)
- **Top-level route** (`/nexus`) accessible from the sidebar and deep-linkable from Chat, Wiki, and Card Library.
- **Two scope modes**:
  - **LOCAL**: Focused constellation showing the selected card at center with parent, children, siblings, and context cards arranged around it. Component nodes (images, videos, summaries) can be toggled on.
  - **GLOBAL**: Feed-style spiral layout that loads cards incrementally (paged) for scalability. Search filters loaded results immediately and continues to stream additional matches in the background.
- **Smooth camera navigation**: Click a card to focus and recenter; preset buttons (FOCUS, TOP, WIDE) for quick reorientation.
- **Distance-based label LOD**: Card labels hide when far from camera to reduce DOM pressure.
- **Deep linking**: Navigate to `/nexus?cardId=...` from anywhere; global Back button returns to previous context.
- **Keyboard shortcuts**: Arrow keys for lineage navigation, Escape to close, M to mute.

Phase 2 (Scalability & Performance):
- **Paged global feed loading**: The Nexus must not require reading the entire card-library log in the renderer.
- **Async streaming search**: Search should act as "filter loaded immediately" plus a background job that streams additional matching results over time.
- **Nexus settings**: Global render cap and page size must be configurable and persisted locally.
- **Seamless scope switching**: Switching between LOCAL and GLOBAL should show a themed loading overlay to avoid perceived UI freezes.
- **Richer card faces**: Cards should display more than title (where available): lore, skills, and truth analysis (facts/desires) with LOD-based truncation.

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
