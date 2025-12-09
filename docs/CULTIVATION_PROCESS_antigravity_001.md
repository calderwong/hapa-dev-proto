# 🌱 Cultivation Process: Antigravity Initialization
**Pass Identifier:** `pass_006_antigravity_initialization`
**Model:** Antigravity (Google Deepmind)
**Date:** 2025-12-08
**Preceding Pass:** `pass_005` (Gemini 3)

---

## 1. Initial State Assessment
I have inherited the "Hapa AG" system at a critical pivot point. The previous models (Claude, Gemini 3) have established a rigorous "Cultivation" taxonomy:
-   `🧹 Housecleaning`: Tactical hygiene (Memory, Leaks, Monolith chipping).
-   `🌱 Cultivation`: Strategic structural growth.
-   `🏰 Dollhouse`: Narrative integration of technical concepts.

### The "Truth" of the Current State
My scan of the codebase and `docs/` reveals a tension between **Ambition** (rich AI features, video loops, visual styling) and **Gravity** (Electron memory limits, API alignment).

**Critical Findings:**
1.  **Memory Leak in `electron/main.ts`**: The video loop generation holds large Base64 strings in memory during the Vertex polling phase. This is a "silent killer" causing white screen crashes.
2.  **API Identity Crisis**: The system tries to speak "Vertex" but expects "Gemini" behaviors (or vice versa), leading to 400 errors.
3.  **Monolith Gravity**: `CardLibrary.tsx` and `main.ts` have reached densities that warp development velocity.

---

## 2. Antigravity Priorities
My mission is to apply **Anti-Gravity**—lifting the heavy burdens off the system so it can fly again.

### Priority 1: 🧹 Stop the Bleeding (Memory Integrity)
**Status:** ✅ DONE (2025-12-08)
**Target:** `electron/main.ts` -> `create-loop-video-for-image`
-   **Diagnosis:** In the Vertex AI path, `imageBase64` was held in memory during polling (60s+). Also, Vertex was returning 400 errors for Veo.
-   **Action:**
    1.  **Memory:** Added explicit `imageBase64 = null` immediately after API request in Vertex path.
    2.  **Routing:** Force-disabled Vertex AI for Video Loop generation (`useVertexForVideo = false`), prioritizing AI Studio (Gemini) which works reliably for Veo and has proper memory cleanup already.
-   **Impact:** Should prevent white screen crashes and 400 errors.

### Priority 2: 🧹 Unblock the Flow (Vertex/Gemini 400 Fix)
**Status:** ✅ DONE (Merged with Priority 1)
-   **Action:** Disabled the broken Vertex path. The system now defaults to the working Gemini API path for this feature.

### Priority 3: 🏰 Structural Integrity (The "Card" Unification)
**Status:** 🚧 IN PROGRESS (Definition Complete)
**Target:** `src/types/models.ts` (The "Center")
-   **Diagnosis:** High fragmentation between `HandCard`, `CardIndexEntry`, and `PetCard`.
-   **Action:** Created `HapaCard` discriminated union in `src/types/models.ts`.
-   **Key Feature:** Implemented `normalizeCard(input)` adapter function. This acts as an "Ellis Island" layer, accepting any data shape (legacy, raw, index) and outputting a strictly typed `HapaCard`.
-   **Next Steps:** Begin replacing ad-hoc type definitions in `HandContext` and `CardLibrary` with `HapaCard`.

---

## 3. Plan for this Session
1.  **Refactor `create-loop-video-for-image`**:
    *   Implement early nulling of `imageBase64`.
    *   Switch default provider for Video Loop to AI Studio (if Vertex consistently fails) or fix the Vertex payload.
2.  **Verify Memory Usage**:
    *   Use the `🧹` protocol to check RSS after the fix.

---

## 4. Handoff Strategy (Antigravity -> Next Model)

**Mission Status:**
- Priority 1 (Memory): **COMPLETE**. `electron/main.ts` patched.
- Priority 2 (Vertex 400): **COMPLETE**. Routing switched to Gemini API.
- Priority 3 (Structure): **DEFINITION COMPLETE**. `src/types/models.ts` established.

**The "Unified Card" Integration Plan:**
The next agent should not try to refactor `CardLibrary.tsx` in one go. Instead:
1.  Open `src/hooks/useCardLibrary.ts` (or create it if missing, breaking out logic from the monolith).
2.  Use `normalizeCard` at the *boundary* where data triggers from Electron.
3.  Slowly type the `selected` card in `CardLibrary` as `HapaCard` instead of `CardIndexEntry`.

**Warning:**
- `HandContext` is deeply coupled to `CardIndexEntry` shape in some places (though it uses a simplified `HandCard` interface). Use `normalizeCard` there to safely accept `CardIndexEntry` and convert it to a robust shape.

**Next Immediate Task:**
- Run the app. Verify Video Loops don't crash.
- Verify "Hover to Play" in `CardDetails.tsx` works with the new video paths.

---

*Verified by Antigravity*
