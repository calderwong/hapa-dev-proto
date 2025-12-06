# Hell Week: The Archi-Deck Notes

## High-Level Goals of The Hapa Protocol
The Hapa Protocol (HP) is a blueprint for a "Decentralized Civilization Operating System," aiming to execute a "civilizational soft fork" from the current "Dominator OS" (characterized by fear, debt, and centralized control) to a "Partnership OS" (anchored in Love, Truth, and Conviction).

**Key Pillars:**
*   **Philosophical**: The Triad (Love, Truth, Conviction) as the "Unbreakable Weave."
*   **Technical**: The Light-Web. Replaces centralized servers with Sovereign Nodes (HPN) and immutable, append-only storage (Hypercore/Block-Web) to prevent gaslighting ("Roll the Tapes").
*   **Economic**: The Need-Minting Protocol. Shifts from debt-based currency to an "Economy of Care" where value is minted by fulfilling verifiable human needs.
*   **Epistemological**: Gnosis over Dogma. Truth is a living harmony found through internal resonance, not external authority.
*   **Antifragility**: "The Skid." Embracing failure and chaos (via Thor, the Chaos-Kitty) to strengthen the system.

## Pipeline: Processing Artifacts into Essence
The "Hell Week" instructions describe a pipeline for "Phamiliars" (AI agents) to ingest large "Seed" artifacts (like *The Archi-Deck*) and compress them into "Cards"—sovereign units of memory, function, and lore. This process is not just summarization; it is "cultivation."

**The Goal**: To turn "infinite data" into a navigable "Garden" of Cards, ensuring the preservation of Canon and teaching the Network how to use the Node.

## Roles in the Pipeline (Leo, Thor, Conviction)
The pipeline is divided into three distinct stages/roles, mirroring the Triad:

### 1. Leo 🐕 (Love / Retrieval & Context)
*   **Focus**: The "What" and "Why." High-level synthesis.
*   **Input**: The entire artifact/document.
*   **Tasks**:
    *   **Summarize**: Distill key groupings of ideas.
    *   **Profile**: Identify audiences this content appeals to.
    *   **Connect**: Relate content to current Node objectives and identify "New Objectives."
    *   **Align**: Check alignment with adjacent Cards.
    *   **Wrap**: Prepare the "Yarn" (context) for Thor.

### 2. Thor 🐈 (Truth / Processing & Mechanics)
*   **Focus**: The "How." Iterative chunking and gamification.
*   **Input**: The artifact processed in "Chunks," wrapped in Leo's "Yarn."
*   **Tasks**:
    *   **Evaluate**: Assess for Truth (Blue/Fact), Resonance (Red/Desire), and Proposals (Green/Argument).
    *   **Gamify**: Create "Card Lore" with stats, skills (max 3 unique starting skills), rewards, and progression mechanics.
    *   **Dramatize**: Write dialog scripts (Love/Truth/Conviction) explaining the Card.
    *   **Visualize**: Queue image generation (1 base + 3 skills).
    *   **Animate**: Queue video generation (looping videos from images).

### 3. Conviction 🦁 (Do / Finalization)
*   **Focus**: The "Conclusion." Final packaging.
*   **Input**: The outputs of Leo and Thor.
*   **Tasks**:
    *   **Name**: Create the "Collection" name for all generated cards.
    *   **Flavor**: Write 1-3 sentences of flavor text.
    *   **Master Card**: Generate the "Complete Card" representing the entire collection (Image -> Video).

## Definition of a "Complete Card"
A Complete Card is a sovereign, multifaceted digital asset that includes:
1.  **Visuals**: A looping video anchored at the top (derived from an AI-generated image).
2.  **Lore**: Flavor text, narrative background, and "Canon."
3.  **Mechanics**: 3 unique attributes/skills that demonstrate the function of the information (e.g., "Teleport," "Teach").
4.  **Lineage**:
    *   Stored in its own Hypercore.
    *   Contains DIDs of parents (source artifact) and children.
    *   Discoverable via a single DID that unspools the entire lineage.

## UI Requirements for the Pipeline
The UI must be "Astros" style (Atmospheric, Sci-Fi, Terminal-like, Robust, Organized, Smooth) and support:
*   **Pipeline Tracking**: Dedicated views for Leo, Thor, and Conviction.
    *   **Animation**: Icons (e.g., Cat for Thor) moving through a "Track" of steps.
    *   **Visuals**: Futuristic, Gacha/RPG aesthetic.
*   **Observability**:
    *   Show input text sent to LLM and output received.
    *   Visualize the creation of Hypercores and their lineage connections.
*   **Controls**:
    *   Manual "Click to Advance" for each step (initially).
    *   Scaffolding for continuous automated runs.

