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
