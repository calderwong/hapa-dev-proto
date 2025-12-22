# Development Journal

## Entry 83 – Rotate dev journal
**Prompt:** "can you stop checking just finish the tasks?"

**Summary of actions:**
- Archived the previous `dev_journal.md` to `dev_journal-0.md`.
- Created a fresh `dev_journal.md` and continued entry numbering.

**Tags:** #docs #maintenance
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 84 – Thor's Hamma: tolerate malformed AI JSON output
**Prompt:** "Can you re-evaluate and fix the Thor's Hamma feature to be able to deal with anything like this? I keep getting this error back"

**Summary of actions:**
- Traced the failure to `electron/thors-hamma.ts` where Thor/Leo AI responses were parsed via `JSON.parse(text)`.
- Implemented a robust JSON extraction/repair parser to handle common model-output variants:
  - `json { ... }` / `JSON { ... }` prefixes.
  - Markdown code fences.
  - Trailing commas and JSONC-style comments.
  - Extra surrounding text by extracting the first full JSON object/array.
- Improved error logging to include a compact sanitized snippet of the model output for debugging.

**Files modified/created:**
- Modified: `electron/thors-hamma.ts`

**Tags:** #bugfix #thor #ai
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 85 – Hell Week Pipeline: prevent duplicate card outputs
**Prompt:** "can you take a look at the hell week pipepine? The last set of cards all came out with the exact same skills/lore/text, but different names"

**Summary of actions:**
- Traced the issue to the Thor chunk-processing loop in `electron/pipeline.ts` where the model could repeatedly emit the same card structure across chunks.
- Strengthened chunk specificity by:
  - Placing the chunk up-front and marking it as PRIMARY.
  - Passing a compact Leo context (instead of dumping full Leo output).
  - Including a short digest of recent prior cards to explicitly discourage repetition.
- Added a duplicate-content guard: computes a lore+skills fingerprint and retries once if Thor outputs a card that matches a previously seen fingerprint.

**Files modified/created:**
- Modified: `electron/pipeline.ts`

**Tags:** #bugfix #pipeline #hellweek
**Est. Avg. Human Dev Time:** 60 minutes

## Entry 86 – Nexus Phase 2: paging, async search, seamless scope switch, richer card faces
**Prompt:** "Can you work on performance/load-times for the 3D nexus feature now that's its MVP?"

**Summary of actions:**
- Authored a Phase 2 design doc defining scalable Nexus loading and perceived-performance goals.
- Implemented Nexus Phase 2 Electron IPC “pipe” APIs:
  - Paged/de-duped global feed loading (`nexus:index-page`).
  - Batched latest-record hydration (`nexus:card-latest-batch`).
  - Persisted Nexus settings (`nexus:get-settings`/`nexus:save-settings`) with defaults (cap=1000, pageSize=120).
  - Async streaming search jobs (`nexus:search-start`/`nexus:search-cancel`) that emit incremental results via `nexus:search-update`.
- Updated renderer Nexus page to stop doing full-library `p2pRead('card-library')` and instead:
  - Load the index in pages.
  - Hydrate missing thumbnails/records in batches.
  - Perform search as “filter loaded immediately + async stream more matches”.
- Added perceived-performance improvements in the 3D viewer:
  - Scope switch overlay and deferred scope toggle (`requestAnimationFrame`) to avoid UI-freeze perception.
  - UI affordances for searching and loading more global results.
- Began upgrading the 3D card face overlay to show more content (skills, lore, facts, desires) with LOD.

**Files modified/created:**
- Created: `Nexus_Phase_2_Design_Doc.md`
- Modified: `electron/main.ts`
- Modified: `electron/preload.ts`
- Modified: `src/pages/Nexus.tsx`
- Modified: `src/components/Card3DViewer/Card3DViewer.tsx`
- Modified: `src/components/Card3DViewer/Card3D.tsx`
- Modified: `src/types.d.ts`

**Tags:** #feature #nexus #performance
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 87 – Boot splash: play .vibes videos while app loads (show app only when ready)
**Prompt:** "Ok great, can you take a look at the initial statup/bootup process as well? It's also running very slow and I'd like you to add a \"loading screen\" that plays videos in the \".vibes\" folder immediately on-open, and then load the app behind the videos, only showing the app once it's ready"

**Summary of actions:**
- Implemented a dedicated splash `BrowserWindow` that loads a `data:` HTML page to loop videos found in `.vibes`.
- Created the main app window hidden (`show: false`) and only revealed it after a two-phase gate:
  - Electron `ready-to-show` for the main window.
  - Renderer signal `boot:renderer-ready`.
- Added a preload bridge method (`bootRendererReady`) and invoked it from the renderer entrypoint so the main process can safely swap from splash to app.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `electron/preload.ts`
- Modified: `src/main.tsx`
- Modified: `src/types.d.ts`

**Tags:** #feature #boot #performance
**Est. Avg. Human Dev Time:** 75 minutes

## Entry 88 – Card Library: incremental paging + batched hydration (Phase 2 style)
**Prompt:** "(and look for optimization opportunities on load as well, same for retrieving cards from the Card Library feature--I think that needs to move to what you did for the 3d nexus and load cards as they are found versus trying to load them all at once)."

**Summary of actions:**
- Refactored Card Library loading to prefer Phase 2 IPC APIs:
  - Paged index loading via `nexus:index-page`.
  - Batched latest-record hydration via `nexus:card-latest-batch`.
- Updated the UI to progressively update the cards list as pages arrive, avoiding full-core blocking reads.
- Fixed `VirtualCardGrid` to handle append-style updates so newly loaded pages are eligible for reveal.

**Files modified/created:**
- Modified: `src/pages/CardLibrary.tsx`
- Modified: `src/components/cards/VirtualCardGrid.tsx`

**Tags:** #feature #card_library #performance
**Est. Avg. Human Dev Time:** 90 minutes

## Entry 89 – Boot hot path: defer heavy initialization until after windows exist
**Prompt:** "ready"

**Summary of actions:**
- Reordered the Electron boot sequence so the splash and hidden main window are created first.
- Deferred heavier initialization (P2P init, persistence init, llama auto-start) to the next tick to reduce time-to-first-paint on the splash.

**Files modified/created:**
- Modified: `electron/main.ts`

**Tags:** #performance #boot
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 90 – Overlay Formation HUD redesign + formation centering reliability
**Prompt:** "OK can you focus on re-designing and cleaning up the top nav now? ... formation feature seems to be a little broken ..." + "remove the target/anchor functionality for now"

**Summary of actions:**
- Authored a design doc for a compact, glass-plane Formation HUD and a more deterministic formation engine (`Top_Nav_Formation_Redesign.md`).
- Temporarily removed the portal target/anchor UX (toggle + target picker overlay) to reduce confusion and clunkiness.
- Fixed formation drift/centering issues by normalizing overlay card coordinates to absolute viewport space (persisting `initialRect.left/top` as 0 and folding offsets into `tx/ty`).
- Made formation anchoring deterministic (viewport-based anchor + stable Y) and added `RECENTER` + resize recompute support.
- Extracted the top bar into a dedicated component (`src/components/overlay/FormationHud.tsx`) for a cleaner, more compact glass UI.

**Files modified/created:**
- Created: `Top_Nav_Formation_Redesign.md`
- Created: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/contexts/DragCanvasContext.tsx`

**Tags:** #feature #ui #overlay #bugfix
**Est. Avg. Human Dev Time:** 2 hours

## Entry 91 – Formation HUD polish: tighter glass UI + recenter pulse
**Prompt:** "proceed"

**Summary of actions:**
- Polished the compact glass Formation HUD: tightened spacing/typography, added subtle active-mode glow, and emphasized `RECENTER`.
- Added a brief recenter pulse/reticle indicator at the formation anchor point when `RECENTER` is pressed.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/DragCanvas.tsx`

