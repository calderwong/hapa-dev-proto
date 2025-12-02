import { PetState, type PetInstance, type PetConfig, type EnvironmentTheme, type CardRef } from './types';

interface PetPhysicsState {
    velocity: { x: number; y: number };
    isAirborne: boolean;
    lastWallHitTime: number;
}

/**
 * The Brain: Decides what the pet wants to do
 */
class PetBehaviorEngine {
    /**
     * Decide the next state for a pet based on its personality and environment
     */
    public decideNextState(pet: PetInstance, environment: EnvironmentTheme): PetState {
        // Base weights
        const weights: Record<string, number> = {
            [PetState.SitIdle]: 1.0,
            [PetState.WalkRight]: 1.0,
            [PetState.WalkLeft]: 1.0,
            [PetState.RunRight]: 0.2,
            [PetState.RunLeft]: 0.2,
            [PetState.Lie]: 0.5,
        };

        // Apply Personality Modifiers (from config)
        // Assuming config has speed/size. We might want to add 'playfulness' to PetConfig in the future.
        // For now, we derive it or use defaults.
        const speed = pet.config.speed || 5;
        const isEnergetic = speed > 6;
        const isLazy = speed < 4;

        if (isEnergetic) {
            weights[PetState.RunRight] += 0.5;
            weights[PetState.RunLeft] += 0.5;
            weights[PetState.SitIdle] -= 0.2;
        }

        if (isLazy) {
            weights[PetState.Lie] += 1.0;
            weights[PetState.SitIdle] += 0.5;
            weights[PetState.RunRight] = 0;
            weights[PetState.RunLeft] = 0;
        }

        // Apply Environment Modifiers
        if (environment.physics.verticality) {
            // In space/water, less walking, more idling/floating
            weights[PetState.WalkRight] *= 0.5;
            weights[PetState.WalkLeft] *= 0.5;
            weights[PetState.SitIdle] += 1.0;
        }

        // Context Modifiers (e.g. near walls)
        // Note: This requires passing current position context. 
        // For simplicity, direction decisions happen here, but specific wall avoidance happens in Physics.

        return this.weightedRandom(weights);
    }

    public getNextStateDuration(state: PetState, pet: PetInstance): number {
        const base = 2000;
        const rand = Math.random() * 2000;
        
        switch (state) {
            case PetState.SitIdle: return base + rand;
            case PetState.Lie: return base * 2 + rand;
            case PetState.WalkRight:
            case PetState.WalkLeft: return 1500 + rand;
            case PetState.RunRight:
            case PetState.RunLeft: return 1000 + rand;
            default: return base;
        }
    }

    private weightedRandom(weights: Record<string, number>): PetState {
        let total = 0;
        for (const key in weights) total += weights[key];

        let random = Math.random() * total;
        for (const key in weights) {
            random -= weights[key];
            if (random <= 0) return key as PetState;
        }
        return PetState.SitIdle;
    }
}

/**
 * The Body: Handles physics and execution
 */
export class HeaderPetController {
    private pets: PetInstance[] = [];
    private physicsState: Map<string, PetPhysicsState> = new Map();
    private brain: PetBehaviorEngine;
    private containerWidth: number = 0;
    private containerHeight: number = 0;
    private environment: EnvironmentTheme;

    constructor(width: number, height: number, initialTheme: EnvironmentTheme) {
        this.containerWidth = width;
        this.containerHeight = height;
        this.environment = initialTheme;
        this.brain = new PetBehaviorEngine();
    }

    public addPet(config: PetConfig, cardRef?: { cardId: string; coreName: string }) {
        const existing = this.pets.find(p => p.id === config.id);
        if (existing) return;

        const pet: PetInstance = {
            id: config.id,
            config,
            position: {
                x: Math.random() * (this.containerWidth - 32),
                y: 0,
                direction: Math.random() > 0.5 ? 'right' : 'left',
            },
            state: PetState.SitIdle,
            nextStateTime: Date.now() + 2000,
            cardRef,
        };

        this.pets.push(pet);
        
        // Initialize physics
        this.physicsState.set(pet.id, {
            velocity: { x: 0, y: 0 },
            isAirborne: false,
            lastWallHitTime: 0
        });
    }

    public removePet(id: string) {
        this.pets = this.pets.filter(p => p.id !== id);
        this.physicsState.delete(id);
    }

    public getPets(): PetInstance[] {
        return this.pets;
    }

    public updateDimensions(width: number, height: number) {
        this.containerWidth = width;
        this.containerHeight = height;
    }

    public setEnvironment(theme: EnvironmentTheme) {
        this.environment = theme;
    }

