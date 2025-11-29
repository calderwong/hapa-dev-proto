# Functional Requirements Document  
## Wormhole Feature – Hapa Node / AI-Agent IDE Integration  
**Version:** 0.1 (Draft)  
**Date:** 2025-11-28  

---

## 1. Introduction

### 1.1 Purpose

This document defines the **functional and non-functional requirements** for the **Wormhole** feature of the Hapa Node. Wormhole is the ingestion and compression gateway that:

1. Accepts user and agent-submitted content (text, markdown, PDFs, audio, video).  
2. Ingests that content into the Node’s **Sovereign Memory** via **Hypercore**.  
3. Creates a corresponding **Card** in the Hapa Card system.  
4. Transcribes, summarizes, extracts key terms, and updates the **Wiki/knowledge graph**, linking back to the original sources.

It is designed to be callable by both humans through UI and **AI dev-agents** inside IDEs (e.g., Windsurf, Cursor) working on/with the Hapa Node.

### 1.2 Background

The Hapa Protocol centers around **Sovereign Memory**, **Need-Minting**, and **Infinite Sharpening**. Wormhole is the “drag anything in → turn it into structured knowledge” front door. It is also a key building block for:

- Foundations syncing (what have you watched/read/listened to).  
- Protocol sharpening via content distillation.  
- Multi-agent workflows that need a consistent way to store and relate content.

---

## 2. Scope

### 2.1 In Scope (MVP)

- Ingesting content files: text, markdown, PDFs, audio, video.  
- Creating and managing **Hypercore feeds** per ingested unit.  
- Creating **Cards** that represent the ingested content.  
- Running:
  - Transcription (audio/video → text),
  - Summarization,
  - Key-term extraction.
- Creating/updating **Wiki entries** with links back to source Cards/Hypercores.  
- Providing a **programmatic API** for AI dev-agents and tools in an IDE.  
- Basic search exposure of the resulting artifacts within the Node.

### 2.2 Out of Scope (MVP)

- Full UI/UX design of the Card Library and Wiki browser (only integration points assumed).  
- Advanced visualization of the knowledge graph.  
- Cross-node or network-wide synchronization policies (handled by higher-level Hapa/THN protocols).  
- Complex access-control/ACL UI (privacy and sovereignty are assumed but UI may be minimal at first).

---

## 3. Actors & Stakeholders

### 3.1 Actors

- **End User (Human)**  
  Drops files into Wormhole via UI or selects from file system.

- **AI Dev-Agent (IDE Agent)**  
  Calls Wormhole APIs to ingest content, monitor status, and consume derived artifacts within an AI-assisted development environment.

- **Phamiliar / Internal AI Agent**  
  Uses Wormhole outputs (Cards, Wiki entries, transcripts, etc.) to perform reasoning, teaching, or protocol-sharpening tasks.

### 3.2 Stakeholders

- **Hapa Node Core Maintainers** – implement and maintain Wormhole.  
- **Hapa Protocol Designers** – depend on Wormhole outputs for governance, foundations, and Infinite Sharpening.  
- **End Users & Consuls** – rely on Wormhole to keep memory sovereign, searchable, and auditable.

---

## 4. High-Level Features & Use Cases

### 4.1 High-Level Features

- Content ingestion (file & programmatic).  
- Hypercore-backed storage with append-only semantics.  
- Card creation with typed metadata.  
- Transcription (audio/video → text).  
- Summarization at multiple resolutions.  
- Key term extraction and relationship mapping.  
- Wiki page creation and updates with source links.  
- Event-driven API surface for IDE agents.

### 4.2 Core Use Cases

- **UC-1: Drag-and-Drop File Ingestion**  
  User drags a PDF into the Node → Wormhole ingests it, creates a Hypercore, makes a Document Card, summarizes it, extracts key terms, and links terms into the Wiki.

- **UC-2: Programmatic Ingestion from IDE**  
  AI agent calls `wormhole.ingestContent()` with an audio file path → Node transcribes and summarizes the audio, creates an Audio Card, and updates Wiki entries accordingly.

