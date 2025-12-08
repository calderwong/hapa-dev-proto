# 🧹 Housecleaning Protocol - ALWAYS READ

> **Shorthand Commands:**
> - `🧹` - Full cultivation pass (read this file, find opportunities, execute improvements)
> - `🧹.specific` - Target specific area (e.g., `🧹.memory`, `🧹.vertex`, `🧹.anime`)
> - `"Clean the House"` - Verbal equivalent of `🧹`

---

## 🌱 The Cultivation Mindset

We are not just building software. We are **cultivating a living system** that must be:
- **Efficient**: For users, for humans reading code, for AI assistants navigating it
- **Sustainable**: Memory-conscious, resource-aware, not wasteful
- **Comprehensible**: Clear patterns, consistent organization, self-documenting
- **Evolvable**: Easy to extend, refactor, and improve over time

### The Three Pillars
1. **VALIDATE** - Never assume, always verify from primary sources
2. **CULTIVATE** - Continuously improve as you work, leave trails
3. **DOCUMENT** - Make knowledge persistent and discoverable

---

## 📋 Quick Reference: Current Issues & Fixes

### 🔴 CRITICAL: Memory Management (Causing Crashes)

**Symptoms observed:**
```
[Memory] LoopVideo Start: { heapUsed: '31MB', rss: '902MB' }
[Memory] LoopVideo Complete: { heapUsed: '135MB', rss: '1032MB' }
```
RSS growing 130MB per video loop, not being released → white screen crash.

**Root Causes:**
1. Large base64 strings not being nulled after use
2. Video buffers held in memory during polling
3. No explicit garbage collection hints
4. Possible event listener accumulation

**Fixes to apply:**
```typescript
// Pattern 1: Null large data after use
let largeData = await fetchLargeData();
processData(largeData);
largeData = null; // Release reference
if (global.gc) global.gc(); // Hint GC if available

// Pattern 2: Use streaming for large files
const stream = fs.createReadStream(path);
// Process in chunks, don't load entire file

// Pattern 3: Weak references for caches
const cache = new WeakMap();
```

**Files to audit:**
- `electron/main.ts` - `createLoopVideo` handler (~line 2600+)
- `electron/vertexai.ts` - Video generation methods
- Any handler that processes images/videos

---

### 🔴 CRITICAL: Vertex AI Video Generation (400 Error)

**Current Error:**
```
Vertex AI Veo Error (400): Invalid resource field value in the request.
```

**Root Cause (VERIFIED from official docs 2025-12-08):**

Vertex AI and Gemini API (Google AI Studio) are **DIFFERENT APIS** with different:
- Endpoints
- Authentication
- Model availability
- Request/response formats

**Official Gemini API Veo Documentation:**
- Source: https://ai.google.dev/gemini-api/docs/video
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- Header: `x-goog-api-key: {API_KEY}`
- Models available:
  - `veo-3.1-generate-preview` - Latest, with audio
  - `veo-3.1-fast-generate-preview` - Fast, with audio
  - `veo-3.0-generate-001` - Stable Veo 3
  - `veo-3.0-fast-generate-001` - Fast Veo 3
  - `veo-2.0-generate-001` - Veo 2

**Response path for video URI:**
```javascript
.response.generateVideoResponse.generatedSamples[0].video.uri
```

**Vertex AI (aiplatform.googleapis.com):**
- Different endpoint structure
- Requires Project ID + Region
- May NOT support same models as Gemini API
- Requires OAuth or Service Account (API key support is limited)

**Recommended Fix:**
1. For video generation, prefer Gemini API (AI Studio) which has better API key support
2. Only use Vertex AI for models that explicitly require it
3. Update `vertexai.ts` to detect video generation and route appropriately

---

## 🎬 Anime.js Global Architecture

### Current Problem
Anime.js usage is scattered across components with no central management:
- Each component imports and creates its own animations
- No shared timing functions or easing presets
- Memory leaks from animations not being cleaned up
- Inconsistent animation styles

### Proposed Architecture

