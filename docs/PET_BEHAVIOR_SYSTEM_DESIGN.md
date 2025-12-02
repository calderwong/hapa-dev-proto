# Pet Behavior System Design

## Objective
Create a sophisticated, extensible behavior system for Pet Cards that allows them to interact intelligently with their environment (specifically the Header Portal) and lays the groundwork for future Agent capabilities.

## Problem
Current implementation uses a simple random-walk state machine that results in "bouncing" behavior against walls and ignores pet personality or environmental context.

## Architecture

We will decouple the **Decision Making** (Brain) from the **Execution** (Body/Physics).

### 1. The Brain (`PetBehaviorEngine`)
Responsible for determining *what* the pet wants to do based on:
- **Internal State**: Energy, Boredom (derived from `PetBehavior` config).
- **Personality**: `playfulness`, `restFrequency`, `speed`.
- **Context**: Current Environment (Theme), nearby boundaries.

### 2. The Body (`HeaderPetController`)
Responsible for *how* the pet moves and renders:
- **Physics**: Velocity, Position, Gravity (simulated).
- **Constraints**: Wall collision, Floor collision.
- **Rendering**: Choosing the correct asset frame.

## Core Concepts

### Environment Physics
We will extend `EnvironmentTheme` to include physics modifiers:
```typescript
interface EnvironmentPhysics {
    gravity: number;        // 1.0 = normal, 0.1 = space
    friction: number;       // 1.0 = normal, 0.1 = ice
    verticality: boolean;   // Can pets move up/down freely? (e.g. Space/Water)
    bounciness: number;     // Wall restitution
}
```

### Behavior State Machine (Weighted)
Instead of hardcoded 50/25/25 probabilities, we calculate weights dynamically:

| State | Base Weight | Modifiers |
|-------|-------------|-----------|
| **Idle** | 1.0 | + `restFrequency` * 2 |
| **Walk** | 1.0 | + `playfulness` |
| **Run** | 0.5 | + `playfulness` * 2 |
| **Special**| 0.1 | + Random Factor |

### Wall Interactions
Instead of instantaneous reflection:
1. **Approach**: Detect wall distance.
2. **Decision**:
   - **Turn**: Stop, wait, turn around.
   - **Climb**: (Future) Walk up wall?
   - **Bounce**: (If high speed/run).

## Implementation Plan

### Phase 1: Behavior System Scaffolding
1.  **Extract `HeaderPetController`**: Move from `PetPortal.tsx` to `src/components/pets/HeaderPetController.ts`.
2.  **Define Physics Types**: Add `EnvironmentPhysics` to `types.ts`.
3.  **Implement `PetBehaviorEngine`**:
    - Add `decideNextState(pet, environment)` function.
    - Implement weighted random selection.

### Phase 2: Sophisticated Movement
1.  **Update `tick()` Loop**:
    - Differentiate between `velocity.x` and `position.x`.
    - Implement smooth acceleration/deceleration (easing) instead of instant speed changes.
2.  **Environment Handlers**:
    - **Meadow/Sunset**: Standard gravity, walk/run.
    - **Space**: Zero gravity, floating (sine wave Y-movement), bouncing off walls gently.
    - **Cyber**: Glitch/Teleport movement occasionally.

### Phase 3: Wall Awareness
1.  **Proximity Triggers**: When `x < 50px` or `x > width - 50px`:
    - Increase probability of `Idle` (stopping at wall).
    - Increase probability of `Turn` (WalkLeft if at Right wall).
    - Disable `WalkRight` if at Right wall.

### Phase 4: Future Proofing (Agent Context)
1.  **Card Interactions**: Prepare hook for `interactWith(otherCard)` even if unused now.
2.  **Memory**: Add `shortTermMemory` to `PetInstance` (e.g., "I just visited the left wall, don't go back immediately").

## Detailed Class Structure

```typescript
// src/components/pets/HeaderPetController.ts

class HeaderPetController {
    // ... existing props
    
    update(environment: EnvironmentTheme) {
        this.pets.forEach(pet => {
            // 1. Update Brain
            this.behaviorEngine.update(pet, environment);
            
            // 2. Update Physics
            this.physicsEngine.applyForces(pet, environment);
            
            // 3. Resolve Constraints
            this.resolveBoundaries(pet, this.width, this.height);
        });
    }
}
```

## UX Improvements
- **Smooth Turns**: visual pause before changing direction.
- **Theme Reactions**: Pets float in space!
- **Personality**: Lazy pets sleep more; energetic pets run.

## Step-by-Step Execution
1.  Refactor types to include Physics and Behavior weighting.
2.  Create `src/components/pets/HeaderPetController.ts` separate file.
3.  Implement the "Brain" logic (Weighted State Machine).
4.  Implement the "Physics" logic (Theme-based movement).
5.  Update `PetPortal.tsx` to use the new controller and pass Theme data.
