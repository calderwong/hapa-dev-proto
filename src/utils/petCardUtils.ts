// @ts-nocheck
/**
 * Pet Card Utilities
 * CRUD operations for Pet Cards stored in Hypercore
 */

import type { 
  PetCard, 
  PetCardIndexEntry, 
  PetConfig, 
  PetLocation, 
  PetZone,
  EnvironmentTheme 
} from '../components/pets/types';

const CARD_LIBRARY_CORE_NAME = 'card-library';
const PET_CARD_MIME = 'application/x-pet-card';

// Default environment themes
export const ENVIRONMENT_THEMES: EnvironmentTheme[] = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    background: 'linear-gradient(to bottom, #87CEEB 0%, #a8e6cf 60%, #88d8b0 100%)',
    groundColor: '#5a9c6f',
    physics: {
        gravity: 1.0,
        friction: 0.85,
        verticality: false,
        bounciness: 0.2
    }
  },
  {
    id: 'night',
    name: 'Starry Night',
    background: 'linear-gradient(to bottom, #0a0a2e 0%, #1a1a4e 50%, #2a1a3e 100%)',
    groundColor: '#2d2d4d',
    ambientParticles: true,
    physics: {
        gravity: 0.9,
        friction: 0.8,
        verticality: false,
        bounciness: 0.1
    }
  },
  {
    id: 'cyber',
    name: 'Cyber Grid',
    background: 'linear-gradient(to bottom, #0a0a1a 0%, #1a0a2e 50%, #0f0f1f 100%)',
    groundColor: 'rgba(77, 184, 255, 0.15)',
    physics: {
        gravity: 1.2,     // Heavy digital gravity
        friction: 0.95,   // Very grippy
        verticality: false,
        bounciness: 0.0   // No bounce
    }
  },
  {
    id: 'sunset',
    name: 'Golden Sunset',
    background: 'linear-gradient(to bottom, #ff7e5f 0%, #feb47b 50%, #ffcf8b 100%)',
    groundColor: '#8b6b4f',
    physics: {
        gravity: 1.0,
        friction: 0.7,    // A bit sandy/slippery
        verticality: false,
        bounciness: 0.3
    }
  },
  {
    id: 'space',
    name: 'Deep Space',
    background: 'linear-gradient(to bottom, #000011 0%, #0a0a2e 50%, #1a0a3e 100%)',
    groundColor: '#333355',
    ambientParticles: true,
    physics: {
        gravity: 0.1,     // Very low gravity
        friction: 0.98,   // No air resistance/friction
        verticality: true, // Can float up
        bounciness: 0.8   // Bouncy walls
    }
  },
];

/**
 * Generate a unique pet core name
 */
export function generatePetCoreName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `pet-${timestamp}-${random}`;
}

/**
 * Generate a thumbnail URL for a pet based on its species and color
 */
export function getPetThumbnail(species: string, color: string = 'black'): string {
  if (species === 'custom') {
    return ''; // Custom pets use their idle animation
  }
  return `/pets/${species}/${color}_idle.gif`;
}

/**
 * Convert legacy PetConfig to PetCard format
 */