**Tags:** #ui #overlay #polish
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 92 – Hand card click behavior + attached Card Details sub-menu redesign
**Prompt:** "Ok can you remove the functionality that makes it so when you click a hand card, it flies to the bottom and disappears... Create a doc, plan out the change, review, and implement."

**Summary of actions:**
- Identified the root cause of the "click → fly away/disappear" conflict: hand cards were spawning overlay `FloatingCard`s immediately on pointer down; `FloatingCard` treats short gestures as a click and runs a portal animation that removes the overlay.
- Updated `useGlobalDrag` so overlay spawn only occurs after a small drag threshold; a plain click now invokes `onClick` without spawning an overlay.
- Authored a design doc for an attached, glass-plane Card Details sub-menu anchored next to the clicked hand card, including the required control surface (return, formation toggle, pose, camera/reticle + zoom).

**Files modified/created:**
- Modified: `src/hooks/useGlobalDrag.ts`
- Created: `Card_Details_Attached_Submenu_Redesign.md`

**Tags:** #feature #ui #hand #cards
**Est. Avg. Human Dev Time:** 2 hours

## Entry 93 – Attached Card Details panel + pose/formation controls (MVP)
**Prompt:** "1. let's go with small confirm for now.  2. A, 3. Any card that is above it's \"home\" or starting spot in the canvas should have tilt, 4. A."

**Summary of actions:**
- Implemented an attached glass-plane Card Details sub-menu anchored next to the clicked hand card.
- Replaced the old top-right overlay `HandCardView` usage in `CardHand` with the new attached submenu.
- Added per-card pose state (tiltX/tiltY/rotZ/zoom/cameraMode) to `DragCanvasContext` and persisted it.
- Wired submenu actions:
  - Return to hand (remove overlay clone if present)
  - Return to library (small confirm in-panel; removes hand card and overlay clone)
  - Enter/leave formation using a clone overlay item (hand remains visible)
  - Pose sliders + local zoom
- Implemented the auto-tilt rule: overlay cards lifted above their home position get a subtle additional forward tilt.
- Camera mode keeps the targeting reticle active for that overlay card.

**Files modified/created:**
- Created: `src/components/cards/AttachedHandCardDetails.tsx`
- Modified: `src/components/cards/CardHand.tsx`
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/contexts/DragCanvasContext.tsx`

**Tags:** #feature #ui #hand #overlay
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 94 – 🧹 Housecleaning: reduce renderer memory growth (Veo + attachments)
**Prompt:** "house clean and then phamiliar work"

**Summary of actions:**
- Stopped storing Veo `videoBase64` inside Chat message state (kept `localPath` metadata only).
- Updated Chat attachment rendering to prefer `dataUrl` over `blob:` object URLs.
- Added object URL cleanup (`URL.revokeObjectURL`) for attachment previews on remove/send/unmount to prevent accumulation.

**Files modified/created:**
- Modified: `src/pages/Chat.tsx`
- Modified: `src/components/ChatInput.tsx`

**Tags:** #bugfix #performance #memory #housecleaning
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 95 – Phamiliar: wire active pet capabilities into Chat + editor access
**Prompt:** "house clean and then phamiliar work"

**Summary of actions:**
- Added active Phamiliar selection in the header Pet Portal (click to select, drop auto-select) and persisted selection to localStorage.
- Wired Chat execution to prefer the active pet’s `activeCapabilityId` (provider/model + system/append prompts) and emit agent-state change events scoped to that pet.
- Added a Sanctuary entrypoint to edit a pet’s capabilities via right-click/context menu, persisting updates to the pet Hypercore and card-library index.

**Files modified/created:**
- Modified: `src/components/pets/PetPortal.tsx`
- Modified: `src/pages/Chat.tsx`
- Modified: `src/pages/Pets.tsx`
- Modified: `src/components/pets/Pet.tsx`

**Tags:** #feature #phamiliar #pets #chat
**Est. Avg. Human Dev Time:** 90 minutes

## Entry 96 – UX: card click stays put + pet submenu opens Chat
**Prompt:** "can you make it so the card does NOT go anywhere when click, but ONLY open the sub-menu next to it? ... for the pets ... there is no chat menu"

**Summary of actions:**
- Changed overlay card click behavior so a click only selects the card (opens its adjacent controls) and no longer portal-transports/removes it.
- Added a small pet action submenu in the header Pet Portal that opens next to the selected pet and includes a Chat button.
- Synced Chat header provider/model selectors to the active pet capability on `active-phamiliar-change` so the selection is visible immediately.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/pets/PetPortal.tsx`
- Modified: `src/pages/Chat.tsx`

**Tags:** #ux #phamiliar #cards #chat
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 97 – Tests: Phamiliar capability provider mapping
**Prompt:** "continue"

**Summary of actions:**
- Added a tiny shared mapping helper for Phamiliar capability -> chat provider/model selection.
- Added a minimal unit test using Node's built-in test runner (`node:test`).
- Wired `npm test` to run tests under `tests/`.

**Files modified/created:**
- Created: `src/utils/phamiliarChat.mjs`
- Modified: `src/pages/Chat.tsx`
- Created: `tests/phamiliarChat.test.mjs`
- Modified: `package.json`
- Modified: `README.md`
- Modified: `Product_Requirements_Document.md`

**Tags:** #tests #phamiliar #chat
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 98 – UX: pet-tuned Chat header (capability-driven)
**Prompt:** "Ok the chat window is opening, but it's taking me to a vanilla chat interface, not one tuned directly for the pet and the models it has access to"

**Summary of actions:**
- Ensured the Pet Portal "Chat" action re-selects the clicked pet before navigating, so `active-phamiliar-change` always has a `coreName`.
- Updated Chat to always pick a capability (fallback to first capability when `activeCapabilityId` is missing) and store the pet's capability list in state.
- Added a "Phamiliar Capability" selector in the Chat header; selecting a capability automatically sets provider/model.
- Locked the generic provider/model selectors while a Phamiliar is active to avoid mismatches between UI and capability.

**Files modified/created:**
- Modified: `src/components/pets/PetPortal.tsx`
- Modified: `src/pages/Chat.tsx`

**Tags:** #ux #phamiliar #chat
**Est. Avg. Human Dev Time:** 35 minutes

## Entry 99 – Bugfix: restore pet drops into Sanctuary
**Prompt:** "not able to put pets in the sanctuary now"

**Summary of actions:**
- Fixed Sanctuary drop handler to accept valid pet card drag payloads (including pet cards dragged from the Card Library).
- Updated header Pet Portal drag-out behavior so a successful move removes the pet from the portal UI state.

**Files modified/created:**
- Modified: `src/pages/Pets.tsx`
- Modified: `src/components/pets/PetPortal.tsx`

**Tags:** #bugfix #pets #drag_drop
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 100 – Feature: cockpit Formation HUD + attached overlay Card Details
**Prompt:** "(1) can you make the top nav that controls the card formations (a.) a circle/square/rectangle instead of a straight line--something like you would see in a futuristic cockpit, (b.) make it \"draggable\" and able to move on the z-axis like a scroll with the other cards, (c.) for the \"Card Details\" menu that opens when you click hovering cards, can you \"attach\" that menu to the \"card object\" so if you move the card, the menu goes with it.  Also make it more compact AND add more data from the card (particularly skills and lore and desires)."

**Summary of actions:**
- Added new overlay formation modes for cockpit-style layouts (`square`, `rect`) and implemented the target positioning math.
- Redesigned the Formation HUD into a cockpit-style control surface with quick shape buttons (ring/square/rect), made it draggable, and added a scroll-wheel depth control with local persistence.
- Implemented an attached overlay card details panel that anchors to the selected floating card and follows it while dragging; made it compact and added richer metadata (lore/skills/desires) with best-effort record hydration.

**Files modified/created:**
- Modified: `src/contexts/DragCanvasContext.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Created: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/cards/AttachedHandCardDetails.tsx`

