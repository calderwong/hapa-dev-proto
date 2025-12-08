# The Hand - Vision & Future Architecture

> "The Hand is not just storage—it's your active workspace, your cards ready for deployment."

## Core Philosophy

The Hand represents **cards in active consideration**. Unlike the Library (archive) or the Vault (long-term storage), cards in Hand are:
- **Primed for action** - Ready to be deployed to pipelines, agents, or workflows
- **Contextually aware** - Can be quickly previewed for decision-making
- **Fluid** - Easy to add/remove through intuitive drag gestures

---

## Gesture Language

### Adding to Hand
- **Drag from Library** → Arc flight animation → Celebratory bounce landing
- **Drag from Search Results** → Same arc flight
- **Quick-add hotkey** → Card flies from source with trail effect

### Removing from Hand
- **Drag to valid target** (Pipeline, Agent, Drop Zone) → Success animation, card transforms/integrates
- **Drag to invalid area** (anywhere else) → **Return animation** - Card fades/shrinks and "returns to Library"
- **No explicit X button** - Removal is always via drag gesture (more tactile, less accidental)

### Previewing
- **Click** → Hand Card View slides in (compact detail panel)
- **Hover** → Quick tooltip with name + state
- **Long press** (future) → Full 3D card viewer

---

## Hand Card View - Design Spec

A compact, neon-terminal styled panel that appears when clicking a hand card:

```
┌────────────────────────────────────────┐
│ ◆ CARD NAME                     [TIER] │
├────────────────────────────────────────┤
│ ┌─────────┐                            │
│ │         │  SKILLS                    │
│ │  THUMB  │  • Skill 1                 │
│ │         │  • Skill 2                 │
│ └─────────┘                            │
├────────────────────────────────────────┤
│ DESIRES                                │
│ "What this card wants to become..."    │
├────────────────────────────────────────┤
│ TRUTHS                                 │
│ • Core truth 1                         │
│ • Core truth 2                         │
├────────────────────────────────────────┤
│ [Deploy to Pipeline ▸] [View Full ▸]   │
└────────────────────────────────────────┘
```

**Styling:**
- Dark glassmorphic background (bg-gray-900/90 backdrop-blur)
- Cyan accent borders with subtle glow
- Monospace headers with terminal aesthetic
- Smooth slide-in from right or bottom

---

## Future Drop Targets (Pipeline Integration)

### Current
- **The Hand** - Card storage/consideration

### Near Future
1. **Thor Pipeline** - Text processing, analysis
2. **Leo Pipeline** - Vision/image understanding  
3. **Conviction Pipeline** - Evidence gathering, truth extraction
4. **Hell Week Pipeline** - Bulk video/media processing

### Drop Behavior Matrix

| Drop Target | Animation | Result |
|-------------|-----------|--------|
| The Hand | Bounce in | Card added to hand |
| Thor Drop Zone | Red spark integration | Card queued for Thor processing |
| Leo Drop Zone | Blue holographic absorb | Card queued for vision analysis |
| Conviction Zone | Green lock-in | Card enters conviction workflow |
| Hell Week | Purple vortex | Card enters batch processing |
| Invalid Area | Fade + return | Card returns to Library |

### Visual Feedback During Drag

When dragging a card, valid drop zones should:
1. **Glow/pulse** to indicate they accept the card
2. **Expand slightly** as card approaches
3. **Show preview** of what will happen on drop

Invalid areas show:
1. **No change** or subtle dimming
2. **Return preview** - ghost of card returning to library

---

## State Integration

Cards in Hand can have states that affect their appearance:

| State | Border | Glow | Meaning |
|-------|--------|------|---------|
| idle | Cyan | Subtle | In hand, awaiting action |
| thor | Red | Pulse | Assigned to Thor |
| leo | Blue | Holo shimmer | Assigned to Leo |
| conviction | Green | Steady | In conviction workflow |
| run | Purple | Pulse | Active in a run |
| processing | Yellow | Scan line | Being processed |

---

## Variations & Ideas

### Idea 1: Card Stacking
Multiple related cards could stack together in Hand, showing as one slot that expands on hover to reveal all stacked cards. Good for sets or sequences.

### Idea 2: Quick Actions Menu
Right-click or long-press on hand card could show radial menu:
- Send to Thor
- Send to Leo  
- View Details
- Return to Library

### Idea 3: Hand Slots
Instead of free-form hand, have designated slots:
- Slot 1-3: Active processing
- Slot 4-5: Queue
- Slot 6-7: Overflow

### Idea 4: Card Combos
Dragging two cards together in hand could trigger "combine" action for set creation or relationship building.

### Idea 5: Persistent Hand State
Hand persists across sessions with visual indicator of how long each card has been "in hand" - cards waiting too long could dim or show a timer.

### Idea 6: Agent Assignment Previews
When hovering over an agent drop zone while dragging, show preview of what the agent would do with that card.

---

## Implementation Priority

1. ✅ Hand in header (global visibility)
2. 🔄 Hand Card View (compact details on click)
3. 🔄 Drag-out removal (no X button)
4. 🔄 Return animation (invalid drop)
5. ⏳ Pipeline drop zones
6. ⏳ State-based styling
7. ⏳ Advanced gestures

---

## Technical Notes

### Animation Library
Using Anime.js v4 for all animations:
- `animate()` for single animations
- `Timeline` for sequenced animations
- `spring()` easing for tactile feel

### State Management
- `HandContext` manages card list and states
- `useCardLoadQueue` for progressive loading
- Future: Redux or Zustand for complex state

### Drop Zone Detection
Use `onDragOver` + `onDrop` on valid targets, with global `onDragEnd` fallback for invalid drops that triggers return animation.