- **UC-3: Foundations Compression**  
  User imports a batch of reading/watch history → Wormhole processes them into Cards + Wiki graph so future debates can reference shared Foundations.

---

## 5. Functional Requirements

> **Notation:**  
> WH-REQ-x = top-level functional requirement.  
> WH-REQ-x.y = sub-requirement.

---

### 5.1 Content Ingestion

**WH-REQ-1**: Wormhole SHALL support ingestion of the following file types in MVP:

- **WH-REQ-1.1**: Plain text (`.txt`)  
- **WH-REQ-1.2**: Markdown (`.md`)  
- **WH-REQ-1.3**: PDF (text-based; OCR optional in later phase)  
- **WH-REQ-1.4**: Audio files (`.wav`, `.mp3`, plus extensible list)  
- **WH-REQ-1.5**: Video files (`.mp4`, `.mkv`, plus extensible list)

**WH-REQ-2**: Wormhole SHALL provide:

- **WH-REQ-2.1**: A UI-based ingestion flow (e.g., drag-and-drop, file picker).  
- **WH-REQ-2.2**: A programmatic ingestion API accessible by IDE agents and internal AI processes.

**WH-REQ-3**: For each ingestion request, Wormhole SHALL:

- **WH-REQ-3.1**: Validate file type and size against configurable limits.  
- **WH-REQ-3.2**: Assign a unique **Content ID**.  
- **WH-REQ-3.3**: Initiate the Hypercore creation/attach process.  
- **WH-REQ-3.4**: Initiate Card creation.  
- **WH-REQ-3.5**: Enqueue content for downstream processing (transcription, summarization, key terms, wiki).

---

### 5.2 Hypercore Integration (Sovereign Memory)

**WH-REQ-4**: For every new ingested Document, Wormhole SHALL create or attach a **Hypercore feed** that:

- **WH-REQ-4.1**: Is identified by a unique Hypercore key.  
- **WH-REQ-4.2**: Belongs to the owner’s DID (user or agent).  
- **WH-REQ-4.3**: Stores metadata (title, media type, timestamps, etc.) in an initial entry.

**WH-REQ-5**: Wormhole SHALL ensure **append-only semantics**:

- **WH-REQ-5.1**: No destructive updates to Hypercore entries.  
- **WH-REQ-5.2**: Document updates are appended as new entries with explicit version metadata.

**WH-REQ-6**: Wormhole SHALL record **provenance**:

- **WH-REQ-6.1**: The DID (user or agent) initiating ingestion.  
- **WH-REQ-6.2**: The tool or client used (e.g., “wormhole:v1”, “HPN-IDE-Agent”).  
- **WH-REQ-6.3**: Timestamps for ingestion start and completion.

---

### 5.3 Card Creation & Management

**WH-REQ-7**: For each ingested Document, Wormhole SHALL create a **Card** with:

- **WH-REQ-7.1**: A unique `cardId`.  
- **WH-REQ-7.2**: A `cardType` inferred from media type:
  - Text/PDF → `Document/Scroll` type  
  - Audio → `Audio` type  
  - Video → `Video` type
- **WH-REQ-7.3**: Initial metadata:
  - title (auto-generated from file name or content, editable later),  
  - short description (initially empty or from first summary),  
  - ownerDid,  
  - hypercoreKey,  
  - mediaType,  
  - createdAt, updatedAt,  
  - processingStatus (`pending`, `in_progress`, `complete`, `failed`).

**WH-REQ-8**: Wormhole SHALL register the Card in the Node’s **Card Library** so it:

- **WH-REQ-8.1**: Appears in the user’s list of Cards.  
- **WH-REQ-8.2**: Is discoverable via local search by title, tags, or key terms.  
- **WH-REQ-8.3**: Is addressable by other features (Gardens, Skill Trees, Phamiliars).

---

### 5.4 Transcription (Audio/Video)

**WH-REQ-9**: For audio and video content, Wormhole SHALL run a **transcription pipeline**:

- **WH-REQ-9.1**: Generate a full text transcript of spoken audio.  
- **WH-REQ-9.2**: Include timestamps for segments (e.g., per sentence/utterance).  
- **WH-REQ-9.3**: Optionally perform speaker diarization (Speaker 1, Speaker 2, etc.).  
- **WH-REQ-9.4**: Store the transcript in the associated Hypercore feed.  
- **WH-REQ-9.5**: Attach transcript metadata to the Card (e.g. `card.transcriptAvailable = true`).

**WH-REQ-10**: For video content, Wormhole SHOULD support **visual descriptors**:

- **WH-REQ-10.1**: Capture and store key frames or simple visual descriptions (optional MVP).  
- **WH-REQ-10.2**: Associate visual descriptors with timestamps for future visual reasoning.

---

### 5.5 Summarization & Multi-Resolution Compression

**WH-REQ-11**: Wormhole SHALL generate summaries for all ingested content where text is available (raw text, PDF, transcript).

- **WH-REQ-11.1**: A **short summary** (1–3 sentences).  
- **WH-REQ-11.2**: A **medium summary** (1–3 paragraphs).  
- **WH-REQ-11.3**: A **bullet-point outline** of key sections/topics (if text length exceeds configurable threshold).

**WH-REQ-12**: Summaries SHALL:

- **WH-REQ-12.1**: Be stored in the Hypercore feed as new entries.  
- **WH-REQ-12.2**: Be referenced from the Card metadata (`card.summaries[]`).  
- **WH-REQ-12.3**: Include metadata indicating:
  - summarization model/tool used,  
  - timestamp,  
  - version.

---

### 5.6 Key-Term Extraction & Relationships

**WH-REQ-13**: For each processed Document, Wormhole SHALL perform **key-term extraction** over the available text (source text and/or transcript):

- **WH-REQ-13.1**: Identify entities, topics, concepts (e.g., “Hypercore”, “Need-Minting”, “Thor”, “Campfire”).  
- **WH-REQ-13.2**: For each term, assign:
  - canonical string,  
  - type (person, concept, location, protocol, etc.),  
  - confidence score.

**WH-REQ-14**: Wormhole SHALL associate extracted terms with the Card:

- **WH-REQ-14.1**: Store terms in Card metadata (e.g., `card.keyTerms[]`).  
- **WH-REQ-14.2**: Add terms as searchable tags.

**WH-REQ-15**: Wormhole SHALL prepare relationship data:

- **WH-REQ-15.1**: Co-occurrence information (which terms appear together in the same Document or segment).  
- **WH-REQ-15.2**: Pointers from terms to specific timestamps/sections where they appear.

---

### 5.7 Wiki Page / Knowledge Graph Integration

**WH-REQ-16**: For each key term, Wormhole SHALL consult the Node’s **Wiki index**:

- **WH-REQ-16.1**: If a Wiki entry exists:
  - append this Document/Card as a new source.  
  - optionally update aggregate summary if content is significantly new.
- **WH-REQ-16.2**: If no Wiki entry exists:
  - create a **new Wiki stub** with:
    - term name,  
    - short definition (derived from current context),  
    - list of source Cards/Hypercores,  
    - initial related terms.

**WH-REQ-17**: Each Wiki entry SHALL maintain source linkage:

- **WH-REQ-17.1**: List of source Card IDs and Hypercore keys.  
- **WH-REQ-17.2**: Optional Fine-grained references (e.g., “Video Card X, 00:10:30–00:11:45”).

**WH-REQ-18**: Wormhole SHALL update **cross-links** among Wiki entries:

- **WH-REQ-18.1**: When multiple terms co-occur frequently, mark them as related.  
- **WH-REQ-18.2**: Update “related terms” lists on respective Wiki pages.

---

### 5.8 Search & Exposure

**WH-REQ-19**: Wormhole outputs (Cards, Wiki entries, key terms) SHALL be discoverable:

- **WH-REQ-19.1**: Via local Node search (by title, term, tag).  
- **WH-REQ-19.2**: Via internal APIs that THN / “Ask the Network” can use, subject to privacy policies.