**Tags:** #feature #ux #drag_canvas #overlay
**Est. Avg. Human Dev Time:** 90 minutes

## Entry 101 – Card Library: remove cap, true infinite paging, windowed render, expanded Recover
**Prompt:** "I think one of the refactoring changes make a hard 1,000 card cap in the Library... (wants) load lazily one by one going top down, and 3 scroll depths... review the recover feature and ensure it will retrieve the other cards"

**Summary of actions:**
- Removed the `globalRenderCap`-based while-loop behavior in `CardLibrary` and replaced it with stateful infinite paging (`cursor`, `hasMore`, `totalLength`) driven by a near-bottom trigger.
- Updated `VirtualCardGrid` to buffer rendering by ~`bufferScreens` viewport heights and request more index pages as needed.
- Ensured progressive grid still supports native `dataTransfer` drag payloads for cross-component drops (pets, etc.) by wiring `onDragStart` through the grid card wrapper.
- Expanded the Recover pipeline to scan storage for card-like hypercores (not just Hell Week) and index missing cards into `card-library`.

**Files modified/created:**
- Modified: `src/pages/CardLibrary.tsx`
- Modified: `src/components/cards/VirtualCardGrid.tsx`
- Modified: `src/components/cards/DraggableGridCard.tsx`
- Modified: `src/hooks/useGlobalDrag.ts`
- Modified: `electron/pipeline.ts`

**Tags:** #feature #bugfix #card_library #performance
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 102 – Hypercore + SQLite storage audit reference doc
**Prompt:** "Can you create a detailed reference document on how storage is currently handled with hypercores + the DB, covering the schema, how data is created, how it is stored, and how it is destroyed. Do a complete audit to make sure you get every process."

**Summary of actions:**
- Audited Hypercore storage configuration and path resolution (`HAPA_STORAGE_DIR`, `userData/storage`, legacy `./storage`) and identified the authoritative entrypoints in `electron/p2p.ts` and `electron/main.ts`.
- Audited the SQLite projection DB implementation and schema in `electron/SqliteAdapter.ts` and the singleton wrapper in `electron/persistence.ts`.
- Enumerated the major Hypercore writers/readers across the app (Wormhole ingest + processing, Card Library generation flows, Chat message/image cards, pets, avatars, Revid media imports, Hell Week pipeline + recovery), and documented record shapes used in practice.
- Documented current "destroy" semantics (append-only logical updates/unlinking; no physical core deletion implemented) and DB corruption recovery behavior (rename-and-recreate).

**Files modified/created:**
- Created: `docs/Hypercore_Storage_and_DB_Reference.md`

**Tags:** #docs #storage #hypercore #sqlite #audit
**Est. Avg. Human Dev Time:** 2.5 hours

## Entry 103 – Enable SQLite projection init + add card deletion flow
**Prompt:** "do both"

**Summary of actions:**
- Wired the SQLite projection DB initialization to Electron startup by calling `initPersistence()` in the deferred init block (so persistence IPC queries become live without requiring any other module to initialize it).
- Implemented `CARD_DELETED` support end-to-end:
  - Added `CardDeletedPayload` type and `emitCardDeleted(...)` helper in `electron/persistence.ts`.
  - Added `CARD_DELETED` handling in `electron/SqliteAdapter.ts` to remove `cards` and `card_fts` rows for deleted IDs.
- Added a Hypercore-safe card deletion IPC endpoint:
  - `ipcMain.handle('card:delete', ...)` appends a tombstone record to the card core and a `deleted: true` index entry to `card-library`.
  - Optional asset cleanup (`deleteAssets: true`) only unlinks files that resolve under `app.getPath('userData')`.
- Updated Nexus index/search paging to treat `deleted: true` index entries as authoritative removals (filter them out in `nexus:index-page` and `nexus:search-start`).
- Exposed `cardDelete(...)` on `window.electronAPI` via `electron/preload.ts` and updated typings in `src/types.d.ts`.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `electron/preload.ts`
- Modified: `electron/persistence.ts`
- Modified: `electron/persistence-types.ts`
- Modified: `electron/SqliteAdapter.ts`
- Modified: `src/types.d.ts`

**Tags:** #feature #storage #sqlite #hypercore
**Est. Avg. Human Dev Time:** 2 hours

## Entry 104 – Card Recovery + Card Library infinite scroll fix
**Prompt:** "ok the recovery process completed, but now im down to 120 cards, or the UI is calculating wrong... can you look at the actual data to assess what's there and then determine why I'm not getting all the cards"

**Summary of actions:**
- Confirmed the underlying storage had thousands of hypercores but the `card-library` index was incomplete, leading the UI to show only ~`globalPageSize` (120) or a couple pages.
- Updated the Recovery routine in `electron/pipeline.ts` to index all card-like cores (e.g. `card-*`, `msg-*`, `avatar-*`, `hell-week-card-*`) while skipping known non-card cores.
- Fixed Card Library progressive loading in `src/components/cards/VirtualCardGrid.tsx` by resetting the `requestMore` lock when fetch completes / `cards.length` increases so paging can continue beyond the first couple pages.

**Files modified/created:**
- Modified: `electron/pipeline.ts`
- Modified: `src/components/cards/VirtualCardGrid.tsx`

**Tags:** #bugfix #recovery #card_library #pagination
**Est. Avg. Human Dev Time:** 90 minutes

## Entry 105 – Bugfix: prevent RocksDB LOCK contention (single-instance app)
**Prompt:** "Both please"

**Summary of actions:**
- Identified the error as a RocksDB `db/LOCK` contention symptom (most often caused by multiple Electron instances opening the same storage).
- Added `app.requestSingleInstanceLock()` to ensure only one Hapa app instance can run at a time; second launches focus the existing window.
- Audited Hypercore storage selection (`electron/main.ts` + `electron/p2p.ts`) and ensured we do not accidentally switch storage directories and “hide” existing cards.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `dev_journal.md`

**Tags:** #bugfix #storage #electron
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 106 – 🧹 Housecleaning: open-task triage + restore type integrity
**Prompt:** "house clean and pick up any open tasks"

**Summary of actions:**
- Verified required repo scaffolding exists (e.g. `/APPLES`, `README.md`, `Product_Requirements_Document.md`, `LICENSE`, `dev_journal.md`).
- Read and followed `docs/🧹housecleaning_protocol_ALWAYS_READ.md`.
- Inventory pass for “open tasks” across docs and code (TODO/FIXME/HACK + priority/handoff plans).
- Found `src/types.d.ts` had duplicated/corrupted declarations (duplicate Wormhole type blocks + duplicate `ElectronAPI` + stray `RevidMediaItem` fields inside `ElectronAPI`).
- Repaired `src/types.d.ts` to a single coherent set of types and aligned `ElectronAPI` with `electron/preload.ts` (added missing AIMLAPI methods and wormhole/p2p signatures).

**Files modified/created:**
- Modified: `src/types.d.ts`
- Modified: `dev_journal.md`

**Tags:** #maintenance #housecleaning #types
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 107 – Stress Test: headless memory harness (50 images / 20 videos)
**Prompt:** "1, then 2, 3, then 4 in priority"

**Summary of actions:**
- Located the production image/video generation IPC handlers in `electron/main.ts` (`generate-image-for-card`, `create-loop-video-for-image`, `generate-video-with-gemini`).
- Added a gated **memory stress test harness** that:
  - Runs **50 image generations** + **20 loop-video generations** sequentially.
  - Logs memory checkpoints (RSS/heap/external) before/after each iteration.
  - Writes a JSONL report to `temp/memory-stress-<timestamp>.jsonl`.
- Added a **headless mode** that loads a minimal `data:` page (still using preload) so stress testing can run without Vite.
- Added npm script `stress:memory` to run the harness.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `package.json`
- Modified: `dev_journal.md`

