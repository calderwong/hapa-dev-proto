"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
const electron_store_1 = __importDefault(require("electron-store"));
const generative_ai_1 = require("@google/generative-ai");
const p2p_1 = require("./p2p");
const store = new electron_store_1.default();
const GEMINI_REQUEST_LOG_KEY = 'geminiRequestLog';
const GEMINI_REQUEST_LOG_MAX_ENTRIES = 200;
const ADMIN_SETTINGS_KEY = 'adminSettings';
const LLAMA_SETTINGS_KEY = 'llamaSettings';
const WORMHOLE_SETTINGS_KEY = 'wormholeSettings';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const WIKI_CORE_NAME = 'wormhole-wiki-entries';
const appendGeminiRequestLog = (entry) => {
    const current = store.get(GEMINI_REQUEST_LOG_KEY, []) || [];
    const next = [...current, entry];
    const trimmed = next.length > GEMINI_REQUEST_LOG_MAX_ENTRIES
        ? next.slice(next.length - GEMINI_REQUEST_LOG_MAX_ENTRIES)
        : next;
    store.set(GEMINI_REQUEST_LOG_KEY, trimmed);
};
let llamaProcess = null;
let llamaStatus = { running: false };
const getLlamaSettingsInternal = () => {
    const stored = store.get(LLAMA_SETTINGS_KEY, {}) || {};
    const modelsDir = typeof stored.modelsDir === 'string' && stored.modelsDir.length > 0
        ? stored.modelsDir
        : path.join(electron_1.app.getPath('userData'), 'llama-models');
    const favorites = Array.isArray(stored.favorites)
        ? stored.favorites
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
const saveLlamaSettingsInternal = (settings) => {
    store.set(LLAMA_SETTINGS_KEY, settings);
};
const getLlamaStatusInternal = () => {
    const running = !!llamaProcess && !llamaProcess.killed;
    return { ...llamaStatus, running };
};
const startLlamaServerInternal = async () => {
    if (llamaProcess && !llamaProcess.killed) {
        return getLlamaStatusInternal();
    }
    const settings = getLlamaSettingsInternal();
    if (!settings.serverPath) {
        const msg = 'Llama server path is not configured. Please set it in Local AI settings.';
        llamaStatus = { running: false, lastError: msg };
        throw new Error(msg);
    }
    const modelPath = settings.defaultModel && path.isAbsolute(settings.defaultModel)
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
        const child = (0, child_process_1.spawn)(settings.serverPath, args, {
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
                lastError: code && code !== 0
                    ? `Llama server exited with code ${code}${signal ? ` (signal ${signal})` : ''}`
                    : llamaStatus.lastError,
            };
        });
        child.on('error', (err) => {
            llamaProcess = null;
            llamaStatus = { running: false, lastError: err.message };
        });
        return getLlamaStatusInternal();
    }
    catch (error) {
        const msg = error?.message || 'Failed to start llama server';
        llamaProcess = null;
        llamaStatus = { running: false, lastError: msg };
        throw new Error(msg);
    }
};
const stopLlamaServerInternal = () => {
    if (llamaProcess && !llamaProcess.killed) {
        llamaProcess.kill();
    }
    llamaProcess = null;
    llamaStatus = { ...llamaStatus, running: false };
    return getLlamaStatusInternal();
};
const listLlamaLocalModelsInternal = async () => {
    const settings = getLlamaSettingsInternal();
    const dir = settings.modelsDir;
    try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const results = [];
        for (const entry of entries) {
            if (!entry.isFile())
                continue;
            if (!entry.name.toLowerCase().endsWith('.gguf'))
                continue;
            const fullPath = path.join(dir, entry.name);
            try {
                const stat = await fs.promises.stat(fullPath);
                results.push({
                    name: entry.name,
                    path: fullPath,
                    sizeBytes: stat.size,
                    mtime: stat.mtime.toISOString(),
                });
            }
            catch {
                results.push({ name: entry.name, path: fullPath });
            }
        }
        return results;
    }
    catch (error) {
        if (error && error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
};
const deleteLlamaModelInternal = async (targetPath) => {
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
const pickRecommendedGGUFFile = (files) => {
    if (!files || files.length === 0)
        return undefined;
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
const searchHfGGUFModelsInternal = async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
        return [];
    }
    const searchUrl = `${HF_MODELS_API_BASE}?search=` + encodeURIComponent(trimmed) + '&limit=20';
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.error('Unexpected Hugging Face search response shape:', data);
            return [];
        }
        const limited = data.slice(0, 8);
        const results = [];
        for (const item of limited) {
            const repoId = (item && typeof item.id === 'string' && item.id) ||
                (item && typeof item.modelId === 'string' && item.modelId);
            if (!repoId)
                continue;
            try {
                const detailResponse = await fetch(`${HF_MODELS_API_BASE}/${repoId}`);
                const detail = await detailResponse.json();
                const siblings = Array.isArray(detail.siblings)
                    ? detail.siblings
                    : [];
                const ggufFiles = siblings
                    .map((s) => s && typeof s.rfilename === 'string' ? s.rfilename : '')
                    .filter((name) => name.toLowerCase().endsWith('.gguf'));
                if (!ggufFiles.length) {
                    continue;
                }
                const recommendedFile = pickRecommendedGGUFFile(ggufFiles);
                const ggufMeta = detail?.gguf || {};
                const contextLength = typeof ggufMeta.context_length === 'number'
                    ? ggufMeta.context_length
                    : undefined;
                const architecture = typeof ggufMeta.architecture === 'string'
                    ? ggufMeta.architecture
                    : undefined;
                const cardData = detail?.cardData || {};
                let license;
                if (typeof cardData.license_name === 'string') {
                    license = cardData.license_name;
                }
                else if (typeof cardData.license === 'string') {
                    license = cardData.license;
                }
                results.push({
                    repoId,
                    description: detail?.cardData?.model_name ||
                        detail?.cardData?.base_model ||
                        detail?.pipeline_tag ||
                        '',
                    downloads: typeof detail?.downloads === 'number'
                        ? detail.downloads
                        : typeof item.downloads === 'number'
                            ? item.downloads
                            : undefined,
                    likes: typeof detail?.likes === 'number'
                        ? detail.likes
                        : typeof item.likes === 'number'
                            ? item.likes
                            : undefined,
                    tags: (Array.isArray(detail?.tags) &&
                        detail.tags) ||
                        (Array.isArray(item.tags) &&
                            item.tags) ||
                        [],
                    ggufFiles,
                    recommendedFile,
                    architecture,
                    contextLength,
                    license,
                });
            }
            catch (error) {
                console.error('Failed to fetch Hugging Face model details for repo', repoId, error);
            }
        }
        return results;
    }
    catch (error) {
        console.error('Hugging Face GGUF search failed:', error);
        return [];
    }
};
const broadcastChatStream = (provider, delta, done, model) => {
    const [win] = electron_1.BrowserWindow.getAllWindows();
    if (!win)
        return;
    if (!delta && !done)
        return;
    win.webContents.send('chat-stream', { provider, delta, done: !!done, model });
};
const openAIAudioSessions = new Map();
const broadcastAudioTranscript = (sessionId, delta, fullText) => {
    const [win] = electron_1.BrowserWindow.getAllWindows();
    if (!win)
        return;
    if (!delta && !fullText)
        return;
    win.webContents.send('audio-transcript-stream', {
        sessionId,
        delta,
        fullText,
    });
};
const getAdminSettings = () => {
    const stored = store.get(ADMIN_SETTINGS_KEY, {}) || {};
    const audioMode = stored.audioMode === 'realtime' ? 'realtime' : 'transcribe';
    return {
        audioMode,
    };
};
const saveAdminSettings = (settings) => {
    store.set(ADMIN_SETTINGS_KEY, settings);
};
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TRANSCRIPT_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const REVID_API_BASE = 'https://www.revid.ai/api/public/v2';
const REVID_MEDIA_BASE = 'https://revid.ai/api/public';
const callRevidApi = async (endpoint, method, body) => {
    const apiKey = store.get('revidKey');
    if (!apiKey) {
        throw new Error('Revid API Key not found. Please configure it in Settings.');
    }
    const url = `${REVID_API_BASE}${endpoint}`;
    const options = {
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
    let data = null;
    try {
        data = await response.json();
    }
    catch {
        // ignore JSON parse errors
    }
    if (!response.ok) {
        console.error('Revid API error for', endpoint, data);
        const message = (data && (data.error?.message || data.message)) ||
            `Revid API request failed (${response.status})`;
        throw new Error(message);
    }
    return data;
};
const normalizeRevidMediaType = (rawType, fileType) => {
    const lowerRaw = (rawType || '').toLowerCase();
    const lowerFile = (fileType || '').toLowerCase();
    if (lowerRaw === 'video')
        return 'video';
    if (lowerRaw === 'image')
        return 'image';
    if (lowerRaw === 'audio')
        return 'audio';
    if (lowerFile.startsWith('video/'))
        return 'video';
    if (lowerFile.startsWith('image/'))
        return 'image';
    if (lowerFile.startsWith('audio/'))
        return 'audio';
    return 'unknown';
};
const normalizeRevidMediaItem = (raw) => {
    if (!raw || typeof raw !== 'object')
        return null;
    const idValue = (typeof raw.id === 'string' && raw.id) ||
        (typeof raw.mid === 'string' && raw.mid) ||
        '';
    const midValue = (typeof raw.mid === 'string' && raw.mid) ||
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
        imagePreview: typeof raw.imagePreview === 'string' ? raw.imagePreview : undefined,
        fileType,
        type,
        orientation: typeof raw.orientation === 'string' ? raw.orientation : undefined,
        raw,
    };
};
const callRevidMediaApi = async (pathWithQuery) => {
    const apiKey = store.get('revidKey');
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
    let data = null;
    try {
        data = await response.json();
    }
    catch {
        // ignore JSON parse errors
    }
    if (!response.ok) {
        console.error('Revid media API error for', pathWithQuery, data);
        const message = (data && (data.error?.message || data.message)) ||
            `Revid media request failed (${response.status})`;
        throw new Error(message);
    }
    return data;
};
const downloadRevidMediaInternal = async (params) => {
    const { mediaUrl, id, type, fileType } = params;
    let parsedUrl;
    try {
        parsedUrl = new URL(mediaUrl);
    }
    catch {
        throw new Error('Invalid Revid media URL.');
    }
    const lowerType = (type || '').toLowerCase();
    const lowerFileType = (fileType || '').toLowerCase();
    let category = 'other';
    if (lowerType === 'video' || lowerFileType.startsWith('video/')) {
        category = 'video';
    }
    else if (lowerType === 'image' || lowerFileType.startsWith('image/')) {
        category = 'image';
    }
    else if (lowerType === 'audio' || lowerFileType.startsWith('audio/')) {
        category = 'audio';
    }
    const extFromType = lowerFileType.includes('/')
        ? lowerFileType.split('/')[1]
        : '';
    const extFromPath = path.extname(parsedUrl.pathname).replace(/^\./, '');
    const extension = extFromType || extFromPath || 'bin';
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${safeId}.${extension}`;
    const baseDir = path.join(electron_1.app.getPath('userData'), 'revid-media');
    const destDir = category === 'other'
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
    }
    catch {
        // file does not exist; proceed to download
    }
    const client = parsedUrl.protocol === 'http:' ? http : https;
    const size = await new Promise((resolve, reject) => {
        const request = client.get(parsedUrl, (response) => {
            if (response.statusCode && response.statusCode >= 400) {
                reject(new Error(`Download failed with status ${response.statusCode}`));
                response.resume();
                return;
            }
            const fileStream = fs.createWriteStream(destPath);
            let bytes = 0;
            response.on('data', (chunk) => {
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
const LLAMA_CHAT_ENDPOINT = process.env.LLAMA_CHAT_ENDPOINT || 'http://127.0.0.1:8080/v1/chat/completions';
const getLlamaModelsEndpoint = () => {
    try {
        const url = new URL(LLAMA_CHAT_ENDPOINT);
        return `${url.protocol}//${url.host}/v1/models`;
    }
    catch {
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
const fetchOpenAIModels = async (apiKey) => {
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
        const ids = data.data
            .map((m) => (m && typeof m.id === 'string' ? m.id : ''))
            .filter((id) => {
            if (!id)
                return false;
            const lower = id.toLowerCase();
            if (lower.includes('embedding') ||
                lower.includes('whisper') ||
                lower.includes('audio') ||
                lower.includes('tts')) {
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
    }
    catch (error) {
        console.error('Error fetching OpenAI models from API:', error);
        return listDefaultOpenAIModels();
    }
};
const extractOpenAIStreamText = (json) => {
    try {
        const choice = json?.choices?.[0];
        const delta = choice?.delta;
        if (!delta)
            return '';
        const content = delta.content;
        // Legacy models: content is a simple string
        if (typeof content === 'string') {
            return content;
        }
        // Newer models: content is an array of parts
        if (Array.isArray(content)) {
            const pieces = [];
            for (const part of content) {
                if (!part)
                    continue;
                if (typeof part === 'string') {
                    pieces.push(part);
                    continue;
                }
                if (typeof part.text === 'string') {
                    pieces.push(part.text);
                    continue;
                }
                if (typeof part.output_text === 'string') {
                    pieces.push(part.output_text);
                    continue;
                }
            }
            return pieces.join('');
        }
        // Some models may expose text directly on delta
        if (typeof delta.output_text === 'string') {
            return delta.output_text;
        }
        return '';
    }
    catch (error) {
        console.error('Failed to extract text from OpenAI stream delta:', error, json);
        return '';
    }
};
const transcribeAudioWithOpenAI = async (base64, mimeType, apiKey) => {
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
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        console.error('OpenAI transcription error:', data);
        throw new Error(data.error?.message || 'Failed to transcribe audio');
    }
    return data.text || '';
};
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const resolveGeminiModelName = (modelName) => {
    const trimmed = (modelName || '').toString().trim();
    if (!trimmed || trimmed === 'gemini-pro' || trimmed === 'gemini-1.5-pro') {
        return DEFAULT_GEMINI_MODEL;
    }
    return trimmed;
};
const summarizeTextWithGemini = async (text, modelName) => {
    const apiKey = store.get('geminiKey');
    if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
    }
    const resolvedModel = resolveGeminiModelName(modelName);
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    const trimmed = text.length > 16000 ? text.slice(0, 16000) : text;
    const prompt = 'Summarize the following content in 1-3 short paragraphs. Focus on the main ideas and important details. ' +
        'Return a clear, readable summary in plain text.\n\n' +
        trimmed;
    const result = await model.generateContent([{ text: prompt }]);
    const response = await result.response;
    const summaryText = response.text?.() || '';
    const medium = (summaryText || '').trim();
    if (!medium) {
        return {
            short: '',
            medium: '',
            outline: [],
            model: resolvedModel,
        };
    }
    const sentencePieces = medium.split(/(?<=[\.\!\?])\s+|\n+/).filter((p) => p.trim().length > 0);
    const shortRaw = sentencePieces.slice(0, 3).join(' ');
    const short = shortRaw.length > 400 ? shortRaw.slice(0, 397) + '…' : shortRaw;
    const outlineLines = medium
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 10);
    const outline = outlineLines.length > 0 ? outlineLines : [medium.slice(0, 200)];
    return {
        short,
        medium,
        outline,
        model: resolvedModel,
    };
};
const extractKeyTermsWithGemini = async (text, modelName) => {
    const apiKey = store.get('geminiKey');
    if (!apiKey) {
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
    }
    const resolvedModel = resolveGeminiModelName(modelName);
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    const trimmed = text.length > 16000 ? text.slice(0, 16000) : text;
    const prompt = 'Extract up to 30 key entities, concepts, or topics from the following content. ' +
        'Return them as a plain text list, one item per line. ' +
        'Optionally include a short type in parentheses, e.g. "Hapa AI (project)".\n\n' +
        trimmed;
    const result = await model.generateContent([{ text: prompt }]);
    const response = await result.response;
    const raw = (response.text?.() || '').trim();
    if (!raw) {
        return { terms: [], model: resolvedModel };
    }
    const lines = raw
        .split(/\r?\n+/)
        .map((line) => line.replace(/^[-*\d\.\)\s]+/, '').trim())
        .filter((line) => line.length > 0);
    const terms = lines.slice(0, 30).map((line) => {
        let term = line;
        let type;
        const match = line.match(/^(.*?)[\s]*\(([^)]+)\)[\s]*$/);
        if (match) {
            term = match[1].trim();
            type = match[2].trim();
        }
        return { term, type };
    });
    return { terms, model: resolvedModel };
};
const getAppIconPath = () => {
    const base = electron_is_dev_1.default ? '../public' : '../dist-renderer';
    return path.join(__dirname, base, 'Paramation_Logo.png');
};
function createWindow() {
    const win = new electron_1.BrowserWindow({
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
    if (electron_is_dev_1.default) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools(); // Temporarily enable for debugging icons
    }
    else {
        win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    electron_1.ipcMain.handle('toggle-dev-tools', (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.webContents.toggleDevTools();
        }
    });
    // Settings IPC handlers
    electron_1.ipcMain.handle('get-settings', () => {
        const wormhole = store.get(WORMHOLE_SETTINGS_KEY, {}) || {};
        return {
            geminiKey: store.get('geminiKey', ''),
            openaiKey: store.get('openaiKey', ''),
            firebaseConfig: store.get('firebaseConfig', ''),
            revidKey: store.get('revidKey', ''),
            wormhole,
        };
    });
    electron_1.ipcMain.handle('save-settings', (_event, settings) => {
        store.set('geminiKey', settings.geminiKey);
        store.set('openaiKey', settings.openaiKey);
        store.set('firebaseConfig', settings.firebaseConfig);
        store.set('revidKey', settings.revidKey);
        store.set(WORMHOLE_SETTINGS_KEY, settings.wormhole || {});
        return true;
    });
    // Llama runtime settings & status
    electron_1.ipcMain.handle('get-llama-settings', () => {
        return getLlamaSettingsInternal();
    });
    electron_1.ipcMain.handle('save-llama-settings', (_event, settings) => {
        const next = {
            serverPath: settings.serverPath || '',
            modelsDir: settings.modelsDir || path.join(electron_1.app.getPath('userData'), 'llama-models'),
            defaultModel: settings.defaultModel || '',
            port: typeof settings.port === 'number' && settings.port > 0 ? settings.port : 8080,
            autoStart: settings.autoStart === true,
            favorites: Array.isArray(settings.favorites) ? settings.favorites : [],
        };
        saveLlamaSettingsInternal(next);
        return true;
    });
    electron_1.ipcMain.handle('get-llama-status', () => {
        return getLlamaStatusInternal();
    });
    electron_1.ipcMain.handle('start-llama-server', async () => {
        return startLlamaServerInternal();
    });
    electron_1.ipcMain.handle('stop-llama-server', () => {
        return stopLlamaServerInternal();
    });
    electron_1.ipcMain.handle('list-llama-local-models', async () => {
        return listLlamaLocalModelsInternal();
    });
    electron_1.ipcMain.handle('delete-llama-model', async (_event, payload) => {
        if (!payload || !payload.path) {
            throw new Error('Model path is required.');
        }
        await deleteLlamaModelInternal(payload.path);
        return true;
    });
    electron_1.ipcMain.handle('download-llama-model', async (_event, payload) => {
        const { url, fileName } = payload || {};
        if (!url || typeof url !== 'string') {
            throw new Error('Model URL is required.');
        }
        const settings = getLlamaSettingsInternal();
        const destDir = settings.modelsDir;
        await fs.promises.mkdir(destDir, { recursive: true });
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        }
        catch {
            throw new Error('Invalid model URL.');
        }
        const finalName = typeof fileName === 'string' && fileName.trim().length > 0
            ? fileName.trim()
            : path.basename(parsedUrl.pathname) || 'model.gguf';
        const destPath = path.join(destDir, finalName);
        await new Promise((resolve, reject) => {
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
    });
    electron_1.ipcMain.handle('hf-search-gguf-models', async (_event, payload) => {
        const { query } = payload || {};
        if (!query || typeof query !== 'string') {
            return [];
        }
        return searchHfGGUFModelsInternal(query);
    });
    electron_1.ipcMain.handle('revid-estimate-credits', async (_event, payload) => {
        const { creationParams } = payload || {};
        if (!creationParams) {
            throw new Error('creationParams are required for Revid credits estimation.');
        }
        return callRevidApi('/calculate-credits', 'POST', { creationParams });
    });
    electron_1.ipcMain.handle('revid-render', async (_event, payload) => {
        if (!payload || !payload.creationParams) {
            throw new Error('creationParams are required to render a Revid video.');
        }
        return callRevidApi('/render', 'POST', payload);
    });
    electron_1.ipcMain.handle('revid-get-status', async (_event, payload) => {
        const { pid } = payload || {};
        if (!pid || typeof pid !== 'string') {
            throw new Error('pid is required to get Revid project status.');
        }
        return callRevidApi(`/status?pid=${encodeURIComponent(pid)}`, 'GET');
    });
    electron_1.ipcMain.handle('revid-list-projects', async (_event, payload) => {
        const { limit } = payload || {};
        const safeLimit = typeof limit === 'number' && limit > 0 && limit <= 50 ? limit : 10;
        return callRevidApi(`/projects?limit=${safeLimit}`, 'GET');
    });
    electron_1.ipcMain.handle('revid-search-media', async (_event, payload) => {
        const { search, mediaType, topK } = payload || {};
        const params = new URLSearchParams();
        if (typeof search === 'string' && search.trim()) {
            params.set('search', search.trim());
        }
        if (typeof mediaType === 'string' && mediaType && mediaType !== 'all') {
            params.set('mediaType', mediaType);
        }
        const safeTopK = typeof topK === 'number' && topK > 0
            ? Math.min(Math.max(topK, 1), 100)
            : 50;
        params.set('topK', String(safeTopK));
        const query = params.toString();
        const pathWithQuery = query ? `/media-search?${query}` : '/media-search';
        const data = await callRevidMediaApi(pathWithQuery);
        const rawResults = Array.isArray(data?.results) ? data.results : [];
        const normalized = [];
        for (const raw of rawResults) {
            const item = normalizeRevidMediaItem(raw);
            if (item)
                normalized.push(item);
        }
        return {
            results: normalized,
            count: typeof data?.count === 'number' ? data.count : normalized.length,
        };
    });
    electron_1.ipcMain.handle('revid-download-media', async (_event, payload) => {
        const { mediaUrl, id, type, fileType } = payload || {};
        if (!mediaUrl || typeof mediaUrl !== 'string') {
            throw new Error('mediaUrl is required to download Revid media.');
        }
        if (!id || typeof id !== 'string') {
            throw new Error('id is required to download Revid media.');
        }
        return downloadRevidMediaInternal({ mediaUrl, id, type, fileType });
    });
    // OpenAI realtime audio sessions (prototype)
    electron_1.ipcMain.handle('openai-audio-start-session', () => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const session = {
            id,
            createdAt: new Date().toISOString(),
            fullText: '',
        };
        openAIAudioSessions.set(id, session);
        return { sessionId: id };
    });
    electron_1.ipcMain.handle('openai-audio-append-chunk', async (_event, payload) => {
        const { sessionId, base64, mimeType } = payload || {};
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('Audio sessionId is required.');
        }
        const session = openAIAudioSessions.get(sessionId);
        if (!session) {
            throw new Error('Audio session not found.');
        }
        const apiKey = store.get('openaiKey');
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
        }
        catch (error) {
            console.error('OpenAI audio chunk transcription failed:', error);
            throw new Error(error?.message || 'Failed to transcribe audio chunk');
        }
    });
    electron_1.ipcMain.handle('openai-audio-stop-session', (_event, payload) => {
        const { sessionId } = payload || {};
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('Audio sessionId is required.');
        }
        const session = openAIAudioSessions.get(sessionId);
        if (!session) {
            return { sessionId, fullText: '' };
        }
        openAIAudioSessions.delete(sessionId);
        return { sessionId, fullText: session.fullText };
    });
    electron_1.ipcMain.handle('get-admin-settings', () => {
        return getAdminSettings();
    });
    electron_1.ipcMain.handle('save-admin-settings', (_event, settings) => {
        const next = {
            audioMode: settings.audioMode === 'realtime' ? 'realtime' : 'transcribe',
        };
        saveAdminSettings(next);
        return true;
    });
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
    electron_1.ipcMain.handle('list-gemini-models', async () => {
        const apiKey = store.get('geminiKey');
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
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
                const mapped = data.models
                    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m) => ({
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName || m.name.replace('models/', ''),
                    description: m.description || '',
                    isVideoModel: false,
                }));
                // Add Veo video models to the list
                const allModels = [...mapped, ...VEO_VIDEO_MODELS];
                console.log('Available Gemini Models (including Veo):', allModels.length);
                return allModels;
            }
        }
        catch (error) {
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
    electron_1.ipcMain.handle('list-openai-models', async () => {
        const apiKey = store.get('openaiKey');
        if (!apiKey) {
            return listDefaultOpenAIModels();
        }
        return fetchOpenAIModels(apiKey);
    });
    // List models from a local llama.cpp server (OpenAI-compatible /v1/models)
    electron_1.ipcMain.handle('list-llama-models', async () => {
        const endpoint = getLlamaModelsEndpoint();
        try {
            const response = await fetch(endpoint, { method: 'GET' });
            const data = await response.json();
            if (!response.ok) {
                console.error('Llama models API error:', data);
                return [];
            }
            if (!data || !Array.isArray(data.data)) {
                console.error('Unexpected Llama models response shape:', data);
                return [];
            }
            return data.data.map((m) => ({
                name: typeof m.id === 'string' ? m.id : 'unknown',
                displayName: typeof m.id === 'string'
                    ? (m.id || 'Local model')
                    : 'Local model',
                description: typeof m.object === 'string' ? m.object : '',
            }));
        }
        catch (error) {
            console.error('Error fetching Llama models from local server:', error);
            return [];
        }
    });
    // Chat with Gemini
    electron_1.ipcMain.handle('chat-with-gemini', async (_event, { message, history, model: modelName, attachments, }) => {
        console.log('Chat with Gemini requested. Model:', modelName);
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            throw new Error('Gemini API Key not found. Please configure it in Settings.');
        }
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const resolvedModel = (modelName || 'gemini-pro').toString();
            const model = genAI.getGenerativeModel({ model: resolvedModel });
            const toContentHistory = (items) => items
                .filter((item) => item.content && item.content.trim().length > 0)
                .map((item) => {
                // Strip base64 images from history to avoid token limits
                const sanitized = item.content.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Generated Image]');
                return {
                    role: item.role === 'model' ? 'model' : 'user',
                    parts: [{ text: sanitized }],
                };
            });
            const sendMessageWithRetry = async (currentHistory) => {
                try {
                    const lowerModel = resolvedModel.toLowerCase();
                    const isImageModel = lowerModel.includes('image') || lowerModel.includes('nano-banana');
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
                        const prompt = textContext && textContext.trim().length > 0
                            ? `${textContext}\n\nUser: ${message}`
                            : message;
                        // Build parts array with text prompt AND any image attachments
                        const parts = [{ text: prompt }];
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
                        const requestId = Date.now().toString() +
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
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent` +
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
                            throw new Error(data?.error?.message || 'Gemini image generation request failed');
                        }
                        const candidates = data.candidates ?? [];
                        const first = candidates[0];
                        const responseParts = (first?.content?.parts ?? []);
                        const textChunks = [];
                        const imageChunks = [];
                        responseParts.forEach((part, index) => {
                            if (typeof part.text === 'string' && part.text.trim().length > 0) {
                                textChunks.push(part.text);
                            }
                            const inline = part.inlineData;
                            if (inline?.mimeType && inline?.data) {
                                const markdown = `![image ${index + 1}](data:${inline.mimeType};base64,${inline.data})`;
                                imageChunks.push(markdown);
                            }
                        });
                        const combined = [...textChunks, ...imageChunks]
                            .filter((chunk) => typeof chunk === 'string' && chunk.trim().length > 0)
                            .join('\n\n');
                        console.log('Received response from Gemini image model:', combined.substring(0, 80) + '...');
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
                    let parts = [];
                    if (attachments && attachments.length > 0) {
                        parts = attachments.map((att) => ({
                            inlineData: {
                                mimeType: att.mimeType,
                                data: att.data,
                            },
                        }));
                    }
                    parts.push({ text: message });
                    const requestId = Date.now().toString() +
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
                    for await (const chunk of streamResult.stream) {
                        try {
                            const chunkText = chunk.text?.() ?? '';
                            if (typeof chunkText === 'string' && chunkText.trim().length > 0) {
                                accumulatedText += chunkText;
                                broadcastChatStream('gemini', chunkText, false, resolvedModel);
                            }
                        }
                        catch (error) {
                            console.error('Failed to process Gemini stream chunk:', error);
                        }
                    }
                    const response = await streamResult.response;
                    const candidates = response.candidates ?? [];
                    const first = candidates[0];
                    if (!first || !first.content || !Array.isArray(first.content.parts)) {
                        console.log('Received response from Gemini (stream, text-only):', accumulatedText.substring(0, 50) + '...');
                        broadcastChatStream('gemini', '', true, resolvedModel);
                        return {
                            content: accumulatedText || response.text?.() || '',
                            model: resolvedModel,
                            provider: 'gemini',
                        };
                    }
                    const responseParts = first.content.parts;
                    const imageChunks = [];
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
                    console.log('Received response from Gemini (stream):', combined.substring(0, 50) + '...');
                    broadcastChatStream('gemini', '', true, resolvedModel);
                    return {
                        content: combined || response.text?.() || '',
                        model: resolvedModel,
                        provider: 'gemini',
                    };
                }
                catch (error) {
                    console.error('Gemini attempt failed:', error);
                    if (error?.message?.includes('thought_signature') && currentHistory.length > 0) {
                        console.log('Retrying with empty history due to thought_signature error...');
                        return sendMessageWithRetry([]);
                    }
                    throw error;
                }
            };
            return await sendMessageWithRetry(history);
        }
        catch (error) {
            console.error('Gemini Error:', error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    });
    // Generate video with Veo models (async operation with polling)
    // Supports: text-to-video, image-to-video (start frame), interpolation (start+end frame)
    electron_1.ipcMain.handle('generate-video-with-gemini', async (_event, { prompt, model: modelName, 
    // Start frame image
    imageBase64, imageMimeType, 
    // End frame for interpolation (Veo 3.1 only)
    lastFrameBase64, lastFrameMimeType, 
    // Video parameters
    aspectRatio, resolution, durationSeconds, negativePrompt, personGeneration, 
    // Loop mode - use same image for start and end
    loopMode, }) => {
        const apiKey = store.get('geminiKey');
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
            const config = {};
            const requestBody = { prompt };
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
            if (aspectRatio)
                config.aspectRatio = aspectRatio;
            if (resolution)
                config.resolution = resolution;
            if (durationSeconds)
                config.durationSeconds = parseInt(durationSeconds, 10);
            if (negativePrompt)
                config.negativePrompt = negativePrompt;
            if (personGeneration)
                config.personGeneration = personGeneration;
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
            const instance = { prompt };
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
            const restRequestBody = {
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
            let startData;
            try {
                startData = responseText ? JSON.parse(responseText) : {};
            }
            catch (parseError) {
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
                let pollData;
                try {
                    pollData = pollText ? JSON.parse(pollText) : {};
                }
                catch (parseError) {
                    console.error('Failed to parse poll response:', pollText);
                    throw new Error(`Invalid poll response: ${pollText.substring(0, 200)}`);
                }
                if (!pollResponse.ok) {
                    console.error('Video generation poll error:', pollData);
                    throw new Error(pollData?.error?.message || `Poll error ${pollResponse.status}`);
                }
                // Broadcast progress
                const [win] = electron_1.BrowserWindow.getAllWindows();
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
                        const userDataDir = electron_1.app.getPath('userData');
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
                    }
                    else {
                        throw new Error('Video file URI not found in response');
                    }
                }
            }
            throw new Error('Video generation timed out after 5 minutes');
        }
        catch (error) {
            console.error('Video generation error:', error);
            throw new Error(`Video generation failed: ${error.message}`);
        }
    });
    // Extract a frame (first or last) from a video file
    electron_1.ipcMain.handle('extract-video-frame', async (_event, { videoPath, frameType }) => {
        try {
            const { execSync, spawn } = require('child_process');
            // Use bundled ffmpeg/ffprobe
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            const ffprobePath = require('@ffprobe-installer/ffprobe').path;
            const userDataDir = electron_1.app.getPath('userData');
            const extractDir = path.join(userDataDir, 'wormhole');
            await fs.promises.mkdir(extractDir, { recursive: true });
            const outputFileName = `frame-${frameType}-${Date.now()}.png`;
            const outputPath = path.join(extractDir, outputFileName);
            // Use ffmpeg to extract frame
            // For first frame: -ss 0 -vframes 1
            // For last frame: we need duration first, then seek to near end
            let ffmpegArgs;
            if (frameType === 'first') {
                ffmpegArgs = ['-i', videoPath, '-ss', '0', '-vframes', '1', '-y', outputPath];
            }
            else {
                // Get video duration first using bundled ffprobe
                let duration = 8; // Default
                try {
                    const durationStr = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, { encoding: 'utf8' }).trim();
                    duration = parseFloat(durationStr) || 8;
                }
                catch (e) {
                    console.warn('Could not get video duration, using default');
                }
                // Seek to 0.1s before end
                const seekTime = Math.max(0, duration - 0.1);
                ffmpegArgs = ['-ss', seekTime.toString(), '-i', videoPath, '-vframes', '1', '-y', outputPath];
            }
            // Run bundled ffmpeg
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
                ffmpeg.on('close', (code) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error(`ffmpeg exited with code ${code}`));
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
        }
        catch (error) {
            console.error('Frame extraction error:', error);
            throw new Error(`Failed to extract ${frameType} frame: ${error.message}`);
        }
    });
    // Extract audio from a video file
    electron_1.ipcMain.handle('extract-video-audio', async (_event, { videoPath }) => {
        try {
            const { spawn } = require('child_process');
            // Use bundled ffmpeg
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            const userDataDir = electron_1.app.getPath('userData');
            const extractDir = path.join(userDataDir, 'wormhole');
            await fs.promises.mkdir(extractDir, { recursive: true });
            const outputFileName = `audio-${Date.now()}.mp3`;
            const outputPath = path.join(extractDir, outputFileName);
            // Use bundled ffmpeg to extract audio as mp3
            const ffmpegArgs = ['-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-y', outputPath];
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
                ffmpeg.on('close', (code) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error(`ffmpeg exited with code ${code}`));
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
        }
        catch (error) {
            console.error('Audio extraction error:', error);
            throw new Error(`Failed to extract audio: ${error.message}`);
        }
    });
    electron_1.ipcMain.handle('gemini-list-requests', () => {
        const entries = store.get(GEMINI_REQUEST_LOG_KEY, []) || [];
        return entries;
    });
    electron_1.ipcMain.handle('gemini-save-request', (_event, updatedEntry) => {
        const current = store.get(GEMINI_REQUEST_LOG_KEY, []) || [];
        const index = current.findIndex((entry) => entry.id === updatedEntry.id);
        const now = new Date().toISOString();
        const entryWithMeta = {
            ...updatedEntry,
            updatedAt: now,
        };
        if (index >= 0) {
            current[index] = entryWithMeta;
        }
        else {
            current.push(entryWithMeta);
        }
        store.set(GEMINI_REQUEST_LOG_KEY, current);
        return entryWithMeta;
    });
    electron_1.ipcMain.handle('chat-with-openai', async (_event, { message, history, model: modelName, attachments, }) => {
        const apiKey = store.get('openaiKey');
        if (!apiKey) {
            throw new Error('OpenAI API Key not found. Please configure it in Settings.');
        }
        const adminSettings = getAdminSettings();
        const resolvedModel = modelName || 'gpt-4.1-mini';
        const mappedHistory = history.map((item) => ({
            role: item.role === 'model' ? 'assistant' : 'user',
            content: item.content,
        }));
        const imageAttachments = attachments?.filter((att) => att.mimeType.startsWith('image/')) ?? [];
        const audioAttachments = attachments?.filter((att) => att.mimeType.startsWith('audio/')) ?? [];
        const videoAttachments = attachments?.filter((att) => att.mimeType.startsWith('video/')) ?? [];
        let content = message;
        if (imageAttachments.length > 0 ||
            audioAttachments.length > 0 ||
            videoAttachments.length > 0) {
            const parts = [];
            imageAttachments.forEach((att) => {
                parts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${att.mimeType};base64,${att.data}`,
                    },
                });
            });
            const transcriptChunks = [];
            if (audioAttachments.length > 0) {
                if (adminSettings.audioMode === 'realtime') {
                    console.warn('Realtime audio mode not implemented for OpenAI. Falling back to transcription.');
                }
                for (const att of audioAttachments) {
                    try {
                        const text = await transcribeAudioWithOpenAI(att.data, att.mimeType, apiKey);
                        if (text && text.trim().length > 0) {
                            transcriptChunks.push(text.trim());
                        }
                    }
                    catch (error) {
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
                textContent = `${textContent}\n\n[Note] ${videoAttachments.length} video attachment(s) were provided. OpenAI chat does not directly consume raw video files in this app; please describe the relevant frames in text.`;
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
            let errorText;
            try {
                errorText = await response.text();
            }
            catch {
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
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const event = buffer.slice(0, boundary).trim();
                buffer = buffer.slice(boundary + 2);
                const lines = event.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
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
                        }
                        else {
                            // Classic behavior: each event is just the new chunk.
                            fullText += rawText;
                        }
                        if (deltaText.length === 0) {
                            continue;
                        }
                        broadcastChatStream('openai', deltaText, false, resolvedModel);
                    }
                    catch (error) {
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
    });
    // Chat with a local llama.cpp server exposing an OpenAI-compatible /v1/chat/completions API
    electron_1.ipcMain.handle('chat-with-llama', async (_event, { message, history, model: modelName, }) => {
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
        };
        const response = await fetch(LLAMA_CHAT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(llamaPayload),
        });
        if (!response.ok || !response.body) {
            let errorText;
            try {
                errorText = await response.text();
            }
            catch {
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
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const event = buffer.slice(0, boundary).trim();
                buffer = buffer.slice(boundary + 2);
                const lines = event.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
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
                        }
                        else {
                            // Classic behavior: each event is just the new chunk.
                            fullText += rawText;
                        }
                        if (deltaText.length === 0) {
                            continue;
                        }
                        broadcastChatStream('llama', deltaText, false, resolvedModel);
                    }
                    catch (error) {
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
    });
    // Wormhole IPC handlers
    electron_1.ipcMain.handle('wormhole-ingest-content', async (_event, payload) => {
        const { path: rawPath, bytesBase64, mediaType: providedMediaType, ownerDid, tags, sourceLabel, fileName: payloadFileName, originalUrl, } = payload || {};
        let filePath = typeof rawPath === 'string' && rawPath.trim().length > 0 ? rawPath.trim() : undefined;
        const hasBytes = typeof bytesBase64 === 'string' && bytesBase64.length > 0;
        const hasUrl = typeof originalUrl === 'string' && originalUrl.trim().length > 0;
        if (!filePath && !hasBytes && !hasUrl) {
            throw new Error('Wormhole ingestContent requires a file path, bytesBase64 content, or originalUrl.');
        }
        const contentId = `whc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const cardCoreName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        if (!filePath && hasBytes) {
            const userDataDir = electron_1.app.getPath('userData');
            const wormholeDir = path.join(userDataDir, 'wormhole');
            await fs.promises.mkdir(wormholeDir, { recursive: true });
            const baseNameRaw = typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
                ? payloadFileName.trim()
                : `${contentId}.bin`;
            const safeBaseName = baseNameRaw.replace(/[\\/:*?"<>|]+/g, '_');
            const targetPath = path.join(wormholeDir, safeBaseName);
            const buffer = Buffer.from(bytesBase64, 'base64');
            await fs.promises.writeFile(targetPath, buffer);
            filePath = targetPath;
        }
        else if (!filePath && hasUrl) {
            const url = originalUrl.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                throw new Error('Wormhole originalUrl must start with http:// or https://');
            }
            const userDataDir = electron_1.app.getPath('userData');
            const wormholeDir = path.join(userDataDir, 'wormhole');
            await fs.promises.mkdir(wormholeDir, { recursive: true });
            let inferredName;
            try {
                const urlObj = new URL(url);
                const base = path.basename(urlObj.pathname || '');
                inferredName = base && base.length > 0 ? base : undefined;
            }
            catch {
                inferredName = undefined;
            }
            const baseNameRaw = typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
                ? payloadFileName.trim()
                : inferredName || `${contentId}.bin`;
            const safeBaseName = baseNameRaw.replace(/[\\/:*?"<>|]+/g, '_');
            const targetPath = path.join(wormholeDir, safeBaseName);
            let buffer;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const statusText = response.statusText || 'Request failed';
                    throw new Error(`Failed to download Wormhole URL (${response.status} ${statusText})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            }
            catch (error) {
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
        let inferredMediaType = 'text';
        if (ext === '.md' || ext === '.markdown') {
            inferredMediaType = 'markdown';
        }
        else if (ext === '.pdf') {
            inferredMediaType = 'pdf';
        }
        else {
            const audioExts = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'];
            const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];
            if (audioExts.includes(ext)) {
                inferredMediaType = 'audio';
            }
            else if (videoExts.includes(ext)) {
                inferredMediaType = 'video';
            }
        }
        const mediaType = providedMediaType || inferredMediaType;
        const coreInfo = await (0, p2p_1.createCore)(cardCoreName);
        let kind = 'document';
        if (mediaType === 'audio') {
            kind = 'audio';
        }
        else if (mediaType === 'video') {
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
            originalFileName: typeof payloadFileName === 'string' && payloadFileName.trim().length > 0
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
        const processing = {
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
        const cardRecord = {
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
        }
        else if (mediaType === 'video') {
            cardRecord.video = {
                localPath: filePath,
                remoteUrl: undefined,
                mimeType: '',
            };
        }
        await (0, p2p_1.appendToCore)(cardCoreName, JSON.stringify(cardRecord));
        await (0, p2p_1.createCore)(CARD_LIBRARY_CORE_NAME);
        const libraryEntry = {
            type: 'card-index',
            cardId: cardCoreName,
            createdAt,
            provider: 'wormhole',
            model: undefined,
            coreName: cardCoreName,
            coreKey: coreInfo?.key,
            coreDiscoveryKey: coreInfo?.discoveryKey,
        };
        await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
        return {
            contentId,
            cardId: cardCoreName,
            hypercoreKey: coreInfo?.key,
            mediaType,
            status: 'complete',
        };
    });
    electron_1.ipcMain.handle('wormhole-run-transcription', async (_event, payload) => {
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole transcription.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; cannot run transcription.');
        }
        let cardRecord = null;
        for (let i = records.length - 1; i >= 0; i -= 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                    break;
                }
            }
            catch {
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
        const globalWormhole = store.get(WORMHOLE_SETTINGS_KEY, {}) || {};
        let provider = 'openai';
        if (overrideProvider && typeof overrideProvider === 'string') {
            provider = overrideProvider;
        }
        else if (globalWormhole.transcription &&
            typeof globalWormhole.transcription.provider === 'string' &&
            globalWormhole.transcription.provider.trim().length > 0) {
            provider = globalWormhole.transcription.provider;
        }
        const model = (overrideModel && typeof overrideModel === 'string' && overrideModel) ||
            (globalWormhole.transcription && typeof globalWormhole.transcription.model === 'string'
                ? globalWormhole.transcription.model
                : undefined);
        if (provider !== 'openai') {
            throw new Error('Wormhole transcription is currently implemented only for OpenAI provider.');
        }
        const apiKey = store.get('openaiKey');
        if (!apiKey) {
            throw new Error('OpenAI API Key not found. Please configure it in Settings.');
        }
        const audioBuffer = await fs.promises.readFile(localPath);
        const base64 = audioBuffer.toString('base64');
        const ext = path.extname(localPath || '').toLowerCase();
        let mimeType = 'audio/mpeg';
        if (ext === '.wav')
            mimeType = 'audio/wav';
        else if (ext === '.mp3')
            mimeType = 'audio/mpeg';
        else if (ext === '.ogg')
            mimeType = 'audio/ogg';
        else if (ext === '.flac')
            mimeType = 'audio/flac';
        else if (ext === '.m4a')
            mimeType = 'audio/mp4';
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
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(transcriptRecord));
        const existingProcessing = (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
        const existingTranscription = existingProcessing.transcription || {};
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
        };
        const nextCardRecord = {
            ...cardRecord,
            updatedAt: now,
            transcriptAvailable: true,
            wormhole: {
                ...(cardRecord.wormhole || {}),
                processing: nextProcessing,
            },
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(nextCardRecord));
        return {
            cardId,
            step: 'transcription',
            status: nextProcessing.transcription,
        };
    });
    electron_1.ipcMain.handle('wormhole-run-summarization', async (_event, payload) => {
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole summarization.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; cannot run summarization.');
        }
        let cardRecord = null;
        const transcripts = [];
        for (let i = 0; i < records.length; i += 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                }
                else if (parsed && parsed.type === 'wormhole-transcript') {
                    transcripts.push(parsed);
                }
            }
            catch {
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
                textSource = latest.text;
            }
        }
        if (!textSource) {
            const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
            const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';
            if (originalPath && (mediaType === 'text' || mediaType === 'markdown')) {
                try {
                    const buf = await fs.promises.readFile(originalPath, 'utf-8');
                    textSource = buf.toString();
                }
                catch (error) {
                    console.error('Failed to read original text file for Wormhole summarization:', error);
                }
            }
        }
        const cleanedText = (textSource || '').trim();
        if (!cleanedText) {
            throw new Error('No text source available for Wormhole summarization. Run transcription or ingest text first.');
        }
        const globalWormhole = store.get(WORMHOLE_SETTINGS_KEY, {}) || {};
        let provider = 'gemini';
        if (overrideProvider && typeof overrideProvider === 'string') {
            provider = overrideProvider;
        }
        else if (globalWormhole.summarization &&
            typeof globalWormhole.summarization.provider === 'string' &&
            globalWormhole.summarization.provider.trim().length > 0) {
            provider = globalWormhole.summarization.provider;
        }
        const configuredModel = globalWormhole.summarization && typeof globalWormhole.summarization.model === 'string'
            ? globalWormhole.summarization.model
            : undefined;
        const modelName = (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-pro';
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
        const existingSummaries = (Array.isArray(cardRecord.summaries) ? cardRecord.summaries : []) || [];
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
        const existingProcessing = (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
        const existingSummarization = existingProcessing.summarization || {};
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
        };
        const nextCardRecord = {
            ...cardRecord,
            updatedAt: now,
            summaries: updatedSummaries,
            wormhole: {
                ...(cardRecord.wormhole || {}),
                processing: nextProcessing,
            },
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(nextCardRecord));
        return {
            cardId,
            step: 'summarization',
            status: nextProcessing.summarization,
        };
    });
    electron_1.ipcMain.handle('wormhole-run-keyterms', async (_event, payload) => {
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole key-term extraction.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; cannot run key-term extraction.');
        }
        let cardRecord = null;
        const transcripts = [];
        for (let i = 0; i < records.length; i += 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                }
                else if (parsed && parsed.type === 'wormhole-transcript') {
                    transcripts.push(parsed);
                }
            }
            catch {
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
                textSource = latest.text;
            }
        }
        if (!textSource) {
            const ingest = cardRecord.wormhole && cardRecord.wormhole.ingest;
            const originalPath = ingest && typeof ingest.originalPath === 'string' ? ingest.originalPath : '';
            if (originalPath && (mediaType === 'text' || mediaType === 'markdown')) {
                try {
                    const buf = await fs.promises.readFile(originalPath, 'utf-8');
                    textSource = buf.toString();
                }
                catch (error) {
                    console.error('Failed to read original text file for Wormhole key-term extraction:', error);
                }
            }
        }
        const cleanedText = (textSource || '').trim();
        if (!cleanedText) {
            throw new Error('No text source available for Wormhole key-term extraction. Run transcription or ingest text first.');
        }
        const globalWormhole = store.get(WORMHOLE_SETTINGS_KEY, {}) || {};
        let provider = 'gemini';
        if (overrideProvider && typeof overrideProvider === 'string') {
            provider = overrideProvider;
        }
        else if (globalWormhole.keyTerms &&
            typeof globalWormhole.keyTerms.provider === 'string' &&
            globalWormhole.keyTerms.provider.trim().length > 0) {
            provider = globalWormhole.keyTerms.provider;
        }
        const configuredModel = globalWormhole.keyTerms && typeof globalWormhole.keyTerms.model === 'string'
            ? globalWormhole.keyTerms.model
            : undefined;
        const modelName = (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-pro';
        if (provider !== 'gemini') {
            throw new Error('Wormhole key-term extraction is currently implemented only for Gemini provider.');
        }
        const { terms, model } = await extractKeyTermsWithGemini(cleanedText, modelName);
        if (!terms || terms.length === 0) {
            throw new Error('Key-term extraction produced no terms.');
        }
        const now = new Date().toISOString();
        const existingKeyTerms = (Array.isArray(cardRecord.keyTerms) ? cardRecord.keyTerms : []) || [];
        const mergedKeyTerms = [...existingKeyTerms, ...terms];
        const existingProcessing = (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
        const existingKeyTermsStep = existingProcessing.keyTerms || {};
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
        };
        const nextCardRecord = {
            ...cardRecord,
            updatedAt: now,
            keyTerms: mergedKeyTerms,
            wormhole: {
                ...(cardRecord.wormhole || {}),
                processing: nextProcessing,
            },
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(nextCardRecord));
        return {
            cardId,
            step: 'keyTerms',
            status: nextProcessing.keyTerms,
        };
    });
    electron_1.ipcMain.handle('wormhole-run-wiki-update', async (_event, payload) => {
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole wiki update.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; cannot run wiki update.');
        }
        let cardRecord = null;
        for (let i = records.length - 1; i >= 0; i -= 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                    break;
                }
            }
            catch {
                // ignore
            }
        }
        if (!cardRecord) {
            throw new Error('Card record not found in Hypercore for Wormhole wiki update.');
        }
        const keyTerms = Array.isArray(cardRecord.keyTerms) ? cardRecord.keyTerms : [];
        if (!keyTerms || keyTerms.length === 0) {
            throw new Error('No key terms found on this card; run key-term extraction before wiki update.');
        }
        const globalWormhole = store.get(WORMHOLE_SETTINGS_KEY, {}) || {};
        let provider = 'none';
        if (overrideProvider && typeof overrideProvider === 'string') {
            provider = overrideProvider;
        }
        else if (globalWormhole.wikiUpdate &&
            typeof globalWormhole.wikiUpdate.provider === 'string' &&
            globalWormhole.wikiUpdate.provider.trim().length > 0) {
            provider = globalWormhole.wikiUpdate.provider;
        }
        const configuredModel = globalWormhole.wikiUpdate && typeof globalWormhole.wikiUpdate.model === 'string'
            ? globalWormhole.wikiUpdate.model
            : undefined;
        const modelName = (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel;
        await (0, p2p_1.createCore)(WIKI_CORE_NAME);
        const now = new Date().toISOString();
        const wikiEntries = [];
        for (const termObj of keyTerms) {
            const rawTerm = termObj && typeof termObj.term === 'string' ? termObj.term : '';
            const term = rawTerm.trim();
            if (!term)
                continue;
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
                kind: termObj && typeof termObj.type === 'string' ? termObj.type : undefined,
                createdAt: now,
                sourceCardId: cardId,
                source: 'wormhole',
            };
            await (0, p2p_1.appendToCore)(WIKI_CORE_NAME, JSON.stringify(record));
            wikiEntries.push({ term, wikiId });
        }
        if (wikiEntries.length === 0) {
            throw new Error('Wiki update did not create any entries from key terms.');
        }
        const existingProcessing = (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
        const existingWikiStep = existingProcessing.wikiUpdate || {};
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
        };
        const nextCardRecord = {
            ...cardRecord,
            updatedAt: now,
            wormhole: {
                ...(cardRecord.wormhole || {}),
                processing: nextProcessing,
                wikiEntries,
            },
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(nextCardRecord));
        return {
            cardId,
            step: 'wikiUpdate',
            status: nextProcessing.wikiUpdate,
        };
    });
    electron_1.ipcMain.handle('wormhole-get-status', async (_event, payload) => {
        const { cardId, contentId } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole status at this time.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; cannot read Wormhole status.');
        }
        let cardRecord = null;
        for (let i = records.length - 1; i >= 0; i -= 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                    break;
                }
            }
            catch {
                // ignore parse errors
            }
        }
        if (!cardRecord || !cardRecord.wormhole) {
            throw new Error('Wormhole metadata not found on this card.');
        }
        const ingest = cardRecord.wormhole.ingest || {};
        const processing = (cardRecord.wormhole.processing || {});
        const makeStep = (existing, fallbackStatus) => ({
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
        };
        return status;
    });
    electron_1.ipcMain.handle('wormhole-get-derived-artifacts', async (_event, payload) => {
        const { cardId } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required for Wormhole derived artifacts.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty; no artifacts available.');
        }
        let cardRecord = null;
        const transcripts = [];
        for (let i = 0; i < records.length; i += 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                }
                else if (parsed && parsed.type === 'wormhole-transcript') {
                    transcripts.push({
                        id: parsed.id || String(i),
                        text: parsed.text || '',
                        createdAt: parsed.createdAt || '',
                        provider: parsed.provider || '',
                        model: parsed.model,
                    });
                }
            }
            catch {
                // ignore
            }
        }
        if (!cardRecord || !cardRecord.wormhole) {
            throw new Error('Wormhole metadata not found on this card.');
        }
        const ingest = cardRecord.wormhole.ingest || {};
        const summaries = Array.isArray(cardRecord.summaries) ? cardRecord.summaries : [];
        const keyTerms = Array.isArray(cardRecord.keyTerms) ? cardRecord.keyTerms : [];
        const wikiEntries = Array.isArray(cardRecord.wormhole.wikiEntries) && cardRecord.wormhole.wikiEntries.length > 0
            ? cardRecord.wormhole.wikiEntries
            : [];
        const result = {
            cardId,
            contentId: ingest.contentId || '',
            transcripts,
            summaries,
            keyTerms,
            wikiEntries,
        };
        return result;
    });
    electron_1.ipcMain.handle('wormhole-get-card-text', async (_event, payload) => {
        const { cardId } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required to get card text.');
        }
        const records = await (0, p2p_1.readCore)(cardId);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error('Card Hypercore is empty.');
        }
        let cardRecord = null;
        for (let i = records.length - 1; i >= 0; i -= 1) {
            const raw = records[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.type === 'card') {
                    cardRecord = parsed;
                    break;
                }
            }
            catch {
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
            }
            catch (error) {
                console.error('Failed to read original text file:', error);
                return '';
            }
        }
        return '';
    });
    electron_1.ipcMain.handle('wormhole-get-wiki-index', async () => {
        try {
            const records = await (0, p2p_1.readCore)(WIKI_CORE_NAME);
            const entryList = [];
            const metaMap = {};
            for (const raw of records) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const data = JSON.parse(raw);
                    if (!data || typeof data.type !== 'string')
                        continue;
                    if (data.type === 'wiki-entry') {
                        entryList.push({
                            wikiId: String(data.wikiId || ''),
                            term: String(data.term || ''),
                            kind: typeof data.kind === 'string' ? data.kind : undefined,
                            createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
                            sourceCardId: typeof data.sourceCardId === 'string' ? data.sourceCardId : undefined,
                            raw: data,
                        });
                    }
                    else if (data.type === 'wiki-term-meta') {
                        const term = (String(data.term || '').trim() || '(untitled term)');
                        const key = term.toLowerCase();
                        const updatedAt = typeof data.updatedAt === 'string'
                            ? data.updatedAt
                            : typeof data.createdAt === 'string'
                                ? data.createdAt
                                : '';
                        const relatedTerms = Array.isArray(data.relatedTerms)
                            ? data.relatedTerms
                                .filter((t) => typeof t === 'string' && t.trim().length > 0)
                                .map((t) => t.trim())
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
                }
                catch {
                    // ignore parse errors
                }
            }
            return { entryList, metaMap };
        }
        catch (error) {
            console.error('Failed to get wiki index:', error);
            // Return empty if core doesn't exist yet or other error
            return { entryList: [], metaMap: {} };
        }
    });
    // P2P IPC handlers
    electron_1.ipcMain.handle('p2p-create-core', async (_event, name) => {
        return (0, p2p_1.createCore)(name);
    });
    electron_1.ipcMain.handle('p2p-append', async (_event, { name, data }) => {
        return (0, p2p_1.appendToCore)(name, data);
    });
    electron_1.ipcMain.handle('p2p-read', async (_event, name, options) => {
        return (0, p2p_1.readCore)(name, options);
    });
    electron_1.ipcMain.handle('p2p-get-length', async (_event, name) => {
        return (0, p2p_1.getCoreLength)(name);
    });
    // Profile & System Stats IPC
    electron_1.ipcMain.handle('get-profile', async () => {
        return store.get('userProfile', { displayName: 'Anon Node', bio: '' });
    });
    electron_1.ipcMain.handle('save-profile', async (_event, profile) => {
        store.set('userProfile', profile);
        return true;
    });
    electron_1.ipcMain.handle('save-profile-image', async (_event, payload) => {
        const { bytesBase64, mimeType } = payload;
        if (!bytesBase64)
            throw new Error('No image data provided');
        // 1. Get current profile to check for existing card
        const currentProfile = store.get('userProfile', {});
        let cardId = currentProfile.profileCardId;
        let isNewCard = false;
        if (!cardId) {
            cardId = `card-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            isNewCard = true;
        }
        // 2. Save image to disk
        const userDataDir = electron_1.app.getPath('userData');
        const wormholeDir = path.join(userDataDir, 'wormhole');
        await fs.promises.mkdir(wormholeDir, { recursive: true });
        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `profile-${Date.now()}.${ext}`;
        const targetPath = path.join(wormholeDir, fileName);
        const buffer = Buffer.from(bytesBase64, 'base64');
        await fs.promises.writeFile(targetPath, buffer);
        // 3. Create Card Record
        const now = new Date().toISOString();
        const coreInfo = await (0, p2p_1.createCore)(cardId); // Create or load existing core
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
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(cardRecord));
        // 5. If new, append to Card Library
        if (isNewCard) {
            await (0, p2p_1.createCore)(CARD_LIBRARY_CORE_NAME);
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
            await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
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
    electron_1.ipcMain.handle('get-system-stats', async () => {
        // 1. Storage usage
        let storageUsageBytes = 0;
        try {
            // Simple recursive size
            const getDirSize = async (dir) => {
                const files = await fs.promises.readdir(dir, { withFileTypes: true });
                let size = 0;
                for (const file of files) {
                    const filePath = path.join(dir, file.name);
                    if (file.isDirectory()) {
                        size += await getDirSize(filePath);
                    }
                    else {
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
        }
        catch {
            // ignore
        }
        // 2. Counts
        let cardCount = 0;
        let wikiEntryCount = 0;
        let wormholeRunCount = 0; // Not easily tracked without scanning all cards, skip for now or approx
        try {
            cardCount = await (0, p2p_1.getCoreLength)(CARD_LIBRARY_CORE_NAME).catch(() => 0);
            wikiEntryCount = await (0, p2p_1.getCoreLength)(WIKI_CORE_NAME).catch(() => 0);
        }
        catch {
            // ignore
        }
        // 3. P2P Stats
        const p2pStats = await (0, p2p_1.getP2PStats)();
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
    (0, p2p_1.initP2P)();
    try {
        const llamaSettings = getLlamaSettingsInternal();
        if (llamaSettings.autoStart) {
            startLlamaServerInternal().catch((error) => {
                console.error('Failed to auto-start llama server:', error);
            });
        }
    }
    catch (error) {
        console.error('Failed to read llama settings during auto-start:', error);
    }
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
