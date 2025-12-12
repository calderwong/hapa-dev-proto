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
    Special = 'special', // Triggered by click or command
    
    // Agentic States
    Listening = 'listening',
    Requesting = 'requesting',
    Waiting = 'waiting',
    Communicating = 'communicating',
    Responding = 'responding'
}

// Pet location zones
export type PetZone = 'sanctuary' | 'header' | 'hidden';

// Pet location state
export interface PetLocation {
    zone: PetZone;
    position?: { x: number; y: number };  // Last position in zone
    enteredAt: number;                     // Timestamp
}

// Animation asset reference
export interface AnimationAsset {
    url: string;                   // Local file:// or remote URL
    cardRef?: CardRef;             // If sourced from a card
    frames?: number;               // Frame count for timing
    duration?: number;             // Animation duration in ms
}

// Card reference for relationships
export interface CardRef {
    cardId: string;
    coreName: string;
    relation?: string;             // 'animation', 'behavior', 'tool', etc.
}

// Module trigger configuration from Pet Forge
export interface ModuleConfig {
    id: string;
    assetUrl?: string;
    trigger: 'default' | 'random' | 'click' | 'command';
    probability?: number; // For 'random' trigger (0-1)
    triggerValue?: string; // For 'command' trigger
}

// Pet behavior configuration
export interface PetBehavior {
    speed: number;               // Movement speed (1-10)
    scale: number;               // Size multiplier
    restFrequency?: number;      // How often to rest (0-1)
    playfulness?: number;        // Activity level (0-1)
}

// Pet capability configuration
export interface PetCapability {
    id: string;
    name: string;
    provider: 'aimlapi' | 'vertex' | 'openai' | 'anthropic';
    modelId: string;
    config: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
        responseFormat?: 'text' | 'json_object';
    };
    systemPrompt?: string;
    appendPrompt?: string;
}

// Full Pet Card schema for Hypercore storage
export interface PetCard {
    // Card Identity
    type: 'pet';
    id: string;                    // Unique identifier
    coreName: string;              // Hypercore name for this pet
    
    // Capabilities
    capabilities?: PetCapability[];
    activeCapabilityId?: string;
    
    // Agentic Animation States (Camp Refactor)
    agentStateAnimations?: {
        listening?: string;         // "Listen to User's request"
        requesting?: string;        // "Going out and requesting inference"
        waiting?: string;           // "Waiting for Inference"
        communicating?: string;     // "Communicating with other Phamiliars"
        responding?: string;        // "Request returned to user"
    };

    // Display
    name: string;
    species: string;               // 'dog', 'cat', 'custom', etc.
    color?: string;                // Color variant
    thumbnail?: string;            // Base64 or URL for card display
    
    // Animation Configuration
    animations: {
        idle: AnimationAsset | string;
        walk: AnimationAsset | string;
        run?: AnimationAsset | string;
        lie?: AnimationAsset | string;
        special?: (AnimationAsset | string)[];
    };
    
    // Module System (from Pet Forge)
    modules?: Record<string, ModuleConfig>;
    
    // Behavior Profile
    behavior: PetBehavior;
    
    // Location State
    location: PetLocation;
    
    // Card Relationships (for agent composition)
    attachedCards?: CardRef[];     // Tools, behaviors, memories attached
    parentCards?: CardRef[];       // Lineage tracking
    
    // Metadata
    createdAt: number;
    updatedAt: number;
    version: number;
}

// Pet Card index entry for card-library
export interface PetCardIndexEntry {
    type: 'card-index';
    cardId: string;
    coreName: string;
    mediaKind: 'pet';
    name: string;
    species: string;
    thumbnail?: string;
    location: PetLocation;
    createdAt: number;
    updatedAt: number;
}

// Legacy PetConfig for backward compatibility
export interface PetConfig {
    id: string;
    type: 'dog' | 'cat' | 'crab' | 'fox' | 'clippy' | 'chicken' | 'cockatiel' | 'deno' | 'horse' | 'panda' | 'snake' | 'totoro' | 'custom';
    color: string;
    name: string;
    speed: number;
    size: number; // Scale factor, e.g., 1.0
    assets?: Record<string, string>; // Map of action name to URL (e.g., 'idle' -> '...', 'dance' -> '...')
    agentStateAnimations?: Record<string, string>; // Map of agent state to URL
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
    // Link to full card data
    cardRef?: CardRef;
}

// Drag data for pet cards
export interface PetDragData {
    type: 'pet-card';
    petId: string;
    coreName: string;
    sourceZone: PetZone | 'library' | 'sidebar';
    petCard: PetCard;
}

// Environment physics configuration
export interface EnvironmentPhysics {
    gravity: number;        // 1.0 = normal, 0.1 = space (affects Y movement)
    friction: number;       // 1.0 = normal, 0.1 = ice (affects X deceleration)
    verticality: boolean;   // Can pets move up/down freely? (e.g. Space/Water)
    bounciness: number;     // Wall restitution (0.0 - 1.0)
}

// Environment theme for pet portal
export interface EnvironmentTheme {
    id: string;
    name: string;
    background: string;            // CSS gradient or image
    groundColor: string;
    ambientParticles?: boolean;    // Floating effects
    physics: EnvironmentPhysics;   // Physics modifiers
}
