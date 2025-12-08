# 🌱 Cultivation Process & Meta-Analysis

> **Goal**: Document the process of "sharpening" the codebase and our collaboration dynamics.
> **Last Review**: 2025-12-08 (The Gemini 3 Switch)

---

## 🧐 The Review Process (Gemini 3 Perspective)

### Methodology: The "Structural Scan"
Instead of looking at code as text, I looked at it as a graph of dependencies and weights.

1.  **Weight Analysis**: Found the heaviest files (`CardLibrary.tsx` @ 278KB, `main.ts` @ 215KB). In software, mass = gravity. Gravity pulls bugs in and makes them hard to escape.
2.  **Coupling Scan**: Checked imports. `main.ts` importing `vertexai` importing `store` creates a rigid chain. If `store` changes, everything breaks.
3.  **Context vs. content**: I ignored *what* the code does (logic) and focused on *where* it lives (structure).

### Findings: The "Invisible" Big Rocks
Things that work today but will stop us tomorrow:

1.  **The "Ghost" State (Memory Leaks)**
    - **Visible**: App crashes after 3 videos.
    - **Invisible**: `main.ts` has global variables that grow indefinitely. Javascript GC is lazy; we must be strict.
    - **Fix**: Structural enforcement (LRU caches, explicit `dispose()` patterns).

2.  **The Monoliths**
    - **Visible**: File takes 2 seconds to save/lint.
    - **Invisible**: Cognitive load. You have to hold 3000 lines of context to change 1 line safely.
    - **Fix**: "Boy Scout Rule" - extract one small piece with every bug fix. Don't stop the world.

3.  **Configuration Chaos**
    - **Visible**: 400 Error on Vertex AI.
    - **Invisible**: We have "Vertex" configs in `vertexai.ts` but "Gemini" configs in `main.ts`. The mental model is split.
    - **Fix**: Centralized Configuration Service. One place to define what models exist.

---

## 🤝 Human-AI Dynamics: How to Improve

### What You (User) Can See vs. What I (Cascade) Can See

| Perspective | Strength | Blind Spot |
|-------------|----------|------------|
| **User (You)** | **Intent & Experience**. You feel the "jank" in animations. You see the white screen. You know *why* a feature exists (the narrative). | **Hidden Coupling**. You might not see that importing `Card3DViewer` creates a 5MB bundle chunk. |
| **Cascade (Me)** | **Structure & pattern**. I see that `useEffect` is missing a dependency. I see that an interface is duplicated 4 times. | **User Experience**. I don't know if an animation "feels" snappy or sluggish. I assume code that compiles works. |

### Improvement Suggestions for Our Routine

1.  **The "Structure First" Prompt**:
    - *Try asking:* "Before we implement Feature X, how should we structure the files?"
    - *Why:* This lets me use my "Architect" mode before my "Coder" mode.

2.  **The "Audit" Trigger**:
    - *Try asking:* "Run a 🧹 scan on `src/components`."
    - *Why:* I can find the debt accumulating before it crashes the app.

3.  **Narrative-Driven Refactoring**:
    - You often use metaphors ("Clean the House", "Cultivate"). This is excellent. It gives me *permission* to think broadly rather than just executing a narrow command.
    - *Keep doing:* Using emojis (`🧹`, `🍌`) as context anchors.

---

## 📝 Cultivation Log (2025-12-08)

### What Worked
- **Switching Models**: Gemini 3 allowed for a deeper, more strategic scan than the standard execution model.
- **Reference Files**: Having `VALIDATION_PROTOCOL.md` prevented me from hallucinating a fix for Vertex AI. I checked the docs because the protocol told me to.

### What We Changed
- **Housecleaning Protocol**: Created `docs/🧹housecleaning_protocol_ALWAYS_READ.md` as a persistent "Architect".
- **Vertex vs Gemini**: Clarified the API distinction in memory.
- **Monolith Identification**: Flagged `main.ts` and `CardLibrary.tsx` for immediate (but gradual) refactoring.

### Next Steps (The "Roadmap")
1.  **Fix the Crash**: Apply memory patterns from the protocol to `electron/main.ts`.
2.  **Fix the 400 Error**: Route video generation to Gemini API (AI Studio) as identified.
3.  **Start Breaking Monoliths**: Next time we touch `CardLibrary`, extract `CardContent`.

---

## 📌 Pass Markers & Extensions

| Pass ID | Date | Location | Summary |
|---------|------|----------|---------|
| `pass_001_claude-reviewing-cultivation-changes` | 2025-12-08 | `CULTIVATION_PROCESS_v2.md` §7 | Cascade's self-reflection on thinking patterns, completion bias, answers to cultivation questions, and proposed experiments (Narrative First, Checkpoints, Model Switching). |
| `pass_002_gemini-reviewing-cultivation-changes` | 2025-12-08 | `CULTIVATION_PROCESS_v2.md` §8 | Gemini's perspective: "Wide Angle" view on data fragmentation, "Media vs Memory" conflict, response to external influence/safety concerns, and proposed "Narrative Check" ritual. |

---

*This document is a living reflection of our process. Review it when we feel "stuck" or "slow".*