**Tags:** #bugfix #performance #memory #tests
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 108 – Feature: CardWorkspace save persists to Hypercore
**Prompt:** "continue"

**Summary of actions:**
- Implemented real CardWorkspace save persistence in the renderer.
- `CardLibrary.tsx`:
  - Replaced placeholder `handleWorkspaceSave` with: `p2pRead(coreName)` -> detect latest record shape (`type: 'card-state'` vs `type: 'card'` vs raw) -> append updated record with new text -> append updated `type: 'card-index'` entry to `card-library` -> refresh workspace card record and reload grid.
- `Forge.tsx`:
  - Hardened `handleSaveCardContent` similarly (supports `card-state`), and also appends an updated `card-index` record to `card-library` so changes propagate.

**Files modified/created:**
- Modified: `src/pages/CardLibrary.tsx`
- Modified: `src/pages/Forge.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #p2p #hypercore #cards
**Est. Avg. Human Dev Time:** 35 minutes

## Entry 109 – Bugfix: Formation HUD lost/off-screen recovery + in-bounds safety
**Prompt:** "So I accidently dragged the cockpit/menu/formation control off somewhere and can't get it back. Can you make sure it stays inbounds and reset its position?" / "still don't see it... I think it went \"down\" and got stuck"

**Summary of actions:**
- Diagnosed Formation HUD becoming unrecoverable when dragged off-screen and/or effectively disappearing via 3D `translateZ` persistence.
- `FormationHud.tsx`:
  - Hardened persisted HUD position loading by rejecting non-finite values.
  - Clamped HUD position using `getBoundingClientRect()` (actual HUD size) so it stays in viewport bounds.
  - Added a top inset so the HUD can’t hide under the top status/chrome area.
  - Added a `HUD RESET` button and a window event listener (`hapa.overlayHud.reset`) to clear persisted HUD position/Z and restore defaults.
  - Removed `translateZ` from HUD transform (2D-only) to prevent “stuck down/behind camera” disappearance.
  - Added a one-time post-mount rescue: if the HUD rect is fully off-screen, auto-dispatch reset.
  - Raised HUD z-index to max to avoid being covered by other portal layers.
- `DragCanvas.tsx`:
  - Ensured the HUD renders even when there are 0 overlay items (so it can always be recovered).
  - Added `Ctrl+Shift+R` global reset hotkey (works even while typing in inputs) plus `R` (when not focused in input).
  - Raised overlay layer z-index to avoid being hidden by other app UI.

**Verification:**
- User confirmed HUD is visible again.
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `APPLES/ROSES.md`
- Modified: `dev_journal.md`

**Tags:** #bugfix #ui #overlay #ux
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 110 – Overlay cockpit: event-driven details anchoring + depth consistency
**Prompt:** "yeah continue" / "continue"

**Summary of actions:**
- Replaced always-on details panel anchoring polling with event-driven measurement.
  - `FloatingCard.tsx`: emits throttled `hapa.overlayCard.moved` events during drag.
  - `DragCanvas.tsx`: emits `hapa.overlay.layoutTick` events on formation/layout changes.
  - `AttachedOverlayCardDetails.tsx`: measures on events + resize/scroll, with a short-lived follow loop during formation animations.
- Stabilized formation depth so hover does not collapse Z.
  - `DragCanvas.tsx`: made hover an additive lift on top of a stable baseline.
- Unified overlay card depth clamps across keyboard, details panel, wheel, and modifier-drag.
  - `DragCanvasContext.tsx`: added `OVERLAY_CARD_Z_MIN/MAX/STEP` constants.
  - Updated depth control call-sites to clamp consistently.
- Reduced Z “pop” when switching between free and formation by applying a consistent baseline Z in free mode and aligning modifier-drag depth composition.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/contexts/DragCanvasContext.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #performance
**Est. Avg. Human Dev Time:** 75 minutes

## Entry 111 – Overlay cockpit: keep attached details anchored during post-drop formation motion
**Prompt:** "continue"

**Summary of actions:**
- Ensured the attached details panel follows the selected card when a drag ends and the card animates back into its formation target.
  - `FloatingCard.tsx`: on drop (non-snap), dispatches `hapa.overlay.layoutTick` so `AttachedOverlayCardDetails` starts its short follow loop.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `dev_journal.md`

**Tags:** #bugfix #ui #overlay
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 112 – Overlay cockpit: richer metadata block in attached details panel
**Prompt:** "continue"

**Summary of actions:**
- Added a compact, lightweight Metadata section to the attached overlay card details panel.
  - Shows `id`, `cardId`, `mediaKind`, `createdAt`, `tier` when available.
  - Includes a few safe `metadata.*` fields (`title`, `source`, `url`, `tags`) without deep stringification.
  - Designed to avoid extra IPC reads and large layout/CPU overhead.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 113 – Overlay cockpit: centralized Z baseline + copyable metadata + record summary
**Prompt:** "all three please"

**Summary of actions:**
- Centralized the overlay Z baseline computation so formation + free mode depth use one shared definition.
  - `DragCanvasContext.tsx`: added `getOverlayZBaseline(mode, hover)` returning `{ baseZ, hoverLift, baselineZ }`.
  - `DragCanvas.tsx` and `FloatingCard.tsx`: switched to the helper to remove duplicated magic numbers.
- Added click-to-copy affordances for key metadata fields.
  - `AttachedOverlayCardDetails.tsx`: `cardId` and `url` rows are clickable to copy.
  - Includes a safe clipboard fallback (`execCommand('copy')`) and a small "Copied …" hint (no ToastProvider).
- Added a compact Record section that shows lightweight type/version-ish fields when available.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/contexts/DragCanvasContext.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 35 minutes

## Entry 114 – Overlay cockpit: pinned details + help cheat-sheet + smarter placement
**Prompt:** "all three"

**Summary of actions:**
- Added a pin mode to the attached card details panel.
  - Panel can be pinned/unpinned via `P` or the Pin button.
  - When pinned, outside-click no longer closes the panel, and Close/Esc clears both pin and selection.
  - Auto-unpins if the pinned card disappears.
- Added an in-panel shortcut cheat-sheet and button tooltips.
  - Toggle help with `?` (or Shift+/) and the `?` button.
  - Added `title` tooltips for Close/Pin/Help/Return/Camera.
- Improved panel placement logic to consider left/right/above/below with responsive width/height.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 128 – Overlay cockpit: anchor toggle + anchored/free/forced status
**Prompt:** "Anchoring/lock UX: add simple anchor toggle and show forced/free status clearly"

**Summary of actions:**
- Added a persisted anchored state for overlay cards.
  - `DragCanvasContext.tsx`: introduced `anchored: string[]` persisted into `hapa.overlayCards.v1`.
- Implemented a simple anchor toggle UX and status labeling.
  - `DragCanvas.tsx`: `A` toggles anchor for the selected card; anchored cards ignore formation targets (but can still be forced by HUD docking overrides).
  - `AttachedOverlayCardDetails.tsx`: added an Anchor button, status badge (`Docked L/R`, `Anchored`, `Formation`, `Free`), and shortcut hints now include `A`.
- Ensured docking and anchoring don’t fight.
  - Docking clears anchor consistently:
    - `FloatingCard.tsx` per-card `DL/DR` buttons clear anchor.
    - `AttachedOverlayCardDetails.tsx` Dock L/R clears anchor.
    - `FormationHud.tsx` DOCK L/R clears anchor.
- Updated on-screen discoverability.
  - `FormationHud.tsx`: telemetry/Tip strings mention `A`.

**Verification:**
- `npm run typecheck` pending.

**Files modified/created:**
- Modified: `src/contexts/DragCanvasContext.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 129 – Overlay cockpit: on-card status pill (forced/free discoverability)
**Prompt:** "continue"

