I need your help researching technology options for an additional persistence layer in the Hapa Node app. 
 
Right now, the Hapa Protocol design is to user Hypercores as the persistence primitive with each invididual hypercore tracking its own relationship, state, and instructions relative to all the other hypercores via protocol enforcement and continuous validation. The "Relationships" and state are using the hypercores as their first home address and source of Truth, and it needs to stay that way, BUT the local node needs to be able to (1) Search/Sort/Find/Relate/Retrieve at a speed for some use cases that traversing the interlocked hypercore structure will take way too long for an acceptable user experience.  So, the philosophy is to lock permanence/protocol/relationships via tying together the append-only ledgers in hypercore, BUT any "Abstraction" on the permanence (e.g., a "View") should use a local/private database architecture storing/mirroring the data in the hypercore schemas in multiple formats to enable fast traversal and quality retrieval in all contexts.  Which means I want to support vector + sementic search over relational DBs + NoSQL/Documents, then be EXTREMELY flexible about how agents interact and access the persistence layer to create fine grain control and flexibility over their RAG interactions prior/during inference. 
 
This is not a new problem and the AI-agent model really calls for something like this, so there are some open source offerings: 
 
Here are my top 2 (both seem to be very different approaches): 
 
https://github.com/surrealdb/surrealdb 
 
https://github.com/topoteretes/cognee 
 
But I haven't researched widely enough to know if those are actually the best choice--just ones to consider.  So I'd like you to do a thorough market research pass understanding the needs/wants.  I'm attaching a snapshot of the actual node app's development state so you can see where things are at and how they are put together so far.  Use that information in your research, and then come back with pros/cons/options/recommendations for technology choices, approaches, and implementation considerations.
ChatGPT said:

You’re basically asking: “What should be the fast, flexible, local brain that sits on top of my Hypercore soul?”

I’ll walk through (1) what Hapa Node needs given the current architecture, (2) where SurrealDB and Cognee actually fit, (3) other realistic options (esp. SQLite + vector), and (4) a concrete recommendation and migration path.

1. Where Hapa Node is today (so the persistence layer doesn’t fight it)

From the snapshot:

Electron app with React front-end, Node main process.

Hypercore/Hyperswarm used as append-only logs for:

card-library index core

Individual card cores ({cardId})

Hell Week runs ({runId}), wiki index, etc.

Hell Week + Wormhole already produce:

Summaries, key terms, wiki entries, transcripts, lineage, skills, etc.

P2P sync is done at the Hypercore layer; there is no secondary DB yet for fast querying.

Roadmap explicitly calls out Search & Discovery as a high-value next feature.

So Hypercores are already the permanent, shared, network-synced truth, and what you’re asking for is:

A local, private, rebuildable “view engine” that makes querying / RAG / agents fast and flexible.

That’s classic event-sourcing + projections land.

2. Requirements for the extra persistence layer

Pulled from your description + the doc:

Hypercore stays the source of Truth

DB is a cache / projection. You must be able to blow it away and replay from cores.

Local-first, offline, single-user by default

Runs inside Electron (Node) on Mac/Win; no infra assumptions.

Multi-modal & multi-model querying

Mix of:

Text search (full-text, key terms)

Structured filters (card type, tier, skills, sets)

Graph-ish relationships (lineage, sets, wiki links)

Vector/semantic search over embeddings.

Agent-friendly access

Agents should be able to:

Run RAG queries scoped by views (e.g. “only Hell Week output for this run”, “only this user’s skill tree”).

Compose relational + vector + graph constraints.

Ideally through a typed TS API, not raw SQL sprinkled everywhere.

Simple to ship & maintain

You’re already shipping Hypercore + VertexAI + llama.cpp + Veo + Imagen; adding a huge DB stack or Python service inside Electron is expensive cognitive load.

Future-proof

Shouldn’t block later:

Cloud / multi-node deployments

Knowledge-graph upgrades

Using external tools like Cognee.

3. Option A – SurrealDB (multi-model, AI-native DB)

What it is

