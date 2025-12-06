/**
 * Card Manager Module
 * 
 * Implements the Card-Centric Architecture where each card is a self-contained
 * entity with its own hypercore ledger, state machine, and quest system.
 * 
 * Card States:
 * - BLOB: Initial state, raw text chunk created
 * - SORTED: Thor has processed the blob into card data
 * - ILLUSTRATED: Image has been generated
 * - ANIMATED: Video has been generated (optional)
 * - COMMITTED: Card finalized in library
 */

import { createCore, appendToCore, readCore, getCoreLength } from './p2p';
import { ModelProvenance } from './vertexai';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type CardState = 'blob' | 'sorted' | 'illustrated' | 'animated' | 'committed';

export interface CardQuest {
  questId: string;
  questType: 'thor-sort' | 'image-gen' | 'video-gen' | 'commit';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  priority: number;
  payload?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CardEvolution {
  fromState: CardState;
  toState: CardState;
  timestamp: string;
  trigger: string;
  provenance?: ModelProvenance;
}

export interface CardBlob {
  text: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface CardSkill {
  name: string;
  description: string;
  type: 'Passive' | 'Active';
}

export interface CardStats {
  level: number;
  type: string;
}

export interface CardTruthAnalysis {
  facts: string[];
  desires: string[];
}

export interface CardMediaPrompts {
  base_image: string;
  video_loop: string;
  generated_image_local?: string;
  generated_video_local?: string;
}

export interface CardData {
  name: string;
  lore: string;
  skills: CardSkill[];
  stats: CardStats;
}

export interface ParentArtifact {
  id: string;
  name: string;
  type: string;
  hash?: string;
}

export interface LeoContext {
  summary: string;
  audience_profiles: string[];
  objectives: Array<{ id: string; description: string }>;
  yarn_context: string;
  provenance: ModelProvenance;
  // Card Set naming (for grouping cards from this run)
  suggested_set_name?: string;
  suggested_set_description?: string;
}

export interface HellWeekCard {
  // Identity
  cardId: string;
  hypercoreKey?: string;
  
  // Lineage
  parentArtifact: ParentArtifact;
  leoContext?: LeoContext;
  runId: string;
  
  // State
  state: CardState;
  
  // Content (evolves)
  blob: CardBlob;
  cardData?: CardData;
  truthAnalysis?: CardTruthAnalysis;
  mediaPrompts?: CardMediaPrompts;
  
  // Provenance
  provenance: {
    leo?: ModelProvenance;
    thor?: ModelProvenance;
    imageGen?: ModelProvenance;
    videoGen?: ModelProvenance;
  };
  
  // Quests
  quests: CardQuest[];
  