**Summary of actions:**
- Improved discoverability of a card’s current state directly on the card.
  - `FloatingCard.tsx`: added a small status pill shown on hover/selection.
    - Labels: `Docked L/R`, `Anchored`, `Formation`, `Free`.
    - Uses the same visual language as the details panel badge.

**Verification:**
- `npm run typecheck` pending.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 147 – Overlay cockpit: Pinned section power-ups (meta+record)
**Prompt:** "2"

**Summary of actions:**
- Added cross-section pinning actions to the `Pinned` header in `AttachedOverlayCardDetails.tsx`:
  - `Pin Vis`: pins currently visible Metadata + Record rows.
  - `Pin Match`: pins all filter matches across Metadata + Record (requires a non-empty filter).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 8 minutes

## Entry 148 – Overlay cockpit: stabilize details panel during drag
**Prompt:** "yes continue"

**Summary of actions:**
- Improved selection stability while dragging overlay cards.
  - `FloatingCard.tsx`:
    - Emits `hapa.overlayCard.drag` custom events on drag start/end.
  - `AttachedOverlayCardDetails.tsx`:
    - Listens for `hapa.overlayCard.drag` and freezes the displayed item while any drag is active (unless the panel is explicitly pinned).
    - Ignores outside-click deselection while a drag is active to prevent flicker/close.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 149 – Overlay cockpit: Auto-pin-on-drag toggle + Dragging badge
**Prompt:** "both"

**Summary of actions:**
- Added two drag-related UX improvements in `AttachedOverlayCardDetails.tsx`:
  - `Auto` toggle (persisted via `hapa.overlayDetails.autoPinOnDrag.v1`) that temporarily pins the currently displayed card while dragging.
  - `Dragging…` badge shown in the header when the panel is frozen due to an active drag.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 150 – Overlay cockpit: refine drag-freeze (use dragged id) + help text
**Prompt:** "continue"

**Summary of actions:**
- Refined drag-freeze behavior to use the actual dragged card id from `hapa.overlayCard.drag` events.
  - Prevents edge cases where `selectedItemId` might differ from the dragged card.
- Updated shortcuts/help text to mention the `Auto` toggle.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 6 minutes

## Entry 151 – Overlay cockpit: Auto toggle hotkey + Dragging tooltip
**Prompt:** "1 and 2"

**Summary of actions:**
- Added quality-of-life controls in `AttachedOverlayCardDetails.tsx`:
  - `O` hotkey toggles the `Auto` (auto-pin while dragging) setting.
  - `Dragging…` badge now has a tooltip showing which card id the panel is frozen on.
- Fixed a transient JSX mismatch introduced during the edit (header badge markup), then verified build.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 152 – Overlay cockpit: show Auto state in header + ignore hotkey while dragging
**Prompt:** "both"

**Summary of actions:**
- Improved the visibility/safety of the Auto-pin-while-dragging feature in `AttachedOverlayCardDetails.tsx`:
  - Added an `Auto: On/Off` status chip in the header.
  - Made the `O` hotkey a no-op while a drag is active to avoid accidental toggles mid-drag.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ux
**Est. Avg. Human Dev Time:** 6 minutes

## Entry 153 – Overlay cockpit: Formation HUD keys hint includes Auto toggle
**Prompt:** "continue"

**Summary of actions:**
- Updated the Formation HUD “Keys” hint line to include the `O` shortcut (auto-pin while dragging), keeping HUD messaging consistent with the attached details panel.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ui #overlay #ux
**Est. Avg. Human Dev Time:** 2 minutes

## Entry 154 – Overlay cockpit: Formation HUD idle tip mentions Auto toggle
**Prompt:** "continue"

**Summary of actions:**
- Updated the Formation HUD idle “Tip” line (shown when no card is selected) to mention the `O` shortcut for Auto-pin while dragging.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ui #overlay #ux
**Est. Avg. Human Dev Time:** 2 minutes

## Entry 155 – Overlay cockpit: HUD Auto toggle synced with details panel
**Prompt:** "continue"

**Summary of actions:**
- Added an `AUTO` toggle button to the Formation HUD so Auto-pin-while-dragging can be controlled without opening the details panel.
- Implemented a small window-event bridge so the HUD and details panel stay in sync:
  - `hapa.overlayDetails.autoPinOnDrag.set` to set the value.
  - `hapa.overlayDetails.autoPinOnDrag.changed` to broadcast changes.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 156 – Overlay cockpit: global `O` hotkey toggles Auto (even without details panel)
**Prompt:** "yeah continue"

**Summary of actions:**
- Made `O` a global hotkey in `DragCanvas.tsx` to toggle Auto-pin-while-dragging via the shared event bridge.
  - Works even when the details panel is not mounted.
  - Ignores the hotkey while any overlay drag is active.
- Centralized persistence + broadcast behavior in `DragCanvas.tsx`:
  - Listens for `hapa.overlayDetails.autoPinOnDrag.set`, persists to localStorage, and emits `...changed` so the HUD stays synced.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/DragCanvas.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ux
**Est. Avg. Human Dev Time:** 12 minutes

## Entry 157 – Overlay cockpit: lock HUD AUTO toggle during drag
**Prompt:** "continue"

**Summary of actions:**
- Hardened Formation HUD behavior so the `AUTO` toggle cannot be changed mid-drag.
  - Formation HUD now tracks `hapa.overlayCard.drag` and disables the `AUTO` button while any drag is active.
  - Tooltip shows a “locked during drag” message when disabled.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 6 minutes

## Entry 158 – Overlay cockpit: make DragCanvas authoritative for Auto-pin state
**Prompt:** "continue"

**Summary of actions:**
- Consolidated Auto-pin-while-dragging state so there is a single source of truth:
  - `DragCanvas.tsx` is authoritative for persistence (`localStorage`) + broadcasting (`hapa.overlayDetails.autoPinOnDrag.changed`).
  - `AttachedOverlayCardDetails.tsx` no longer writes localStorage or emits `...changed`; it now dispatches `hapa.overlayDetails.autoPinOnDrag.set` on user toggles and listens to `...changed` for UI sync.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #refactor #overlay #ux
**Est. Avg. Human Dev Time:** 12 minutes

## Entry 159 – Overlay cockpit: show AUTO state in HUD readout
**Prompt:** "continue"

**Summary of actions:**
- Added an `AUTO: ON/OFF` indicator to the Formation HUD status readout line so the Auto-pin-while-dragging setting is visible at a glance.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ui #overlay #ux
**Est. Avg. Human Dev Time:** 4 minutes

## Entry 160 – Overlay cockpit: compact AUTO label is unambiguous
**Prompt:** "cotninue"

**Summary of actions:**
- Changed the Formation HUD compact label for the Auto toggle from `A` to `AU` to avoid confusion with the `A` anchor shortcut.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ui #overlay #ux
**Est. Avg. Human Dev Time:** 3 minutes

## Entry 161 – Overlay cockpit: HUD AUTO relies on authoritative broadcast
**Prompt:** "cotninue"

**Summary of actions:**
- Removed the Formation HUD `AUTO` toggle's local optimistic state update so it always reflects the authoritative `hapa.overlayDetails.autoPinOnDrag.changed` broadcast (emitted by `DragCanvas.tsx`).
- The HUD `AUTO` button now only dispatches `hapa.overlayDetails.autoPinOnDrag.set`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #refactor #overlay #ux
**Est. Avg. Human Dev Time:** 5 minutes

## Entry 162 – Overlay cockpit: show AUTO state even with no selection
**Prompt:** "continue"

**Summary of actions:**
- Updated Formation HUD readouts so `AUTO: ON/OFF` is visible even when no card is selected.
  - Full readout: adds `AUTO: ON/OFF` to the `SEL: none` branch.
  - Compact readout: adds `AU: ON/OFF` alongside `N:`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #ui #overlay #ux
**Est. Avg. Human Dev Time:** 4 minutes

