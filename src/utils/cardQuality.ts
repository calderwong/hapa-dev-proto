/**
 * Card Quality/Rarity System
 * Inspired by: Diablo loot, Path of Exile, Borderlands, Destiny
 */

export type CardType = 'image' | 'video' | 'audio' | 'text' | 'extracted' | 'sprite' | 'pet' | 'set';
export type CardQualityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface CardQualityResult {
  score: number;
  tier: CardQualityTier;
  affixes: string[];
  tierLabel: string;
  tierColor: string;
  borderClass: string;
  glowClass: string;
  badgeClass: string;
}

export interface CardForQuality {
  name?: string;
  cardType?: 'standard' | 'set' | 'merged-set';  // NEW: Card schema type
  mediaKind?: 'image' | 'video' | 'audio' | 'pet';
  subType?: string;
  derivedGif?: any;
  cardRecord?: {
    summaries?: any[];
    keyTerms?: any[];
    transcripts?: any[];
    parentCardId?: string;
    wormhole?: {
      wikiEntries?: any[];
    };
  };
}

// Tier configuration
const TIER_CONFIG: Record<CardQualityTier, {
  label: string;
  minScore: number;
  borderClass: string;
  glowClass: string;
  badgeClass: string;
}> = {
  common: {
    label: 'Common',
    minScore: 0,
    borderClass: 'border-gray-600',
    glowClass: '',
    badgeClass: 'bg-gray-700 text-gray-400',
  },
  uncommon: {
    label: 'Uncommon',
    minScore: 2,
    borderClass: 'border-emerald-500',
    glowClass: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    badgeClass: 'bg-emerald-900/50 text-emerald-400',
  },
  rare: {
    label: 'Rare',
    minScore: 4,
    borderClass: 'border-blue-500',
    glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]',
    badgeClass: 'bg-blue-900/50 text-blue-400',
  },
  epic: {
    label: 'Epic',
    minScore: 6,
    borderClass: 'border-purple-500',
    glowClass: 'shadow-[0_0_16px_rgba(168,85,247,0.5)] animate-epic-pulse',
    badgeClass: 'bg-purple-900/50 text-purple-400',
  },
  legendary: {
    label: 'Legendary',
    minScore: 9,
    borderClass: 'border-orange-500',
    glowClass: 'shadow-[0_0_20px_rgba(249,115,22,0.6)] animate-legendary-shimmer',
    badgeClass: 'bg-orange-900/50 text-orange-400',
  },
  mythic: {
    label: 'Mythic',
    minScore: 12,
    borderClass: 'border-rose-500',
    glowClass: 'shadow-[0_0_24px_rgba(244,63,94,0.6),0_0_48px_rgba(245,158,11,0.3)] animate-mythic-breathe',
    badgeClass: 'bg-gradient-to-r from-rose-900/50 to-amber-900/50 text-rose-400',
  },
};

/**
 * Calculate the quality score and tier for a card
 */
export function calculateCardQuality(card: CardForQuality): CardQualityResult {
  let score = 0;
  const affixes: string[] = [];

  // Media (+1)
  if (card.mediaKind) {
    score += 1;
    affixes.push('media');
  }

  // Loop/GIF (+1)
  if (card.derivedGif || card.subType === 'sprite-sheet') {
    score += 1;
    affixes.push('loop');
  }

  // Name (+1)
  if (card.name && card.name.trim() !== '' && card.name !== 'Untitled Card') {
    score += 1;
    affixes.push('named');
  }

  // Parent relationship (+1)
  if (card.cardRecord?.parentCardId) {
    score += 1;
    affixes.push('linked');
  }

  // Summary (+2)
  if (card.cardRecord?.summaries && card.cardRecord.summaries.length > 0) {
    score += 2;
    affixes.push('summarized');
  }

  // Key Terms (+2)
  if (card.cardRecord?.keyTerms && card.cardRecord.keyTerms.length > 0) {
    score += 2;
    affixes.push('tagged');
  }

  // Wiki Entries (+2)
  if (card.cardRecord?.wormhole?.wikiEntries && card.cardRecord.wormhole.wikiEntries.length > 0) {
    score += 2;
    affixes.push('wiki');
  }

  // Transcript (+2)
  if (card.cardRecord?.transcripts && card.cardRecord.transcripts.length > 0) {
    score += 2;
    affixes.push('transcribed');
  }

  // Determine tier based on score
  let tier: CardQualityTier = 'common';
  if (score >= TIER_CONFIG.mythic.minScore) {
    tier = 'mythic';
  } else if (score >= TIER_CONFIG.legendary.minScore) {
    tier = 'legendary';
  } else if (score >= TIER_CONFIG.epic.minScore) {
    tier = 'epic';
  } else if (score >= TIER_CONFIG.rare.minScore) {
    tier = 'rare';
  } else if (score >= TIER_CONFIG.uncommon.minScore) {
    tier = 'uncommon';
  }

  const config = TIER_CONFIG[tier];

  return {
    score,
    tier,
    affixes,
    tierLabel: config.label,
    tierColor: tier,
    borderClass: config.borderClass,
    glowClass: config.glowClass,
    badgeClass: config.badgeClass,
  };
}

/**
 * Get the card type based on media and subType
 */
export function getCardType(card: CardForQuality): CardType {
  // Check for Set Cards first
  if (card.cardType === 'set' || card.cardType === 'merged-set') return 'set';
  
  if (card.subType === 'sprite-sheet') return 'sprite';
  if (card.subType === 'first-frame' || card.subType === 'last-frame' || card.subType === 'audio-extract') {
    return 'extracted';
  }
  if (card.mediaKind === 'video') return 'video';
  if (card.mediaKind === 'audio') return 'audio';
  if (card.mediaKind === 'image') return 'image';
  if (card.mediaKind === 'pet') return 'pet';
  return 'text';
}

/**
 * Get tier badge abbreviation
 */
export function getTierBadge(tier: CardQualityTier): string {
  const badges: Record<CardQualityTier, string> = {
    common: 'C',
    uncommon: 'U',
    rare: 'R',
    epic: 'E',
    legendary: 'L',
    mythic: 'M',
  };
  return badges[tier];
}

/**
 * Get all tier options for filtering
 */
export function getAllTiers(): { value: CardQualityTier; label: string; color: string }[] {
  return [
    { value: 'common', label: 'Common', color: 'gray' },
    { value: 'uncommon', label: 'Uncommon', color: 'emerald' },
    { value: 'rare', label: 'Rare', color: 'blue' },
    { value: 'epic', label: 'Epic', color: 'purple' },
    { value: 'legendary', label: 'Legendary', color: 'orange' },
    { value: 'mythic', label: 'Mythic', color: 'rose' },
  ];
}

/**
 * Get all card types for filtering
 */
export function getAllCardTypes(): { value: CardType; label: string; icon: string }[] {
  return [
    { value: 'set', label: 'Set', icon: 'folder' },
    { value: 'image', label: 'Image', icon: 'image' },
    { value: 'video', label: 'Video', icon: 'videocam' },
    { value: 'audio', label: 'Audio', icon: 'audiotrack' },
    { value: 'text', label: 'Text', icon: 'description' },
    { value: 'extracted', label: 'Extracted', icon: 'content-cut' },
    { value: 'sprite', label: 'Sprite', icon: 'animation' },
    { value: 'pet', label: 'Pet', icon: 'pets' },
  ];
}
