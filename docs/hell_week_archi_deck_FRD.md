# Feature Requirements Document: Hell Week Pipeline

## 1. Overview
This FRD defines the requirements for the "Hell Week" pipeline, a system designed to ingest "Seed" artifacts (canonical texts) and process them into "Cards" (sovereign, multimedia assets) via a three-stage workflow: Leo (Love), Thor (Truth), and Conviction.

The system transforms infinite data into a navigable "Garden" of Cards, preserving lineage and canon.

## 2. Core Architecture: The Pipeline Runner

### 2.1 State Machine
The pipeline shall be implemented as a deterministic state machine with the following high-level states:
*   `IDLE`: Ready to accept a new artifact.
*   `LEO_ANALYSIS`: Generating high-level summary and context ("The Yarn").
*   `LEO_REVIEW`: Waiting for user approval of the summary.
*   `THOR_CHUNKING`: Splitting the document into logical chunks.
*   `THOR_PROCESSING`: Iterating through chunks to generate Card Data (Lore, Skills, Dialog).
*   `THOR_MEDIA_PENDING`: Waiting for Image/Video generation.
*   `THOR_REVIEW`: Waiting for user approval of generated cards.
*   `CONVICTION_FINALIZING`: Creating the Collection Card and writing to Hypercore.
*   `COMPLETE`: Run finished.

### 2.2 Implementation Strategy
*   **Electron Main Process**: Handles the heavy lifting—LLM calls, Hypercore writes, file I/O.
*   **React Renderer**: Handles the UI, State visualization, and User Confirmation steps.
*   **IPC Bridge**:
    *   `pipeline:start(filePath)`
    *   `pipeline:advance(stepId, modifications)`
    *   `pipeline:status` (Stream/Event for updates)

## 3. LLM Orchestration Requirements

### 3.1 Default Models
*   **Text/Logic**: Gemini 3 Pro (via Google GenAI SDK).
*   **Image**: Gemini 2.5 Flash Image ("Nano Banana").
*   **Video**: Veo 3.1.

### 3.2 Structured Outputs (JSON Mode)
All LLM interactions must use structured outputs (JSON schemas) to ensure reliability.
*   **Leo Schema**:
    ```json
    {
      "summary": "string",
      "audience_profiles": ["string"],
      "objectives": [{"id": "string", "description": "string"}],
      "yarn_context": "string"
    }
    ```
*   **Thor Schema (Per Chunk)**:
    ```json
    {
      "chunk_id": "string",
      "truth_analysis": {"facts": [], "desires": [], "proposals": []},
      "card_data": {
        "name": "string",
        "lore": "string",
        "skills": [{"name": "string", "description": "string", "type": "string"}],
        "stats": {"level": 1, "type": "string"}
      },
      "media_prompts": {
        "base_image": "string",
        "video_loop": "string"
      }
    }
    ```

## 4. Media Pipeline Requirements

### 4.1 Image Generation
*   **Trigger**: After Thor generates Card Data.
*   **Input**: `media_prompts.base_image` from Thor's JSON.
*   **Output**: 4 Images (1 Base + 3 Skill-related variants).
*   **Storage**: Save locally to `storage/assets/<run_id>/<card_id>/images/`.

### 4.2 Video Generation (Veo 3.1)
*   **Trigger**: After Image Generation is successful.
*   **Input**: The "Base Image" + `media_prompts.video_loop` text.
*   **Config**: `aspectRatio: "16:9"`, `negative_prompt: "distortion, static, blur"`.
*   **Process**:
    1.  Submit generation job.
    2.  Poll operation status (async).
    3.  Download MP4.
*   **Storage**: Save locally to `storage/assets/<run_id>/<card_id>/videos/`.

## 5. Data Model & Lineage (Hypercore)

### 5.1 Hypercore Structure
*   **Collection Core**: A new Hypercore feed created for each Run (or the "Collection").
*   **Blocks**: Each generated Card is a JSON block appended to this Core.
*   **Assets**: Large binaries (Images/Videos) are stored in the `blob` store (or `storage/` folder) and referenced by hash/path in the Hypercore block.

### 5.2 Lineage Tracking
*   **Parent DID**: The DID of the source artifact (or a hash of *The Archi-Deck.txt*).
*   **Child DID**: The Discovery Key of the new Collection Core.
*   **Linking**: The Collection Core's first block (Header) must contain the Parent DID. The Parent's log (if writable) should ideally append a reference to the new Child (bidirectional linking), but initially, we ensure the Child points to the Parent.

## 6. UI Requirements

### 6.1 Pipeline Dashboard (`/pipeline`)
*   **Layout**: Three horizontal tracks (Leo, Thor, Conviction).
*   **Visuals**:
    *   **Leo Track**: "The Eye" scanning. Progress bar for document reading.
    *   **Thor Track**: "The Forge." Icons of cards moving along a conveyor belt.
    *   **Conviction Track**: "The Vault." Stacks of finished cards.
