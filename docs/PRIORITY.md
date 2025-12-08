# 🎯 Priority & Principles

> **Goal**: A clear, defensible framework for what we do next and why.
> **Philosophy**: Logic, Truth, and "The Center".

---

## 📐 Prioritization Principles (The Logic of Truth)

We prioritize based on distance from **The Center** (System Truth/Integrity).

### 1. Integrity (The Center) 🔴 CRITICAL
**Definition**: The system must be true to itself. Data must be safe. State must be valid.
**Breach**: Crashes, Data Corruption, 400 Errors, Security Vulnerabilities.
**Rule**: If Integrity is breached, **STOP EVERYTHING**. Fix it immediately. No new features until the system is real again.

### 2. Flow (The Movement) 🟠 HIGH
**Definition**: The system must move according to its nature. Streams must flow, animations must breathe.
**Breach**: Memory Leaks (blockages), Jank (stuttering), Latency (waiting), "White Screens".
**Rule**: A feature that doesn't flow is dead weight. Optimize before expanding.

### 3. Form (The Shape) 🟡 MEDIUM
**Definition**: The code must be organized to allow understanding and change.
**Breach**: Monoliths (>500 lines), Copy-Paste code, Confused Types, "Spaghetti".
**Rule**: Refactor when it blocks Integrity or Flow, or when touching the code anyway ("Boy Scout Rule").

### 4. Decoration (The Surface) 🟢 LOW
**Definition**: New features, polish, "Nice to haves".
**Breach**: Missing a cool idea, slightly ugly UI.
**Rule**: Only build when layers 1-3 are solid. A beautiful house on quicksand is not a house; it's a trap.

---

## 📋 The Immediate Priority List (Action Plan)

| Rank | Task | Layer | Why? |
|------|------|-------|------|
| **1** | **Fix Loop Video Memory Crash** | **Integrity + Flow** | The app crashes (Integrity breach) because it treats video streams as memory buffers (Flow breach). This is a fundamental lie in the code. Must be fixed to restore reality. |
| **2** | **Fix Vertex/Gemini API 400 Error** | **Integrity** | The system is confused about its own capabilities (Vertex vs Gemini). It is sending requests to the wrong place. This is a logic error blocking a core feature. |
| **3** | **Unify "Card" Interface** | **Form** | We have 4+ definitions of "Card". This is "Truth Fragmentation". It will cause data corruption or massive friction soon. We need a `UnifiedCard` type. |
| **4** | **Refactor `CardLibrary` Monolith** | **Form** | The file is too heavy. It exerts "gravity" that makes it hard to move fast. Splitting it (Boy Scout style) unlocks velocity for future features. |
| **5** | **Animation/Narrative Hygiene** | **Decoration -> Flow** | The "Feel" is off. Once the system doesn't crash, we need to align the *story* of the interaction with the *reality* of the code. |

---

## 🛡️ Defense of Choices

**Why Memory (#1) over 400 Error (#2)?**
A crash is a total failure of existence. A 400 error is just a failure of function. Existence precedes Function. We must ensure the app *stays alive* before we fix what it *does*.

**Why Type Unification (#3) over Refactoring (#4)?**
Types are the vocabulary of our system. If our vocabulary is confused, our sentences (code) will be confused. Fixing the "Card" definition prevents future bugs in *every* component. `CardLibrary` is just one component.

---

## 🗺️ Strategic Roadmap (After the Fire)

Once #1 and #2 are resolved:
1.  **Cultivation Pass**: Run a deep scan on `src/types` to design `UnifiedCard`.
2.  **Domain Definition**: Explicitly map "Thor's Hamma" and "Wormhole" to their own directories.
3.  **Expansion**: *Then* we can build the next big feature (e.g., advanced Pet interactions) on a stable foundation.

---

*Last Updated: 2025-12-08 (Gemini Pass)*