SurrealDB is an AI-native, multi-model database written in Rust. It supports relational, document, graph, time-series, key-value, full-text and vector search in one system, and has an embedded mode designed for local-first / edge apps. 
SurrealDB
+1

Key traits that match your needs:

Embedded, local-first, single binary.

Multi-model: tables + documents + graph links with SurrealQL.

Native vector columns + vector search. 
SurrealDB
+1

Designed explicitly as a context layer for LLMs/agents in edge settings. 
SurrealDB

Embeddable from JavaScript (WASM or local server). 
SurrealDB

How it would fit Hapa Node

Architecture sketch:

Keep Hypercore as log-of-truth.

Run a SurrealDB embedded instance in the Electron main process (or as a local daemon managed by the app).

Create these core models in Surreal:

card (id, name, type, tier, createdAt, content_text, hellweek_phase, …)

media (card -> media records, paths)

wiki_node / wiki_edge (graph)

embedding (vector field, metadata)

Relationships via record links: card->parent, card->sets, card->wiki_nodes, etc. 
SurrealDB

Projection pipeline:

On each Hypercore append (card created/updated, wiki term, summary, etc.), publish a local event.

A “ProjectionWorker” in main process upserts Surreal records and vector embeddings.

Agents get a single query surface:

SELECT card.*, similarity(card.embedding, $qvec) AS score
FROM card
WHERE type = 'text'
  AND createdAt > $since
  AND wiki.topic CONTAINS 'Hypercore'
ORDER BY score DESC
LIMIT 20;


Pros:

One DB for almost everything: vectors + graph + relational.

Queries look like the way you think about Cards and their relationships.

Strong local-first story via embedded SurrealDB; no extra infra. 
SurrealDB

Future-friendly: same DB can scale up to a server cluster if/when Hapa Node grows. 
SurrealDB

Cons / Risks:

New-ish project vs SQLite/Postgres; smaller ecosystem and examples.

You’ll need to integrate Surreal’s embedded JS bindings or ship a small background binary.

Tooling & docs are improving fast but not yet at “SQLite maturity” level.

You’ll still need a small abstraction layer so the rest of the app isn’t tightly coupled to SurrealQL.

When I’d pick it

If you want to lean into graph RAG + agentic workflows early.

If you’re comfortable doing a 1–2 week spike to get the JS embedded story feeling solid.

If you like the idea that “the Hapa Node DB is the agent memory engine.”

4. Option B – Cognee (AI memory / graph engine, not really a DB)

What it is

Cognee is an open-source “AI memory engine” that:

Ingests raw data via an ECL pipeline (Extract, Cognify, Load).

Builds a knowledge graph + vector index from documents, images, audio, conversations, etc. 
GitHub
+1

Provides advanced graph + RAG style querying (“GRAPH_COMPLETION”, “RAG_COMPLETION”). 
Deepnote

Self-hosted version stores everything locally; Python library first. 
GitHub
+1

This is more like: “Plug in your data, get a smart graph + memory layer” than “a general embedded DB.”

How it would fit

For Hapa Node Desktop specifically:

You’d need a Python runtime + Cognee server running alongside Electron.

The node app would send content from Hypercores to Cognee via an API.

Cognee would maintain its own vector DB + graph DB underneath (likely Chroma + Neo4j, etc.).

Agents would query Cognee’s endpoints for memory/graph operations, and Hypercore would remain your canonical log.

Pros:

Very aligned with “memory for agents” and graph RAG.

Gives you a ready-made ECL pipeline; less to build yourself.

Backed by active research and benchmarks showing better performance than vanilla RAG on tasks like HotpotQA. 
Deepnote

Cons:

Python + separate server is heavy for a local Electron app.

Less control over the underlying storage format; you’re delegating a lot of the memory design to Cognee.

Now you have three persistence stories in one node: Hypercore, Cognee’s DBs, and whatever you use for UI / local indexes.

Where I’d use Cognee

As a cloud-side / shared Hapa AG service later:

Aggregate multiple users’ node streams.