*   **Controls**:
    *   "Start Run" button (Drag & Drop file).
    *   "Approve & Continue" buttons at breakpoints.
    *   "Edit" button to modify LLM output before approving.

### 6.2 Debug/Observability Drawer
*   A collapsible side panel showing the raw "Thinking" process.
*   **Tabs**: `LLM Input`, `LLM Output`, `System Logs`.
*   **Purpose**: Trust. Users verify what is being sent to Google/OpenAI.

### 6.3 Asset Bay Integration
*   Generated Cards should appear in the existing "Pet Portal" or a new "Card Library" view once finalized.

## 7. Development Plan

### Phase 1: Scaffolding (Days 1-2)
1.  **State Machine**: Implement `PipelineManager` class in Electron Main.
2.  **IPC Bridges**: Setup communication between UI and Main.
3.  **UI Shell**: Create the `/pipeline` route and basic layout (Leo/Thor/Conviction tracks).

### Phase 2: Leo Implementation (Day 3)
1.  **Text Extraction**: Implement file reading (chunked if needed).
2.  **Leo Prompting**: Create the System Prompt for Leo (Summary/Context).
3.  **Review UI**: Build the JSON editor/viewer for Leo's output.

### Phase 3: Thor Implementation (Days 4-5)
1.  **Chunking Logic**: Implement smart paragraph/section splitting.
2.  **Thor Prompting**: Create System Prompt for Card Data extraction.
3.  **Batch Processing**: UI to show progress of processing N chunks.

### Phase 4: Media Pipeline (Days 6-7)
1.  **Gemini Image Client**: Integrate `gemini-2.5-flash-image`.
2.  **Veo Video Client**: Integrate `veo-3.1` polling logic.
3.  **Async Queue**: Implement a job queue for media generation to avoid rate limits.

### Phase 5: Conviction & Storage (Day 8)
1.  **Hypercore Write**: Implement `CollectionCore` creation and block appending.
2.  **Finalize UI**: The "Seal" animation and transition to the Asset Bay.

## 8. Risk Analysis & Mitigations

### 8.1 Technical Risks
*   **Risk**: **Context Window Overflow**. *The Archi-Deck.txt* is large.
    *   *Mitigation*: Strict chunking. Leo reads the first N lines + sampled chunks if too big.
*   **Risk**: **Rate Limits / Cost**. Generating video for every chunk is expensive.
    *   *Mitigation*: Add a "Draft Mode" (Text only) and "Production Mode" (Full Media). Default to Draft for testing.
*   **Risk**: **Veo Latency**. Video gen takes 10-30s+.
    *   *Mitigation*: "Optimistic UI" - show placeholder while generating in background. Don't block the *next* chunk's text analysis.

### 8.2 UX Risks
*   **Risk**: **Overwhelm**. Too many cards generated.
    *   *Mitigation*: Thor "Filter" step. Ask user "Keep this card?" before generating media.
*   **Risk**: **Black Box**. User feels lost.
    *   *Mitigation*: The "Debug Drawer" is mandatory. Transparency = Trust.

### 8.3 Safety Risks
*   **Risk**: **Mis-compression**. Losing the "Soul" of the text.
    *   *Mitigation*: The "Review" step is blocking. User *must* sign off on the Summary (Leo) and Sample Cards (Thor) before bulk processing.

## 9. Self-Review & Validation Plan
*   **Validation**:
    *   Unit test the `PipelineManager` state transitions.
    *   Mock the LLM responses to test UI flow without cost.
    *   Verify Hypercore append using the `readCore` tool.
*   **What I might be wrong about**:
    *   *Chunking Strategy*: Regex splitting might break context. *Correction*: May need a "sliding window" chunker.
    *   *Video Quality*: Veo 3.1 might be too weird/hallucinogenic. *Correction*: Allow prompt editing before generation.

## 10. First Concrete Implementation Slice (SHIP THIS FIRST)

**Goal**: "Leo-only pipeline for text-only documents, with manual steps and no video yet."

**Scope**:
1.  **UI**: A basic `/pipeline` page with a file uploader and a "Leo" track.
2.  **Logic**: `PipelineManager` in Electron that accepts a text file.
3.  **Leo Step**:
    *   Read file.
    *   Send to Gemini 3 Pro (Text-only) with the "Review & Context" prompt.
    *   Display JSON result (Summary, Audience, Objectives) in the UI.
    *   User clicks "Approve" -> Run ends (Mocked Thor/Conviction).
4.  **Output**: A JSON file in `storage/runs/<id>/leo_output.json`.

**Why this slice?**:
*   Validates the **Electron <-> React IPC** for the pipeline.
*   Validates **Gemini 3 Pro API** integration and JSON schema strictness.
*   Establishes the **UI Pattern** (Tracks/Steps) without the complexity of Media/Hypercore yet.

