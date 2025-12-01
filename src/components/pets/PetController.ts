// @ts-nocheck
import { PetState } from './types';
import type { PetConfig, PetInstance, PetPosition } from './types';

const FRAME_RATE = 100; // Update every 100ms

export class PetController {
    private pets: PetInstance[] = [];
    private containerWidth: number = 0;
    private containerHeight: number = 0;

    constructor(width: number, height: number) {
        this.containerWidth = width;
        this.containerHeight = height;
    }

    public addPet(config: PetConfig) {
        this.pets.push({
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

    public updateDimensions(width: number, height: number) {
        this.containerWidth = width;
        this.containerHeight = height;
    }

    public tick() {
        const now = Date.now();
        this.pets.forEach(pet => {
            // 1. State Transition
            if (now >= pet.nextStateTime) {
                this.changeState(pet);
            }

            // 2. Movement
            this.movePet(pet);
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
