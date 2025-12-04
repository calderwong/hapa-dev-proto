# Multi-Animation Sprite Sheet Support - Design Plan

## Date: Dec 3, 2025

## Problem Statement

A single sprite sheet often contains multiple animations:
- Row 1: Walk cycle (6 frames)
- Row 2: Attack animation (4 frames)  
- Row 3: Idle animation (2 frames)
- Row 4: Jump animation (4 frames)

Users should be able to extract **multiple GIF animations** from the same parent sprite sheet, each with different grid settings, offsets, and labels.

## Current State Analysis

### What Works
1. **Single Animation Creation**: Creating the first animation from a sprite sheet works
2. **Child Linking**: The `children` array on parent cards uses spread operator `[...(existing), newChild]` which should support multiple children
3. **Hierarchy Structure**: Parent → Child relationship is established via `parentId`

### Current Issues
1. **GIF Worker Hanging**: The GIF rendering gets stuck at 50% - this is blocking any animation creation
2. **State Reset**: When opening the Sprite Sheet Converter a second time, previous state may persist
3. **No Animation Label**: All animations get the same label "Generated GIF" - not descriptive
4. **No Visual List**: Derived Assets section doesn't show already-generated animations well

## Proposed Solution

### Phase 1: Fix GIF Generation (Critical)
- [ ] Debug and fix the GIF.js worker issue (getting stuck at 50%)
- [ ] Add proper error recovery and fallback
- [ ] Ensure GIF state is fully reset between generations

### Phase 2: UI/UX for Multiple Animations
- [ ] Add "Animation Name" input field in SpriteSheetConverter
- [ ] Show existing animations from this sprite sheet in the converter panel
- [ ] Reset converter state when opened fresh
- [ ] Add numbered label if no custom name provided (e.g., "Animation #1", "Animation #2")

### Phase 3: Enhanced Hierarchy Display
- [ ] Update Derived Assets to group by type
- [ ] Show animation thumbnails in the list
- [ ] Add "Create Another Animation" quick action after generation
- [ ] Display animation settings used (rows, cols, offsets) in child metadata

## Technical Implementation

### 1. SpriteSheetConverter Enhancements

```tsx
// Add animation name input
const [animationName, setAnimationName] = useState('');

// Pass to parent on generate
onGenerate(gifBlob, animationName || `Animation #${existingAnimations.length + 1}`)
```

### 2. Updated Card Structure

```typescript
// Child animation card
{
  id: 'anim-xyz',
  type: 'card',
  subType: 'sprite-animation',
  parentId: 'sprite-sheet-abc',
  title: 'Walk Cycle',  // Custom name
  generationSettings: {
    rows: 1,
    cols: 6,
    offsetTop: 0,
    offsetBottom: 200,
    offsetLeft: 0,
    offsetRight: 0,
    frameDelay: 150,
    removeBackground: true
  }
}
```

### 3. State Reset Logic

```tsx
// In CardWorkspace - reset converter state when toggled
useEffect(() => {
  if (showSpriteConverter) {
    // Fresh state for new conversion
  }
}, [showSpriteConverter]);
```

### 4. Parent Children Array

```typescript
// Parent sprite-sheet card
{
  children: [
    { cardId: 'anim-1', type: 'sprite-animation', label: 'Walk Cycle' },
    { cardId: 'anim-2', type: 'sprite-animation', label: 'Attack' },
    { cardId: 'anim-3', type: 'sprite-animation', label: 'Idle' }
  ]
}
```

## Immediate Action Plan

1. **First**: Debug and fix the GIF worker issue (current blocker)
2. **Second**: Add animation naming to SpriteSheetConverter
3. **Third**: Update the onGenerate callback to pass the name
4. **Fourth**: Ensure state resets properly between generations
5. **Fifth**: Update Derived Assets display to show all animations

## Hierarchy Visualization

```
📊 Sprite Sheet Card (Parent)
    │
    ├── 🎬 Walk Cycle (sprite-animation)
    │       └── 🔊 Walk Sound (sprite-sfx)
    │
    ├── 🎬 Attack (sprite-animation)
    │       ├── 🔊 Sword Swing (sprite-sfx)
    │       └── 🔊 Impact (sprite-sfx)
    │
    └── 🎬 Idle (sprite-animation)
            └── 🔊 Breathing (sprite-sfx)
```

## Success Criteria

- [ ] User can create 2+ animations from the same sprite sheet
- [ ] Each animation has a custom or auto-generated name
- [ ] All animations appear in Derived Assets list
- [ ] Clicking an animation opens it in CardWorkspace
- [ ] Animation audio attachment (from previous feature) works for all animations
- [ ] No state conflicts between animation generations
