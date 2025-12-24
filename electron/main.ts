import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import { finished } from 'stream/promises';

const streamPipeline = promisify(pipeline);
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';
import isDev from 'electron-is-dev';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initP2P, createCore, appendToCore, readCore, getCoreLength, getP2PStats, setStorageDir, getStorageDir } from './p2p';
import { initPipeline } from './pipeline';
import { thorsHammaManager } from './thors-hamma';
import {
  isVertexAIConfigured,
  getVertexAIClient,
  getVertexAISettings,
  resetVertexAIClient
} from './vertexai';
import {
  AimlApiClient,
  isAimlApiConfigured,
  AIMLAPI_MODEL_MAP
} from './aimlapi';
import {
  initPersistence,
  getPersistence,
  emitCardEvent,
  emitCardDeleted,
  getPersistenceMetaValue,
  setPersistenceMetaValue
} from './persistence';

const store: any = new Store();

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let rendererBootReady = false;
let mainReadyToShow = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    try {
      const win = mainWindow;
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    } catch {
      // ignore
    }
  });

  ipcMain.handle('persistence:rebuild-card-library-index', async () => {
    const adapter: any = getPersistence();
    if (!adapter || !adapter.isReady || !adapter.isReady()) {
      return { ok: false, error: 'persistence_not_ready', indexed: 0, totalBlocks: 0 };
    }

    const checkpointKey = 'card_library_index_last_seq';
    try {
      const len = await getCoreLength(CARD_LIBRARY_CORE_NAME);
      const end = typeof len === 'number' ? len : 0;
      if (end <= 0) {
        setPersistenceMetaValue(checkpointKey, '0');
        return { ok: true, indexed: 0, totalBlocks: 0 };
      }

      // Reset checkpoint and replay entire index
      setPersistenceMetaValue(checkpointKey, '0');
      const CHUNK_BLOCKS = 500;
      const BATCH_EVENTS = 250;
      let indexed = 0;
      let totalBlocks = 0;
      const batch: any[] = [];
      const flush = async (checkpointValue: number) => {
        if (batch.length > 0) {
          await adapter.applyEvents(batch as any);
          indexed += batch.length;
          batch.length = 0;
        }
        setPersistenceMetaValue(checkpointKey, String(checkpointValue));
        await new Promise((r) => setTimeout(r, 0));
      };

      for (let cursor = 0; cursor < end; cursor += CHUNK_BLOCKS) {
        const chunkEnd = Math.min(end, cursor + CHUNK_BLOCKS);
        const blocks = await readCore(CARD_LIBRARY_CORE_NAME, { start: cursor, end: chunkEnd });
        if (!Array.isArray(blocks) || blocks.length === 0) {
          await flush(chunkEnd);
          continue;
        }

        totalBlocks += blocks.length;

        for (let i = 0; i < blocks.length; i++) {
          const raw = blocks[i];
          if (!raw || typeof raw !== 'string') continue;
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }

          if (!parsed || (parsed.type !== 'card-index' && !parsed.cardId && !parsed.coreName)) continue;

          const id = String(parsed.cardId || parsed.id || parsed.coreName || '').trim();
          if (!id) continue;

          const deleted = parsed.deleted === true || parsed.isDeleted === true || parsed.status === 'deleted';
          const now = new Date().toISOString();
          if (deleted) {
            batch.push({
              type: 'CARD_DELETED',
              payload: {
                id,
                deletedAt: parsed.deletedAt || now,
              },
              timestamp: now,
            });
          } else {
            batch.push({
              type: 'CARD_CREATED',
              payload: {
                id,
                type: typeof parsed.cardType === 'string' ? parsed.cardType : 'standard',
                mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                name: typeof parsed.name === 'string' ? parsed.name : undefined,
                tier: typeof parsed.tier === 'number' ? parsed.tier : undefined,
                hellweekRunId: typeof parsed.runId === 'string' ? parsed.runId : undefined,
                parentId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : now,
                metadata: {
                  coreName: typeof parsed.coreName === 'string' ? parsed.coreName : id,
                  thumbnail: typeof parsed.thumbnail === 'string' ? parsed.thumbnail : undefined,
                  mediaLocalPath: typeof parsed.mediaLocalPath === 'string' ? parsed.mediaLocalPath : undefined,
                  parentCardId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                  mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                  name: typeof parsed.name === 'string' ? parsed.name : undefined,
                  createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
                  updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
                },
              },
              timestamp: now,
            });
          }

          if (batch.length >= BATCH_EVENTS) {
            await flush(cursor + i + 1);
          }
        }

        await flush(chunkEnd);
      }

      return { ok: true, indexed, totalBlocks };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err), indexed: 0, totalBlocks: 0 };
    }
  });
}

process.on('uncaughtException', (err: any) => {
  try {
    console.error('[UncaughtException]', {
      message: err?.message || String(err),
      code: err?.code || err?.errno,
      storageDir: (() => {
        try {
          return getStorageDir();
        } catch {
          return undefined;
        }
      })(),
      cwd: process.cwd(),
      stack: err?.stack,
    });
  } catch {
    // ignore
  }
});

process.on('unhandledRejection', (reason: any) => {
  try {
    console.error('[UnhandledRejection]', {
      message: reason?.message || String(reason),
      code: reason?.code || reason?.errno,
      storageDir: (() => {
        try {
          return getStorageDir();
        } catch {
          return undefined;
        }
      })(),
      cwd: process.cwd(),
      stack: reason?.stack,
    });
  } catch {
    // ignore
  }
});

const GEMINI_REQUEST_LOG_KEY = 'geminiRequestLog';
const GEMINI_REQUEST_LOG_MAX_ENTRIES = 200;
const ADMIN_SETTINGS_KEY = 'adminSettings';
const LLAMA_SETTINGS_KEY = 'llamaSettings';
const LOCAL_VISION_SETTINGS_KEY = 'localVisionSettings';
const WORMHOLE_SETTINGS_KEY = 'wormholeSettings';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const CARD_SETS_CORE_NAME = 'card-sets';
const WIKI_CORE_NAME = 'wormhole-wiki-entries';
const NEXUS_SETTINGS_KEY = 'nexusSettings';

const HAPA_STRESS_MEMORY =
  process.env.HAPA_STRESS_MEMORY === '1' ||
  process.argv.includes('--stress-memory');

const HAPA_STRESS_HEADLESS =
  process.env.HAPA_STRESS_HEADLESS === '1' ||
  process.argv.includes('--stress-headless');
const WORMHOLE_INGEST_SET_ID = 'set-wormhole-ingests';

type AudioMode = 'transcribe' | 'realtime';

interface ImageGenSettings {
  defaultImageModel: string;
  defaultPromptLLM: string;
}

interface PipelineSettings {
  thorThrottleMs: number;  // Delay between chunk processing (ms)
  mediaThrottleMs: number; // Delay between image generations (ms)
}

interface NexusSettings {
  globalRenderCap?: number;
  globalPageSize?: number;
}

interface AdminSettings {
  audioMode: AudioMode;
  imageGenSettings?: ImageGenSettings;
  pipelineSettings?: PipelineSettings;
}

const getNexusSettingsInternal = (): Required<NexusSettings> => {
  const stored = (store.get(NEXUS_SETTINGS_KEY, {}) as Partial<NexusSettings>) || {};
  return {
    globalRenderCap: typeof stored.globalRenderCap === 'number' && stored.globalRenderCap > 0 ? stored.globalRenderCap : 1000,
    globalPageSize: typeof stored.globalPageSize === 'number' && stored.globalPageSize > 0 ? stored.globalPageSize : 120,
  };
};

const saveNexusSettingsInternal = (settings: Partial<NexusSettings>) => {
  const current = getNexusSettingsInternal();
  const next = {
    ...current,
    ...settings,
  };
  store.set(NEXUS_SETTINGS_KEY, next);
  return next;
};

const getLatestCoreRecord = async (coreName: string): Promise<any | null> => {
  try {
    const records = await readCore(coreName);
    if (!Array.isArray(records) || records.length === 0) return null;
    for (let i = records.length - 1; i >= 0; i -= 1) {
      const raw = records[i];
      if (!raw || typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      } catch {
        // ignore
      }
    }
    return null;
  } catch {
    return null;
  }
};

const ensureWormholeIngestSetExists = async (): Promise<{ setId: string; setName: string }> => {
  const now = new Date().toISOString();
  const setName = 'Wormhole Ingests';

  await createCore(WORMHOLE_INGEST_SET_ID);

  const existing = await getLatestCoreRecord(WORMHOLE_INGEST_SET_ID);
  if (!existing || !(existing.type === 'card' || existing.cardType === 'set' || existing.kind === 'set')) {
    const setCardRecord = {
      type: 'card',
      kind: 'set',
      id: WORMHOLE_INGEST_SET_ID,
      cardId: WORMHOLE_INGEST_SET_ID,
      name: setName,
      createdAt: now,
      updatedAt: now,
      cardType: 'set',
      mediaKind: 'image',
      memberOfSets: [],
      containedCards: [],
      containedCardCount: 0,
      skills: [
        { id: 'contain', name: 'Contain', type: 'passive', description: 'Holds and organizes cards.', icon: '📦' },
        { id: 'consume', name: 'Consume', type: 'active', description: 'Add a card to this set.', icon: '🔮' },
      ],
      source: 'wormhole',
      provider: 'wormhole',
    };
    await appendToCore(WORMHOLE_INGEST_SET_ID, JSON.stringify(setCardRecord));
  }

  await createCore(CARD_SETS_CORE_NAME);
  try {
    const setRecords = await readCore(CARD_SETS_CORE_NAME);
    let hasSet = false;
    for (const raw of setRecords || []) {
      if (!raw || typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.type === 'card-set' && parsed.setId === WORMHOLE_INGEST_SET_ID) {
          hasSet = true;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!hasSet) {
      await appendToCore(
        CARD_SETS_CORE_NAME,
        JSON.stringify({
          type: 'card-set',
          setId: WORMHOLE_INGEST_SET_ID,
          name: setName,
          description: 'Automatically collected Wormhole ingests.',
          artifactName: 'Wormhole',
          runId: 'wormhole',
          createdAt: now,
          cardIds: [],
          cardCount: 0,
          imageCount: 0,
          videoCount: 0,
        }),
      );
    }
  } catch {
    // ignore
  }

  await createCore(CARD_LIBRARY_CORE_NAME);
  await appendToCore(
    CARD_LIBRARY_CORE_NAME,
    JSON.stringify({
      type: 'card-index',
      cardId: WORMHOLE_INGEST_SET_ID,
      createdAt: now,
      provider: 'wormhole',
      model: 'system',
      coreName: WORMHOLE_INGEST_SET_ID,
      name: setName,
      cardType: 'set',
      mediaKind: 'image',
      memberOfSets: [],
      containedCards: [],
      containedCardCount: 0,
    }),
  );

  return { setId: WORMHOLE_INGEST_SET_ID, setName };
};

const addCardToWormholeIngestSet = async (params: { cardId: string; cardName?: string; addedAt: string }) => {
  const { cardId, cardName, addedAt } = params;
  await createCore(WORMHOLE_INGEST_SET_ID);

  const latest = await getLatestCoreRecord(WORMHOLE_INGEST_SET_ID);
  const contained = Array.isArray(latest?.containedCards) ? latest.containedCards : [];
  const existingIds = new Set(contained.map((c: any) => String(c?.cardId || '')).filter(Boolean));
  if (existingIds.has(cardId)) return;

  const now = new Date().toISOString();
  const nextContainedCards = [
    ...contained,
    {
      cardId,
      cardName: cardName || undefined,
      addedAt: addedAt || now,
      addedBy: 'consume',
      order: contained.length,
    },
  ];

  const nextSetRecord = {
    ...(latest && typeof latest === 'object' ? latest : {}),
    type: 'card',
    kind: 'set',
    id: WORMHOLE_INGEST_SET_ID,
    cardId: WORMHOLE_INGEST_SET_ID,
    name: (latest && latest.name) || 'Wormhole Ingests',
    createdAt: (latest && latest.createdAt) || now,
    updatedAt: now,
    cardType: 'set',
    mediaKind: 'image',
    containedCards: nextContainedCards,
    containedCardCount: nextContainedCards.length,
  };

  await appendToCore(WORMHOLE_INGEST_SET_ID, JSON.stringify(nextSetRecord));

  try {
    await createCore(CARD_SETS_CORE_NAME);
    const setRecords = await readCore(CARD_SETS_CORE_NAME);
    let lastRecord: any = null;
    for (let i = setRecords.length - 1; i >= 0; i -= 1) {
      const raw = setRecords[i];
      if (!raw || typeof raw !== 'string') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.type === 'card-set' && parsed.setId === WORMHOLE_INGEST_SET_ID) {
          lastRecord = parsed;
          break;
        }
      } catch {
        // ignore
      }
    }

    const existingIds = Array.isArray(lastRecord?.cardIds) ? (lastRecord.cardIds as any[]) : [];
    const nextIds = [...new Set(existingIds.map(String).filter(Boolean).concat([cardId]))];

    const nowIso = new Date().toISOString();
    await appendToCore(
      CARD_SETS_CORE_NAME,
      JSON.stringify({
        ...(lastRecord || {}),
        type: 'card-set',
        setId: WORMHOLE_INGEST_SET_ID,
        name: (lastRecord && lastRecord.name) || 'Wormhole Ingests',
        description: (lastRecord && lastRecord.description) || 'Automatically collected Wormhole ingests.',
        artifactName: (lastRecord && lastRecord.artifactName) || 'Wormhole',
        runId: (lastRecord && lastRecord.runId) || 'wormhole',
        createdAt: (lastRecord && lastRecord.createdAt) || nowIso,
        cardIds: nextIds,
        cardCount: nextIds.length,
        imageCount: typeof lastRecord?.imageCount === 'number' ? lastRecord.imageCount : 0,
        videoCount: typeof lastRecord?.videoCount === 'number' ? lastRecord.videoCount : 0,
      }),
    );
  } catch {
    // ignore
  }
};

interface LlamaSettingsInternal {
  serverPath: string;
  modelsDir: string;
  defaultModel: string;
  port: number;
  autoStart: boolean;
  favorites?: string[];
}

interface LlamaStatusInternal {
  running: boolean;
  pid?: number;
  model?: string;
  port?: number;
  lastError?: string;
}

interface LocalVisionSettingsInternal {
  pythonPath: string;
  modelsDir: string;
  activeModel: string;
  port: number;
  autoStart: boolean;
}

interface LocalVisionStatusInternal {
  running: boolean;
  pid?: number;
  port?: number;
  model?: string;
  lastError?: string;
}

interface GeminiRequestLogEntry {
  id: string;
  createdAt: string;
  model: string;
  payload: {
    history: any[];
    parts: any[];
  };
  updatedAt?: string;
}

// ============================================================================
// MEMORY MANAGEMENT UTILITIES
// ============================================================================

/** Log memory usage for debugging memory issues */
const logMemory = (label: string) => {
  const used = process.memoryUsage();
  console.log(`[Memory] ${label}:`, {
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(used.external / 1024 / 1024) + 'MB',
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
  });
};

/** Hint to garbage collector if available (run with --expose-gc) */
const hintGC = () => {
  if (global.gc) {
    global.gc();
  }
};

/** Track active operations for memory debugging */
const activeOperations = new Map<string, { startTime: number; type: string; sizeMB?: number }>();

const startOperation = (id: string, type: string, sizeMB?: number) => {
  activeOperations.set(id, { startTime: Date.now(), type, sizeMB });
  if (activeOperations.size > 5) {
    console.warn(`[Ops] Warning: ${activeOperations.size} concurrent operations active`);
  }
};

const endOperation = (id: string) => {
  const op = activeOperations.get(id);
  if (op) {
    const duration = Date.now() - op.startTime;
    console.log(`[Ops] Completed ${op.type} (${id}) in ${duration}ms. Active ops: ${activeOperations.size - 1}`);
    activeOperations.delete(id);
  }
};

const parsePositiveInt = (value: any, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
};

const getRepoTempDir = () => {
  try {
    return path.join(process.cwd(), 'temp');
  } catch {
    return path.join(app.getPath('userData'), 'temp');
  }
};

const ensureDir = async (dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch {
    // ignore
  }
};

const appendJsonl = async (filePath: string, payload: any) => {
  const line = JSON.stringify(payload) + '\n';
  await fs.promises.appendFile(filePath, line, { encoding: 'utf8' });
};

const getDefaultSeedImagePath = () => {
  const p = path.join(process.cwd(), 'public', 'Paramation_Logo.png');
  try {
    if (fs.existsSync(p)) return p;
  } catch {
    // ignore
  }
  return '';
};

let stressRunStarted = false;

const runMemoryStressTest = async (win: BrowserWindow) => {
  if (stressRunStarted) return;
  stressRunStarted = true;

  const imageCount = parsePositiveInt(process.env.HAPA_STRESS_IMAGE_COUNT, 50);
  const videoCount = parsePositiveInt(process.env.HAPA_STRESS_VIDEO_COUNT, 20);
  const sleepMs = parsePositiveInt(process.env.HAPA_STRESS_SLEEP_MS, 150);
  const seedImagePath =
    typeof process.env.HAPA_STRESS_SEED_IMAGE_PATH === 'string' && process.env.HAPA_STRESS_SEED_IMAGE_PATH.trim().length > 0
      ? process.env.HAPA_STRESS_SEED_IMAGE_PATH.trim()
      : getDefaultSeedImagePath();

  const reportDir = getRepoTempDir();
  await ensureDir(reportDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `memory-stress-${stamp}.jsonl`);

  const snapshot = async (label: string, extra?: any) => {
    const used = process.memoryUsage();
    const payload = {
      t: new Date().toISOString(),
      label,
      rssMB: Math.round(used.rss / 1024 / 1024),
      heapUsedMB: Math.round(used.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(used.heapTotal / 1024 / 1024),
      externalMB: Math.round(used.external / 1024 / 1024),
      activeOps: activeOperations.size,
      ...extra,
    };
    await appendJsonl(reportPath, payload);
    logMemory(label);
  };

  const invokeRenderer = async <T,>(expr: string): Promise<T> => {
    return await win.webContents.executeJavaScript(expr, true);
  };

  await snapshot('StressTest Start', {
    imageCount,
    videoCount,
    seedImagePath: seedImagePath || undefined,
  });

  const generatedImages: Array<{ localPath: string; craftedPrompt?: string }> = [];
  for (let i = 1; i <= imageCount; i++) {
    await snapshot('StressTest Image Before', { i });
    try {
      const name = `Stress Image ${i}`;
      const text = `Memory stress test image generation iteration ${i}.`;
      const provider = process.env.HAPA_STRESS_IMAGE_PROVIDER || 'gemini';
      const result = await invokeRenderer<any>(
        `window.electronAPI.generateImageForCard({ cardContext: { name: ${JSON.stringify(name)}, mediaKind: 'text', text: ${JSON.stringify(text)}, tags: ['stress-test'] }, provider: ${JSON.stringify(provider)} })`
      );
      if (result?.success && result?.localPath) {
        generatedImages.push({ localPath: String(result.localPath), craftedPrompt: result.craftedPrompt });
      }
      await appendJsonl(reportPath, { t: new Date().toISOString(), phase: 'image', i, ok: true, localPath: result?.localPath });
    } catch (err: any) {
      await appendJsonl(reportPath, { t: new Date().toISOString(), phase: 'image', i, ok: false, error: err?.message || String(err) });
    }
    hintGC();
    await snapshot('StressTest Image After', { i, generated: generatedImages.length });
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  const parentCardId = `stress-parent-${Date.now()}`;
  try {
    await createCore(CARD_LIBRARY_CORE_NAME);
    await appendToCore(
      CARD_LIBRARY_CORE_NAME,
      JSON.stringify({
        type: 'card-index',
        cardId: parentCardId,
        name: 'Stress Parent',
        mediaKind: 'image',
        createdAt: new Date().toISOString(),
        coreName: parentCardId,
      })
    );
    await createCore(parentCardId);
    await appendToCore(
      parentCardId,
      JSON.stringify({
        type: 'card',
        cardId: parentCardId,
        name: 'Stress Parent',
        mediaKind: 'image',
        createdAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore
  }

  const loopSourcePaths = generatedImages.length > 0
    ? generatedImages.map((x) => x.localPath)
    : (seedImagePath ? [seedImagePath] : []);

  for (let i = 1; i <= videoCount; i++) {
    const sourcePath = loopSourcePaths.length > 0
      ? loopSourcePaths[(i - 1) % loopSourcePaths.length]
      : '';
    if (!sourcePath) {
      await appendJsonl(reportPath, { t: new Date().toISOString(), phase: 'video', i, ok: false, error: 'No source image path available' });
      break;
    }

    await snapshot('StressTest Video Before', { i, sourcePath });
    try {
      const imageId = `stress-image-${i}`;
      const originalPrompt = generatedImages[(i - 1) % Math.max(1, generatedImages.length)]?.craftedPrompt || 'Stress loop prompt';
      const result = await invokeRenderer<any>(
        `window.electronAPI.createLoopVideoForImage({ parentCardId: ${JSON.stringify(parentCardId)}, imageId: ${JSON.stringify(imageId)}, imagePath: ${JSON.stringify(sourcePath)}, originalPrompt: ${JSON.stringify(originalPrompt)}, cardName: 'Stress Parent', imageOrder: ${i - 1} })`
      );
      await appendJsonl(reportPath, { t: new Date().toISOString(), phase: 'video', i, ok: true, videoCardId: result?.videoCardId, videoPath: result?.videoPath });
    } catch (err: any) {
      await appendJsonl(reportPath, { t: new Date().toISOString(), phase: 'video', i, ok: false, error: err?.message || String(err) });
    }
    hintGC();
    await snapshot('StressTest Video After', { i });
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }

  await snapshot('StressTest Complete', { reportPath });
  console.log('[StressTest] Complete:', { reportPath });

  if (HAPA_STRESS_HEADLESS) {
    setTimeout(() => {
      try {
        app.quit();
      } catch {
        // ignore
      }
    }, 750);
  }
};

// ============================================================================

const appendGeminiRequestLog = (entry: GeminiRequestLogEntry) => {
  const current = (store.get(GEMINI_REQUEST_LOG_KEY, []) as GeminiRequestLogEntry[]) || [];
  const next = [...current, entry];
  const trimmed =
    next.length > GEMINI_REQUEST_LOG_MAX_ENTRIES
      ? next.slice(next.length - GEMINI_REQUEST_LOG_MAX_ENTRIES)
      : next;
  store.set(GEMINI_REQUEST_LOG_KEY, trimmed);
};

let llamaProcess: ChildProcess | null = null;
let llamaStatus: LlamaStatusInternal = { running: false };

const getLlamaSettingsInternal = (): LlamaSettingsInternal => {
  const stored = (store.get(LLAMA_SETTINGS_KEY, {}) as Partial<LlamaSettingsInternal>) || {};
  const modelsDir =
    typeof stored.modelsDir === 'string' && stored.modelsDir.length > 0
      ? stored.modelsDir
      : path.join(app.getPath('userData'), 'llama-models');
  const favorites = Array.isArray(stored.favorites)
    ? (stored.favorites as string[])
    : [];
  return {
    serverPath: stored.serverPath || '',
    modelsDir,
    defaultModel: stored.defaultModel || '',
    port: typeof stored.port === 'number' && stored.port > 0 ? stored.port : 8080,
    autoStart: stored.autoStart === true,
    favorites,
  };
};

const saveLlamaSettingsInternal = (settings: LlamaSettingsInternal) => {
  store.set(LLAMA_SETTINGS_KEY, settings);
};

const getLlamaStatusInternal = (): LlamaStatusInternal => {
  const running = !!llamaProcess && !llamaProcess.killed;
  return { ...llamaStatus, running };
};

const startLlamaServerInternal = async (): Promise<LlamaStatusInternal> => {
  if (llamaProcess && !llamaProcess.killed) {
    return getLlamaStatusInternal();
  }

  const settings = getLlamaSettingsInternal();
  if (!settings.serverPath) {
    const msg = 'Llama server path is not configured. Please set it in Local AI settings.';
    llamaStatus = { running: false, lastError: msg };
    throw new Error(msg);
  }

  const modelPath =
    settings.defaultModel && path.isAbsolute(settings.defaultModel)
      ? settings.defaultModel
      : settings.defaultModel
        ? path.join(settings.modelsDir, settings.defaultModel)
        : '';

  if (!modelPath) {
    const msg = 'Llama default model is not configured. Please set it in Local AI settings.';
    llamaStatus = { running: false, lastError: msg };
    throw new Error(msg);
  }

  try {
    const args = ['-m', modelPath, '--port', String(settings.port)];
    const child = spawn(settings.serverPath, args, {
      cwd: path.dirname(settings.serverPath),
      detached: false,
      stdio: 'ignore',
    });

    llamaProcess = child;
    llamaStatus = {
      running: true,
      pid: child.pid ?? undefined,
      model: modelPath,
      port: settings.port,
      lastError: undefined,
    };

    child.on('exit', (code, signal) => {
      llamaProcess = null;
      llamaStatus = {
        ...llamaStatus,
        running: false,
        lastError:
          code && code !== 0
            ? `Llama server exited with code ${code}${signal ? ` (signal ${signal})` : ''}`
            : llamaStatus.lastError,
      };
    });

    child.on('error', (err) => {
      llamaProcess = null;
      llamaStatus = { running: false, lastError: err.message };
    });

    return getLlamaStatusInternal();
  } catch (error: any) {
    const msg = error?.message || 'Failed to start llama server';
    llamaProcess = null;
    llamaStatus = { running: false, lastError: msg };
    throw new Error(msg);
  }
};

const stopLlamaServerInternal = (): LlamaStatusInternal => {
  if (llamaProcess && !llamaProcess.killed) {
    llamaProcess.kill();
  }
  llamaProcess = null;
  llamaStatus = { ...llamaStatus, running: false };
  return getLlamaStatusInternal();
};

const listLlamaLocalModelsInternal = async (): Promise<
  { name: string; path: string; sizeBytes?: number; mtime?: string }[]
> => {
  const settings = getLlamaSettingsInternal();
  const dir = settings.modelsDir;

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const results: { name: string; path: string; sizeBytes?: number; mtime?: string }[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.gguf')) continue;

      const fullPath = path.join(dir, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          sizeBytes: stat.size,
          mtime: stat.mtime.toISOString(),
        });
      } catch {
        results.push({ name: entry.name, path: fullPath });
      }
    }

    return results;
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const deleteLlamaModelInternal = async (targetPath: string) => {
  const settings = getLlamaSettingsInternal();
  const modelsDir = path.resolve(settings.modelsDir);

  let toDelete = targetPath;
  if (!path.isAbsolute(toDelete)) {
    toDelete = path.join(modelsDir, toDelete);
  }

  const resolved = path.resolve(toDelete);
  if (!resolved.startsWith(modelsDir + path.sep)) {
    throw new Error('Refusing to delete file outside llama models directory.');
  }

  await fs.promises.unlink(resolved);
};

let visionProcess: ChildProcess | null = null;
let visionStatus: LocalVisionStatusInternal = { running: false };

const getLocalVisionSettingsInternal = (): LocalVisionSettingsInternal => {
  const stored = (store.get(LOCAL_VISION_SETTINGS_KEY, {}) as Partial<LocalVisionSettingsInternal>) || {};
  const modelsDir =
    typeof stored.modelsDir === 'string' && stored.modelsDir.length > 0
      ? stored.modelsDir
      : path.join(app.getPath('userData'), 'vision-models');

  return {
    pythonPath: stored.pythonPath || 'python', // Default to 'python' in PATH
    modelsDir,
    activeModel: stored.activeModel || 'Tongyi-MAI/Z-Image-Turbo',
    port: typeof stored.port === 'number' && stored.port > 0 ? stored.port : 11435,
    autoStart: stored.autoStart === true,
  };
};

const saveLocalVisionSettingsInternal = (settings: LocalVisionSettingsInternal) => {
  store.set(LOCAL_VISION_SETTINGS_KEY, settings);
};

const getLocalVisionStatusInternal = (): LocalVisionStatusInternal => {
  const running = !!visionProcess && !visionProcess.killed;
  return { ...visionStatus, running };
};

const startVisionServerInternal = async (): Promise<LocalVisionStatusInternal> => {
  if (visionProcess && !visionProcess.killed) {
    return getLocalVisionStatusInternal();
  }

  const settings = getLocalVisionSettingsInternal();
  if (!settings.pythonPath) {
    const msg = 'Python path is not configured. Please set it in Local Vision settings.';
    visionStatus = { running: false, lastError: msg };
    throw new Error(msg);
  }

  try {
    // Path to the python server script
    const serverScript = isDev
      ? path.join(__dirname, '../python/server.py')
      : path.join(process.resourcesPath, 'python/server.py'); // Assuming we package it here for prod

    // If running in dev but accessing via 'electron', __dirname might be dist-electron
    // We need to reliably find the python folder. 
    // In dev: root/python/server.py
    // In prod: resources/python/server.py

    let scriptPath = '';
    if (isDev) {
      scriptPath = path.resolve(__dirname, '..', 'python', 'server.py');
    } else {
      // In production, we likely need to bundle the python script
      // For now, let's assume it's in resources
      scriptPath = path.join(process.resourcesPath, 'python', 'server.py');
    }

    if (!fs.existsSync(scriptPath)) {
      // Fallback check for dev environment relative to main.ts location
      scriptPath = path.resolve(__dirname, '../../python/server.py');
    }

    console.log('Starting Vision Server at:', scriptPath);

    const env = {
      ...process.env,
      HAPA_VISION_PORT: String(settings.port),
      HF_HOME: settings.modelsDir
    };

    const child = spawn(settings.pythonPath, [scriptPath], {
      env,
      detached: false,
      stdio: 'pipe', // Capture output for logging
    });

    visionProcess = child;
    visionStatus = {
      running: true,
      pid: child.pid ?? undefined,
      model: settings.activeModel,
      port: settings.port,
      lastError: undefined,
    };

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        console.log(`[Vision]: ${data.toString().trim()}`);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        console.error(`[Vision Err]: ${data.toString().trim()}`);
      });
    }

    child.on('exit', (code, signal) => {
      visionProcess = null;
      visionStatus = {
        ...visionStatus,
        running: false,
        lastError:
          code && code !== 0
            ? `Vision server exited with code ${code}${signal ? ` (signal ${signal})` : ''}`
            : visionStatus.lastError,
      };
    });

    child.on('error', (err) => {
      visionProcess = null;
      visionStatus = { running: false, lastError: err.message };
    });

    return getLocalVisionStatusInternal();
  } catch (error: any) {
    const msg = error?.message || 'Failed to start vision server';
    visionProcess = null;
    visionStatus = { running: false, lastError: msg };
    throw new Error(msg);
  }
};

const stopVisionServerInternal = (): LocalVisionStatusInternal => {
  if (visionProcess && !visionProcess.killed) {
    visionProcess.kill();
  }
  visionProcess = null;
  visionStatus = { ...visionStatus, running: false };
  return getLocalVisionStatusInternal();
};

const HF_MODELS_API_BASE = 'https://huggingface.co/api/models';

interface HfGGUFSearchResult {
  repoId: string;
  description?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  ggufFiles: string[];
  recommendedFile?: string;
  architecture?: string;
  contextLength?: number;
  license?: string;
}

const pickRecommendedGGUFFile = (files: string[]): string | undefined => {
  if (!files || files.length === 0) return undefined;
  const preferences = [
    'Q4_K_M',
    'Q4_0',
    'Q5_K_M',
    'Q5_0',
    'Q6_K',
    'Q8_0',
    'Q3_K_M',
    'Q3_K_S',
  ];
  const upperFiles = files.map((f) => f.toUpperCase());
  for (const pref of preferences) {
    const idx = upperFiles.findIndex((name) => name.includes(pref));
    if (idx >= 0) {
      return files[idx];
    }
  }
  return files[0];
};

const searchHfGGUFModelsInternal = async (
  query: string,
): Promise<HfGGUFSearchResult[]> => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return [];
  }

  const searchUrl =
    `${HF_MODELS_API_BASE}?search=` + encodeURIComponent(trimmed) + '&limit=20';

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error('Unexpected Hugging Face search response shape:', data);
      return [];
    }

    const limited = data.slice(0, 8);
    const results: HfGGUFSearchResult[] = [];

    for (const item of limited) {
      const repoId =
        (item && typeof item.id === 'string' && (item.id as string)) ||
        (item && typeof item.modelId === 'string' && (item.modelId as string));
      if (!repoId) continue;

      try {
        const detailResponse = await fetch(`${HF_MODELS_API_BASE}/${repoId}`);
        const detail = await detailResponse.json();

        const siblings = Array.isArray((detail as any).siblings)
          ? ((detail as any).siblings as any[])
          : [];
        const ggufFiles = siblings
          .map((s: any) =>
            s && typeof s.rfilename === 'string' ? (s.rfilename as string) : '',
          )
          .filter((name: string) => name.toLowerCase().endsWith('.gguf'));

        if (!ggufFiles.length) {
          continue;
        }

        const recommendedFile = pickRecommendedGGUFFile(ggufFiles);

        const ggufMeta = (detail as any)?.gguf || {};
        const contextLength =
          typeof ggufMeta.context_length === 'number'
            ? (ggufMeta.context_length as number)
            : undefined;
        const architecture =
          typeof ggufMeta.architecture === 'string'
            ? (ggufMeta.architecture as string)
            : undefined;

        const cardData = (detail as any)?.cardData || {};
        let license: string | undefined;
        if (typeof cardData.license_name === 'string') {
          license = cardData.license_name as string;
        } else if (typeof cardData.license === 'string') {
          license = cardData.license as string;
        }

        results.push({
          repoId,
          description:
            (detail as any)?.cardData?.model_name ||
            (detail as any)?.cardData?.base_model ||
            (detail as any)?.pipeline_tag ||
            '',
          downloads:
            typeof (detail as any)?.downloads === 'number'
              ? ((detail as any).downloads as number)
              : typeof (item as any).downloads === 'number'
                ? ((item as any).downloads as number)
                : undefined,
          likes:
            typeof (detail as any)?.likes === 'number'
              ? ((detail as any).likes as number)
              : typeof (item as any).likes === 'number'
                ? ((item as any).likes as number)
                : undefined,
          tags:
            (Array.isArray((detail as any)?.tags) &&
              ((detail as any).tags as string[])) ||
            (Array.isArray((item as any).tags) &&
              ((item as any).tags as string[])) ||
            [],
          ggufFiles,
          recommendedFile,
          architecture,
          contextLength,
          license,
        });
      } catch (error) {
        console.error('Failed to fetch Hugging Face model details for repo', repoId, error);
      }
    }

    return results;
  } catch (error) {
    console.error('Hugging Face GGUF search failed:', error);
    return [];
  }
};