Run long-running, ontology-aware knowledge graph builds.

Provide cross-node graph queries / multi-user AI memory.

Not as your primary embedded DB in the desktop node.

5. Option C – SQLite (+ FTS + vector extension) as the “Projection Engine”

This is the boring, extremely practical option – and honestly a very strong candidate.

What it is

SQLite: zero-config, embedded relational DB, rock-solid, runs everywhere.

Extensions:

sqlite-vss / sqlite-vec: vector similarity search inside SQLite using Faiss or pure C. 
GitHub
+2
Observable
+2

FTS5: fast full-text search built-in.

Other extensions for bloom filters, HTTP, CSV, etc. 
SQLite AI Blog
+1

This gives you:

Tables + JSON

Full-text search

Vector similarity

All in one embedded .db file, easy to ship via Electron.

How it would fit Hapa Node

Schema sketch:

-- main cards
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  type TEXT,
  name TEXT,
  tier INTEGER,
  created_at TEXT,
  parent_id TEXT,
  hellweek_run_id TEXT,
  metadata JSON
);

-- full text
CREATE VIRTUAL TABLE card_fts USING fts5(
  id UNINDEXED,
  content,
  name,
  tokenize='porter'
);

-- wiki nodes + edges
CREATE TABLE wiki_nodes (
  id TEXT PRIMARY KEY,
  title TEXT,
  summary TEXT
);

CREATE TABLE wiki_edges (
  from_id TEXT,
  to_id TEXT,
  relation TEXT
);

-- embeddings (with sqlite-vss or sqlite-vec)
CREATE TABLE card_embeddings (
  id INTEGER PRIMARY KEY,
  card_id TEXT,
  model TEXT,
  dim INTEGER,
  vec BLOB
);


Then you attach sqlite-vss and expose a virtual table for similarity searches. 
Reddit
+4
GitHub
+4
Observable
+4

Projection pipeline from Hypercore:

On append to card-library or {cardId} cores, push an event to a small local queue.

ProjectionWorker:

Upsert into cards, card_fts, wiki_nodes, wiki_edges.

Compute embedding if missing, insert into card_embeddings.

On app start: if DB missing or corrupt, rebuild entire SQLite DB by replaying cores.

Agents query via a simple TypeScript API over this:

searchCards({
  text: "hypercore wormhole pipeline",
  semantic: true,
  filters: { type: "text", minTier: 2 },
  limit: 32
})


which compiles into:

FTS query (for lexical match), plus

vector similarity query over embeddings,

combined with WHERE filters.

Pros:

Extremely mature, battle-tested, small footprint.

Node / Electron integration is trivial (better-sqlite3, sqlite3, etc.).

All fully local; no extra daemons, no Python.

You control the schema exactly and can evolve it easily.

Cons:

No first-class graph query language; you’re modeling edges manually.

You’ll hand-roll some things that Surreal gives you (graph traversal, security policies).

For extremely large corpora, specialized vector DBs can outperform, but for a local personal node, SQLite + vector extensions is usually plenty.

6. Other candidates (quick scan)

There are dedicated vector DBs like Milvus, Qdrant, Chroma, LanceDB, etc., all solid in their own niches.
Medium
+1

But for your use case:

Local Electron app

Log-of-truth already in Hypercore

Need one embedded DB, not 3 servers

…bundling a heavy vector DB plus a separate document or graph DB would be overkill right now.

If you later hit scale or performance ceilings, you can always shard embeddings out to Qdrant/Chroma while keeping SQLite/Surreal for metadata.

7. My recommendation (opinionated)
Short term (shipping soon, low risk)

Use SQLite (+ FTS5 + sqlite-vss/sqlite-vec) as the canonical “view engine” for Hapa Node.

Implement a PersistenceAdapter interface in TypeScript:

interface PersistenceAdapter {
  upsertCardFromEvent(event: CardEvent): Promise<void>;
  searchCards(query: SearchQuery): Promise<CardSearchResult[]>;
  getGraphNeighbors(nodeId: string, opts: GraphQuery): Promise<WikiNode[]>;
  getRagContext(query: RagQuery): Promise<ContextChunk[]>;
}