  // History
  evolutions: CardEvolution[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Image Queue Types
// ============================================================================

export interface ImageQueueItem {
  cardId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type ImageQueueCallback = (cardId: string, success: boolean, imagePath?: string, error?: string) => void;

// ============================================================================
// Card Manager Class
// ============================================================================

class CardManager {
  private cards: Map<string, HellWeekCard> = new Map();
  private runCards: Map<string, string[]> = new Map(); // runId -> cardIds
  
  // Image Queue System
  private imageQueue: ImageQueueItem[] = [];
  private activeImageJobs: number = 0;
  private maxConcurrentImages: number = 3;
  private imageQueueCallback: ImageQueueCallback | null = null;
  private imageQueueRunning: boolean = false;
  
  /**
   * Generate a unique card ID
   */
  private generateCardId(): string {
    return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Generate a unique quest ID
   */
  private generateQuestId(): string {
    return `quest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create a new card from a blob (text chunk)
   * This is the first step - card is created immediately when blob is created
   */
  async createCardFromBlob(
    blob: CardBlob,
    parentArtifact: ParentArtifact,
    runId: string,
    leoContext?: LeoContext
  ): Promise<HellWeekCard> {
    const cardId = this.generateCardId();
    const now = new Date().toISOString();
    
    const card: HellWeekCard = {
      cardId,
      parentArtifact,
      leoContext,
      runId,
      state: 'blob',
      blob,
      provenance: {
        leo: leoContext?.provenance,
      },
      quests: [
        {
          questId: this.generateQuestId(),
          questType: 'thor-sort',
          status: 'pending',
          priority: 1,
          createdAt: now,
          updatedAt: now,
        }
      ],
      evolutions: [
        {
          fromState: 'blob',
          toState: 'blob',
          timestamp: now,
          trigger: 'Card created from blob',
        }
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory
    this.cards.set(cardId, card);
    
    // Track by run
    if (!this.runCards.has(runId)) {
      this.runCards.set(runId, []);
    }
    this.runCards.get(runId)!.push(cardId);

    // Persist to hypercore
    await this.persistCard(card);

    return card;
  }

  /**
   * Update card after Thor processing (blob -> sorted)
   */
  async updateCardWithThorData(
    cardId: string,
    cardData: CardData,
    truthAnalysis: CardTruthAnalysis,
    mediaPrompts: CardMediaPrompts,
    thorProvenance: ModelProvenance
  ): Promise<HellWeekCard> {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    const now = new Date().toISOString();

    // Update card data
    card.cardData = cardData;
    card.truthAnalysis = truthAnalysis;
    card.mediaPrompts = mediaPrompts;
    card.provenance.thor = thorProvenance;
    card.state = 'sorted';
    card.updatedAt = now;

    // Update quests
    const thorQuest = card.quests.find(q => q.questType === 'thor-sort');
    if (thorQuest) {
      thorQuest.status = 'completed';
      thorQuest.completedAt = now;
      thorQuest.updatedAt = now;
    }

    // Add image generation quest
    card.quests.push({
      questId: this.generateQuestId(),
      questType: 'image-gen',
      status: 'pending',
      priority: 2,
      createdAt: now,
      updatedAt: now,
    });

    // Record evolution
    card.evolutions.push({
      fromState: 'blob',
      toState: 'sorted',
      timestamp: now,
      trigger: 'Thor sorting complete',
      provenance: thorProvenance,
    });

    // Persist
    await this.persistCard(card);

    return card;
  }

  /**
   * Update card after image generation (sorted -> illustrated)
   */
  async updateCardWithImage(
    cardId: string,
    imagePath: string,
    imageProvenance: ModelProvenance
  ): Promise<HellWeekCard> {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    const now = new Date().toISOString();

    // Update media
    if (card.mediaPrompts) {
      card.mediaPrompts.generated_image_local = imagePath;
    }
    card.provenance.imageGen = imageProvenance;
    card.state = 'illustrated';
    card.updatedAt = now;

    // Update quests
    const imageQuest = card.quests.find(q => q.questType === 'image-gen');
    if (imageQuest) {
      imageQuest.status = 'completed';
      imageQuest.completedAt = now;
      imageQuest.updatedAt = now;
    }

    // Add commit quest
    card.quests.push({
      questId: this.generateQuestId(),
      questType: 'commit',
      status: 'pending',
      priority: 4,
      createdAt: now,
      updatedAt: now,
    });

    // Record evolution
    card.evolutions.push({
      fromState: 'sorted',
      toState: 'illustrated',
      timestamp: now,
      trigger: 'Image generation complete',
      provenance: imageProvenance,
    });

    // Persist
    await this.persistCard(card);

    return card;
  }

  /**
   * Mark card as committed (final state)
   */
  async commitCard(cardId: string): Promise<HellWeekCard> {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    const now = new Date().toISOString();

    card.state = 'committed';
    card.updatedAt = now;

    // Update quests
    const commitQuest = card.quests.find(q => q.questType === 'commit');
    if (commitQuest) {
      commitQuest.status = 'completed';
      commitQuest.completedAt = now;
      commitQuest.updatedAt = now;
    }

    // Record evolution - get previous state before we changed it
    const previousState = card.evolutions.length > 0 
      ? card.evolutions[card.evolutions.length - 1].toState 
      : 'sorted';
    card.evolutions.push({
      fromState: previousState,
      toState: 'committed',
      timestamp: now,
      trigger: 'Card committed to library',
    });

    // Persist
    await this.persistCard(card);

    return card;
  }

  /**
   * Persist card to its hypercore
   */
  private async persistCard(card: HellWeekCard): Promise<void> {
    const coreName = `hell-week-card-${card.cardId}`;
    
    try {
      // Create or get the core
      const coreInfo = await createCore(coreName);
      card.hypercoreKey = coreInfo.key;
      
      // Append the current card state
      await appendToCore(coreName, JSON.stringify({
        type: 'card-state',
        timestamp: new Date().toISOString(),
        card: card,
      }));
    } catch (error) {
      console.error(`Failed to persist card ${card.cardId}:`, error);
      // Don't throw - card is still in memory
    }
  }

  /**
   * Get a card by ID
   */
  getCard(cardId: string): HellWeekCard | undefined {
    return this.cards.get(cardId);
  }

  /**
   * Get all cards for a run
   */
  getCardsForRun(runId: string): HellWeekCard[] {
    const cardIds = this.runCards.get(runId) || [];
    return cardIds.map(id => this.cards.get(id)).filter(Boolean) as HellWeekCard[];
  }

  /**
   * Get pending quests across all cards
   */
  getPendingQuests(): Array<{ card: HellWeekCard; quest: CardQuest }> {
    const pending: Array<{ card: HellWeekCard; quest: CardQuest }> = [];
    
    for (const card of this.cards.values()) {
      for (const quest of card.quests) {
        if (quest.status === 'pending') {
          pending.push({ card, quest });
        }
      }
    }
    
    // Sort by priority
    pending.sort((a, b) => a.quest.priority - b.quest.priority);
    
    return pending;
  }

  /**
   * Get cards that need image generation
   */
  getCardsNeedingImages(): HellWeekCard[] {
    return Array.from(this.cards.values()).filter(card => 
      card.state === 'sorted' && 
      card.quests.some(q => q.questType === 'image-gen' && q.status === 'pending')
    );
  }

  /**
   * Mark a quest as in-progress
   */
  markQuestInProgress(cardId: string, questId: string): void {
    const card = this.cards.get(cardId);
    if (card) {
      const quest = card.quests.find(q => q.questId === questId);
      if (quest) {
        quest.status = 'in-progress';
        quest.updatedAt = new Date().toISOString();
      }
    }
  }

  /**
   * Mark a quest as failed
   */
  markQuestFailed(cardId: string, questId: string, error: string): void {
    const card = this.cards.get(cardId);
    if (card) {
      const quest = card.quests.find(q => q.questId === questId);
      if (quest) {
        quest.status = 'failed';
        quest.error = error;
        quest.updatedAt = new Date().toISOString();
      }
    }
  }

  /**
   * Convert card to legacy format for backward compatibility
   */
  toLegacyFormat(card: HellWeekCard): any {
    return {
      chunk_id: card.blob.chunkIndex.toString(),
      truth_analysis: card.truthAnalysis,
      card_data: card.cardData,
      media_prompts: card.mediaPrompts,
      provenance: card.provenance,
    };
  }

  /**
   * Clear all cards (for new run)
   */
  clearRun(runId: string): void {
    const cardIds = this.runCards.get(runId) || [];
    for (const cardId of cardIds) {
      this.cards.delete(cardId);
    }
    this.runCards.delete(runId);
  }

  /**
   * Get statistics for a run
   */
  getRunStats(runId: string): {
    total: number;
    byState: Record<CardState, number>;
    pendingQuests: number;
  } {
    const cards = this.getCardsForRun(runId);
    const byState: Record<CardState, number> = {
      blob: 0,
      sorted: 0,
      illustrated: 0,
      animated: 0,
      committed: 0,
    };
    
    let pendingQuests = 0;
    
    for (const card of cards) {
      byState[card.state]++;
      pendingQuests += card.quests.filter(q => q.status === 'pending').length;
    }
    
    return {
      total: cards.length,
      byState,
      pendingQuests,
    };
  }

  // ============================================================================
  // Image Queue System
  // ============================================================================

  /**
   * Set the callback function for image completion events
   */
  setImageQueueCallback(callback: ImageQueueCallback): void {
    this.imageQueueCallback = callback;
  }

  /**
   * Add a card to the image generation queue
   * Called immediately when a card transitions to 'sorted' state
   */
  queueCardForImageGeneration(cardId: string, prompt: string): void {
    const card = this.cards.get(cardId);
    if (!card) {
      console.error(`[CardManager] Cannot queue image - card ${cardId} not found`);
      return;
    }

    // Only queue if card is in sorted state and has a prompt
    if (card.state !== 'sorted') {
      console.warn(`[CardManager] Cannot queue image - card ${cardId} is not in sorted state (current: ${card.state})`);
      return;
    }

    // Check if already in queue
    if (this.imageQueue.some(item => item.cardId === cardId)) {
      console.warn(`[CardManager] Card ${cardId} already in image queue`);
      return;
    }

    const queueItem: ImageQueueItem = {
      cardId,
      prompt,
      status: 'pending',
      addedAt: new Date().toISOString(),
    };

    this.imageQueue.push(queueItem);
    console.log(`[CardManager] Queued card ${cardId} for image generation (queue size: ${this.imageQueue.length})`);

    // Start processing if not already running
    if (!this.imageQueueRunning) {
      this.processImageQueue();
    }
  }

  /**
   * Process the image queue with parallel execution
   * Runs up to maxConcurrentImages jobs at once
   */
  private async processImageQueue(): Promise<void> {
    if (this.imageQueueRunning) return;
    this.imageQueueRunning = true;
    
    console.log(`[CardManager] Starting image queue processor (max concurrent: ${this.maxConcurrentImages})`);

    while (this.imageQueue.some(item => item.status === 'pending')) {
      // Fill up to max concurrent slots
      while (this.activeImageJobs < this.maxConcurrentImages) {
        const nextItem = this.imageQueue.find(item => item.status === 'pending');
        if (!nextItem) break;

        nextItem.status = 'processing';
        nextItem.startedAt = new Date().toISOString();
        this.activeImageJobs++;

        console.log(`[CardManager] Starting image job for ${nextItem.cardId} (active: ${this.activeImageJobs}/${this.maxConcurrentImages})`);

        // Fire and forget - don't await here to allow parallel processing
        this.processImageItem(nextItem).finally(() => {
          this.activeImageJobs--;
        });
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.imageQueueRunning = false;
    console.log(`[CardManager] Image queue processor stopped (queue empty)`);
  }

  /**
   * Process a single image queue item
   * This is called in parallel for multiple items
   */
  private async processImageItem(item: ImageQueueItem): Promise<void> {
    try {
      // The actual image generation is handled by the callback
      // The callback should call completeImageGeneration when done
      if (this.imageQueueCallback) {
        // Signal that we're ready to generate this image
        // The pipeline will handle the actual API call
        this.imageQueueCallback(item.cardId, true);
      } else {
        console.warn(`[CardManager] No image queue callback set - cannot process ${item.cardId}`);
        item.status = 'failed';
        item.error = 'No image processor configured';
      }
    } catch (error: any) {
      console.error(`[CardManager] Error processing image for ${item.cardId}:`, error.message);
      item.status = 'failed';
      item.error = error.message;
      item.completedAt = new Date().toISOString();
      
      if (this.imageQueueCallback) {
        this.imageQueueCallback(item.cardId, false, undefined, error.message);
      }
    }
  }

  /**
   * Mark an image generation as completed (success or failure)
   * Called by the pipeline after image is generated
   */
  completeImageGeneration(cardId: string, success: boolean, imagePath?: string, error?: string): void {
    const item = this.imageQueue.find(i => i.cardId === cardId);
    if (item) {
      item.status = success ? 'completed' : 'failed';
      item.completedAt = new Date().toISOString();
      if (error) item.error = error;
      console.log(`[CardManager] Image generation ${success ? 'completed' : 'failed'} for ${cardId}`);
    }
  }

  /**
   * Get the current image queue status
   */
  getImageQueueStatus(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    items: ImageQueueItem[];
  } {
    return {
      total: this.imageQueue.length,
      pending: this.imageQueue.filter(i => i.status === 'pending').length,
      processing: this.imageQueue.filter(i => i.status === 'processing').length,
      completed: this.imageQueue.filter(i => i.status === 'completed').length,
      failed: this.imageQueue.filter(i => i.status === 'failed').length,
      items: [...this.imageQueue],
    };
  }

  /**
   * Clear the image queue (for new run)
   */
  clearImageQueue(): void {
    this.imageQueue = [];
    this.activeImageJobs = 0;
    this.imageQueueRunning = false;
    console.log(`[CardManager] Image queue cleared`);
  }

  /**
   * Get next card waiting for image generation
   * Used by pipeline to fetch and process
   */
  getNextPendingImageCard(): HellWeekCard | null {
    const item = this.imageQueue.find(i => i.status === 'processing');
    if (item) {
      return this.cards.get(item.cardId) || null;
    }
    return null;
  }
}

// Singleton instance
export const cardManager = new CardManager();
