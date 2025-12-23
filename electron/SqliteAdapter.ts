/**
 * SQLite Persistence Adapter
 * 
 * Implementation of PersistenceAdapter using better-sqlite3.
 * This runs in the Electron main process.
 * 
 * Design principles:
 * - Hypercore is source of truth; this is a rebuildable cache
 * - Sync operations (better-sqlite3) for simplicity
 * - FTS5 for full-text search
 * - Future: sqlite-vec for vector search
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type {
  PersistenceAdapter,
  SearchQuery,
  CardSearchResult,
  RagQuery,
  RagChunk,
  GraphNeighborQuery,
  GraphNeighbor,
  HypercoreEvent,
  ProjectionStats,
  CardCreatedPayload,
  CardUpdatedPayload,
  CardDeletedPayload,
  WikiNodePayload,
  WikiEdgePayload,
} from './persistence-types';

// Re-export the constant
const PROJECTION_VERSION = 1;

/**
 * SQL Schema for the projection database
 */
const SCHEMA_SQL = `
-- ============================================================
-- Core Cards Table
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'standard',
  media_kind TEXT,
  core_name TEXT,
  name TEXT,
  tier INTEGER,
  hellweek_run_id TEXT,
  parent_id TEXT,
  thumbnail TEXT,
  media_local_path TEXT,
  lore TEXT,
  content_text TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
CREATE INDEX IF NOT EXISTS idx_cards_parent ON cards(parent_id);
CREATE INDEX IF NOT EXISTS idx_cards_run ON cards(hellweek_run_id);
CREATE INDEX IF NOT EXISTS idx_cards_tier ON cards(tier);
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);

-- ============================================================
-- Full-Text Search for Cards
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(
  id UNINDEXED,
  name,
  content,
  lore,
  tokenize='porter'
);

-- ============================================================
-- Wiki Nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS wiki_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  source_card_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wiki_source ON wiki_nodes(source_card_id);

-- Full-text for wiki
CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
  id UNINDEXED,
  title,
  summary,
  tokenize='porter'
);

-- ============================================================
-- Wiki Edges (Graph Relationships)
-- ============================================================
CREATE TABLE IF NOT EXISTS wiki_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT,
  PRIMARY KEY (from_id, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON wiki_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON wiki_edges(to_id);

-- ============================================================
-- Embeddings (for future vector search)
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vec BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emb_source ON embeddings(source_id, source_type);

-- ============================================================
-- Projection Metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS projection_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export class SqliteAdapter implements PersistenceAdapter {
  private db: DatabaseType | null = null;
  private dbPath: string;
  private ready = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Run schema
    this.db.exec(SCHEMA_SQL);

    this.ensureCardsSchema();
    
    // Check if we need to rebuild
    const storedVersion = await this.getProjectionVersion();
    if (storedVersion !== PROJECTION_VERSION) {
      console.log(`[SqliteAdapter] Projection version mismatch: ${storedVersion} vs ${PROJECTION_VERSION}`);
      // For now, just set the version. Full rebuild would require Hypercore reader.
      await this.setProjectionVersion(PROJECTION_VERSION);
    }
    
    this.ready = true;
    console.log(`[SqliteAdapter] Initialized at ${this.dbPath}`);
  }

  private ensureCardsSchema(): void {
    if (!this.db) return;

    const cols = new Set(
      (this.db.prepare(`PRAGMA table_info(cards)`).all() as Array<{ name: string }>).map((c) => c.name),
    );

    const ensureCol = (name: string, sqlType: string) => {
      if (cols.has(name)) return;
      this.db!.exec(`ALTER TABLE cards ADD COLUMN ${name} ${sqlType}`);
      cols.add(name);
    };

    ensureCol('core_name', 'TEXT');
    ensureCol('thumbnail', 'TEXT');
    ensureCol('media_local_path', 'TEXT');
    ensureCol('is_deleted', 'INTEGER NOT NULL DEFAULT 0');
    ensureCol('deleted_at', 'TEXT');
    ensureCol('last_seen_at', 'TEXT');

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(is_deleted)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_last_seen ON cards(last_seen_at)`);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready && this.db !== null;
  }

  // ============================================================
  // Projection Pipeline
  // ============================================================

  async applyEvent(event: HypercoreEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    switch (event.type) {
      case 'CARD_CREATED':
        this.handleCardCreated(event.payload as CardCreatedPayload);
        break;
      case 'CARD_UPDATED':
        this.handleCardUpdated(event.payload as CardUpdatedPayload);
        break;
      case 'CARD_DELETED':
        this.handleCardDeleted(event.payload as CardDeletedPayload);
        break;
      case 'WIKI_NODE_CREATED':
        this.handleWikiNode(event.payload as WikiNodePayload);
        break;
      case 'WIKI_EDGE_CREATED':
        this.handleWikiEdge(event.payload as WikiEdgePayload);
        break;
      default:
        console.log(`[SqliteAdapter] Unhandled event type: ${event.type}`);
    }
  }

  async applyEvents(events: HypercoreEvent[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(() => {
      for (const event of events) {
        this.applyEvent(event);
      }
    });
    
    transaction();
  }

  private handleCardCreated(payload: CardCreatedPayload): void {
    if (!this.db) return;
    
    const metadata = payload.metadata ?? {};
    const metadataJson = JSON.stringify(metadata);
    const createdAt = payload.createdAt || new Date().toISOString();
    const updatedAt = (payload as any).updatedAt || createdAt;

    const coreName = (metadata as any)?.coreName ? String((metadata as any).coreName) : null;
    const thumbnail = (metadata as any)?.thumbnail ? String((metadata as any).thumbnail) : null;
    const mediaLocalPath = (metadata as any)?.mediaLocalPath ? String((metadata as any).mediaLocalPath) : null;
    const lastSeenAt = new Date().toISOString();
    
    // Upsert into cards
    this.db.prepare(`
      INSERT INTO cards (id, type, media_kind, core_name, name, tier, hellweek_run_id,
                         parent_id, thumbnail, media_local_path, lore, content_text,
                         is_deleted, deleted_at, last_seen_at,
                         created_at, updated_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        media_kind = excluded.media_kind,
        core_name = COALESCE(excluded.core_name, cards.core_name),
        name = excluded.name,
        tier = excluded.tier,
        hellweek_run_id = excluded.hellweek_run_id,
        parent_id = excluded.parent_id,
        thumbnail = COALESCE(excluded.thumbnail, cards.thumbnail),
        media_local_path = COALESCE(excluded.media_local_path, cards.media_local_path),
        lore = excluded.lore,
        content_text = excluded.content_text,
        is_deleted = 0,
        deleted_at = NULL,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at,
        metadata_json = excluded.metadata_json
    `).run(
      payload.id,
      payload.type || 'standard',
      payload.mediaKind || null,
      coreName,
      payload.name || null,
      payload.tier || null,
      payload.hellweekRunId || null,
      payload.parentId || null,
      thumbnail,
      mediaLocalPath,
      payload.lore || null,
      payload.contentText || null,
      0,
      null,
      lastSeenAt,
      createdAt,
      updatedAt,
      metadataJson
    );

    // FTS tables don't support UPSERT - delete then insert
    this.db.prepare(`DELETE FROM card_fts WHERE id = ?`).run(payload.id);
    this.db.prepare(`
      INSERT INTO card_fts (id, name, content, lore)
      VALUES (?, ?, ?, ?)
    `).run(
      payload.id,
      payload.name || '',
      payload.contentText || '',
      payload.lore || ''
    );
  }

  private handleCardUpdated(payload: CardUpdatedPayload): void {
    // Reuse create logic (upsert)
    this.handleCardCreated({
      ...payload,
      createdAt: payload.createdAt || payload.updatedAt,
    } as CardCreatedPayload);
  }

  private handleCardDeleted(payload: CardDeletedPayload): void {
    if (!this.db) return;

    const id = payload?.id;
    if (!id) return;

    const deletedAt = payload?.deletedAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    // Tombstone semantics: do not hard-delete cards.
    // If the card does not exist yet in the DB, create a stub tombstone row.
    this.db.prepare(`
      INSERT INTO cards (
        id,
        type,
        is_deleted,
        deleted_at,
        last_seen_at,
        created_at,
        updated_at,
        metadata_json
      ) VALUES (?, 'standard', 1, ?, ?, ?, ?, '{}')
      ON CONFLICT(id) DO UPDATE SET
        is_deleted = 1,
        deleted_at = excluded.deleted_at,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `).run(id, deletedAt, updatedAt, updatedAt, updatedAt);

    this.db.prepare(`DELETE FROM card_fts WHERE id = ?`).run(id);
  }

  private handleWikiNode(payload: WikiNodePayload): void {
    if (!this.db) return;
    
    const now = payload.createdAt || new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO wiki_nodes (id, title, summary, source_card_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        source_card_id = excluded.source_card_id,
        updated_at = excluded.updated_at
    `).run(
      payload.id,
      payload.title,
      payload.summary || null,
      payload.sourceCardId || null,
      now,
      now
    );

    // FTS
    this.db.prepare(`
      INSERT INTO wiki_fts (id, title, summary)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary
    `).run(
      payload.id,
      payload.title,
      payload.summary || ''
    );
  }

  private handleWikiEdge(payload: WikiEdgePayload): void {
    if (!this.db) return;
    
    this.db.prepare(`
      INSERT OR IGNORE INTO wiki_edges (from_id, to_id, relation, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      payload.fromId,
      payload.toId,
      payload.relation,
      new Date().toISOString()
    );
  }

  // ============================================================
  // Query API
  // ============================================================

  async searchCards(query: SearchQuery): Promise<CardSearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const filters = query.filters || {};
    
    // Build query based on what's provided
    if (query.text) {
      // Full-text search
      return this.searchCardsWithFTS(query.text, filters, limit, offset);
    } else {
      // Filter-only search
      return this.searchCardsWithFilters(filters, limit, offset);
    }
  }

  private searchCardsWithFTS(
    text: string,
    filters: SearchQuery['filters'],
    limit: number,
    offset: number
  ): CardSearchResult[] {
    if (!this.db) return [];
    
    // Build FTS query
    const ftsQuery = text.split(/\s+/).map(term => `"${term}"*`).join(' OR ');
    
    let sql = `
      SELECT c.id, c.type, c.name, c.tier, c.metadata_json,
             snippet(card_fts, 1, '<b>', '</b>', '...', 32) AS snippet,
             rank
      FROM card_fts
      JOIN cards c ON c.id = card_fts.id
      WHERE card_fts MATCH ?
        AND c.is_deleted = 0
    `;
    
    const params: unknown[] = [ftsQuery];
    
    // Add filters
    if (filters?.cardType) {
      sql += ` AND c.type = ?`;
      params.push(filters.cardType);
    }
    if (filters?.mediaKind) {
      sql += ` AND c.media_kind = ?`;
      params.push(filters.mediaKind);
    }
    if (filters?.minTier != null) {
      sql += ` AND c.tier >= ?`;
      params.push(filters.minTier);
    }
    if (filters?.maxTier != null) {
      sql += ` AND c.tier <= ?`;
      params.push(filters.maxTier);
    }
    if (filters?.hellweekRunId) {
      sql += ` AND c.hellweek_run_id = ?`;
      params.push(filters.hellweekRunId);
    }
    
    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      name: row.name || '',
      tier: row.tier,
      snippet: row.snippet,
      score: Math.abs(row.rank), // FTS5 rank is negative
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  }

  private searchCardsWithFilters(
    filters: SearchQuery['filters'],
    limit: number,
    offset: number
  ): CardSearchResult[] {
    if (!this.db) return [];
    
    let sql = `SELECT id, type, name, tier, metadata_json FROM cards WHERE is_deleted = 0`;
    const params: unknown[] = [];
    
    if (filters?.cardType) {
      sql += ` AND type = ?`;
      params.push(filters.cardType);
    }
    if (filters?.mediaKind) {
      sql += ` AND media_kind = ?`;
      params.push(filters.mediaKind);
    }
    if (filters?.minTier != null) {
      sql += ` AND tier >= ?`;
      params.push(filters.minTier);
    }
    if (filters?.maxTier != null) {
      sql += ` AND tier <= ?`;
      params.push(filters.maxTier);
    }
    if (filters?.hellweekRunId) {
      sql += ` AND hellweek_run_id = ?`;
      params.push(filters.hellweekRunId);
    }
    if (filters?.parentId) {
      sql += ` AND parent_id = ?`;
      params.push(filters.parentId);
    }
    if (filters?.createdAfter) {
      sql += ` AND created_at >= ?`;
      params.push(filters.createdAfter);
    }
    if (filters?.createdBefore) {
      sql += ` AND created_at <= ?`;
      params.push(filters.createdBefore);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      name: row.name || '',
      tier: row.tier,
      score: 1.0, // No ranking for filter-only
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  }

  async getRagContext(query: RagQuery): Promise<RagChunk[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    // For now, use FTS as a proxy for semantic search
    // TODO: Add vector search when embeddings are implemented
    const text = query.semantic.text;
    const limit = query.limit || 10;
    
    const ftsQuery = text.split(/\s+/).map(term => `"${term}"*`).join(' OR ');
    
    const rows = this.db.prepare(`
      SELECT c.id, c.type, c.content_text, c.lore, c.name, rank
      FROM card_fts
      JOIN cards c ON c.id = card_fts.id
      WHERE card_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as any[];
    
    return rows.map((row, i) => ({
      id: `chunk-${row.id}-${i}`,
      sourceId: row.id,
      sourceType: 'card',
      text: row.content_text || row.lore || row.name || '',
      score: Math.abs(row.rank),
    }));
  }

  async getGraphNeighbors(query: GraphNeighborQuery): Promise<GraphNeighbor[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const limit = query.limit || 20;
    const depth = query.depth || 1;
    
    // Simple BFS for depth 1
    let sql = `
      SELECT wn.id, wn.title, wn.summary, we.relation
      FROM wiki_edges we
      JOIN wiki_nodes wn ON wn.id = we.to_id
      WHERE we.from_id = ?
    `;
    const params: unknown[] = [query.nodeId];
    
    if (query.relationTypes && query.relationTypes.length > 0) {
      sql += ` AND we.relation IN (${query.relationTypes.map(() => '?').join(',')})`;
      params.push(...query.relationTypes);
    }
    
    sql += ` LIMIT ?`;
    params.push(limit);
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      relationType: row.relation,
      distance: 1,
    }));
  }

  // ============================================================
  // Direct Access
  // ============================================================

  async getCard(cardId: string): Promise<CardSearchResult | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = this.db.prepare(`
      SELECT id, type, name, tier, metadata_json
      FROM cards WHERE id = ?
    `).get(cardId) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      type: row.type,
      name: row.name || '',
      tier: row.tier,
      score: 1.0,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  async getCardsByParent(parentId: string): Promise<CardSearchResult[]> {
    return this.searchCards({
      filters: { parentId } as any,
      limit: 100,
    });
  }

  async getCardsByRun(runId: string): Promise<CardSearchResult[]> {
    return this.searchCards({
      filters: { hellweekRunId: runId },
      limit: 100,
    });
  }

  // ============================================================
  // Maintenance
  // ============================================================

  async getProjectionVersion(): Promise<number | null> {
    if (!this.db) return null;
    
    const row = this.db.prepare(
      `SELECT value FROM projection_meta WHERE key = 'projection_version'`
    ).get() as { value: string } | undefined;
    
    return row ? parseInt(row.value, 10) : null;
  }

  async setProjectionVersion(version: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.prepare(`
      INSERT INTO projection_meta (key, value)
      VALUES ('projection_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(version.toString());
  }

  async clearAndRebuild(
    hypercoreReader: () => AsyncIterable<HypercoreEvent>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('[SqliteAdapter] Starting full rebuild...');
    
    // Clear all data
    this.db.exec(`
      DELETE FROM cards;
      DELETE FROM card_fts;
      DELETE FROM wiki_nodes;
      DELETE FROM wiki_fts;
      DELETE FROM wiki_edges;
      DELETE FROM embeddings;
    `);
    
    // Replay all events
    let count = 0;
    for await (const event of hypercoreReader()) {
      await this.applyEvent(event);
      count++;
      if (count % 100 === 0) {
        console.log(`[SqliteAdapter] Processed ${count} events...`);
      }
    }
    
    // Update version
    await this.setProjectionVersion(PROJECTION_VERSION);
    
    console.log(`[SqliteAdapter] Rebuild complete. ${count} events processed.`);
  }

  async getStats(): Promise<ProjectionStats> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cardCount = (this.db.prepare(`SELECT COUNT(*) as c FROM cards WHERE is_deleted = 0`).get() as any).c;
    const wikiNodeCount = (this.db.prepare(`SELECT COUNT(*) as c FROM wiki_nodes`).get() as any).c;
    const wikiEdgeCount = (this.db.prepare(`SELECT COUNT(*) as c FROM wiki_edges`).get() as any).c;
    const embeddingCount = (this.db.prepare(`SELECT COUNT(*) as c FROM embeddings`).get() as any).c;
    
    // Get file size
    let dbSizeBytes = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSizeBytes = stats.size;
    } catch {
      // ignore
    }
    
    const version = await this.getProjectionVersion();
    
    return {
      cardCount,
      wikiNodeCount,
      wikiEdgeCount,
      embeddingCount,
      dbSizeBytes,
      projectionVersion: version || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  getMetaValue(key: string): string | null {
    if (!this.db) return null;
    const k = String(key || '').trim();
    if (!k) return null;
    const row = this.db
      .prepare(`SELECT value FROM projection_meta WHERE key = ?`)
      .get(k) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setMetaValue(key: string, value: string): void {
    if (!this.db) return;
    const k = String(key || '').trim();
    if (!k) return;
    const v = value == null ? '' : String(value);
    this.db
      .prepare(
        `INSERT INTO projection_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(k, v);
  }

  listIndexPage(params: { offset: number; limit: number }): { items: any[]; total: number } {
    if (!this.db) throw new Error('Database not initialized');

    const limit = Math.max(1, Math.min(500, Number.isFinite(params?.limit) ? params.limit : 120));
    const offset = Math.max(0, Number.isFinite(params?.offset) ? params.offset : 0);

    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM cards WHERE is_deleted = 0`).get() as any).c as number;

    const rows = this.db
      .prepare(
        `SELECT id, type, media_kind, core_name, name, thumbnail, media_local_path, parent_id, created_at, updated_at, metadata_json
         FROM cards
         WHERE is_deleted = 0
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as any[];

    const items = rows.map((row) => {
      let meta: any = {};
      try {
        meta = row.metadata_json ? JSON.parse(row.metadata_json) : {};
      } catch {
        meta = {};
      }

      const cardId = String(row.id);
      const coreName = row.core_name ? String(row.core_name) : meta?.coreName ? String(meta.coreName) : cardId;

      return {
        cardId,
        coreName,
        name: row.name || meta?.name,
        mediaKind: row.media_kind || meta?.mediaKind,
        thumbnail: row.thumbnail || meta?.thumbnail,
        mediaLocalPath: row.media_local_path || meta?.mediaLocalPath,
        parentCardId: row.parent_id || meta?.parentCardId,
        createdAt: row.created_at || meta?.createdAt,
        updatedAt: row.updated_at || meta?.updatedAt,
        cardType: row.type || meta?.cardType,
      };
    });

    return { items, total };
  }
}

/**
 * Factory function to create a SqliteAdapter
 */
export function createSqliteAdapter(dbPath: string): SqliteAdapter {
  return new SqliteAdapter(dbPath);
}