**WH-REQ-20**: Access to Wormhole-derived artifacts SHALL respect **Sovereign Memory** and user-configured sharing policies.

---

### 5.9 Agent / IDE API Integration

**WH-REQ-21**: Wormhole SHALL expose a programmatic API for agents (conceptual signature):

- **WH-REQ-21.1**: `wormhole.ingestContent({ path|bytes, mediaType, ownerDid, tags?, sourceLabel? }) → { contentId, cardId, hypercoreKey, status }`  
- **WH-REQ-21.2**: `wormhole.getStatus(contentId|cardId) → { status, stepsCompleted[], errors? }`  
- **WH-REQ-21.3**: `wormhole.getDerivedArtifacts(cardId) → { transcripts?, summaries[], keyTerms[], wikiEntries[] }`

**WH-REQ-22**: Wormhole SHALL emit events on the Node’s event bus:

- **WH-REQ-22.1**: `wormhole.ingest.started`  
- **WH-REQ-22.2**: `wormhole.ingest.completed`  
- **WH-REQ-22.3**: `wormhole.ingest.failed`  
- **WH-REQ-22.4**: `wormhole.wiki.updated`

Each event includes relevant IDs (contentId, cardId, ownerDid, hypercoreKey).

**WH-REQ-23**: Wormhole SHALL support idempotent ingestion:

- **WH-REQ-23.1**: Re-ingesting identical content (same hash) MUST either:
  - link to existing Card/Hypercore, or  
  - create a new version with explicit `versionOf` metadata.
- **WH-REQ-23.2**: Silent overwrite of prior content is NOT allowed.

---

### 5.10 Error Handling & Status

**WH-REQ-24**: Wormhole SHALL track processing status per content:

- **WH-REQ-24.1**: possible statuses: `pending`, `in_progress`, `complete`, `failed`, `partial`.  
- **WH-REQ-24.2**: Each stage (ingest, transcription, summarization, key-term extraction, wiki updates) should have a sub-status.

**WH-REQ-25**: On error, Wormhole SHALL:

- **WH-REQ-25.1**: Log the error in an append-only log.  
- **WH-REQ-25.2**: Expose error information to API callers and UI (without leaking sensitive internal details).

---

## 6. Non-Functional Requirements

**WH-NFR-1 (Sovereignty)**  
All content, summaries, transcripts, and wiki links MUST be backed by user-owned Hypercore feeds. No centralized destructive edits are allowed.

**WH-NFR-2 (Security & Privacy)**  
Wormhole MUST respect user-level privacy/sharing policies. No content or derived artifacts may leave the Node without explicit consent/configuration.

**WH-NFR-3 (Auditability)**  
Every modifications step (ingestion, transcription, summarization, wiki update) MUST be logged with timestamps, DID, and tool identifiers for “Roll the Tapes” replay.

**WH-NFR-4 (Extensibility)**  
Transcription, summarization, key-term extraction MUST be pluggable:

- local models,  
- LAN models,  
- remote services (if permitted),  
selectable per Node configuration.

**WH-NFR-5 (Performance – Directional)**  

- Small text/markdown files SHOULD complete ingestion + base summarization in seconds.  
- Audio/video processing MAY run asynchronously with progress updates through events.  
- System MUST be able to queue and process multiple concurrent files without blocking core Node operations.

---

## 7. Assumptions & Dependencies

- Hypercore infrastructure is already available and integrated with the Node.  
- Card system (types, storage) is already defined and can be extended.  
- Wiki storage and basic search indices exist or are being implemented in parallel.  
- Transcription and summarization services (local or remote) are reachable from the Node environment.  

---

## 8. Open Questions / Future Enhancements

- Versioning UI/UX for Cards and Wiki entries.  
- Visualization of the knowledge graph for power users and Consuls.  
- Batch ingestion workflows (e.g., ingest a user’s entire YouTube/Kindle/Podcast history at once).  
- Scoring/prioritizing content ingestion relative to Need-Minting and economic value.  
