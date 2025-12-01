// @ts-nocheck
export enum PetState {
    SitIdle = 'sit-idle',
    WalkRight = 'walk-right',
    WalkLeft = 'walk-left',
    RunRight = 'run-right',
    RunLeft = 'run-left',
    Lie = 'lie',
    Chase = 'chase',
    IdleWithBall = 'idle-with-ball',
    Custom = 'custom'
}

export interface PetConfig {
    id: string;
    type: 'dog' | 'cat' | 'crab' | 'fox' | 'clippy' | 'chicken' | 'cockatiel' | 'deno' | 'horse' | 'panda' | 'snake' | 'totoro' | 'custom';
    color: string;
    name: string;
    speed: number;
    size: number; // Scale factor, e.g., 1.0
    assets?: Record<string, string>; // Map of action name to URL (e.g., 'idle' -> '...', 'dance' -> '...')
}

export interface PetPosition {
    x: number; // Left in px
    y: number; // Bottom in px
    direction: 'left' | 'right';
}

export interface PetInstance {
    config: PetConfig;
    position: PetPosition;
    state: PetState;
    customAction?: string; // Name of the custom action if state is Custom
    nextStateTime: number; // Timestamp when state should change
}
