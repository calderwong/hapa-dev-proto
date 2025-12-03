# Troubleshooting: RUX Icons and Header Not Displaying

## Date: December 3, 2025

## Problem Description
After adding the 3D Card Viewer feature (with Three.js, React Three Fiber, and Zustand), the RUX (Astro UXDS) web components stopped rendering:
- Sidebar icons are missing (Chat, Hapa's Forge, Card Library, etc.)
- Top header bar (rux-global-status-bar) is not displaying
- The rux-icon components render empty

## Initial Diagnosis

### First Attempt: Stencil Timing Issue
**Hypothesis**: React was rendering before Stencil.js finished registering the web components.

**Evidence**: Console showed:
```
TypeError: Cannot read properties of undefined (reading '$instanceValues$')
```

**Fix Applied**: Modified `setupAstro()` to return a Promise and wait for it in `main.tsx`:
```typescript
// main.tsx
setupAstro().then(() => {
  createRoot(document.getElementById('root')!).render(...)
})
```

**Result**: The `$instanceValues$` error is GONE, but icons still don't appear.

## Current State (Still Broken)

### What Works
- ✅ No more Stencil runtime errors in console
- ✅ App loads and renders correctly otherwise
- ✅ Web components are being registered (no registration errors)
- ✅ The RUX button component works (seen in "Configure Video Options")

### What Doesn't Work
- ❌ `<rux-icon>` components render empty/invisible
- ❌ `<rux-global-status-bar>` doesn't show its content
- ❌ Sidebar navigation items have no icons

## Root Cause Analysis

### Possible Causes
1. **Icon path not resolving**: `RUX_ICONS_PATH` set to `/icons/` but files may not be served in dev mode
2. **CSS conflict**: Tailwind or other styles may be hiding icons
3. **Shadow DOM issue**: Icons inside shadow DOM may not have access to external resources
4. **Vite dev server**: Static assets in `/public` may need different handling

### Evidence to Check
- [ ] Open Network tab - are `/icons/*.svg` requests being made?
- [ ] Check if requests return 200 or 404
- [ ] Inspect rux-icon element - is there an SVG inside the shadow DOM?
- [ ] Check console for any icon-related errors

## Fix Plan

### Step 1: Verify Icon Files Are Being Served
Check if Vite is serving the `/icons/` directory properly in dev mode.

### Step 2: Check RUX Icon Configuration
The `@astrouxds/astro-web-components` may need a different icon path configuration for Vite.

### Step 3: Try Alternative Icon Loading
Some versions of RUX components require icons to be bundled differently.

### Step 4: Add Debug Logging
Add console logs to verify what icon path is being used at runtime.

## Implementation

### Changes Made
1. `src/astro/setupAstro.ts` - Returns Promise, better error handling
2. `src/main.tsx` - Waits for setupAstro before rendering
3. `src/index.css` - Added @import for astro-web-components.css

### Next Steps
1. Check Network tab for icon requests
2. Verify `/public/icons/` contains all needed SVG files
3. May need to configure Vite to handle the icons differently

---

## Fix Attempt #2: Vite Configuration for Stencil

### Understanding How RUX Icons Work
After examining the source code:
1. `<rux-icon icon="chat">` renders a `<rux-icon-chat>` element inside its shadow DOM
2. Each icon is a separate Stencil web component (`rux-icon-chat`, `rux-icon-settings`, etc.)
3. Stencil lazy-loads these components by requesting `p-xxxxxxxx.entry.js` files
4. These files are in `node_modules/@astrouxds/astro-web-components/dist/astro-web-components/`

### The Problem
In Vite dev mode, Stencil tries to load these entry files from relative paths, but:
- Vite pre-bundles node_modules dependencies
- The lazy-loaded entry files aren't accessible at the expected paths
- The icon components fail to load silently

### Fix Applied
Updated `vite.config.ts` to:
1. Configure `server.fs.allow` to serve from node_modules
2. Add alias for the astro-web-components path
3. Include Stencil core in optimizeDeps

```typescript
optimizeDeps: {
  include: ['@stencil/core'],
},
resolve: {
  alias: {
    '@astrouxds/astro-web-components': path.resolve(__dirname, 'node_modules/@astrouxds/astro-web-components'),
  },
},
server: {
  fs: {
    allow: ['.', 'node_modules/@astrouxds'],
  },
},
```

## Resolution
**Testing required** - restart `npm run dev` and check if icons appear.
