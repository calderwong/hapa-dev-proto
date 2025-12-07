/**
 * PersistenceAdapter Interface
 * 
 * Abstract interface for the persistence/projection layer.
 * All consumers (UI, agents, services) access data through this interface.
 * 
 * This allows swapping implementations (SQLite -> SurrealDB) without
 * changing consuming code.
 */

import type {
  SearchQuery,
  CardSearchResult,
  RagQuery,
  RagChunk,
  GraphNeighborQuery,
  GraphNeighbor,
  HypercoreEvent,
  ProjectionStats,
} from './types';

export interface PersistenceAdapter {
  // ============================================================
  // Lifecycle
  // ============================================================
  
  /**
   * Initialize the adapter (create DB, run migrations, etc.)
   */
  initialize(): Promise<void>;
  
  /**
   * Close connections and cleanup
   */
  close(): Promise<void>;
  
  /**
   * Check if adapter is ready for queries
   */
  isReady(): boolean;

  // ============================================================
  // Projection Pipeline
  // ============================================================
  
  /**
   * Apply an event from Hypercore to update the projection.
   * Must be idempotent - same event applied twice = same result.
   */
  applyEvent(event: HypercoreEvent): Promise<void>;
  
  /**
   * Apply multiple events in a batch (for rebuild efficiency)
   */
  applyEvents(events: HypercoreEvent[]): Promise<void>;

  // ============================================================
  // Query API
  // ============================================================
  
  /**
   * Search cards with full-text, filters, and optional semantic search.
   */
  searchCards(query: SearchQuery): Promise<CardSearchResult[]>;
  
  /**
   * Get RAG context chunks for agent/LLM consumption.
   * Returns text chunks ranked by relevance.
   */
  getRagContext(query: RagQuery): Promise<RagChunk[]>;
  
  /**
   * Get graph neighbors for wiki/card relationship traversal.
   */
  getGraphNeighbors(query: GraphNeighborQuery): Promise<GraphNeighbor[]>;

  // ============================================================
  // Direct Access (for specific lookups)
  // ============================================================
  
  /**
   * Get a single card by ID
   */
  getCard(cardId: string): Promise<CardSearchResult | null>;
  
  /**
   * Get cards by parent ID
   */
  getCardsByParent(parentId: string): Promise<CardSearchResult[]>;
  
  /**
   * Get cards by Hell Week run ID
   */
  getCardsByRun(runId: string): Promise<CardSearchResult[]>;

  // ============================================================
  // Maintenance
  // ============================================================
  
  /**
   * Get current projection version from DB
   */
  getProjectionVersion(): Promise<number | null>;
  
  /**
   * Set projection version (after rebuild/migration)
   */
  setProjectionVersion(version: number): Promise<void>;
  
  /**
   * Clear all data and rebuild from Hypercores.
   * Called when schema version changes or DB is corrupt.
   */
  clearAndRebuild(
    hypercoreReader: () => AsyncIterable<HypercoreEvent>
  ): Promise<void>;
  
  /**
   * Get statistics about the projection
   */
  getStats(): Promise<ProjectionStats>;
}

/**
 * Factory function type for creating adapters
 */
export type PersistenceAdapterFactory = (
  dbPath: string
) => PersistenceAdapter;
