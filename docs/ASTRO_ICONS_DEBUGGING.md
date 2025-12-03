# Astro Web Components & Icons Debugging Guide

## Issue Summary (Dec 2, 2025)
**Symptom:** Header and sidebar icons disappeared after code changes. App renders but `<rux-icon>` components show as empty.

---

## HYPOTHESIS LOG

### Hypothesis 1: Module Loading Failure (INCORRECT ❌)
**Theory:** New files with import errors caused Vite bundle to fail, preventing `defineCustomElements()` from running.
**Evidence Against:** 
- Reverted all files to committed versions
- Build passes without errors
- Icons still missing
**Conclusion:** This was NOT the root cause.

### Hypothesis 5: ToastProvider/Context Causes White Screen (CONFIRMED ✅)
**Theory:** Importing ToastProvider and wrapping the app causes a runtime crash
**Evidence:**
- Build passes without errors
- App shows white screen with native Electron menu (renderer crash)
- Removing ToastProvider wrapper fixes the app
**Root Cause:** Unknown runtime issue in ToastContext or Toast component. Possibly:
- Something in Toast.tsx that fails at runtime
- Import cycle issue
- Component that throws during render
**Fix:** Do NOT use ToastProvider until properly debugged

---

### Hypothesis 2: Vite Dev Server Stale State (CONFIRMED ✅)
**Theory:** The running Vite dev server or Electron process has cached stale state. File changes don't take effect until full restart.
**Evidence:**
- Simply reverting files DID NOT fix icons
- Killing all processes + fresh `npm run dev` DID fix icons
- HMR does not properly reload Astro custom elements
**CONFIRMED FIX:** 
1. Kill ALL running processes (Vite + Electron)
2. Clear Vite cache: `rm -rf node_modules/.vite dist-renderer`
3. Restart fresh: `npm run dev`

### Hypothesis 3: Astro Custom Elements Race Condition (POSSIBLE ⚠️)
**Theory:** `defineCustomElements()` is called but the elements aren't registered before React renders.
**Evidence For:**
- Custom elements need to be registered before they're used in DOM
- React might render before registration completes
**Potential Fix:** Ensure `setupAstro()` is called synchronously before `createRoot().render()`

### Hypothesis 4: Vite optimizeDeps Issue (POSSIBLE ⚠️)
**Theory:** Vite's dependency optimization is incorrectly handling Astro web components.
**Evidence:** Many `D` (deleted) entries in node_modules/.vite/deps during git status
**Potential Fix:** Add to vite.config.ts:
```typescript
optimizeDeps: {
  include: ['@astrouxds/astro-web-components'],
}
```

---

## Root Cause Analysis (UPDATED)

### What We Know
1. The app DOES render (not white screen)
2. Sidebar text labels ARE visible
3. Icons are NOT visible (empty `<rux-icon>` tags)
4. Build passes without errors
5. Icon SVG files exist in `public/icons/` (1058 files)
6. File reverts did NOT fix the issue

### What This Means
The issue is NOT with source code files. The issue is with:
- Running processes having stale state
- OR a runtime registration problem
- OR a path resolution issue

---

## IMMEDIATE FIX TO TRY

**The issue is likely stale processes. Do this:**

1. **Kill ALL processes:**
   - Close the Electron app completely (not just minimize)
   - In terminal: `Ctrl+C` to stop any running `npm run dev`
   - Check Task Manager for orphan node.exe processes

2. **Clear ALL caches:**
   ```powershell
   Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force dist-renderer -ErrorAction SilentlyContinue
   ```

3. **Fresh start:**
   ```bash
   npm run dev
   ```

4. **Verify icons load:** Open browser DevTools (F12) → Network tab → Filter by SVG → Should see requests to `/icons/chat.svg`, etc.

---

## HOW TO VERIFY FIX WORKED

Before assuming icons are fixed, check ALL of these:
- [ ] Sidebar has icons next to menu items (Chat, Card Library, etc.)
- [ ] Status bar has icons (memory icon, volume icon, bug icon)
- [ ] Open DevTools → Console → No errors about custom elements
- [ ] Open DevTools → Network → SVG requests to /icons/ return 200

---

## Files Involved
```
src/main.tsx          - Entry point, calls setupAstro()
src/astro/setupAstro.ts - Registers Astro components
src/App.tsx           - Main app router
src/components/Layout.tsx - Contains sidebar with rux-icon
public/icons/         - Contains SVG icon files
```

---

## FUTURE PREVENTION

### Lesson Learned
1. **File changes don't affect running processes** - Always restart dev server after significant changes
2. **Hot Module Reload doesn't work for web components** - Custom elements need full page reload
3. **Test before assuming** - Use DevTools to verify components are working, don't just look at the UI

### Best Practices
1. After creating new files, **restart dev server before importing them**
2. After ANY icon issue, **kill all processes and fresh start**
3. Keep DevTools Console open to catch errors early
4. When in doubt, **full restart**: Kill everything → Clear cache → npm run dev

### Pre-flight Checklist (Before Committing)
- [ ] `npm run build` passes without errors
- [ ] App renders correctly with fresh `npm run dev`
- [ ] Icons are visible
- [ ] No console errors

## Fix Applied
1. **Reverted `App.tsx`** to last committed version (removed Forge import)
2. **Reverted `Layout.tsx`** to last committed version (removed Forge nav item)
3. **Reverted `index.css`** to last committed version (removed Forge CSS)

## Prevention Guidelines

### DO:
1. **Commit incrementally** - Add new files and commit before adding complex features
2. **Test imports** - Before adding an import, ensure the file is syntactically valid
3. **Check build output** - Run `npx vite build --mode development 2>&1` to see errors
4. **Use TypeScript strictly** - Don't add `@ts-nocheck` unless absolutely necessary

### DON'T:
1. **Don't add routes to unfinished pages** - Only add routes when the page component is complete
2. **Don't modify multiple files at once** - Make one change, test, then make the next
3. **Don't ignore build warnings** - They often indicate future problems
4. **Don't create circular dependencies** - Especially with context providers

## Diagnostic Commands

### Check for build errors:
```bash
npx vite build --mode development 2>&1 | head -50
```

### Check for TypeScript errors:
```bash
npx tsc --noEmit --project tsconfig.app.json
```

### Clear Vite cache:
```bash
rm -rf node_modules/.vite dist-renderer
```

### Check git status for src:
```bash
git status --porcelain src/
```

### Revert a file to last commit:
```bash
git checkout HEAD -- src/path/to/file.tsx
```

## Recovery Checklist
When icons disappear:
1. [ ] Check browser console for errors
2. [ ] Check if `setupAstro()` is being called (add console.log)
3. [ ] Check git diff for recent changes
4. [ ] Run build to check for module errors
5. [ ] Revert recent changes one by one until working
6. [ ] Clear Vite cache and restart

## Related Memory
- **ASTROS Design Philosophy:** Dark theme, sci-fi aesthetic, custom UI
- **Never use native alerts:** Always use themed Toast/Modal components
- **RUX_ICONS_PATH:** Set to `/icons/` for icon resolution
