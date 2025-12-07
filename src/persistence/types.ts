/**
 * Persistence Layer Types
 * 
 * Shared types for the persistence/projection layer that sits
 * on top of Hypercore for fast local queries and RAG.
 */

// ============================================================
// Search & Filter Types
// ============================================================

export interface SearchFilters {
  type?: string;              // e.g. "card", "wiki", "run"
  cardType?: string;          // e.g. "text", "image", "video", "set"
  mediaKind?: string;         // e.g. "image", "video", "audio"
  minTier?: number;
  maxTier?: number;
  hellweekRunId?: string;
  parentId?: string;
  createdAfter?: string;      // ISO date
  createdBefore?: string;     // ISO date
  tags?: string[];            // tags or topics
}

export interface SemanticQuery {
  text: string;
  embeddingModel?: string;
  topK?: number;
}

export interface SearchQuery {
  text?: string;              // full-text search
  filters?: SearchFilters;
  semantic?: SemanticQuery;   // if present, combine FTS + vector
  limit?: number;
  offset?: number;
}

// ============================================================
// Result Types
// ============================================================

export interface CardSearchResult {
  id: string;
  type: string;
  name: string;
  tier?: number;
  snippet?: string;           // highlighted text snippet
  score: number;              // combined relevance score
  metadata?: Record<string, unknown>;
}

export interface RagChunk {
  id: string;
  sourceId: string;           // cardId / wikiId / runId
  sourceType: string;         // 'card' | 'wiki' | 'run'
  text: string;
  startOffset?: number;
  endOffset?: number;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RagQuery {
  semantic: SemanticQuery;
  filters?: SearchFilters;
  limit?: number;
}

// ============================================================
// Graph Types
// ============================================================

export interface GraphNeighborQuery {
  nodeId: string;
  relationTypes?: string[];   // e.g. "linked_to", "derived_from", "parent_of"
  depth?: number;             // BFS depth (default 1)
  limit?: number;
}

export interface GraphNeighbor {
  id: string;
  title: string;
  summary?: string;
  relationType: string;
  distance: number;           // graph distance from source
}

// ============================================================
// Event Types (for projection pipeline)
// ============================================================

export type HypercoreEventType = 
  | 'CARD_CREATED'
  | 'CARD_UPDATED'
  | 'CARD_DELETED'
  | 'WIKI_NODE_CREATED'
  | 'WIKI_NODE_UPDATED'
  | 'WIKI_EDGE_CREATED'
  | 'WIKI_EDGE_DELETED'
  | 'SUMMARY_CREATED'
  | 'TRANSCRIPT_CREATED'
  | 'HELLWEEK_RUN_CREATED'
  | 'HELLWEEK_RUN_UPDATED';

export interface HypercoreEvent<T = unknown> {
  type: HypercoreEventType;
  payload: T;
  timestamp: string;          // ISO
  coreId?: string;            // which hypercore this came from
  seq?: number;               // sequence number in the core
}

// ============================================================
// Card Event Payloads
// ============================================================

export interface CardCreatedPayload {
  id: string;
  type: string;               // "standard", "set", "merged-set"
  mediaKind?: string;         // "image", "video", "audio", "message"
  name?: string;
  tier?: number;
  hellweekRunId?: string;
  parentId?: string;
  contentText?: string;       // flattened text for FTS
  lore?: string;
  skills?: unknown[];
  stats?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CardUpdatedPayload extends Partial<CardCreatedPayload> {
  id: string;
  updatedAt: string;
}

// ============================================================
// Wiki Event Payloads
// ============================================================

export interface WikiNodePayload {
  id: string;
  title: string;
  summary?: string;
  sourceCardId?: string;
  createdAt?: string;
}

export interface WikiEdgePayload {
  fromId: string;
  toId: string;
  relation: string;           // e.g. "related_to", "derived_from"
}

// ============================================================
// Projection Metadata
// ============================================================

export interface ProjectionStats {
  cardCount: number;
  wikiNodeCount: number;
  wikiEdgeCount: number;
  embeddingCount: number;
  dbSizeBytes: number;
  projectionVersion: number;
  lastUpdated: string;
}

// ============================================================
// Constants
// ============================================================

export const CURRENT_PROJECTION_VERSION = 1;

export const DB_FILENAME = 'persistence.db';
