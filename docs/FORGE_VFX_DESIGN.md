# Hapa's Forge: Visual Effects & Feedback Design

## Objective
Enhance the "Ritual of Synthesis" by providing visceral feedback that cards placed in the pillars are active energy sources. Differentiate their influence based on stack priority (order in the list).

## The Metaphor
*   **The Pillars (Crucibles)**: Conductors that channel the energy of the cards.
*   **The Cards (Reagents)**: Active power sources (batteries/souls).
    *   **Top Card (Primary Driver)**: High voltage, rapid oscillation, blinding brightness. The core personality trait.
    *   **Middle Cards (Supporting)**: Stable flow, steady light.
    *   **Bottom Cards (Subconscious)**: Dim glow, slow hum. Deep-seated traits.

## Visual Design Specification

### 1. The "Energy" Border
Instead of a static border, we will use a dynamic, glowing effect that simulates "active power".
*   **Style**: Neon Pulse / "Breathing" Light.
*   **Colors** (Matching Triad):
    *   **Love**: Red/Rose Neon (`rgb(244, 63, 94)`)
    *   **Truth**: Cyan/Blue Neon (`rgb(34, 211, 238)`)
    *   **Conviction**: Emerald/Green Neon (`rgb(16, 185, 129)`)

### 2. Priority-Based Intensity System
We will map the `index` of the card in the stack to visual variables to subtly hint at its weight in the generation algorithm.

| Priority (Index) | Role | Opacity (Alpha) | Glow Radius (Max) | Animation Speed |
| :--- | :--- | :--- | :--- | :--- |
| **0 (Top)** | **Prime Driver** | 1.0 (Intense) | `15px` | Fast (2s loop) |
| **1** | **Support** | 0.7 (Strong) | `10px` | Medium (3s loop) |
| **2** | **Influence** | 0.5 (Moderate) | `6px` | Slow (4s loop) |
| **3+** | **Subconscious** | 0.3 (Faint) | `3px` | Static / Breathing (6s) |

### 3. Animation Technique
We will use CSS variables/custom properties injected at runtime to control the animation for each specific card instance.

**Keyframes Concept (`@keyframes forge-pulse`)**:
*   Oscillate `box-shadow` from a minimal glow to a maximum glow.
*   Oscillate `border-color` opacity.
*   Top cards will pulse faster and brighter.

## Implementation Plan

### Step 1: CSS Definitions (in `src/index.css`)
Define the animation keyframes and a utility class `.forge-energy-card`.

```css
@keyframes forge-pulse {
  0%, 100% {
    box-shadow: 0 0 2px var(--forge-color-dim), inset 0 0 0 transparent;
    border-color: var(--forge-color-base);
  }
  50% {
    box-shadow: 0 0 var(--forge-glow-radius) var(--forge-color-glow), inset 0 0 5px var(--forge-color-dim);
    border-color: var(--forge-color-bright);
  }
}

.forge-energy-card {
  /* Default values */
  --forge-color-base: rgba(255,255,255,0.5);
  --forge-color-glow: rgba(255,255,255,0.8);
  --forge-glow-radius: 10px;
  --forge-anim-duration: 3s;
  
  animation: forge-pulse var(--forge-anim-duration) ease-in-out infinite;
  transition: all 0.3s ease;
}
```

### Step 2: Component Logic (in `Forge.tsx`)
In the `renderPillar` function, when mapping `items`:
1.  Calculate intensity metrics based on `index`.
2.  Determine the color palette based on the `pillar` type ('love', 'truth', 'conviction').
3.  Pass these as inline styles to the card wrapper.

**Logic Snippet:**
```javascript
const getIntensityStyles = (index, pillarType) => {
    const isTop = index === 0;
    const baseOpacity = Math.max(0.3, 1 - (index * 0.2)); // 1.0, 0.8, 0.6...
    const duration = 2 + (index * 1.5); // 2s, 3.5s, 5s...
    const radius = Math.max(2, 15 - (index * 4)); // 15px, 11px, 7px...
    
    // Define colors based on pillarType...
    return {
        '--forge-anim-duration': `${duration}s`,
        '--forge-glow-radius': `${radius}px`,
        // ... colors ...
    }
}
```

### Step 3: Refinements
*   Add a subtle "Spark" overlay? (Maybe too complex for now, stick to border glow).
*   Ensure "Draggable" state doesn't break the animation.
*   Ensure the "Close/Remove" button is still visible and distinct.

## Validation
*   **Visual Check**: Does the top card look "hot"? Do the bottom cards look "cool"?
*   **Theme Check**: Does it fit the "Astros" dark/neon aesthetic? Yes.
