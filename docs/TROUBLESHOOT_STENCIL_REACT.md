# Stencil + React Initialization Problem

## Date: 2025-12-03

## The Problem
Astro UXDS web components (built with Stencil.js) fail with:
```
TypeError: Cannot read properties of undefined (reading '$instanceValues$')
```

This happens when React renders components that contain `<rux-icon>`, `<rux-global-status-bar>`, etc.

## Key Observations

1. **The error happens AFTER components render** - We can see `class="hydrated"` on elements in the console, meaning Stencil thinks they rendered successfully
2. **It's a getter access error** - `RuxIcon.get [as icon]` suggests it's triggered when accessing a prop
3. **Multiple components affected** - rux-icon, rux-option, rux-button all fail
4. **The icons path IS set correctly** - `/icons/` is configured in index.html

## What We've Tried (Unsuccessfully)

1. **Waiting for defineCustomElements()** - Didn't help
2. **Adding delays (50ms, 100ms)** - Didn't help  
3. **Waiting for customElements.get()** - Element is registered but still fails
4. **Checking for Stencil internals ($hostElement$)** - Didn't help
5. **Setting RUX_ICONS_PATH in index.html** - Icons path is fine, rendering is the issue

## Root Cause Hypothesis

The Stencil lazy-loader registers the custom element immediately, but the actual component implementation is loaded asynchronously. When React renders immediately after registration:

1. Custom element is in registry ✓
2. Element is created in DOM ✓
3. Stencil's "hydration" starts ✓
4. But internal state (`$instanceValues$`) isn't initialized yet ✗
5. A getter/setter access triggers before initialization ✗

## Potential Solutions to Explore

### 1. Use the ESM Bundle Instead of Lazy Loader
Instead of:
```js
import { defineCustomElements } from '@astrouxds/astro-web-components/loader';
```
Try:
```js
// Direct ESM import that includes all components
import '@astrouxds/astro-web-components';
```

### 2. Disable React StrictMode (Temporary Test)
StrictMode intentionally double-renders - this might trigger the race condition:
```jsx
// Test without StrictMode
createRoot(document.getElementById('root')!).render(<App />);
```

### 3. Create a Wrapper Component
Delay rendering children until Stencil is truly ready:
```jsx
function StencilReady({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Check on next tick after mount
    requestIdleCallback(() => setReady(true));
  }, []);
  return ready ? children : <LoadingScreen />;
}
```

### 4. Use @stencil/react-output-target
Stencil has an official React wrapper generator:
https://stenciljs.com/docs/react

This creates proper React components that handle the lifecycle correctly.

### 5. Pre-render a Hidden Instance
Force Stencil to fully load by rendering hidden components first:
```jsx
// In App.tsx, render hidden instances to "warm up" Stencil
<div style={{ display: 'none' }}>
  <rux-icon icon="check"></rux-icon>
</div>
```

### 6. Use Vite's optimizeDeps.include
Force Vite to pre-bundle the entire Stencil package:
```js
optimizeDeps: {
  include: [
    '@astrouxds/astro-web-components',
    '@astrouxds/astro-web-components/loader'
  ]
}
```

### 7. Check for Existing Solutions
- Look at astro-uxds GitHub issues
- Check Stencil + Vite + React combinations
- See if there's a known workaround

## Current Fix Attempt (Dec 3, 2025)

Loading Astro in index.html with top-level await BEFORE main.tsx runs:

```html
<script type="module">
  import { defineCustomElements } from '/node_modules/@astrouxds/astro-web-components/loader/index.js';
  await defineCustomElements(window);
  window.__ASTRO_READY__ = true;
</script>
```

Then main.tsx waits for `window.__ASTRO_READY__` before rendering React.

This ensures:
1. defineCustomElements runs BEFORE any React code
2. All component lazy-loading completes before React renders
3. No race condition between Stencil and React

## Next Steps

1. ✅ Solution #1 attempted - ESM bundle via loader
2. ✅ Solution #2 attempted - disabled StrictMode  
3. ✅ Solution #5 attempted - hidden warmup elements
4. **NEW** Solution #8 - Load in index.html with top-level await
5. Long-term: Consider Solution #4 (official React wrappers)

## Notes for Future Reference

This problem occurs when combining:
- Stencil.js web components (lazy-loaded)
- React 18 with StrictMode (double-renders)
- Vite dev server (HMR might also trigger)

The timing between "custom element registered" and "component fully initialized" is the critical gap.