export function petConfigToCard(
  config: PetConfig, 
  coreName: string,
  location: PetLocation = { zone: 'sanctuary', enteredAt: Date.now() }
): PetCard {
  const now = Date.now();
  
  // Build animations object
  const animations: PetCard['animations'] = {
    idle: config.assets?.idle || `/pets/${config.type}/${config.color}_idle.gif`,
    walk: config.assets?.walk || `/pets/${config.type}/${config.color}_walk.gif`,
    run: config.assets?.run || `/pets/${config.type}/${config.color}_run.gif`,
    lie: config.assets?.lie || `/pets/${config.type}/${config.color}_idle.gif`,
  };
  
  // Build thumbnail
  const thumbnail = config.type === 'custom' && config.assets?.idle 
    ? config.assets.idle 
    : getPetThumbnail(config.type, config.color);
  
  return {
    type: 'pet',
    id: config.id,
    coreName,
    name: config.name,
    species: config.type,
    color: config.color,
    thumbnail,
    animations,
    modules: config.modules,
    behavior: {
      speed: config.speed,
      scale: config.size,
      restFrequency: 0.3,
      playfulness: 0.5,
    },
    location,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Convert PetCard back to PetConfig for the controller
 */
export function petCardToConfig(card: PetCard): PetConfig {
  const getAnimationUrl = (anim: string | { url: string } | undefined): string | undefined => {
    if (!anim) return undefined;
    if (typeof anim === 'string') return anim;
    return anim.url;
  };
  
  return {
    id: card.id,
    type: card.species as PetConfig['type'],
    color: card.color || 'black',
    name: card.name,
    speed: card.behavior.speed,
    size: card.behavior.scale,
    assets: {
      idle: getAnimationUrl(card.animations.idle) || '',
      walk: getAnimationUrl(card.animations.walk) || '',
      run: getAnimationUrl(card.animations.run),
      lie: getAnimationUrl(card.animations.lie),
    },
    modules: card.modules,
  };
}

/**
 * Create a new Pet Card and save to Hypercore
 */
export async function createPetCard(
  config: PetConfig,
  location: PetLocation = { zone: 'sanctuary', enteredAt: Date.now() }
): Promise<PetCard | null> {
  if (!window.electronAPI?.p2pCreateCore || !window.electronAPI?.p2pAppend) {
    console.error('P2P API not available');
    return null;
  }
  
  try {
    const coreName = generatePetCoreName();
    const petCard = petConfigToCard(config, coreName, location);
    
    // Create the pet's own core
    await window.electronAPI.p2pCreateCore(coreName);
    await window.electronAPI.p2pAppend({
      name: coreName,
      data: JSON.stringify(petCard),
    });
    
    // Add to card library index
    await addPetToLibrary(petCard);
    
    console.log(`Created pet card: ${petCard.name} (${coreName})`);
    return petCard;
  } catch (error) {
    console.error('Failed to create pet card:', error);
    return null;
  }
}

/**
 * Add a pet card to the card library index
 */
export async function addPetToLibrary(petCard: PetCard): Promise<void> {
  if (!window.electronAPI?.p2pCreateCore || !window.electronAPI?.p2pAppend) {
    throw new Error('P2P API not available');
  }
  
  const indexEntry: PetCardIndexEntry = {
    type: 'card-index',
    cardId: petCard.id,
    coreName: petCard.coreName,
    mediaKind: 'pet',
    name: petCard.name,
    species: petCard.species,
    thumbnail: petCard.thumbnail,
    location: petCard.location,
    createdAt: petCard.createdAt,
    updatedAt: petCard.updatedAt,
  };
  
  await window.electronAPI.p2pCreateCore(CARD_LIBRARY_CORE_NAME);
  await window.electronAPI.p2pAppend({
    name: CARD_LIBRARY_CORE_NAME,
    data: JSON.stringify(indexEntry),
  });
}

/**
 * Load all pet cards from the library
 */
export async function loadPetCards(): Promise<PetCard[]> {
  if (!window.electronAPI?.p2pRead) {
    console.error('P2P API not available');
    return [];
  }
  
  try {
    const entries = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
    const petCards: PetCard[] = [];
    
    // Find all pet card index entries
    const petEntries: PetCardIndexEntry[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry);
        if (parsed.type === 'card-index' && parsed.mediaKind === 'pet') {
          petEntries.push(parsed);
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
    
    // Load full card data from each pet's core
    for (const entry of petEntries) {
      try {
        const coreData = await window.electronAPI.p2pRead(entry.coreName);
        for (const record of coreData) {
          try {
            const parsed = JSON.parse(record);
            if (parsed.type === 'pet') {
              petCards.push(parsed);
              break; // Only need the first pet record
            }
          } catch (e) {
            // Skip invalid records
          }
        }
      } catch (e) {
        console.warn(`Failed to load pet core: ${entry.coreName}`, e);
      }
    }
    
    return petCards;
  } catch (error) {
    console.error('Failed to load pet cards:', error);
    return [];
  }
}

/**
 * Load pets by location zone
 */
export async function loadPetsByZone(zone: PetZone): Promise<PetCard[]> {
  const allPets = await loadPetCards();
  return allPets.filter(pet => pet.location.zone === zone);
}

/**
 * Update a pet's location
 */
export async function updatePetLocation(
  petCard: PetCard, 
  newZone: PetZone,
  position?: { x: number; y: number }
): Promise<PetCard | null> {
  if (!window.electronAPI?.p2pAppend) {
    console.error('P2P API not available');
    return null;
  }
  
  try {
    const updatedCard: PetCard = {
      ...petCard,
      location: {
        zone: newZone,
        position,
        enteredAt: Date.now(),
      },
      updatedAt: Date.now(),
      version: petCard.version + 1,
    };
    
    // Append update to pet's core
    await window.electronAPI.p2pAppend({
      name: petCard.coreName,
      data: JSON.stringify(updatedCard),
    });
    
    // Also update the library index with new location
    const indexEntry: PetCardIndexEntry = {
      type: 'card-index',
      cardId: updatedCard.id,
      coreName: updatedCard.coreName,
      mediaKind: 'pet',
      name: updatedCard.name,
      species: updatedCard.species,
      thumbnail: updatedCard.thumbnail,
      location: updatedCard.location,
      createdAt: updatedCard.createdAt,
      updatedAt: updatedCard.updatedAt,
    };
    
    await window.electronAPI.p2pAppend({
      name: CARD_LIBRARY_CORE_NAME,
      data: JSON.stringify(indexEntry),
    });
    
    console.log(`Updated pet location: ${updatedCard.name} → ${newZone}`);
    return updatedCard;
  } catch (error) {
    console.error('Failed to update pet location:', error);
    return null;
  }
}

/**
 * Get the latest version of a pet card from its core
 */
export async function getPetCard(coreName: string): Promise<PetCard | null> {
  if (!window.electronAPI?.p2pRead) {
    return null;
  }
  
  try {
    const records = await window.electronAPI.p2pRead(coreName);
    // Return the last pet record (most recent)
    for (let i = records.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(records[i]);
        if (parsed.type === 'pet') {
          return parsed;
        }
      } catch (e) {
        // Skip invalid records
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to get pet card from ${coreName}:`, error);
    return null;
  }
}

/**
 * Create drag data for a pet card
 */
export function createPetDragData(petCard: PetCard, sourceZone: PetZone | 'library' | 'sidebar'): string {
  return JSON.stringify({
    type: 'pet-card',
    petId: petCard.id,
    coreName: petCard.coreName,
    sourceZone,
    petCard,
  });
}

/**
 * Parse pet drag data from a drop event
 */
export function parsePetDragData(dataTransfer: DataTransfer): { petCard: PetCard; sourceZone: string } | null {
  // Try custom MIME type first
  let data = dataTransfer.getData(PET_CARD_MIME);
  if (!data) {
    // Fall back to JSON
    data = dataTransfer.getData('application/json');
  }
  if (!data) {
    data = dataTransfer.getData('text/plain');
  }
  
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'pet-card' && parsed.petCard) {
      return {
        petCard: parsed.petCard,
        sourceZone: parsed.sourceZone || 'unknown',
      };
    }
  } catch (e) {
    // Not valid pet drag data
  }
  
  return null;
}

/**
 * Check if a drag event contains pet card data
 */
export function hasPetDragData(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(PET_CARD_MIME) || 
         dataTransfer.types.includes('application/json');
}
