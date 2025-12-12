# To Be Better Next Time - Retrospective Notes

## Purpose
This file captures reflections on our workflow, what went well, what caused friction, and how we can improve communication, task ordering, and tool usage in future sessions.

---

## Retrospective 1: Imagen Integration & Card Library Enhancement
**Date:** 2025-12-02
**Milestone:** Message cards with generated media thumbnails, drag-drop from sidebar

### What Went Well
- **Incremental approach**: Breaking the feature into smaller pieces (save, thumbnail, drag-drop) made debugging easier.
- **Consistent patterns**: Following existing code patterns (e.g., how `handleAddCardAsAttachment` works) made the drag-drop fix straightforward.
- **Clear user feedback**: Screenshots and specific descriptions ("stutter when hovering", "doesn't lock like library method") helped pinpoint exact issues.
- **TypeScript compilation checks**: Running `tsc --noEmit` after each change caught issues early.

### What Caused Friction
- **Hidden data flow**: The drag-drop system has multiple data types (`application/x-message-card`, `application/json`, `Files`) and understanding which one to use when required tracing through multiple files.
- **State management complexity**: The `messageCardState`, `threadMedia`, and `attachments` state are interconnected, and it took time to understand how they flow together.
- **Stale closure references**: The drag event handlers reference state variables that can become stale, causing subtle bugs.

### Improvements for Next Time
1. **Document data transfer types**: Create a quick reference of what data types are used for drag-drop and what each contains.
2. **State dependency diagram**: For complex features, sketch out which state variables affect which UI elements.
3. **Test incrementally**: After each change, test the specific behavior before moving on.
4. **Don't set state in dragover**: Learned that setting state in `handleWindowDragOver` causes rapid re-renders - only set on `dragenter`.

### Technical Learnings
- **Extracting embedded images**: Regex pattern `/!\[.*?\]\((data:([^;]+);base64,[^)]+)\)/g` works well for markdown-embedded images.
- **Base64 to Blob**: `Uint8Array.from(atob(base64), c => c.charCodeAt(0))` is the pattern for converting base64 to binary.
- **Drag counter pattern**: Using a counter for `dragenter`/`dragleave` events handles the case where child elements trigger additional events.

---

## General Patterns Worth Remembering

### Drag & Drop Best Practices
- Use capture phase (`true` in addEventListener) for global drag handlers
- Increment counter on `dragenter`, decrement on `dragleave`, reset on `drop`
- Don't update state in `dragover` - only in `dragenter`
- Support multiple data types for flexibility (e.g., both message context AND image data)

### Card/Media Data Flow
```
User saves message → createMessageCard() → card-library core
                   ↓
              messageCardState updated → threadMedia computed
                   ↓
              Sidebar renders thumbnail → Drag sets data types
                   ↓
              Drop handler extracts data → Creates Attachment
```

### File Organization
- Card-related logic: `Chat.tsx` (createMessageCard, handleAddCardAsAttachment)
- Drop handling: `ChatInput.tsx` (global drag listeners)
- Card display: `CardLibrary.tsx` (library view)
- Types: `types.d.ts` (Attachment, Message interfaces)


## Retrospective 2: Icon Validation Incident
**Date:** 2025-12-06
**Milestone:** Modern Mermaid Integration
**Key Lesson:** Primary source validation vs. Assumption

### What Happened
- Needed an icon for the new "Diagrams" nav item.
- Searched web, found "Astro UXDS extends Material Design".
- Assumed any Material icon (`schema`, `account-tree`) would work.
- They didn't render. Wasted turns fixing it.
- Finally found `timeline` worked by trial/checking the official list.

### The Root Cause
- **Assumption:** "Extends Material Design" = "Includes ALL Material Design icons".
- **Source Bias:** Trusted a web search summary over checking the actual component library documentation.
- **Optimization Failure:** Tried to save time by skipping validation, ended up spending more time fixing errors.

### The Fix
- Established **Validation Protocol** (`docs/VALIDATION_PROTOCOL.md`).
- Core rule: **Verify from primary source** (official docs/repo) before implementing.
- Updated memory to specifically check the Astro UXDS Icon Library.

### Improvement for Next Time
- When using a component library (Astro, Lucide, etc.), **keep the official icon/component list open** in a browser tab.
- **Never guess** an ID or prop name.
- If a search result says "X supports Y", verify it by finding Y in X's documentation.

---

## Retrospective 3: The `stdio: 'ignore'` Incident
**Date:** 2025-12-11
**Milestone:** Vertex AI Video Generation Debugging
**Key Lesson:** Verify basic I/O before debugging complex logic

### What Happened
- Video generation via Vertex AI was timing out after 5 minutes of polling.
- 3 AI models (across multiple sessions) spent hours debugging:
  - Vertex AI API quirks (UUID operation IDs vs Long IDs)
  - Discovered `fetchPredictOperation` endpoint (correct fix)
  - Created standalone Python test scripts (worked perfectly)
  - Updated polling logic multiple times
- User asked: "What do the polling responses FROM vertex look like? There is no information."
- User read the code and **immediately** found: `stdio: 'ignore'` in the spawn() call.
- We were literally throwing away all Python bridge output.

### The Root Cause
```typescript
const child = spawn('python', [scriptPath, configPath], {
  detached: true,
  stdio: 'ignore' // <-- THE PROBLEM
});
```

The Python bridge was printing detailed JSON status messages. Node.js was configured to discard them all. We were debugging blind.

### Why AI Models Missed It
1. **Tunnel vision on the "interesting" problem** - Fascinated by Vertex AI API quirks, forgot to verify internal plumbing.
2. **Assumption cascade** - Assumed Python was running (true), assumed output was captured (false), assumed timeout was API slowness (wrong).
3. **Code reading without context** - Read spawn code, saw `stdio: 'ignore'`, but the comment ("We rely on file output") made it seem intentional.
4. **Expertise blind spot** - Pattern-matched `stdio: 'ignore'` as "normal for daemons" rather than questioning appropriateness.
5. **Wrong response to user question** - When user said "I don't see X", we checked if X was generated, not if X reached its destination.

### Why User Found It Immediately
- **No assumptions** about what "should" work
- **End-to-end thinking**: "If Python prints, where does it go?"
- **Fresh eyes** not biased by hours of API debugging
- **The right question**: "Are we even getting responses?"

### The Fix
```typescript
stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr
// + event handlers to log output
```

### Debugging Protocol Addition
**Before debugging complex logic, verify basic I/O:**
1. Can I see subprocess output?
2. Are logs reaching the console?
3. Is the network request actually being sent?
4. Is the response being received and parsed?

**When user says "I don't see X":**
1. FIRST verify X reaches its destination
2. THEN verify X is being generated

**Treat comments with suspicion:**
- Comments explain intent, not correctness
- `// We rely on file output` doesn't mean file output is sufficient

### Full Analysis
See: `APPLES/AI_Debugging_Retrospective_2025-12-11.md`