## Entry 163 – Overlay cockpit: lock details Auto toggle during drag
**Prompt:** "continue"

**Summary of actions:**
- Disabled the `Auto` toggle button in `AttachedOverlayCardDetails.tsx` while an overlay drag is active to match HUD + hotkey behavior.
- Tooltip now shows “locked during drag” when disabled.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 4 minutes

## Entry 164 – Overlay cockpit: header Auto chip reflects drag lock
**Prompt:** "continue"

**Summary of actions:**
- Updated the details panel header `Auto: On/Off` chip to reflect the locked-during-drag behavior:
  - Tooltip shows “locked during drag” while an overlay drag is active.
  - Chip is subtly muted during drag.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 3 minutes

## Entry 165 – CardWorkspace: refresh parent after Save + wire Forge onUpdate
**Prompt:** "continue"

**Summary of actions:**
- Fixed a real refresh gap in `CardWorkspace.tsx`: saving content now triggers `onUpdate` (and emits a lightweight `hapa.cardWorkspace.updated` window event) so parent pages can refresh immediately.
- Wired the Forge modal `CardWorkspace` to pass an `onUpdate` callback that refreshes inventory and re-reads the latest card record for the inspector.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/CardWorkspace.tsx`
- Modified: `src/pages/Forge.tsx`
- Modified: `dev_journal.md`

**Tags:** #bugfix #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 134 – Overlay cockpit: details panel richness (coreName, Open URL, Raw JSON)
**Prompt:** "B"

**Summary of actions:**
- Made the attached details panel more useful for inspection and debugging.
  - `AttachedOverlayCardDetails.tsx`:
    - Added `coreName` to the metadata table (copyable).
    - Added `Open URL` action when metadata contains a safe http(s) URL.
      - If opening fails, falls back to copying the URL.
    - Added collapsible `Raw JSON` section with `Copy`.
      - Shows the resolved payload `{ id, coreName, data, record, metadata, fullRecord }` for quick inspection.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 142 – Overlay cockpit: expand provenance chips to content sections
**Prompt:** "1"

**Summary of actions:**
- Expanded provenance chips beyond rows into the main content sections in `AttachedOverlayCardDetails.tsx`:
  - Thumbnail: shows source chip overlay (local vs p2p vs both vs override).
  - Lore, Skills, Desires: section headers now show source chip.
- Improved provenance logic to treat empty local values (empty string / empty array / empty object) as “missing” when deciding `P` vs `O`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 12 minutes

## Entry 143 – Overlay cockpit: provenance legend tooltip (L/P/B/O)
**Prompt:** "yeah do that continue"

**Summary of actions:**
- Added a compact provenance legend control in `AttachedOverlayCardDetails.tsx`.
  - In the Metadata header, added an `L/P/B/O` button with a hover tooltip explaining:
    - `L` = local
    - `P` = p2p
    - `B` = both (same)
    - `O` = p2p overrides local

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 4 minutes

## Entry 144 – Overlay cockpit: expand provenance chips to more Metadata rows
**Prompt:** "2"

**Summary of actions:**
- Expanded provenance chips to additional Metadata rows in `AttachedOverlayCardDetails.tsx`:
  - `cardId`, `mediaKind`, `createdAt`, `tier` now show `L/P/B/O` provenance chips.
  - Treat `item.data.*` values as authoritative local overrides when computing provenance.
- Fixed a small TypeScript warning introduced during the change (unused parameter in helper).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 145 – Overlay cockpit: provenance chips for derived/system metadata rows
**Prompt:** "2"

**Summary of actions:**
- Added provenance chips for the remaining derived/system metadata rows in `AttachedOverlayCardDetails.tsx`:
  - `id`, `coreName`, `dock`, `status`, `z` now show a source chip (labeled as system-derived in tooltip).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 6 minutes

## Entry 146 – Overlay cockpit: pinning power-ups (bulk pin/unpin)
**Prompt:** "1"

**Summary of actions:**
- Added bulk pin/unpin actions in `AttachedOverlayCardDetails.tsx`:
  - Metadata section: `Pin Vis`, `Pin Match` (requires filter), and `Unpin` (unpin all metadata pins for this `coreName`).
  - Record section: `Pin Vis`, `Pin Match` (requires filter), and `Unpin` (unpin all record pins for this `coreName`).
  - Implemented via new helpers `bulkPinFields` and `bulkUnpinAllForKind` (using the existing `fieldPinsByCore` storage).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 140 – Overlay cockpit: pinned row UX polish (Unpin label)
**Prompt:** "continue"

**Summary of actions:**
- Small clarity fix in `AttachedOverlayCardDetails.tsx`:
  - In the `Pinned` section, changed the action label from `Pin` to `Unpin` (it already performed unpin).

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #ux #overlay
**Est. Avg. Human Dev Time:** 2 minutes

## Entry 141 – Overlay cockpit: per-field provenance chips (local vs p2p)
**Prompt:** "3"

**Summary of actions:**
- Added per-field provenance indicators for key fields in `AttachedOverlayCardDetails.tsx`.
  - Metadata fields (`title`, `source`, `url`, `tags`) now show a small `src` chip:
    - `L` = local only
    - `P` = p2p only
    - `B` = both (same value)
    - `O` = p2p overrides local
  - Record fields (`type`, `version`, `recordId`) show the same provenance chip.
  - Pinned section updated to show provenance chip next to the Unpin action.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 135 – Overlay cockpit: depth UX tweaks (fine control + visible Z)
**Prompt:** "Depth UX tweaks"

**Summary of actions:**
- Made depth control more consistent and discoverable.
  - `FloatingCard.tsx`:
    - Depth wheel now requires `Shift+Wheel`.
    - Added fine control: `Ctrl+Shift+Wheel` uses a smaller step.
    - Added an on-card `Z` pill shown on hover/selection.
  - `DragCanvas.tsx`:
    - Global `Shift+Wheel` handler now also supports fine control with `Ctrl+Shift+Wheel`.
    - Bracket depth keys now support fine control with `Ctrl+[ / ]`.
  - Updated on-screen help strings:
    - `FormationHud.tsx` telemetry mentions `Ctrl+[ ]` and `Ctrl+Shift+Wheel`.
    - `AttachedOverlayCardDetails.tsx` shortcuts label/help updated similarly.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 136 – Overlay cockpit: details panel depth fine-step buttons
**Prompt:** "continue"

**Summary of actions:**
- Added fine-step depth control to the Details panel depth buttons.
  - `AttachedOverlayCardDetails.tsx`:
    - Depth `- / +` buttons now use a smaller step when holding `Ctrl`.
    - Added button titles indicating `Ctrl` fine control.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 5 minutes

## Entry 137 – Overlay cockpit: details panel expansion + P2P status
**Prompt:** "details"

**Summary of actions:**
- Improved details panel usability for inspecting larger records.
  - `AttachedOverlayCardDetails.tsx`:
    - Added P2P fetch status (`loading` / `ok` / `error`) including last fetched time and a tooltip showing `coreName` + whether the record source is local vs resolved.
    - Added `More/Less` toggles to expand beyond the default:
      - Metadata: show first 10, expand to all
      - Record: show first 6, expand to all
    - Show current visible row counts (`shown/total`) in the section headers.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 138 – Overlay cockpit: details panel filter + copy displayed rows
**Prompt:** "Details"

**Summary of actions:**
- Added quick inspection utilities to the Details panel.
  - `AttachedOverlayCardDetails.tsx`:
    - Added a filter input to quickly narrow Metadata/Record rows.
    - Added `Copy` buttons for Metadata and Record that copy the currently displayed rows (respects filter + More/Less).
    - Updated shown/total counts to reflect what’s currently visible.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 139 – Overlay cockpit: details row pinning (Pinned fields)
**Prompt:** "row pinning"

**Summary of actions:**
- Added persistent row pinning for faster inspection.
  - `AttachedOverlayCardDetails.tsx`:
    - Added per-row `Pin` toggles for Metadata and Record rows.
    - Added a new `Pinned` section that surfaces pinned fields near the top.
      - Includes `Copy` (copies pinned rows) and `Clear` (clears pins for this `coreName`).
    - Pins persist in localStorage under `hapa.overlayDetails.fieldPins.v1` and are scoped per `coreName`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 130 – Overlay cockpit: Formation HUD constraint readout + clear actions
**Prompt:** "C"

**Summary of actions:**
- Improved Formation HUD visibility and control of formation constraints.
  - `FormationHud.tsx`:
    - Added a small constraint readout in telemetry showing:
      - Dock counts (`L# / R#`)
      - Anchored count (`ANCH:#`)
    - Added quick actions:
      - `CLR DOCK` clears left/right HUD dock rails.
      - `CLR ANCH` clears all anchored cards.
    - Both actions dispatch `hapa.overlay.layoutTick` so cards reflow immediately.
  - `DragCanvas.tsx`: wired the new required `anchored` prop into both FormationHud render paths.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 132 – Overlay cockpit: compact HUD telemetry shows selected status
