import { ipcMain, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createCore, appendToCore } from './p2p';
import { 
  getVertexAIClient, 
  isVertexAIConfigured, 
  getVertexAISettings,
  VertexAIClient,
  ModelProvenance,
  createModelProvenance,
  MODEL_SHORTHAND_MAP
} from './vertexai';
import { emitCardEvents } from './persistence';
import { 
  cardManager, 
  HellWeekCard, 
  CardState,
  LeoContext,
  ParentArtifact 
} from './cardManager';

const store: any = new Store();

// Pipeline settings key
const PIPELINE_SETTINGS_KEY = 'pipelineSettings';

interface PipelineSettings {
  thorModel: 'fast-llm' | 'smart-llm';  // Toggle between Fast and Smart LLM for Thor
  thorThrottleMs: number;
  mediaThrottleMs: number;
}

const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  thorModel: 'fast-llm',  // Default to Fast LLM
  thorThrottleMs: 2000,
  mediaThrottleMs: 3000,
};

// Get/Save pipeline settings
export function getPipelineSettings(): PipelineSettings {
  const stored = store.get(PIPELINE_SETTINGS_KEY) as Partial<PipelineSettings> | undefined;
  return { ...DEFAULT_PIPELINE_SETTINGS, ...stored };
}

export function savePipelineSettings(settings: Partial<PipelineSettings>): void {
  const current = getPipelineSettings();
  store.set(PIPELINE_SETTINGS_KEY, { ...current, ...settings });
}

interface PipelineState {
  status: 'IDLE' | 'LEO_ANALYSIS' | 'LEO_REVIEW' | 'THOR_CHUNKING' | 'THOR_PROCESSING' | 'THOR_MEDIA_PENDING' | 'THOR_MEDIA_GENERATING' | 'THOR_REVIEW' | 'CONVICTION_FINALIZING' | 'COMPLETE';
  currentStep: string;
  progress: number;
  logs: string[];
  leoOutput: any | null;
  chunks: string[];
  cards: any[];  // Legacy format for UI compatibility
  collectionKey?: string;
  // New: Track model provenance
  leoProvenance?: ModelProvenance;
  thorModel: 'fast-llm' | 'smart-llm';
  // Card-centric architecture
  runId: string;
  hellWeekCards: HellWeekCard[];
  parentArtifact?: ParentArtifact;
  leoContext?: LeoContext;
  // Card Set (created on completion)
  createdSetId?: string;
  createdSetName?: string;
}

class PipelineManager {
  private window: BrowserWindow | null = null;
  private currentFilePath: string = '';
  private rawText: string = '';
  
  private state: PipelineState = {
    status: 'IDLE',
    currentStep: 'Ready',
    progress: 0,
    logs: [],
    leoOutput: null,
    chunks: [],
    cards: [],
    thorModel: getPipelineSettings().thorModel,
    runId: '',
    hellWeekCards: [],
  };

  constructor() {}

  public setWindow(window: BrowserWindow) {
    this.window = window;
  }

