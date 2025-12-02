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

## Entry 12 – Pet Forge Module Behavior Implementation
**Prompt:** "Make sure the 'Module' behavior is wired up for forged pets. I set an animation for 'on-click' which doesn't seem to work. Validate that the 'random/probability' module selection works as well."

**Summary of actions:**
- **Analysis:**
    - Reviewed Pet Forge UI design vs actual implementation.
    - Identified gap: Module configurations (trigger, probability, triggerValue) were designed in UI but not persisted or used at runtime.

- **Type System (`src/components/pets/types.ts`):**
    - Added `PetState.Special` for triggered animations.
    - Created `ModuleConfig` interface with `id`, `assetUrl`, `trigger`, `probability`, and `triggerValue` fields.
    - Added `modules` field to `PetConfig` to store module configurations.
    - Added `id` field to `PetInstance` for convenience.

- **PetController (`src/components/pets/PetController.ts`):**
    - Implemented `triggerClick(petId)` – finds click-triggered modules and plays their animation.
    - Implemented `triggerCommand(petId, command)` – supports future chat command triggers.
    - Implemented `checkRandomTriggers()` – periodically checks for random-triggered modules and fires them based on configured probability (only when pet is idle).

- **Pet Component (`src/components/pets/Pet.tsx`):**
    - Added `onPetClick` prop to enable click handling.
    - Added support for `PetState.Special` with module asset resolution.
    - Added visual indicator (pulsing blue dot) for pets with click-triggered modules.
    - Changed cursor to pointer for interactive pets.

- **Pets Page (`src/pages/Pets.tsx`):**
    - Updated `handleForgeSave` to build full `modules` map with trigger configurations from Pet Forge.
    - Added `handlePetClick` handler that calls `controller.triggerClick()` and forces re-render.
    - Wired `onPetClick` prop to all rendered Pet components.

**Tags:** #feature #pet-forge #bugfix #modules #animation
**Est. Avg. Human Dev Time:** 1.5 hours

## Entry 13 – Background Removal for Sprite Sheet GIFs
**Prompt:** "I need a way to remove the background from the sprite sheet before animating the gif and/or removing the background from the gif somehow. Research a way to add this capability into the gif-maker workflow and implement."

**Summary of actions:**
- **Research:**
    - Evaluated options: manual color keying, external APIs (remove.bg), and client-side AI solutions.
    - Selected `@imgly/background-removal` – open-source, runs entirely in-browser using ONNX models, no API costs, works offline.

- **Dependencies:**
    - Installed `@imgly/background-removal` npm package.

- **Utility (`src/utils/backgroundRemoval.ts`):**
    - Created `removeImageBackground()` – takes URL/Blob/File, returns transparent PNG blob.
    - Created `removeBackgroundFromElement()` – processes HTMLImageElement for canvas use.
    - Includes progress callbacks for UI feedback.

- **SpriteSheetConverter Updates (`src/components/SpriteSheetConverter.tsx`):**
    - Added "Remove Background" toggle in the UI controls panel.
    - Integrated AI background removal with progress indicators.
    - Added checkerboard pattern visualization for transparency preview.
    - Updated GIF generation to preserve alpha channel.
    - Shows processed image with transparency in real-time.

- **CSS (`src/index.css`):**
    - Added `.checkerboard-bg` class for transparency visualization.
    - Added `.pixelated` class for crisp sprite rendering.

- **Workflow:**
    1. User generates sprite sheet with AI image generator (has solid background).
    2. User opens card in workspace, clicks "MAKE GIF".
    3. User enables "Remove Background" toggle – AI removes background.
    4. Sprite sheet preview shows transparency with checkerboard.
    5. User generates GIF – output has transparent background.
    6. GIF can be used in Pet Forge for pets that overlay on any background.

**Tags:** #feature #sprite-sheet #gif #background-removal #ai #transparency
**Est. Avg. Human Dev Time:** 2.0 hours

## Entry 14 – Google Veo Video Generation (Image-to-Video)
**Prompt:** "Read the current Google Gemini API documentation and figure out which models support Image to Video and then make sure we support those models and their specific integration requirements. Then make sure videos returned in chat can be saved and added to the card library as a video type card."

**Summary of actions:**
- **Research:**
    - Read official Gemini API docs for video generation at ai.google.dev/gemini-api/docs/video.
    - Identified 5 Veo models supporting image-to-video:
        - `veo-3.1-generate-preview` – 8s 720p/1080p with audio
        - `veo-3.1-fast-generate-preview` – Fast with audio
        - `veo-3.0-generate-001` – Veo 3 with audio
        - `veo-3.0-fast-generate-001` – Veo 3 Fast
        - `veo-2.0-generate-001` – Veo 2 (no audio)

- **Backend (`electron/main.ts`):**
    - Added `VEO_VIDEO_MODELS` array with model definitions (marked `isVideoModel: true`).
    - Updated `list-gemini-models` handler to include Veo models.
    - Created `generate-video-with-gemini` IPC handler:
        - Supports text-to-video and image-to-video.
        - Uses async polling (up to 5 min timeout).
        - Downloads video and saves to wormhole directory.
        - Broadcasts progress via `video-generation-progress` event.

- **Preload (`electron/preload.ts`):**
    - Exposed `generateVideoWithGemini` API.
    - Added `onVideoGenerationProgress` listener.

- **Frontend (`src/pages/Chat.tsx`):**
    - Extended `Message` interface with `video`, `isVideoGenerating`, `videoProgress` fields.
    - Extended `ModelInfo` interface with `isVideoModel` flag.
    - Updated `handleSend` to detect Veo models and route to video generation.
    - Added `createVideoCard` function using `wormholeIngestContent` for saving videos.
    - Added video player UI with "Save to Library" button.
    - Added video generation progress indicator.