**Prompt:** "continue"

**Summary of actions:**
- Improved compact Formation HUD readability.
  - `FormationHud.tsx`: compact telemetry now includes `ST` (selected status) with a short code and tooltip.
    - Helps quickly see whether the selected card is `Docked`, `Anchored`, `Formation`, or `Free` while the HUD is compressed.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 133 – Overlay cockpit: HUD dock rails show capacity + clear per side
**Prompt:** "continue"

**Summary of actions:**
- Polished HUD docking rails for faster control and better visibility.
  - `FormationHud.tsx`:
    - Rail headers now show capacity: `L x/6`, `R y/6`.
    - Added quick actions:
      - `CLR L` clears the left dock rail.
      - `CLR R` clears the right dock rail.
    - Actions dispatch `hapa.overlay.layoutTick` to reflow immediately.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 131 – Overlay cockpit: Formation HUD anchor toggle + selected status readout
**Prompt:** "continue"

**Summary of actions:**
- Reduced reliance on keyboard-only anchoring by adding a HUD control.
  - `FormationHud.tsx`:
    - Added `ANCH` button to toggle anchoring for the selected card.
      - Disabled while docked (docking has precedence).
      - When anchoring, captures the card’s current `tx/ty` from its DOM transform and persists it via `updateItemPosition`.
    - Added `ST:` (status) readout in the non-compact telemetry line (`Docked/Anchored/Formation/Free`).
  - `DragCanvas.tsx`: wired the new required `updateItemPosition` prop into `FormationHud`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 118 – Layout: bottom nav dock + “Send Hope” lightning burst
**Prompt:** "Can you create sort of a \"Dock\" for the nav at the bottom that fits with the UI (so doesn't look like its overwriting the side menu, but is at \"home there\" with a border and lightnight effects. And then add a button that \"sends it hope\" with a good animation."

**Summary of actions:**
- Added a bottom-centered dock in the main content area (does not overlap the sidebar).
  - `Layout.tsx`: main content area now reserves space (`pb-28`) and renders a fixed dock at the bottom center.
  - Dock includes a bordered/glass container with layered cyan glow and “lightning” gradient accents.
- Added a “Send Hope” button inside the dock.
  - On click, triggers a short burst animation (ping rings + bolt flashes) keyed by `hopeBurstKey`.
  - Uses on-theme icons (`auto-awesome`, `bolt`) and tooltip text.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/Layout.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #ux
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 119 – Overlay cockpit: HUD side-docking rails + on-brand HUD restyle + dock icon fixes
**Prompt:** "Ok now can you make it so I can \"dock\" cards to either side of the Floating Menu Bar… Can you also restyle that menu… (3) The icons are missing from the menu you just created with the send hope button…"

**Summary of actions:**
- Added true HUD-side docking for overlay cards (left/right rails attached to the Formation HUD).
  - `DragCanvasContext.tsx`: introduced `hudDock` state (`{ left: string[]; right: string[] }`), persisted into `hapa.overlayCards.v1`.
  - `DragCanvas.tsx`: listens for `hapa.overlayHud.rect` and computes forced formation targets for docked cards, applying even in `free` mode.
  - `FloatingCard.tsx`: supports forced targets via `formationTarget.force` to allow HUD docking without switching out of free mode.
  - `FormationHud.tsx`: renders left/right thumbnail rails and adds dock/undock controls for the selected card.
- Restyled the Formation HUD container to match the newer on-brand dock language (glass + cyan lightning/glow layers).
- Fixed missing icons in the bottom dock by swapping invalid icon names to ones present in `public/icons/`.
  - `science` → `build`
  - `auto-awesome` → `flash-auto`
  - `bolt` → `offline-bolt`

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/contexts/DragCanvasContext.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/Layout.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 60 minutes

## Entry 120 – Overlay cockpit: stabilize click/drag + details docking controls + drag-to-undock
**Prompt:** "Ok I see the buttons now, but two issues: For some cards when my mouse gets near they jump away… And then I don't see a 'Dock L/R' button on the cards or their details pages (and the details pages aren't following the cards…)" / "Ok it's working! Continue"

**Summary of actions:**
- Fixed an interaction bug where some overlay cards would "jump away" near the cursor.
  - `FloatingCard.tsx`: added a small movement threshold before entering true XY-drag mode.
  - Ensured pointer handlers are cleared on click-to-select so stale `onpointermove` cannot re-apply movement.
- Added per-card docking controls inside the attached details panel.
  - `AttachedOverlayCardDetails.tsx`: added `Dock L`, `Dock R`, `UD` buttons wired to `hudDock`.
- Ensured the details panel follows cards when docking changes.
  - `DragCanvas.tsx`: dispatch `hapa.overlay.layoutTick` when `hudDock` changes so the details panel re-measures/anchors.
- Docking UX polish: dragging a HUD-docked card away now auto-undocks to avoid "snap back" surprises.
  - `FloatingCard.tsx`: on drag activation, remove the card from `hudDock` and emit layout tick.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `dev_journal.md`

**Tags:** #bugfix #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 121 – Overlay cockpit: smarter details placement (avoid HUD + bottom dock)
**Prompt:** "continue"

**Summary of actions:**
- Improved attached details panel positioning to avoid occluding key UI.
  - `AttachedOverlayCardDetails.tsx`: listens for HUD and bottom dock rect events and penalizes overlap when choosing side (left/right/above/below).
  - Width is now responsive per-candidate side based on available space (up to 520px).
- Published bottom dock bounding rect for overlay systems.
  - `Layout.tsx`: emits `hapa.bottomDock.rect` using a ref + `ResizeObserver` + window resize.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/Layout.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 122 – Overlay docking UX: card controls + keyboard + rail reorder
**Prompt:** "all three"

**Summary of actions:**
- Added per-card docking micro-controls.
  - `FloatingCard.tsx`: shows `DL`, `DR`, `UD` buttons on hover/selected; buttons stop pointer propagation so they don’t trigger drag.
- Added docking keyboard shortcuts for selected card.
  - `DragCanvas.tsx`: `Shift+←` dock left, `Shift+→` dock right, `Shift+↓` undock.
- Added drag-and-drop reordering within the HUD docking rails.
  - `FormationHud.tsx`: pointer-drag a dock thumbnail to reorder within the rail or move across rails (with a small drag threshold to preserve click-to-select).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 45 minutes

## Entry 123 – Overlay cockpit: shortcut discoverability (dock keys)
**Prompt:** "continue"

**Summary of actions:**
- Improved discoverability of docking shortcuts in UI hints.
  - `AttachedOverlayCardDetails.tsx`: updated shortcut hint string to include `Shift+←/→` dock and `Shift+↓` undock.
  - `FormationHud.tsx`: updated HUD key/tip text to include docking shortcuts.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #overlay #ui #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 127 – Overlay cockpit: drag selects + inline-style lint reduction