  private updateState(updates: Partial<PipelineState>) {
    this.state = { ...this.state, ...updates };
    if (this.window) {
      this.window.webContents.send('pipeline:update', this.state);
    }
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[Pipeline] ${message}`);
    this.updateState({ logs: [...this.state.logs, logMessage] });
  }

  /**
   * Set up the image queue callback for streaming image generation
   * This allows images to be generated in parallel with Thor processing
   */
  private setupImageQueueCallback(): void {
    cardManager.setImageQueueCallback(async (cardId: string, readyToProcess: boolean) => {
      if (!readyToProcess) return;
      
      const card = cardManager.getCard(cardId);
      if (!card || !card.mediaPrompts?.base_image) {
        cardManager.completeImageGeneration(cardId, false, undefined, 'No image prompt found');
        return;
      }
      
      try {
        this.log(`[Streaming] Generating image for: ${card.cardData?.name || cardId}`);
        
        const useVertex = isVertexAIConfigured();
        if (!useVertex) {
          throw new Error('Vertex AI required for image generation');
        }
        
        const vertexClient = getVertexAIClient();
        const result = await vertexClient.generateImageImagen(card.mediaPrompts.base_image, 'pro-image', {
          aspectRatio: '1:1',
          sampleCount: 1,
        });
        
        if (result.base64) {
          // Save the image
          const userDataDir = app.getPath('userData');
          const imagesDir = path.join(userDataDir, 'wormhole', 'pipeline-assets', this.state.runId);
          await fs.promises.mkdir(imagesDir, { recursive: true });
          
          const fileName = `card-${cardId}-${Date.now()}.png`;
          const localPath = path.join(imagesDir, fileName);
          await fs.promises.writeFile(localPath, Buffer.from(result.base64, 'base64'));
          
          // Update the card
          const imageProvenance = createModelProvenance(
            'Pro Image (Imagen 4)',
            'Vertex AI',
            MODEL_SHORTHAND_MAP['pro-image']
          );
          await cardManager.updateCardWithImage(cardId, localPath, imageProvenance);
          
          cardManager.completeImageGeneration(cardId, true, localPath);
          this.log(`[Streaming] Image saved for: ${card.cardData?.name || cardId}`);
          
          // Update state with new card data
          const updatedCard = cardManager.getCard(cardId);
          if (updatedCard) {
            const cardIndex = this.state.hellWeekCards.findIndex(c => c.cardId === cardId);
            if (cardIndex >= 0) {
              this.state.hellWeekCards[cardIndex] = updatedCard;
              this.updateState({ hellWeekCards: [...this.state.hellWeekCards] });
            }
          }
        } else {
          throw new Error('No image data returned');
        }
      } catch (error: any) {
        this.log(`[Streaming] Image generation failed for ${cardId}: ${error.message}`);
        cardManager.completeImageGeneration(cardId, false, undefined, error.message);
      }
    });
  }

  public async startPipeline(filePath: string) {
    try {
      this.currentFilePath = filePath;
      this.log(`Starting pipeline for: ${filePath}`);
      const pipelineSettings = getPipelineSettings();
      
      // Generate new run ID
      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Create parent artifact record
      const parentArtifact: ParentArtifact = {
        id: `artifact-${Date.now()}`,
        name: path.basename(filePath),
        type: path.extname(filePath).slice(1) || 'txt',
      };
      
      // Clear any previous cards for this run
      if (this.state.runId) {
        cardManager.clearRun(this.state.runId);
      }
      
      // Clear and set up image queue for streaming generation
      cardManager.clearImageQueue();
      this.setupImageQueueCallback();
      
      this.updateState({ 
        status: 'LEO_ANALYSIS', 
        currentStep: 'Ingesting Artifact...',
        progress: 5,
        logs: [], // Clear logs on new run
        leoOutput: null,
        chunks: [],
        cards: [],
        collectionKey: undefined,
        thorModel: pipelineSettings.thorModel,
        leoProvenance: undefined,
        runId,
        hellWeekCards: [],
        parentArtifact,
        leoContext: undefined,
      });

      // 1. Read File
      this.rawText = await fs.promises.readFile(filePath, 'utf-8');
      this.log(`File read successfully. Length: ${this.rawText.length} characters.`);
      this.log(`Run ID: ${runId}`);
      
      // 2. Leo Analysis
      await this.runLeoStep(this.rawText);

    } catch (error: any) {
      this.log(`CRITICAL ERROR: ${error.message}`);
      this.updateState({ currentStep: 'ERROR: ' + error.message });
    }
  }

  // Alternative entry point when file content is provided directly (e.g., from drag-drop without file.path)
  public async startPipelineWithContent(fileName: string, content: string) {
    try {
      this.currentFilePath = fileName; // Use filename as identifier
      this.log(`Starting pipeline with content from: ${fileName}`);
      const pipelineSettings = getPipelineSettings();
      
      // Generate new run ID
      const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Create parent artifact record
      const parentArtifact: ParentArtifact = {
        id: `artifact-${Date.now()}`,
        name: fileName,
        type: fileName.split('.').pop() || 'txt',
      };
      
      // Clear any previous cards for this run
      if (this.state.runId) {
        cardManager.clearRun(this.state.runId);
      }
      
      // Clear and set up image queue for streaming generation
      cardManager.clearImageQueue();
      this.setupImageQueueCallback();
      
      this.updateState({ 
        status: 'LEO_ANALYSIS', 
        currentStep: 'Ingesting Artifact...',
        progress: 5,
        logs: [], // Clear logs on new run
        leoOutput: null,
        chunks: [],
        cards: [],
        collectionKey: undefined,
        thorModel: pipelineSettings.thorModel,
        leoProvenance: undefined,
        runId,
        hellWeekCards: [],
        parentArtifact,
        leoContext: undefined,
      });

      // Content already provided, no need to read file
      this.rawText = content;
      this.log(`Content received. Length: ${this.rawText.length} characters.`);
      this.log(`Run ID: ${runId}`);
      
      // Leo Analysis
      await this.runLeoStep(this.rawText);

    } catch (error: any) {
      this.log(`CRITICAL ERROR: ${error.message}`);
      this.updateState({ currentStep: 'ERROR: ' + error.message });
    }
  }

  private getDefaultGeminiModel(): string {
    const wormholeSettings = store.get('wormholeSettings') as any;
    // Use summarization model as the default for pipeline operations
    // Fall back through the chain: summarization -> keyTerms -> wikiUpdate -> hardcoded default
    const model = wormholeSettings?.summarization?.model 
      || wormholeSettings?.keyTerms?.model 
      || wormholeSettings?.wikiUpdate?.model
      || 'gemini-2.0-flash';
    return model;
  }

  // Note: getPipelineSettings is now an exported function at the top of this file

  private async throttle(ms: number): Promise<void> {
    if (ms > 0) {
      await new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  private async runLeoStep(text: string) {
    this.updateState({ currentStep: 'Leo: Reading & Contextualizing...', progress: 10 });
    
    const prompt = `
      You are "Leo" 🐕, the Retrieval & Context Phamiliar for the Hapa Protocol.
      Your task is to review the following Artifact and produce a high-level summary and context object.
      
      INSTRUCTIONS:
      1. Summarize the artifact's core meaning and "Why".
      2. Identify specific audience profiles this content appeals to.
      3. Extract key "Objectives" (what does this text want to achieve?).
      4. Create a "Yarn" - a contextual wrapper that explains how this fits into the Hapa Node.
      5. Suggest a concise, memorable "Set Name" for the collection of cards that will be created (2-5 words, like "Protocol Architecture Guide" or "Q4 Roadmap").
      
      OUTPUT JSON FORMAT:
      {
        "summary": "High level summary string",
        "audience_profiles": ["Profile 1", "Profile 2"],
        "objectives": [
          {"id": "obj_1", "description": "Objective description"}
        ],
        "yarn_context": "The Yarn string...",
        "suggested_set_name": "Short Memorable Name",
        "suggested_set_description": "One sentence describing what this collection represents"
      }
      
      ARTIFACT CONTENT:
      ${text.slice(0, 100000)} 
    `;

    let jsonText: string;
    let leoProvenance: ModelProvenance;

    // Check if Vertex AI is configured (preferred)
    if (isVertexAIConfigured()) {
      const modelName = MODEL_SHORTHAND_MAP['smart-llm'];
      this.log(`Using Vertex AI (Smart LLM - ${modelName})...`);
      
      // Create provenance record
      leoProvenance = createModelProvenance('Smart LLM', 'Vertex AI', modelName);
      
      const vertexClient = getVertexAIClient();
      const result = await vertexClient.generateContent(prompt, 'smart-llm', {
        responseMimeType: 'application/json'
      });
      jsonText = result.text;
    } else {
      // Fallback to Google AI Studio
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('No AI provider configured. Please set up Vertex AI or Google AI Studio in Settings.');
      }

      const modelName = this.getDefaultGeminiModel();
      this.log(`Using Google AI Studio (${modelName})...`);
      
      // Create provenance record
      leoProvenance = createModelProvenance('Smart LLM', 'Google AI Studio', modelName);
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
              responseMimeType: "application/json"
          } 
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      jsonText = response.text();
    }
    
    this.log(`Leo finished thinking. Model: ${leoProvenance.modelName} via ${leoProvenance.provider}`);
    
    let parsedOutput;
    try {
        parsedOutput = JSON.parse(jsonText);
    } catch (e) {
        this.log('Failed to parse JSON from Leo. Falling back to raw text.');
        parsedOutput = { summary: jsonText, error: "JSON Parse Failed" };
    }

    // Create LeoContext for card-centric architecture
    const leoContext: LeoContext = {
      summary: parsedOutput.summary || parsedOutput.core_summary || '',
      audience_profiles: parsedOutput.audience_profiles || [],
      objectives: parsedOutput.objectives || [],
      yarn_context: parsedOutput.yarn_context || '',
      provenance: leoProvenance,
      // Card Set naming
      suggested_set_name: parsedOutput.suggested_set_name || undefined,
      suggested_set_description: parsedOutput.suggested_set_description || undefined,
    };

    this.updateState({
        status: 'LEO_REVIEW',
        currentStep: 'Waiting for User Approval',
        progress: 25,
        leoOutput: parsedOutput,
        leoProvenance: leoProvenance,
        leoContext: leoContext,
    });
    
    this.log('Leo Step Complete. Waiting for approval.');
  }

  public async advanceStep() {
      if (this.state.status === 'LEO_REVIEW') {
          // Transition to Thor Phase
          await this.runThorChunking();
      } else if (this.state.status === 'THOR_MEDIA_PENDING') {
          // Start Media Generation
          await this.runThorMediaGeneration();
      } else if (this.state.status === 'THOR_REVIEW') {
          // Transition to Conviction Phase
          await this.runConvictionFinalizing();
      } else if (this.state.status === 'THOR_PROCESSING') {
          this.log('Already in Thor Processing...');
      } else {
          this.log(`Advance clicked in state ${this.state.status} - No action defined.`);
      }
  }

  // ==========================================================================
  // PHASE 2: THOR (TRUTH)
  // ==========================================================================

  private async runThorChunking() {
      this.log('Advancing to Thor Phase: Chunking...');
      this.updateState({ status: 'THOR_CHUNKING', currentStep: 'Thor: Splitting Artifact...', progress: 30 });

      // Simple Chunking Logic: Split by double newlines or headers
      // Ideally, this should be smarter, but for now, we chunk by ~1000 words or major sections
      
      const chunks: string[] = [];
      const lines = this.rawText.split('\n');
      let currentChunk = '';

      for (const line of lines) {
          currentChunk += line + '\n';
          if (currentChunk.length > 3000 && line.trim() === '') {
             // Break on paragraph end after 3000 chars
             chunks.push(currentChunk);
             currentChunk = '';
          }
      }
      if (currentChunk.length > 0) {
          chunks.push(currentChunk);
      }

      this.log(`Thor created ${chunks.length} chunks.`);
      
      // Card-Centric: Create cards from blobs immediately
      // Cards are created in 'blob' state and will be processed by Thor
      const hellWeekCards: HellWeekCard[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const card = await cardManager.createCardFromBlob(
          {
            text: chunks[i],
            chunkIndex: i,
            totalChunks: chunks.length,
          },
          this.state.parentArtifact!,
          this.state.runId,
          this.state.leoContext
        );
        hellWeekCards.push(card);
        this.log(`Created card blob ${i + 1}/${chunks.length}: ${card.cardId}`);
      }
      
      this.log(`Created ${hellWeekCards.length} card blobs ready for processing.`);
      this.updateState({ chunks, hellWeekCards, progress: 35 });

      // Immediately start processing chunks
      await this.runThorProcessing();
  }

  private async runThorProcessing() {
      this.updateState({ status: 'THOR_PROCESSING', currentStep: 'Thor: Forging Cards...', progress: 40 });
      
      const pipelineSettings = getPipelineSettings();
      const useVertex = isVertexAIConfigured();
      
      // Get the configured Thor model (fast-llm or smart-llm)
      const thorModelShorthand = this.state.thorModel || pipelineSettings.thorModel;
      const thorModelName = MODEL_SHORTHAND_MAP[thorModelShorthand];
      const thorCommonName = thorModelShorthand === 'fast-llm' ? 'Fast LLM' : 'Smart LLM';
      
      // Set up the appropriate client
      let vertexClient: VertexAIClient | null = null;
      let genAI: GoogleGenerativeAI | null = null;
      let model: any = null;
      let provider: string;

      if (useVertex) {
        this.log(`Thor using Vertex AI (${thorCommonName} - ${thorModelName}) (throttle: ${pipelineSettings.thorThrottleMs}ms)`);
        vertexClient = getVertexAIClient();
        provider = 'Vertex AI';
      } else {
        const apiKey = store.get('geminiKey') as string | undefined;
        if (!apiKey) {
          this.log('Error: No AI provider configured.');
          return;
        }
        const modelName = this.getDefaultGeminiModel();
        this.log(`Thor using Google AI Studio (${modelName}) (throttle: ${pipelineSettings.thorThrottleMs}ms)`);
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });
        provider = 'Google AI Studio';
      }

      const processedCards: any[] = [];
      let processedCount = 0;

      for (let i = 0; i < this.state.chunks.length; i++) {
          // Throttle between chunks to avoid rate limiting
          if (i > 0) {
            await this.throttle(pipelineSettings.thorThrottleMs);
          }
          
          const chunk = this.state.chunks[i];
          this.log(`Processing Chunk ${i + 1}/${this.state.chunks.length}...`);
          this.updateState({ currentStep: `Thor: Analyzing Chunk ${i + 1}/${this.state.chunks.length}` });

          const prompt = `
            You are "Thor" 🐈, the Truth-Seeker and Forge Master.
            Your task is to extract a sovereign "Card" from this text chunk.
            
            CONTEXT FROM LEO:
            ${JSON.stringify(this.state.leoOutput)}

            INSTRUCTIONS:
            1. Analyze the text chunk for a central concept, rule, or narrative beat.
            2. Extract "Lore" (flavor text) and "Mechanics" (if any).
            3. Define "Skills" or "Stats" if applicable (gamify the content).
            4. Design a visual prompt for this card ("base_image").
            5. Design a video loop prompt ("video_loop").

            OUTPUT JSON SCHEMA:
            {
              "chunk_id": "${i}",
              "truth_analysis": {"facts": ["string"], "desires": ["string"]},
              "card_data": {
                "name": "Card Title",
                "lore": "Flavor text...",
                "skills": [{"name": "string", "description": "string", "type": "Passive/Active"}],
                "stats": {"level": 1, "type": "Concept/Entity/Rule"}
              },
              "media_prompts": {
                "base_image": "Visual description for image generation",
                "video_loop": "Motion description for video loop"
              }
            }

            TEXT CHUNK:
            ${chunk}
          `;

          try {
              let jsonText: string;
              let actualModelName: string;
              
              if (useVertex && vertexClient) {
                // Use the configured Thor model (fast-llm or smart-llm)
                const result = await vertexClient.generateContent(prompt, thorModelShorthand, {
                  responseMimeType: 'application/json'
                });
                jsonText = result.text;
                actualModelName = thorModelName;
              } else if (model) {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                jsonText = response.text();
                actualModelName = this.getDefaultGeminiModel();
              } else {
                throw new Error('No AI model available');
              }
              
              const cardData = JSON.parse(jsonText);
              const thorProvenance = createModelProvenance(thorCommonName, provider, actualModelName);
              
              // Add provenance to the card (legacy format)
              cardData.provenance = {
                thor: thorProvenance,
                leo: this.state.leoProvenance,
              };
              
              // Card-Centric: Update the HellWeekCard via cardManager
              const hellWeekCard = this.state.hellWeekCards[i];
              if (hellWeekCard) {
                await cardManager.updateCardWithThorData(
                  hellWeekCard.cardId,
                  cardData.card_data,
                  cardData.truth_analysis,
                  cardData.media_prompts,
                  thorProvenance
                );
                // Refresh the card in state
                const updatedCard = cardManager.getCard(hellWeekCard.cardId);
                if (updatedCard) {
                  this.state.hellWeekCards[i] = updatedCard;
                  
                  // STREAMING: Queue image generation immediately after sorting
                  // Don't wait for all Thor processing to complete
                  if (cardData.media_prompts?.base_image) {
                    cardManager.queueCardForImageGeneration(
                      updatedCard.cardId,
                      cardData.media_prompts.base_image
                    );
                    this.log(`Queued image generation for: ${cardData.card_data.name}`);
                  }
                }
              }
              
              processedCards.push(cardData);
              processedCount++;
              
              // Update progress
              const progress = 40 + Math.floor((processedCount / this.state.chunks.length) * 30); // 40 -> 70%
              this.updateState({ 
                  cards: processedCards, 
                  hellWeekCards: [...this.state.hellWeekCards],
                  progress: progress,
                  logs: [...this.state.logs, `Generated Card: ${cardData.card_data.name} (${thorCommonName})`]
              });

          } catch (err: any) {
              this.log(`Failed to process chunk ${i}: ${err.message}`);
              // Mark quest as failed for card-centric tracking
              const hellWeekCard = this.state.hellWeekCards[i];
              if (hellWeekCard) {
                const thorQuest = hellWeekCard.quests.find(q => q.questType === 'thor-sort');
                if (thorQuest) {
                  cardManager.markQuestFailed(hellWeekCard.cardId, thorQuest.questId, err.message);
                }
              }
          }
      }

      this.log('Thor Processing Complete.');
      this.updateState({ 
          status: 'THOR_MEDIA_PENDING', 
          currentStep: 'Waiting for Media Generation...', 
          progress: 70 
      });
  }

  // ==========================================================================
  // PHASE 3: MEDIA GENERATION
  // ==========================================================================

  private async runThorMediaGeneration() {
      this.updateState({ status: 'THOR_MEDIA_GENERATING', currentStep: 'Thor: Forging Visuals...', progress: 70 });
      
      const pipelineSettings = getPipelineSettings();
      const useVertex = isVertexAIConfigured();
      const userDataDir = app.getPath('userData');
      const imagesDir = path.join(userDataDir, 'wormhole', 'pipeline-assets', `run-${Date.now()}`);
      await fs.promises.mkdir(imagesDir, { recursive: true });

      this.log(`Media generation throttle: ${pipelineSettings.mediaThrottleMs}ms`);
      this.log(useVertex ? 'Using Vertex AI (Common Image)' : 'Using Google AI Studio');
      
      let processedCount = 0;
      const totalCards = this.state.cards.length;

      // Create a copy of cards to update
      const updatedCards = [...this.state.cards];

      for (let i = 0; i < totalCards; i++) {
          // Throttle between image generations
          if (i > 0) {
            await this.throttle(pipelineSettings.mediaThrottleMs);
          }

          const card = updatedCards[i];
          const prompt = card.media_prompts?.base_image;

          if (!prompt) {
              this.log(`Skipping media for ${card.card_data.name} (No prompt)`);
              continue;
          }

          this.updateState({ currentStep: `Thor: Painting Card ${i + 1}/${totalCards} - ${card.card_data.name}` });
          this.log(`Generating image for: ${card.card_data.name}`);

          try {
              let base64Data: string | null = null;
              let imageModelUsed = 'imagen-4.0-generate-001';
              
              if (useVertex) {
                // Use Vertex AI Imagen 4 (Pro Image) - dedicated image generation model
                const vertexClient = getVertexAIClient();
                this.log(`Using Imagen 4 (Pro Image) via Vertex AI`);
                const result = await vertexClient.generateImageImagen(prompt, 'pro-image', {
                  aspectRatio: '1:1',
                  sampleCount: 1,
                });
                base64Data = result.base64;
                imageModelUsed = MODEL_SHORTHAND_MAP['pro-image'];
              } else {
                // Fallback - Imagen requires Vertex AI, cannot use Google AI Studio
                this.log(`Warning: Image generation requires Vertex AI. Please configure Vertex AI in Settings.`);
                throw new Error('Image generation requires Vertex AI to be configured');
              }
              
              if (base64Data) {
                  const fileName = `card-${i}-${Date.now()}.png`;
                  const localPath = path.join(imagesDir, fileName);
                  await fs.promises.writeFile(localPath, Buffer.from(base64Data, 'base64'));
                  
                  // Attach image path to card (legacy format)
                  card.media_prompts.generated_image_path = `file://${localPath}`;
                  card.media_prompts.generated_image_local = localPath;
                  
                  // Card-Centric: Update the HellWeekCard via cardManager
                  const hellWeekCard = this.state.hellWeekCards[i];
                  if (hellWeekCard) {
                    const imageProvenance = createModelProvenance(
                      'Pro Image (Imagen 4)', 
                      'Vertex AI',
                      imageModelUsed
                    );
                    await cardManager.updateCardWithImage(
                      hellWeekCard.cardId,
                      localPath,
                      imageProvenance
                    );
                    // Refresh the card in state
                    const updatedCardData = cardManager.getCard(hellWeekCard.cardId);
                    if (updatedCardData) {
                      this.state.hellWeekCards[i] = updatedCardData;
                    }
                  }
                  
                  this.log(`Image saved to: ${localPath}`);
              } else {
                  this.log(`No image data returned for ${card.card_data.name}`);
              }

          } catch (err: any) {
              this.log(`Failed to generate image for ${card.card_data.name}: ${err.message}`);
              // Mark quest as failed for card-centric tracking
              const hellWeekCard = this.state.hellWeekCards[i];
              if (hellWeekCard) {
                const imageQuest = hellWeekCard.quests.find(q => q.questType === 'image-gen');
                if (imageQuest) {
                  cardManager.markQuestFailed(hellWeekCard.cardId, imageQuest.questId, err.message);
                }
              }
          }

          processedCount++;
          const progress = 70 + Math.floor((processedCount / totalCards) * 20); // 70 -> 90%
          this.updateState({ cards: updatedCards, hellWeekCards: [...this.state.hellWeekCards], progress });
      }

      this.log('Thor Media Generation Complete.');
      this.updateState({ 
          status: 'THOR_REVIEW', 
          currentStep: 'Waiting for Final Review...', 
          progress: 90,
          cards: updatedCards
      });
  }

  // ==========================================================================
  // PHASE 4: CONVICTION (DO)
  // ==========================================================================

  private async runConvictionFinalizing() {
      this.updateState({ status: 'CONVICTION_FINALIZING', currentStep: 'Conviction: Minting to Vault...', progress: 90 });
      this.log('Beginning Conviction Phase: Writing to Hypercore...');

      // 1. Create a new Collection Core
      const collectionName = `hell-week-run-${Date.now()}`;
      const coreInfo = await createCore(collectionName);
      
      this.log(`Created new Hypercore: ${collectionName}`);
      this.log(`Discovery Key: ${coreInfo.discoveryKey}`);

      // 2. Create Collection Header Block
      const headerBlock = {
          type: 'collection-header',
          name: path.basename(this.currentFilePath),
          sourcePath: this.currentFilePath,
          createdAt: new Date().toISOString(),
          leoContext: this.state.leoOutput,
          leoProvenance: this.state.leoProvenance,
          totalCards: this.state.cards.length,
          runId: this.state.runId,
          parentArtifact: this.state.parentArtifact,
          thorModel: this.state.thorModel,
      };
      await appendToCore(collectionName, JSON.stringify(headerBlock));

      // 3. Mint Cards
      const totalCards = this.state.cards.length;
      for (let i = 0; i < totalCards; i++) {
          const card = this.state.cards[i];
          const hellWeekCard = this.state.hellWeekCards[i];
          this.updateState({ currentStep: `Conviction: Minting Card ${i + 1}/${totalCards}` });
          
          const cardBlock = {
              type: 'card',
              id: hellWeekCard?.cardId || `card-${Date.now()}-${i}`,
              name: card.card_data.name,
              lore: card.card_data.lore,
              skills: card.card_data.skills,
              stats: card.card_data.stats,
              media: {
                  image: card.media_prompts.generated_image_local,
                  prompts: card.media_prompts
              },
              truthAnalysis: card.truth_analysis,
              parentCollection: coreInfo.key,
              // Full provenance tracking
              provenance: card.provenance,
              // Card-centric metadata
              runId: this.state.runId,
              hypercoreKey: hellWeekCard?.hypercoreKey,
              evolutions: hellWeekCard?.evolutions,
          };

          await appendToCore(collectionName, JSON.stringify(cardBlock));
          
          // Card-Centric: Mark the card as committed
          if (hellWeekCard) {
            await cardManager.commitCard(hellWeekCard.cardId);
            // Refresh the card in state
            const committedCard = cardManager.getCard(hellWeekCard.cardId);
            if (committedCard) {
              this.state.hellWeekCards[i] = committedCard;
            }
          }
          
          this.log(`Minted card: ${card.card_data.name}`);
          
          // Update progress
          const progress = 90 + Math.floor(((i + 1) / totalCards) * 10);
          this.updateState({ progress, hellWeekCards: [...this.state.hellWeekCards] });
      }

      // 4. Create Set Card ID and metadata
      const setCardId = `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const setName = this.state.leoContext?.suggested_set_name || 
                      this.state.leoOutput?.suggested_set_name ||
                      `Set from ${path.basename(this.currentFilePath)}`;
      const setDescription = this.state.leoContext?.suggested_set_description ||
                             this.state.leoOutput?.suggested_set_description ||
                             `Cards generated from ${path.basename(this.currentFilePath)}`;
      const nowIso = new Date().toISOString();
      
      this.log(`Creating Set Card: "${setName}" (${setCardId})`);

      // 5. Write card-index entries to card-library for Card Library display
      this.log('Indexing cards in Card Library...');
      const cardLibraryCoreName = 'card-library';
      const cardIds: string[] = [];
      const containedCards: Array<{ cardId: string; cardName?: string; addedAt: string; addedBy: 'pipeline'; order: number }> = [];
      
      // Ensure card-library core exists
      try {
        await createCore(cardLibraryCoreName);
      } catch (e: any) {
        // Core might already exist, that's fine
        if (!e.message?.includes('already exists')) {
          this.log(`Note: Card library core creation: ${e.message}`);
        }
      }
      
      // SetMembership reference for all cards in this set
      const setMembership = {
        setCardId: setCardId,
        setName: setName,
        joinedAt: nowIso,
        addedBy: 'pipeline' as const,
      };
      
      for (let i = 0; i < totalCards; i++) {
        const card = this.state.cards[i];
        const hellWeekCard = this.state.hellWeekCards[i];
        const cardId = hellWeekCard?.cardId || `card-${Date.now()}-${i}`;
        cardIds.push(cardId);
        
        // Build containedCards entry for the Set Card
        containedCards.push({
          cardId: cardId,
          cardName: card.card_data.name,
          addedAt: nowIso,
          addedBy: 'pipeline',
          order: i,
        });
        
        // Create card-index entry with self-contained relationships
        const cardIndexEntry = {
          type: 'card-index',
          cardId: cardId,
          cardType: 'standard',  // NEW: Card type
          name: card.card_data.name,
          createdAt: nowIso,
          coreName: collectionName,
          coreKey: coreInfo.key,
          coreDiscoveryKey: coreInfo.discoveryKey,
          thumbnail: card.media_prompts?.generated_image_local,
          mediaKind: 'image',
          mediaLocalPath: card.media_prompts?.generated_image_local,
          tier: card.card_data.tier || 1,
          // Self-contained relationships (NEW)
          memberOfSets: [setMembership],  // CRITICAL: Card knows its sets
          parentCardId: setCardId,  // FIX: Set Card is the parent
          // Hell Week card data (skills, lore, stats)
          cardData: {
            name: card.card_data.name,
            lore: card.card_data.lore,
            skills: card.card_data.skills || [],
            stats: card.card_data.stats || {},
            abilities: card.card_data.abilities || [],
            flavor_text: card.card_data.flavor_text,
            type: card.card_data.type,
            element: card.card_data.element,
            rarity: card.card_data.rarity,
          },
          // Media prompts for regeneration
          mediaPrompts: {
            base_image: card.media_prompts?.base_image,
            generated_image_local: card.media_prompts?.generated_image_local,
          },
          // Additional metadata
          runId: this.state.runId,
          sourceFile: path.basename(this.currentFilePath),
          lore: card.card_data.lore?.substring(0, 200),
          // Legacy field (deprecated but kept for compatibility)
          setId: setCardId,
        };
        
        await appendToCore(cardLibraryCoreName, JSON.stringify(cardIndexEntry));
      }
      this.log(`Added ${totalCards} cards to Card Library index.`);
      
      // Emit to persistence layer (batch for efficiency)
      const persistenceEvents = this.state.cards.map(card => ({
        type: 'CARD_CREATED' as const,
        data: {
          id: card.id,
          type: 'standard',
          mediaKind: 'image',
          name: card.card_data.name,
          tier: 1,
          hellweekRunId: this.state.runId,
          parentId: setCardId,
          lore: card.card_data.lore,
          createdAt: nowIso,
        }
      }));
      emitCardEvents(persistenceEvents);
      
      // 6. Create the Set Card (as a card-index entry, not separate metadata)
      // Set Cards are REAL cards that appear in the Card Library
      const setCardThumbnail = this.state.cards[0]?.media_prompts?.generated_image_local || undefined;
      
      const setCardIndexEntry = {
        type: 'card-index',
        cardId: setCardId,
        cardType: 'set',  // This is a Set Card
        name: setName,
        description: setDescription,
        createdAt: nowIso,
        coreName: collectionName,
        coreKey: coreInfo.key,
        coreDiscoveryKey: coreInfo.discoveryKey,
        thumbnail: setCardThumbnail,
        mediaKind: 'image',
        mediaLocalPath: setCardThumbnail,
        tier: 1,  // Set tier (can be calculated from contained cards)
        // Self-contained relationships
        memberOfSets: [],  // Sets can be in other sets
        // Set-specific data
        containedCards: containedCards,  // CRITICAL: Set knows its cards
        containedCardCount: totalCards,
        skills: [
          { id: 'contain', name: 'Contain', type: 'passive', description: 'Holds and organizes cards. Contained cards gain +10% XP when used.', icon: '📦' },
          { id: 'consume', name: 'Consume', type: 'active', description: 'Add a card to this set.', icon: '🔮' },
        ],
        // Source
        runId: this.state.runId,
        artifactName: path.basename(this.currentFilePath),
        leoContext: this.state.leoOutput,
      };
      
      await appendToCore(cardLibraryCoreName, JSON.stringify(setCardIndexEntry));
      this.log(`Created Set Card: "${setName}" with ${totalCards} contained cards`);
      
      // Emit set card to persistence layer
      emitCardEvents([{
        type: 'CARD_CREATED',
        data: {
          id: setCardId,
          type: 'set',
          mediaKind: 'image',
          name: setName,
          tier: 1,
          hellweekRunId: this.state.runId,
          createdAt: nowIso,
        }
      }]);
      
      // 7. Also write to legacy card-sets core for backwards compatibility
      const cardSetsCoreName = 'card-sets';
      try {
        await createCore(cardSetsCoreName);
      } catch (e: any) {
        // Core might already exist
      }
      
      const legacyCardSet = {
        type: 'card-set',
        setId: setCardId,
        name: setName,
        description: setDescription,
        artifactName: path.basename(this.currentFilePath),
        runId: this.state.runId,
        createdAt: nowIso,
        leoContext: this.state.leoOutput,
        cardIds: cardIds,
        cardCount: totalCards,
        imageCount: this.state.cards.filter((c: any) => c.media_prompts?.generated_image_local).length,
        videoCount: 0,
        thumbnail: setCardThumbnail,
      };
      
      await appendToCore(cardSetsCoreName, JSON.stringify(legacyCardSet));

      // 8. Finalize
      const runStats = cardManager.getRunStats(this.state.runId);
      this.log(`All cards minted successfully. Stats: ${JSON.stringify(runStats)}`);
      this.updateState({ 
          status: 'COMPLETE', 
          currentStep: 'Run Complete. Cards Vaulted.', 
          progress: 100,
          collectionKey: coreInfo.key,
          hellWeekCards: [...this.state.hellWeekCards],
          // Card Set info for navigation
          createdSetId: setCardId,
          createdSetName: setName,
      });
  }

  /**
   * Get the count of cards with failed image generation
   */
  public getFailedImageCount(): number {
    return this.state.cards.filter(
      (card: any) => !card.media_prompts?.generated_image_local
    ).length;
  }

  /**
   * Skip media generation entirely and proceed directly to Conviction
   * Useful when user doesn't want to generate images
   */
  public async skipMediaAndAdvance() {
    if (this.state.status !== 'THOR_MEDIA_PENDING') {
      this.log('Cannot skip media: not in THOR_MEDIA_PENDING state');
      return;
    }
    this.log('Skipping media generation, proceeding directly to Conviction.');
    await this.runConvictionFinalizing();
  }

  /**
   * Skip failed images and proceed to Conviction
   * Records failures in metadata for later retry
   */
  public async skipFailedAndContinue() {
    const failedCount = this.getFailedImageCount();
    this.log(`Skipping ${failedCount} cards without images, proceeding to Conviction.`);
    
    // Store failed card info in state for metadata
    const failedCards = this.state.cards
      .map((card: any, i: number) => ({ card, index: i }))
      .filter(({ card }) => !card.media_prompts?.generated_image_local)
      .map(({ card, index }) => ({
        index,
        name: card.card_data?.name,
        cardId: this.state.hellWeekCards[index]?.cardId,
      }));
    
    // Log failed cards
    for (const fc of failedCards) {
      this.log(`Skipped (no image): ${fc.name || fc.cardId}`);
    }
    
    // Proceed to Conviction
    await this.runConvictionFinalizing();
  }

  /**
   * Retry image generation for failed cards only
   */
  public async retryFailedImages() {
    const cardsToRetry = this.state.cards
      .map((card: any, i: number) => ({ card, index: i }))
      .filter(({ card }) => !card.media_prompts?.generated_image_local);
    
    if (cardsToRetry.length === 0) {
      this.log('No failed images to retry.');
      return;
    }

    this.log(`Retrying image generation for ${cardsToRetry.length} cards...`);
    this.updateState({ 
      status: 'THOR_MEDIA_GENERATING', 
      currentStep: `Retrying ${cardsToRetry.length} failed images...` 
    });

    const useVertex = isVertexAIConfigured();
    if (!useVertex) {
      this.log('Error: Vertex AI required for image generation');
      return;
    }

    const userDataDir = app.getPath('userData');
    const imagesDir = path.join(userDataDir, 'wormhole', 'pipeline-assets', this.state.runId);
    await fs.promises.mkdir(imagesDir, { recursive: true });

    for (const { card, index } of cardsToRetry) {
      const prompt = card.media_prompts?.base_image;
      if (!prompt) continue;

      try {
        this.log(`Retrying image for: ${card.card_data.name}`);
        const vertexClient = getVertexAIClient();
        const result = await vertexClient.generateImageImagen(prompt, 'pro-image', {
          aspectRatio: '1:1',
          sampleCount: 1,
        });

        if (result.base64) {
          const fileName = `card-${index}-retry-${Date.now()}.png`;
          const localPath = path.join(imagesDir, fileName);
          await fs.promises.writeFile(localPath, Buffer.from(result.base64, 'base64'));
          
          card.media_prompts.generated_image_path = `file://${localPath}`;
          card.media_prompts.generated_image_local = localPath;
          
          // Update HellWeekCard if exists
          const hellWeekCard = this.state.hellWeekCards[index];
          if (hellWeekCard) {
            const imageProvenance = createModelProvenance(
              'Pro Image (Imagen 4)',
              'Vertex AI',
              MODEL_SHORTHAND_MAP['pro-image']
            );
            await cardManager.updateCardWithImage(hellWeekCard.cardId, localPath, imageProvenance);
            const updatedCard = cardManager.getCard(hellWeekCard.cardId);
            if (updatedCard) {
              this.state.hellWeekCards[index] = updatedCard;
            }
          }
          
          this.log(`Retry successful for: ${card.card_data.name}`);
        }
      } catch (err: any) {
        this.log(`Retry failed for ${card.card_data.name}: ${err.message}`);
      }

      // Small delay between retries
      await new Promise(r => setTimeout(r, 1000));
    }

    this.updateState({ 
      status: 'THOR_REVIEW',
      currentStep: 'Retry complete. Waiting for review...',
      cards: [...this.state.cards],
      hellWeekCards: [...this.state.hellWeekCards],
    });
    
    const remaining = this.getFailedImageCount();
    this.log(`Retry complete. ${remaining} cards still without images.`);
  }
}

