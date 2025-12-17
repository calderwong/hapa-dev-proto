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
