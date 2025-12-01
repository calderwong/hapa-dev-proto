// @ts-nocheck
import { PetState } from './types';
import type { PetConfig, PetInstance, PetPosition, ModuleConfig } from './types';

const FRAME_RATE = 100; // Update every 100ms
const RANDOM_CHECK_INTERVAL = 5000; // Check random triggers every 5 seconds

export class PetController {
    private pets: PetInstance[] = [];
    private containerWidth: number = 0;
    private containerHeight: number = 0;
    private lastRandomCheck: number = 0;

    constructor(width: number, height: number) {
        this.containerWidth = width;
        this.containerHeight = height;
        this.lastRandomCheck = Date.now();
    }

    public addPet(config: PetConfig) {
        this.pets.push({
            id: config.id,
            config,
            position: {
                x: Math.random() * (this.containerWidth - 100),
                y: 0, // Floor
                direction: 'right'
            },
            state: PetState.SitIdle,
            nextStateTime: Date.now() + 3000
        });
    }

    public getPets(): PetInstance[] {
        return this.pets;
    }

    public getPetById(id: string): PetInstance | undefined {
        return this.pets.find(p => p.id === id);
    }

    public updateDimensions(width: number, height: number) {
        this.containerWidth = width;
        this.containerHeight = height;
    }

    // Trigger a click-based module for a pet
    public triggerClick(petId: string): boolean {
        const pet = this.getPetById(petId);
        if (!pet) return false;

        // Find a module with trigger 'click'
        if (pet.config.modules) {
            for (const [key, module] of Object.entries(pet.config.modules)) {
                if (module.trigger === 'click' && module.assetUrl) {
                    // Trigger the special state
                    pet.state = PetState.Special;
                    pet.customAction = key;
                    pet.nextStateTime = Date.now() + 2000; // Play for 2 seconds
                    return true;
                }
            }
        }
        return false;
    }

    // Trigger a command-based module for a pet
    public triggerCommand(petId: string, command: string): boolean {
        const pet = this.getPetById(petId);
        if (!pet) return false;

        if (pet.config.modules) {
            for (const [key, module] of Object.entries(pet.config.modules)) {
                if (module.trigger === 'command' && 
                    module.triggerValue?.toLowerCase() === command.toLowerCase() && 
                    module.assetUrl) {
                    pet.state = PetState.Special;
                    pet.customAction = key;
                    pet.nextStateTime = Date.now() + 3000;
                    return true;
                }
            }
        }
        return false;
    }

    public tick() {
        const now = Date.now();

        // Check random triggers periodically
        if (now - this.lastRandomCheck > RANDOM_CHECK_INTERVAL) {
            this.checkRandomTriggers();
            this.lastRandomCheck = now;
        }

        this.pets.forEach(pet => {
            // 1. State Transition
            if (now >= pet.nextStateTime) {
                this.changeState(pet);
            }

            // 2. Movement
            this.movePet(pet);
        });
    }

    // Check all pets for random-triggered modules
    private checkRandomTriggers() {
        this.pets.forEach(pet => {
            // Only trigger random actions when idle
            if (pet.state !== PetState.SitIdle && pet.state !== PetState.Lie) return;

            if (pet.config.modules) {
                for (const [key, module] of Object.entries(pet.config.modules)) {
                    if (module.trigger === 'random' && module.assetUrl) {
                        const probability = module.probability ?? 0.3;
                        if (Math.random() < probability) {
                            // Trigger the random action
                            pet.state = PetState.Special;
                            pet.customAction = key;
                            pet.nextStateTime = Date.now() + 3000;
                            break; // Only trigger one at a time
                        }
                    }
                }
            }
        });
    }