const broadcastChatStream = (
  provider: 'gemini' | 'openai' | 'llama',
  delta: string,
  done?: boolean,
  model?: string,
) => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (!delta && !done) return;
  win.webContents.send('chat-stream', { provider, delta, done: !!done, model });
};

interface OpenAIAudioSession {
  id: string;
  createdAt: string;
  fullText: string;
}

const openAIAudioSessions = new Map<string, OpenAIAudioSession>();

const broadcastAudioTranscript = (
  sessionId: string,
  delta: string,
  fullText: string,
) => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (!delta && !fullText) return;
  win.webContents.send('audio-transcript-stream', {
    sessionId,
    delta,
    fullText,
  });
};

const getAdminSettings = (): AdminSettings => {
  const stored = (store.get(ADMIN_SETTINGS_KEY, {}) as Partial<AdminSettings>) || {};
  const audioMode: AudioMode = stored.audioMode === 'realtime' ? 'realtime' : 'transcribe';
  return {
    audioMode,
    imageGenSettings: stored.imageGenSettings,
  };
};

const saveAdminSettings = (settings: Partial<AdminSettings>) => {
  const existing = getAdminSettings();
  const merged = { ...existing, ...settings };
  store.set(ADMIN_SETTINGS_KEY, merged);
};

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

const REVID_API_BASE = 'https://www.revid.ai/api/public/v2';
const REVID_MEDIA_BASE = 'https://revid.ai/api/public';

type RevidMediaType = 'video' | 'image' | 'audio' | 'unknown';

interface RevidMediaItemInternal {
  id: string;
  mid: string;
  uid?: string;
  prompt?: string;
  mediaUrl: string;
  imagePreview?: string;
  fileType?: string;
  type: RevidMediaType;
  orientation?: string;
  raw?: any;
}

const callRevidApi = async (
  endpoint: string,
  method: 'GET' | 'POST',
  body?: any,
): Promise<any> => {
  const apiKey = store.get('revidKey') as string | undefined;
  if (!apiKey) {
    throw new Error('Revid API Key not found. Please configure it in Settings.');
  }

  const url = `${REVID_API_BASE}${endpoint}`;
  const options: any = {
    method,
    headers: {
      key: apiKey,
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore JSON parse errors
  }

  if (!response.ok) {
    console.error('Revid API error for', endpoint, data);
    const message =
      (data && (data.error?.message || data.message)) ||
      `Revid API request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

const normalizeRevidMediaType = (
  rawType?: string,
  fileType?: string,
): RevidMediaType => {
  const lowerRaw = (rawType || '').toLowerCase();
  const lowerFile = (fileType || '').toLowerCase();

  if (lowerRaw === 'video') return 'video';
  if (lowerRaw === 'image') return 'image';
  if (lowerRaw === 'audio') return 'audio';

  if (lowerFile.startsWith('video/')) return 'video';
  if (lowerFile.startsWith('image/')) return 'image';
  if (lowerFile.startsWith('audio/')) return 'audio';

  return 'unknown';
};

const normalizeRevidMediaItem = (raw: any): RevidMediaItemInternal | null => {
  if (!raw || typeof raw !== 'object') return null;

  const idValue =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.mid === 'string' && raw.mid) ||
    '';
  const midValue =
    (typeof raw.mid === 'string' && raw.mid) ||
    (typeof raw.id === 'string' && raw.id) ||
    '';
  const mediaUrl = typeof raw.mediaUrl === 'string' ? raw.mediaUrl : '';

  if (!idValue || !midValue || !mediaUrl) {
    return null;
  }

  const fileType = typeof raw.fileType === 'string' ? raw.fileType : undefined;
  const type = normalizeRevidMediaType(raw.type, fileType);

  return {
    id: String(idValue),
    mid: String(midValue),
    uid: typeof raw.uid === 'string' ? raw.uid : undefined,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    mediaUrl,
    imagePreview:
      typeof raw.imagePreview === 'string' ? raw.imagePreview : undefined,
    fileType,
    type,
    orientation:
      typeof raw.orientation === 'string' ? raw.orientation : undefined,
    raw,
  };
};

const callRevidMediaApi = async (pathWithQuery: string): Promise<any> => {
  const apiKey = store.get('revidKey') as string | undefined;
  if (!apiKey) {
    throw new Error('Revid API Key not found. Please configure it in Settings.');
  }

  const url = `${REVID_MEDIA_BASE}${pathWithQuery}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      key: apiKey,
    },
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore JSON parse errors
  }

  if (!response.ok) {
    console.error('Revid media API error for', pathWithQuery, data);
    const message =
      (data && (data.error?.message || data.message)) ||
      `Revid media request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

const downloadRevidMediaInternal = async (params: {
  mediaUrl: string;
  id: string;
  type?: string;
  fileType?: string;
}): Promise<{
  localPath: string;
  fileName: string;
  mimeType: string;
  size: number;
}> => {
  const { mediaUrl, id, type, fileType } = params;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(mediaUrl);
  } catch {
    throw new Error('Invalid Revid media URL.');
  }

  const lowerType = (type || '').toLowerCase();
  const lowerFileType = (fileType || '').toLowerCase();

  let category: 'video' | 'image' | 'audio' | 'other' = 'other';
  if (lowerType === 'video' || lowerFileType.startsWith('video/')) {
    category = 'video';
  } else if (lowerType === 'image' || lowerFileType.startsWith('image/')) {
    category = 'image';
  } else if (lowerType === 'audio' || lowerFileType.startsWith('audio/')) {
    category = 'audio';
  }

  const extFromType = lowerFileType.includes('/')
    ? lowerFileType.split('/')[1]
    : '';
  const extFromPath = path.extname(parsedUrl.pathname).replace(/^\./, '');
  const extension = extFromType || extFromPath || 'bin';

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${safeId}.${extension}`;

  const baseDir = path.join(app.getPath('userData'), 'revid-media');
  const destDir =
    category === 'other'
      ? baseDir
      : path.join(baseDir, category === 'video' ? 'video' : category === 'image' ? 'image' : 'audio');

  await fs.promises.mkdir(destDir, { recursive: true });

  const destPath = path.join(destDir, fileName);

  try {
    const existingStat = await fs.promises.stat(destPath);
    return {
      localPath: destPath,
      fileName,
      mimeType: fileType || '',
      size: existingStat.size,
    };
  } catch {
    // file does not exist; proceed to download
  }

  const client = parsedUrl.protocol === 'http:' ? http : https;

  const size = await new Promise<number>((resolve, reject) => {
    const request = client.get(parsedUrl, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        response.resume();
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      let bytes = 0;

      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve(bytes));
      });

      fileStream.on('error', (err) => {
        fileStream.close(() => reject(err));
      });
    });

    request.on('error', (err) => {
      reject(err);
    });
  });

  return {
    localPath: destPath,
    fileName,
    mimeType: fileType || '',
    size,
  };
};

// Base endpoint for a local llama.cpp server exposing an OpenAI-compatible API.
// You can override this with the LLAMA_CHAT_ENDPOINT environment variable.
const LLAMA_CHAT_ENDPOINT =
  process.env.LLAMA_CHAT_ENDPOINT || 'http://127.0.0.1:8080/v1/chat/completions';

const getLlamaModelsEndpoint = (): string => {
  try {
    const url = new URL(LLAMA_CHAT_ENDPOINT);
    return `${url.protocol}//${url.host}/v1/models`;
  } catch {
    return 'http://127.0.0.1:8080/v1/models';
  }
};

const listDefaultOpenAIModels = () => {
  return [
    { name: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', description: 'Fast, lightweight model' },
    { name: 'gpt-4.1', displayName: 'GPT-4.1', description: 'General-purpose model' },
    { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', description: 'Fast multimodal model' },
    { name: 'gpt-4o', displayName: 'GPT-4o', description: 'Multimodal flagship model' },
  ];
};

const fetchOpenAIModels = async (apiKey: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI models API error:', data);
      return listDefaultOpenAIModels();
    }

    if (!data || !Array.isArray(data.data)) {
      console.error('Unexpected OpenAI models response shape:', data);
      return listDefaultOpenAIModels();
    }

    const ids = (data.data as any[])
      .map((m) => (m && typeof m.id === 'string' ? (m.id as string) : ''))
      .filter((id) => {
        if (!id) return false;
        const lower = id.toLowerCase();

        if (
          lower.includes('embedding') ||
          lower.includes('whisper') ||
          lower.includes('audio') ||
          lower.includes('tts')
        ) {
          return false;
        }

        return lower.startsWith('gpt-') || lower.startsWith('o');
      });

    const uniqueSorted = Array.from(new Set(ids)).sort();

    if (uniqueSorted.length === 0) {
      return listDefaultOpenAIModels();
    }

    return uniqueSorted.map((id) => ({
      name: id,
      displayName: id,
      description: '',
    }));
  } catch (error) {
    console.error('Error fetching OpenAI models from API:', error);
    return listDefaultOpenAIModels();
  }
};

const extractOpenAIStreamText = (json: any): string => {
  try {
    const choice = json?.choices?.[0];
    const delta = choice?.delta;
    if (!delta) return '';

    const content = (delta as any).content;

    // Legacy models: content is a simple string
    if (typeof content === 'string') {
      return content;
    }

    // Newer models: content is an array of parts
    if (Array.isArray(content)) {
      const pieces: string[] = [];
      for (const part of content) {
        if (!part) continue;
        if (typeof part === 'string') {
          pieces.push(part);
          continue;
        }
        if (typeof part.text === 'string') {
          pieces.push(part.text as string);
          continue;
        }
        if (typeof (part as any).output_text === 'string') {
          pieces.push((part as any).output_text as string);
          continue;
        }
      }
      return pieces.join('');
    }

    // Some models may expose text directly on delta
    if (typeof (delta as any).output_text === 'string') {
      return (delta as any).output_text as string;
    }

    return '';
  } catch (error) {
    console.error('Failed to extract text from OpenAI stream delta:', error, json);
    return '';
  }
};

const transcribeAudioWithOpenAI = async (
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<string> => {
  const buffer = Buffer.from(base64, 'base64');
  const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });
  const formData = new FormData();
  const extension = mimeType.split('/')[1] || 'wav';
  formData.append('file', blob, `audio.${extension}`);
  formData.append('model', 'whisper-1');

  const response = await fetch(OPENAI_TRANSCRIPT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('OpenAI transcription error:', data);
    throw new Error(data.error?.message || 'Failed to transcribe audio');
  }

  return (data.text as string) || '';
};

const DEFAULT_GEMINI_MODEL = 'gemini-3-pro-preview';

const resolveGeminiModelName = (modelName?: string): string => {
  const trimmed = (modelName || '').toString().trim();
  if (!trimmed || trimmed === 'gemini-pro') {
    return DEFAULT_GEMINI_MODEL;
  }
  return trimmed;
};

const summarizeTextWithGemini = async (
  text: string,
  modelName?: string,
): Promise<{ short: string; medium: string; outline: string[]; model: string }> => {
  const apiKey = store.get('geminiKey') as string | undefined;
  if (!apiKey) {
    throw new Error('Gemini API Key not found. Please configure it in Settings.');
  }

  const resolvedModel = resolveGeminiModelName(modelName);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: resolvedModel });

  const trimmed = text.length > 16000 ? text.slice(0, 16000) : text;
  const prompt =
    'Summarize the following content in 1-3 short paragraphs. Focus on the main ideas and important details. ' +
    'Return a clear, readable summary in plain text.\n\n' +
    trimmed;

  const result = await model.generateContent([{ text: prompt } as any]);
  const response = await result.response;
  const summaryText = ((response as any).text?.() as string) || '';
  const medium = (summaryText || '').trim();

  if (!medium) {
    return {
      short: '',
      medium: '',
      outline: [],
      model: resolvedModel,
    };
  }

  const sentencePieces = medium.split(/(?<=[\.\!\?])\s+|\n+/).filter((p: string) => p.trim().length > 0);
  const shortRaw = sentencePieces.slice(0, 3).join(' ');
  const short = shortRaw.length > 400 ? shortRaw.slice(0, 397) + '…' : shortRaw;

  const outlineLines = medium
    .split(/\n+/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 10);

  const outline = outlineLines.length > 0 ? outlineLines : [medium.slice(0, 200)];

  return {
    short,
    medium,
    outline,
    model: resolvedModel,
  };
};

// Multimodal analysis: Analyze image with Gemini Vision
interface VisualAnalysisResult {
  description: string;
  colors: string[];
  themes: string[];
  mood: string;
  people?: string;
  textContent?: string;
  technicalStyle: string;
  short: string;
  medium: string;
  model: string;
}

const analyzeImageWithGemini = async (
  imagePath: string,
  comprehensiveContext?: string,
  modelName?: string,
): Promise<VisualAnalysisResult> => {
  const opId = `img-analyze-${Date.now()}`;
  startOperation(opId, 'analyzeImage');

  const apiKey = store.get('geminiKey') as string | undefined;
  if (!apiKey) {
    endOperation(opId);
    throw new Error('Gemini API Key not found. Please configure it in Settings.');
  }

  // Use a multimodal-capable model, preferring 2.5 flash for speed
  const resolvedModel = resolveGeminiModelName(modelName) || 'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: resolvedModel });

  // Read and encode image - use let so we can null after use
  let imageBuffer: Buffer | null = await fs.promises.readFile(imagePath);
  const fileSizeMB = imageBuffer.length / (1024 * 1024);
  console.log('[VisualAnalysis] Image size:', fileSizeMB.toFixed(2), 'MB');

  let base64Image: string | null = imageBuffer.toString('base64');
  imageBuffer = null; // Release buffer immediately after encoding

  // Detect MIME type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  const mimeType = mimeMap[ext] || 'image/png';

  // Build context-aware prompt
  let contextSection = '';
  if (comprehensiveContext && comprehensiveContext.trim()) {
    const trimmedContext = comprehensiveContext.length > 16000 ? comprehensiveContext.slice(0, 16000) : comprehensiveContext;
    contextSection = `\n\nCONTEXT DOCUMENT (attached scroll):\n${trimmedContext}\n\nAlso analyze how this visual relates to the context document above.`;
  }

  const prompt = `Analyze this image and provide a structured analysis in the following JSON format:
{
  "description": "A detailed description of what is shown - scene, subjects, composition, action",
  "colors": ["color1", "color2", "color3"],
  "themes": ["theme1", "theme2"],
  "mood": "The overall mood or atmosphere",
  "people": "Description of any people/characters if present, or null if none",
  "textContent": "Any visible text, titles, or labels, or null if none",
  "technicalStyle": "Art style/technique (photo, illustration, 3D render, pixel art, etc.)",
  "summary": "A 2-3 sentence summary capturing the essence of this image"
}
${contextSection}

Return ONLY valid JSON, no markdown code blocks.`;

  console.log('[VisualAnalysis] Analyzing image:', imagePath);

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  // Release base64 after API call
  base64Image = null;
  hintGC();

  const response = await result.response;
  const rawText = ((response as any).text?.() as string) || '';

  // Parse JSON response
  let parsed: any = {};
  try {
    // Clean up potential markdown code blocks
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[VisualAnalysis] Failed to parse JSON response:', parseErr);
    // Fallback: use raw text as description
    parsed = {
      description: rawText.slice(0, 2000),
      colors: [],
      themes: [],
      mood: 'unknown',
      technicalStyle: 'unknown',
      summary: rawText.slice(0, 400),
    };
  }

  const description = parsed.description || '';
  const summary = parsed.summary || description.slice(0, 400);
  const shortSummary = summary.split(/[.!?]/).slice(0, 2).join('. ').trim() || summary.slice(0, 200);

  endOperation(opId);

  return {
    description,
    colors: Array.isArray(parsed.colors) ? parsed.colors : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    mood: parsed.mood || 'unknown',
    people: parsed.people || undefined,
    textContent: parsed.textContent || undefined,
    technicalStyle: parsed.technicalStyle || 'unknown',
    short: shortSummary,
    medium: summary,
    model: resolvedModel,
  };
};

// Multimodal analysis: Analyze video with Gemini
const analyzeVideoWithGemini = async (
  videoPath: string,
  comprehensiveContext?: string,
  modelName?: string,
): Promise<VisualAnalysisResult> => {
  const opId = `vid-analyze-${Date.now()}`;
  startOperation(opId, 'analyzeVideo');

  const apiKey = store.get('geminiKey') as string | undefined;
  if (!apiKey) {
    endOperation(opId);
    throw new Error('Gemini API Key not found. Please configure it in Settings.');
  }

  // Check file size - Gemini inline limit is ~20MB for videos
  const stats = await fs.promises.stat(videoPath);
  const fileSizeMB = stats.size / (1024 * 1024);

  if (fileSizeMB > 20) {
    endOperation(opId);
    throw new Error(`Video file is ${fileSizeMB.toFixed(1)}MB. Maximum supported size for inline analysis is 20MB. Please use a shorter/smaller video.`);
  }

  const resolvedModel = resolveGeminiModelName(modelName) || 'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: resolvedModel });

  // Read and encode video - use let so we can null after use
  let videoBuffer: Buffer | null = await fs.promises.readFile(videoPath);
  console.log('[VideoAnalysis] Video size:', fileSizeMB.toFixed(2), 'MB');

  let base64Video: string | null = videoBuffer.toString('base64');
  videoBuffer = null; // Release buffer immediately after encoding

  // Detect MIME type from extension
  const ext = path.extname(videoPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mpeg': 'video/mpeg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
  };
  const mimeType = mimeMap[ext] || 'video/mp4';

  // Build context-aware prompt
  let contextSection = '';
  if (comprehensiveContext && comprehensiveContext.trim()) {
    const trimmedContext = comprehensiveContext.length > 16000 ? comprehensiveContext.slice(0, 16000) : comprehensiveContext;
    contextSection = `\n\nCONTEXT DOCUMENT (attached scroll):\n${trimmedContext}\n\nAlso analyze how this video relates to the context document above.`;
  }

  const prompt = `Analyze this video (both visuals and any audio) and provide a structured analysis in the following JSON format:
{
  "description": "A detailed description of what happens in the video - scenes, subjects, action, narrative",
  "colors": ["color1", "color2", "color3"],
  "themes": ["theme1", "theme2"],
  "mood": "The overall mood or atmosphere",
  "people": "Description of any people/characters if present, or null if none",
  "textContent": "Any visible text, speech, or dialogue, or null if none",
  "technicalStyle": "Video style (live action, animation, screen recording, etc.)",
  "summary": "A 2-4 sentence summary capturing the essence of this video"
}
${contextSection}

Return ONLY valid JSON, no markdown code blocks.`;

  console.log('[VideoAnalysis] Analyzing video:', videoPath, `(${fileSizeMB.toFixed(1)}MB)`);

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Video,
      },
    },
  ]);

  // Release base64 after API call
  base64Video = null;
  hintGC();

  const response = await result.response;
  const rawText = ((response as any).text?.() as string) || '';

  // Parse JSON response
  let parsed: any = {};
  try {
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[VideoAnalysis] Failed to parse JSON response:', parseErr);
    parsed = {
      description: rawText.slice(0, 2000),
      colors: [],
      themes: [],
      mood: 'unknown',
      technicalStyle: 'unknown',
      summary: rawText.slice(0, 400),
    };
  }

  const description = parsed.description || '';
  const summary = parsed.summary || description.slice(0, 400);
  const shortSummary = summary.split(/[.!?]/).slice(0, 2).join('. ').trim() || summary.slice(0, 200);

  endOperation(opId);

  return {
    description,
    colors: Array.isArray(parsed.colors) ? parsed.colors : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    mood: parsed.mood || 'unknown',
    people: parsed.people || undefined,
    textContent: parsed.textContent || undefined,
    technicalStyle: parsed.technicalStyle || 'unknown',
    short: shortSummary,
    medium: summary,
    model: resolvedModel,
  };
};

// Helper: Get scroll text from attached scroll cards
const getScrollContextForCard = async (cardRecord: any): Promise<string> => {
  if (!cardRecord.scrolls || !Array.isArray(cardRecord.scrolls) || cardRecord.scrolls.length === 0) {
    return '';
  }

  const scrollTexts: string[] = [];

  for (const scroll of cardRecord.scrolls) {
    if (!scroll.cardId || !scroll.includeInSummarization) continue;

    try {
      const scrollRecords = await readCore(scroll.cardId);
      if (!Array.isArray(scrollRecords) || scrollRecords.length === 0) continue;

      // Find the card record in the scroll's Hypercore
      let scrollCardRecord: any = null;
      for (let i = scrollRecords.length - 1; i >= 0; i--) {
        const raw = scrollRecords[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind)) {
            scrollCardRecord = parsed;
            break;
          }
        } catch { /* ignore */ }
      }

      if (!scrollCardRecord) continue;

      // Get text content from scroll card
      const scrollMediaType = scrollCardRecord.mediaType || '';
      const scrollIngest = scrollCardRecord.wormhole?.ingest;
      const scrollOriginalPath = scrollIngest?.originalPath;

      if (scrollOriginalPath && (scrollMediaType === 'text' || scrollMediaType === 'markdown')) {
        try {
          const scrollText = await fs.promises.readFile(scrollOriginalPath, 'utf-8');
          if (scrollText.trim()) {
            const label = scroll.label || scrollCardRecord.title || scroll.cardId;
            scrollTexts.push(`--- ${label} ---\n${scrollText.trim()}`);
          }
        } catch { /* ignore read errors */ }
      }
    } catch (err) {
      console.warn('[Scroll] Failed to read scroll card:', scroll.cardId, err);
    }
  }

  if (scrollTexts.length === 0) return '';

  // Combine and cap at 32KB
  const combined = scrollTexts.join('\n\n');
  return combined.length > 32000 ? combined.slice(0, 32000) + '\n[...truncated]' : combined;
};