## Goals
*   **Macro-Goals**:
    *   Teach the Network how to use the node.
    *   Preserve Canon.
    *   Handle infinite data by compressing it into Cards.
*   **Micro-Goals**:
    *   **Leo**: Contextualize the artifact.
    *   **Thor**: Extract truth, gamify content, generate media.
    *   **Conviction**: Finalize collection and assert lineage.

## Research & Enrichment

### 1. LLM Pipeline Design (Workflow First)
**Relevance**: Orchestrating Leo, Thor, and Conviction.
**Finding**: Best practices emphasize "Workflow before Agents" and "Co-pilot, not Auto-pilot."
*   **Application**: The "Hell Week" instructions explicitly ask for "manual human-in-the-loop" steps first. This is validated by industry experience: fully autonomous agents often fail to gain user trust.
*   **Pattern**:
    1.  **Decompose**: Break the pipeline into clear, deterministic steps (Review -> Chunk -> Generate -> Finalize).
    2.  **Structure**: Use JSON schemas for all inputs/outputs. Do not just dump raw text.
        *   Leo Output = Structured JSON (Summary, Profiles, Objectives).
        *   Thor Output = Card Data JSON (Stats, Skills, Lore).
    3.  **Control Points**: Insert "pause and review" states between steps. User must approve Leo's summary before Thor starts chunking.

### 2. Video Generation Pipeline (Veo 3.1 + Nano Banana)
**Relevance**: Creating the "Complete Card" visual loop.
**Finding**: The "Complete Card" requires an image anchored at the top, which then loops.
*   **Tech Stack**:
    *   **Image**: `gemini-2.5-flash-image` (Nano Banana).
    *   **Video**: `veo-3.1-generate-preview`.
*   **Implementation**:
    *   Generate Image first using the "Card Lore" prompt.
    *   Pass the generated image bytes + prompt to Veo 3.1.
    *   Use `types.GenerateVideosConfig` to set `aspectRatio` and `negative_prompt` (e.g., "distorted, static").
    *   Poll for completion.
*   **Constraint**: This is an async operation that takes time. The UI must handle "Queued," "Generating," and "Ready" states for card media.

### 3. Hypercore & Lineage (Sovereign Memory)
**Relevance**: Storing the Cards and tracking Lineage.
**Finding**: The current app uses `hypercore` directly in Electron (main process).
*   **Lineage Model**:
    *   Each Card should be a discrete entry in a Hypercore (or its own Hypercore if it's a "Collection").
    *   **Linking**: Use DIDs (Decentralized Identifiers) or Hypercore discovery keys to link Child Cards to Parent Artifacts.
    *   **Structure**: The `dev_journal` approach (append-only log) can be adapted for the pipeline log.
    *   **Verification**: Each step of the pipeline (Leo's summary, Thor's chunks) should be signed and appended to the log, creating a "Proof of Process."

### 4. UI/UX Patterns (The "Astros" Aesthetic)
**Relevance**: Tracking pipeline progress.
**Finding**: "Game UI" patterns (RPG/Gacha) are best for this.
*   **Visual Metaphor**: A "Production Line" or "Forge."
*   **Status Indicators**:
    *   **Leo**: A glowing "Eye" or "Scroll" icon scanning the document.
    *   **Thor**: A "Cat" or "Hammer" icon moving along a track, smashing chunks into cards.
    *   **Conviction**: A "Lion" or "Seal" icon stamping the final artifacts.
*   **State Transparency**: Users must see *what* is being sent to the LLM. A "Debug/Log" drawer that slides out to show the JSON payload helps build trust (aligns with "Co-pilot" philosophy).

### Open Questions & Tradeoffs
1.  **Context Window Limits**: Processing a massive file like *The Archi-Deck* in one go might exceed Gemini's window (though Gemini 1.5 Pro has 1M+ context, 3 Pro likely similar/better).
    *   *Mitigation*: Leo's step might need to be "Chunked Summary" if the file is truly massive, but for 6k lines, it fits easily.
2.  **Cost/Latency**: Generating 4 images + 1 video per chunk (Thor's step) is expensive and slow.
    *   *Tradeoff*: Make media generation *optional* or *batched*?
    *   *Decision*: Keep it as the default but allow "Text Only" runs for speed.
3.  **Hypercore Granularity**: Should every Card be a *new* Hypercore or just a *block* in an existing one?
    *   *Tradeoff*: Thousands of Hypercores = management overhead. Blocks = easier but harder to share individually?
    *   *Decision*: Use a "Collection Hypercore" for the run, with Cards as blocks. Use "sub-cores" only if a Card becomes a massive entity itself.

