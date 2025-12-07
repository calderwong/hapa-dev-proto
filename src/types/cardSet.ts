/**
 * Card Types - Self-Contained Data Model
 * 
 * Core Principle: Each card's hypercore should know its full state.
 * If we rebuild from scratch, cards can reconstruct their relationships.
 * 
 * Card Types:
 * - 'standard': Regular content cards (documents, images, videos)
 * - 'set': Set cards that contain other cards (with skills)
 * - 'merged-set': Virtual grouping referencing multiple sets
 */

// ============================================================================
// Base Types & Enums
// ============================================================================

export type CardType = 'standard' | 'set' | 'merged-set';

export type SkillType = 'passive' | 'active';

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'loop-video';

// ============================================================================
// Relationship Types (Self-Contained Model)
// ============================================================================

/**
 * Records which sets a card belongs to.
 * Stored on the CARD itself for rebuild-ability.
 */
export interface SetMembership {
  setCardId: string;          // The set card's ID
  setName?: string;           // Cached name for display
  joinedAt: string;           // ISO timestamp when added
  addedBy: 'pipeline' | 'user' | 'consume';  // How it was added
}

/**
 * Records which cards are contained in a set.
 * Stored on the SET CARD for rebuild-ability.
 */
export interface ContainedCard {
  cardId: string;             // The contained card's ID
  cardName?: string;          // Cached name for display
  addedAt: string;            // ISO timestamp
  addedBy: 'pipeline' | 'user' | 'consume';
  order?: number;             // Display order within set
}

// ============================================================================
// Skills System
// ============================================================================

export interface Skill {
  id: string;                 // Unique skill identifier
  name: string;               // Display name
  type: SkillType;            // passive or active
  description: string;        // What the skill does
  icon?: string;              // Icon identifier or emoji
  effect?: SkillEffect;       // Mechanical effect
}

export interface SkillEffect {
  xpBonus?: number;           // Percentage XP bonus (e.g., 10 = +10%)
  triggerAction?: string;     // IPC action to trigger for active skills
}

// Default skills for Set cards
export const SET_CARD_SKILLS: Skill[] = [
  {
    id: 'contain',
    name: 'Contain',
    type: 'passive',
    description: 'Holds and organizes cards. Contained cards gain +10% XP when used.',
    icon: '📦',
    effect: { xpBonus: 10 },
  },
  {
    id: 'consume',
    name: 'Consume',
    type: 'active',
    description: 'Add a card to this set. Drag a card onto this set or use the Add button.',
    icon: '🔮',
    effect: { triggerAction: 'consume-card-into-set' },
  },
];

// ============================================================================
// Provenance (Model Attribution)
// ============================================================================

export interface ModelProvenance {
  modelName: string;          // Display name
  provider: string;           // 'Vertex AI', 'Google AI Studio', 'Local', etc.
  modelId: string;            // Actual model identifier
  generatedAt?: string;       // When this output was generated
}

// ============================================================================
// Base Card Interface (Shared by all card types)
// ============================================================================

export interface BaseCard {
  // Identity
  cardId: string;             // Unique identifier
  cardType: CardType;         // 'standard', 'set', or 'merged-set'
  name: string;               // Display name
  
  // Core references
  coreName?: string;          // Hypercore name
  coreKey?: string;           // Hypercore key
  coreDiscoveryKey?: string;  // Discovery key for replication
  
  // Timestamps
  createdAt: string;          // ISO timestamp
  updatedAt?: string;         // Last modification
  
  // Self-contained relationships (CRITICAL for rebuild-ability)
  memberOfSets: SetMembership[];  // Sets this card belongs to
  parentId?: string;          // Parent card (for child cards like loop videos)
  childIds?: string[];        // Child cards
  
  // Metadata
  tags?: string[];            // User-defined tags
  description?: string;       // Description/lore preview
}

// ============================================================================
// Standard Card (Content cards: documents, images, videos)
// ============================================================================