**1. Central Animation Manager** (`src/utils/animationManager.ts`)
```typescript
import { animate, createTimeline, stagger, utils } from 'animejs';

// Global animation registry for cleanup
const activeAnimations = new Set<any>();

// Shared easing presets
export const EASINGS = {
  snappy: 'spring(1, 80, 10, 0)',
  smooth: 'easeOutQuad',
  bounce: 'easeOutBounce',
  elastic: 'easeOutElastic(1, .5)',
};

// Shared durations (ms)
export const DURATIONS = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  reveal: 800,
};

// Register animation for cleanup
export function registerAnimation(anim: any) {
  activeAnimations.add(anim);
  return anim;
}

// Cleanup all animations (call on route change, unmount)
export function cleanupAnimations() {
  activeAnimations.forEach(anim => {
    if (anim.pause) anim.pause();
  });
  activeAnimations.clear();
}

// Standard animation patterns
export const patterns = {
  fadeIn: (target: string | Element) => registerAnimation(
    animate(target, { opacity: [0, 1], duration: DURATIONS.normal, ease: EASINGS.smooth })
  ),
  
  slideUp: (target: string | Element) => registerAnimation(
    animate(target, { translateY: [20, 0], opacity: [0, 1], duration: DURATIONS.normal })
  ),
  
  staggerReveal: (target: string | Element, options = {}) => registerAnimation(
    animate(target, { 
      opacity: [0, 1], 
      translateY: [10, 0],
      delay: stagger(50, { from: 'first' }),
      ...options 
    })
  ),
  
  pulse: (target: string | Element) => registerAnimation(
    animate(target, { scale: [1, 1.05, 1], duration: DURATIONS.slow, loop: true })
  ),
};
```

**2. React Integration Hook** (`src/hooks/useAnimation.ts`)
```typescript
import { useEffect, useRef } from 'react';
import { cleanupAnimations } from '../utils/animationManager';

export function useAnimationCleanup() {
  useEffect(() => {
    return () => cleanupAnimations();
  }, []);
}

export function useAnimatedRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // Auto-cleanup on unmount
  return ref;
}
```

**3. Component Pattern**
```typescript
import { patterns, DURATIONS } from '../utils/animationManager';
import { useAnimationCleanup } from '../hooks/useAnimation';

function MyComponent() {
  useAnimationCleanup(); // Cleanup on unmount
  
  useEffect(() => {
    patterns.staggerReveal('.card-item');
  }, [data]);
  
  return <div className="card-item">...</div>;
}
```

---

## 📁 Code Organization Guidelines

### File Size Limits
- **Components**: Max ~400 lines. Split if larger.
- **Utility modules**: Max ~300 lines. Create submodules.
- **Page components**: Max ~600 lines. Extract sub-components.

### Naming Conventions
```
src/
├── components/
│   ├── cards/           # Card-related components
│   │   ├── CardGrid.tsx
│   │   ├── CardPreview.tsx
│   │   └── index.ts     # Barrel exports
│   ├── forge/           # Thor's Hamma related
│   └── shared/          # Reusable UI primitives
├── hooks/
│   ├── useAnimation.ts
│   ├── useDraggable.ts
│   └── index.ts
├── utils/
│   ├── animationManager.ts
│   ├── memoryUtils.ts
│   └── index.ts
├── contexts/
└── pages/
```

### Import Order
```typescript
// 1. React/Framework
import React, { useState, useEffect } from 'react';

// 2. Third-party
import { animate } from 'animejs';

// 3. Internal - absolute paths
import { useHand } from '@/contexts/HandContext';

// 4. Internal - relative
import { CardPreview } from './CardPreview';

// 5. Types
import type { Card } from '@/types';

// 6. Styles (if any)
import './styles.css';
```

---

## 🔍 Cultivation Checklist

When you see `🧹` or "Clean the House", run through this:

### Memory
- [ ] Are large data structures being nulled after use?
- [ ] Are event listeners being removed on cleanup?
- [ ] Are animations being paused/removed on unmount?
- [ ] Is there unnecessary data being held in state?

### Performance
- [ ] Are expensive computations memoized?
- [ ] Are lists virtualized if >100 items?
- [ ] Are images lazy-loaded?
- [ ] Are API calls debounced/throttled where appropriate?

### Code Quality
- [ ] Is the file under size limit?
- [ ] Are there duplicated patterns that could be extracted?
- [ ] Is the code self-documenting?
- [ ] Are there magic numbers that should be constants?

