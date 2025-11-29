# Astro UXDS Design System – Notes for Hapa Node

> This document summarizes key points from the Astro UXDS public documentation (astrouxds.com) and the Astro Web Components GitHub repository, then maps them to the Hapa Node app. It is intended as an internal working reference, not as a replacement for the official docs.

## 1. High‑level overview

- **Astro UXDS** is a space‑focused UX design system providing:
  - Design process guidance (research, UI design, visual design, compliance).
  - A visual design language (icons, typography, color, layout patterns).
  - A Web Component library (Stencil‑based) plus wrappers for popular frameworks.
  - Design/development assets (Figma libraries, Storybook, sample apps).
- **Goal:** give space‑system apps a consistent, observable, operations‑friendly UX with best practices baked in.

### 1.1 Design process

Astro emphasizes a user‑centered, research‑driven process:

- **Research:** understand operators, missions, environments and workflows before designing screens.
- **UI Design:** interaction patterns for monitoring, commanding, investigation, scheduling, etc.
- **Visual Design:** mature system of layout, density, color usage, and hierarchy.
- **Compliance:** guidance for when an application can call itself “Astro‑compliant”.

For Hapa Node this suggests:

- Treat **Wormhole**, **Card Library**, **Wiki**, **Chat**, and **Admin** as distinct *mission workflows*.
- Bring observability forward (status indicators, alarms, connection state) rather than only raw logs.

### 1.2 Licensing

From the Astro “Getting Started” licensing section:

- Astro is developed under a US government contract; the design system and sample code are in the **public domain in the US**.
- Rocket Communications grants a **world‑wide, royalty‑free license** to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software under certain conditions (notably preserving the copyright notice and accepting an "AS IS" warranty disclaimer and liability waiver).

Implications for Hapa:

- We can safely **bundle Astro Web Components and CSS** within Hapa Node.
- We may incorporate patterns and sample code, but should keep attribution in LICENSE / About.

## 2. Developer‑facing pieces

### 2.1 Astro Components (Web Components)

Key points from "Getting Started for Developers" + "Getting Started with Astro Web Components":

- Astro ships **Stencil‑powered Web Components**, distributed as npm packages.
- There are **framework wrappers** (React and Angular), but the core is framework‑agnostic.
- Benefits of Web Components in Astro’s framing:
  - Style scope isolation and encapsulation.
  - Portable HTML/CSS/JS that is generic and framework‑neutral.
  - Stable API independent of CSS class naming.
  - Works across modern browsers and can slot into many JS frameworks.

For Hapa Node:

- We run **React 19 + Vite 7 inside Electron**, which is compatible with Web Components.
- We can either:
  - Use the **React wrapper package** (preferred for TS ergonomics), or
  - Use the raw custom elements (`<rux-*>`) directly with TypeScript declarations.

### 2.2 Icons, fonts, colors, and design tokens

From "Getting Started for Developers":

- Astro exposes **Design Tokens** (colors, spacing, typography) that can be consumed even without Web Components.
- Icons are provided as **SVG assets** (GitHub + Figma icon library).
- Typography standard: **Roboto**.

For Hapa Node:

- Our Tailwind config can be augmented to **derive colors and typography from Astro tokens** where possible.
- We can start by:
  - Mapping Astro primary / secondary / status colors to Tailwind custom colors.
  - Standardizing on Roboto for core UI text, with Hapa brand styling layered on top if desired.

### 2.3 Storybook, sample apps, and offline resources

- Astro maintains a **Storybook** with component docs and live examples.
- There are **sample apps** that demonstrate full dashboards/monitors/etc. (older release, not boilerplates for new work but useful for patterns).
- Offline bundles and Gzip archives exist for disconnected environments.

For Hapa Node:

- Storybook is the primary reference for **component behavior, props, and composition patterns**.
- Sample apps can inform how to lay out:
  - A main application shell with side navigation and global status.
  - Dense data views (tables, logs, timelines).
  - Monitoring/alerting patterns relevant to: ingest pipelines, P2P health, LLM backends.

## 3. How Astro maps onto Hapa Node

### 3.1 Current Hapa surfaces

- **Chat** – conversational interface + card creation.
- **Card Library** – grid/list of cards with previews and a details modal.
- **Wormhole** – ingestion console and global ingest feed.
- **Wiki** – term browser + detail panel.
- **Revid Media / Local Llama / Settings / Admin / P2P Network** – operational/administrative screens.

### 3.2 Likely Astro patterns to leverage

Conceptually, Astro tends to provide:

- **App shell**: navigation rails, app bar / toolbar, global status indicators.
- **Layout**: page templates, panels, split views, grids.
- **Data display**: tables, lists, detail panels, badges, chips, progress and status indicators.
- **Controls**: buttons, dropdowns, tabs, sliders, checkboxes, toggles.
- **Feedback**: toasts, banners, inline error/alert states.

Initial mapping:

