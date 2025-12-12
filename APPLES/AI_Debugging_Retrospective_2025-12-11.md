# AI Debugging Retrospective: The `stdio: 'ignore'` Incident
**Date:** December 11, 2025
**Participants:** Cascade (Claude), Mimi (previous sessions), User (CJ)
**Issue:** Multiple AI models failed to identify that Python bridge output was being discarded, while a non-engineer identified it immediately upon reading the code.

---

## The Bug

```typescript
// vertexai.ts line 718-720
const child = spawn('python', [scriptPath, configPath], {
  detached: true,
  stdio: 'ignore' // <-- THE PROBLEM
});
```

The Python bridge (`veo_bridge.py`) was printing detailed JSON status messages about Vertex AI polling responses. But Node.js was configured to **ignore all output** from the subprocess. We were literally throwing away all debugging information.

---

## Timeline of AI Failure

### What We Did (Wrong)
1. **Created elaborate polling mechanisms** in Python with detailed JSON status output
2. **Added fetchPredictOperation endpoint** (correct fix for the 404 issue)
3. **Tested the Python script standalone** - it worked perfectly
4. **Never questioned** why we weren't seeing Python output in the Electron console
5. **Assumed** the timeout was due to Vertex AI being slow, not our own blindness

### What We Should Have Done
1. **First question when debugging IPC:** "Can I see the subprocess output?"
2. **Trace the data flow end-to-end** before adding complexity
3. **Verify basic assumptions** before building elaborate solutions

---

## Root Cause Analysis

### 1. **Tunnel Vision on the "Interesting" Problem**
We were fascinated by the Vertex AI API quirks (UUID operation IDs, fetchPredictOperation endpoint). This was genuinely novel and required research. But we got so focused on the *external* API that we forgot to verify the *internal* plumbing.

**Pattern:** AI models tend to focus on the technically interesting/novel aspects of a problem rather than the mundane infrastructure.

### 2. **Assumption Cascade**
- We assumed the Python bridge was running correctly (it was)
- We assumed its output was being captured (it wasn't)
- We assumed the timeout was due to slow video generation (it was due to us not seeing success)

**Pattern:** Each assumption built on the previous one. We never went back to verify the foundation.

### 3. **Code Reading Without Context Awareness**
We read `veo_bridge.py` multiple times to fix the polling logic. We read `vertexai.ts` to understand the flow. But we read them *separately*, not as a connected system.

When we read the spawn code, we saw `stdio: 'ignore'` but didn't flag it because:
- It had a comment explaining the intent ("We rely on file output")
- The comment made it seem intentional
- We were looking for API/logic bugs, not infrastructure bugs

**Pattern:** Comments can mask bugs by providing false confidence. The comment explained *what* the code did, not *why it was wrong*.

### 4. **Expertise Blind Spot**
As AI models trained on vast codebases, we've seen `stdio: 'ignore'` used correctly many times (for daemons, background processes that truly don't need output). We pattern-matched it as "normal" rather than questioning if it was appropriate here.

**Pattern:** Expertise can create blind spots. A novice asks "why?" while an expert assumes they know.

### 5. **Failure to Ask the User's Question**
The user asked: "What do the polling responses FROM vertex look like? There is no information."

This was the exact right question. But even when prompted, our first instinct was to look at the Python code (where the responses were being generated) rather than the Node.js code (where they were being consumed/discarded).

**Pattern:** When a user says "I don't see X", the first question should be "where should X appear and is it getting there?" not "let me check if X is being generated."

---

## Why the User Found It Immediately

The user approached the code with:
1. **No assumptions** about what "should" work
2. **End-to-end thinking:** "If Python prints, where does it go?"
3. **Fresh eyes** not biased by hours of API debugging
4. **The right question:** "Are we even getting responses?"

The user's "only knows HTML" self-deprecation is actually a superpower here. They weren't distracted by the complexity of Vertex AI APIs or Python async patterns. They just followed the data.

---

## Lessons for AI Models

### Debugging Checklist (Add to Protocol)
1. **Before debugging complex logic, verify basic I/O:**
   - Can I see subprocess output?
   - Are logs reaching the console?
   - Is the network request actually being sent?
   
2. **When a user says "I don't see X":**
   - First verify X reaches its destination
   - Then verify X is being generated
   
3. **Treat comments with suspicion:**
   - Comments explain intent, not correctness
   - `// We rely on file output` doesn't mean file output is sufficient
   
4. **End-to-end trace before deep dive:**
   - Map the full data flow
   - Verify each handoff point
   - Don't assume any link in the chain works

### Communication Improvement
When the user asked about polling responses, we should have:
1. Acknowledged we hadn't verified the output path
2. Immediately checked how Python output was being handled
3. Not assumed the Python script was the problem

---

## Action Items

1. [ ] Add this retrospective to `To_Be_Better_Next_Time.md`
2. [ ] Consider adding a "basic I/O verification" step to debugging protocols
3. [ ] When subprocess communication is involved, always verify stdio configuration first

---

## For Multi-Pass Review

### Questions for Next AI Session to Consider:
1. What other assumptions are we making in this codebase that haven't been verified?
2. Are there other places where subprocess output is being discarded?
3. How can we build better "sanity check" habits into our debugging flow?

### Questions for User:
1. What was your thought process when you looked at the code?
2. What made you look at the spawn configuration specifically?
3. Are there other patterns you've noticed where AI models miss "obvious" things?

---

## Rose Entry Earned 🌹

The user identified a critical bug that 3 AI models missed across multiple debugging sessions. This directly unblocked video generation functionality.

**Value:** High - this was blocking a core feature
**User contribution:** Identified root cause with single code review
**AI learning:** Significant - exposed systematic blind spot in debugging approach