    private changeState(pet: PetInstance) {
        // Simple Markov chain based on current state
        const possibleStates = this.getPossibleNextStates(pet);
        const nextState = possibleStates[Math.floor(Math.random() * possibleStates.length)];

        pet.state = nextState;

        // If Custom state, pick a random custom action
        if (nextState === PetState.Custom && pet.config.assets) {
            const standardKeys = ['idle', 'walk', 'run', 'lie', 'walk-left', 'walk-right', 'run-left', 'run-right'];
            const customKeys = Object.keys(pet.config.assets).filter(k => !standardKeys.includes(k));

            if (customKeys.length > 0) {
                pet.customAction = customKeys[Math.floor(Math.random() * customKeys.length)];
            } else {
                // Fallback if no extra keys
                pet.state = PetState.SitIdle;
            }
        } else {
            pet.customAction = undefined;
        }

        // Determine duration for next state
        let duration = 2000 + Math.random() * 3000; // 2-5 seconds default

        if (nextState === PetState.WalkRight || nextState === PetState.WalkLeft) {
            duration = 3000 + Math.random() * 4000;
        } else if (nextState === PetState.RunRight || nextState === PetState.RunLeft) {
            duration = 2000 + Math.random() * 2000;
        } else if (nextState === PetState.Custom) {
            duration = 3000 + Math.random() * 3000;
        }

        pet.nextStateTime = Date.now() + duration;

        // Update direction based on state
        if (nextState === PetState.WalkRight || nextState === PetState.RunRight) {
            pet.position.direction = 'right';
        } else if (nextState === PetState.WalkLeft || nextState === PetState.RunLeft) {
            pet.position.direction = 'left';
        }
    }

    private getPossibleNextStates(pet: PetInstance): PetState[] {
        const currentState = pet.state;
        const basicStates = [PetState.SitIdle, PetState.WalkRight, PetState.WalkLeft];

        // If pet has custom assets, add Custom state as a possibility from Idle
        let hasCustomExtras = false;
        if (pet.config.assets) {
            const standardKeys = ['idle', 'walk', 'run', 'lie'];
            hasCustomExtras = Object.keys(pet.config.assets).some(k => !standardKeys.includes(k));
        }

        switch (currentState) {
            case PetState.SitIdle:
                const fromIdle = [PetState.WalkRight, PetState.WalkLeft, PetState.Lie, PetState.SitIdle];
                if (hasCustomExtras) fromIdle.push(PetState.Custom);
                return fromIdle;
            case PetState.Lie:
                return [PetState.SitIdle, PetState.WalkRight, PetState.WalkLeft];
            case PetState.Custom:
                return [PetState.SitIdle, PetState.WalkRight, PetState.WalkLeft];
            case PetState.WalkRight:
                return [PetState.SitIdle, PetState.RunRight, PetState.WalkRight, PetState.WalkLeft];
            case PetState.WalkLeft:
                return [PetState.SitIdle, PetState.RunLeft, PetState.WalkLeft, PetState.WalkRight];
            case PetState.RunRight:
                return [PetState.WalkRight, PetState.SitIdle, PetState.RunRight];
            case PetState.RunLeft:
                return [PetState.WalkLeft, PetState.SitIdle, PetState.RunLeft];
            default:
                return [PetState.SitIdle];
        }
    }

    private movePet(pet: PetInstance) {
        const speed = pet.config.speed;
        let moveX = 0;

        if (pet.state === PetState.WalkRight) {
            moveX = speed;
        } else if (pet.state === PetState.WalkLeft) {
            moveX = -speed;
        } else if (pet.state === PetState.RunRight) {
            moveX = speed * 2;
        } else if (pet.state === PetState.RunLeft) {
            moveX = -speed * 2;
        }

        // Boundary checks
        let newX = pet.position.x + moveX;

        // Wall collision - turn around
        if (newX < 0) {
            newX = 0;
            if (pet.state === PetState.WalkLeft) pet.state = PetState.WalkRight;
            if (pet.state === PetState.RunLeft) pet.state = PetState.RunRight;
            pet.position.direction = 'right';
        } else if (newX > this.containerWidth - 64) { // Assuming 64px width
            newX = this.containerWidth - 64;
            if (pet.state === PetState.WalkRight) pet.state = PetState.WalkLeft;
            if (pet.state === PetState.RunRight) pet.state = PetState.RunLeft;
            pet.position.direction = 'left';
        }

        pet.position.x = newX;
    }
}