// Helper: Build comprehensive context for LLM analysis
// Includes: scroll text, existing summaries, image prompts, video prompts, derivatives info
const buildComprehensiveContext = async (cardRecord: any, cardId: string): Promise<string> => {
  const contextParts: string[] = [];

  // 1. Scroll context
  const scrollText = await getScrollContextForCard(cardRecord);
  if (scrollText) {
    contextParts.push(`=== ATTACHED SCROLLS ===\n${scrollText}`);
  }

  // 2. Existing summaries (from previous runs)
  if (cardRecord.summaries && Array.isArray(cardRecord.summaries)) {
    const latestSummary = cardRecord.summaries.find((s: any) => s.kind === 'medium' || s.kind === 'visual-analysis');
    if (latestSummary && latestSummary.text) {
      contextParts.push(`=== EXISTING SUMMARY ===\n${latestSummary.text}`);
    }
    // Include visual analysis details if present
    const visualAnalysis = cardRecord.summaries.find((s: any) => s.kind === 'visual-analysis');
    if (visualAnalysis) {
      const details: string[] = [];
      if (visualAnalysis.description) details.push(`Description: ${visualAnalysis.description}`);
      if (visualAnalysis.colors?.length) details.push(`Colors: ${visualAnalysis.colors.join(', ')}`);
      if (visualAnalysis.themes?.length) details.push(`Themes: ${visualAnalysis.themes.join(', ')}`);
      if (visualAnalysis.mood) details.push(`Mood: ${visualAnalysis.mood}`);
      if (visualAnalysis.people) details.push(`People: ${visualAnalysis.people}`);
      if (visualAnalysis.textContent) details.push(`Visible Text: ${visualAnalysis.textContent}`);
      if (visualAnalysis.technicalStyle) details.push(`Style: ${visualAnalysis.technicalStyle}`);
      if (details.length > 0) {
        contextParts.push(`=== VISUAL ANALYSIS ===\n${details.join('\n')}`);
      }
    }
  }

  // 3. Image generation prompts (from card or derived images)
  if (cardRecord.imagePrompt) {
    contextParts.push(`=== IMAGE GENERATION PROMPT ===\n${cardRecord.imagePrompt}`);
  }
  if (cardRecord.prompt) {
    contextParts.push(`=== GENERATION PROMPT ===\n${cardRecord.prompt}`);
  }

  // 4. Video generation prompts
  if (cardRecord.videoPrompt) {
    contextParts.push(`=== VIDEO GENERATION PROMPT ===\n${cardRecord.videoPrompt}`);
  }

  // 5. Check for children/derivatives and include their prompts
  if (cardRecord.children && Array.isArray(cardRecord.children)) {
    for (const child of cardRecord.children) {
      if (!child.cardId) continue;
      try {
        const childRecords = await readCore(child.cardId);
        if (!Array.isArray(childRecords) || childRecords.length === 0) continue;

        for (let i = childRecords.length - 1; i >= 0; i--) {
          const raw = childRecords[i];
          if (!raw || typeof raw !== 'string') continue;
          try {
            const childData = JSON.parse(raw);
            if (childData) {
              if (childData.imagePrompt) {
                contextParts.push(`=== DERIVED IMAGE PROMPT (${child.type || 'image'}) ===\n${childData.imagePrompt}`);
              }
              if (childData.videoPrompt || childData.prompt) {
                contextParts.push(`=== DERIVED VIDEO PROMPT (${child.type || 'video'}) ===\n${childData.videoPrompt || childData.prompt}`);
              }
              break; // Only need latest record from child
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
  }

  // 6. Title and metadata
  if (cardRecord.title || cardRecord.name) {
    contextParts.push(`=== CARD TITLE ===\n${cardRecord.title || cardRecord.name}`);
  }

  if (contextParts.length === 0) return '';

  const combined = contextParts.join('\n\n');
  // Cap at 48KB to leave room for the main content
  return combined.length > 48000 ? combined.slice(0, 48000) + '\n[...context truncated]' : combined;
};

const extractKeyTermsWithGemini = async (
  text: string,
  modelName?: string,
): Promise<{ terms: { term: string; type?: string; confidence?: number }[]; model: string }> => {
  const apiKey = store.get('geminiKey') as string | undefined;
  if (!apiKey) {
    throw new Error('Gemini API Key not found. Please configure it in Settings.');
  }

  const resolvedModel = resolveGeminiModelName(modelName);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: resolvedModel });

  const trimmed = text.length > 16000 ? text.slice(0, 16000) : text;
  const prompt =
    'Extract up to 30 key entities, concepts, or topics from the following content. ' +
    'Return them as a plain text list, one item per line. ' +
    'Optionally include a short type in parentheses, e.g. "Hapa AI (project)".\n\n' +
    trimmed;

  const result = await model.generateContent([{ text: prompt } as any]);
  const response = await result.response;
  const raw = (((response as any).text?.() as string) || '').trim();

  if (!raw) {
    return { terms: [], model: resolvedModel };
  }

  const lines = raw
    .split(/\r?\n+/)
    .map((line: string) => line.replace(/^[-*\d\.\)\s]+/, '').trim())
    .filter((line: string) => line.length > 0);

  const terms = lines.slice(0, 30).map((line: string) => {
    let term = line;
    let type: string | undefined;

    const match = line.match(/^(.*?)[\s]*\(([^)]+)\)[\s]*$/);
    if (match) {
      term = match[1].trim();
      type = match[2].trim();
    }

    return { term, type } as { term: string; type?: string; confidence?: number };
  });

  return { terms, model: resolvedModel };
};

const getAppIconPath = () => {
  const base = isDev ? '../public' : '../dist-renderer';
  return path.join(__dirname, base, 'Paramation_Logo.png');
};

const toFileUrl = (p: string) => {
  const normalized = String(p || '').replace(/\\/g, '/');
  return `file:///${encodeURI(normalized)}`;
};

const getVibesDir = () => {
  const candidates = [
    path.join(app.getAppPath(), '.vibes'),
    path.join(process.cwd(), '.vibes'),
    path.join(__dirname, '..', '.vibes'),
    path.join(__dirname, '..', '..', '.vibes'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      // ignore
    }
  }
  return null;
};

const getVibesVideoUrls = () => {
  const dir = getVibesDir();
  if (!dir) return [];
  try {
    const names = fs
      .readdirSync(dir)
      .filter((n) => /\.(mp4|webm)$/i.test(n))
      .slice(0, 500);

    const withSize = names
      .map((n) => {
        const full = path.join(dir, n);
        try {
          const st = fs.statSync(full);
          return { full, size: st.size };
        } catch {
          return { full, size: Number.POSITIVE_INFINITY };
        }
      })
      .filter((x) => Number.isFinite(x.size))
      .sort((a, b) => a.size - b.size)
      .slice(0, 20)
      .map((x) => toFileUrl(x.full));

    return withSize;
  } catch {
    return [];
  }
};

const buildSplashHtml = (videoUrls: string[]) => {
  const urls = Array.isArray(videoUrls) ? videoUrls.filter(Boolean) : [];
  const urlsJson = JSON.stringify(urls);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hapa Boot</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #000; overflow: hidden; }
      #wrap { position: fixed; inset: 0; display: grid; place-items: center; background: radial-gradient(circle at 50% 50%, rgba(0,255,255,0.08), rgba(0,0,0,1) 60%); }
      video { width: 100vw; height: 100vh; object-fit: cover; background: #000; }
      #hud { position: fixed; left: 24px; bottom: 18px; font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(180,255,255,0.8); }
      #hud2 { position: fixed; left: 24px; bottom: 2px; font: 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color: rgba(255,255,255,0.35); }
    </style>
  </head>
  <body>
    <div id="wrap">
      <video id="v" autoplay muted playsinline></video>
      <div id="hud">LOADING…</div>
      <div id="hud2">HAPA</div>
    </div>
    <script>
      const urls = ${urlsJson};
      const v = document.getElementById('v');
      let idx = 0;
      const pick = () => {
        if (!urls.length) return null;
        idx = (idx + 1) % urls.length;
        return urls[idx];
      };
      const play = (u) => {
        if (!u) return;
        try {
          v.src = u;
          v.load();
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } catch {}
      };
      v.addEventListener('ended', () => play(pick()));
      if (urls.length) {
        idx = Math.floor(Math.random() * urls.length);
        play(urls[idx]);
      } else {
        document.getElementById('hud2').textContent = 'NO .VIBES VIDEOS FOUND';
      }
      setInterval(() => {
        if (!urls.length) return;
        if (!v.paused) return;
        play(pick());
      }, 1200);
    </script>
  </body>
</html>`;
};

const maybeShowMain = () => {
  if (!mainWindow) return;
  if (!rendererBootReady) return;
  if (!mainReadyToShow) return;

  try {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  } catch {
    // ignore
  }
  splashWindow = null;

  try {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  } catch {
    // ignore
  }
};

function createSplashWindow() {
  if (HAPA_STRESS_HEADLESS) {
    throw new Error('Headless stress mode');
  }
  const videos = getVibesVideoUrls();
  const html = buildSplashHtml(videos);
  const splash = new BrowserWindow({
    width: 980,
    height: 620,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    show: true,
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  splash.loadURL(dataUrl);
  return splash;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true, // Enable <webview> for portal cards
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#000000',
  });

  mainWindow = win;
  mainReadyToShow = false;
  win.once('ready-to-show', () => {
    mainReadyToShow = true;
    maybeShowMain();
  });

  // Add F12 keyboard shortcut to toggle dev tools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Renderer] render-process-gone:', details);
  });

  win.webContents.on('unresponsive', () => {
    console.error('[Renderer] unresponsive');
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Renderer] did-fail-load:', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = `[RendererConsole:${level}]`;
    if (sourceId && line) {
      console.error(prefix, message, `(${sourceId}:${line})`);
      return;
    }
    console.error(prefix, message);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[Renderer] did-finish-load:', win.webContents.getURL());

    if (HAPA_STRESS_MEMORY) {
      runMemoryStressTest(win).catch((err) => {
        console.error('[StressTest] Failed:', err);
      });
    }
  });

  // Strip X-Frame-Options and CSP frame-ancestors headers to allow embedding external sites
  // This enables portal cards to embed any website regardless of their framing policies
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};

    // Remove headers that block iframe embedding (case-insensitive)
    const headersToRemove = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only'];
    for (const key of Object.keys(headers)) {
      if (headersToRemove.includes(key.toLowerCase())) {
        delete headers[key];
      }
    }

    callback({ responseHeaders: headers });
  });

  // Handle webview permissions for portal cards
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow common permissions for embedded sites
    const allowedPermissions = ['media', 'geolocation', 'notifications', 'midi', 'pointerLock', 'fullscreen', 'clipboard-read'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  if (HAPA_STRESS_HEADLESS) {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hapa Stress Headless</title>
  </head>
  <body style="background:#000;color:#0ff;font-family:monospace;">
    <div>Hapa Stress Headless Mode</div>
    <script>
      window.__HAPA_STRESS_HEADLESS__ = true;
    </script>
  </body>
</html>`;
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    win.loadURL(dataUrl);
  } else if (isDev) {
    const devUrl =
      process.env.VITE_DEV_SERVER_URL ||
      process.env.ELECTRON_RENDERER_URL ||
      'http://localhost:5173';
    win.loadURL(devUrl);
    // win.webContents.openDevTools(); // Use F12 to toggle
  } else {
    win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }

  // Initialize Pipeline Manager
  initPipeline(win);

  // Initialize Thor's Hamma Manager
  thorsHammaManager.setWindow(win);
  ipcMain.handle('thor:process-url', async (event, { url, handCards }) => {
    return thorsHammaManager.processUrl(url, handCards);
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Settings IPC handlers
  ipcMain.handle('get-settings', () => {
    const wormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};
    const settingsObj = (store.get('settings') as any) || {};
    return {
      geminiKey: store.get('geminiKey', ''),
      openaiKey: store.get('openaiKey', ''),
      aimlapiKey: settingsObj.aimlapiKey || '',
      firebaseConfig: store.get('firebaseConfig', ''),
      revidKey: store.get('revidKey', ''),
      wormhole,
    };
  });

  ipcMain.handle(
    'save-settings',
    (
      _event,
      settings: {
        geminiKey: string;
        openaiKey: string;
        aimlapiKey: string;
        firebaseConfig: string;
        revidKey: string;
        wormhole?: any;
      },
    ) => {
      store.set('geminiKey', settings.geminiKey);
      store.set('openaiKey', settings.openaiKey);
      store.set('firebaseConfig', settings.firebaseConfig);
      store.set('revidKey', settings.revidKey);
      store.set(WORMHOLE_SETTINGS_KEY, settings.wormhole || {});
      
      // Save AIMLAPI key under 'settings' object (where AimlApiClient reads it from)
      const existingSettings = store.get('settings') as any || {};
      existingSettings.aimlapiKey = settings.aimlapiKey;
      store.set('settings', existingSettings);
      
      return true;
    },
  );

  // Llama runtime settings & status
  ipcMain.handle('get-llama-settings', () => {
    return getLlamaSettingsInternal();
  });

  ipcMain.handle(
    'save-llama-settings',
    (_event, settings: LlamaSettingsInternal) => {
      const next: LlamaSettingsInternal = {
        serverPath: settings.serverPath || '',
        modelsDir: settings.modelsDir || path.join(app.getPath('userData'), 'llama-models'),
        defaultModel: settings.defaultModel || '',
        port: typeof settings.port === 'number' && settings.port > 0 ? settings.port : 8080,
        autoStart: settings.autoStart === true,
        favorites: Array.isArray(settings.favorites) ? settings.favorites : [],
      };
      saveLlamaSettingsInternal(next);
      return true;
    },
  );

  ipcMain.handle('get-llama-status', () => {
    return getLlamaStatusInternal();
  });

  ipcMain.handle('start-llama-server', async () => {
    return startLlamaServerInternal();
  });

  ipcMain.handle('stop-llama-server', () => {
    return stopLlamaServerInternal();
  });

  ipcMain.handle('list-llama-local-models', async () => {
    return listLlamaLocalModelsInternal();
  });

  ipcMain.handle(
    'delete-llama-model',
    async (
      _event,
      payload: {
        path: string;
      },
    ) => {
      if (!payload || !payload.path) {
        throw new Error('Model path is required.');
      }
      await deleteLlamaModelInternal(payload.path);
      return true;
    },
  );

  ipcMain.handle(
    'download-llama-model',
    async (
      _event,
      payload: {
        url: string;
        fileName?: string;
      },
    ) => {
      const { url, fileName } = payload || ({} as any);
      if (!url || typeof url !== 'string') {
        throw new Error('Model URL is required.');
      }

      const settings = getLlamaSettingsInternal();
      const destDir = settings.modelsDir;
      await fs.promises.mkdir(destDir, { recursive: true });

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error('Invalid model URL.');
      }

      const finalName =
        typeof fileName === 'string' && fileName.trim().length > 0
          ? fileName.trim()
          : path.basename(parsedUrl.pathname) || 'model.gguf';

      const destPath = path.join(destDir, finalName);

      await new Promise<void>((resolve, reject) => {
        const client = parsedUrl.protocol === 'http:' ? http : https;
        const request = client.get(parsedUrl, (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            response.resume();
            return;
          }

          const fileStream = fs.createWriteStream(destPath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve());
          });

          fileStream.on('error', (err) => {
            fileStream.close(() => reject(err));
          });
        });

        request.on('error', (err) => {
          reject(err);
        });
      });

      return { path: destPath };
    },
  );

  ipcMain.handle(
    'hf-search-gguf-models',
    async (
      _event,
      payload: {
        query: string;
      },
    ) => {
      const { query } = payload || ({} as any);
      if (!query || typeof query !== 'string') {
        return [];
      }
      return searchHfGGUFModelsInternal(query);
    },
  );

  // --- Local Vision IPC Handlers ---

  ipcMain.handle('get-local-vision-settings', () => {
    return getLocalVisionSettingsInternal();
  });

  ipcMain.handle(
    'save-local-vision-settings',
    (_event, settings: LocalVisionSettingsInternal) => {
      saveLocalVisionSettingsInternal(settings);
      return true;
    }
  );

  ipcMain.handle('get-local-vision-status', () => {
    return getLocalVisionStatusInternal();
  });

  ipcMain.handle('start-local-vision', async () => {
    return startVisionServerInternal();
  });

  ipcMain.handle('stop-local-vision', () => {
    return stopVisionServerInternal();
  });

  ipcMain.handle('list-vision-models', async () => {
    const status = getLocalVisionStatusInternal();
    if (!status.running || !status.port) {
      throw new Error('Vision server is not running.');
    }
    const settings = getLocalVisionSettingsInternal();
    const params = new URLSearchParams();
    if (settings.modelsDir) {
      params.set('cache_dir', settings.modelsDir);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${status.port}/models?${params.toString()}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      return await response.json();
    } catch (e: any) {
      throw new Error(`Failed to list models: ${e.message}`);
    }
  });

  ipcMain.handle('download-vision-model', async (_event, payload: { repo_id: string; variant?: string }) => {
    const status = getLocalVisionStatusInternal();
    if (!status.running || !status.port) {
      throw new Error('Vision server is not running.');
    }
    if (!payload.repo_id) throw new Error('repo_id is required');

    const settings = getLocalVisionSettingsInternal();

    try {
      const response = await fetch(`http://127.0.0.1:${status.port}/models/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: payload.repo_id,
          cache_dir: settings.modelsDir,
          variant: payload.variant
        })
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      return await response.json();
    } catch (e: any) {
      throw new Error(`Failed to trigger download: ${e.message}`);
    }
  });

  ipcMain.handle('generate-local-image', async (_event, payload: any) => {
    const status = getLocalVisionStatusInternal();
    if (!status.running || !status.port) {
      throw new Error('Vision server is not running.');
    }
    try {
      const response = await fetch(`http://127.0.0.1:${status.port}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Generation failed: ${errText}`);
      }
      return await response.json();
    } catch (e: any) {
      throw new Error(`Failed to generate image: ${e.message}`);
    }
  });

  ipcMain.handle(
    'revid-estimate-credits',
    async (
      _event,
      payload: {
        creationParams: any;
      },
    ) => {
      const { creationParams } = payload || ({} as any);
      if (!creationParams) {
        throw new Error('creationParams are required for Revid credits estimation.');
      }
      return callRevidApi('/calculate-credits', 'POST', { creationParams });
    },
  );

  ipcMain.handle(
    'revid-render',
    async (
      _event,
      payload: {
        webhook?: string;
        resolution?: string;
        compression?: number;
        frameRate?: number;
        creationParams: any;
      },
    ) => {
      if (!payload || !payload.creationParams) {
        throw new Error('creationParams are required to render a Revid video.');
      }
      return callRevidApi('/render', 'POST', payload);
    },
  );

  ipcMain.handle(
    'revid-get-status',
    async (
      _event,
      payload: {
        pid: string;
      },
    ) => {
      const { pid } = payload || ({} as any);
      if (!pid || typeof pid !== 'string') {
        throw new Error('pid is required to get Revid project status.');
      }
      return callRevidApi(`/status?pid=${encodeURIComponent(pid)}`, 'GET');
    },
  );

  ipcMain.handle(
    'revid-list-projects',
    async (
      _event,
      payload: {
        limit?: number;
      },
    ) => {
      const { limit } = payload || ({} as any);
      const safeLimit =
        typeof limit === 'number' && limit > 0 && limit <= 50 ? limit : 10;
      return callRevidApi(`/projects?limit=${safeLimit}`, 'GET');
    },
  );

  ipcMain.handle(
    'revid-search-media',
    async (
      _event,
      payload: {
        search?: string;
        mediaType?: string;
        topK?: number;
      },
    ) => {
      const { search, mediaType, topK } = payload || ({} as any);

      const params = new URLSearchParams();
      if (typeof search === 'string' && search.trim()) {
        params.set('search', search.trim());
      }
      if (typeof mediaType === 'string' && mediaType && mediaType !== 'all') {
        params.set('mediaType', mediaType);
      }
      const safeTopK =
        typeof topK === 'number' && topK > 0
          ? Math.min(Math.max(topK, 1), 100)
          : 50;
      params.set('topK', String(safeTopK));

      const query = params.toString();
      const pathWithQuery = query ? `/media-search?${query}` : '/media-search';
      const data = await callRevidMediaApi(pathWithQuery);

      const rawResults = Array.isArray(data?.results) ? data.results : [];
      const normalized: RevidMediaItemInternal[] = [];
      for (const raw of rawResults) {
        const item = normalizeRevidMediaItem(raw);
        if (item) normalized.push(item);
      }

      return {
        results: normalized,
        count: typeof data?.count === 'number' ? data.count : normalized.length,
      };
    },
  );

  ipcMain.handle(
    'revid-download-media',
    async (
      _event,
      payload: { mediaUrl: string; id: string; type?: string; fileType?: string },
    ) => {
      const { mediaUrl, id, type, fileType } = payload || ({} as any);
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        throw new Error('mediaUrl is required to download Revid media.');
      }
      if (!id || typeof id !== 'string') {
        throw new Error('id is required to download Revid media.');
      }
      return downloadRevidMediaInternal({ mediaUrl, id, type, fileType });
    },
  );

  // OpenAI realtime audio sessions (prototype)
  ipcMain.handle('openai-audio-start-session', () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: OpenAIAudioSession = {
      id,
      createdAt: new Date().toISOString(),
      fullText: '',
    };
    openAIAudioSessions.set(id, session);
    return { sessionId: id };
  });

  ipcMain.handle(
    'openai-audio-append-chunk',
    async (
      _event,
      payload: {
        sessionId: string;
        base64: string;
        mimeType: string;
      },
    ) => {
      const { sessionId, base64, mimeType } = payload || ({} as any);
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Audio sessionId is required.');
      }
      const session = openAIAudioSessions.get(sessionId);
      if (!session) {
        throw new Error('Audio session not found.');
      }

      const apiKey = store.get('openaiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('OpenAI API Key not found. Please configure it in Settings.');
      }

      try {
        const text = (await transcribeAudioWithOpenAI(base64, mimeType, apiKey)).trim();
        if (!text) {
          return { sessionId, delta: '', fullText: session.fullText };
        }

        const separator = session.fullText ? ' ' : '';
        const fullText = `${session.fullText}${separator}${text}`;
        session.fullText = fullText;
        openAIAudioSessions.set(sessionId, session);

        broadcastAudioTranscript(sessionId, text, fullText);

        return { sessionId, delta: text, fullText };
      } catch (error: any) {
        console.error('OpenAI audio chunk transcription failed:', error);
        throw new Error(error?.message || 'Failed to transcribe audio chunk');
      }
    },
  );

  ipcMain.handle(
    'openai-audio-stop-session',
    (_event, payload: { sessionId: string }) => {
      const { sessionId } = payload || ({} as any);
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Audio sessionId is required.');
      }
      const session = openAIAudioSessions.get(sessionId);
      if (!session) {
        return { sessionId, fullText: '' };
      }
      openAIAudioSessions.delete(sessionId);
      return { sessionId, fullText: session.fullText };
    },
  );

  ipcMain.handle('get-admin-settings', () => {
    return getAdminSettings();
  });

  ipcMain.handle(
    'save-admin-settings',
    (_event, settings: Partial<AdminSettings>) => {
      saveAdminSettings(settings);
      return true;
    },
  );

  // Media download handler
  ipcMain.handle('save-media', async (_event, { mediaPath, suggestedFilename, mediaType }: { mediaPath: string; suggestedFilename?: string; mediaType?: 'image' | 'video' }) => {
    try {
      const { dialog } = require('electron');

      // Determine file extension from media type or filename
      const ext = mediaType === 'video' ? '.mp4' : '.png';
      const defaultFilename = suggestedFilename || `hapa_${Date.now()}${ext}`;

      // Show save dialog
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Media',
        defaultPath: defaultFilename,
        filters: mediaType === 'video'
          ? [{ name: 'Video Files', extensions: ['mp4', 'mov', 'webm'] }]
          : [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Read the media file
      let sourceFile = mediaPath;
      // If it's a file:// URL, strip the protocol
      if (sourceFile.startsWith('file://')) {
        sourceFile = sourceFile.substring(7);
      }

      // Copy the file to the chosen location
      await fs.promises.copyFile(sourceFile, filePath);

      console.log('[Media Download] Saved to:', filePath);
      return { success: true, path: filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Media Download] Error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // Media export handler - saves directly to configured directory
  ipcMain.handle('export-media', async (_event, { mediaPath, fileName, mediaType }: { mediaPath: string; fileName: string; mediaType?: 'image' | 'video' }) => {
    try {
      // Get export directory from admin settings
      const adminSettings = (store.get('adminSettings') || {}) as any;
      const exportDir = adminSettings.exportDirectory || path.join(app.getPath('downloads'), 'HapaExports');

      // Ensure export directory exists
      await fs.promises.mkdir(exportDir, { recursive: true });

      // Prepare source file
      let sourceFile = mediaPath;
      if (sourceFile.startsWith('file://')) {
        sourceFile = sourceFile.substring(7);
      }

      // Create destination path
      const destPath = path.join(exportDir, fileName);

      // Copy file to export directory
      await fs.promises.copyFile(sourceFile, destPath);

      console.log('[Media Export] Exported to:', destPath);
      return { success: true, path: destPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Media Export] Error:', error);
      return { success: false, error: errorMessage };
    }
  });


  // Bulk export all media handler - processes all cards in background
  ipcMain.handle('export-all-media', async (_event) => {
    try {
      console.log('[Bulk Export] Starting bulk media export...');

      // Get admin settings for export directory
      const adminSettings = (store.get('adminSettings') || {}) as any;
      const exportDir = adminSettings.exportDirectory || path.join(app.getPath('downloads'), 'HapaExports');

      // Ensure export directory exists
      await fs.promises.mkdir(exportDir, { recursive: true });

      // Get all cards directly from Hypercore source of truth
      const rawItems = await readCore(CARD_LIBRARY_CORE_NAME);
      const cardMap = new Map();

      // Deduplicate cards (last write wins)
      for (const raw of rawItems) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const data = JSON.parse(raw);
          if (data && (data.cardId || data.id)) {
            const id = data.cardId || data.id;
            cardMap.set(id, data);
          }
        } catch { }
      }

      console.log(`[Bulk Export] Found ${cardMap.size} unique cards in index`);

      const cardsWithMedia: Array<{ cardId: string; name: string; metadata: any }> = [];

      for (const data of cardMap.values()) {
        const cardId = data.cardId || data.id;
        const name = data.name || 'Untitled';

        const cardData = data.cardData || {};
        const mediaPrompts = data.mediaPrompts || cardData.mediaPrompts || {};

        const possiblePaths = [
          data.mediaLocalPath,
          data.thumbnail,
          cardData.mediaLocalPath,
          cardData.image?.localPath,
          cardData.video?.localPath,
          mediaPrompts.generated_image_local,
          mediaPrompts.generated_video_local
        ].filter(p => p && typeof p === 'string' && !p.startsWith('http'));

        if (possiblePaths.length > 0) {
          const mainPath = possiblePaths[0];
          cardsWithMedia.push({
            cardId,
            name,
            metadata: {
              mediaLocalPath: mainPath,
              mediaKind: data.mediaKind || (mainPath.endsWith('.mp4') ? 'video' : 'image'),
              coreDiscoveryKey: data.coreDiscoveryKey
            }
          });
        }
      }

      console.log(`[Bulk Export] Found ${cardsWithMedia.length} cards with media`);

      // Process exports in background (async, non-blocking)
      setImmediate(async () => {
        let exported = 0;
        let failed = 0;

        for (const card of cardsWithMedia) {
          try {
            const metadata = card.metadata || {};
            const imgPath = metadata.generated_image_local || metadata.mediaLocalPath || metadata.thumbnail;

            if (!imgPath) continue;

            // Generate detailed filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const cardId = card.cardId || 'unknown';
            const hypercoreDID = metadata.coreDiscoveryKey || 'no-did';
            // Truncate name to avoid Windows MAX_PATH issues
            const cardName = (card.name || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);

            // Determine file extension
            const isVideo = metadata.mediaKind === 'video';
            const ext = isVideo ? '.mp4' : '.png';

            const fileName = `${cardName}_${timestamp}_${cardId}_${hypercoreDID}${ext}`;

            // Prepare source file
            let sourceFile = imgPath;
            if (sourceFile.startsWith('file://')) {
              sourceFile = sourceFile.substring(7);
            }

            // Create destination path
            const destPath = path.join(exportDir, fileName);

            // Copy file
            await fs.promises.copyFile(sourceFile, destPath);
            exported++;

            // Log progress every 10 files
            if (exported % 10 === 0) {
              console.log(`[Bulk Export] Progress: ${exported}/${cardsWithMedia.length}`);
            }
          } catch (error) {
            console.error(`[Bulk Export] Failed to export card ${card.cardId}:`, error);
            failed++;
          }
        }

        console.log(`[Bulk Export] Complete! Exported: ${exported}, Failed: ${failed}`);
      });

      // Return immediately with queue info
      return { success: true, totalCards: cardsWithMedia.length, exportDir };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Bulk Export] Error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // Save Prototype Handler
  ipcMain.handle('save-prototype', async (_event, { title, content }: { title: string; content: string }) => {
    try {
      console.log(`[Save Prototype] Saving: ${title}`);

      // 1. Save HTML file locally
      const prototypesDir = path.join(app.getPath('userData'), 'prototypes');
      await fs.promises.mkdir(prototypesDir, { recursive: true });
      const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.html`;
      const filePath = path.join(prototypesDir, filename);
      await fs.promises.writeFile(filePath, content, 'utf8');
      console.log(`[Save Prototype] File written: ${filePath}`);

      // 2. Create Card Core
      const crypto = require('crypto');
      const cardId = crypto.randomUUID();
      const cardCoreName = `card-${cardId}`;

      // Create the core (ensure p2p module functions are available)
      await createCore(cardCoreName);

      // Construct Card Record
      const cardRecord = {
        id: cardId,
        type: 'prototype',
        title: title,
        description: 'AI Generated Prototype',
        createdAt: Date.now(),
        mediaLocalPath: filePath, // Normalized path
        mediaKind: 'html',
        tags: ['prototype', 'html', 'ui', 'generated'],
        cardData: {
          htmlPath: filePath,
          htmlContent: content,
          source: 'hapa-forge'
        }
      };

      // Write to Card Core
      await appendToCore(cardCoreName, JSON.stringify(cardRecord));

      // 3. Add to Card Library Index
      // Get the key (we might need to read core props, but appendToCore usually handles it if we don't need key immediately)
      // Actually we want the key for the index. 
      // We can just put coreName in index, the p2p logic handles resolving.

      const indexEntry = {
        cardId: cardId,
        coreName: cardCoreName,
        // coreDiscoveryKey: ... (optional if using name resolution)
        name: title,
        mediaLocalPath: filePath,
        mediaKind: 'html',
        timestamp: Date.now(),
        cardData: cardRecord
      };

      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(indexEntry));
      console.log(`[Save Prototype] Card created: ${cardId}`);

      return { success: true, cardId, filePath };
    } catch (error) {
      console.error('[Save Prototype] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });


  // Vertex AI Settings handlers
  ipcMain.handle('get-vertex-ai-settings', () => {
    const { getVertexAISettings } = require('./vertexai');
    return getVertexAISettings();
  });

  ipcMain.handle('save-vertex-ai-settings', (_event, settings: any) => {
    const { saveVertexAISettings, resetVertexAIClient } = require('./vertexai');
    saveVertexAISettings(settings);
    resetVertexAIClient(); // Reset client to pick up new settings
    return true;
  });

  ipcMain.handle('test-vertex-ai-connection', async () => {
    const { getVertexAIClient, isVertexAIConfigured } = require('./vertexai');
    if (!isVertexAIConfigured()) {
      return { success: false, message: 'Vertex AI is not configured. Please enter Project ID and API Key.' };
    }
    const client = getVertexAIClient();
    return await client.testConnection();
  });

  ipcMain.handle('get-vertex-ai-models', () => {
    const { MODEL_SHORTHAND_MAP, MODEL_DISPLAY_NAMES, VERTEX_REGIONS } = require('./vertexai');
    return {
      models: Object.entries(MODEL_SHORTHAND_MAP).map(([shorthand, modelId]) => ({
        shorthand,
        modelId,
        displayName: MODEL_DISPLAY_NAMES[shorthand] || shorthand,
      })),
      regions: VERTEX_REGIONS,
    };
  });

  // Generate image for a card using LLM to craft prompt, then image model
  ipcMain.handle(
    'generate-image-for-card',
    async (
      _event,
      {
        cardContext,
        seriesContext,
        provider = 'gemini', // Default to Gemini
      }: {
        cardContext: {
          name: string;
          mediaKind?: string;
          text?: string;
          tags?: string[];
          messageContent?: string;
          image?: string; // Base64 data for multimodal context
          mimeType?: string;
        };
        seriesContext?: {
          imageNumber: number;           // Which image in the series (1, 2, 3...)
          previousPrompt?: string;       // Previous LLM-crafted prompt
          previousImagePath?: string;    // Path to previous image (for potential future use)
        };
        provider?: 'gemini' | 'local-vision';
      },
    ) => {
      const opId = `img-gen-${Date.now()}`;
      startOperation(opId, 'generateImage');
      logMemory('ImageGen Start');

      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey && provider === 'gemini') {
        endOperation(opId);
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      const adminSettings = getAdminSettings();
      const imageGenSettings = adminSettings.imageGenSettings || {
        defaultImageModel: 'gemini-2.0-flash-exp', // Updated to a valid model that supports image gen
        defaultPromptLLM: 'gemini-2.5-flash', // Fast flash model
      };

      const imageNumber = seriesContext?.imageNumber || 1;
      const isSeriesContinuation = imageNumber > 1 && seriesContext?.previousPrompt;

      console.log('[ImageGen] Starting image generation for card:', cardContext.name);
      console.log('[ImageGen] Provider:', provider);
      console.log('[ImageGen] Image #', imageNumber, isSeriesContinuation ? '(series continuation)' : '(first image)');
      console.log('[ImageGen] Using LLM:', imageGenSettings.defaultPromptLLM);
      if (cardContext.image) console.log('[ImageGen] Including Input Image for Multimodal Context');

      try {
        // Step 1: Craft image prompt using LLM (always done)
        const contentParts: string[] = [];

        if (cardContext.name && cardContext.name !== 'Untitled') {
          contentParts.push(`Title: ${cardContext.name}`);
        }

        if (cardContext.text) {
          // Truncate to reasonable length for LLM
          const truncatedText = cardContext.text.length > 2000
            ? cardContext.text.substring(0, 2000) + '...'
            : cardContext.text;
          contentParts.push(`Content/Request:\n${truncatedText}`);
        }

        if (cardContext.messageContent) {
          contentParts.push(`Message: ${cardContext.messageContent}`);
        }

        if (cardContext.tags && cardContext.tags.length > 0) {
          contentParts.push(`Key Terms/Tags: ${cardContext.tags.slice(0, 30).join(', ')}`);
        }

        const contextSummary = contentParts.length > 0
          ? contentParts.join('\n\n')
          : `Card Type: ${cardContext.mediaKind || 'document'}\nTitle: ${cardContext.name || 'Untitled'}`;

        // Build prompt based on whether this is a series continuation or first image
        let promptCraftingRequest: string;

        if (isSeriesContinuation && seriesContext?.previousPrompt) {
          // Series continuation - build on previous image
          promptCraftingRequest = `
You are crafting image #${imageNumber} in a visual series representing this content.

PREVIOUS IMAGE (#${imageNumber - 1}) was created with this prompt:
"${seriesContext.previousPrompt}"

Now create a NEW, DIFFERENT prompt for image #${imageNumber} that:
1. Continues the visual narrative/theme established in the series
2. Explores a DIFFERENT aspect, angle, or perspective of the content
3. Maintains stylistic consistency with the previous image(s)
4. Adds new visual elements while honoring the series aesthetic
5. Output ONLY the new image prompt, no explanations

Document/Card Context (for reference):
${contextSummary}
${cardContext.image ? '(REFER TO ATTACHED IMAGE FOR CHARACTER/VISUAL CONTEXT)' : ''}

Create prompt for image #${imageNumber} in the series:`;
        } else {
          // First image - original prompt
          promptCraftingRequest = `
You are an expert at crafting image generation prompts. Given context about a data card/document, create a detailed, evocative prompt for an AI image generator.

Rules:
1. Output ONLY the image prompt, no explanations or preamble
2. Be specific about style, lighting, composition
3. Include artistic style keywords (digital art, concept art, cinematic, illustration, etc.)
4. Keep under 150 words
5. Focus on visual elements that represent the content's essence and themes
6. Make it visually interesting, artistic, and memorable
7. If the content is abstract or technical, create a metaphorical or symbolic visual representation
8. If an image is provided, USE IT as the primary visual reference for the character/object.

Document/Card Context:
${contextSummary}
${cardContext.image ? '(REFER TO ATTACHED IMAGE FOR CHARACTER/VISUAL CONTEXT)' : ''}

Create a vivid image prompt that visually represents this content:`;
        }

        // Call LLM to craft the prompt
        // Priority: AIMLAPI -> Vertex AI -> Google AI Studio
        let craftedPrompt = '';

        // PRIORITY 1: AIMLAPI.com for prompt crafting
        if (isAimlApiConfigured()) {
          console.log('[ImageGen] Using AIMLAPI.com for prompt crafting');
          try {
            const aimlClient = new AimlApiClient();
            const result = await aimlClient.chatCompletion(
              [{ role: 'user', content: promptCraftingRequest }],
              AIMLAPI_MODEL_MAP['fast-llm'],
              { temperature: 0.7, max_tokens: 500 }
            );
            craftedPrompt = result.content.trim();
          } catch (e: any) {
            console.error('[ImageGen] AIMLAPI Prompt Crafting failed:', e.message);
            // Fall through to other providers
          }
        }

        // PRIORITY 2: Vertex AI for prompt crafting
        if (!craftedPrompt && isVertexAIConfigured()) {
          console.log('[ImageGen] Using Vertex AI for prompt crafting');
          try {
            const vertexClient = getVertexAIClient();
            const result = await vertexClient.generateContent(promptCraftingRequest, 'fast-llm');
            craftedPrompt = result.text.trim();
          } catch (e: any) {
            console.error('[ImageGen] Vertex AI Prompt Crafting failed:', e.message);
            // Fall through to AI Studio
          }
        }

        // PRIORITY 3: Google AI Studio for prompt crafting
        if (!craftedPrompt && apiKey) {
          console.log('[ImageGen] Using Google AI Studio for prompt crafting');
          const genAI = new GoogleGenerativeAI(apiKey);
          const promptModel = genAI.getGenerativeModel({ model: imageGenSettings.defaultPromptLLM });

          try {
            // Construct Multimodal Request
            const promptParts: any[] = [promptCraftingRequest];
            if (cardContext.image) {
              promptParts.push({
                inlineData: {
                  mimeType: cardContext.mimeType || 'image/png',
                  data: cardContext.image // Base64 string
                }
              });
            }

            const result = await promptModel.generateContent(promptParts);
            const response = await result.response;
            craftedPrompt = response.text().trim();
          } catch (e: any) {
            console.error('[ImageGen] AI Studio Prompt Crafting failed:', e.message);
          }
        }

        if (!craftedPrompt) {
          throw new Error('Failed to craft image prompt - all providers failed');
        }

        console.log('[ImageGen] Crafted prompt:', craftedPrompt.substring(0, 200) + '...');

        // Step 2: Generate image using the crafted prompt
        let imageBase64: string | null = null;
        let mimeType = 'image/png';

        if (provider === 'local-vision') {
          const status = getLocalVisionStatusInternal();
          if (!status.running || !status.port) {
            throw new Error('Local Vision server is not running.');
          }
          const visionSettings = getLocalVisionSettingsInternal();
          console.log(`[ImageGen] Routing to Local Vision (Model: ${visionSettings.activeModel})`);

          const response = await fetch(`http://127.0.0.1:${status.port}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: craftedPrompt,
              model_id: visionSettings.activeModel,
              cache_dir: visionSettings.modelsDir,
              num_inference_steps: 4, // Z-Image-Turbo default
              guidance_scale: 1.5,
              width: 1024,
              height: 1024
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Local generation failed: ${errText}`);
          }

          const data = await response.json();
          if (data.images && data.images.length > 0) {
            imageBase64 = data.images[0]; // Base64 string without prefix
            mimeType = 'image/png';
          } else {
            throw new Error('Local server returned no images.');
          }

        } else if (isVertexAIConfigured()) {
          // Vertex AI Image Generation using Imagen 4 (same as Hell Week pipeline)
          console.log('[ImageGen] Using Vertex AI Imagen for image generation');
          try {
            const vertexClient = getVertexAIClient();
            // Use generateImageImagen with 'pro-image' (Imagen 4) - same as Hell Week pipeline
            const result = await vertexClient.generateImageImagen(craftedPrompt, 'pro-image', {
              aspectRatio: '1:1',
              sampleCount: 1,
            });
            imageBase64 = result.base64;
            mimeType = result.mimeType;
          } catch (e: any) {
            console.error('[ImageGen] Vertex AI Imagen Generation failed:', e);
            throw new Error(`Vertex AI image generation failed: ${e.message}`);
          }
        } else {
          // Fallback: Google AI Studio Gemini Image Generation
          if (!apiKey) {
            throw new Error('No AI provider configured for image generation.');
          }

          const imageUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageGenSettings.defaultImageModel}:generateContent?key=${apiKey}`;

          console.log(`[ImageGen] Calling Gemini Image API: ${imageUrl.replace(apiKey!, 'HIDDEN_KEY')}`);
          console.log(`[ImageGen] Payload:`, JSON.stringify({ contents: [{ role: 'user', parts: [{ text: craftedPrompt }] }] }).substring(0, 200) + '...');

          const imageResponse = await fetch(imageUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: craftedPrompt }] }],
            }),
          });

          console.log(`[ImageGen] Response Status: ${imageResponse.status} ${imageResponse.statusText}`);

          if (!imageResponse.ok) {
            const errText = await imageResponse.text();
            console.error(`[ImageGen] API Error Body:`, errText);
            throw new Error(`Image generation failed (${imageResponse.status}): ${errText}`);
          }

          const rawText = await imageResponse.text();
          console.log(`[ImageGen] Raw Response Body (first 500 chars):`, rawText.substring(0, 500));

          let imageData: any;
          try {
            imageData = JSON.parse(rawText);
          } catch (e) {
            console.error(`[ImageGen] JSON Parse Error:`, e);
            throw new Error('Failed to parse image API response.');
          }

          // Extract image from response
          const parts = imageData.candidates?.[0]?.content?.parts || [];

          for (const part of parts) {
            if (part.inlineData?.data) {
              imageBase64 = part.inlineData.data;
              mimeType = part.inlineData.mimeType || 'image/png';
              break;
            }
          }

          if (!imageBase64) {
            // Check if response contains text (markdown image) instead
            const textContent = parts.find((p: any) => p.text)?.text || '';
            const base64Match = textContent.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
            if (base64Match) {
              imageBase64 = base64Match[1];
            } else {
              throw new Error('No image data in response. The model may not support image generation.');
            }
          }
        }

        // Step 3: Save image to file
        const userDataDir = app.getPath('userData');
        const imagesDir = path.join(userDataDir, 'wormhole', 'card-images');
        await fs.promises.mkdir(imagesDir, { recursive: true });

        const fileName = `card-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
        const filePath = path.join(imagesDir, fileName);

        await fs.promises.writeFile(filePath, Buffer.from(imageBase64!, 'base64'));
        console.log('[ImageGen] Saved image to:', filePath);

        // Release base64 after saving to disk
        imageBase64 = null;
        hintGC();

        logMemory('ImageGen Complete');
        endOperation(opId);

        return {
          success: true,
          localPath: filePath,
          mimeType,
          craftedPrompt,
        };
      } catch (error: any) {
        console.error('[ImageGen] Error:', error);
        endOperation(opId);
        throw new Error(`Image generation failed: ${error.message}`);
      }
    },
  );

  // Create looping video from an image (one-click loop generation)
  ipcMain.handle(
    'create-loop-video-for-image',
    async (
      _event,
      {
        parentCardId,
        imageId,
        imagePath,
        originalPrompt,
        cardName,
        imageOrder,
      }: {
        parentCardId: string;
        imageId: string;
        imagePath: string;
        originalPrompt: string;
        cardName: string;
        imageOrder: number;
      },
    ) => {
      const opId = `loop-vid-${Date.now()}`;
      startOperation(opId, 'createLoopVideo');
      logMemory('LoopVideo Start');

      // Check for any AI provider
      const geminiApiKey = store.get('geminiKey') as string | undefined;
      const aimlConfigured = isAimlApiConfigured();
      
      if (!aimlConfigured && !geminiApiKey && !isVertexAIConfigured()) {
        endOperation(opId);
        throw new Error('No AI provider configured. Please set up AIMLAPI.com, Vertex AI, or Google AI Studio in Settings.');
      }

      console.log('[LoopVideo] Starting loop video creation for image:', imageId);
      console.log('[LoopVideo] Original prompt:', originalPrompt?.substring(0, 100));
      console.log(`[LoopVideo] Provider check: AIMLAPI=${aimlConfigured}, Vertex=${isVertexAIConfigured()}, Gemini=${!!geminiApiKey}`);

      try {
        // Step 1: Read the source image and convert to base64
        // Use let so we can null after API call to free memory during polling
        let imageBuffer: Buffer | null = await fs.promises.readFile(imagePath);
        const imageSizeMB = imageBuffer.length / (1024 * 1024);
        console.log('[LoopVideo] Image size:', imageSizeMB.toFixed(2), 'MB');

        let imageBase64: string | null = imageBuffer.toString('base64');
        imageBuffer = null; // Release buffer immediately
        const imageMimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        // Step 2: Craft a loop-optimized prompt using LLM
        // Priority: AIMLAPI -> Vertex AI -> Google AI Studio

        const loopPromptRequest = `You are crafting a prompt for a SEAMLESS LOOPING VIDEO that will be generated from a still image.

The still image was created with this prompt:
"${originalPrompt || 'A visually striking image'}"

Create a video prompt that describes SUBTLE, CONTINUOUS motion for a seamless loop:

1. Focus on gentle, ambient movements that loop naturally
2. Good loop elements to include:
   - Floating particles, dust motes, or light specks
   - Gentle pulsing or breathing of light sources
   - Slow atmospheric effects (fog, mist, aurora glow)
   - Subtle environmental motion (swaying, ripples, flickering)
   - Soft camera drift or parallax effect
3. Keep the main subject relatively STATIC while the environment feels ALIVE
4. Avoid: sudden movements, drastic changes, scene transitions, fast motion
5. The motion should feel hypnotic and calming

Output ONLY the video motion prompt, under 80 words. Focus purely on describing the motion/animation, not the static scene.`;

        let loopPrompt: string | undefined;

        // PRIORITY 1: AIMLAPI.com for prompt crafting
        if (aimlConfigured) {
          console.log('[LoopVideo] Using AIMLAPI.com for prompt crafting (Fast LLM)');
          try {
            const aimlClient = new AimlApiClient();
            const result = await aimlClient.chatCompletion(
              [{ role: 'user', content: loopPromptRequest }],
              AIMLAPI_MODEL_MAP['fast-llm'],
              { temperature: 0.7, max_tokens: 500 }
            );
            loopPrompt = result.content.trim();
          } catch (e: any) {
            console.error('[LoopVideo] AIMLAPI Prompt Crafting failed:', e.message);
            // Fall through to other providers
          }
        }

        // PRIORITY 2: Vertex AI for prompt crafting
        if (!loopPrompt && isVertexAIConfigured()) {
          console.log('[LoopVideo] Using Vertex AI for prompt crafting (Fast LLM)');
          try {
            const vertexClient = getVertexAIClient();
            const result = await vertexClient.generateContent(loopPromptRequest, 'fast-llm');
            loopPrompt = result.text.trim();
          } catch (e: any) {
            console.error('[LoopVideo] Vertex AI Prompt Crafting failed:', e.message);
          }
        }

        // PRIORITY 3: Google AI Studio for prompt crafting
        if (!loopPrompt && geminiApiKey) {
          const promptLLM = 'gemini-2.5-flash';
          const llmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${promptLLM}:generateContent?key=${geminiApiKey}`;

          console.log(`[LoopVideo] Crafting prompt with AI Studio model: ${promptLLM}`);

          const llmResponse = await fetch(llmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: loopPromptRequest }] }],
            }),
          });

          if (llmResponse.ok) {
            const llmData = await llmResponse.json();
            loopPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          } else {
            const errText = await llmResponse.text();
            console.error(`[LoopVideo] AI Studio prompt crafting failed: ${errText}`);
          }
        }

        if (!loopPrompt) {
          throw new Error('Failed to craft loop video prompt - all providers failed');
        }

        console.log('[LoopVideo] Crafted loop prompt:', loopPrompt.substring(0, 150));

        // Broadcast progress to renderer (safely handles disposed windows)
        const broadcastLoopProgress = (data: any) => {
          try {
            const [mainWin] = BrowserWindow.getAllWindows();
            if (mainWin && !mainWin.isDestroyed() && mainWin.webContents && !mainWin.webContents.isDestroyed()) {
              mainWin.webContents.send('loop-video-progress', data);
            }
          } catch (e) {
            // Silently ignore - window may have been closed during video generation
          }
        };

        broadcastLoopProgress({
          imageId,
          status: 'crafted',
          message: 'Crafted loop motion prompt',
        });

        // Step 3: Generate the video using Veo with loop mode
        // Use Veo 3.1 for best loop quality (supports last_frame for seamless looping)

        // Pre-calculate path to stream directly to disk
        const userDataDir = app.getPath('userData');
        const videosDir = path.join(userDataDir, 'wormhole', 'card-videos');
        await fs.promises.mkdir(videosDir, { recursive: true });

        const videoCardId = `loop-video-${Date.now()}`;
        const videoFileName = `${videoCardId}.mp4`;
        const videoPath = path.join(videosDir, videoFileName);

        let success = false;
        let videoModel = 'veo-3.1-generate-preview';

        broadcastLoopProgress({
          imageId,
          status: 'generating',
          message: 'Generating loop video...',
        });

        // =================================================================================
        // PRIORITY 1: Vertex AI for video generation (AIMLAPI queue is backed up)
        // =================================================================================
        if (!success && isVertexAIConfigured()) {
          console.log('[LoopVideo] Using Vertex AI for video generation');
          try {
            const vertexClient = getVertexAIClient();

            // Ensure we still have image data
            if (!imageBase64) {
              throw new Error('Image data was released - cannot use Vertex fallback');
            }

            const result = await vertexClient.generateVideo(loopPrompt, {
              startFrameBase64: imageBase64,
              startFrameMimeType: imageMimeType,
              endFrameBase64: imageBase64, // Same image for seamless loop
              endFrameMimeType: imageMimeType,
              aspectRatio: '16:9',
              loopMode: true,
            });

            console.log('[LoopVideo] Vertex AI video generation started, operation:', result.operationName);
            videoModel = 'veo-3.1-generate-preview';

            // Poll
            console.log('[LoopVideo] Polling Vertex AI for completion...');
            const pollResult = await vertexClient.pollVideoOperation(
              result.operationName,
              60, // maxAttempts
              5000, // intervalMs
              (attempt, max) => {
                broadcastLoopProgress({
                  imageId,
                  status: 'generating',
                  message: `Generating video... ${Math.round((attempt / max) * 100)}%`,
                  progress: Math.round((attempt / max) * 100),
                });
              }
            );

            // Save
            await fs.promises.writeFile(videoPath, Buffer.from(pollResult.videoBase64, 'base64'));
            console.log('[LoopVideo] Vertex AI video generation complete!');
            success = true;

            // MEMORY FIX: Only release after success
            imageBase64 = null;
            if (global.gc) global.gc();

          } catch (vertexErr: any) {
            console.error('[LoopVideo] Vertex AI failed:', vertexErr.message);
            // Fall through to AI Studio (imageBase64 still available)
          }
        }

        // =================================================================================
        // PRIORITY 2: Google AI Studio (Fallback)
        // =================================================================================
        if (!success && geminiApiKey) {
          console.log('[LoopVideo] Starting AI Studio Fallback...');

          // Ensure we still have image data
          if (!imageBase64) {
            throw new Error('Image data was released - cannot use AI Studio fallback');
          }

          // Use stable Veo model
          videoModel = 'veo-3.0-generate-001';
          const videoUrl = `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning?key=${geminiApiKey}`;

          // Build instance
          const instance: any = {
            prompt: loopPrompt,
            image: {
              bytesBase64Encoded: imageBase64,
              mimeType: imageMimeType,
            },
          };

          const parameters: any = {
            aspectRatio: '16:9',
          };

          const videoRequestBody = {
            instances: [instance],
            parameters,
          };

          console.log('[LoopVideo] Calling AI Studio Veo API...');

          const videoResponse = await fetch(videoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(videoRequestBody),
          });

          if (!videoResponse.ok) {
            const errText = await videoResponse.text();
            throw new Error(`AI Studio Video generation request failed: ${errText}`);
          }

          const videoOpData = await videoResponse.json();
          const operationName = videoOpData.name;

          if (!operationName) {
            throw new Error('No operation name returned from AI Studio');
          }

          console.log('[LoopVideo] AI Studio video generation started, operation:', operationName);

          // Poll AI Studio
          const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${geminiApiKey}`;
          const maxAttempts = 60;

          // Release memory now that request is sent
          imageBase64 = null;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            broadcastLoopProgress({
              imageId,
              status: 'generating',
              message: `Generating video... ${Math.round((attempt / maxAttempts) * 100)}%`,
              progress: Math.round((attempt / maxAttempts) * 100),
            });

            const pollResponse = await fetch(pollUrl);
            if (!pollResponse.ok) continue;

            const pollData = await pollResponse.json();

            if (pollData.done) {
              console.log('[LoopVideo] AI Studio video generation complete!');

              // Extract video from response
              const generatedSamples = pollData.response?.generateVideoResponse?.generatedSamples ||
                pollData.response?.generatedVideos ||
                pollData.response?.videos ||
                pollData.result?.videos ||
                [];

              if (generatedSamples.length === 0) {
                console.error('[LoopVideo] No videos in response. Full response:', JSON.stringify(pollData).slice(0, 500));
                throw new Error('No video generated from AI Studio');
              }

              const sample = generatedSamples[0];
              const videoUri = sample.video?.uri || sample.uri;

              if (!videoUri) {
                throw new Error('No video URI in response');
              }

              // Stream the video directly to disk
              console.log('[LoopVideo] Streaming video to disk:', videoPath);
              const downloadResponse = await fetch(videoUri, {
                headers: { 'x-goog-api-key': geminiApiKey },
                redirect: 'follow',
              });

              if (!downloadResponse.ok) {
                throw new Error(`Failed to download video: ${downloadResponse.statusText}`);
              }

              const fileStream = fs.createWriteStream(videoPath);
              // @ts-ignore
              await finished(Readable.fromWeb(downloadResponse.body).pipe(fileStream));

              success = true;
              break;
            }
          }

          if (!success) {
            throw new Error('AI Studio video generation timed out');
          }
        }

        // If all providers failed
        if (!success) {
          throw new Error('Video generation failed - all providers exhausted');
        }

        console.log('[LoopVideo] Saved video to:', videoPath);
        hintGC(); // Hint garbage collection after streaming

        // Step 5: Create child video card with full lineage
        const videoCardRecord = {
          cardId: videoCardId,
          name: `${cardName} - Loop #${imageOrder + 1}`,
          title: `${cardName} - Loop #${imageOrder + 1}`,
          mediaKind: 'video',
          subType: 'loop-video',
          mediaLocalPath: videoPath,
          createdAt: new Date().toISOString(),
          parentCardId: parentCardId, // The IMAGE card that generated this
          parentType: 'image',
          sourceImage: {
            cardId: imageId, // Reference to parent Image Card
            imageId,
            imagePath,
            localPath: imagePath,
            craftedPrompt: originalPrompt,
          },
          generationParams: {
            model: videoModel,
            loopMode: true,
            loopPrompt,
            durationSeconds: 5,
          },
        };

        // Save video card to Hypercore
        await createCore(videoCardId);
        await appendToCore(videoCardId, JSON.stringify(videoCardRecord));

        // Add to card library index
        const libraryEntry = {
          type: 'card-index', // REQUIRED: Frontend filters for this
          cardId: videoCardId,
          name: videoCardRecord.name,
          mediaKind: 'video',
          subType: 'loop-video',
          createdAt: videoCardRecord.createdAt,
          parentCardId: parentCardId,
          coreName: videoCardId,
          thumbnail: imagePath, // Use source image as thumbnail
          mediaLocalPath: videoPath,
        };
        await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
        console.log('[LoopVideo] Added video card to library index:', videoCardId);

        // Emit to persistence layer
        emitCardEvent('CARD_CREATED', {
          id: videoCardId,
          type: 'standard',
          mediaKind: 'video',
          name: videoCardRecord.name,
          parentId: parentCardId,
          createdAt: videoCardRecord.createdAt,
        });

        // Update parent card to include this video in its children array
        // For Hell Week cards, update the card-library index entry
        // For regular cards, also update the card's hypercore
        const childEntry = {
          type: 'loop-video',
          cardId: videoCardId,
          videoPath: videoPath,
          createdAt: new Date().toISOString(),
        };

        try {
          // CRITICAL: Update card-library index to add children array
          // This works for ALL card types (Hell Week, regular, etc.)
          const libraryRecords = await readCore(CARD_LIBRARY_CORE_NAME);
          let parentIndexEntry: any = null;

          // Find the parent card's index entry
          for (let i = libraryRecords.length - 1; i >= 0; i--) {
            const raw = libraryRecords[i];
            if (!raw || typeof raw !== 'string') continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'card-index' && parsed.cardId === parentCardId) {
                parentIndexEntry = parsed;
                break;
              }
            } catch { /* ignore */ }
          }

          if (parentIndexEntry) {
            // Update the index entry with children
            const updatedEntry = {
              ...parentIndexEntry,
              cardRecord: {
                ...(parentIndexEntry.cardRecord || {}),
                children: [
                  ...((parentIndexEntry.cardRecord?.children) || []),
                  childEntry,
                ],
              },
              updatedAt: new Date().toISOString(),
            };

            // Append updated entry to card-library
            await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(updatedEntry));
            console.log('[LoopVideo] Updated card-library index with children:', parentCardId);
          }

          // Also try to update the card's own hypercore (for non-Hell Week cards)
          try {
            const parentRecords = await readCore(parentCardId);
            let parentCardData: any = null;

            for (let i = parentRecords.length - 1; i >= 0; i--) {
              const raw = parentRecords[i];
              if (!raw || typeof raw !== 'string') continue;
              try {
                const parsed = JSON.parse(raw);
                if (parsed.type === 'card-state' && parsed.card) {
                  parentCardData = parsed.card;
                  break;
                }
                if (parsed.cardId || parsed.type === 'card') {
                  parentCardData = parsed;
                  break;
                }
              } catch { /* ignore */ }
            }

            if (parentCardData) {
              if (!parentCardData.children) {
                parentCardData.children = [];
              }
              parentCardData.children.push(childEntry);
              await appendToCore(parentCardId, JSON.stringify({
                type: 'card-state',
                card: parentCardData,
                updatedAt: new Date().toISOString(),
              }));
              console.log('[LoopVideo] Updated parent hypercore children:', parentCardId);
            }
          } catch (coreErr: any) {
            // This is fine - Hell Week cards may not have individual hypercores
            console.log('[LoopVideo] No individual hypercore for card (likely Hell Week):', parentCardId);
          }
        } catch (parentErr: any) {
          console.warn('[LoopVideo] Could not update parent card children:', parentErr.message);
        }

        // Broadcast completion
        broadcastLoopProgress({
          imageId,
          status: 'complete',
          message: 'Loop video created!',
        });

        logMemory('LoopVideo Complete');
        endOperation(opId);
        hintGC();

        return {
          success: true,
          videoCardId,
          videoPath,
          loopPrompt,
          parentCardId,
          imageId,
        };
      } catch (error: any) {
        console.error('[LoopVideo] Error:', error);
        endOperation(opId);
        // Broadcast error - need to create helper here since it might not be defined yet
        const [errWin] = BrowserWindow.getAllWindows();
        if (errWin) {
          errWin.webContents.send('loop-video-progress', {
            imageId,
            status: 'error',
            message: error.message,
          });
        }
        throw new Error(`Loop video creation failed: ${error.message}`);
      }
    },
  );

  // Veo video generation models (image-to-video capable)
  const VEO_VIDEO_MODELS = [
    {
      name: 'veo-3.1-generate-preview',
      displayName: 'Veo 3.1 (Video)',
      description: '8s 720p/1080p video with audio. Supports text & image-to-video.',
      isVideoModel: true,
    },
    {
      name: 'veo-3.1-fast-generate-preview',
      displayName: 'Veo 3.1 Fast (Video)',
      description: 'Fast 8s video generation with audio. Text & image input.',
      isVideoModel: true,
    },
    {
      name: 'veo-3.0-generate-001',
      displayName: 'Veo 3 (Video)',
      description: 'High-quality video with audio. Supports image-to-video.',
      isVideoModel: true,
    },
    {
      name: 'veo-3.0-fast-generate-001',
      displayName: 'Veo 3 Fast (Video)',
      description: 'Fast video generation with audio.',
      isVideoModel: true,
    },
    {
      name: 'veo-2.0-generate-001',
      displayName: 'Veo 2 (Video)',
      description: 'Video generation (no audio). Image-to-video supported.',
      isVideoModel: true,
    },
  ];

  // List available Gemini models
  ipcMain.handle('list-gemini-models', async () => {
    const apiKey = store.get('geminiKey') as string | undefined;

    if (!apiKey) {
      // Fallback list when no API key is configured (include Veo models)
      return [
        { name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Latest pro model' },
        { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast flash model' },
        { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash Exp', description: 'Experimental model' },
        ...VEO_VIDEO_MODELS,
      ];
    }

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
      );
      const data = await response.json();

      if (data.models && Array.isArray(data.models)) {
        const mapped = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            name: (m.name as string).replace('models/', ''),
            displayName: m.displayName || (m.name as string).replace('models/', ''),
            description: m.description || '',
            isVideoModel: false,
          }));

        // Add Veo video models to the list
        const allModels = [...mapped, ...VEO_VIDEO_MODELS];
        console.log('Available Gemini Models (including Veo):', allModels.length);
        return allModels;
      }
    } catch (error) {
      console.error('Error fetching models from API:', error);
    }

    // Fallback to common model names on error (include Veo models)
    return [
      { name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Latest pro model' },
      { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast flash model' },
      { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash Exp', description: 'Experimental model' },
      ...VEO_VIDEO_MODELS,
    ];
  });

  ipcMain.handle('list-openai-models', async () => {
    const apiKey = store.get('openaiKey') as string | undefined;
    if (!apiKey) {
      return listDefaultOpenAIModels();
    }
    return fetchOpenAIModels(apiKey);
  });

  // List models from a local llama.cpp server (OpenAI-compatible /v1/models)
  ipcMain.handle('list-llama-models', async () => {
    const endpoint = getLlamaModelsEndpoint();
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      const data = await response.json();

      if (!response.ok) {
        console.error('Llama models API error:', data);
        return [];
      }

      if (!data || !Array.isArray((data as any).data)) {
        console.error('Unexpected Llama models response shape:', data);
        return [];
      }

      return (data as any).data.map((m: any) => ({
        name: typeof m.id === 'string' ? (m.id as string) : 'unknown',
        displayName:
          typeof m.id === 'string'
            ? ((m.id as string) || 'Local model')
            : 'Local model',
        description: typeof m.object === 'string' ? (m.object as string) : '',
      }));
    } catch (error: any) {
      // Suppress ECONNREFUSED as it just means server is not running
      if (error?.cause?.code !== 'ECONNREFUSED' && !error?.message?.includes('ECONNREFUSED')) {
        console.error('Error fetching Llama models from local server:', error);
      }
      return [];
    }
  });

  // List AIMLAPI models
  ipcMain.handle('list-aimlapi-models', async () => {
    try {
      const { aimlApiClient } = await import('./aimlapi');
      const models = await aimlApiClient.listModels();
      // Transform to standardized ModelInfo format
      return models.map((m: any) => ({
        name: m.id,
        displayName: m.name || m.id,
        description: m.description || 'AIMLAPI Model',
        provider: 'aimlapi'
      }));
    } catch (error) {
      console.error('Error listing AIMLAPI models:', error);
      return [];
    }
  });

  // Chat with AIMLAPI (OpenAI Compatible)
  ipcMain.handle(
    'chat-with-aimlapi',
    async (
      _event,
      {
        message,
        history,
        model,
        attachments,
      }: {
        message: string;
        history: { role: string; content: string }[];
        model: string;
        attachments?: { mimeType: string; data: string }[];
      },
    ) => {
      try {
        const { aimlApiClient } = await import('./aimlapi');
        
        // Construct messages array
        const messages: Array<{ role: string; content: any }> = history.map((h) => ({
          role: h.role,
          content: h.content,
        }));

        const resolveDataUrl = (att: { mimeType: string; data: string }) => {
          const mt = att?.mimeType ? String(att.mimeType) : '';
          const raw = att?.data ? String(att.data) : '';
          if (!raw) return null;
          if (raw.startsWith('data:')) return raw;
          if (mt) return `data:${mt};base64,${raw}`;
          return `data:application/octet-stream;base64,${raw}`;
        };

        const imageAttachments = Array.isArray(attachments)
          ? attachments
              .filter((a) => {
                const mt = a?.mimeType ? String(a.mimeType) : '';
                return mt.startsWith('image/');
              })
              .slice(0, 4)
          : [];

        if (imageAttachments.length > 0) {
          const contentParts: any[] = [{ type: 'text', text: message }];
          for (const att of imageAttachments) {
            const url = resolveDataUrl(att);
            if (!url) continue;
            contentParts.push({ type: 'image_url', image_url: { url } });
          }

          messages.push({ role: 'user', content: contentParts });

          try {
            const response = await aimlApiClient.chatCompletion(messages as any, model || 'gpt-4o');
            return response.content;
          } catch (err: any) {
            console.warn('[AIMLAPI] Vision-style message failed; retrying as text-only:', err?.message || err);
            // fall through to text-only
          }
        }

        messages.push({ role: 'user', content: message });
        const response = await aimlApiClient.chatCompletion(messages as any, model || 'gpt-4o');
        return response.content;
      } catch (error: any) {
        console.error('AIMLAPI Chat Error:', error);
        throw error;
      }
    },
  );

  // Chat with Gemini
  ipcMain.handle(
    'chat-with-gemini',
    async (
      _event,
      {
        message,
        history,
        model: modelName,
        attachments,
      }: {
        message: string;
        history: { role: string; content: string }[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
      },
    ) => {
      console.log('Chat with Gemini requested. Model:', modelName);
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const resolvedModel = (modelName || 'gemini-pro').toString();
        const model = genAI.getGenerativeModel({ model: resolvedModel });

        const toContentHistory = (
          items: { role: string; content: string }[],
        ): any[] =>
          items
            .filter((item) => item.content && item.content.trim().length > 0)
            .map((item) => {
              // Strip base64 images from history to avoid token limits
              const sanitized = item.content.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Generated Image]');
              return {
                role: item.role === 'model' ? 'model' : 'user',
                parts: [{ text: sanitized }],
              };
            });

        const sendMessageWithRetry = async (
          currentHistory: { role: string; content: string }[],
        ): Promise<{ content: string; model: string; provider: string }> => {
          try {
            const lowerModel = resolvedModel.toLowerCase();
            const isImageModel =
              lowerModel.includes('image') || lowerModel.includes('nano-banana');

            // For image-generation models (for example Nano Banana / gemini-*-image),
            // use the generateContent image endpoint instead of chat streaming so we
            // can reliably access inlineData image bytes.
            if (isImageModel) {
              const textContext = currentHistory
                .map((item) => {
                  // Strip base64 images from history to avoid token limits
                  const sanitized = item.content.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Generated Image]');
                  return `${item.role === 'model' ? 'Assistant' : 'User'}: ${sanitized}`;
                })
                .join('\n');

              const prompt =
                textContext && textContext.trim().length > 0
                  ? `${textContext}\n\nUser: ${message}`
                  : message;

              // Build parts array with text prompt AND any image attachments
              const parts: any[] = [{ text: prompt }];

              // Add image attachments as inline data for the model to use
              if (attachments && attachments.length > 0) {
                console.log(`Including ${attachments.length} attachment(s) in image generation request`);
                for (const att of attachments) {
                  if (att.mimeType && att.data) {
                    // Ensure we have clean base64 data (strip data URL prefix if present)
                    let base64Data = att.data;
                    if (base64Data.includes(',')) {
                      base64Data = base64Data.split(',')[1];
                    }
                    parts.push({
                      inlineData: {
                        mimeType: att.mimeType,
                        data: base64Data,
                      },
                    });
                    console.log(`Added attachment: ${att.mimeType}, ${base64Data.length} chars`);
                  }
                }
              }

              const contents = [
                {
                  role: 'user',
                  parts,
                },
              ];

              const requestId =
                Date.now().toString() +
                '-' +
                Math.random().toString(36).slice(2, 8);

              appendGeminiRequestLog({
                id: requestId,
                createdAt: new Date().toISOString(),
                model: resolvedModel,
                payload: {
                  history: contents,
                  parts: contents[0].parts,
                },
              });

              const url =
                `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent` +
                `?key=${apiKey}`;

              const httpResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contents }),
              });

              const data = await httpResponse.json();

              if (!httpResponse.ok) {
                console.error('Gemini image generation error:', data);
                throw new Error(
                  data?.error?.message || 'Gemini image generation request failed',
                );
              }

              const candidates = (data as any).candidates ?? [];
              const first = candidates[0];
              const responseParts = (first?.content?.parts ?? []) as any[];

              const textChunks: string[] = [];
              const imageChunks: string[] = [];

              responseParts.forEach((part: any, index: number) => {
                if (typeof part.text === 'string' && part.text.trim().length > 0) {
                  textChunks.push(part.text);
                }
                const inline = (part as any).inlineData;
                if (inline?.mimeType && inline?.data) {
                  const markdown = `![image ${index + 1}](data:${inline.mimeType};base64,${inline.data})`;
                  imageChunks.push(markdown);
                }
              });

              const combined = [...textChunks, ...imageChunks]
                .filter((chunk) => typeof chunk === 'string' && chunk.trim().length > 0)
                .join('\n\n');

              console.log(
                'Received response from Gemini image model:',
                combined.substring(0, 80) + '...',
              );

              return {
                content: combined || '',
                model: resolvedModel,
                provider: 'gemini',
              };
            }

            const geminiHistory = toContentHistory(currentHistory);
            const chat = model.startChat({
              history: geminiHistory,
            });

            let parts: any[] = [];
            if (attachments && attachments.length > 0) {
              parts = attachments.map((att) => ({
                inlineData: {
                  mimeType: att.mimeType,
                  data: att.data,
                },
              }));
            }

            parts.push({ text: message });

            const requestId =
              Date.now().toString() +
              '-' +
              Math.random().toString(36).slice(2, 8);
            appendGeminiRequestLog({
              id: requestId,
              createdAt: new Date().toISOString(),
              model: resolvedModel,
              payload: {
                history: geminiHistory,
                parts,
              },
            });

            console.log('Sending message to Gemini (stream):', {
              model: resolvedModel,
              partsCount: parts.length,
              historyLength: currentHistory.length,
            });

            const streamResult = await chat.sendMessageStream(parts);
            let accumulatedText = '';

            for await (const chunk of streamResult.stream as any) {
              try {
                const chunkText = (chunk as any).text?.() ?? '';
                if (typeof chunkText === 'string' && chunkText.trim().length > 0) {
                  accumulatedText += chunkText;
                  broadcastChatStream('gemini', chunkText, false, resolvedModel);
                }
              } catch (error) {
                console.error('Failed to process Gemini stream chunk:', error);
              }
            }

            const response = await streamResult.response;

            const candidates = (response as any).candidates ?? [];
            const first = candidates[0];

            if (!first || !first.content || !Array.isArray(first.content.parts)) {
              console.log(
                'Received response from Gemini (stream, text-only):',
                accumulatedText.substring(0, 50) + '...',
              );
              broadcastChatStream('gemini', '', true, resolvedModel);
              return {
                content: accumulatedText || (response as any).text?.() || '',
                model: resolvedModel,
                provider: 'gemini',
              };
            }

            const responseParts = first.content.parts as any[];
            const imageChunks: string[] = [];

            responseParts.forEach((part, index) => {
              const inline = part.inlineData;
              if (inline?.mimeType && inline?.data) {
                try {
                  const userDataDir = app.getPath('userData');
                  const imagesDir = path.join(userDataDir, 'wormhole', 'chat-images');
                  if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                  }

                  const extFromMime = (mime: string) => {
                    const map: Record<string, string> = {
                      'image/png': 'png',
                      'image/jpeg': 'jpg',
                      'image/jpg': 'jpg',
                      'image/webp': 'webp',
                      'image/gif': 'gif',
                    };
                    return map[mime] || 'png';
                  };

                  const ext = extFromMime(inline.mimeType);
                  const fileName = `chat-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index + 1}.${ext}`;
                  const filePath = path.join(imagesDir, fileName);
                  fs.writeFileSync(filePath, Buffer.from(inline.data, 'base64'));

                  const normalized = filePath.replace(/\\/g, '/');
                  const fileUrl = `file:///${normalized}`;
                  const markdown = `![image ${index + 1}](${fileUrl})`;
                  imageChunks.push(markdown);
                } catch (e) {
                  console.error('[Gemini] Failed to persist inline image, omitting image from markdown');
                  imageChunks.push(`[image ${index + 1} omitted: failed to persist inline image]`);
                }
              }
            });

            const combined = [accumulatedText, ...imageChunks]
              .filter((chunk) => typeof chunk === 'string' && chunk.trim().length > 0)
              .join('\n\n');

            console.log(
              'Received response from Gemini (stream):',
              combined.substring(0, 50) + '...',
            );

            broadcastChatStream('gemini', '', true, resolvedModel);
            return {
              content: combined || (response as any).text?.() || '',
              model: resolvedModel,
              provider: 'gemini',
            };
          } catch (error: any) {
            console.error('Gemini attempt failed:', error);
            if (error?.message?.includes('thought_signature') && currentHistory.length > 0) {
              console.log(
                'Retrying with empty history due to thought_signature error...',
              );
              return sendMessageWithRetry([]);
            }
            throw error;
          }
        };

        return await sendMessageWithRetry(history);
      } catch (error: any) {
        console.error('Gemini Error:', error);
        throw new Error(`Gemini Error: ${error.message}`);
      }
    },
  );

  // Generate video with Veo models (async operation with polling)
  // Supports: text-to-video, image-to-video (start frame), interpolation (start+end frame)
  ipcMain.handle(
    'generate-video-with-gemini',
    async (
      _event,
      {
        prompt,
        model: modelName,
        // Start frame image
        imageBase64,
        imageMimeType,
        // End frame for interpolation (Veo 3.1 only)
        lastFrameBase64,
        lastFrameMimeType,
        // Video parameters
        aspectRatio,
        resolution,
        durationSeconds,
        negativePrompt,
        personGeneration,
        // Loop mode - use same image for start and end
        loopMode,
      }: {
        prompt: string;
        model?: string;
        imageBase64?: string;
        imageMimeType?: string;
        lastFrameBase64?: string;
        lastFrameMimeType?: string;
        aspectRatio?: '16:9' | '9:16';
        resolution?: '720p' | '1080p';
        durationSeconds?: '4' | '5' | '6' | '8';
        negativePrompt?: string;
        personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
        loopMode?: boolean;
      },
    ) => {
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      const resolvedModel = modelName || 'veo-3.0-generate-001';
      console.log('Starting video generation with model:', resolvedModel, {
        hasStartFrame: !!imageBase64,
        hasEndFrame: !!lastFrameBase64,
        loopMode,
        aspectRatio,
        resolution,
        durationSeconds,
      });

      try {
        // Build request body - config holds most optional params
        const config: any = {};
        const requestBody: any = { prompt };

        // Add start frame image for image-to-video
        if (imageBase64 && imageMimeType) {
          requestBody.image = {
            bytesBase64Encoded: imageBase64,
            mimeType: imageMimeType,
          };

          // Loop mode: use same image as last_frame to create seamless loop
          if (loopMode) {
            config.last_frame = {
              bytesBase64Encoded: imageBase64,
              mimeType: imageMimeType,
            };
          }
        }

        // Add end frame for interpolation (start + end frame mode)
        if (lastFrameBase64 && lastFrameMimeType && !loopMode) {
          config.last_frame = {
            bytesBase64Encoded: lastFrameBase64,
            mimeType: lastFrameMimeType,
          };
        }

        // Add optional video parameters
        if (aspectRatio) config.aspectRatio = aspectRatio;
        if (resolution) config.resolution = resolution;
        if (durationSeconds) config.durationSeconds = parseInt(durationSeconds, 10);
        if (negativePrompt) config.negativePrompt = negativePrompt;
        if (personGeneration) config.personGeneration = personGeneration;

        // Only add config if it has properties
        if (Object.keys(config).length > 0) {
          requestBody.config = config;
        }

        // Veo 3.0 and 2.0 don't support last_frame - only Veo 3.1 does
        const isVeo31 = resolvedModel.includes('3.1');
        if (!isVeo31 && config.last_frame) {
          console.warn('last_frame not supported on', resolvedModel, '- removing from config');
          delete config.last_frame;
        }

        // Build the instances array for the REST API
        // The REST API uses predictLongRunning with instances array format
        const instance: any = { prompt };

        // Add image for image-to-video
        if (imageBase64 && imageMimeType) {
          instance.image = {
            bytesBase64Encoded: imageBase64,
            mimeType: imageMimeType,
          };
        }

        // Add lastFrame to instance (not parameters) for loop/interpolation
        // Try both camelCase and snake_case since API docs are inconsistent
        if (config.last_frame && isVeo31) {
          instance.lastFrame = config.last_frame;
          delete config.last_frame; // Remove from parameters
        }

        const restRequestBody: any = {
          instances: [instance],
        };

        // Add parameters if any are set (excluding last_frame which goes in instance)
        if (Object.keys(config).length > 0) {
          restRequestBody.parameters = config;
        }

        console.log('Final REST request body (truncated):', JSON.stringify(restRequestBody, null, 2).substring(0, 500) + '...');

        // Start the video generation operation using predictLongRunning
        const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:predictLongRunning`;

        const startResponse = await fetch(startUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(restRequestBody),
        });

        // Handle response - check for empty body first
        const responseText = await startResponse.text();
        console.log('Video generation response status:', startResponse.status);
        console.log('Video generation response text (first 500 chars):', responseText.substring(0, 500));

        let startData: any;
        try {
          startData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('Failed to parse API response:', responseText);
          throw new Error(`Invalid API response: ${responseText.substring(0, 200)}`);
        }

        if (!startResponse.ok) {
          console.error('Video generation start error:', startData);
          throw new Error(startData?.error?.message || `API error ${startResponse.status}: ${responseText.substring(0, 200)}`);
        }

        // Get operation name for polling
        const operationName = startData.name;
        if (!operationName) {
          throw new Error('No operation name returned from video generation');
        }

        console.log('Video generation started, operation:', operationName);

        // Poll for completion (max 5 minutes)
        const maxPolls = 60; // 60 * 5s = 5 minutes
        const pollInterval = 5000; // 5 seconds

        for (let i = 0; i < maxPolls; i++) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;
          const pollResponse = await fetch(pollUrl, {
            headers: { 'x-goog-api-key': apiKey },
          });
          const pollText = await pollResponse.text();

          let pollData: any;
          try {
            pollData = pollText ? JSON.parse(pollText) : {};
          } catch (parseError) {
            console.error('Failed to parse poll response:', pollText);
            throw new Error(`Invalid poll response: ${pollText.substring(0, 200)}`);
          }

          if (!pollResponse.ok) {
            console.error('Video generation poll error:', pollData);
            throw new Error(pollData?.error?.message || `Poll error ${pollResponse.status}`);
          }

          // Broadcast progress
          const [win] = BrowserWindow.getAllWindows();
          if (win) {
            win.webContents.send('video-generation-progress', {
              model: resolvedModel,
              progress: Math.min((i + 1) / maxPolls * 100, 95),
              status: 'processing',
            });
          }

          if (pollData.done) {
            console.log('Video generation complete!');
            console.log('Poll response:', JSON.stringify(pollData, null, 2).substring(0, 1000));

            // REST API uses generateVideoResponse.generatedSamples format
            const generatedSamples = pollData.response?.generateVideoResponse?.generatedSamples ||
              pollData.response?.generatedVideos || [];
            if (generatedSamples.length === 0) {
              throw new Error('No videos were generated. Response: ' + JSON.stringify(pollData).substring(0, 500));
            }

            const sample = generatedSamples[0];
            const videoUri = sample.video?.uri || sample.uri;

            // Download the video
            if (videoUri) {
              // Use x-goog-api-key header for download (per REST API docs)
              console.log('Downloading video from:', videoUri.substring(0, 100) + '...');
              const downloadResponse = await fetch(videoUri, {
                headers: { 'x-goog-api-key': apiKey },
                redirect: 'follow',
              });

              if (!downloadResponse.ok) {
                throw new Error(`Failed to download generated video: ${downloadResponse.status}`);
              }

              // Save to wormhole directory (stream directly to disk to avoid large base64 in memory)
              const userDataDir = app.getPath('userData');
              const wormholeDir = path.join(userDataDir, 'wormhole');
              await fs.promises.mkdir(wormholeDir, { recursive: true });

              const videoFileName = `veo-${Date.now()}.mp4`;
              const videoPath = path.join(wormholeDir, videoFileName);

              if (!downloadResponse.body) {
                throw new Error('Download response had no body stream');
              }

              const fileStream = fs.createWriteStream(videoPath);
              // @ts-ignore - Node fetch returns a WebStream, convert via Readable.fromWeb
              await finished(Readable.fromWeb(downloadResponse.body).pipe(fileStream));

              // Broadcast completion
              if (win) {
                win.webContents.send('video-generation-progress', {
                  model: resolvedModel,
                  progress: 100,
                  status: 'complete',
                });
              }

              return {
                success: true,
                model: resolvedModel,
                videoPath,
                videoFileName,
                mimeType: 'video/mp4',
                durationSeconds: durationSeconds || '8',
              };
            } else {
              throw new Error('Video file URI not found in response');
            }
          }
        }

        throw new Error('Video generation timed out after 5 minutes');
      } catch (error: any) {
        console.error('Video generation error:', error);
        throw new Error(`Video generation failed: ${error.message}`);
      }
    },
  );

  // Extract a frame (first or last) from a video file
  ipcMain.handle('extract-video-frame', async (_event, { videoPath, frameType }: { videoPath: string; frameType: 'first' | 'last' }) => {
    try {
      const { execSync, spawn } = require('child_process');
      // Use bundled ffmpeg/ffprobe
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
      const ffprobePath = require('@ffprobe-installer/ffprobe').path;

      const userDataDir = app.getPath('userData');
      const extractDir = path.join(userDataDir, 'wormhole');
      await fs.promises.mkdir(extractDir, { recursive: true });

      const outputFileName = `frame-${frameType}-${Date.now()}.png`;
      const outputPath = path.join(extractDir, outputFileName);

      // Use ffmpeg to extract frame
      // For first frame: -ss 0 -vframes 1
      // For last frame: we need duration first, then seek to near end
      let ffmpegArgs: string[];

      if (frameType === 'first') {
        ffmpegArgs = ['-i', videoPath, '-ss', '0', '-vframes', '1', '-y', outputPath];
      } else {
        // Get video duration first using bundled ffprobe
        let duration = 8; // Default
        try {
          const durationStr = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, { encoding: 'utf8' }).trim();
          duration = parseFloat(durationStr) || 8;
        } catch (e) {
          console.warn('Could not get video duration, using default');
        }
        // Seek to 0.1s before end
        const seekTime = Math.max(0, duration - 0.1);
        ffmpegArgs = ['-ss', seekTime.toString(), '-i', videoPath, '-vframes', '1', '-y', outputPath];
      }

      // Run bundled ffmpeg
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        ffmpeg.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        ffmpeg.on('error', reject);
      });

      // Read the extracted frame as base64
      const frameBuffer = await fs.promises.readFile(outputPath);
      const base64 = frameBuffer.toString('base64');

      return {
        success: true,
        imagePath: outputPath,
        imageBase64: base64,
        mimeType: 'image/png',
        fileName: outputFileName,
        frameType,
      };
    } catch (error: any) {
      console.error('Frame extraction error:', error);
      throw new Error(`Failed to extract ${frameType} frame: ${error.message}`);
    }
  });

  // Extract audio from a video file
  ipcMain.handle('extract-video-audio', async (_event, { videoPath }: { videoPath: string }) => {
    try {
      const { spawn } = require('child_process');
      // Use bundled ffmpeg
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

      const userDataDir = app.getPath('userData');
      const extractDir = path.join(userDataDir, 'wormhole');
      await fs.promises.mkdir(extractDir, { recursive: true });

      const outputFileName = `audio-${Date.now()}.mp3`;
      const outputPath = path.join(extractDir, outputFileName);

      // Use bundled ffmpeg to extract audio as mp3
      const ffmpegArgs = ['-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-y', outputPath];

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        ffmpeg.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        ffmpeg.on('error', reject);
      });

      // Read the extracted audio as base64
      const audioBuffer = await fs.promises.readFile(outputPath);
      const base64 = audioBuffer.toString('base64');

      return {
        success: true,
        audioPath: outputPath,
        audioBase64: base64,
        mimeType: 'audio/mpeg',
        fileName: outputFileName,
      };
    } catch (error: any) {
      console.error('Audio extraction error:', error);
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  });

  ipcMain.handle('gemini-list-requests', () => {
    const entries = (store.get(GEMINI_REQUEST_LOG_KEY, []) as GeminiRequestLogEntry[]) || [];
    return entries;
  });

  ipcMain.handle(
    'gemini-save-request',
    (_event, updatedEntry: GeminiRequestLogEntry) => {
      const current =
        (store.get(GEMINI_REQUEST_LOG_KEY, []) as GeminiRequestLogEntry[]) || [];
      const index = current.findIndex((entry) => entry.id === updatedEntry.id);
      const now = new Date().toISOString();
      const entryWithMeta: GeminiRequestLogEntry = {
        ...updatedEntry,
        updatedAt: now,
      };
      if (index >= 0) {
        current[index] = entryWithMeta;
      } else {
        current.push(entryWithMeta);
      }
      store.set(GEMINI_REQUEST_LOG_KEY, current);
      return entryWithMeta;
    },
  );

  ipcMain.handle(
    'chat-with-openai',
    async (
      _event,
      {
        message,
        history,
        model: modelName,
        attachments,
      }: {
        message: string;
        history: { role: string; content: string }[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
      },
    ) => {
      const apiKey = store.get('openaiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('OpenAI API Key not found. Please configure it in Settings.');
      }

      const adminSettings = getAdminSettings();
      const resolvedModel = modelName || 'gpt-4.1-mini';

      const mappedHistory = history.map((item) => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.content,
      }));

      const imageAttachments =
        attachments?.filter((att) => att.mimeType.startsWith('image/')) ?? [];
      const audioAttachments =
        attachments?.filter((att) => att.mimeType.startsWith('audio/')) ?? [];
      const videoAttachments =
        attachments?.filter((att) => att.mimeType.startsWith('video/')) ?? [];

      let content: string | any[] = message;

      if (
        imageAttachments.length > 0 ||
        audioAttachments.length > 0 ||
        videoAttachments.length > 0
      ) {
        const parts: any[] = [];

        imageAttachments.forEach((att) => {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${att.mimeType};base64,${att.data}`,
            },
          });
        });

        const transcriptChunks: string[] = [];

        if (audioAttachments.length > 0) {
          if (adminSettings.audioMode === 'realtime') {
            console.warn(
              'Realtime audio mode not implemented for OpenAI. Falling back to transcription.',
            );
          }
          for (const att of audioAttachments) {
            try {
              const text = await transcribeAudioWithOpenAI(
                att.data,
                att.mimeType,
                apiKey,
              );
              if (text && text.trim().length > 0) {
                transcriptChunks.push(text.trim());
              }
            } catch (error) {
              console.error('Audio transcription failed:', error);
            }
          }
        }

        let textContent = message;

        if (transcriptChunks.length > 0) {
          const transcripts = transcriptChunks.join('\n\n');
          textContent = `${message}\n\n[Audio transcript]\n${transcripts}`;
        }

        if (videoAttachments.length > 0) {
          textContent = `${textContent}\n\n[Note] ${videoAttachments.length
            } video attachment(s) were provided. OpenAI chat does not directly consume raw video files in this app; please describe the relevant frames in text.`;
        }

        parts.push({
          type: 'text',
          text: textContent,
        });

        content = parts;
      }

      const openaiPayload = {
        model: resolvedModel,
        messages: [
          ...mappedHistory,
          {
            role: 'user',
            content,
          },
        ],
        temperature: 0.7,
        stream: true,
      };

      const response = await fetch(OPENAI_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiPayload),
      });

      if (!response.ok || !response.body) {
        let errorText: string | undefined;
        try {
          errorText = await response.text();
        } catch {
          // ignore
        }
        console.error('OpenAI Error (non-stream):', errorText);
        throw new Error(`OpenAI Error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          const lines = event.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice('data:'.length).trim();
            if (dataStr === '[DONE]') {
              broadcastChatStream('openai', '', true, resolvedModel);
              continue;
            }
            try {
              const json = JSON.parse(dataStr);
              const rawText = extractOpenAIStreamText(json);
              if (typeof rawText !== 'string' || rawText.length === 0) {
                continue;
              }

              let deltaText = rawText;

              if (fullText && rawText.startsWith(fullText)) {
                // Some models stream the entire message so far on each event.
                // Only append the new suffix.
                deltaText = rawText.slice(fullText.length);
                fullText = rawText;
              } else {
                // Classic behavior: each event is just the new chunk.
                fullText += rawText;
              }

              if (deltaText.length === 0) {
                continue;
              }

              broadcastChatStream('openai', deltaText, false, resolvedModel);
            } catch (error) {
              console.error('Failed to parse OpenAI stream chunk:', error, dataStr);
            }
          }
        }
      }

      return {
        content: fullText,
        model: resolvedModel,
        provider: 'openai',
      };
    },
  );

  // Chat with a local llama.cpp server exposing an OpenAI-compatible /v1/chat/completions API
  ipcMain.handle(
    'chat-with-llama',
    async (
      _event,
      {
        message,
        history,
        model: modelName,
      }: {
        message: string;
        history: { role: string; content: string }[];
        model?: string;
      },
    ) => {
      const mappedHistory = history.map((item) => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.content,
      }));

      const resolvedModel = modelName || 'local-model';

      const llamaPayload = {
        model: modelName || undefined,
        messages: [
          ...mappedHistory,
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        stream: true,
      } as any;

      const response = await fetch(LLAMA_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(llamaPayload),
      });

      if (!response.ok || !response.body) {
        let errorText: string | undefined;
        try {
          errorText = await response.text();
        } catch {
          // ignore
        }
        console.error('Llama Error (non-stream):', errorText);
        throw new Error(`Llama Error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          const lines = event.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice('data:'.length).trim();
            if (dataStr === '[DONE]') {
              broadcastChatStream('llama', '', true, resolvedModel);
              continue;
            }
            try {
              const json = JSON.parse(dataStr);
              const rawText = extractOpenAIStreamText(json);
              if (typeof rawText !== 'string' || rawText.length === 0) {
                continue;
              }

              let deltaText = rawText;

              if (fullText && rawText.startsWith(fullText)) {
                // Some servers stream the entire message so far on each event.
                deltaText = rawText.slice(fullText.length);
                fullText = rawText;
              } else {
                // Classic behavior: each event is just the new chunk.
                fullText += rawText;
              }

              if (deltaText.length === 0) {
                continue;
              }

              broadcastChatStream('llama', deltaText, false, resolvedModel);
            } catch (error) {
              console.error('Failed to parse Llama stream chunk:', error, dataStr);
            }
          }
        }
      }

      return {
        content: fullText,
        model: resolvedModel,
        provider: 'llama',
      };
    },
  );

  // Wormhole IPC handlers
  ipcMain.handle(
    'wormhole-ingest-content',
    async (_event, payload: any) => {
      const {
        path: rawPath,
        bytesBase64,
        mediaType: providedMediaType,
        ownerDid,
        tags,
        sourceLabel,
        fileName: payloadFileName,
        originalUrl,
      } = payload || ({} as any);

      let filePath: string | undefined =
        typeof rawPath === 'string' && rawPath.trim().length > 0 ? rawPath.trim() : undefined;

      const hasBytes = typeof bytesBase64 === 'string' && bytesBase64.length > 0;
      const hasUrl = typeof originalUrl === 'string' && originalUrl.trim().length > 0;

      if (!filePath && !hasBytes && !hasUrl) {
        throw new Error('Wormhole ingestContent requires a file path, bytesBase64 content, or originalUrl.');
      }

      const contentId = `whc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cardCoreName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      const ingestSet = await ensureWormholeIngestSetExists();
      const memberOfSets = [
        {
          setCardId: ingestSet.setId,
          setName: ingestSet.setName,
          joinedAt: createdAt,
          addedBy: 'consume',
        },
      ];

      if (!filePath && hasBytes) {
        const userDataDir = app.getPath('userData');
        const wormholeDir = path.join(userDataDir, 'wormhole');
        await fs.promises.mkdir(wormholeDir, { recursive: true });

        const baseNameRaw =
          typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
            ? payloadFileName.trim()
            : `${contentId}.bin`;
        const safeBaseName = baseNameRaw.replace(/[\\/:*?"<>|]+/g, '_');
        const targetPath = path.join(wormholeDir, safeBaseName);

        const buffer = Buffer.from(bytesBase64, 'base64');
        await fs.promises.writeFile(targetPath, buffer);
        filePath = targetPath;
      } else if (!filePath && hasUrl) {
        const url = (originalUrl as string).trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          throw new Error('Wormhole originalUrl must start with http:// or https://');
        }

        const userDataDir = app.getPath('userData');
        const wormholeDir = path.join(userDataDir, 'wormhole');
        await fs.promises.mkdir(wormholeDir, { recursive: true });

        let inferredName: string | undefined;
        try {
          const urlObj = new URL(url);
          const base = path.basename(urlObj.pathname || '');
          inferredName = base && base.length > 0 ? base : undefined;
        } catch {
          inferredName = undefined;
        }

        const baseNameRaw =
          typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
            ? payloadFileName.trim()
            : inferredName || `${contentId}.bin`;
        const safeBaseName = baseNameRaw.replace(/[\\/:*?"<>|]+/g, '_');
        const targetPath = path.join(wormholeDir, safeBaseName);

        let buffer: Buffer;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            const statusText = response.statusText || 'Request failed';
            throw new Error(`Failed to download Wormhole URL (${response.status} ${statusText})`);
          }
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } catch (error: any) {
          console.error('Failed to download file for Wormhole ingest from URL:', url, error);
          throw new Error(error?.message || 'Failed to download file from URL for Wormhole ingest.');
        }

        await fs.promises.writeFile(targetPath, buffer);
        filePath = targetPath;
      }

      if (!filePath) {
        throw new Error('Failed to resolve a local file path for Wormhole ingest.');
      }

      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        throw new Error('Wormhole ingestContent expects a file path to an existing file.');
      }

      const ext = path.extname(filePath || '').toLowerCase();
      let inferredMediaType: 'text' | 'markdown' | 'pdf' | 'audio' | 'video' | 'image' = 'text';
      if (ext === '.md' || ext === '.markdown') {
        inferredMediaType = 'markdown';
      } else if (ext === '.pdf') {
        inferredMediaType = 'pdf';
      } else {
        const audioExts = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'];
        const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];
        const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
        if (audioExts.includes(ext)) {
          inferredMediaType = 'audio';
        } else if (videoExts.includes(ext)) {
          inferredMediaType = 'video';
        } else if (imageExts.includes(ext)) {
          inferredMediaType = 'image';
        }
      }

      const mediaType = (providedMediaType as any) || inferredMediaType;

      const coreInfo = await createCore(cardCoreName);

      let kind: 'document' | 'audio' | 'video' | 'image' = 'document';
      if (mediaType === 'audio') {
        kind = 'audio';
      } else if (mediaType === 'video') {
        kind = 'video';
      } else if (mediaType === 'image') {
        kind = 'image';
      }

      const fileName = path.basename(filePath);

      const ingestInfo = {
        contentId,
        ownerDid: typeof ownerDid === 'string' ? ownerDid : undefined,
        sourceLabel: typeof sourceLabel === 'string' ? sourceLabel : undefined,
        toolId: 'wormhole:v1',
        mediaType,
        originalPath: filePath,
        originalFileName:
          typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
            ? payloadFileName.trim()
            : fileName,
        originalUrl: typeof originalUrl === 'string' ? originalUrl : undefined,
        tags: Array.isArray(tags) ? tags : undefined,
        startedAt: createdAt,
        completedAt: createdAt,
      };

      const makePendingStep = () => ({
        status: 'pending',
        provider: undefined,
        model: undefined,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
      });

      const processing: any = {
        ingest: {
          status: 'complete',
          provider: 'none',
          model: undefined,
          startedAt: createdAt,
          completedAt: createdAt,
          error: undefined,
        },
        summarization: makePendingStep(),
        keyTerms: makePendingStep(),
        wikiUpdate: makePendingStep(),
      };

      if (mediaType === 'audio' || mediaType === 'video') {
        processing.transcription = makePendingStep();
      }

      const cardRecord: any = {
        type: 'card',
        kind,
        id: cardCoreName,
        cardId: cardCoreName,
        createdAt,
        updatedAt: createdAt,
        title: fileName,
        mediaType,
        source: 'wormhole',
        provider: 'wormhole',
        parentCardId: ingestSet.setId,
        memberOfSets,
        setId: ingestSet.setId,
        wormhole: {
          ingest: ingestInfo,
          processing,
        },
        core: {
          name: cardCoreName,
          key: coreInfo?.key,
          discoveryKey: coreInfo?.discoveryKey,
          length: coreInfo?.length,
        },
      };

      if (mediaType === 'audio') {
        cardRecord.audio = {
          localPath: filePath,
          remoteUrl: undefined,
          mimeType: '',
        };
      } else if (mediaType === 'video') {
        cardRecord.video = {
          localPath: filePath,
          remoteUrl: undefined,
          mimeType: '',
        };
      } else if (mediaType === 'image') {
        // Generate file:// URL for renderer
        const imageUrl = `file://${filePath.replace(/\\/g, '/')}`;
        cardRecord.image = {
          localPath: filePath,
          url: imageUrl,
          imageUrl: imageUrl,
          remoteUrl: undefined,
          mimeType: ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png',
        };
        // Also set at root for compatibility
        cardRecord.imageUrl = imageUrl;
        cardRecord.url = imageUrl;
      }

      await appendToCore(cardCoreName, JSON.stringify(cardRecord));

      await createCore(CARD_LIBRARY_CORE_NAME);
      const libraryEntry = {
        type: 'card-index',
        cardId: cardCoreName,
        createdAt,
        provider: 'wormhole',
        model: undefined,
        coreName: cardCoreName,
        coreKey: coreInfo?.key,
        coreDiscoveryKey: coreInfo?.discoveryKey,
        parentCardId: ingestSet.setId,
        setId: ingestSet.setId,
        memberOfSets,
      } as any;

      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));

      try {
        await addCardToWormholeIngestSet({
          cardId: cardCoreName,
          cardName: fileName,
          addedAt: createdAt,
        });
      } catch (err) {
        console.warn('[Wormhole] Failed to add card to wormhole ingest set:', err);
      }

      // Emit to persistence layer
      emitCardEvent('CARD_CREATED', {
        id: cardCoreName,
        type: 'standard',
        mediaKind: mediaType,
        createdAt,
      });

      return {
        contentId,
        cardId: cardCoreName,
        hypercoreKey: coreInfo?.key,
        mediaType,
        status: 'complete',
      };
    },
  );

  ipcMain.handle(
    'wormhole-run-transcription',
    async (
      _event,
      payload: { cardId: string; overrideProvider?: string; overrideModel?: string },
    ) => {
      const opId = `transcription-${Date.now()}`;
      startOperation(opId, 'transcription');

      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        endOperation(opId);
        throw new Error('cardId is required for Wormhole transcription.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; cannot run transcription.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.type === 'card') {
            cardRecord = parsed;
            break;
          }
        } catch {
          // ignore parse errors
        }
      }

      if (!cardRecord) {
        throw new Error('Card record not found in Hypercore for Wormhole transcription.');
      }

      const mediaType = (cardRecord.mediaType || '').toString();
      if (mediaType !== 'audio') {
        throw new Error('Wormhole transcription currently supports audio cards only.');
      }

      const audioInfo = cardRecord.audio;
      const localPath = audioInfo && typeof audioInfo.localPath === 'string' ? audioInfo.localPath : '';
      if (!localPath) {
        throw new Error('Audio card does not have a localPath for transcription.');
      }

      const globalWormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};
      let provider: 'gemini' | 'openai' | 'llama-local' | 'none' = 'openai';
      if (overrideProvider && typeof overrideProvider === 'string') {
        provider = overrideProvider as any;
      } else if (
        globalWormhole.transcription &&
        typeof globalWormhole.transcription.provider === 'string' &&
        globalWormhole.transcription.provider.trim().length > 0
      ) {
        provider = globalWormhole.transcription.provider as any;
      }

      const model: string | undefined =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) ||
        (globalWormhole.transcription && typeof globalWormhole.transcription.model === 'string'
          ? (globalWormhole.transcription.model as string)
          : undefined);

      if (provider !== 'openai') {
        throw new Error('Wormhole transcription is currently implemented only for OpenAI provider.');
      }

      const apiKey = store.get('openaiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('OpenAI API Key not found. Please configure it in Settings.');
      }

      // Read audio - use let so we can null after use
      let audioBuffer: Buffer | null = await fs.promises.readFile(localPath);
      const audioSizeMB = audioBuffer.length / (1024 * 1024);
      console.log('[Transcription] Audio size:', audioSizeMB.toFixed(2), 'MB');

      let base64: string | null = audioBuffer.toString('base64');
      audioBuffer = null; // Release buffer after encoding

      const ext = path.extname(localPath || '').toLowerCase();
      let mimeType = 'audio/mpeg';
      if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.mp3') mimeType = 'audio/mpeg';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.flac') mimeType = 'audio/flac';
      else if (ext === '.m4a') mimeType = 'audio/mp4';

      const transcriptText = (await transcribeAudioWithOpenAI(base64, mimeType, apiKey)).trim();
      base64 = null; // Release base64 after API call
      hintGC();
      if (!transcriptText) {
        throw new Error('Transcription produced empty text.');
      }

      const now = new Date().toISOString();

      const transcriptRecord = {
        type: 'wormhole-transcript',
        cardId,
        createdAt: now,
        provider: 'openai',
        model: model || 'whisper-1',
        mimeType,
        text: transcriptText,
      } as any;

      await appendToCore(cardId, JSON.stringify(transcriptRecord));

      const existingProcessing =
        (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
      const existingTranscription = (existingProcessing as any).transcription || {};

      const nextProcessing = {
        ...existingProcessing,
        transcription: {
          status: 'complete',
          provider: 'openai',
          model: model || 'whisper-1',
          startedAt: existingTranscription.startedAt || now,
          completedAt: now,
          error: undefined,
        },
      } as any;

      const nextCardRecord = {
        ...cardRecord,
        updatedAt: now,
        transcriptAvailable: true,
        wormhole: {
          ...(cardRecord.wormhole || {}),
          processing: nextProcessing,
        },
      } as any;

      await appendToCore(cardId, JSON.stringify(nextCardRecord));

      endOperation(opId);
      return {
        cardId,
        step: 'transcription',
        status: nextProcessing.transcription,
      };
    },
  );

  ipcMain.handle(
    'wormhole-run-summarization',
    async (
      _event,
      payload: { cardId: string; overrideProvider?: string; overrideModel?: string },
    ) => {
      const opId = `summarization-${Date.now()}`;
      startOperation(opId, 'summarization');

      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        endOperation(opId);
        throw new Error('cardId is required for Wormhole summarization.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; cannot run summarization.');
      }

      let cardRecord: any = null;
      const transcripts: any[] = [];

      for (let i = 0; i < records.length; i += 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind)) {
            cardRecord = parsed;
          } else if (parsed && parsed.type === 'wormhole-transcript') {
            transcripts.push(parsed);
          }
        } catch {
          // ignore parse errors
        }
      }

      if (!cardRecord) {
        throw new Error('Card record not found in Hypercore for Wormhole summarization.');
      }

      // Determine media type - support both old mediaType and new mediaKind
      const mediaType = (cardRecord.mediaType || cardRecord.mediaKind || '').toString();
      console.log('[Summarization] Card mediaType:', mediaType, 'cardId:', cardId);

      // Get model configuration
      const globalWormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};
      let provider: 'gemini' | 'openai' | 'llama-local' | 'none' = 'gemini';
      if (overrideProvider && typeof overrideProvider === 'string') {
        provider = overrideProvider as any;
      } else if (
        globalWormhole.summarization &&
        typeof globalWormhole.summarization.provider === 'string' &&
        globalWormhole.summarization.provider.trim().length > 0
      ) {
        provider = globalWormhole.summarization.provider as any;
      } else if (
        globalWormhole.defaultModel &&
        typeof globalWormhole.defaultModel.provider === 'string'
      ) {
        // Fall back to default model if set
        provider = globalWormhole.defaultModel.provider as any;
      }

      const configuredModel: string | undefined =
        globalWormhole.summarization?.model ||
        globalWormhole.defaultModel?.model ||
        undefined;

      const modelName =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) ||
        configuredModel ||
        'gemini-2.5-flash'; // Updated default to multimodal-capable model

      if (provider !== 'gemini') {
        throw new Error('Wormhole summarization is currently implemented only for Gemini provider.');
      }

      // Get comprehensive context for all card types (scrolls, prompts, derivatives)
      const comprehensiveContext = await buildComprehensiveContext(cardRecord, cardId);

      const now = new Date().toISOString();
      const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let newSummaries: any[] = [];
      let usedModel = modelName;

      // Route based on media type
      if (mediaType === 'image') {
        // IMAGE CARD: Use visual analysis
        const ingest = cardRecord.wormhole?.ingest;
        const imagePath = ingest?.originalPath || cardRecord.mediaLocalPath;

        if (!imagePath) {
          throw new Error('Image card does not have a file path for analysis.');
        }

        console.log('[Summarization] Running image analysis on:', imagePath);
        const analysis = await analyzeImageWithGemini(imagePath, comprehensiveContext, modelName);
        usedModel = analysis.model;

        newSummaries = [
          {
            id: `${baseId}-visual`,
            kind: 'visual-analysis',
            description: analysis.description,
            colors: analysis.colors,
            themes: analysis.themes,
            mood: analysis.mood,
            people: analysis.people,
            textContent: analysis.textContent,
            technicalStyle: analysis.technicalStyle,
            text: analysis.medium,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-short`,
            kind: 'short',
            text: analysis.short,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-medium`,
            kind: 'medium',
            text: analysis.medium,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
        ];
      } else if (mediaType === 'video') {
        // VIDEO CARD: Use video analysis
        const ingest = cardRecord.wormhole?.ingest;
        const videoPath = ingest?.originalPath || cardRecord.mediaLocalPath;

        if (!videoPath) {
          throw new Error('Video card does not have a file path for analysis.');
        }

        console.log('[Summarization] Running video analysis on:', videoPath);
        const analysis = await analyzeVideoWithGemini(videoPath, comprehensiveContext, modelName);
        usedModel = analysis.model;

        newSummaries = [
          {
            id: `${baseId}-visual`,
            kind: 'visual-analysis',
            description: analysis.description,
            colors: analysis.colors,
            themes: analysis.themes,
            mood: analysis.mood,
            people: analysis.people,
            textContent: analysis.textContent,
            technicalStyle: analysis.technicalStyle,
            text: analysis.medium,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-short`,
            kind: 'short',
            text: analysis.short,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-medium`,
            kind: 'medium',
            text: analysis.medium,
            provider: 'gemini',
            model: analysis.model,
            createdAt: now,
            version: 'v1',
          },
        ];
      } else {
        // TEXT/AUDIO/OTHER: Use text summarization (existing logic)
        let textSource = '';

        // Check for transcripts first (audio cards)
        if (transcripts.length > 0) {
          const latest = transcripts[transcripts.length - 1];
          if (latest && typeof latest.text === 'string') {
            textSource = latest.text as string;
          }
        }

        // Try to read from original file (text/markdown)
        if (!textSource) {
          const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
          const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';
          if (originalPath && (mediaType === 'text' || mediaType === 'markdown')) {
            try {
              const buf = await fs.promises.readFile(originalPath, 'utf-8');
              textSource = buf.toString();
            } catch (error) {
              console.error('Failed to read original text file for Wormhole summarization:', error);
            }
          }
        }

        // Include scroll context in text summarization
        if (comprehensiveContext) {
          textSource = `${textSource}\n\n--- ATTACHED SCROLLS ---\n${comprehensiveContext}`;
        }

        const cleanedText = (textSource || '').trim();
        if (!cleanedText) {
          throw new Error('No text source available for Wormhole summarization. For text/audio cards, run transcription or ingest text first. For image/video cards, ensure the file path is valid.');
        }

        const { short, medium, outline, model } = await summarizeTextWithGemini(cleanedText, modelName);
        usedModel = model;

        if (!medium) {
          throw new Error('Summarization produced empty text.');
        }

        const outlineText = outline.join('\n');
        newSummaries = [
          {
            id: `${baseId}-short`,
            kind: 'short',
            text: short || medium,
            provider: 'gemini',
            model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-medium`,
            kind: 'medium',
            text: medium,
            provider: 'gemini',
            model,
            createdAt: now,
            version: 'v1',
          },
          {
            id: `${baseId}-outline`,
            kind: 'outline',
            text: outlineText,
            provider: 'gemini',
            model,
            createdAt: now,
            version: 'v1',
          },
        ];
      }

      const existingSummaries =
        (Array.isArray(cardRecord.summaries) ? (cardRecord.summaries as any[]) : []) || [];
      const updatedSummaries = [...existingSummaries, ...newSummaries];

      const existingProcessing =
        (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
      const existingSummarization = (existingProcessing as any).summarization || {};

      const nextProcessing = {
        ...existingProcessing,
        summarization: {
          status: 'complete',
          provider: 'gemini',
          model: usedModel,
          startedAt: existingSummarization.startedAt || now,
          completedAt: now,
          error: undefined,
        },
      } as any;

      const nextCardRecord = {
        ...cardRecord,
        updatedAt: now,
        summaries: updatedSummaries,
        wormhole: {
          ...(cardRecord.wormhole || {}),
          processing: nextProcessing,
        },
      } as any;

      await appendToCore(cardId, JSON.stringify(nextCardRecord));

      endOperation(opId);
      return {
        cardId,
        step: 'summarization',
        status: nextProcessing.summarization,
      };
    },
  );

  ipcMain.handle(
    'wormhole-run-keyterms',
    async (
      _event,
      payload: { cardId: string; overrideProvider?: string; overrideModel?: string },
    ) => {
      const opId = `keyterms-${Date.now()}`;
      startOperation(opId, 'keyTerms');

      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        endOperation(opId);
        throw new Error('cardId is required for Wormhole key-term extraction.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; cannot run key-term extraction.');
      }

      let cardRecord: any = null;
      const transcripts: any[] = [];

      for (let i = 0; i < records.length; i += 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.mediaType)) {
            cardRecord = parsed;
          } else if (parsed && parsed.type === 'wormhole-transcript') {
            transcripts.push(parsed);
          }
        } catch {
          // ignore parse errors
        }
      }

      if (!cardRecord) {
        throw new Error('Card record not found in Hypercore for Wormhole key-term extraction.');
      }

      // Determine media type - support both old and new formats
      const mediaType = (cardRecord.mediaType || cardRecord.mediaKind || '').toString();
      console.log('[KeyTerms] Card mediaType:', mediaType, 'cardId:', cardId);

      // Build comprehensive context from ALL sources
      const comprehensiveContext = await buildComprehensiveContext(cardRecord, cardId);

      // Build text source from multiple places
      const textParts: string[] = [];

      // 1. Transcripts (for audio/video cards)
      if (transcripts.length > 0) {
        const latest = transcripts[transcripts.length - 1];
        if (latest && typeof latest.text === 'string') {
          textParts.push(`=== TRANSCRIPT ===\n${latest.text}`);
        }
      }

      // 2. Original text file content (for text/markdown cards)
      const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
      const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';
      if (originalPath && (mediaType === 'text' || mediaType === 'markdown')) {
        try {
          const buf = await fs.promises.readFile(originalPath, 'utf-8');
          if (buf.toString().trim()) {
            textParts.push(`=== ORIGINAL CONTENT ===\n${buf.toString()}`);
          }
        } catch (error) {
          console.error('Failed to read original text file for Wormhole key-term extraction:', error);
        }
      }

      // 3. Add comprehensive context (scrolls, summaries, prompts, derivatives)
      if (comprehensiveContext) {
        textParts.push(comprehensiveContext);
      }

      // 4. For image/video cards without text, use visual analysis from summaries
      if ((mediaType === 'image' || mediaType === 'video') && textParts.length === 0) {
        // Check if we have a visual analysis summary
        const visualSummary = cardRecord.summaries?.find((s: any) => s.kind === 'visual-analysis' || s.kind === 'medium');
        if (visualSummary && visualSummary.text) {
          textParts.push(`=== VISUAL CONTENT ANALYSIS ===\n${visualSummary.text}`);
        }
        // Also add visual analysis details if present
        const visualAnalysis = cardRecord.summaries?.find((s: any) => s.kind === 'visual-analysis');
        if (visualAnalysis) {
          const details: string[] = [];
          if (visualAnalysis.description) details.push(`Description: ${visualAnalysis.description}`);
          if (visualAnalysis.colors?.length) details.push(`Colors: ${visualAnalysis.colors.join(', ')}`);
          if (visualAnalysis.themes?.length) details.push(`Themes: ${visualAnalysis.themes.join(', ')}`);
          if (visualAnalysis.mood) details.push(`Mood: ${visualAnalysis.mood}`);
          if (visualAnalysis.people) details.push(`People: ${visualAnalysis.people}`);
          if (visualAnalysis.textContent) details.push(`Visible Text: ${visualAnalysis.textContent}`);
          if (details.length > 0) {
            textParts.push(`=== VISUAL DETAILS ===\n${details.join('\n')}`);
          }
        }
      }

      // Combine all text parts
      const cleanedText = textParts.join('\n\n').trim();
      if (!cleanedText) {
        throw new Error('No text source available for Wormhole key-term extraction. For image/video cards, run Summarization first to generate visual analysis.');
      }

      console.log('[KeyTerms] Text source length:', cleanedText.length, 'chars');

      const globalWormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};
      let provider: 'gemini' | 'openai' | 'llama-local' | 'none' = 'gemini';
      if (overrideProvider && typeof overrideProvider === 'string') {
        provider = overrideProvider as any;
      } else if (
        globalWormhole.keyTerms &&
        typeof globalWormhole.keyTerms.provider === 'string' &&
        globalWormhole.keyTerms.provider.trim().length > 0
      ) {
        provider = globalWormhole.keyTerms.provider as any;
      } else if (
        globalWormhole.defaultModel &&
        typeof globalWormhole.defaultModel.provider === 'string'
      ) {
        provider = globalWormhole.defaultModel.provider as any;
      }

      const configuredModel: string | undefined =
        globalWormhole.keyTerms?.model ||
        globalWormhole.defaultModel?.model ||
        undefined;

      const modelName =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-2.5-flash';

      if (provider !== 'gemini') {
        throw new Error('Wormhole key-term extraction is currently implemented only for Gemini provider.');
      }

      const { terms, model } = await extractKeyTermsWithGemini(cleanedText, modelName);
      if (!terms || terms.length === 0) {
        throw new Error('Key-term extraction produced no terms.');
      }

      const now = new Date().toISOString();
      const existingKeyTerms =
        (Array.isArray(cardRecord.keyTerms) ? (cardRecord.keyTerms as any[]) : []) || [];

      const mergedKeyTerms = [...existingKeyTerms, ...terms];

      const existingProcessing =
        (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
      const existingKeyTermsStep = (existingProcessing as any).keyTerms || {};

      const nextProcessing = {
        ...existingProcessing,
        keyTerms: {
          status: 'complete',
          provider: 'gemini',
          model,
          startedAt: existingKeyTermsStep.startedAt || now,
          completedAt: now,
          error: undefined,
        },
      } as any;

      const nextCardRecord = {
        ...cardRecord,
        updatedAt: now,
        keyTerms: mergedKeyTerms,
        wormhole: {
          ...(cardRecord.wormhole || {}),
          processing: nextProcessing,
        },
      } as any;

      await appendToCore(cardId, JSON.stringify(nextCardRecord));

      endOperation(opId);
      return {
        cardId,
        step: 'keyTerms',
        status: nextProcessing.keyTerms,
      };
    },
  );

  ipcMain.handle(
    'wormhole-run-wiki-update',
    async (
      _event,
      payload: { cardId: string; overrideProvider?: string; overrideModel?: string },
    ) => {
      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required for Wormhole wiki update.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; cannot run wiki update.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.type === 'card') {
            cardRecord = parsed;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!cardRecord) {
        throw new Error('Card record not found in Hypercore for Wormhole wiki update.');
      }

      const keyTerms = Array.isArray(cardRecord.keyTerms) ? (cardRecord.keyTerms as any[]) : [];
      if (!keyTerms || keyTerms.length === 0) {
        throw new Error('No key terms found on this card; run key-term extraction before wiki update.');
      }

      const globalWormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};

      let provider: 'gemini' | 'openai' | 'llama-local' | 'none' = 'none';
      if (overrideProvider && typeof overrideProvider === 'string') {
        provider = overrideProvider as any;
      } else if (
        globalWormhole.wikiUpdate &&
        typeof globalWormhole.wikiUpdate.provider === 'string' &&
        globalWormhole.wikiUpdate.provider.trim().length > 0
      ) {
        provider = globalWormhole.wikiUpdate.provider as any;
      }

      const configuredModel: string | undefined =
        globalWormhole.wikiUpdate && typeof globalWormhole.wikiUpdate.model === 'string'
          ? (globalWormhole.wikiUpdate.model as string)
          : undefined;

      const modelName =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel;

      await createCore(WIKI_CORE_NAME);

      const now = new Date().toISOString();
      const wikiEntries: { term: string; wikiId: string; url?: string }[] = [];

      for (const termObj of keyTerms) {
        const rawTerm = termObj && typeof termObj.term === 'string' ? (termObj.term as string) : '';
        const term = rawTerm.trim();
        if (!term) continue;

        const baseSlug = term
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60);

        const wikiId = `wiki-${baseSlug || 'term'}-${cardId.slice(0, 6)}`;

        const record = {
          type: 'wiki-entry',
          wikiId,
          term,
          kind: termObj && typeof termObj.type === 'string' ? (termObj.type as string) : undefined,
          createdAt: now,
          sourceCardId: cardId,
          source: 'wormhole',
        } as any;

        await appendToCore(WIKI_CORE_NAME, JSON.stringify(record));
        wikiEntries.push({ term, wikiId });
      }

      if (wikiEntries.length === 0) {
        throw new Error('Wiki update did not create any entries from key terms.');
      }

      const existingProcessing =
        (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
      const existingWikiStep = (existingProcessing as any).wikiUpdate || {};

      const nextProcessing = {
        ...existingProcessing,
        wikiUpdate: {
          status: 'complete',
          provider,
          model: modelName,
          startedAt: existingWikiStep.startedAt || now,
          completedAt: now,
          error: undefined,
        },
      } as any;

      const nextCardRecord = {
        ...cardRecord,
        updatedAt: now,
        wormhole: {
          ...(cardRecord.wormhole || {}),
          processing: nextProcessing,
          wikiEntries,
        },
      } as any;

      await appendToCore(cardId, JSON.stringify(nextCardRecord));

      return {
        cardId,
        step: 'wikiUpdate',
        status: nextProcessing.wikiUpdate,
      };
    },
  );

  ipcMain.handle(
    'wormhole-get-status',
    async (
      _event,
      payload: { cardId?: string; contentId?: string },
    ) => {
      const { cardId, contentId } = payload || ({} as any);

      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required for Wormhole status at this time.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; cannot read Wormhole status.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.type === 'card') {
            cardRecord = parsed;
            break;
          }
        } catch {
          // ignore parse errors
        }
      }

      if (!cardRecord || !cardRecord.wormhole) {
        throw new Error('Wormhole metadata not found on this card.');
      }

      const ingest = cardRecord.wormhole.ingest || {};
      const processing = (cardRecord.wormhole.processing || {}) as any;

      const makeStep = (existing: any, fallbackStatus: string) => ({
        status: (existing && existing.status) || fallbackStatus,
        provider: existing && existing.provider,
        model: existing && existing.model,
        startedAt: existing && existing.startedAt,
        completedAt: existing && existing.completedAt,
        error: existing && existing.error,
      });

      const status = {
        cardId,
        contentId: ingest.contentId || contentId || '',
        processing: {
          ingest: makeStep(processing.ingest, 'complete'),
          transcription: processing.transcription
            ? makeStep(processing.transcription, 'pending')
            : undefined,
          summarization: processing.summarization
            ? makeStep(processing.summarization, 'pending')
            : undefined,
          keyTerms: processing.keyTerms ? makeStep(processing.keyTerms, 'pending') : undefined,
          wikiUpdate: processing.wikiUpdate
            ? makeStep(processing.wikiUpdate, 'pending')
            : undefined,
        },
      } as any;

      return status;
    },
  );

  ipcMain.handle(
    'wormhole-get-derived-artifacts',
    async (
      _event,
      payload: { cardId: string },
    ) => {
      const { cardId } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required for Wormhole derived artifacts.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty; no artifacts available.');
      }

      let cardRecord: any = null;
      const transcripts: any[] = [];

      for (let i = 0; i < records.length; i += 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.type === 'card') {
            cardRecord = parsed;
          } else if (parsed && parsed.type === 'wormhole-transcript') {
            transcripts.push({
              id: parsed.id || String(i),
              text: parsed.text || '',
              createdAt: parsed.createdAt || '',
              provider: parsed.provider || '',
              model: parsed.model,
            });
          }
        } catch {
          // ignore
        }
      }

      if (!cardRecord || !cardRecord.wormhole) {
        throw new Error('Wormhole metadata not found on this card.');
      }

      const ingest = cardRecord.wormhole.ingest || {};
      const summaries = Array.isArray(cardRecord.summaries) ? (cardRecord.summaries as any[]) : [];
      const keyTerms = Array.isArray(cardRecord.keyTerms) ? (cardRecord.keyTerms as any[]) : [];
      const wikiEntries =
        Array.isArray(cardRecord.wormhole.wikiEntries) && cardRecord.wormhole.wikiEntries.length > 0
          ? (cardRecord.wormhole.wikiEntries as any[])
          : [];

      const result = {
        cardId,
        contentId: ingest.contentId || '',
        transcripts,
        summaries,
        keyTerms,
        wikiEntries,
      } as any;

      return result;
    },
  );

  ipcMain.handle(
    'wormhole-get-card-text',
    async (
      _event,
      payload: { cardId: string },
    ) => {
      const { cardId } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required to get card text.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.type === 'card') {
            cardRecord = parsed;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!cardRecord) {
        throw new Error('Card record not found.');
      }

      // Check for direct text content first
      if (typeof cardRecord.text === 'string' && cardRecord.text.length > 0) {
        return cardRecord.text;
      }
      if (typeof cardRecord.content === 'string' && cardRecord.content.length > 0) {
        return cardRecord.content;
      }
      if (cardRecord.data && typeof cardRecord.data.text === 'string' && cardRecord.data.text.length > 0) {
        return cardRecord.data.text;
      }

      // Fallback to reading from originalPath if available
      const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
      const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';

      if (originalPath) {
        try {
          const buf = await fs.promises.readFile(originalPath, 'utf-8');
          return buf.toString();
        } catch (error) {
          console.error('Failed to read original text file:', error);
          return '';
        }
      }

      return '';
    },
  );

  // ============================================
  // SCROLL ATTACHMENT HANDLERS
  // ============================================

  // Attach a scroll (text/markdown card) to another card
  ipcMain.handle(
    'attach-card-scroll',
    async (
      _event,
      payload: {
        cardId: string;
        scrollCardId: string;
        label?: string;
        includeInSummarization?: boolean;
        includeInKeyTerms?: boolean;
        includeInWikiUpdate?: boolean;
      },
    ) => {
      const { cardId, scrollCardId, label, includeInSummarization = true, includeInKeyTerms = true, includeInWikiUpdate = true } = payload || ({} as any);

      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required to attach scroll.');
      }
      if (!scrollCardId || typeof scrollCardId !== 'string') {
        throw new Error('scrollCardId is required to attach scroll.');
      }
      if (cardId === scrollCardId) {
        throw new Error('Cannot attach a card as a scroll to itself.');
      }

      // Read the target card
      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
            cardRecord = parsed;
            break;
          }
        } catch { /* ignore */ }
      }

      if (!cardRecord) {
        throw new Error('Card record not found.');
      }

      // Verify scroll card exists and is text/markdown
      const scrollRecords = await readCore(scrollCardId);
      if (!Array.isArray(scrollRecords) || scrollRecords.length === 0) {
        throw new Error('Scroll card not found.');
      }

      let scrollCardRecord: any = null;
      for (let i = scrollRecords.length - 1; i >= 0; i -= 1) {
        const raw = scrollRecords[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
            scrollCardRecord = parsed;
            break;
          }
        } catch { /* ignore */ }
      }

      if (!scrollCardRecord) {
        throw new Error('Scroll card record not found.');
      }

      const scrollMediaType = scrollCardRecord.mediaType || scrollCardRecord.mediaKind || '';
      if (scrollMediaType !== 'text' && scrollMediaType !== 'markdown') {
        throw new Error(`Scroll must be a text or markdown card. Got: ${scrollMediaType}`);
      }

      // Add scroll to card's scrolls array
      const existingScrolls = Array.isArray(cardRecord.scrolls) ? cardRecord.scrolls : [];

      // Check if already attached
      if (existingScrolls.some((s: any) => s.cardId === scrollCardId)) {
        throw new Error('This scroll is already attached to the card.');
      }

      const newScroll = {
        cardId: scrollCardId,
        label: label || scrollCardRecord.title || scrollCardRecord.name || scrollCardId,
        attachedAt: new Date().toISOString(),
        includeInSummarization,
        includeInKeyTerms,
        includeInWikiUpdate,
      };

      const updatedCardRecord = {
        ...cardRecord,
        updatedAt: new Date().toISOString(),
        scrolls: [...existingScrolls, newScroll],
      };

      await appendToCore(cardId, JSON.stringify(updatedCardRecord));
      console.log('[Scroll] Attached scroll', scrollCardId, 'to card', cardId);

      return { success: true, scroll: newScroll };
    },
  );

  // Detach a scroll from a card
  ipcMain.handle(
    'detach-card-scroll',
    async (
      _event,
      payload: { cardId: string; scrollCardId: string },
    ) => {
      const { cardId, scrollCardId } = payload || ({} as any);

      if (!cardId || typeof cardId !== 'string') {
        throw new Error('cardId is required to detach scroll.');
      }
      if (!scrollCardId || typeof scrollCardId !== 'string') {
        throw new Error('scrollCardId is required to detach scroll.');
      }

      const records = await readCore(cardId);
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Card Hypercore is empty.');
      }

      let cardRecord: any = null;
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const raw = records[i];
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
            cardRecord = parsed;
            break;
          }
        } catch { /* ignore */ }
      }

      if (!cardRecord) {
        throw new Error('Card record not found.');
      }

      const existingScrolls = Array.isArray(cardRecord.scrolls) ? cardRecord.scrolls : [];
      const filteredScrolls = existingScrolls.filter((s: any) => s.cardId !== scrollCardId);

      if (filteredScrolls.length === existingScrolls.length) {
        throw new Error('Scroll not found on this card.');
      }

      const updatedCardRecord = {
        ...cardRecord,
        updatedAt: new Date().toISOString(),
        scrolls: filteredScrolls,
      };

      await appendToCore(cardId, JSON.stringify(updatedCardRecord));
      console.log('[Scroll] Detached scroll', scrollCardId, 'from card', cardId);

      return { success: true };
    },
  );

  // Get list of text/markdown cards for scroll picker
  ipcMain.handle('get-text-cards-for-scroll', async () => {
    try {
      const records = await readCore(CARD_LIBRARY_CORE_NAME);
      const textCards: any[] = [];
      const seenCardIds = new Set<string>();

      for (const raw of records) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const data = JSON.parse(raw);
          if (!data || data.type !== 'card-index') continue;

          const cardId = data.cardId || data.coreName;
          if (!cardId || seenCardIds.has(cardId)) continue;
          seenCardIds.add(cardId);

          // Check index entry first for mediaType
          let mediaType = data.mediaType || data.mediaKind || '';
          let name = data.name || data.title || cardId;

          // If no mediaType in index, read the actual card core
          if (!mediaType) {
            try {
              const cardRecords = await readCore(cardId);
              if (Array.isArray(cardRecords) && cardRecords.length > 0) {
                // Find the card record (usually last one with type='card')
                for (let i = cardRecords.length - 1; i >= 0; i--) {
                  const cardRaw = cardRecords[i];
                  if (!cardRaw || typeof cardRaw !== 'string') continue;
                  try {
                    const cardData = JSON.parse(cardRaw);
                    if (cardData && (cardData.type === 'card' || cardData.mediaType || cardData.mediaKind)) {
                      mediaType = cardData.mediaType || cardData.mediaKind || '';
                      name = cardData.name || cardData.title || name;
                      break;
                    }
                  } catch { /* ignore */ }
                }
              }
            } catch { /* card core might not exist */ }
          }

          // Check if it's a text or markdown card
          if (mediaType === 'text' || mediaType === 'markdown') {
            textCards.push({
              cardId,
              name,
              mediaType,
              createdAt: data.createdAt,
            });
          }
        } catch { /* ignore */ }
      }

      // Sort by createdAt descending
      textCards.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      console.log('[Scroll] Found', textCards.length, 'text/markdown cards');
      return textCards;
    } catch (error) {
      console.error('[Scroll] Failed to get text cards:', error);
      return [];
    }
  });

  ipcMain.handle('wormhole-get-wiki-index', async () => {
    try {
      const records = await readCore(WIKI_CORE_NAME);
      const entryList: any[] = [];
      const metaMap: Record<string, any> = {};

      for (const raw of records) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const data = JSON.parse(raw);
          if (!data || typeof data.type !== 'string') continue;

          if (data.type === 'wiki-entry') {
            entryList.push({
              wikiId: String(data.wikiId || ''),
              term: String(data.term || ''),
              kind: typeof data.kind === 'string' ? data.kind : undefined,
              createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
              sourceCardId: typeof data.sourceCardId === 'string' ? data.sourceCardId : undefined,
              raw: data,
            });
          } else if (data.type === 'wiki-term-meta') {
            const term = (String(data.term || '').trim() || '(untitled term)');
            const key = term.toLowerCase();
            const updatedAt =
              typeof data.updatedAt === 'string'
                ? data.updatedAt
                : typeof data.createdAt === 'string'
                  ? data.createdAt
                  : '';

            const relatedTerms = Array.isArray(data.relatedTerms)
              ? (data.relatedTerms as any[])
                .filter((t) => typeof t === 'string' && t.trim().length > 0)
                .map((t: string) => t.trim())
              : undefined;

            metaMap[key] = {
              term,
              slug: typeof data.slug === 'string' ? data.slug : undefined,
              definition: typeof data.definition === 'string' ? data.definition : undefined,
              relatedTerms,
              updatedAt,
              raw: data,
            };
          }
        } catch {
          // ignore parse errors
        }
      }

      return { entryList, metaMap };
    } catch (error: any) {
      console.error('Failed to get wiki index:', error);
      // Return empty if core doesn't exist yet or other error
      return { entryList: [], metaMap: {} };
    }
  });

  // ============================================================================
  // NEXUS (Phase 2) IPC HANDLERS
  // ============================================================================

  ipcMain.handle('nexus:get-settings', async () => {
    return getNexusSettingsInternal();
  });

  ipcMain.handle('nexus:save-settings', async (_event, settings: Partial<NexusSettings>) => {
    return saveNexusSettingsInternal(settings || {});
  });

  type NexusIndexEntry = {
    cardId: string;
    coreName?: string;
    name?: string;
    mediaKind?: string;
    thumbnail?: string;
    mediaLocalPath?: string;
    parentCardId?: string;
    createdAt?: string;
    deleted?: boolean;
    deletedAt?: string;
  };

  const normalizeIndexEntry = (parsed: any): NexusIndexEntry | null => {
    if (!parsed || parsed.type !== 'card-index') return null;
    const id = parsed.cardId || parsed.id || parsed.coreName;
    if (!id) return null;
    return {
      cardId: String(id),
      coreName: parsed.coreName ? String(parsed.coreName) : String(id),
      name: parsed.name,
      mediaKind: parsed.mediaKind,
      thumbnail: parsed.thumbnail,
      mediaLocalPath: parsed.mediaLocalPath,
      parentCardId: parsed.parentCardId,
      createdAt: parsed.createdAt,
      deleted: parsed.deleted === true || parsed.isDeleted === true || parsed.status === 'deleted',
      deletedAt: parsed.deletedAt,
    };
  };

  ipcMain.handle(
    'nexus:index-page',
    async (
      _event,
      payload: {
        coreName?: string;
        cursor?: number;
        limit?: number;
        direction?: 'reverse' | 'forward';
      },
    ) => {
      const coreName = payload?.coreName || CARD_LIBRARY_CORE_NAME;
      const direction = payload?.direction || 'reverse';
      const limit = typeof payload?.limit === 'number' && payload.limit > 0 ? payload.limit : getNexusSettingsInternal().globalPageSize;

      // Prefer local persistence for card-library paging (fast, persistent)
      try {
        if (coreName === CARD_LIBRARY_CORE_NAME) {
          const adapter: any = getPersistence();
          if (adapter && adapter.isReady && adapter.isReady() && typeof adapter.listIndexPage === 'function') {
            const offset = typeof payload?.cursor === 'number' && payload.cursor >= 0 ? payload.cursor : 0;
            const page = adapter.listIndexPage({ offset, limit });
            const items = Array.isArray(page?.items) ? page.items : [];
            const total = typeof page?.total === 'number' ? page.total : items.length;
            const nextCursor = offset + items.length;
            return {
              items,
              nextCursor,
              hasMore: items.length >= limit ? true : nextCursor < total,
              totalLength: total,
            };
          }
        }
      } catch (err) {
        console.warn('[nexus:index-page] Falling back to Hypercore paging:', (err as any)?.message || err);
      }

      const length = await getCoreLength(coreName);
      const windowSize = Math.max(limit * 4, 400);

      if (direction !== 'reverse') {
        // Forward pagination is not currently used by the Nexus UI.
        const start = typeof payload?.cursor === 'number' && payload.cursor >= 0 ? payload.cursor : 0;
        const blocks = await readCore(coreName, { start, limit: windowSize });
        const byId = new Map<string, NexusIndexEntry>();
        const deletedIds = new Set<string>();

        let consumed = 0;

        for (const raw of blocks || []) {
          consumed += 1;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const entry = normalizeIndexEntry(parsed);
            if (!entry) continue;
            if (byId.has(entry.cardId) || deletedIds.has(entry.cardId)) continue;
            if (entry.deleted) {
              deletedIds.add(entry.cardId);
              continue;
            }
            byId.set(entry.cardId, entry);
            if (byId.size >= limit) break;
          } catch {
            // ignore parse errors
          }
        }

        // IMPORTANT: advance cursor by how many blocks we actually consumed.
        // If we stop early after reaching `limit`, we must not skip the remaining
        // blocks in this window, otherwise the caller gets stuck at 1 page.
        const nextCursor = Math.min(length, start + Math.max(0, consumed));
        return {
          items: Array.from(byId.values()),
          nextCursor,
          hasMore: nextCursor < length,
          totalLength: length,
        };
      }

      let cursor = typeof payload?.cursor === 'number' && payload.cursor >= 0 ? payload.cursor : length;
      const items: NexusIndexEntry[] = [];
      const seen = new Set<string>();

      while (cursor > 0 && items.length < limit) {
        const startCursor = cursor;
        const blocks = await readCore(coreName, { reverse: true, start: startCursor, limit: windowSize });

        let consumed = 0;

        for (const raw of blocks || []) {
          consumed += 1;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const entry = normalizeIndexEntry(parsed);
            if (!entry) continue;
            if (seen.has(entry.cardId)) continue;
            seen.add(entry.cardId);
            if (entry.deleted) continue;
            items.push(entry);
            if (items.length >= limit) break;
          } catch {
            // ignore parse errors
          }
        }

        // Move cursor by the number of blocks we actually consumed.
        // This prevents a false `hasMore: false` when windowSize is larger than
        // the remaining core length (common when length < 400).
        if (consumed > 0) {
          cursor = Math.max(0, startCursor - consumed);
        } else {
          cursor = Math.max(0, startCursor - windowSize);
        }
      }

      return {
        items,
        nextCursor: cursor,
        hasMore: cursor > 0,
        totalLength: length,
      };
    },
  );

  ipcMain.handle(
    'nexus:card-latest-batch',
    async (
      _event,
      payload: {
        entries: Array<{ cardId: string; coreName?: string }>;
      },
    ) => {
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      const recordsById: Record<string, any> = {};

      const concurrency = 6;
      for (let i = 0; i < entries.length; i += concurrency) {
        const slice = entries.slice(i, i + concurrency);
        const batch = await Promise.all(
          slice.map(async (e) => {
            const cardId = String(e?.cardId || '');
            const coreName = String(e?.coreName || e?.cardId || '');
            if (!cardId || !coreName) return null;
            try {
              const blocks = await readCore(coreName, { reverse: true, limit: 1 });
              const raw = Array.isArray(blocks) ? blocks[0] : undefined;
              if (!raw) return { cardId, record: null };
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              return { cardId, record: parsed };
            } catch {
              return { cardId, record: null };
            }
          }),
        );

        for (const item of batch) {
          if (!item) continue;
          if (!item.record) continue;
          recordsById[item.cardId] = item.record;
        }
      }

      return { recordsById };
    },
  );

  const nexusSearchJobs = new Map<
    string,
    {
      cancelled: boolean;
    }
  >();

  ipcMain.handle(
    'nexus:search-start',
    async (
      _event,
      payload: {
        query: string;
        coreName?: string;
        limit?: number;
      },
    ) => {
      const jobId = `nexus-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const query = String(payload?.query || '').trim().toLowerCase();
      const coreName = payload?.coreName || CARD_LIBRARY_CORE_NAME;
      const limit = typeof payload?.limit === 'number' && payload.limit > 0 ? payload.limit : getNexusSettingsInternal().globalRenderCap;

      const job = { cancelled: false };
      nexusSearchJobs.set(jobId, job);

      const wc = win.webContents;
      const safeSend = (data: any) => {
        try {
          if (!wc || wc.isDestroyed()) return;
          wc.send('nexus:search-update', data);
        } catch {
          // ignore
        }
      };

      (async () => {
        const length = await getCoreLength(coreName);
        let cursor = length;
        const windowSize = 700;
        const seen = new Set<string>();
        const results: NexusIndexEntry[] = [];
        let scanned = 0;

        safeSend({ jobId, status: 'started', query, scanned, cursor, results: [], done: false });

        while (!job.cancelled && cursor > 0 && results.length < limit) {
          const blocks = await readCore(coreName, { reverse: true, start: cursor, limit: windowSize });
          cursor = Math.max(0, cursor - windowSize);
          scanned += Array.isArray(blocks) ? blocks.length : 0;

          const batch: NexusIndexEntry[] = [];
          for (const raw of blocks || []) {
            if (job.cancelled) break;
            try {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              const entry = normalizeIndexEntry(parsed);
              if (!entry) continue;
              if (seen.has(entry.cardId)) continue;
              seen.add(entry.cardId);
              if (entry.deleted) continue;

              const name = String(entry.name || '').toLowerCase();
              const id = String(entry.cardId || '').toLowerCase();
              if (query && !name.includes(query) && !id.includes(query)) continue;

              batch.push(entry);
              results.push(entry);
              if (results.length >= limit) break;
            } catch {
              // ignore
            }
          }

          if (batch.length > 0) {
            safeSend({ jobId, status: 'update', query, scanned, cursor, results: batch, done: false });
          }

          // Yield to keep main process responsive.
          await new Promise((r) => setTimeout(r, 0));
        }

        safeSend({ jobId, status: 'done', query, scanned, cursor, results: [], done: true });
        nexusSearchJobs.delete(jobId);
      })();

      return { jobId };
    },
  );

  ipcMain.handle('nexus:search-cancel', async (_event, payload: { jobId: string }) => {
    const jobId = String(payload?.jobId || '');
    const job = nexusSearchJobs.get(jobId);
    if (job) job.cancelled = true;
    return { ok: true };
  });

  ipcMain.handle(
    'card:delete',
    async (
      _event,
      payload: {
        cardId: string;
        deleteAssets?: boolean;
      },
    ) => {
      const cardId = String(payload?.cardId || '').trim();
      if (!cardId) {
        throw new Error('card:delete requires cardId');
      }

      const deleteAssets = payload?.deleteAssets === true;
      const deletedAt = new Date().toISOString();

      await createCore(cardId);
      await appendToCore(
        cardId,
        JSON.stringify({ type: 'card-deleted', cardId, deletedAt }),
      );

      await createCore(CARD_LIBRARY_CORE_NAME);
      await appendToCore(
        CARD_LIBRARY_CORE_NAME,
        JSON.stringify({
          type: 'card-index',
          cardId,
          coreName: cardId,
          deleted: true,
          deletedAt,
          createdAt: deletedAt,
          provider: 'system',
          model: 'delete',
        }),
      );

      try {
        await emitCardDeleted({ id: cardId, deletedAt });
      } catch (err) {
        console.error('[Persistence] Failed to emit CARD_DELETED:', err);
      }

      let deletedAssets: string[] = [];
      if (deleteAssets) {
        try {
          const userDataDir = app.getPath('userData');
          const userDataLower = userDataDir.replace(/\\/g, '/').toLowerCase();

          const blocks = await readCore(cardId, { reverse: true, limit: 30 });
          const candidates = new Set<string>();

          for (const raw of blocks || []) {
            if (!raw || typeof raw !== 'string') continue;
            try {
              const rec = JSON.parse(raw);
              const maybeAdd = (p: any) => {
                if (!p || typeof p !== 'string') return;
                const normalized = p.startsWith('file://') ? p.replace(/^file:\/\//, '') : p;
                candidates.add(normalized);
              };

              maybeAdd(rec?.mediaLocalPath);
              maybeAdd(rec?.image?.localPath);
              maybeAdd(rec?.video?.localPath);
              maybeAdd(rec?.audio?.localPath);
              maybeAdd(rec?.wormhole?.ingest?.originalPath);
              maybeAdd(rec?.cardData?.htmlPath);
              maybeAdd(rec?.cardData?.htmlFilePath);
            } catch {
              // ignore
            }
          }

          for (const p of candidates) {
            try {
              const resolved = path.resolve(p).replace(/\\/g, '/');
              const resolvedLower = resolved.toLowerCase();
              if (!resolvedLower.startsWith(userDataLower)) continue;
              const stat = await fs.promises.stat(resolved).catch(() => null);
              if (!stat || !stat.isFile()) continue;
              await fs.promises.unlink(resolved);
              deletedAssets.push(resolved);
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.error('[CardDelete] Asset cleanup failed:', err);
        }
      }

      return {
        ok: true,
        cardId,
        deletedAt,
        deletedAssets,
      };
    },
  );

  // P2P IPC handlers
  ipcMain.handle('p2p-create-core', async (_event, name: string) => {
    return createCore(name);
  });

  ipcMain.handle(
    'p2p-append',
    async (
      _event,
      { name, data }: { name: string; data: string },
    ) => {
      return appendToCore(name, data);
    },
  );

  ipcMain.handle('p2p-read', async (_event, name: string, options: any) => {
    return readCore(name, options);
  });

  ipcMain.handle('p2p-get-length', async (_event, name: string) => {
    return getCoreLength(name);
  });

  ipcMain.handle('read-file-as-base64', async (_event, filePath: string) => {
    const p = typeof filePath === 'string' ? filePath : '';
    if (!p) {
      throw new Error('read-file-as-base64 requires filePath');
    }

    const buf = await fs.promises.readFile(p);
    const base64 = buf.toString('base64');
    const ext = path.extname(p).toLowerCase();
    const mimeType = (() => {
      if (ext === '.png') return 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
      if (ext === '.gif') return 'image/gif';
      if (ext === '.webp') return 'image/webp';
      if (ext === '.bmp') return 'image/bmp';
      if (ext === '.svg') return 'image/svg+xml';
      if (ext === '.mp4') return 'video/mp4';
      if (ext === '.webm') return 'video/webm';
      return 'application/octet-stream';
    })();

    return { base64, mimeType };
  });

  // ============================================================================
  // CARD SETS IPC HANDLERS
  // ============================================================================

  // Get all card sets
  ipcMain.handle('card-sets:list', async () => {
    try {
      await createCore(CARD_SETS_CORE_NAME);
      const records = await readCore(CARD_SETS_CORE_NAME);
      const sets: any[] = [];

      for (const raw of records) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'card-set' || parsed.type === 'merged-set') {
            sets.push(parsed);
          }
        } catch { /* ignore parse errors */ }
      }

      // Sort by createdAt descending (newest first)
      sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return sets;
    } catch (err: any) {
      console.error('[CardSets] Error listing sets:', err.message);
      return [];
    }
  });

  // Get a specific card set by ID
  ipcMain.handle('card-sets:get', async (_event, setId: string) => {
    try {
      const records = await readCore(CARD_SETS_CORE_NAME);

      for (const raw of records) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.setId === setId || parsed.mergedSetId === setId) {
            return parsed;
          }
        } catch { /* ignore */ }
      }
      return null;
    } catch (err: any) {
      console.error('[CardSets] Error getting set:', err.message);
      return null;
    }
  });

  // Create a new card set (called by pipeline)
  ipcMain.handle('card-sets:create', async (_event, cardSet: any) => {
    try {
      await createCore(CARD_SETS_CORE_NAME);
      await appendToCore(CARD_SETS_CORE_NAME, JSON.stringify(cardSet));
      console.log('[CardSets] Created card set:', cardSet.setId, cardSet.name);
      return { success: true, setId: cardSet.setId };
    } catch (err: any) {
      console.error('[CardSets] Error creating set:', err.message);
      throw err;
    }
  });

  // Create a merged set (references other sets)
  ipcMain.handle('card-sets:create-merged', async (_event, mergedSet: any) => {
    try {
      await createCore(CARD_SETS_CORE_NAME);
      const record = {
        ...mergedSet,
        type: 'merged-set',
        mergedSetId: mergedSet.mergedSetId || `merged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await appendToCore(CARD_SETS_CORE_NAME, JSON.stringify(record));
      console.log('[CardSets] Created merged set:', record.mergedSetId, record.name);
      return { success: true, mergedSetId: record.mergedSetId };
    } catch (err: any) {
      console.error('[CardSets] Error creating merged set:', err.message);
      throw err;
    }
  });

  // Get cards for a set (resolves merged sets recursively)
  ipcMain.handle('card-sets:get-card-ids', async (_event, setId: string) => {
    try {
      const records = await readCore(CARD_SETS_CORE_NAME);
      const cardIds: Set<string> = new Set();

      // Helper to resolve a set
      const resolveSet = (id: string, visited: Set<string>) => {
        if (visited.has(id)) return; // Prevent cycles
        visited.add(id);

        for (const raw of records) {
          if (!raw || typeof raw !== 'string') continue;
          try {
            const parsed = JSON.parse(raw);

            // Direct card set
            if (parsed.type === 'card-set' && parsed.setId === id) {
              parsed.cardIds?.forEach((cid: string) => cardIds.add(cid));
            }

            // Merged set - resolve references
            if (parsed.type === 'merged-set' && parsed.mergedSetId === id) {
              parsed.sourceSetIds?.forEach((sid: string) => resolveSet(sid, visited));
              parsed.sourceMergedSetIds?.forEach((mid: string) => resolveSet(mid, visited));
            }
          } catch { /* ignore */ }
        }
      };

      resolveSet(setId, new Set());
      return Array.from(cardIds);
    } catch (err: any) {
      console.error('[CardSets] Error resolving set card IDs:', err.message);
      return [];
    }
  });

  // ============================================================================
  // PERSISTENCE LAYER IPC HANDLERS
  // ============================================================================

  // Search cards with full-text and filters
  ipcMain.handle('persistence:search-cards', async (_event, query: any) => {
    const adapter = getPersistence();
    if (!adapter || !adapter.isReady()) {
      console.warn('[Persistence] Not ready for search');
      return [];
    }
    try {
      return await adapter.searchCards(query);
    } catch (err: any) {
      console.error('[Persistence] Search error:', err.message);
      return [];
    }
  });

  // Get RAG context for agents
  ipcMain.handle('persistence:get-rag-context', async (_event, query: any) => {
    const adapter = getPersistence();
    if (!adapter || !adapter.isReady()) {
      return [];
    }
    try {
      return await adapter.getRagContext(query);
    } catch (err: any) {
      console.error('[Persistence] RAG error:', err.message);
      return [];
    }
  });

  // Get graph neighbors
  ipcMain.handle('persistence:get-neighbors', async (_event, query: any) => {
    const adapter = getPersistence();
    if (!adapter || !adapter.isReady()) {
      return [];
    }
    try {
      return await adapter.getGraphNeighbors(query);
    } catch (err: any) {
      console.error('[Persistence] Graph error:', err.message);
      return [];
    }
  });

  // Get persistence stats
  ipcMain.handle('persistence:get-stats', async () => {
    const adapter = getPersistence();
    if (!adapter || !adapter.isReady()) {
      return {
        cardCount: 0,
        wikiNodeCount: 0,
        wikiEdgeCount: 0,
        embeddingCount: 0,
        dbSizeBytes: 0,
        projectionVersion: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
    try {
      return await adapter.getStats();
    } catch (err: any) {
      console.error('[Persistence] Stats error:', err.message);
      return null;
    }
  });

  // Profile & System Stats IPC
  ipcMain.handle('get-profile', async () => {
    const profile = store.get('userProfile', { displayName: 'Anon Node', bio: '' });
    console.log('[Profile IPC] get-profile returning:', JSON.stringify(profile));
    return profile;
  });

  ipcMain.handle('save-profile', async (_event, profile: any) => {
    console.log('[Profile IPC] save-profile called with:', JSON.stringify(profile));
    store.set('userProfile', profile);
    const saved = store.get('userProfile');
    console.log('[Profile IPC] After save, stored value:', JSON.stringify(saved));
    return true;
  });

  ipcMain.handle('save-profile-image', async (_event, payload: { bytesBase64: string; mimeType: string }) => {
    const { bytesBase64, mimeType } = payload;
    if (!bytesBase64) throw new Error('No image data provided');

    // 1. Get current profile to check for existing card
    const currentProfile = store.get('userProfile', {}) as any;
    let cardId = currentProfile.profileCardId;
    let isNewCard = false;

    if (!cardId) {
      cardId = `card-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      isNewCard = true;
    }

    // 2. Save image to disk
    const userDataDir = app.getPath('userData');
    const wormholeDir = path.join(userDataDir, 'wormhole');
    await fs.promises.mkdir(wormholeDir, { recursive: true });

    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `profile-${Date.now()}.${ext}`;
    const targetPath = path.join(wormholeDir, fileName);
    const buffer = Buffer.from(bytesBase64, 'base64');
    await fs.promises.writeFile(targetPath, buffer);

    // 3. Create Card Record
    const now = new Date().toISOString();
    const coreInfo = await createCore(cardId); // Create or load existing core

    const cardRecord = {
      type: 'card',
      cardType: 'operator-profile', // Special type
      kind: 'image',
      id: cardId,
      createdAt: now,
      updatedAt: now,
      title: 'Operator Profile Picture',
      mediaType: 'image',
      source: 'user-upload',
      provider: 'local',
      tags: ['operator-profile'],
      image: {
        localPath: targetPath,
        mimeType,
      },
      core: {
        name: cardId,
        key: coreInfo.key,
        discoveryKey: coreInfo.discoveryKey,
        length: coreInfo.length,
      },
    };

    // 4. Append to Card Core
    await appendToCore(cardId, JSON.stringify(cardRecord));

    // 5. If new, append to Card Library
    if (isNewCard) {
      await createCore(CARD_LIBRARY_CORE_NAME);
      const libraryEntry = {
        type: 'card-index',
        cardId: cardId,
        createdAt: now,
        provider: 'local',
        coreName: cardId,
        coreKey: coreInfo.key,
        coreDiscoveryKey: coreInfo.discoveryKey,
        tags: ['operator-profile'],
      };
      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));

      // Emit to persistence layer
      emitCardEvent('CARD_CREATED', {
        id: cardId,
        type: 'operator-profile',
        mediaKind: 'image',
        name: 'Operator Profile Picture',
        createdAt: now,
      });
    }

    // 6. Update Profile
    const imageUrl = `file://${targetPath.replace(/\\/g, '/')}`;
    const newProfile = {
      ...currentProfile,
      profileCardId: cardId,
      avatarUrl: imageUrl,
    };
    store.set('userProfile', newProfile);

    return { cardId, imageUrl };
  });

  ipcMain.handle('get-system-stats', async () => {
    // 1. Storage usage
    let storageUsageBytes = 0;
    let storageFreeBytes = 0;
    let storageTotalBytes = 0;
    try {
      // Simple recursive size
      const getDirSize = async (dir: string): Promise<number> => {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        let size = 0;
        for (const file of files) {
          const filePath = path.join(dir, file.name);
          if (file.isDirectory()) {
            size += await getDirSize(filePath);
          } else {
            const stat = await fs.promises.stat(filePath);
            size += stat.size;
          }
        }
        return size;
      };
      storageUsageBytes = await getDirSize(getStorageDir()).catch(() => 0);

      try {
        // statfs provides accurate free/total for the filesystem containing storageDir.
        const stat: any = await (fs.promises as any).statfs(getStorageDir());
        const bsize = Number(stat?.bsize || stat?.frsize || 0);
        const bavail = Number(stat?.bavail || 0);
        const blocks = Number(stat?.blocks || 0);
        if (bsize > 0) {
          storageFreeBytes = bavail * bsize;
          storageTotalBytes = blocks * bsize;
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }

    // 2. Counts
    let cardCount = 0;
    let wikiEntryCount = 0;
    let wormholeRunCount = 0; // Not easily tracked without scanning all cards, skip for now or approx

    try {
      cardCount = await getCoreLength(CARD_LIBRARY_CORE_NAME).catch(() => 0);
      wikiEntryCount = await getCoreLength(WIKI_CORE_NAME).catch(() => 0);
    } catch {
      // ignore
    }

    // 3. P2P Stats
    const p2pStats = await getP2PStats();

    return {
      storageUsageBytes,
      storageFreeBytes,
      storageTotalBytes,
      storageDir: getStorageDir(),
      cwd: process.cwd(),
      cardCount,
      wikiEntryCount,
      wormholeRunCount,
      p2pPeers: p2pStats.peers,
      p2pPublicKey: p2pStats.publicKey,
    };
  });

  // Repair/Migration: Fix Hell Week cards to have Set Card as parent
  ipcMain.handle('repair-hell-week-parents', async () => {
    console.log('[Repair] Starting Hell Week parent repair...');
    const repaired: string[] = [];
    const errors: string[] = [];

    try {
      // Read all cards from card-library
      const libraryRecords = await readCore(CARD_LIBRARY_CORE_NAME);

      // Build a map of setId -> setCardId from cards that have both
      const setIdToSetCardId: Map<string, string> = new Map();
      const setIdToSetName: Map<string, string> = new Map();

      // First pass: find Set Cards and build mapping
      for (const raw of libraryRecords) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type !== 'card-index') continue;

          // If this is a Set Card, map its ID
          if (parsed.cardType === 'set') {
            // Set Cards use their own cardId as the setId
            setIdToSetCardId.set(parsed.cardId, parsed.cardId);
            if (parsed.name) {
              setIdToSetName.set(parsed.cardId, String(parsed.name));
            }
          }
        } catch { /* ignore */ }
      }

      for (const raw of libraryRecords) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.type !== 'card-index') continue;
          if (parsed.deleted) continue;
          if (parsed.cardType === 'set') continue;

          const setId = typeof parsed.setId === 'string' ? parsed.setId : '';
          if (!setId) continue;
          const setCardId = setIdToSetCardId.get(setId) || setId;
          const setName = setIdToSetName.get(setId);

          const needsParent = !parsed.parentCardId;
          const needsMemberOfSets = !Array.isArray(parsed.memberOfSets) || parsed.memberOfSets.length === 0;
          if (!needsParent && !needsMemberOfSets) continue;

          const memberOfSets = Array.isArray(parsed.memberOfSets) ? parsed.memberOfSets : [];
          const nextMemberOfSets = needsMemberOfSets
            ? [
              {
                setCardId,
                setName,
                joinedAt: parsed.createdAt || new Date().toISOString(),
                addedBy: 'pipeline',
              },
            ]
            : memberOfSets;

          const repairedEntry = {
            ...parsed,
            parentCardId: parsed.parentCardId || setCardId,
            memberOfSets: nextMemberOfSets,
            updatedAt: new Date().toISOString(),
          };

          await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(repairedEntry));
          repaired.push(String(parsed.cardId));
        } catch (err: any) {
          errors.push(err?.message || String(err));
        }
      }

      try {
        const ingestSet = await ensureWormholeIngestSetExists();
        for (const raw of libraryRecords) {
          if (!raw || typeof raw !== 'string') continue;
          try {
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.type !== 'card-index') continue;
            if (parsed.deleted) continue;
            if (parsed.provider !== 'wormhole') continue;
            if (parsed.cardId === ingestSet.setId) continue;

            const needsParent = !parsed.parentCardId;
            const needsSetId = !parsed.setId;
            if (!needsParent && !needsSetId) continue;

            const nextMemberOfSets = Array.isArray(parsed.memberOfSets) && parsed.memberOfSets.length > 0
              ? parsed.memberOfSets
              : [{
                setCardId: ingestSet.setId,
                setName: ingestSet.setName,
                joinedAt: parsed.createdAt || new Date().toISOString(),
                addedBy: 'consume',
              }];

            const updated = {
              ...parsed,
              parentCardId: ingestSet.setId,
              setId: ingestSet.setId,
              memberOfSets: nextMemberOfSets,
              updatedAt: new Date().toISOString(),
            };

            await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(updated));
            repaired.push(String(parsed.cardId));

            try {
              await addCardToWormholeIngestSet({
                cardId: String(parsed.cardId),
                cardName: parsed.name,
                addedAt: parsed.createdAt || new Date().toISOString(),
              });
            } catch {
              // ignore
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      console.log('[Repair] Completed. Repaired:', repaired.length, 'Errors:', errors.length);
      return { repaired: repaired.length, errors, repairedIds: repaired };

    } catch (err: any) {
      console.error('[Repair] Failed:', err);
      return { repaired: 0, errors: [err.message], repairedIds: [] };
    }
  });
}