Provide SqliteAdapter implementation first.

Treat SQLite DB as a cache over Hypercores:

Always be able to rebuild from cores.

Never store anything only in SQLite.

This gets you:

Fast local search / RAG.

Clean API boundary for agents.

Minimal operational complexity.

Medium term (experiment / upgrade path)

Run a small SurrealDB spike behind a feature flag.

Create a SurrealAdapter that implements the same interface.

Map your high-level models (cards, wiki, embeddings) into Surreal’s multi-model world.

Try out:

GraphRAG patterns.

More complex agent queries (cards + relationships + vectors). 
SurrealDB
+1

If it feels good and the ecosystem matures nicely, you can:

Offer Surreal as an optional “advanced backend mode” in settings.

Or migrate entirely if it clearly wins in practice.

Longer term

Treat Cognee as a “cloud brain” / AG layer, not a desktop DB.

When you deploy Hapa AG as a multi-user service, Cognee can:

Build org-wide or family-wide knowledge graphs from many nodes’ Hypercores.

Provide graph-enhanced AI memory across nodes. 
GitHub
+1

Your local node DB (SQLite or Surreal) and Cognee can share schemas/ontologies so moving between them is easier.

8. Implementation considerations & gotchas

Idempotent projections

Hypercores are append-only and can be replayed; projection code must handle duplicate events cleanly.

Versioning

Keep a projection_version stored in SQLite/Surreal. If you bump schemas, you can detect mismatches and trigger a full rebuild.

Agent-facing permissions

Even though it’s all local, you may want scopes:

“Only cards from this workspace”

“Only my own persona’s cards”

Bake that into the TS API rather than letting agents spray arbitrary raw queries.

Embeddings

Standardize on a small set of embedding models (e.g. text-embedding-3-large / small or Gemini equivalent).

Store model + dim + version in the embeddings table to support future re-embedding sweeps.

Backfill / maintenance UI

In Profile or a “System” tab, expose:

“Rebuild search index from Hypercores”

“Recompute embeddings”

And show stats like #cards, #embeddings, DB size.

If you want, next step I can:

Sketch an actual SQLite schema + a small TypeScript SqliteAdapter API, tuned to your existing CardIndexEntry shape, and/or

Draft what a “Search & Discovery” panel in the Hapa UI would look like once this layer exists (filters, semantic search, graph nav, etc.).

You said:
Yeah I like your plan starting from step 7 on and your next step.  Can you write a detailed plan for (you, basically, inside of windsurf) to reference as requirements, implementation guide, decision rationale, etc.?  I'm going to drop in the repo and just ask your other version to review and work on it, so write it that way.
ChatGPT said:
Thought for 8s

Here’s a drop-in design doc you can put straight into the repo for Windsurf / other AIs to use.

Hapa Node – Local Persistence Layer Design (v0.1)

Status: Draft
Primary implementer: AI dev assistant (e.g., Windsurf)
Target app: Hapa Node (Electron + Hypercore)

1. Purpose & Context

The Hapa Node currently uses Hypercore as its persistence primitive:

Each Hypercore log (e.g., card-library, card-{id}, hellweek-run-{id}, wiki cores, etc.) is the source of Truth.

Protocol logic & relationships between entities are enforced via the append-only Hypercore graph and validation rules.

This is excellent for permanence, replication, and protocol enforcement, but it’s too slow and too awkward for:

Fast search (full-text, semantic, combined filters)

Complex traversals (e.g., “all cards related to this skill across Hell Week runs”)

Fine-grained RAG for AI agents

Goal: Introduce a local, private, rebuildable persistence layer (SQLite-based) that acts as a projection engine for fast query, search, and RAG — while keeping Hypercore as the only canonical store.

2. Goals & Non-Goals
2.1 Goals

Hypercore remains source of Truth

All canonical state lives in Hypercores.

The DB is a derived view and can always be rebuilt from the cores.

Fast local querying

