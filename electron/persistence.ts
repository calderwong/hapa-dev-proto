/**
 * Persistence Layer Singleton
 * 
 * Shared module for the SQLite projection engine.
 * Can be imported by main.ts, pipeline.ts, and other electron modules.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SqliteAdapter } from './SqliteAdapter';
import type { HypercoreEvent, CardCreatedPayload, CardDeletedPayload } from './persistence-types';

// Singleton instance
let adapter: SqliteAdapter | null = null;
let initialized = false;

/**
 * Initialize the persistence layer.
 * Safe to call multiple times - only initializes once.
 */
export async function initPersistence(): Promise<void> {
  if (initialized) return;
  
  try {
    const dbPath = path.join(app.getPath('userData'), 'persistence.db');
    adapter = new SqliteAdapter(dbPath);
    await adapter.initialize();
    
    const stats = await adapter.getStats();
    console.log('[Persistence] Initialized. Cards:', stats.cardCount, 'Wiki:', stats.wikiNodeCount);
    initialized = true;
  } catch (err) {
    const dbPath = path.join(app.getPath('userData'), 'persistence.db');
    const code = (err as any)?.code ? String((err as any).code) : '';
    const message = (err as any)?.message ? String((err as any).message) : '';
    const isRecoverable = code.includes('SQLITE_IOERR_TRUNCATE') || message.includes('SQLITE_IOERR_TRUNCATE');

    if (isRecoverable) {
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const renameIfExists = (p: string) => {
          if (!fs.existsSync(p)) return;
          const next = `${p}.${stamp}.corrupt`;
          fs.renameSync(p, next);
        };

        renameIfExists(dbPath);
        renameIfExists(`${dbPath}-wal`);
        renameIfExists(`${dbPath}-shm`);

        adapter = new SqliteAdapter(dbPath);
        await adapter.initialize();
        const stats = await adapter.getStats();
        console.log('[Persistence] Initialized. Cards:', stats.cardCount, 'Wiki:', stats.wikiNodeCount);
        initialized = true;
        return;
      } catch (err2) {
        console.error('[Persistence] Failed to recover after DB rename:', err2);
      }
    }

    console.error('[Persistence] Failed to initialize:', err);
    adapter = null;
  }
}

/**
 * Get the persistence adapter.
 * Returns null if not initialized or failed.
 */
export function getPersistence(): SqliteAdapter | null {
  return adapter;
}

export function getPersistenceMetaValue(key: string): string | null {
  const a = adapter as any;
  if (!a || !a.isReady()) return null;
  if (typeof a.getMetaValue !== 'function') return null;
  try {
    return a.getMetaValue(key);
  } catch {
    return null;
  }
}

export function setPersistenceMetaValue(key: string, value: string): void {
  const a = adapter as any;
  if (!a || !a.isReady()) return;
  if (typeof a.setMetaValue !== 'function') return;
  try {
    a.setMetaValue(key, value);
  } catch {
    // ignore
  }
}

/**
 * Check if persistence is ready.
 */
export function isPersistenceReady(): boolean {
  return adapter !== null && adapter.isReady();
}

/**
 * Emit a card creation/update event to the persistence layer.
 */
export async function emitCardEvent(
  type: 'CARD_CREATED' | 'CARD_UPDATED',
  cardData: Partial<CardCreatedPayload>
): Promise<void> {
  if (!adapter || !adapter.isReady()) return;
  
  try {
    const event: HypercoreEvent<CardCreatedPayload> = {
      type,
      payload: {
        id: cardData.id || '',
        type: cardData.type || 'standard',
        mediaKind: cardData.mediaKind,
        name: cardData.name,
        tier: cardData.tier,
        hellweekRunId: cardData.hellweekRunId,
        parentId: cardData.parentId,
        contentText: cardData.contentText,
        lore: cardData.lore,
        metadata: cardData.metadata,
        createdAt: cardData.createdAt || new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
    
    await adapter.applyEvent(event);
  } catch (err) {
    console.error('[Persistence] Event emit failed:', err);
  }
}

/**
 * Emit a batch of card events (more efficient for pipelines).
 */
export async function emitCardEvents(
  cards: Array<{ type: 'CARD_CREATED' | 'CARD_UPDATED'; data: Partial<CardCreatedPayload> }>
): Promise<void> {
  if (!adapter || !adapter.isReady()) return;
  
  try {
    const events: HypercoreEvent[] = cards.map(({ type, data }) => ({
      type,
      payload: {
        id: data.id || '',
        type: data.type || 'standard',
        mediaKind: data.mediaKind,
        name: data.name,
        tier: data.tier,
        hellweekRunId: data.hellweekRunId,
        parentId: data.parentId,
        contentText: data.contentText,
        lore: data.lore,
        metadata: data.metadata,
        createdAt: data.createdAt || new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }));
    
    await adapter.applyEvents(events);
    console.log(`[Persistence] Batch indexed ${events.length} cards`);
  } catch (err) {
    console.error('[Persistence] Batch event failed:', err);
  }
}

export async function emitCardDeleted(payload: CardDeletedPayload): Promise<void> {
  if (!adapter || !adapter.isReady()) return;

  try {
    const event: HypercoreEvent<CardDeletedPayload> = {
      type: 'CARD_DELETED',
      payload: {
        id: payload.id,
        deletedAt: payload.deletedAt,
      },
      timestamp: new Date().toISOString(),
    };

    await adapter.applyEvent(event);
  } catch (err) {
    console.error('[Persistence] Delete event emit failed:', err);
  }
}
