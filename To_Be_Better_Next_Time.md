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