Full-text search over card content, wiki entries, transcripts, etc.

Structured filtering (type, tier, run, timestamps, etc.).

Semantic search over embeddings (vector similarity).

Agent-friendly API

Single TypeScript interface (PersistenceAdapter) used by:

UI features (search, discovery views).

Agent workflows (RAG context retrieval, graph expansion).

No scattering of raw SQL throughout the codebase.

Local-first, offline

Works fully offline inside the Electron app.

DB lives in the user’s app data directory.

Schema & projection versioning

Ability to detect schema version mismatches and trigger a rebuild from Hypercores.

Future extensibility

Later, we can:

Swap SQLite out for SurrealDB or others, behind same PersistenceAdapter.

Add optional integration with Cognee or cloud graph engines.

2.2 Non-Goals (for v0.1)

Not trying to create a distributed DB — Hypercore already covers multisite sync.

Not trying to store anything only in the DB; DB must always be derivable from Hypercores.

Not trying to be the final “AI memory layer” for all time; this is a solid starting projection layer.

3. Architectural Overview
3.1 High-Level Diagram
                   ┌─────────────────────┐
                   │  Hypercore Logs     │
                   │ (card, wiki, runs…) │
                   └─────────┬───────────┘
                             │ append events
                             ▼
                   ┌─────────────────────┐
                   │ Projection Worker   │
                   │ (Node / TS)         │
                   └─────────┬───────────┘
                             │ upserts
               ┌─────────────┴──────────────┐
               │                            │
               ▼                            ▼
      ┌────────────────┐          ┌────────────────────┐
      │ SQLite DB      │          │ Embeddings Engine  │
      │ (tables, FTS,  │ ◀──────▶ │ (LLM/embedding API │
      │ vector extn)   │          └────────────────────┘
      └────────┬───────┘
               │
               ▼
      ┌────────────────────┐
      │ PersistenceAdapter │
      │ (TS interface)     │
      └────────┬───────────┘
               │
       ┌───────┴─────────┐
       │                 │
       ▼                 ▼
  UI Components      Agents / RAG
 (search, views)     (context fetch)

4. Core Abstraction: PersistenceAdapter

All consumers (UI, agents, services) must access the DB via this interface. That allows us to replace the backend (SQLite, SurrealDB, etc.) without touching most code.

4.1 TypeScript Interface (draft)
// src/persistence/PersistenceAdapter.ts

export interface SearchFilters {
  type?: string;             // e.g. "card", "wiki", "run"
  cardType?: string;         // e.g. "text", "image", ...
  minTier?: number;
  maxTier?: number;
  hellweekRunId?: string;
  createdAfter?: string;     // ISO date
  createdBefore?: string;
  tags?: string[];           // tags or topics
}

export interface SemanticQuery {
  text: string;
  embeddingModel?: string;
  topK?: number;
}

export interface SearchQuery {
  text?: string;             // full-text
  filters?: SearchFilters;
  semantic?: SemanticQuery;  // if present, combine FTS + vector
  limit?: number;
  offset?: number;
}

export interface CardSearchResult {
  id: string;
  type: string;
  name: string;
  tier?: number;
  snippet?: string;
  score: number;             // combined relevance score
  metadata?: Record<string, unknown>;
}

export interface RagChunk {
  id: string;
  sourceId: string;          // cardId / wikiId / runId
  sourceType: string;        // 'card' | 'wiki' | 'run' | ...
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

export interface GraphNeighborQuery {
  nodeId: string;
  relationTypes?: string[];  // e.g. "linked_to", "derived_from"
  depth?: number;            // BFS depth
  limit?: number;
}

export interface GraphNeighbor {
  id: string;
  title: string;
  summary?: string;
  relationType: string;
  distance: number;
}

export interface PersistenceAdapter {
  // Called by projection pipeline
  applyEvent(event: HypercoreEvent): Promise<void>;

  // Query primitives
  searchCards(query: SearchQuery): Promise<CardSearchResult[]>;
  getRagContext(query: RagQuery): Promise<RagChunk[]>;

  // Simple graph API (wiki / card relationships)
  getGraphNeighbors(
    query: GraphNeighborQuery,
  ): Promise<GraphNeighbor[]>;

  // Maintenance
  getProjectionVersion(): Promise<number | null>;
  setProjectionVersion(version: number): Promise<void>;
  clearAndRebuildFromHypercores(): Promise<void>;
}

// Define HypercoreEvent to be compatible with existing event system
export interface HypercoreEvent {
  type: string;              // e.g. 'CARD_CREATED', 'CARD_UPDATED', 'WIKI_NODE'
  payload: any;              // strongly type in implementation
  timestamp: string;         // ISO
}

4.2 Implementation Plan

First concrete implementation: SqliteAdapter.

Keep the interface in its own module; no UI/agent code imports SQLite directly.

5. SQLite-Based Design (v0.1)
5.1 Choice of SQLite Library

Target: Node/Electron main process.

Recommended:

better-sqlite3 for sync, fast, simple API.

Alternatively sqlite3 if async fits better, but better-sqlite3 is simpler for an embedded, app-scoped DB.

5.2 Database Location

Store DB in the app data directory, e.g.:

macOS: ~/Library/Application Support/HapaNode/persistence.db

Windows: %APPDATA%/HapaNode/persistence.db

Use Electron’s app paths API to resolve OS-specific location.

5.3 Schema (Initial)

Note: This is a starting point; you can evolve as necessary.

5.3.1 Cards
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- "text", "image", "skill", etc.
  name TEXT,
  tier INTEGER,
  hellweek_run_id TEXT,
  parent_id TEXT,
  created_at TEXT NOT NULL,     -- ISO timestamp
  updated_at TEXT NOT NULL,     -- ISO timestamp
  metadata_json TEXT            -- JSON string for misc fields
);


Full-text:

CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(
  id UNINDEXED,
  name,
  content,
  tokenize='porter'
);


content will store flattened text: summary, description, transcript segments, etc.

5.3.2 Wiki Nodes & Edges
CREATE TABLE IF NOT EXISTS wiki_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS wiki_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relation)
);