export interface StandardCard extends BaseCard {
  cardType: 'standard';
  
  // Media
  mediaKind: MediaKind;
  mediaPath?: string;         // Local file path
  thumbnail?: string;         // Thumbnail path
  
  // Stats & Progression
  tier: number;               // 1-6 (Common to Mythic)
  xp: number;                 // Experience points
  level: number;              // Derived from XP
  
  // Provenance
  provenance?: {
    text?: ModelProvenance;   // LLM that generated text
    image?: ModelProvenance;  // Model that generated image
    video?: ModelProvenance;  // Model that generated video
  };
  
  // Source
  runId?: string;             // Pipeline run ID (if from pipeline)
  sourceFile?: string;        // Original artifact filename
  
  // Additional data
  lore?: string;              // Card lore/description
  state?: string;             // Card state (e.g., 'complete', 'pending')
}

// ============================================================================
// Set Card (Container cards with skills)
// ============================================================================

export interface SetCard extends BaseCard {
  cardType: 'set';
  
  // Media (Set cards have cover images)
  mediaKind: 'image';
  mediaPath?: string;         // Cover image path
  thumbnail?: string;         // Thumbnail path
  
  // Stats & Progression
  tier: number;               // Calculated from contained cards
  xp: number;                 // Gained when contained cards are used
  level: number;              // Derived from XP
  
  // Skills (Set-specific abilities)
  skills: Skill[];
  
  // Contained Cards (CRITICAL for rebuild-ability)
  containedCards: ContainedCard[];
  
  // Source
  runId?: string;             // Pipeline run ID (if from pipeline)
  artifactName?: string;      // Original artifact filename
  artifactHash?: string;      // Hash for deduplication
  
  // Leo Context (optional, can be large)
  leoContext?: any;
  
  // Provenance
  provenance?: {
    image?: ModelProvenance;  // Model that generated cover image
  };
}

// ============================================================================
// Legacy CardSet (for migration - will be converted to SetCard)
// ============================================================================

/** @deprecated Use SetCard instead */
export interface CardSet {
  type: 'card-set';
  setId: string;              // Unique identifier (e.g., set-{timestamp}-{hash})
  name: string;               // Leo-derived name
  description?: string;       // Leo-derived description
  artifactName: string;       // Original artifact filename
  artifactHash?: string;      // Hash of source artifact for deduplication
  
  // Provenance
  runId: string;              // Pipeline run ID
  createdAt: string;          // ISO timestamp
  leoContext?: any;           // Full Leo analysis output (optional, can be large)
  
  // Contents
  cardIds: string[];          // Direct member card IDs
  cardCount: number;          // Total cards in set
  
  // Metadata
  tags?: string[];            // User-defined tags
  thumbnail?: string;         // Representative image path (auto-selected or user-chosen)
  
  // Stats
  imageCount: number;         // Cards with generated images
  videoCount: number;         // Cards with loop videos
}

// ============================================================================
// Merged Set Card (Virtual grouping)
// ============================================================================

export interface MergedSetCard extends BaseCard {
  cardType: 'merged-set';
  
  // Media
  mediaKind: 'image';
  mediaPath?: string;         // Optional cover image
  thumbnail?: string;
  
  // References (not copies - maintains sovereignty)
  sourceSetCardIds: string[]; // Set cards included
  
  // Computed (resolved at runtime)
  // Note: Don't store resolved cards - always resolve dynamically
}

/** @deprecated Use MergedSetCard instead */
export interface MergedSet {
  type: 'merged-set';
  mergedSetId: string;        // Unique identifier
  name: string;               // User-defined name
  description?: string;       
  
  // References (not copies - maintains sovereignty)
  sourceSetIds: string[];     // Card Sets included
  sourceMergedSetIds?: string[]; // Nested merged sets (optional)
  
  createdAt: string;
  updatedAt: string;
  
  // Metadata
  tags?: string[];
  thumbnail?: string;
}

