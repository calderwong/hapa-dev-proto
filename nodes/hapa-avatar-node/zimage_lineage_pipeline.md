# 🌀 Z-Image Variant Expansion Pipeline: Avatar → Phamiliar Lineage Generator

This pipeline defines a full automated workflow to take a single base profile image and generate an entire visual + lore expansion set, usable within the Hapa Protocol system. It interfaces with the Z-Image API (img2img), Hapa Media Server Node, and the card-generation ecosystem.

---

## STEP 1: Avatar Profile Input

- Input: `.png` image of base avatar (face/torso)
- Metadata required:
  - `name` (base identity)
  - `core traits`
  - `base role/class`
  - `style intent`
- Stored under `media/avatars/source/`.

---

## STEP 2: Generate 7 Visual Style Variants (img2img)

For each variant:
- Apply style prompt:
  - `fire-element warrior`
  - `water-themed ceremonial robes`
  - `techwear rogue`
  - `ritual cosmic armor`
  - `street samurai hoodie`
  - `soft monk robes with sigils`
  - `mirrorworld version (inverted colors/reflection fractals)`
- Output: 7 variant `.png` files
- Tag each variant with:
  - `style_id` (0–6)
  - `desc`
  - `colorPalette`
  - `base_of` → points to original input

---

## STEP 3: Generate 9 Action Poses per Variant

For each variant image:
- Use Z-Image (img2img) to produce 9 poses or activities:
  - Standing proud
  - Casting a spell
  - Sitting in thought
  - Walking calmly
  - Leaping forward
  - Shield raised
  - Hands in prayer
  - Teaching a student
  - Floating in meditation

Each receives:
- `pose_id` (0–8)
- `pose_desc`
- `action_type` (ritual / combat / idle / teaching / movement)
- Image path: `media/avatars/<name>/v<variant_id>_p<pose_id>.png`

---

## STEP 4: Track Lineage and Metadata

For all 63 outputs (7 variants × 9 poses):
- Auto-generate:
  - `name`: `BaseName-V{variant_id}-P{pose_id}`
  - `full_path`
  - `lineage`: {
      base_avatar,
      variant_style,
      pose_description,
      created_at
    }
  - `card_seed`: auto-populated with style/pose tags

Save to:
- `lineage.json`
- `index.card.yaml` bundle (optionally)

---

## STEP 5: Pipe to Hapa Media Server Node

Send full media + metadata bundle to:
`/api/media/ingest/zimage-avatar-expansion`

Payload:
```json
{
  "base_avatar_id": "AETH-0342",
  "name": "Aethel",
  "variants": [...],
  "media": [...],
  "traits": [...],
  "card_seeds": [...],
  "metadata_uri": "media/avatars/Aethel/index.card.yaml"
}
```

---

## STEP 6: Auto-Generate Cards, Care Links, and Connectors

As each image returns:
- Create a card:
  - `type: Avatar` or `Pose`
  - `rarity: uncommon`
  - `skills`, `familiar_bond`, `pose_tags`
- Add to a `Care Set` under the base name
- Link via `connector` cards to actions, locations, items, lore
- Render mini-previews via Hapa Forge
- If narrative tags included, auto-inject into lore graph

---

## STEP 7: Lore & Flavor Generation (Optional)

For each variant and pose:
- Generate:
  - 1-line epigraph
  - mini-bio (~60 words)
  - combat or memory quote
  - ritual affiliation (if exists)
  - location memory or dream
- Store in `lore/avatars/<name>/lore.v<variant_id>.p<pose_id>.md`

---

## Runtime Mode: Auto Queue vs. Manual Trigger

- Auto mode: Watches `/source/` folder and batch-expands new avatars
- Manual mode: CLI call:
  ```bash
  zimage-lineage-expander --file Aethel.png --name Aethel
  ```

---

## Requirements

- Z-Image API (img2img capability)
- Hapa Media Server Node with ingest endpoint
- Lore injector (GPT or fine-tuned)
- YAML + JSON writer
- Directory watch or task runner (Node or Python)