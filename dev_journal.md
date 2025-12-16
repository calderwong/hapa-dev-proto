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