**Prompt:** "continue both"

**Summary of actions:**
- Improved cockpit selection UX while dragging.
  - `FloatingCard.tsx`: when a drag actually begins (movement threshold / immediate spawn-drag), the card is auto-selected so details/selection follow the active drag.
- Reduced inline styles (lint cleanup) by migrating static style fields into Tailwind classes/arbitrary properties.
  - `DragCanvas.tsx`: moved static `perspective: 1200px` into `[perspective:1200px]` class.
  - `FormationHud.tsx`: moved static `transformStyle: preserve-3d` into `[transform-style:preserve-3d]` class.
  - `FloatingCard.tsx`: moved static `touchAction`, `willChange`, and `transformStyle` into classes; also replaced internal wrapper inline styles with Tailwind/arbitrary properties.
  - `PetEdge.tsx`: moved static label positioning/font/pointer-events into classes; left only dynamic transform inline.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/FloatingCard.tsx`
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/flow/PetEdge.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux #refactor
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 124 – Overlay cockpit: dock-aware details placement (deterministic)
**Prompt:** "yes"

**Summary of actions:**
- Made the details panel placement deterministic for docked cards.
  - When a card is docked to the HUD **left** rail, the details panel strongly prefers the **right** placement (and vice-versa).
  - Still falls back to other placements if the preferred side would overlap the HUD/bottom dock or go offscreen.
- Prevented docked-card placement from overwriting the user’s persisted placement preference (so free cards still respect/learn your preference).

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #overlay #ui #ux
**Est. Avg. Human Dev Time:** 15 minutes

## Entry 125 – Overlay cockpit: depth wheel for selected card (Shift+Wheel)
**Prompt:** "continue"

**Summary of actions:**
- Added a global depth wheel gesture for the selected overlay card.
  - `Shift+Wheel` nudges depth (`zOffsets`) for the currently selected card.
  - Gesture is ignored when the cursor is over the HUD, a card, or the details panel so local scroll/zoom behaviors remain intact.
  - Plays the existing depth nudge SFX for consistency with per-card wheel behavior.
- Updated UI hints to make the new gesture discoverable.
  - `FormationHud.tsx`: telemetry key hint now includes `Shift+Wheel`.
  - `AttachedOverlayCardDetails.tsx`: shortcut label + help list include `Shift+Wheel`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/DragCanvas.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #overlay #ui #ux
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 126 – Overlay cockpit: hint polish + richer details metadata
**Prompt:** "continue"

**Summary of actions:**
- Improved depth-wheel discoverability when nothing is selected.
  - `FormationHud.tsx`: updated the no-selection `Tip:` line to include `Shift+Wheel depth`.
- Added overlay-specific state to the details panel metadata block.
  - `AttachedOverlayCardDetails.tsx`: included `dock` (left/right/free) and current `z` in `metaRows`.

**Verification:**
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `dev_journal.md`

**Tags:** #overlay #ui #ux
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 116 – Overlay cockpit: persisted help + placement preference + pinned telemetry
**Prompt:** "all three"

**Summary of actions:**
- Persisted details panel help visibility and panel placement preference.
  - `AttachedOverlayCardDetails.tsx`: stores `showHelp` in `hapa.overlayDetails.help.v1`.
  - Remembers last winning placement (`left`/`right`/`above`/`below`) in `hapa.overlayDetails.placement.v1`.
  - Placement scoring now lightly biases toward the remembered side.
- Hardened pin UX visibility.
  - Added a `Pinned` badge in the details panel header when pinned.
- Exposed pinned state in the Formation HUD.
  - Telemetry shows `PIN: <id>` when pinned.
  - Key hint includes `P`.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 20 minutes

## Entry 117 – Formation HUD: compressed/compact icon mode + astro tooltips
**Prompt:** "Can you make a \"Compressed\" form of the hud that collapses it into a way smaller form with the buttons in only icon form (not written out) then add Astros/on-theme tool tips to explain the function. Let the user toggle between small and big."

**Summary of actions:**
- Added a toggleable compact HUD mode for Formation HUD.
  - `FormationHud.tsx`: new persisted state `hudCompact` in `hapa.overlayHud.compact.v1`.
  - Added an in-HUD toggle button (`COMPRESS` / `⤢`) to switch between expanded and compact.
- Implemented icon-only UI when compact.
  - Hover becomes `✦`, pin becomes `P`, recenter becomes `◎`, reset becomes `⟲`, clear becomes `×`.
  - Mode buttons render short glyphs and use astro-themed `title` tooltips to explain behavior.
- Kept expanded mode intact while tightening spacing/sizing in compact mode.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 115 – Overlay cockpit: persisted pin + HUD pin toggle + improved alignment
**Prompt:** "all three"

**Summary of actions:**
- Persisted the details panel pinned card to `localStorage` and restored it on boot.
  - `AttachedOverlayCardDetails.tsx`: stores `pinnedItemId` in `hapa.overlayDetails.pin.v1`.
  - Added a short hydration grace window so the pin isn’t immediately cleared before overlay items hydrate.
- Added cross-component pin syncing between the Formation HUD and the details panel.
  - Details panel emits `hapa.overlayDetails.pin.changed`.
  - Formation HUD dispatches `hapa.overlayDetails.pin.set` from a new `PIN` control.
- Improved left/right placement alignment by vertically centering the panel against the card when possible.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/cards/AttachedOverlayCardDetails.tsx`
- Modified: `src/components/overlay/FormationHud.tsx`
- Modified: `dev_journal.md`

**Tags:** #feature #ui #overlay #ux
**Est. Avg. Human Dev Time:** 30 minutes

## Entry 166 – AIMLAPI chat: support OpenAI-style vision attachments (image_url)
**Prompt:** "continue to do's"

**Summary of actions:**
- Implemented OpenAI-compatible vision message formatting for AIMLAPI chat when image attachments are present.
  - `electron/main.ts`: builds `content: [{ type: 'text', text }, { type: 'image_url', image_url: { url } }, ...]` for the user message.
  - Safely retries as text-only if the model/provider rejects the vision payload.
- Loosened AIMLAPI message typing to allow structured content arrays.
  - `electron/aimlapi.ts`: message `content` accepts structured content.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `electron/aimlapi.ts`
- Modified: `dev_journal.md`

**Tags:** #feature #aimlapi #vision #chat
**Est. Avg. Human Dev Time:** 25 minutes

## Entry 167 – Lint: remove inline style from DragCanvas recenter pulse
**Prompt:** "sure"

**Summary of actions:**
- Removed the JSX inline `style={{ left, top }}` on the recenter pulse indicator.
- Positioned the pulse element via a `ref` + `useLayoutEffect` to satisfy the no-inline-style lint rule while preserving the same visual behavior.

**Verification:**
- `npm run typecheck` and `npm test` passing.

**Files modified/created:**
- Modified: `src/components/DragCanvas.tsx`
- Modified: `dev_journal.md`

**Tags:** #lint #ui #overlay
**Est. Avg. Human Dev Time:** 10 minutes

## Entry 168 – Fix: Electron boot TS2322 after AIMLAPI vision support
**Prompt:** "can't boot"

**Summary of actions:**
- Fixed Electron compile failure (`TS2322`) caused by AIMLAPI vision messages using structured `content` arrays.
  - `electron/main.ts`: explicitly typed the AIMLAPI `messages` array as `{ role: string; content: any }[]` so pushing vision parts (`any[]`) is allowed.
- Verified Electron can start again.

**Verification:**
- `npm run electron` succeeds.
- `npm run typecheck` passing.

**Files modified/created:**
- Modified: `electron/main.ts`
- Modified: `dev_journal.md`

**Tags:** #bugfix #electron #aimlapi
**Est. Avg. Human Dev Time:** 10 minutes
