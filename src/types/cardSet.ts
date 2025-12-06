/**
 * Card Sets - Grouping mechanism for Hell Week pipeline runs
 * 
 * A CardSet represents cards created from a single pipeline execution.
 * A MergedSet is a virtual grouping that references multiple sets.
 */

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

// Union type for storage
export type CardSetRecord = CardSet | MergedSet;

// Helper type guards
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