// ============================================================================
// Union Types
// ============================================================================

// All card types
export type Card = StandardCard | SetCard | MergedSetCard;

// Legacy union for migration
export type CardSetRecord = CardSet | MergedSet;

// ============================================================================
// Type Guards
// ============================================================================

export function isStandardCard(card: Card): card is StandardCard {
  return card.cardType === 'standard';
}

export function isSetCard(card: Card): card is SetCard {
  return card.cardType === 'set';
}

export function isMergedSetCard(card: Card): card is MergedSetCard {
  return card.cardType === 'merged-set';
}

// Legacy type guards
export function isCardSet(record: CardSetRecord): record is CardSet {
  return record.type === 'card-set';
}

export function isMergedSet(record: CardSetRecord): record is MergedSet {
  return record.type === 'merged-set';
}

// Index entry for card-library (lightweight reference)
export interface CardSetIndexEntry {
  type: 'card-set-index';
  setId: string;
  name: string;
  cardCount: number;
  createdAt: string;
  thumbnail?: string;
  isMerged: boolean;
}

// Filter state for Card Library
export interface SetFilter {
  setIds: string[];           // Selected set IDs (can be multiple)
  includeMerged: boolean;     // Whether to resolve merged set references
}

// Computed stats for display
export interface CardSetStats {
  totalCards: number;
  withImages: number;
  withVideos: number;
  childCards: number;         // Loop videos, extractions, etc.
}

// ============================================================================
// Card Index Entry (Lightweight reference for Card Library)
// ============================================================================

/**
 * Lightweight entry stored in card-library core.
 * Contains enough info for display + references to full hypercore.
 */
export interface CardIndexEntry {
  type: 'card-index';
  cardId: string;
  cardType: CardType;         // NEW: Distinguish card types
  name: string;
  createdAt: string;
  
  // Hypercore references
  coreName?: string;
  coreKey?: string;
  coreDiscoveryKey?: string;
  
  // Display
  thumbnail?: string;
  mediaKind?: MediaKind;
  mediaLocalPath?: string;
  tier?: number;
  
  // Self-contained relationships
  memberOfSets: SetMembership[];  // NEW: Sets this card belongs to
  parentId?: string;
  
  // For set cards
  containedCardCount?: number;    // How many cards in this set
  skills?: Skill[];               // Skills (for set cards)
  
  // Source
  runId?: string;
  sourceFile?: string;
  lore?: string;
  state?: string;
  
  // @deprecated - use memberOfSets instead
  setId?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Set Card with default values
 */
export function createSetCard(params: {
  cardId: string;
  name: string;
  runId?: string;
  artifactName?: string;
}): SetCard {
  return {
    cardId: params.cardId,
    cardType: 'set',
    name: params.name,
    createdAt: new Date().toISOString(),
    memberOfSets: [],
    mediaKind: 'image',
    tier: 1,
    xp: 0,
    level: 1,
    skills: [...SET_CARD_SKILLS],
    containedCards: [],
    runId: params.runId,
    artifactName: params.artifactName,
  };
}

/**
 * Migrate legacy CardSet to SetCard
 */
export function migrateCardSetToSetCard(legacy: CardSet): SetCard {
  return {
    cardId: legacy.setId,
    cardType: 'set',
    name: legacy.name,
    description: legacy.description,
    createdAt: legacy.createdAt,
    memberOfSets: [],
    mediaKind: 'image',
    thumbnail: legacy.thumbnail,
    tier: 1,
    xp: 0,
    level: 1,
    skills: [...SET_CARD_SKILLS],
    containedCards: legacy.cardIds.map((id, i) => ({
      cardId: id,
      addedAt: legacy.createdAt,
      addedBy: 'pipeline' as const,
      order: i,
    })),
    runId: legacy.runId,
    artifactName: legacy.artifactName,
    artifactHash: legacy.artifactHash,
    leoContext: legacy.leoContext,
    tags: legacy.tags,
  };
}
