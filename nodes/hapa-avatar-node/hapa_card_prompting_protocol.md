# 🎴 Hapa Card Prompting Protocol

This protocol defines best practices for generating high-quality main images for Hapa Cards using text-to-image models (e.g., Z-Image, ComfyUI, Stability, Midjourney). These prompts power the visual canon of the Hapa Protocol and are critical for user engagement, gameplay clarity, and system-wide vibe coherence.

---

## 🧠 Philosophy

A Hapa Card is not just a picture — it’s a **compressed semantic object**: emotion, function, lore, and gameplay in a glance.

Prompts must:
- Communicate *role* and *function* clearly.
- Evoke a consistent *emotional tone* or *vibe*.
- Compress identity into *visually rich, symbolic form*.
- Feel like they “belong in the same world” as other cards.
- Be **generative**: a good image inspires mechanics, lore, names, and future cards.

---

## 🧰 Card Prompt Structure

```
<archetype/subject>, <design intent or function>, <environment>, <emotion/tone>, <style keywords>, <composition>, <camera>, <lighting>, <colors>
```

Each section is optional but improves specificity.

---

## 📦 Prompt Templates by Card Type

### 1. 🧍‍♂️ Avatar Cards
```
a futuristic shamanic wanderer with biomechanical wings, designed to navigate temporal storms, wearing glowing layered fabrics, standing in a desert of broken code, aura of conviction and loss, shot with 85mm lens, soft dusk light, detailed character portrait, cinematic realism
```

### 2. 🌌 Concept Cards
```
an abstract representation of recursion, composed of layered geometric spirals, glowing runes forming a vortex, subtle motion blur, looks like a metaphysical diagram from a cosmic operating system, sacred math aesthetic
```

### 3. 🛠 Skill / Function Cards
```
a glowing circuit shaped like a lotus unfolding, each petal representing a subprocess, sparks of data flowing from its center, backdrop is deep void with stars, evokes the feeling of learning and calm power, digital glyph UI style
```

### 4. 🛸 Spaceship Cards
```
a sleek biomechanical ship shaped like a manta ray, glowing with blue veins of energy, piloted by a crew of cards, thrusters emit rings of sound and color, cruising through abstract hyperspace lanes, illustrated in a detailed sci-fi anime style
```

### 5. 🎵 Song / Memory Cards
```
a crystalline soundwave rising from a pool of memories, each frequency node shows a flash of someone’s past, color-coded trails dancing in the air, background is a forest of speakers and light tendrils, vibing like a sacred techno shrine
```

### 6. 🧾 Name Cards (e.g., for Words, Laws, Declarations)
```
a divine scroll hovering mid-air, etched in golden fractal script, unfurling slowly under a spotlight of universal judgement, paper made of memory threads and truth, background is infinite library with stars between the shelves
```

---

## ✅ Validation Criteria

A prompt is considered **GOOD** if it meets at least **4 of 6**:

1. **Clarity of Subject** — you can tell *what it is and what it does*
2. **Tone/Vibe Match** — matches the mood of the intended game effect or lore
3. **Symbolic Power** — includes at least one strong metaphor or encoded idea
4. **Visual Composition** — avoids clutter; reads well as a card at small scale
5. **Believability in Universe** — fits with other cards from same game or mode
6. **Inspiration Trigger** — makes you want to write a mechanic, lore, or skill

If a prompt fails 3+ of these, it must be refined.

---

## 🌀 Common Style Tags

Use 2–4 per prompt:
- `digital sacred geometry`
- `cosmic circuitry`
- `anime x biopunk`
- `ritual sci-fi interface`
- `futurist tarot`
- `holographic minimalism`
- `cybernetic dreamscape`

---

## 📁 Storage & Versioning

Each prompt:
- Saved as `.prompt.txt` with metadata
- Linked to `card.json` or `entry.card.yaml`
- Includes version, model target, tags, rating, generator, seed (if available)

---

## 🤖 AI Feedback Loop (Optional)

After generation:
- Prompt + output logged
- Embed feedback: “did this image feel right?”
- Tag as: `usable`, `meh`, or `refine`
- Prompts with high `usable` counts are promoted as templates

---

## 🧙 Closing Note

Card prompts are **compressed soul-casts**. They are the way memory, emotion, logic, and function crystallize into shareable reality.

Write like you’re encoding myth into vision.

**Quality = Depth x Symbol x Vibe x Function**