(Optional FTS on title, summary):

CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(
  id UNINDEXED,
  title,
  summary,
  tokenize='porter'
);

5.3.3 Embeddings

Using a vector extension like sqlite-vss or sqlite-vec:

CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,        -- card id / wiki id / etc.
  source_type TEXT NOT NULL,      -- 'card' | 'wiki' | 'run'
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vec BLOB NOT NULL
);


Then, create the vector index according to the chosen extension’s instructions (e.g. CREATE VIRTUAL TABLE embeddings_vss USING vss0(...)).

5.3.4 Projection Meta
CREATE TABLE IF NOT EXISTS projection_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);


Store projection_version and possibly last_processed_hypercore_seq per core.

6. Projection Pipeline
6.1 Event Flow

Hypercore layer already emits events when:

Cards are created/updated.

Hell Week runs are created/updated.

Wiki nodes/edges are created/updated.

Summaries / transcripts / derived content is written.

For each event, call:

persistenceAdapter.applyEvent(event);


SqliteAdapter.applyEvent will:

Start a DB transaction.

Upsert into the relevant tables.

Update FTS rows.

Optionally trigger embedding computation (or enqueue it).

6.2 Example: CARD_CREATED Event

Assume payload shape:

interface CardCreatedPayload {
  id: string;
  type: string;
  name: string;
  tier?: number;
  hellweekRunId?: string;
  parentId?: string;
  contentText?: string;   // flattened text from Hypercore
  metadata?: Record<string, unknown>;
  timestamp: string;
}


applyEvent logic (pseudocode):

