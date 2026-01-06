# Gravity Design Protocol – Overwatch Folder Specification

This document defines the **Gravity Design Protocol** for the Hapa Node workspace, built atop the Mode Gravity foundation and extended for Overwatch-level agent enforcement, UX continuity, and AI-collaborative tooling.

---

## 🎯 Purpose

The Gravity Design Protocol provides a universal language and control system for how the UI reconfigures itself around user **intent**. It ensures:
- Clarity in dense UIs.
- Intent-guided information flow.
- Subsystem-level participation in Mode Gravity.
- Cognitive protection and adaptive pacing for users.
- Extensibility for AI tooling, dev environments, and ritual-based apps.

---

## 🧭 Canonical Modes

Each mode is a lens of attention and behavior. They do **not** represent screens.

| Mode     | Intent                          | Primary Surface         |
|----------|----------------------------------|--------------------------|
| `browse` | Explore what exists              | Card Library             |
| `inspect`| Understand one card in depth     | Inspector Panel          |
| `navigate`| Explore connections & structure | 3D Nexus                 |
| `forge`  | Change or mutate the system      | Forge Panel (Step Rail)  |
| `compose`| Create intentional assemblies    | Blank Canvas UI          |

---

## 🎚️ Gravity State Object

```ts
interface UiModeState {
  panelOpacity: number;
  backgroundBlurPx: number;
  animationSpeed: "slow" | "medium" | "sharp";
  panelLocking: "none" | "partial" | "full";
  inputDensity: "low" | "medium" | "high";
  dataDensity: "low" | "medium" | "high" | "ritual";
}
```

Use this schema in `gravity/uiModes.ts` and build from a single `MODE_CONFIG` map.

---

## 🧠 Gravity Loop Subscription

Subsystems should respond to mode changes via:

```ts
onUiModeChange(mode: UiMode, config: UiModeState): void;
```

Examples:
- Nexus animates edges only in `navigate`
- Forge disables ambient visuals
- Card Library reduces label count in `browse`

---

## 🧱 Visual Gravity Anchors

For embodied feel of mode:

- **Glyph per mode** (🌌, 🛠, 🔍, 🎛, 🌱)
- **Soft tint gradients**
- **Single underline on active mode tab**
- **Mode hums or confirmation tones (opt-in)**

---

## 🧃 Affordance Mapping

Each mode implies affordances:

| Mode     | Permitted Actions                  | Forbidden Actions     |
|----------|-------------------------------------|------------------------|
| browse   | Search, Preview, Pin                | Mutate, Fork          |
| inspect  | Drill, Add Tag, Reveal Relations    | Fork, Forge           |
| navigate | Orbit, Depth Traverse, Cluster      | Edit, Mutate          |
| forge    | Clone, Forge, Diff Preview          | Tag, Search           |
| compose  | Assemble, Export, Declare           | Explore, Orbit        |

---

## 🧼 Escape Protocol

- Universal `ESC → browse`
- If render fails: auto-reset to `browse` with toast
- Agents must implement gravity reset check

---

## 📓 Gravity Journaling (Optional)

Track and persist:
- Mode transitions per session
- Time spent per mode
- Cards created in each mode
- Active density & intent on card generation

---

## 📦 Overwatch Implementation Checklist

- [x] `UiMode` enum + `MODE_CONFIG` mapping
- [x] Top-center mode switcher
- [x] Panels subscribe to `uiMode` via Gravity Loops
- [x] DevTools: mode footprint output/log
- [ ] Optional: Glyphs, hums, visual anchors
- [ ] Optional: Journaling, data density, AI hints
- [ ] Optional: Multiplayer mode colors

---

## 🧙 Philosophy

The interface should **breathe** with the user.

Not flashy. Not rigid. But intelligent, calm, and tuned to intention.

> “A thinking space, not just a tool.”

---

To extend this protocol, fork this file as `README.md` in your Overwatch folder, and append new gravity-affecting subsystems as needed.