    public tick() {
        const now = Date.now();
        const { gravity, friction, verticality, bounciness } = this.environment.physics;

        this.pets.forEach(pet => {
            const phys = this.physicsState.get(pet.id);
            if (!phys) return;

            // 1. Brain Update (Decide State)
            if (now >= pet.nextStateTime) {
                const newState = this.brain.decideNextState(pet, this.environment);
                
                // Constraint Check: Don't walk into a wall we are already touching
                const margin = 10;
                if (pet.position.x <= margin && (newState === PetState.WalkLeft || newState === PetState.RunLeft)) {
                    // Pick right or idle instead
                    pet.state = Math.random() > 0.5 ? PetState.WalkRight : PetState.SitIdle;
                } else if (pet.position.x >= this.containerWidth - 40 && (newState === PetState.WalkRight || newState === PetState.RunRight)) {
                    // Pick left or idle instead
                    pet.state = Math.random() > 0.5 ? PetState.WalkLeft : PetState.SitIdle;
                } else {
                    pet.state = newState;
                }

                pet.nextStateTime = now + this.brain.getNextStateDuration(pet.state, pet);

                // Initialize velocity for new state (impulse)
                const moveSpeed = (pet.config.speed || 3) * 0.5; // Scaled down for header
                
                if (pet.state === PetState.WalkRight) {
                    phys.velocity.x = moveSpeed;
                    pet.position.direction = 'right';
                } else if (pet.state === PetState.WalkLeft) {
                    phys.velocity.x = -moveSpeed;
                    pet.position.direction = 'left';
                } else if (pet.state === PetState.RunRight) {
                    phys.velocity.x = moveSpeed * 1.5;
                    pet.position.direction = 'right';
                } else if (pet.state === PetState.RunLeft) {
                    phys.velocity.x = -moveSpeed * 1.5;
                    pet.position.direction = 'left';
                } else {
                    // Idle/Lie: decay velocity via friction, don't hard set to 0 immediately for smoothness
                }

                // Verticality (Space): Random Y impulse
                if (verticality && Math.random() > 0.7) {
                    phys.velocity.y = (Math.random() - 0.5) * 2; // Drift up/down
                }
            }

            // 2. Physics Update
            
            // Apply Gravity
            if (!verticality) {
                if (pet.position.y > 0) {
                    phys.velocity.y -= gravity * 0.5; // Fall down
                } else {
                    phys.velocity.y = 0;
                    pet.position.y = 0;
                }
            } else {
                // Space physics: Drift, no gravity pulling down to 0
                // Slight dampening
                phys.velocity.y *= 0.98;
            }

            // Apply Friction to X
            if (pet.state === PetState.SitIdle || pet.state === PetState.Lie) {
                phys.velocity.x *= friction;
                if (Math.abs(phys.velocity.x) < 0.1) phys.velocity.x = 0;
            }

            // Update Position
            pet.position.x += phys.velocity.x;
            pet.position.y += phys.velocity.y;

            // 3. Boundary Resolution
            const petWidth = 32 * (pet.config.size || 1);
            
            // Left Wall
            if (pet.position.x <= 0) {
                pet.position.x = 0;
                // Bounce or Stop
                if (Math.abs(phys.velocity.x) > 2 && bounciness > 0) {
                    phys.velocity.x = -phys.velocity.x * bounciness;
                    pet.position.direction = 'right';
                } else {
                    phys.velocity.x = 0;
                    // Force state change to turn around soon
                    if (pet.state === PetState.WalkLeft || pet.state === PetState.RunLeft) {
                        pet.nextStateTime = now + 500; // React quickly
                        pet.state = PetState.SitIdle; // Stop first
                    }
                }
            }
            
            // Right Wall
            if (pet.position.x >= this.containerWidth - petWidth) {
                pet.position.x = this.containerWidth - petWidth;
                if (Math.abs(phys.velocity.x) > 2 && bounciness > 0) {
                    phys.velocity.x = -phys.velocity.x * bounciness;
                    pet.position.direction = 'left';
                } else {
                    phys.velocity.x = 0;
                    if (pet.state === PetState.WalkRight || pet.state === PetState.RunRight) {
                        pet.nextStateTime = now + 500;
                        pet.state = PetState.SitIdle;
                    }
                }
            }

            // Ceiling/Floor (for verticality)
            if (verticality) {
                if (pet.position.y > 15) { // Keep them somewhat in frame
                    pet.position.y = 15;
                    phys.velocity.y *= -1;
                }
                if (pet.position.y < 0) {
                    pet.position.y = 0;
                    phys.velocity.y *= -1;
                }
            }
        });
    }
}