- **Workflow:**
    1. User selects a Veo model from the Gemini model dropdown.
    2. User types a prompt (optionally attaches an image for image-to-video).
    3. Chat shows "Generating video..." with spinner.
    4. On completion, video player appears inline with save button.
    5. User clicks "Save to Lib" → Video saved as a video card.

**Tags:** #feature #veo #video-generation #gemini #image-to-video #card-library
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 15 – Veo Video Options Panel (Start/End Frame, Loop, Advanced Parameters)
**Prompt:** "With the Veo APIs, is there anything specific with start or end frame images? Can you modify the forms to support start/end frame as a mode if there is a specific constraint... OR if there is an option to automatically ask for a looping video in the API, etc. Match the form input best practices for video requests for Veo."

**Summary of actions:**
- **Research:**
    - Read Gemini API docs thoroughly for Veo parameters.
    - Discovered key API features:
        - `image` - Start frame image
        - `lastFrame` - End frame for interpolation (Veo 3.1 only)
        - `aspectRatio` - "16:9" or "9:16"
        - `resolution` - "720p" or "1080p" (1080p Veo 3.1 only)
        - `durationSeconds` - "4", "5", "6", or "8" (model-dependent)
        - `negativePrompt` - Things to avoid
        - `personGeneration` - "allow_all", "allow_adult", "dont_allow"
    - No explicit looping API, but using same image for start+end creates loop effect.

- **New Component (`src/components/VeoOptionsPanel.tsx`):**
    - Created dedicated options panel for Veo video configuration.
    - **Image Mode Selector** with 4 modes:
        - Text Only - No image input
        - Start Frame - Single image as first frame
        - Start + End Frame - Interpolation between two images (Veo 3.1 only)
        - Loop - Same image for start/end to create seamless loop
    - **Frame Upload** areas with preview and remove buttons.
    - **Aspect Ratio** dropdown (16:9 Landscape, 9:16 Portrait).
    - **Resolution** dropdown (720p, 1080p) with model-based availability.
    - **Duration** dropdown with model-specific options.
    - **Person Generation** dropdown for content control.
    - **Negative Prompt** text input for things to avoid.
    - Model capability detection for conditional UI.

- **Backend (`electron/main.ts`):**
    - Extended `generate-video-with-gemini` handler with new parameters:
        - `lastFrameBase64`, `lastFrameMimeType` for end frame
        - `resolution`, `negativePrompt`, `personGeneration`
        - `loopMode` boolean for loop effect
    - Properly structured `config` object per Veo API spec.

- **Frontend (`src/pages/Chat.tsx`):**
    - Added `veoOptions` and `showVeoPanel` state.
    - Added `isVeoModelSelected` helper.
    - Renders collapsible VeoOptionsPanel when Veo model selected.
    - Updated `handleSend` to pass all options in video payload.

- **Workflow:**
    1. User selects a Veo model → Options bar appears.
    2. User clicks "Configure Video Options" → Panel expands.
    3. User selects image mode (Text/Start/Start+End/Loop).
    4. User uploads frames as needed.
    5. User configures aspect ratio, resolution, duration, etc.
    6. User types prompt and sends → Video generates with all options.

**Tags:** #feature #veo #video-generation #ui #options-panel #interpolation #loop
**Est. Avg. Human Dev Time:** 1.5 hours

## Entry 16 – Card Library Integration for Veo Frame Selection
**Prompt:** "Can you think hard on a feature update to connect the card library to the VEO video options form? I'd like the user to be able to see/select cards with images and very easily with minimal friction selection them for the start frame in ADDITION to a new upload/ingest."

**Summary of actions:**
- **New Component (`src/components/ImageCardPicker.tsx`):**
    - Full-featured image picker modal with two tabs:
        - **Card Library tab**: Loads all image cards from the card library
        - **Upload tab**: Standard file upload for new images
    - Features:
        - Grid view of image thumbnails (4 columns)
        - Search/filter by card name
        - Single-click to select, double-click to use immediately
        - Preview of selected image with name
        - Auto-converts file:// URLs and data URLs to base64
        - Loading spinner while fetching library
        - Empty state with prompt to upload
    - Reads from `card-library` hypercore
    - Handles various image storage formats (dataUrl, localPath, wormhole)

- **Updated `VeoOptionsPanel.tsx`:**
    - Added `showImagePicker` state for modal control
    - Added `startFrameName` and `endFrameName` to VeoOptions interface
    - Replaced file upload inputs with "Select from Library" buttons
    - Frame preview now shows hover overlay with swap/remove buttons
    - Shows image name at bottom of preview
    - Clicking swap opens ImageCardPicker to change selection
    - Integrated picker for both start and end frames

- **UX Flow:**
    1. User selects image mode (Start Frame, Start+End, Loop)
    2. User clicks "Select from Library" button
    3. Modal opens showing all image cards in grid
    4. User can search to filter, or switch to Upload tab
    5. User clicks image to select, clicks "Use This Image"
    6. Frame preview appears with name and swap/remove controls
    7. User can easily swap to a different image without losing other settings

- **Benefits:**
    - Zero friction for existing library images
    - No need to re-upload or locate files
    - Consistent with PetForge asset selection pattern
    - Upload option still available for new images
    - Visual feedback with previews and names

**Tags:** #feature #veo #card-library #image-picker #ux #modal
**Est. Avg. Human Dev Time:** 1.5 hours
