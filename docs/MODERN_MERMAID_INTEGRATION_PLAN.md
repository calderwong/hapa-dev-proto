# Modern Mermaid Integration Plan

## Overview

Integrate [gotoailab/modern_mermaid](https://github.com/gotoailab/modern_mermaid) as a new sub-app in Hapa Node, accessible via the left sidebar menu.

## What is Modern Mermaid?

A modern Mermaid.js diagram editor with:
- **10+ Themes**: Linear, Industrial, Hand Drawn, Studio Ghibli, Retro, etc.
- **Live Preview**: Real-time diagram rendering
- **Export**: PNG/JPG export, clipboard copy, 3x resolution
- **Annotation Tools**: Arrows, shapes, text overlays
- **Diagram Types**: Flowcharts, sequence, class, state, ERD, Gantt, mindmaps, etc.

## Tech Stack Compatibility

| Technology | Modern Mermaid | Hapa Node | Compatible? |
|------------|----------------|-----------|-------------|
| React | 19.2 | 18.x | ✅ (close enough) |
| TypeScript | 5.9 | 5.x | ✅ |
| Vite | 7.2 | 6.x | ✅ (already using) |
| Tailwind | 4.1 | 3.x | ⚠️ (version diff) |
| Icons | Lucide | Astro UXDS | ⚠️ (mix allowed) |

## Integration Strategy

**Approach: Component Embedding**
- Clone the core editor components into `src/pages/Mermaid.tsx`
- Keep it self-contained with minimal cross-dependencies
- Use existing mermaid.js dependency (or add it)
- Reuse Tailwind already configured in Hapa

## Implementation Steps

### Phase 1: Setup ⏱️ ~10 min
- [ ] Add `mermaid` and `html-to-image` dependencies
- [ ] Add `lucide-react` for icons (Modern Mermaid uses this)

### Phase 2: Page Creation ⏱️ ~20 min
- [ ] Create `src/pages/Mermaid.tsx` - Main editor page
- [ ] Port core editor UI from Modern Mermaid
- [ ] Adapt styling to use existing Tailwind + Astro aesthetic

### Phase 3: Routing ⏱️ ~5 min
- [ ] Add route in `src/App.tsx`
- [ ] Add nav item in `src/components/Layout.tsx`

### Phase 4: Testing ⏱️ ~10 min
- [ ] Verify editor renders diagrams
- [ ] Test export functionality
- [ ] Ensure theme switching works

## Files to Create/Modify

### New Files
```
src/pages/Mermaid.tsx          # Main editor page
```

### Modified Files
```
src/App.tsx                    # Add route
src/components/Layout.tsx      # Add nav item
package.json                   # Add dependencies
```

## Nav Item Configuration

```typescript
{ path: '/mermaid', label: 'Diagrams', icon: 'schema' }
```

Position: After "Wiki" in the navigation (creative/documentation tools section)

## Dependencies to Add

```bash
npm install mermaid html-to-image lucide-react
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tailwind version mismatch | Use existing Tailwind classes, avoid v4-specific features |
| React 19 vs 18 features | Avoid React 19-only APIs |
| Large bundle size | Mermaid.js is ~1MB, but only loaded on diagram page |

## Future Enhancements (Deferred)

- Save diagrams to Hypercore
- Create diagram cards in Card Library
- AI-assisted diagram generation
- Wiki page diagram embeds

---

## Execution Checklist

1. [x] Review Modern Mermaid documentation
2. [x] Create integration plan
3. [x] Install dependencies (`mermaid`, `html-to-image`, `lucide-react`)
4. [x] Create Mermaid.tsx page with full editor
5. [x] Add routing in App.tsx
6. [x] Add nav item in Layout.tsx
7. [ ] Test functionality

## Implementation Notes

**Dependencies Added:**
- `mermaid` - Diagram rendering engine
- `html-to-image` - Export diagrams as PNG/JPG
- `lucide-react` - Icons for toolbar

**Features Implemented:**
- Split-pane editor (code left, preview right)
- Live preview with 300ms debounce
- 8 sample diagram templates
- 5 Mermaid themes
- PNG export with 3x resolution
- Copy to clipboard
- Fullscreen mode
- Clear/refresh controls
- Syntax error display
- Status bar with line/char counts
- Link to Mermaid docs