async function handleCardCreated(db, payload: CardCreatedPayload) {
  const metadataJson = JSON.stringify(payload.metadata ?? {});

  db.transaction(() => {
    db.prepare(`
      INSERT INTO cards (id, type, name, tier, hellweek_run_id,
                         parent_id, created_at, updated_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        tier = excluded.tier,
        hellweek_run_id = excluded.hellweek_run_id,
        parent_id = excluded.parent_id,
        updated_at = excluded.updated_at,
        metadata_json = excluded.metadata_json;
    `).run(
      payload.id,
      payload.type,
      payload.name ?? null,
      payload.tier ?? null,
      payload.hellweekRunId ?? null,
      payload.parentId ?? null,
      payload.timestamp,
      payload.timestamp,
      metadataJson
    );

    db.prepare(`
      INSERT INTO card_fts (id, name, content)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        content = excluded.content;
    `).run(
      payload.id,
      payload.name ?? '',
      payload.contentText ?? ''
    );
  });

  // Optionally enqueue embedding computation
  enqueueEmbeddingIfNeeded(payload.id, 'card', payload.contentText ?? '');
}

6.3 Embedding Computation

Use an existing embedding provider (OpenAI, Gemini, local model via llama.cpp, etc.).

Implement a simple queue so embedding calls don’t block the UI:

E.g. embeddingQueue.push({ sourceId, sourceType, text, model }).

Worker consumes queue, calls embedding API, inserts into embeddings.

Pseudocode:

async function indexEmbedding(
  sourceId: string,
  sourceType: string,
  text: string,
  model: string
) {
  if (!text.trim()) return;
  const vec = await embeddingProvider.embed(text, model);
  const dim = vec.length;

  const vecBlob = encodeVectorToBlob(vec); // Float32Array -> Buffer

  db.prepare(`
    INSERT INTO embeddings (source_id, source_type, model, dim, vec)
    VALUES (?, ?, ?, ?, ?)
  `).run(sourceId, sourceType, model, dim, vecBlob);
}

7. Query Implementation (SQLite)
7.1 Full-Text + Filters

To implement searchCards:

If query.text present:

Use card_fts with MATCH against name and content.

Join results back to cards for metadata & filters.

Apply filters (tier, run, created_after, etc.).

Order by FTS rank or combined score.

Example SQL (simplified):

SELECT c.id, c.type, c.name, c.tier, c.hellweek_run_id,
       snippet(card_fts, 1, '<b>', '</b>', '...', 10) AS snippet,
       rank
FROM card_fts
JOIN cards c ON c.id = card_fts.id
WHERE card_fts MATCH :ftsQuery
  AND (:cardType IS NULL OR c.type = :cardType)
  AND (:minTier IS NULL OR c.tier >= :minTier)
  AND (:maxTier IS NULL OR c.tier <= :maxTier)
ORDER BY rank
LIMIT :limit OFFSET :offset;

7.2 Vector Search

Depending on the chosen extension (example pseudo-SQL using sqlite-vss-style):

SELECT c.id, c.type, c.name, c.tier,
       vss_distance(emb.vec, :queryVec) AS distance
FROM embeddings emb
JOIN cards c ON c.id = emb.source_id
WHERE emb.source_type = 'card'
  AND emb.model = :model
  AND (:cardType IS NULL OR c.type = :cardType)
ORDER BY distance ASC
LIMIT :limit;

7.3 Combined FTS + Vector

In searchCards, when both text and semantic are specified:

Compute embedding for query text (if not supplied).

Run FTS and vector search separately.

Combine results in TS:

Normalize scores to [0,1].

Weighted sum: score = w_fts * s_fts + w_vec * s_vec.

Return top N.

7.4 RAG Context (getRagContext)

For RagQuery:

Run vector search on embeddings with query.semantic.

Optionally cross-check via FTS if query.semantic.text exists.

For each top hit:

Pull the underlying text chunk from:

Cards (content in card_fts) or

Wiki nodes / transcripts (separate tables if needed).

Build RagChunk[] with sourceId, sourceType, text, score.

8. Graph Queries (getGraphNeighbors)

Implement minimal graph support for wiki nodes and card relationships via wiki_edges:

BFS up to depth:

For each level, get neighbors via wiki_edges where from_id = nodeId.

Respect relationTypes filter if provided.

Return limited set of neighbors.

Pseudocode SQL:

