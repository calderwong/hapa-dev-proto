/**
 * 🌿 Hapa Unified Card Model (The "Center")
 * 
 * This is the Single Source of Truth for what a "Card" is in Hapa.
 * It acts as the normalization layer between:
 * - Persistence (CardIndexEntry, Hypercore)
 * - Frontend Contexts (HandContext, Selection)
 * - Domain Specifics (PetForge, Thor's Hamma)
 */

import { PetState } from '../components/pets/types';
import type { PetConfig, PetLocation } from '../components/pets/types';

// ============================================================================
// 1. Core Identity & Metadata
// ============================================================================

export type CardType = 'standard' | 'set' | 'pet' | 'system';
export type MediaKind = 'image' | 'video' | 'audio' | 'text' | 'message' | 'pet' | 'code';

export interface CardIdentity {
  id: string;              // The canonical ID (uuid or specific format)
  coreName?: string;       // Hypercore name (if persisted)
  createdAt: string;       // ISO String
  updatedAt?: string;      // ISO String
}

export interface CardMetadata {
  name: string;            // Display Name
  description?: string;    // User or AI generated description
  tags?: string[];
  author?: 'user' | 'model' | 'system';
  provenance?: {
    model?: string;      // AI Model ID
    prompt?: string;     // Generation prompt
    sourceId?: string;   // Parent/Source ID
  };
}

// ============================================================================
// 2. Domain Specific Shapes
// ============================================================================

// A. Standard Media Card (Image, Video, Text)
export interface StandardCard extends CardIdentity, CardMetadata {
  type: 'standard';
  mediaKind: MediaKind;

  // Media Assets
  mediaPath?: string;      // Local file path (file://...)
  thumbnail?: string;      // Base64 or Local path
  content?: string;        // Text content / Markdown / Code

  // UX State
  isLive?: boolean;        // If true, represents a live stream/connection
}

// B. Pet Card (Agent/Companion)
export interface PetCard extends CardIdentity, CardMetadata {
  type: 'pet';
  mediaKind: 'pet';

  // Pet Specifics
  species: string;         // 'dog', 'cat', etc.
  state: PetState;         // Current behavioral state
  location: PetLocation;   // Where is the pet?
  config?: PetConfig;      // Full configuration (modules, assets)

  // Visuals
  thumbnail?: string;      // Portrait of the pet
}

// C. Set Card (Collection)
export interface SetCard extends CardIdentity, CardMetadata {
  type: 'set';
  mediaKind: 'image';      // Sets usually have a cover image

  // Collection Data
  children: string[];      // IDs of contained cards
  theme?: string;          // Visual theme identifier
  thumbnail?: string;      // Cover image
}

// ============================================================================
// 3. The Unified Union
// ============================================================================

export type HapaCard = StandardCard | PetCard | SetCard;

// ============================================================================
// 4. Normalization Adapters (The "Door back to Center")
// ============================================================================

/**
 * Normalizes any legacy or raw object into a strict HapaCard.
 * This function is the "Ellis Island" of the app - only valid cards pass.
 */
export function normalizeCard(input: any): HapaCard {
  if (!input) throw new Error('Cannot normalize null card');

  // 1. Extract Identity
  // Handle various ID fields: cardId, id, _id
  const id = input.cardId || input.id || input._id || `temp-${Date.now()}`;
  const createdAt = input.createdAt || new Date().toISOString();

  // 2. Extract Type & Kind
  let type: CardType = 'standard';
  let mediaKind: MediaKind = 'text';

  // Heuristics for Type detection
  if (input.type === 'pet' || input.mediaKind === 'pet' || input.species) {
    type = 'pet';
    mediaKind = 'pet';
  } else if (input.type === 'set' || input.cardType === 'set' || Array.isArray(input.children)) {
    type = 'set';
    mediaKind = 'image'; // Sets default to image cover
  } else {
    type = 'standard';
    // Map legacy media kinds
    mediaKind = (input.mediaKind || input.kind || 'text') as MediaKind;
  }

  // 3. Extract Metadata
  const name = input.name || input.title || 'Untitled';
  const description = input.description || input.lore || input.text?.substring(0, 100);

  // 4. Construct Specific Card
  const base = {
    id,
    coreName: input.coreName,
    createdAt,
    updatedAt: input.updatedAt,
    name,
    description,
    tags: input.tags || [],
    provenance: {
      model: input.model || input.generationParams?.model,
      prompt: input.prompt || input.generationParams?.prompt || input.craftedPrompt,
      sourceId: input.parentId || input.parentCardId || input.sourceImage?.cardId
    }
  };

  if (type === 'pet') {
    return {
      ...base,
      type: 'pet',
      mediaKind: 'pet',
      species: input.species || input.config?.type || 'unknown',
      state: input.state || PetState.SitIdle,
      location: input.location || { zone: 'sanctuary', enteredAt: Date.now() },
      config: input.config,
      thumbnail: input.thumbnail
    };
  }

  if (type === 'set') {
    return {
      ...base,
      type: 'set',
      mediaKind: 'image',
      children: input.children || input.containedCards?.map((c: any) => c.cardId) || [],
      thumbnail: input.thumbnail
    };
  }

  // Standard fallback
  return {
    ...base,
    type: 'standard',
    mediaKind,
    mediaPath: input.mediaLocalPath || input.mediaPath || input.videoPath || input.imagePath,
    thumbnail: input.thumbnail || input.url || input.mediaRemoteUrl,
    content: input.content || input.text || input.messageContent || input.markdown
  };
}