export const pipelineManager = new PipelineManager();

export function initPipeline(mainWindow: BrowserWindow) {
  pipelineManager.setWindow(mainWindow);

  ipcMain.handle('pipeline:start', async (_, filePath) => {
    return pipelineManager.startPipeline(filePath);
  });

  ipcMain.handle('pipeline:start-with-content', async (_, { fileName, content }) => {
    return pipelineManager.startPipelineWithContent(fileName, content);
  });

  ipcMain.handle('pipeline:advance', async () => {
    return pipelineManager.advanceStep();
  });

  // Pipeline settings handlers
  ipcMain.handle('pipeline:get-settings', async () => {
    return getPipelineSettings();
  });

  ipcMain.handle('pipeline:save-settings', async (_, settings) => {
    savePipelineSettings(settings);
    return getPipelineSettings();
  });

  ipcMain.handle('pipeline:set-thor-model', async (_, model: 'fast-llm' | 'smart-llm') => {
    savePipelineSettings({ thorModel: model });
    return getPipelineSettings();
  });

  ipcMain.handle('pipeline:skip-media', async () => {
    return pipelineManager.skipMediaAndAdvance();
  });

  ipcMain.handle('pipeline:skip-failed', async () => {
    return pipelineManager.skipFailedAndContinue();
  });

  ipcMain.handle('pipeline:retry-failed', async () => {
    return pipelineManager.retryFailedImages();
  });

  ipcMain.handle('pipeline:get-failed-count', async () => {
    return pipelineManager.getFailedImageCount();
  });

  // Recovery function to index orphaned Hell Week cards
  ipcMain.handle('pipeline:recover-cards', async () => {
    return recoverOrphanedHellWeekCards();
  });
}