### Documentation
- [ ] Is the purpose of this file clear?
- [ ] Are complex algorithms explained?
- [ ] Are API contracts documented?
- [ ] Are workarounds marked with TODO/HACK comments?

### API Integration
- [ ] Is the API endpoint verified from official docs?
- [ ] Are error cases handled gracefully?
- [ ] Is there proper fallback behavior?
- [ ] Are API keys properly secured?

---

## 📚 Cross-Reference Documents

When working in specific areas, also consult:

| Area | Document | Purpose |
|------|----------|---------|
| Icons | `VALIDATION_PROTOCOL.md` | Verify from astrouxds.com |
| APIs | `VALIDATION_PROTOCOL.md` | Primary source validation |
| Animation | `ANIME_ANIMATION_GUIDE.md` | Anime.js patterns |
| White Screen | `ASTRO_ICONS_DEBUGGING.md` | Crash diagnosis |
| Thor's Hamma | `THORS_HAMMA_DESIGN.md` | Feature spec |
| Vertex AI | This file (above) | Current API status |

---

## 🧪 Testing Cultivation

Before committing significant changes:

1. **Memory check**: Run 3x of heavy operations, watch RSS
2. **Animation check**: Navigate between pages, check for jank
3. **Error check**: Intentionally trigger error paths
4. **Console check**: Clear, then look for warnings/errors

---

## 📝 Session Handoff Pattern

When ending a session or switching context, leave a trail:

```markdown
## Session Status [DATE]
- **Working on**: [Current task]
- **Blocked by**: [Any blockers]
- **Next steps**: [What to do next]
- **Memory concerns**: [Any observed issues]
- **Files touched**: [List of modified files]
```

---

## 🔄 Continuous Improvement

This document should evolve. When you discover:
- A new pattern that works well → Add it
- A pitfall to avoid → Document it
- A shorthand that saves time → Register it

Update this file. It's our shared brain.

---

*Last updated: 2025-12-08*
*Trigger: Memory crash after 3rd video loop, Vertex AI 400 errors*

---

## 🏗️ Structural Health & Modularity

### The Monolith Breaker Strategy
We have identified two massive files that slow down development and risk stability.

**1. The Frontend Monolith: `src/pages/CardLibrary.tsx`**
- **Current Status**: ~278KB. Mixes UI, Logic, Types, and Utilities.
- **Refactor Plan**:
  - `src/types/cards.ts`: Move `CardIndexEntry`, `CardType` interfaces here.
  - `src/components/cards/CardContent.tsx`: Extract the card rendering logic.
  - `src/hooks/useCardLibrary.ts`: Extract state and effects.
  - `src/utils/cardUtils.ts`: Extract helper functions (`toFileUrl`, etc.).

**2. The Backend Monolith: `electron/main.ts`**
- **Current Status**: ~215KB. Mixes IPC routing, Business Logic, and Config.
- **Refactor Plan**:
  - `electron/services/`: Create discrete services (`LlamaService`, `VisionService`).
  - `electron/handlers/`: Move IPC listeners into dedicated files.
  - `electron/config/`: Centralize default settings and type definitions.

### Configuration Singularity
**Problem**: API keys, model names, and feature flags are scattered (e.g., `USE_PROGRESSIVE_LOADING` in React, `VEO_VIDEO_MODELS` in Electron).
**Solution**:
- Create a single source of truth for "Capabilities" that passes from Electron → React on startup.
- Define feature flags in `src/config/flags.ts` (React) and `electron/config/flags.ts` (Electron).

### The "Ghost" State (Memory Leaks)
**Pattern to Avoid**: Global mutable variables in `main.ts` that accumulate data (e.g., logs, caches) without bounds.
**Fix**: Use LRU Caches (Least Recently Used) or explicitly bounded arrays for all in-memory logs.

---

## 🤝 Cultivation Rituals

### The "Stop the World" Check
Before adding a major feature (like a new AI model or Page):
1. **Check size**: Is the target file >400 lines? -> **Split it first.**
2. **Check import depth**: Are you importing from 4 levels up? -> **Alias or move.**
3. **Check types**: Are you defining `interface Props` inline? -> **Move to types file.**

### The "Boy Scout" Rule
"Leave the code cleaner than you found it."
- If you fix a bug in a large file, extract *one* small component or utility function from it.
- **Do not** refactor the whole file (too risky). Just chip away.

---