app.on('ready', async () => {
  // Initialize P2P and optionally auto-start local llama.cpp server, then open the window
  rendererBootReady = false;

  try {
    const overrideDir = typeof process.env.HAPA_STORAGE_DIR === 'string' && process.env.HAPA_STORAGE_DIR.trim().length > 0
      ? process.env.HAPA_STORAGE_DIR.trim()
      : '';
    const defaultDir = path.join(app.getPath('userData'), 'storage');
    setStorageDir(overrideDir || defaultDir, overrideDir ? { force: true } : undefined);
    console.log('[Storage] Configured Hypercore storage', {
      storageDir: getStorageDir(),
      cwd: process.cwd(),
      overrideDir: overrideDir || undefined,
      defaultDir,
    });
  } catch (err) {
    console.error('[Storage] Failed to configure Hypercore storage:', err);
  }

  ipcMain.handle('toggle-dev-tools', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() || mainWindow;
      if (win && !win.isDestroyed()) {
        win.webContents.toggleDevTools();
      }
    } catch (err) {
      console.error('[DevTools] toggle-dev-tools failed:', err);
    }
  });

  if (!HAPA_STRESS_HEADLESS) {
    try {
      splashWindow = createSplashWindow();
    } catch {
      splashWindow = null;
    }
  } else {
    splashWindow = null;
  }

  ipcMain.removeAllListeners('boot:renderer-ready');
  ipcMain.on('boot:renderer-ready', () => {
    rendererBootReady = true;
    maybeShowMain();
  });

  // Create windows first so the splash can paint immediately, then defer heavier init work.
  createWindow();
  if (splashWindow) {
    try {
      splashWindow.show();
    } catch {
      // ignore
    }
  }

  setTimeout(() => {
    try {
      const llamaSettings = getLlamaSettingsInternal();
      if (llamaSettings.autoStart) {
        startLlamaServerInternal().catch((error) => {
          console.error('Failed to auto-start llama server:', error);
        });
      }
    } catch (error) {
      console.error('Failed to read llama settings during auto-start:', error);
    }

    try {
      initP2P();
    } catch (err) {
      console.error('[P2P] Init error:', err);
    }

    // Initialize persistence and then reconcile card-library index entries into SQLite.
    // Ordering matters: P2P must be initialized before we can open/read Hypercores.
    initPersistence()
      .then(async () => {
        try {
          const adapter: any = getPersistence();
          if (!adapter || !adapter.isReady || !adapter.isReady()) return;

          const checkpointKey = 'card_library_index_last_seq';
          const lastSeqStr = getPersistenceMetaValue(checkpointKey);
          const lastSeq = lastSeqStr ? Number.parseInt(lastSeqStr, 10) : 0;
          const start = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq : 0;

          const len = await getCoreLength(CARD_LIBRARY_CORE_NAME);
          const end = typeof len === 'number' ? len : 0;
          if (end <= start) return;

          const CHUNK_BLOCKS = 500;
          const BATCH_EVENTS = 250;
          const batch: any[] = [];
          const flush = async (checkpointValue: number) => {
            if (batch.length > 0) {
              await adapter.applyEvents(batch as any);
              batch.length = 0;
            }
            setPersistenceMetaValue(checkpointKey, String(checkpointValue));
            await new Promise((r) => setTimeout(r, 0));
          };

          for (let cursor = start; cursor < end; cursor += CHUNK_BLOCKS) {
            const chunkEnd = Math.min(end, cursor + CHUNK_BLOCKS);
            const blocks = await readCore(CARD_LIBRARY_CORE_NAME, { start: cursor, end: chunkEnd });
            if (!Array.isArray(blocks) || blocks.length === 0) {
              await flush(chunkEnd);
              continue;
            }

            for (let i = 0; i < blocks.length; i++) {
              const raw = blocks[i];
              if (!raw || typeof raw !== 'string') continue;
              let parsed: any = null;
              try {
                parsed = JSON.parse(raw);
              } catch {
                parsed = null;
              }

              if (!parsed || (parsed.type !== 'card-index' && !parsed.cardId && !parsed.coreName)) continue;

              const id = String(parsed.cardId || parsed.id || parsed.coreName || '').trim();
              if (!id) continue;

              const deleted = parsed.deleted === true || parsed.isDeleted === true || parsed.status === 'deleted';
              const now = new Date().toISOString();
              if (deleted) {
                batch.push({
                  type: 'CARD_DELETED',
                  payload: {
                    id,
                    deletedAt: parsed.deletedAt || now,
                  },
                  timestamp: now,
                });
              } else {
                batch.push({
                  type: 'CARD_CREATED',
                  payload: {
                    id,
                    type: typeof parsed.cardType === 'string' ? parsed.cardType : 'standard',
                    mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                    name: typeof parsed.name === 'string' ? parsed.name : undefined,
                    tier: typeof parsed.tier === 'number' ? parsed.tier : undefined,
                    hellweekRunId: typeof parsed.runId === 'string' ? parsed.runId : undefined,
                    parentId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : now,
                    metadata: {
                      coreName: typeof parsed.coreName === 'string' ? parsed.coreName : id,
                      thumbnail: typeof parsed.thumbnail === 'string' ? parsed.thumbnail : undefined,
                      mediaLocalPath: typeof parsed.mediaLocalPath === 'string' ? parsed.mediaLocalPath : undefined,
                      parentCardId: typeof parsed.parentCardId === 'string' ? parsed.parentCardId : undefined,
                      mediaKind: typeof parsed.mediaKind === 'string' ? parsed.mediaKind : undefined,
                      name: typeof parsed.name === 'string' ? parsed.name : undefined,
                      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
                      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
                    },
                  },
                  timestamp: now,
                });
              }

              if (batch.length >= BATCH_EVENTS) {
                await flush(cursor + i + 1);
              }
            }

            await flush(chunkEnd);
          }
        } catch (err) {
          console.warn('[Persistence] card-library reconcile failed:', err);
        }
      })
      .catch((err) => {
        console.error('[Persistence] Init error:', err);
      });
  }, 0);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