- **Sidebar + top bar** → Astro app shell / nav components.
- **Card Library grid + modal** → list/grid components + detail panel pattern.
- **Wormhole ingest feed** → data table/list with status badges and actions.
- **Wiki page** → master/detail layout with a navigable list of terms and a right‑hand panel.
- **Settings** → standard forms, toggles, selects, grouped into Astro form layout.

### 3.3 Constraints / considerations for integration

- We already use **Tailwind** heavily; Astro brings its own CSS and tokens. We need a strategy so they **co‑exist without fighting**.
- Web Components in React/Electron require:
  - Custom elements support (fine in Chromium).
  - Possibly polyfills if targeting older engines (not needed for modern Electron).
  - Careful styling of host containers when mixing Tailwind utility classes and shadow‑DOM content.
- Accessibility: Astro components are designed with a11y in mind; we should **not override semantics** and ensure any custom wrappers preserve ARIA attributes.

## 4. Integration plan for Hapa Node

This is intentionally incremental. The goal is to bring in Astro without destabilizing the app.

### Phase 0 – Repo hygiene and exploration

1. **Confirm license alignment**
   - Add a short note in our README and LICENSE acknowledging use of Astro UXDS assets.
2. **Spike environment**
   - Create a small internal React page (e.g., `/astro-lab`) that mounts a few Astro components.
   - Verify bundling via Vite + Electron works and shadow DOM styling looks correct on Windows.

### Phase 1 – Add Astro packages and wiring

1. **Install dependencies** (exact package names to be confirmed from the Astro README):
   - `@astrouxds/astro-web-components`
   - React wrapper package if available (e.g., a `@astrouxds/react` or similar package; check GitHub for current name).
2. **Global setup file** (e.g., `src/astro/setupAstro.ts`):
   - Import the component bundle once so custom elements are defined.
   - Import base Astro CSS (or set up CSS via Vite).
3. **Entry wiring**
   - Call the setup function from our top‑level `main.tsx` or `App.tsx` so components are registered before first use.

### Phase 2 – Design tokens and theme alignment

1. **Extract key Astro tokens**
   - Primary/secondary colors, success/warning/error, background, surface, border, text.
   - Typography tokens for body, headings, captions.
2. **Tailwind bridge**
   - Extend `tailwind.config.cjs`/`ts` to map Astro tokens into custom colors and font families.
   - Gradually refactor existing hard‑coded colors to use these semantic tokens.
3. **Global styles**
   - Ensure base app background, text color, and link styles align with Astro visual design while preserving Hapa’s brand voice.

### Phase 3 – Component wrapper layer

1. **Create React wrappers** in `src/components/astro/` as needed, for example:
   - `AstroButton`, `AstroBadge`, `AstroTabs`, `AstroPanel`, `AstroStatusChip`, etc.
   - Each wrapper:
     - Exposes idiomatic React/TS props.
     - Delegates to the underlying Astro custom element.
     - Handles controlled/uncontrolled patterns where needed.
2. **Bridge to existing primitives**
   - Replace or refactor our local `Button` and `PageContainer` components to either:
     - Directly use Astro wrappers, or
     - Wrap Astro components internally while retaining the same Hapa component API.
3. **Documentation**
   - Add a simple `ASTRO_UXDS_NOTES.md` (this file) and perhaps Storybook‑like examples within the repo for local dev reference.

### Phase 4 – Incremental page migrations

For each major page, do a focused pass:

1. **Layout & navigation**
   - Migrate shell/side‑nav and top bar to Astro layout components.
2. **Page‑level patterns**
   - **Chat:** use Astro form controls and panels for input, attachments, and history; consistent scroll and density.
   - **Card Library:** use Astro grid/list/table components, badges for Wormhole status, standard modals for card details.
   - **Wormhole:** treat as a monitoring/command console with Astro buttons, forms, status indicators for ingest and processing.
   - **Wiki:** master/detail layout, filters, and selection using Astro list + panel components.
3. **Feedback & status**
   - Replace ad‑hoc toasts/messages with Astro’s notification/alert patterns where available.

Each migration should:

- Keep the existing data/IPC behavior intact.
- Be behind feature flags if needed (e.g., `ASTRO_EXPERIMENTAL_UI`).

### Phase 5 – Hardening and compliance

1. **A11y pass**
   - Verify keyboard navigation, focus management, ARIA roles, and color contrast with Astro in place.
2. **Performance and bundle size**
   - Measure Electron bundle size impact and render performance.
   - Tree‑shake unused Astro components where feasible.
3. **Design review**
   - Compare the app against Astro’s compliance guidance; document deltas where Hapa intentionally diverges.

## 5. Practical usage notes for future work

- When adding new UI, **prefer Astro components or wrappers** over bespoke Tailwind UIs.
- Use **Astro Storybook** as the source of truth for behavior before building custom interactions.
- Keep **Hapa‑specific branding and information architecture** on top of Astro, not instead of it.
- For any new feature (e.g., advanced Wormhole dashboards), start by sketching in Figma using the Astro libraries, then implement with the matching Web Components.
