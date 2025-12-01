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
    Custom = 'custom',
    Special = 'special' // Triggered by click or command
}

// Module trigger configuration from Pet Forge
export interface ModuleConfig {
    id: string;
    assetUrl?: string;
    trigger: 'default' | 'random' | 'click' | 'command';
    probability?: number; // For 'random' trigger (0-1)
    triggerValue?: string; // For 'command' trigger
}

export interface PetConfig {
    id: string;
    type: 'dog' | 'cat' | 'crab' | 'fox' | 'clippy' | 'chicken' | 'cockatiel' | 'deno' | 'horse' | 'panda' | 'snake' | 'totoro' | 'custom';
    color: string;
    name: string;
    speed: number;
    size: number; // Scale factor, e.g., 1.0
    assets?: Record<string, string>; // Map of action name to URL (e.g., 'idle' -> '...', 'dance' -> '...')
    modules?: Record<string, ModuleConfig>; // Module configurations from Pet Forge
}

export interface PetPosition {
    x: number; // Left in px
    y: number; // Bottom in px
    direction: 'left' | 'right';
}

export interface PetInstance {
    id: string; // Convenience accessor (same as config.id)
    config: PetConfig;
    position: PetPosition;
    state: PetState;
    customAction?: string; // Name of the custom action if state is Custom
    nextStateTime: number; // Timestamp when state should change
}
