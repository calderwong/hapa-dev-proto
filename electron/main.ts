import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';
import isDev from 'electron-is-dev';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initP2P, createCore, appendToCore, readCore } from './p2p';

const store: any = new Store();

const GEMINI_REQUEST_LOG_KEY = 'geminiRequestLog';
const GEMINI_REQUEST_LOG_MAX_ENTRIES = 200;
const ADMIN_SETTINGS_KEY = 'adminSettings';
const LLAMA_SETTINGS_KEY = 'llamaSettings';

type AudioMode = 'transcribe' | 'realtime';

interface AdminSettings {
  audioMode: AudioMode;
}

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
) => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (!delta && !done) return;
  win.webContents.send('chat-stream', { provider, delta, done: !!done });
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
  };
};

const saveAdminSettings = (settings: AdminSettings) => {
  store.set(ADMIN_SETTINGS_KEY, settings);
};

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

const REVID_API_BASE = 'https://www.revid.ai/api/public/v2';

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

const getAppIconPath = () => {
  const base = isDev ? '../public' : '../dist';
  return path.join(__dirname, base, 'hapa-cat.png');
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Settings IPC handlers
  ipcMain.handle('get-settings', () => {
    return {
      geminiKey: store.get('geminiKey', ''),
      openaiKey: store.get('openaiKey', ''),
      firebaseConfig: store.get('firebaseConfig', ''),
      revidKey: store.get('revidKey', ''),
    };
  });

  ipcMain.handle(
    'save-settings',
    (
      _event,
      settings: { geminiKey: string; openaiKey: string; firebaseConfig: string; revidKey: string },
    ) => {
      store.set('geminiKey', settings.geminiKey);
      store.set('openaiKey', settings.openaiKey);
      store.set('firebaseConfig', settings.firebaseConfig);
      store.set('revidKey', settings.revidKey);
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
    (_event, settings: AdminSettings) => {
      const next: AdminSettings = {
        audioMode: settings.audioMode === 'realtime' ? 'realtime' : 'transcribe',
      };
      saveAdminSettings(next);
      return true;
    },
  );

  // List available Gemini models
  ipcMain.handle('list-gemini-models', async () => {
    const apiKey = store.get('geminiKey') as string | undefined;

    if (!apiKey) {
      // Fallback list when no API key is configured
      return [
        { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
        { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
        { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
      ];
    }

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
      );
      const data = await response.json();

      if (data.models && Array.isArray(data.models)) {
        return data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            name: (m.name as string).replace('models/', ''),
            displayName: m.displayName || (m.name as string).replace('models/', ''),
            description: m.description || '',
          }));
      }
    } catch (error) {
      console.error('Error fetching models from API:', error);
    }

    // Fallback to common model names on error
    return [
      { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
      { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
      { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
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
    } catch (error) {
      console.error('Error fetching Llama models from local server:', error);
      return [];
    }
  });

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
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName || 'gemini-pro' });

        const toContentHistory = (
          items: { role: string; content: string }[],
        ): any[] =>
          items.map((item) => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.content }],
          }));

        const sendMessageWithRetry = async (
          currentHistory: { role: string; content: string }[],
        ): Promise<string> => {
          try {
            const resolvedModel = (modelName || 'gemini-pro').toString();
            const lowerModel = resolvedModel.toLowerCase();
            const isImageModel =
              lowerModel.includes('image') || lowerModel.includes('nano-banana');

            // For image-generation models (for example Nano Banana / gemini-*-image),
            // use the generateContent image endpoint instead of chat streaming so we
            // can reliably access inlineData image bytes.
            if (isImageModel) {
              const textContext = currentHistory
                .map((item) =>
                  `${item.role === 'model' ? 'Assistant' : 'User'}: ${item.content}`,
                )
                .join('\n');

              const prompt =
                textContext && textContext.trim().length > 0
                  ? `${textContext}\n\nUser: ${message}`
                  : message;

              const contents = [
                {
                  role: 'user',
                  parts: [{ text: prompt }],
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

              return combined || '';
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
              model: modelName || 'gemini-pro',
              payload: {
                history: geminiHistory,
                parts,
              },
            });

            console.log('Sending message to Gemini (stream):', {
              model: modelName,
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
                  broadcastChatStream('gemini', chunkText, false);
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
              broadcastChatStream('gemini', '', true);
              return accumulatedText || (response as any).text?.() || '';
            }

            const responseParts = first.content.parts as any[];
            const imageChunks: string[] = [];

            responseParts.forEach((part, index) => {
              const inline = part.inlineData;
              if (inline?.mimeType && inline?.data) {
                const markdown = `![image ${index + 1}](data:${inline.mimeType};base64,${inline.data})`;
                imageChunks.push(markdown);
              }
            });

            const combined = [accumulatedText, ...imageChunks]
              .filter((chunk) => typeof chunk === 'string' && chunk.trim().length > 0)
              .join('\n\n');

            console.log(
              'Received response from Gemini (stream):',
              combined.substring(0, 50) + '...',
            );

            broadcastChatStream('gemini', '', true);
            return combined || (response as any).text?.() || '';
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
          textContent = `${textContent}\n\n[Note] ${
            videoAttachments.length
          } video attachment(s) were provided. OpenAI chat does not directly consume raw video files in this app; please describe the relevant frames in text.`;
        }

        parts.push({
          type: 'text',
          text: textContent,
        });

        content = parts;
      }

      const openaiPayload = {
        model: modelName || 'gpt-4.1-mini',
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
              broadcastChatStream('openai', '', true);
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

              broadcastChatStream('openai', deltaText, false);
            } catch (error) {
              console.error('Failed to parse OpenAI stream chunk:', error, dataStr);
            }
          }
        }
      }

      return fullText;
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
              broadcastChatStream('llama', '', true);
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

              broadcastChatStream('llama', deltaText, false);
            } catch (error) {
              console.error('Failed to parse Llama stream chunk:', error, dataStr);
            }
          }
        }
      }

      return fullText;
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

  ipcMain.handle('p2p-read', async (_event, name: string) => {
    return readCore(name);
  });

  // Initialize P2P and optionally auto-start local llama.cpp server, then open the window
  initP2P();

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

  createWindow();

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
