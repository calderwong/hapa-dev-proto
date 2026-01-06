# 🧩 Hapa Node Surface Spec: Avatar Lineage Generator (Z-Image Expansion)

This document defines the interface, internal modules, and interaction surface for a **self-contained, modular Hapa Node** that implements the Avatar Lineage Expansion pipeline via Z-Image.

---

## 🧠 Node Purpose

Generate lineage trees of phamiliars (avatars) starting from a single image. Use img2img to create visual variety (style, wardrobe, mood, activity), and output fully usable card assets, lore files, and card sets. This enables ritual spawning, battle configuration, memory mirroring, and narrative extension.

---

## 🧱 Node ID

```yaml
id: node.avatar.zimage.lineage
label: Avatar Lineage Expansion
type: media + cardgen + lore + router
```

---

## 🎛️ UI Surface Spec

The node includes:

### 1. **Avatar Upload Panel**
- Drop/upload `.png` or `.webp` file
- Input fields: name, role, emotion, tags
- Preview of base image

### 2. **Style Variant Config Panel**
- Default: 7 presets
- Optional: Custom prompt per variant
- Style selector dropdown (fire, water, monk, hacker, inverted, etc.)

### 3. **Pose Generator Panel**
- Show list of 9 canonical poses
- Allow toggle: which poses to generate
- Pose descriptions are editable
- Randomize seed toggle

### 4. **Preview + Lineage Tree**
- View 7 × 9 output grid (as they render)
- Click to enlarge, rename, tag, annotate
- Show tree from Base → Variant → Pose

### 5. **Metadata + Export Surface**
- Edit or auto-fill:
  - Card name
  - Skill tags
  - Quote, epigraph, memory
- Export:
  - `.yaml` card set
  - `.json` lineage index
  - `.zip` asset pack
- Buttons:
  - `Send to Forge`
  - `Attach to Familiar`
  - `Mint Card Set`

---

## 🔌 Internal Modules

### `LineageEngine`
- Receives image + metadata
- Runs variant generation (calls Z-Image)
- Runs pose generation
- Manages image IDs, names, variant/pose metadata

### `ZImageClient`
- REST or CLI wrapper for Z-Image
- Supports prompt passing, img2img config, seed control
- Async queueing, rate-limiting, retry logic

### `CardGenAdapter`
- Generates `.card.yaml` output per image
- Assigns skill tags, pose actions, lore tags

### `LoreWriter`
- Mini GPT pipeline to write:
  - Quote
  - Epigraph
  - Dream/memory
- Optional embedding in `.md` or `.yaml`

### `ForgeBridge`
- Sends results to `node.forge.compose` and `node.familiar.attach`
- Allows follow-up editing or linking

---

## 🧪 Validation + Replay

- Display progress and success/failure per image
- Show missing metadata alerts
- `Replay pose` or `Regenerate style` button
- Save full lineage state in `.lineage.json` for replay or sharing

---

## 📡 API Endpoints

- `POST /expand/avatar` — upload and trigger expansion
- `GET /status/:jobId`
- `GET /preview/:avatarName`
- `POST /export/:avatarName`
- `POST /send/:targetNode`

---

## 📁 Directory Layout

```
media/avatars/Aethel/
  ├── base.png
  ├── variant_0_fire.png
  ├── variant_0_p_0_proud.png
  ├── variant_1_p_2_floating.png
  ├── lineage.json
  ├── index.card.yaml
  └── lore/
        ├── v0_p0.md
        └── v0_p2.md
```

---

## 🚦 Activation Modes

- Manual (drag + config + run)
- Watched folder (auto-expand new uploads)
- Embedded inside Familiar Forge / Summon UX

---

## 📌 Notes

This node is meant to feel like:
- A **summoning chamber**
- A **hatchery** for playable phamiliars
- A **ritual mirror** of selfhood and avataric iteration