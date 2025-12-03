import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';
import isDev from 'electron-is-dev';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initP2P, createCore, appendToCore, readCore, getCoreLength, getP2PStats } from './p2p';

const store: any = new Store();

const GEMINI_REQUEST_LOG_KEY = 'geminiRequestLog';
const GEMINI_REQUEST_LOG_MAX_ENTRIES = 200;
const ADMIN_SETTINGS_KEY = 'adminSettings';
const LLAMA_SETTINGS_KEY = 'llamaSettings';
const WORMHOLE_SETTINGS_KEY = 'wormholeSettings';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const WIKI_CORE_NAME = 'wormhole-wiki-entries';

type AudioMode = 'transcribe' | 'realtime';

interface ImageGenSettings {
  defaultImageModel: string;
  defaultPromptLLM: string;
}

interface AdminSettings {
  audioMode: AudioMode;
  imageGenSettings?: ImageGenSettings;
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

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';

const resolveGeminiModelName = (modelName?: string): string => {
  const trimmed = (modelName || '').toString().trim();
  if (!trimmed || trimmed === 'gemini-pro' || trimmed === 'gemini-1.5-pro') {
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
    },
    autoHideMenuBar: true,
  });

  // Add F12 keyboard shortcut to toggle dev tools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools(); // Use F12 to toggle
  } else {
    win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('toggle-dev-tools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.webContents.toggleDevTools();
    }
  });
  // Settings IPC handlers
  ipcMain.handle('get-settings', () => {
    const wormhole = (store.get(WORMHOLE_SETTINGS_KEY, {}) as any) || {};
    return {
      geminiKey: store.get('geminiKey', ''),
      openaiKey: store.get('openaiKey', ''),
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

  // Generate image for a card using LLM to craft prompt, then image model
  ipcMain.handle(
    'generate-image-for-card',
    async (
      _event,
      {
        cardContext,
        seriesContext,
      }: {
        cardContext: {
          name: string;
          mediaKind?: string;
          text?: string;
          tags?: string[];
          messageContent?: string;
        };
        seriesContext?: {
          imageNumber: number;           // Which image in the series (1, 2, 3...)
          previousPrompt?: string;       // Previous LLM-crafted prompt
          previousImagePath?: string;    // Path to previous image (for potential future use)
        };
      },
    ) => {
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      const adminSettings = getAdminSettings();
      const imageGenSettings = adminSettings.imageGenSettings || {
        defaultImageModel: 'gemini-2.0-flash-preview-image-generation',
        defaultPromptLLM: 'gemini-1.5-pro',
      };

      const imageNumber = seriesContext?.imageNumber || 1;
      const isSeriesContinuation = imageNumber > 1 && seriesContext?.previousPrompt;

      console.log('[ImageGen] Starting image generation for card:', cardContext.name);
      console.log('[ImageGen] Image #', imageNumber, isSeriesContinuation ? '(series continuation)' : '(first image)');
      console.log('[ImageGen] Using LLM:', imageGenSettings.defaultPromptLLM);
      console.log('[ImageGen] Using Image Model:', imageGenSettings.defaultImageModel);

      try {
        // Step 1: Craft image prompt using LLM
        // Build a rich context summary from all available content
        const contentParts: string[] = [];
        
        if (cardContext.name && cardContext.name !== 'Untitled') {
          contentParts.push(`Title: ${cardContext.name}`);
        }
        
        if (cardContext.text) {
          // Truncate to reasonable length for LLM
          const truncatedText = cardContext.text.length > 2000 
            ? cardContext.text.substring(0, 2000) + '...' 
            : cardContext.text;
          contentParts.push(`Content:\n${truncatedText}`);
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

Document/Card Context:
${contextSummary}

Create a vivid image prompt that visually represents this content:`;
        }

        // Call LLM to craft the prompt
        const llmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageGenSettings.defaultPromptLLM}:generateContent?key=${apiKey}`;
        
        const llmResponse = await fetch(llmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptCraftingRequest }] }],
          }),
        });

        if (!llmResponse.ok) {
          const errText = await llmResponse.text();
          throw new Error(`LLM prompt crafting failed: ${errText}`);
        }

        const llmData = await llmResponse.json();
        const craftedPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!craftedPrompt) {
          throw new Error('Failed to craft image prompt from LLM');
        }

        console.log('[ImageGen] Crafted prompt:', craftedPrompt.substring(0, 200) + '...');

        // Step 2: Generate image using the crafted prompt
        const imageUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageGenSettings.defaultImageModel}:generateContent?key=${apiKey}`;

        const imageResponse = await fetch(imageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: craftedPrompt }] }],
          }),
        });

        if (!imageResponse.ok) {
          const errText = await imageResponse.text();
          throw new Error(`Image generation failed: ${errText}`);
        }

        const imageData = await imageResponse.json();
        
        // Extract image from response
        const parts = imageData.candidates?.[0]?.content?.parts || [];
        let imageBase64: string | null = null;
        let mimeType = 'image/png';

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

        // Step 3: Save image to file
        const userDataDir = app.getPath('userData');
        const imagesDir = path.join(userDataDir, 'wormhole', 'card-images');
        await fs.promises.mkdir(imagesDir, { recursive: true });

        const fileName = `card-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
        const filePath = path.join(imagesDir, fileName);
        
        await fs.promises.writeFile(filePath, Buffer.from(imageBase64!, 'base64'));
        console.log('[ImageGen] Saved image to:', filePath);

        return {
          success: true,
          localPath: filePath,
          mimeType,
          craftedPrompt,
        };
      } catch (error: any) {
        console.error('[ImageGen] Error:', error);
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
      const apiKey = store.get('geminiKey') as string | undefined;
      if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
      }

      console.log('[LoopVideo] Starting loop video creation for image:', imageId);
      console.log('[LoopVideo] Original prompt:', originalPrompt?.substring(0, 100));

      try {
        // Step 1: Read the source image and convert to base64
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageBase64 = imageBuffer.toString('base64');
        const imageMimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

        // Step 2: Craft a loop-optimized prompt using LLM
        const adminSettings = getAdminSettings();
        const promptLLM = adminSettings.imageGenSettings?.defaultPromptLLM || 'gemini-1.5-pro';

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

        const llmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${promptLLM}:generateContent?key=${apiKey}`;
        
        const llmResponse = await fetch(llmUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: loopPromptRequest }] }],
          }),
        });

        if (!llmResponse.ok) {
          const errText = await llmResponse.text();
          throw new Error(`LLM prompt crafting failed: ${errText}`);
        }

        const llmData = await llmResponse.json();
        const loopPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!loopPrompt) {
          throw new Error('Failed to craft loop video prompt');
        }

        console.log('[LoopVideo] Crafted loop prompt:', loopPrompt.substring(0, 150));

        // Broadcast progress to renderer
        const broadcastLoopProgress = (data: any) => {
          const [mainWin] = BrowserWindow.getAllWindows();
          if (mainWin) {
            mainWin.webContents.send('loop-video-progress', data);
          }
        };

        broadcastLoopProgress({
          imageId,
          status: 'crafted',
          message: 'Crafted loop motion prompt',
        });

        // Step 3: Generate the video using Veo with loop mode
        // Use Veo 3.1 for best loop quality (supports last_frame for seamless looping)
        const videoModel = 'veo-3.1-generate-preview';
        
        const videoUrl = `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning?key=${apiKey}`;

        // Build instance with image as start frame and loop mode
        const instance: any = {
          prompt: loopPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: imageMimeType,
          },
          // For loop mode: use same image as lastFrame for seamless loop
          lastFrame: {
            bytesBase64Encoded: imageBase64,
            mimeType: imageMimeType,
          },
        };

        const parameters: any = {
          aspectRatio: '16:9',
          // durationSeconds must be string format for REST API
        };

        const videoRequestBody = {
          instances: [instance],
          parameters,
        };

        console.log('[LoopVideo] Calling Veo API for loop generation...');
        
        broadcastLoopProgress({
          imageId,
          status: 'generating',
          message: 'Generating loop video...',
        });

        const videoResponse = await fetch(videoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(videoRequestBody),
        });

        if (!videoResponse.ok) {
          const errText = await videoResponse.text();
          throw new Error(`Video generation request failed: ${errText}`);
        }

        const videoOpData = await videoResponse.json();
        const operationName = videoOpData.name;

        if (!operationName) {
          throw new Error('No operation name returned from video generation');
        }

        console.log('[LoopVideo] Video generation started, operation:', operationName);

        // Step 4: Poll for completion
        const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
        const maxAttempts = 60; // 5 minutes with 5 second intervals
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5000));

          const pollResponse = await fetch(pollUrl);
          if (!pollResponse.ok) continue;

          const pollData = await pollResponse.json();
          
          if (pollData.done) {
            console.log('[LoopVideo] Video generation complete!');

            // Extract video from response
            const generatedSamples = pollData.response?.generateVideoResponse?.generatedSamples || 
                                     pollData.response?.generatedVideos || [];
            if (generatedSamples.length === 0) {
              throw new Error('No video generated');
            }

            const sample = generatedSamples[0];
            const videoUri = sample.video?.uri || sample.uri;

            if (!videoUri) {
              throw new Error('No video URI in response');
            }

            // Download the video
            const downloadResponse = await fetch(videoUri, {
              headers: { 'x-goog-api-key': apiKey },
              redirect: 'follow',
            });

            if (!downloadResponse.ok) {
              throw new Error('Failed to download generated video');
            }

            const videoBuffer = await downloadResponse.arrayBuffer();

            // Save video to card-videos directory
            const userDataDir = app.getPath('userData');
            const videosDir = path.join(userDataDir, 'wormhole', 'card-videos');
            await fs.promises.mkdir(videosDir, { recursive: true });

            const videoCardId = `loop-video-${Date.now()}`;
            const videoFileName = `${videoCardId}.mp4`;
            const videoPath = path.join(videosDir, videoFileName);
            await fs.promises.writeFile(videoPath, Buffer.from(videoBuffer));

            console.log('[LoopVideo] Saved video to:', videoPath);

            // Step 5: Create child video card
            const videoCardRecord = {
              cardId: videoCardId,
              name: `${cardName} - Loop #${imageOrder + 1}`,
              mediaKind: 'video',
              mediaLocalPath: videoPath,
              createdAt: new Date().toISOString(),
              parentCardId: parentCardId,
              sourceImage: {
                imageId,
                imagePath,
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
              cardId: videoCardId,
              name: videoCardRecord.name,
              mediaKind: 'video',
              createdAt: videoCardRecord.createdAt,
              parentCardId: parentCardId,
              thumbnail: imagePath, // Use source image as thumbnail
              mediaLocalPath: videoPath,
            };
            await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));

            // Broadcast completion
            broadcastLoopProgress({
              imageId,
              status: 'complete',
              message: 'Loop video created!',
            });

            return {
              success: true,
              videoCardId,
              videoPath,
              loopPrompt,
              parentCardId,
              imageId,
            };
          }

          // Broadcast progress
          const progress = Math.min(90, Math.round((attempt / maxAttempts) * 100));
          broadcastLoopProgress({
            imageId,
            status: 'generating',
            progress,
            message: `Generating loop video... ${progress}%`,
          });
        }

        throw new Error('Loop video generation timed out');
      } catch (error: any) {
        console.error('[LoopVideo] Error:', error);
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
        { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
        { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
        { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
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
      { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
      { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
      { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
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

      const resolvedModel = modelName || 'veo-3.1-generate-preview';
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

              const videoBuffer = await downloadResponse.arrayBuffer();
              const videoBase64 = Buffer.from(videoBuffer).toString('base64');

              // Save to wormhole directory
              const userDataDir = app.getPath('userData');
              const wormholeDir = path.join(userDataDir, 'wormhole');
              await fs.promises.mkdir(wormholeDir, { recursive: true });

              const videoFileName = `veo-${Date.now()}.mp4`;
              const videoPath = path.join(wormholeDir, videoFileName);
              await fs.promises.writeFile(videoPath, Buffer.from(videoBuffer));

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
                videoBase64,
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
      let inferredMediaType: 'text' | 'markdown' | 'pdf' | 'audio' | 'video' = 'text';
      if (ext === '.md' || ext === '.markdown') {
        inferredMediaType = 'markdown';
      } else if (ext === '.pdf') {
        inferredMediaType = 'pdf';
      } else {
        const audioExts = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'];
        const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];
        if (audioExts.includes(ext)) {
          inferredMediaType = 'audio';
        } else if (videoExts.includes(ext)) {
          inferredMediaType = 'video';
        }
      }

      const mediaType = (providedMediaType as any) || inferredMediaType;

      const coreInfo = await createCore(cardCoreName);

      let kind: 'document' | 'audio' | 'video' = 'document';
      if (mediaType === 'audio') {
        kind = 'audio';
      } else if (mediaType === 'video') {
        kind = 'video';
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
        createdAt,
        updatedAt: createdAt,
        title: fileName,
        mediaType,
        source: 'wormhole',
        provider: 'wormhole',
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
      } as any;

      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));

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
      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
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

      const audioBuffer = await fs.promises.readFile(localPath);
      const base64 = audioBuffer.toString('base64');

      const ext = path.extname(localPath || '').toLowerCase();
      let mimeType = 'audio/mpeg';
      if (ext === '.wav') mimeType = 'audio/wav';
      else if (ext === '.mp3') mimeType = 'audio/mpeg';
      else if (ext === '.ogg') mimeType = 'audio/ogg';
      else if (ext === '.flac') mimeType = 'audio/flac';
      else if (ext === '.m4a') mimeType = 'audio/mp4';

      const transcriptText = (await transcribeAudioWithOpenAI(base64, mimeType, apiKey)).trim();
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
      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
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
          if (parsed && parsed.type === 'card') {
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

      const mediaType = (cardRecord.mediaType || '').toString();

      let textSource = '';
      if (transcripts.length > 0) {
        const latest = transcripts[transcripts.length - 1];
        if (latest && typeof latest.text === 'string') {
          textSource = latest.text as string;
        }
      }

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

      const cleanedText = (textSource || '').trim();
      if (!cleanedText) {
        throw new Error('No text source available for Wormhole summarization. Run transcription or ingest text first.');
      }

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
      }

      const configuredModel: string | undefined =
        globalWormhole.summarization && typeof globalWormhole.summarization.model === 'string'
          ? (globalWormhole.summarization.model as string)
          : undefined;

      const modelName =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-pro';

      if (provider !== 'gemini') {
        throw new Error('Wormhole summarization is currently implemented only for Gemini provider.');
      }

      const { short, medium, outline, model } = await summarizeTextWithGemini(cleanedText, modelName);
      if (!medium) {
        throw new Error('Summarization produced empty text.');
      }

      const now = new Date().toISOString();
      const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const outlineText = outline.join('\n');

      const existingSummaries =
        (Array.isArray(cardRecord.summaries) ? (cardRecord.summaries as any[]) : []) || [];

      const newSummaries = [
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

      const updatedSummaries = [...existingSummaries, ...newSummaries];

      const existingProcessing =
        (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
      const existingSummarization = (existingProcessing as any).summarization || {};

      const nextProcessing = {
        ...existingProcessing,
        summarization: {
          status: 'complete',
          provider: 'gemini',
          model,
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
      const { cardId, overrideProvider, overrideModel } = payload || ({} as any);
      if (!cardId || typeof cardId !== 'string') {
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
          if (parsed && parsed.type === 'card') {
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

      const mediaType = (cardRecord.mediaType || '').toString();

      let textSource = '';
      if (transcripts.length > 0) {
        const latest = transcripts[transcripts.length - 1];
        if (latest && typeof latest.text === 'string') {
          textSource = latest.text as string;
        }
      }

      if (!textSource) {
        const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
        const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';
        if (originalPath && (mediaType === 'text' || mediaType === 'markdown')) {
          try {
            const buf = await fs.promises.readFile(originalPath, 'utf-8');
            textSource = buf.toString();
          } catch (error) {
            console.error('Failed to read original text file for Wormhole key-term extraction:', error);
          }
        }
      }

      const cleanedText = (textSource || '').trim();
      if (!cleanedText) {
        throw new Error('No text source available for Wormhole key-term extraction. Run transcription or ingest text first.');
      }

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
      }

      const configuredModel: string | undefined =
        globalWormhole.keyTerms && typeof globalWormhole.keyTerms.model === 'string'
          ? (globalWormhole.keyTerms.model as string)
          : undefined;

      const modelName =
        (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-pro';

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

  // Profile & System Stats IPC
  ipcMain.handle('get-profile', async () => {
    return store.get('userProfile', { displayName: 'Anon Node', bio: '' });
  });

  ipcMain.handle('save-profile', async (_event, profile: any) => {
    store.set('userProfile', profile);
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
      cardType: 'agent-profile', // Special type
      kind: 'image',
      id: cardId,
      createdAt: now,
      updatedAt: now,
      title: 'Agent Profile Picture',
      mediaType: 'image',
      source: 'user-upload',
      provider: 'local',
      tags: ['agent-profile'],
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
        tags: ['agent-profile'],
      };
      await appendToCore(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
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
      // storage dir is relative to where main.ts runs? 
      // In dev: electron/main.ts -> storage/ is in root.
      // In prod: resources/app/storage? 
      // For now, assume './storage' relative to CWD which is project root in dev.
      storageUsageBytes = await getDirSize('./storage').catch(() => 0);
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
      cardCount,
      wikiEntryCount,
      wormholeRunCount,
      p2pPeers: p2pStats.peers,
      p2pPublicKey: p2pStats.publicKey,
    };
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