/**
 * Recover orphaned Hell Week cards that were created but never indexed
 * Scans storage for hell-week-card-* hypercores and indexes them to card-library
 */
async function recoverOrphanedHellWeekCards(): Promise<{ recovered: number; errors: string[] }> {
  const fsSync = require('fs');
  const pathModule = require('path');
  
  const storageDir = './storage';
  const errors: string[] = [];
  let recovered = 0;

  console.log('[Recovery] Starting recovery of orphaned Hell Week cards...');

  if (!fsSync.existsSync(storageDir)) {
    return { recovered: 0, errors: ['Storage directory not found'] };
  }

  const dirs = fsSync.readdirSync(storageDir);
  const hellWeekCardDirs = dirs.filter((d: string) => d.startsWith('hell-week-card-'));

  console.log(`[Recovery] Found ${hellWeekCardDirs.length} Hell Week card hypercores`);

  // Ensure card-library core exists
  const cardLibraryCoreName = 'card-library';
  try {
    await createCore(cardLibraryCoreName);
  } catch (e: any) {
    // Core might already exist
  }

  // Read card-library to get existing cardIds (avoid duplicates)
  let existingCardIds = new Set<string>();
  try {
    const existing = await readCore(cardLibraryCoreName);
    for (const item of existing) {
      if (typeof item === 'string') {
        try {
          const data = JSON.parse(item);
          if (data.cardId) {
            existingCardIds.add(data.cardId);
          }
        } catch {}
      }
    }
  } catch {}

  console.log(`[Recovery] ${existingCardIds.size} cards already in library`);

  // Process each hell-week-card hypercore
  for (const cardDir of hellWeekCardDirs) {
    try {
      // Read the card hypercore
      const records = await readCore(cardDir);
      if (!records || records.length === 0) continue;

      // Find the most recent card-state record
      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i--) {
        if (typeof records[i] === 'string') {
          try {
            const parsed = JSON.parse(records[i]);
            // CardManager writes type: 'card-state' with card data in .card property
            if (parsed.type === 'card-state' && parsed.card) {
              cardRecord = parsed.card;
              break;
            }
          } catch {}
        }
      }

      if (!cardRecord) {
        // Try parsing as raw card object (fallback)
        for (let i = records.length - 1; i >= 0; i--) {
          if (typeof records[i] === 'string') {
            try {
              const parsed = JSON.parse(records[i]);
              if (parsed.cardId || parsed.cardData) {
                cardRecord = parsed;
                break;
              }
            } catch {}
          }
        }
      }

      if (!cardRecord) continue;

      // Extract cardId from data or hypercore name
      const cardId = cardRecord.cardId || cardDir.replace('hell-week-card-', '');
      
      // Skip if already indexed
      if (existingCardIds.has(cardId)) {
        continue;
      }

      // Get card name and image path from the card structure
      const cardName = cardRecord.cardData?.name || cardRecord.name || `Card ${cardId.slice(-6)}`;
      const imagePath = cardRecord.mediaPrompts?.generated_image_local || 
                        cardRecord.imagePath || 
                        cardRecord.mediaPath;

      // Create card-index entry
      const cardIndexEntry = {
        type: 'card-index',
        cardId: cardId,
        name: cardName,
        createdAt: cardRecord.createdAt || new Date().toISOString(),
        coreName: cardDir,
        thumbnail: imagePath,
        mediaKind: 'image',
        mediaLocalPath: imagePath,
        runId: cardRecord.runId,
        lore: cardRecord.cardData?.lore?.substring(0, 200),
        sourceFile: 'Hell Week Recovery',
        // Include additional card data for richer display
        cardType: cardRecord.cardData?.stats?.type,
        state: cardRecord.state,
      };

      await appendToCore(cardLibraryCoreName, JSON.stringify(cardIndexEntry));
      recovered++;
      console.log(`[Recovery] Indexed: ${cardIndexEntry.name} (${cardRecord.state || 'unknown'})`);

    } catch (err: any) {
      errors.push(`${cardDir}: ${err.message}`);
    }
  }

  console.log(`[Recovery] Complete. Recovered ${recovered} cards, ${errors.length} errors.`);
  return { recovered, errors };
}

// Export for use
async function readCore(name: string): Promise<string[]> {
  const Hypercore = require('hypercore');
  const core = new Hypercore('./storage/' + name);
  await core.ready();
  const length = core.length;
  const results: string[] = [];
  for (let i = 0; i < length; i++) {
    const data = await core.get(i);
    if (data) {
      results.push(data.toString());
    }
  }
  return results;
}