SELECT wn.id, wn.title, wn.summary, we.relation
FROM wiki_edges we
JOIN wiki_nodes wn ON wn.id = we.to_id
WHERE we.from_id = :nodeId
  AND (:relation IS NULL OR we.relation = :relation)
LIMIT :limit;


You can iterate in TS for depth > 1.

9. Projection Versioning & Rebuild
9.1 Versioning

Define a constant CURRENT_PROJECTION_VERSION (e.g. 1).

On startup:

const storedVersion = await adapter.getProjectionVersion();
if (storedVersion !== CURRENT_PROJECTION_VERSION) {
  await adapter.clearAndRebuildFromHypercores();
  await adapter.setProjectionVersion(CURRENT_PROJECTION_VERSION);
}

9.2 clearAndRebuildFromHypercores()

Implementation sketch:

Drop all SQLite tables or delete all rows.

For each relevant Hypercore:

Replay from beginning.

For each log entry, convert to HypercoreEvent and call applyEvent.

Optionally show a progress UI in Electron (since this could take time for large datasets).

10. Future Extensions
10.1 SurrealDB Adapter

Later, implement:

SurrealAdapter that implements PersistenceAdapter.

Map existing entities to SurrealDB schema (using SurrealQL).

Use Surreal’s graph + vector + document capabilities for more advanced agent queries.

Keep the same client-facing PersistenceAdapter API so switching is config-driven.

10.2 Cognee Integration (Cloud / AG Layer)

Longer-term:

Run Cognee as a service on top of aggregated Hypercore streams (not per-node).

Use Cognee for:

Org/family-level knowledge graphs.

Cross-user RAG and graph-based reasoning.

Local node persists with SQLite/Surreal; Cognee becomes a higher-level memory & reasoning layer.

11. Implementation Checklist (for Windsurf / AIs)

Phase 0 – Scaffolding

 Add src/persistence/PersistenceAdapter.ts and define interface.

 Add src/persistence/SqliteAdapter.ts with constructor and basic wiring.

 Wire SqliteAdapter into app initialization and pass to modules that need it.

Phase 1 – SQLite Integration

 Add dependency: better-sqlite3 (or chosen library).

 Create DB file in Electron app data directory.

 Implement schema creation (cards, card_fts, wiki_nodes, wiki_edges, embeddings, projection_meta).

Phase 2 – Projection Wiring

 Identify current Hypercore event emission points for:

Card lifecycle

Hell Week runs

Wiki node/edge creation

Summaries, transcripts

 Implement conversion to HypercoreEvent.

 Implement SqliteAdapter.applyEvent handlers (at least for CARD_CREATED, CARD_UPDATED, WIKI_NODE_CREATED, WIKI_EDGE_CREATED).

Phase 3 – Embeddings

 Add embeddingProvider abstraction (OpenAI/Gemini/local).

 Implement a simple embedding queue + worker.

 Integrate with SqliteAdapter.applyEvent to enqueue needed embeddings.

 Implement vector index usage (via chosen SQLite vector extension).

Phase 4 – Query API

 Implement searchCards with FTS + filters.

 Add optional vector search and score combination when semantic is provided.

 Implement getRagContext using vector search + chunk retrieval.

 Implement getGraphNeighbors for wiki.

Phase 5 – UI & Agent Integration

 Wire searchCards into search/discovery UI components.

 Wire getRagContext into agent workflows (RAG context fetch).

 Add system settings / dev tools for:

Rebuild index

Show basic stats (counts, DB size, projection version).

Phase 6 – Testing & Hardening

 Test with empty DB (cold start).

 Test rebuild flow after bumping CURRENT_PROJECTION_VERSION.

 Fuzz test events out of order or repeated; ensure applyEvent is idempotent.

 Add logging for projection errors and provide fallback / retry mechanism.

That’s the full map.

If you want, I can next generate:

Concrete SQL migration script(s)

A first-pass SqliteAdapter.ts implementation skeleton

Or an example “Search & Discovery” UI spec that uses this adapter.