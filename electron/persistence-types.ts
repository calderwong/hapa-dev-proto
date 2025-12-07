/**
 * Persistence Layer Types (Electron-side copy)
 * 
 * These types are used by SqliteAdapter in the Electron main process.
 * Keep in sync with src/persistence/types.ts
 */

// ============================================================
// Search & Filter Types
// ============================================================

export interface SearchFilters {
  type?: string;
  cardType?: string;
  mediaKind?: string;
  minTier?: number;
  maxTier?: number;
  hellweekRunId?: string;
  parentId?: string;
  createdAfter?: string;
  createdBefore?: string;
  tags?: string[];
}

export interface SemanticQuery {
  text: string;
  embeddingModel?: string;
  topK?: number;
}

export interface SearchQuery {
  text?: string;
  filters?: SearchFilters;
  semantic?: SemanticQuery;
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
  snippet?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RagChunk {
  id: string;
  sourceId: string;
  sourceType: string;
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
  relationTypes?: string[];
  depth?: number;
  limit?: number;
}

export interface GraphNeighbor {
  id: string;
  title: string;
  summary?: string;
  relationType: string;
  distance: number;
}

// ============================================================
// Event Types
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
  timestamp: string;
  coreId?: string;
  seq?: number;
}

// ============================================================
// Card Event Payloads
// ============================================================

export interface CardCreatedPayload {
  id: string;
  type: string;
  mediaKind?: string;
  name?: string;
  tier?: number;
  hellweekRunId?: string;
  parentId?: string;
  contentText?: string;
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
  relation: string;
}

// ============================================================
// Stats
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
// Adapter Interface
// ============================================================

export interface PersistenceAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  isReady(): boolean;
  applyEvent(event: HypercoreEvent): Promise<void>;
  applyEvents(events: HypercoreEvent[]): Promise<void>;
  searchCards(query: SearchQuery): Promise<CardSearchResult[]>;
  getRagContext(query: RagQuery): Promise<RagChunk[]>;
  getGraphNeighbors(query: GraphNeighborQuery): Promise<GraphNeighbor[]>;
  getCard(cardId: string): Promise<CardSearchResult | null>;
  getCardsByParent(parentId: string): Promise<CardSearchResult[]>;
  getCardsByRun(runId: string): Promise<CardSearchResult[]>;
  getProjectionVersion(): Promise<number | null>;
  setProjectionVersion(version: number): Promise<void>;
  clearAndRebuild(hypercoreReader: () => AsyncIterable<HypercoreEvent>): Promise<void>;
  getStats(): Promise<ProjectionStats>;
}

// ============================================================
// Constants
// ============================================================

export const CURRENT_PROJECTION_VERSION = 1;
export const DB_FILENAME = 'persistence.db';
