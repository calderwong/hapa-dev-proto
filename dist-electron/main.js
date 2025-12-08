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
const pipeline_1 = require("./pipeline");
const thors_hamma_1 = require("./thors-hamma");
const vertexai_1 = require("./vertexai");
const persistence_1 = require("./persistence");
const store = new electron_store_1.default();
const GEMINI_REQUEST_LOG_KEY = 'geminiRequestLog';
const GEMINI_REQUEST_LOG_MAX_ENTRIES = 200;
const ADMIN_SETTINGS_KEY = 'adminSettings';
const LLAMA_SETTINGS_KEY = 'llamaSettings';
const LOCAL_VISION_SETTINGS_KEY = 'localVisionSettings';
const WORMHOLE_SETTINGS_KEY = 'wormholeSettings';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const WIKI_CORE_NAME = 'wormhole-wiki-entries';
// ============================================================================
// MEMORY MANAGEMENT UTILITIES
// ============================================================================
/** Log memory usage for debugging memory issues */
const logMemory = (label) => {
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
const activeOperations = new Map();
const startOperation = (id, type, sizeMB) => {
    activeOperations.set(id, { startTime: Date.now(), type, sizeMB });
    if (activeOperations.size > 5) {
        console.warn(`[Ops] Warning: ${activeOperations.size} concurrent operations active`);
    }
};
const endOperation = (id) => {
    const op = activeOperations.get(id);
    if (op) {
        const duration = Date.now() - op.startTime;
        console.log(`[Ops] Completed ${op.type} (${id}) in ${duration}ms. Active ops: ${activeOperations.size - 1}`);
        activeOperations.delete(id);
    }
};
// ============================================================================
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
let visionProcess = null;
let visionStatus = { running: false };
const getLocalVisionSettingsInternal = () => {
    const stored = store.get(LOCAL_VISION_SETTINGS_KEY, {}) || {};
    const modelsDir = typeof stored.modelsDir === 'string' && stored.modelsDir.length > 0
        ? stored.modelsDir
        : path.join(electron_1.app.getPath('userData'), 'vision-models');
    return {
        pythonPath: stored.pythonPath || 'python', // Default to 'python' in PATH
        modelsDir,
        activeModel: stored.activeModel || 'Tongyi-MAI/Z-Image-Turbo',
        port: typeof stored.port === 'number' && stored.port > 0 ? stored.port : 11435,
        autoStart: stored.autoStart === true,
    };
};
const saveLocalVisionSettingsInternal = (settings) => {
    store.set(LOCAL_VISION_SETTINGS_KEY, settings);
};
const getLocalVisionStatusInternal = () => {
    const running = !!visionProcess && !visionProcess.killed;
    return { ...visionStatus, running };
};
const startVisionServerInternal = async () => {
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
        const serverScript = electron_is_dev_1.default
            ? path.join(__dirname, '../python/server.py')
            : path.join(process.resourcesPath, 'python/server.py'); // Assuming we package it here for prod
        // If running in dev but accessing via 'electron', __dirname might be dist-electron
        // We need to reliably find the python folder. 
        // In dev: root/python/server.py
        // In prod: resources/python/server.py
        let scriptPath = '';
        if (electron_is_dev_1.default) {
            scriptPath = path.resolve(__dirname, '..', 'python', 'server.py');
        }
        else {
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
        const child = (0, child_process_1.spawn)(settings.pythonPath, [scriptPath], {
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
                lastError: code && code !== 0
                    ? `Vision server exited with code ${code}${signal ? ` (signal ${signal})` : ''}`
                    : visionStatus.lastError,
            };
        });
        child.on('error', (err) => {
            visionProcess = null;
            visionStatus = { running: false, lastError: err.message };
        });
        return getLocalVisionStatusInternal();
    }
    catch (error) {
        const msg = error?.message || 'Failed to start vision server';
        visionProcess = null;
        visionStatus = { running: false, lastError: msg };
        throw new Error(msg);
    }
};
const stopVisionServerInternal = () => {
    if (visionProcess && !visionProcess.killed) {
        visionProcess.kill();
    }
    visionProcess = null;
    visionStatus = { ...visionStatus, running: false };
    return getLocalVisionStatusInternal();
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
        imageGenSettings: stored.imageGenSettings,
    };
};
const saveAdminSettings = (settings) => {
    const existing = getAdminSettings();
    const merged = { ...existing, ...settings };
    store.set(ADMIN_SETTINGS_KEY, merged);
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
const DEFAULT_GEMINI_MODEL = 'gemini-3-pro-preview';
const resolveGeminiModelName = (modelName) => {
    const trimmed = (modelName || '').toString().trim();
    if (!trimmed || trimmed === 'gemini-pro') {
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
const analyzeImageWithGemini = async (imagePath, comprehensiveContext, modelName) => {
    const opId = `img-analyze-${Date.now()}`;
    startOperation(opId, 'analyzeImage');
    const apiKey = store.get('geminiKey');
    if (!apiKey) {
        endOperation(opId);
        throw new Error('Gemini API Key not found. Please configure it in Settings.');
    }
    // Use a multimodal-capable model, preferring 2.5 flash for speed
    const resolvedModel = resolveGeminiModelName(modelName) || 'gemini-2.5-flash';
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    // Read and encode image - use let so we can null after use
    let imageBuffer = await fs.promises.readFile(imagePath);
    const fileSizeMB = imageBuffer.length / (1024 * 1024);
    console.log('[VisualAnalysis] Image size:', fileSizeMB.toFixed(2), 'MB');
    let base64Image = imageBuffer.toString('base64');
    imageBuffer = null; // Release buffer immediately after encoding
    // Detect MIME type from extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap = {
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
    const rawText = response.text?.() || '';
    // Parse JSON response
    let parsed = {};
    try {
        // Clean up potential markdown code blocks
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    }
    catch (parseErr) {
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
const analyzeVideoWithGemini = async (videoPath, comprehensiveContext, modelName) => {
    const opId = `vid-analyze-${Date.now()}`;
    startOperation(opId, 'analyzeVideo');
    const apiKey = store.get('geminiKey');
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
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    // Read and encode video - use let so we can null after use
    let videoBuffer = await fs.promises.readFile(videoPath);
    console.log('[VideoAnalysis] Video size:', fileSizeMB.toFixed(2), 'MB');
    let base64Video = videoBuffer.toString('base64');
    videoBuffer = null; // Release buffer immediately after encoding
    // Detect MIME type from extension
    const ext = path.extname(videoPath).toLowerCase();
    const mimeMap = {
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
    const rawText = response.text?.() || '';
    // Parse JSON response
    let parsed = {};
    try {
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
    }
    catch (parseErr) {
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
const getScrollContextForCard = async (cardRecord) => {
    if (!cardRecord.scrolls || !Array.isArray(cardRecord.scrolls) || cardRecord.scrolls.length === 0) {
        return '';
    }
    const scrollTexts = [];
    for (const scroll of cardRecord.scrolls) {
        if (!scroll.cardId || !scroll.includeInSummarization)
            continue;
        try {
            const scrollRecords = await (0, p2p_1.readCore)(scroll.cardId);
            if (!Array.isArray(scrollRecords) || scrollRecords.length === 0)
                continue;
            // Find the card record in the scroll's Hypercore
            let scrollCardRecord = null;
            for (let i = scrollRecords.length - 1; i >= 0; i--) {
                const raw = scrollRecords[i];
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.type === 'card' || parsed.mediaKind)) {
                        scrollCardRecord = parsed;
                        break;
                    }
                }
                catch { /* ignore */ }
            }
            if (!scrollCardRecord)
                continue;
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
                }
                catch { /* ignore read errors */ }
            }
        }
        catch (err) {
            console.warn('[Scroll] Failed to read scroll card:', scroll.cardId, err);
        }
    }
    if (scrollTexts.length === 0)
        return '';
    // Combine and cap at 32KB
    const combined = scrollTexts.join('\n\n');
    return combined.length > 32000 ? combined.slice(0, 32000) + '\n[...truncated]' : combined;
};
// Helper: Build comprehensive context for LLM analysis
// Includes: scroll text, existing summaries, image prompts, video prompts, derivatives info
const buildComprehensiveContext = async (cardRecord, cardId) => {
    const contextParts = [];
    // 1. Scroll context
    const scrollText = await getScrollContextForCard(cardRecord);
    if (scrollText) {
        contextParts.push(`=== ATTACHED SCROLLS ===\n${scrollText}`);
    }
    // 2. Existing summaries (from previous runs)
    if (cardRecord.summaries && Array.isArray(cardRecord.summaries)) {
        const latestSummary = cardRecord.summaries.find((s) => s.kind === 'medium' || s.kind === 'visual-analysis');
        if (latestSummary && latestSummary.text) {
            contextParts.push(`=== EXISTING SUMMARY ===\n${latestSummary.text}`);
        }
        // Include visual analysis details if present
        const visualAnalysis = cardRecord.summaries.find((s) => s.kind === 'visual-analysis');
        if (visualAnalysis) {
            const details = [];
            if (visualAnalysis.description)
                details.push(`Description: ${visualAnalysis.description}`);
            if (visualAnalysis.colors?.length)
                details.push(`Colors: ${visualAnalysis.colors.join(', ')}`);
            if (visualAnalysis.themes?.length)
                details.push(`Themes: ${visualAnalysis.themes.join(', ')}`);
            if (visualAnalysis.mood)
                details.push(`Mood: ${visualAnalysis.mood}`);
            if (visualAnalysis.people)
                details.push(`People: ${visualAnalysis.people}`);
            if (visualAnalysis.textContent)
                details.push(`Visible Text: ${visualAnalysis.textContent}`);
            if (visualAnalysis.technicalStyle)
                details.push(`Style: ${visualAnalysis.technicalStyle}`);
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
            if (!child.cardId)
                continue;
            try {
                const childRecords = await (0, p2p_1.readCore)(child.cardId);
                if (!Array.isArray(childRecords) || childRecords.length === 0)
                    continue;
                for (let i = childRecords.length - 1; i >= 0; i--) {
                    const raw = childRecords[i];
                    if (!raw || typeof raw !== 'string')
                        continue;
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
                    }
                    catch { /* ignore */ }
                }
            }
            catch { /* ignore */ }
        }
    }
    // 6. Title and metadata
    if (cardRecord.title || cardRecord.name) {
        contextParts.push(`=== CARD TITLE ===\n${cardRecord.title || cardRecord.name}`);
    }
    if (contextParts.length === 0)
        return '';
    const combined = contextParts.join('\n\n');
    // Cap at 48KB to leave room for the main content
    return combined.length > 48000 ? combined.slice(0, 48000) + '\n[...context truncated]' : combined;
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
            webviewTag: true, // Enable <webview> for portal cards
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
        }
        else {
            callback(false);
        }
    });
    if (electron_is_dev_1.default) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools(); // Use F12 to toggle
    }
    else {
        win.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }
    // Initialize Pipeline Manager
    (0, pipeline_1.initPipeline)(win);
    // Initialize Thor's Hamma Manager
    thors_hamma_1.thorsHammaManager.setWindow(win);
    electron_1.ipcMain.handle('thor:process-url', async (event, { url, handCards }) => {
        return thors_hamma_1.thorsHammaManager.processUrl(url, handCards);
    });
    win.on('closed', () => {
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
    // --- Local Vision IPC Handlers ---
    electron_1.ipcMain.handle('get-local-vision-settings', () => {
        return getLocalVisionSettingsInternal();
    });
    electron_1.ipcMain.handle('save-local-vision-settings', (_event, settings) => {
        saveLocalVisionSettingsInternal(settings);
        return true;
    });
    electron_1.ipcMain.handle('get-local-vision-status', () => {
        return getLocalVisionStatusInternal();
    });
    electron_1.ipcMain.handle('start-local-vision', async () => {
        return startVisionServerInternal();
    });
    electron_1.ipcMain.handle('stop-local-vision', () => {
        return stopVisionServerInternal();
    });
    electron_1.ipcMain.handle('list-vision-models', async () => {
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
            if (!response.ok)
                throw new Error(`Server returned ${response.status}`);
            return await response.json();
        }
        catch (e) {
            throw new Error(`Failed to list models: ${e.message}`);
        }
    });
    electron_1.ipcMain.handle('download-vision-model', async (_event, payload) => {
        const status = getLocalVisionStatusInternal();
        if (!status.running || !status.port) {
            throw new Error('Vision server is not running.');
        }
        if (!payload.repo_id)
            throw new Error('repo_id is required');
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
            if (!response.ok)
                throw new Error(`Server returned ${response.status}`);
            return await response.json();
        }
        catch (e) {
            throw new Error(`Failed to trigger download: ${e.message}`);
        }
    });
    electron_1.ipcMain.handle('generate-local-image', async (_event, payload) => {
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
        }
        catch (e) {
            throw new Error(`Failed to generate image: ${e.message}`);
        }
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
        saveAdminSettings(settings);
        return true;
    });
    // Vertex AI Settings handlers
    electron_1.ipcMain.handle('get-vertex-ai-settings', () => {
        const { getVertexAISettings } = require('./vertexai');
        return getVertexAISettings();
    });
    electron_1.ipcMain.handle('save-vertex-ai-settings', (_event, settings) => {
        const { saveVertexAISettings, resetVertexAIClient } = require('./vertexai');
        saveVertexAISettings(settings);
        resetVertexAIClient(); // Reset client to pick up new settings
        return true;
    });
    electron_1.ipcMain.handle('test-vertex-ai-connection', async () => {
        const { getVertexAIClient, isVertexAIConfigured } = require('./vertexai');
        if (!isVertexAIConfigured()) {
            return { success: false, message: 'Vertex AI is not configured. Please enter Project ID and API Key.' };
        }
        const client = getVertexAIClient();
        return await client.testConnection();
    });
    electron_1.ipcMain.handle('get-vertex-ai-models', () => {
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
    electron_1.ipcMain.handle('generate-image-for-card', async (_event, { cardContext, seriesContext, provider = 'gemini', // Default to Gemini
     }) => {
        const opId = `img-gen-${Date.now()}`;
        startOperation(opId, 'generateImage');
        logMemory('ImageGen Start');
        const apiKey = store.get('geminiKey');
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
        if (cardContext.image)
            console.log('[ImageGen] Including Input Image for Multimodal Context');
        try {
            // Step 1: Craft image prompt using LLM (always done)
            const contentParts = [];
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
            let promptCraftingRequest;
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
            }
            else {
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
            let craftedPrompt = '';
            // Check if Vertex AI is configured (preferred)
            if ((0, vertexai_1.isVertexAIConfigured)()) {
                console.log('[ImageGen] Using Vertex AI for prompt crafting');
                try {
                    const vertexClient = (0, vertexai_1.getVertexAIClient)();
                    // Note: Vertex AI multimodal requires different handling
                    // For now, use text-only prompt crafting
                    const result = await vertexClient.generateContent(promptCraftingRequest, 'fast-llm');
                    craftedPrompt = result.text.trim();
                }
                catch (e) {
                    console.error('[ImageGen] Vertex AI Prompt Crafting failed:', e);
                    throw new Error(`Vertex AI prompt crafting failed: ${e.message}`);
                }
            }
            else {
                // Fallback to Google AI Studio
                if (!apiKey) {
                    throw new Error('No AI provider configured. Set up Vertex AI or Google AI Studio.');
                }
                const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
                const promptModel = genAI.getGenerativeModel({ model: imageGenSettings.defaultPromptLLM });
                try {
                    // Construct Multimodal Request
                    const promptParts = [promptCraftingRequest];
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
                }
                catch (e) {
                    console.error('[ImageGen] SDK Prompt Crafting failed:', e);
                    throw new Error(`LLM prompt crafting failed: ${e.message}`);
                }
            }
            if (!craftedPrompt) {
                throw new Error('Failed to craft image prompt from LLM');
            }
            console.log('[ImageGen] Crafted prompt:', craftedPrompt.substring(0, 200) + '...');
            // Step 2: Generate image using the crafted prompt
            let imageBase64 = null;
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
                }
                else {
                    throw new Error('Local server returned no images.');
                }
            }
            else if ((0, vertexai_1.isVertexAIConfigured)()) {
                // Vertex AI Image Generation using Imagen 4 (same as Hell Week pipeline)
                console.log('[ImageGen] Using Vertex AI Imagen for image generation');
                try {
                    const vertexClient = (0, vertexai_1.getVertexAIClient)();
                    // Use generateImageImagen with 'pro-image' (Imagen 4) - same as Hell Week pipeline
                    const result = await vertexClient.generateImageImagen(craftedPrompt, 'pro-image', {
                        aspectRatio: '1:1',
                        sampleCount: 1,
                    });
                    imageBase64 = result.base64;
                    mimeType = result.mimeType;
                }
                catch (e) {
                    console.error('[ImageGen] Vertex AI Imagen Generation failed:', e);
                    throw new Error(`Vertex AI image generation failed: ${e.message}`);
                }
            }
            else {
                // Fallback: Google AI Studio Gemini Image Generation
                if (!apiKey) {
                    throw new Error('No AI provider configured for image generation.');
                }
                const imageUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageGenSettings.defaultImageModel}:generateContent?key=${apiKey}`;
                console.log(`[ImageGen] Calling Gemini Image API: ${imageUrl.replace(apiKey, 'HIDDEN_KEY')}`);
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
                let imageData;
                try {
                    imageData = JSON.parse(rawText);
                }
                catch (e) {
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
                    const textContent = parts.find((p) => p.text)?.text || '';
                    const base64Match = textContent.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
                    if (base64Match) {
                        imageBase64 = base64Match[1];
                    }
                    else {
                        throw new Error('No image data in response. The model may not support image generation.');
                    }
                }
            }
            // Step 3: Save image to file
            const userDataDir = electron_1.app.getPath('userData');
            const imagesDir = path.join(userDataDir, 'wormhole', 'card-images');
            await fs.promises.mkdir(imagesDir, { recursive: true });
            const fileName = `card-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
            const filePath = path.join(imagesDir, fileName);
            await fs.promises.writeFile(filePath, Buffer.from(imageBase64, 'base64'));
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
        }
        catch (error) {
            console.error('[ImageGen] Error:', error);
            endOperation(opId);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    });
    // Create looping video from an image (one-click loop generation)
    electron_1.ipcMain.handle('create-loop-video-for-image', async (_event, { parentCardId, imageId, imagePath, originalPrompt, cardName, imageOrder, }) => {
        const opId = `loop-vid-${Date.now()}`;
        startOperation(opId, 'createLoopVideo');
        logMemory('LoopVideo Start');
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            endOperation(opId);
            throw new Error('Gemini API Key not found. Please configure it in Settings.');
        }
        console.log('[LoopVideo] Starting loop video creation for image:', imageId);
        console.log('[LoopVideo] Original prompt:', originalPrompt?.substring(0, 100));
        try {
            // Step 1: Read the source image and convert to base64
            // Use let so we can null after API call to free memory during polling
            let imageBuffer = await fs.promises.readFile(imagePath);
            const imageSizeMB = imageBuffer.length / (1024 * 1024);
            console.log('[LoopVideo] Image size:', imageSizeMB.toFixed(2), 'MB');
            let imageBase64 = imageBuffer.toString('base64');
            imageBuffer = null; // Release buffer immediately
            const imageMimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
            // Step 2: Craft a loop-optimized prompt using LLM
            // Priority: Vertex AI -> Google AI Studio
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
            let loopPrompt;
            if ((0, vertexai_1.isVertexAIConfigured)()) {
                console.log('[LoopVideo] Using Vertex AI for prompt crafting (Fast LLM)');
                try {
                    const vertexClient = (0, vertexai_1.getVertexAIClient)();
                    // Use Fast LLM (Gemini 2.5 Flash) for reliable, high-quota generation
                    const result = await vertexClient.generateContent(loopPromptRequest, 'fast-llm');
                    loopPrompt = result.text.trim();
                }
                catch (e) {
                    console.error('[LoopVideo] Vertex AI Prompt Crafting failed:', e);
                    // Don't throw yet, try fallback if key exists
                    if (!apiKey)
                        throw e;
                }
            }
            // Fallback to Google AI Studio if Vertex failed or not configured
            if (!loopPrompt) {
                if (!apiKey) {
                    throw new Error('No AI provider configured. Set up Vertex AI or Google AI Studio.');
                }
                const adminSettings = getAdminSettings();
                // Default to flash for reliability if falling back
                let promptLLM = 'gemini-2.5-flash';
                let llmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${promptLLM}:generateContent?key=${apiKey}`;
                console.log(`[LoopVideo] Crafting prompt with AI Studio model: ${promptLLM}`);
                let llmResponse = await fetch(llmUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: loopPromptRequest }] }],
                    }),
                });
                if (!llmResponse.ok) {
                    const errText = await llmResponse.text();
                    throw new Error(`LLM prompt crafting failed (${promptLLM}): ${errText}`);
                }
                const llmData = await llmResponse.json();
                loopPrompt = llmData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            }
            if (!loopPrompt) {
                throw new Error('Failed to craft loop video prompt');
            }
            console.log('[LoopVideo] Crafted loop prompt:', loopPrompt.substring(0, 150));
            // Broadcast progress to renderer (safely handles disposed windows)
            const broadcastLoopProgress = (data) => {
                try {
                    const [mainWin] = electron_1.BrowserWindow.getAllWindows();
                    if (mainWin && !mainWin.isDestroyed() && mainWin.webContents && !mainWin.webContents.isDestroyed()) {
                        mainWin.webContents.send('loop-video-progress', data);
                    }
                }
                catch (e) {
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
            broadcastLoopProgress({
                imageId,
                status: 'generating',
                message: 'Generating loop video...',
            });
            let operationName = '';
            let useVertex = false;
            // Check if Vertex AI is configured (preferred)
            if ((0, vertexai_1.isVertexAIConfigured)()) {
                console.log('[LoopVideo] Using Vertex AI for video generation');
                useVertex = true;
                try {
                    const vertexClient = (0, vertexai_1.getVertexAIClient)();
                    const result = await vertexClient.generateVideo(loopPrompt, {
                        startFrameBase64: imageBase64,
                        startFrameMimeType: imageMimeType,
                        endFrameBase64: imageBase64, // Same image for seamless loop
                        endFrameMimeType: imageMimeType,
                        aspectRatio: '16:9',
                        loopMode: true,
                    });
                    operationName = result.operationName;
                    console.log('[LoopVideo] Vertex AI video generation started, operation:', operationName);
                }
                catch (vertexErr) {
                    console.error('[LoopVideo] Vertex AI failed, falling back to AI Studio:', vertexErr.message);
                    useVertex = false;
                }
            }
            // Fallback to Google AI Studio if Vertex not configured or failed
            if (!useVertex) {
                // Use stable Veo model - preview models may have different response formats
                const videoModel = 'veo-3.0-generate-001';
                const videoUrl = `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning?key=${apiKey}`;
                // Build instance with image as start frame and loop mode
                const instance = {
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
                const parameters = {
                    aspectRatio: '16:9',
                };
                const videoRequestBody = {
                    instances: [instance],
                    parameters,
                };
                console.log('[LoopVideo] Calling AI Studio Veo API for loop generation...');
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
                operationName = videoOpData.name;
                if (!operationName) {
                    throw new Error('No operation name returned from video generation');
                }
                console.log('[LoopVideo] AI Studio video generation started, operation:', operationName);
            }
            // CRITICAL: Release base64 data BEFORE the polling loop
            // This was staying in memory for 5+ minutes during polling!
            imageBase64 = null;
            hintGC();
            logMemory('LoopVideo After Request (before polling)');
            // Step 4: Poll for completion
            const videoModel = 'veo-3.0-generate-001';
            const maxAttempts = 60; // 5 minutes with 5 second intervals
            let videoBuffer = null;
            if (useVertex) {
                // Poll using Vertex AI
                console.log('[LoopVideo] Polling Vertex AI for completion...');
                const vertexClient = (0, vertexai_1.getVertexAIClient)();
                try {
                    const result = await vertexClient.pollVideoOperation(operationName, maxAttempts, 5000, (attempt, max) => {
                        broadcastLoopProgress({
                            imageId,
                            status: 'generating',
                            message: `Generating video... ${Math.round((attempt / max) * 100)}%`,
                            progress: Math.round((attempt / max) * 100),
                        });
                    });
                    // Vertex returns base64 directly
                    videoBuffer = Buffer.from(result.videoBase64, 'base64').buffer;
                    console.log('[LoopVideo] Vertex AI video generation complete!');
                }
                catch (pollErr) {
                    throw new Error(`Vertex AI polling failed: ${pollErr.message}`);
                }
            }
            else {
                // Poll using AI Studio
                const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    broadcastLoopProgress({
                        imageId,
                        status: 'generating',
                        message: `Generating video... ${Math.round((attempt / maxAttempts) * 100)}%`,
                        progress: Math.round((attempt / maxAttempts) * 100),
                    });
                    const pollResponse = await fetch(pollUrl);
                    if (!pollResponse.ok)
                        continue;
                    const pollData = await pollResponse.json();
                    if (pollData.done) {
                        console.log('[LoopVideo] AI Studio video generation complete!');
                        console.log('[LoopVideo] Response structure:', JSON.stringify(Object.keys(pollData.response || {})));
                        // Extract video from response - handle multiple possible structures
                        const generatedSamples = pollData.response?.generateVideoResponse?.generatedSamples ||
                            pollData.response?.generatedVideos ||
                            pollData.response?.videos ||
                            pollData.result?.videos ||
                            [];
                        if (generatedSamples.length === 0) {
                            console.error('[LoopVideo] No videos in response. Full response:', JSON.stringify(pollData).slice(0, 500));
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
                        videoBuffer = await downloadResponse.arrayBuffer();
                        break;
                    }
                }
            }
            if (!videoBuffer) {
                throw new Error('Video generation timed out');
            }
            // Save video to card-videos directory
            const userDataDir = electron_1.app.getPath('userData');
            const videosDir = path.join(userDataDir, 'wormhole', 'card-videos');
            await fs.promises.mkdir(videosDir, { recursive: true });
            const videoCardId = `loop-video-${Date.now()}`;
            const videoFileName = `${videoCardId}.mp4`;
            const videoPath = path.join(videosDir, videoFileName);
            await fs.promises.writeFile(videoPath, Buffer.from(videoBuffer));
            console.log('[LoopVideo] Saved video to:', videoPath);
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
            await (0, p2p_1.createCore)(videoCardId);
            await (0, p2p_1.appendToCore)(videoCardId, JSON.stringify(videoCardRecord));
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
            await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
            console.log('[LoopVideo] Added video card to library index:', videoCardId);
            // Emit to persistence layer
            (0, persistence_1.emitCardEvent)('CARD_CREATED', {
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
                const libraryRecords = await (0, p2p_1.readCore)(CARD_LIBRARY_CORE_NAME);
                let parentIndexEntry = null;
                // Find the parent card's index entry
                for (let i = libraryRecords.length - 1; i >= 0; i--) {
                    const raw = libraryRecords[i];
                    if (!raw || typeof raw !== 'string')
                        continue;
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed.type === 'card-index' && parsed.cardId === parentCardId) {
                            parentIndexEntry = parsed;
                            break;
                        }
                    }
                    catch { /* ignore */ }
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
                    await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(updatedEntry));
                    console.log('[LoopVideo] Updated card-library index with children:', parentCardId);
                }
                // Also try to update the card's own hypercore (for non-Hell Week cards)
                try {
                    const parentRecords = await (0, p2p_1.readCore)(parentCardId);
                    let parentCardData = null;
                    for (let i = parentRecords.length - 1; i >= 0; i--) {
                        const raw = parentRecords[i];
                        if (!raw || typeof raw !== 'string')
                            continue;
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
                        }
                        catch { /* ignore */ }
                    }
                    if (parentCardData) {
                        if (!parentCardData.children) {
                            parentCardData.children = [];
                        }
                        parentCardData.children.push(childEntry);
                        await (0, p2p_1.appendToCore)(parentCardId, JSON.stringify({
                            type: 'card-state',
                            card: parentCardData,
                            updatedAt: new Date().toISOString(),
                        }));
                        console.log('[LoopVideo] Updated parent hypercore children:', parentCardId);
                    }
                }
                catch (coreErr) {
                    // This is fine - Hell Week cards may not have individual hypercores
                    console.log('[LoopVideo] No individual hypercore for card (likely Hell Week):', parentCardId);
                }
            }
            catch (parentErr) {
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
        }
        catch (error) {
            console.error('[LoopVideo] Error:', error);
            endOperation(opId);
            // Broadcast error - need to create helper here since it might not be defined yet
            const [errWin] = electron_1.BrowserWindow.getAllWindows();
            if (errWin) {
                errWin.webContents.send('loop-video-progress', {
                    imageId,
                    status: 'error',
                    message: error.message,
                });
            }
            throw new Error(`Loop video creation failed: ${error.message}`);
        }
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
                { name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Latest pro model' },
                { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast flash model' },
                { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash Exp', description: 'Experimental model' },
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
            { name: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Latest pro model' },
            { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast flash model' },
            { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash Exp', description: 'Experimental model' },
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
            // Suppress ECONNREFUSED as it just means server is not running
            if (error?.cause?.code !== 'ECONNREFUSED' && !error?.message?.includes('ECONNREFUSED')) {
                console.error('Error fetching Llama models from local server:', error);
            }
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
            const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
            if (audioExts.includes(ext)) {
                inferredMediaType = 'audio';
            }
            else if (videoExts.includes(ext)) {
                inferredMediaType = 'video';
            }
            else if (imageExts.includes(ext)) {
                inferredMediaType = 'image';
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
        else if (mediaType === 'image') {
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
        else if (mediaType === 'image') {
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
        // Emit to persistence layer
        (0, persistence_1.emitCardEvent)('CARD_CREATED', {
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
    });
    electron_1.ipcMain.handle('wormhole-run-transcription', async (_event, payload) => {
        const opId = `transcription-${Date.now()}`;
        startOperation(opId, 'transcription');
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            endOperation(opId);
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
        // Read audio - use let so we can null after use
        let audioBuffer = await fs.promises.readFile(localPath);
        const audioSizeMB = audioBuffer.length / (1024 * 1024);
        console.log('[Transcription] Audio size:', audioSizeMB.toFixed(2), 'MB');
        let base64 = audioBuffer.toString('base64');
        audioBuffer = null; // Release buffer after encoding
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
        endOperation(opId);
        return {
            cardId,
            step: 'transcription',
            status: nextProcessing.transcription,
        };
    });
    electron_1.ipcMain.handle('wormhole-run-summarization', async (_event, payload) => {
        const opId = `summarization-${Date.now()}`;
        startOperation(opId, 'summarization');
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            endOperation(opId);
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
                if (parsed && (parsed.type === 'card' || parsed.mediaKind)) {
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
        // Determine media type - support both old mediaType and new mediaKind
        const mediaType = (cardRecord.mediaType || cardRecord.mediaKind || '').toString();
        console.log('[Summarization] Card mediaType:', mediaType, 'cardId:', cardId);
        // Get model configuration
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
        else if (globalWormhole.defaultModel &&
            typeof globalWormhole.defaultModel.provider === 'string') {
            // Fall back to default model if set
            provider = globalWormhole.defaultModel.provider;
        }
        const configuredModel = globalWormhole.summarization?.model ||
            globalWormhole.defaultModel?.model ||
            undefined;
        const modelName = (overrideModel && typeof overrideModel === 'string' && overrideModel) ||
            configuredModel ||
            'gemini-2.5-flash'; // Updated default to multimodal-capable model
        if (provider !== 'gemini') {
            throw new Error('Wormhole summarization is currently implemented only for Gemini provider.');
        }
        // Get comprehensive context for all card types (scrolls, prompts, derivatives)
        const comprehensiveContext = await buildComprehensiveContext(cardRecord, cardId);
        const now = new Date().toISOString();
        const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let newSummaries = [];
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
        }
        else if (mediaType === 'video') {
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
        }
        else {
            // TEXT/AUDIO/OTHER: Use text summarization (existing logic)
            let textSource = '';
            // Check for transcripts first (audio cards)
            if (transcripts.length > 0) {
                const latest = transcripts[transcripts.length - 1];
                if (latest && typeof latest.text === 'string') {
                    textSource = latest.text;
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
                    }
                    catch (error) {
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
        const existingSummaries = (Array.isArray(cardRecord.summaries) ? cardRecord.summaries : []) || [];
        const updatedSummaries = [...existingSummaries, ...newSummaries];
        const existingProcessing = (cardRecord.wormhole && typeof cardRecord.wormhole === 'object' && cardRecord.wormhole.processing) || {};
        const existingSummarization = existingProcessing.summarization || {};
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
        endOperation(opId);
        return {
            cardId,
            step: 'summarization',
            status: nextProcessing.summarization,
        };
    });
    electron_1.ipcMain.handle('wormhole-run-keyterms', async (_event, payload) => {
        const opId = `keyterms-${Date.now()}`;
        startOperation(opId, 'keyTerms');
        const { cardId, overrideProvider, overrideModel } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            endOperation(opId);
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
                if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.mediaType)) {
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
        // Determine media type - support both old and new formats
        const mediaType = (cardRecord.mediaType || cardRecord.mediaKind || '').toString();
        console.log('[KeyTerms] Card mediaType:', mediaType, 'cardId:', cardId);
        // Build comprehensive context from ALL sources
        const comprehensiveContext = await buildComprehensiveContext(cardRecord, cardId);
        // Build text source from multiple places
        const textParts = [];
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
            }
            catch (error) {
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
            const visualSummary = cardRecord.summaries?.find((s) => s.kind === 'visual-analysis' || s.kind === 'medium');
            if (visualSummary && visualSummary.text) {
                textParts.push(`=== VISUAL CONTENT ANALYSIS ===\n${visualSummary.text}`);
            }
            // Also add visual analysis details if present
            const visualAnalysis = cardRecord.summaries?.find((s) => s.kind === 'visual-analysis');
            if (visualAnalysis) {
                const details = [];
                if (visualAnalysis.description)
                    details.push(`Description: ${visualAnalysis.description}`);
                if (visualAnalysis.colors?.length)
                    details.push(`Colors: ${visualAnalysis.colors.join(', ')}`);
                if (visualAnalysis.themes?.length)
                    details.push(`Themes: ${visualAnalysis.themes.join(', ')}`);
                if (visualAnalysis.mood)
                    details.push(`Mood: ${visualAnalysis.mood}`);
                if (visualAnalysis.people)
                    details.push(`People: ${visualAnalysis.people}`);
                if (visualAnalysis.textContent)
                    details.push(`Visible Text: ${visualAnalysis.textContent}`);
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
        else if (globalWormhole.defaultModel &&
            typeof globalWormhole.defaultModel.provider === 'string') {
            provider = globalWormhole.defaultModel.provider;
        }
        const configuredModel = globalWormhole.keyTerms?.model ||
            globalWormhole.defaultModel?.model ||
            undefined;
        const modelName = (overrideModel && typeof overrideModel === 'string' && overrideModel) || configuredModel || 'gemini-2.5-flash';
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
        endOperation(opId);
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
    // ============================================
    // SCROLL ATTACHMENT HANDLERS
    // ============================================
    // Attach a scroll (text/markdown card) to another card
    electron_1.ipcMain.handle('attach-card-scroll', async (_event, payload) => {
        const { cardId, scrollCardId, label, includeInSummarization = true, includeInKeyTerms = true, includeInWikiUpdate = true } = payload || {};
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
                if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
                    cardRecord = parsed;
                    break;
                }
            }
            catch { /* ignore */ }
        }
        if (!cardRecord) {
            throw new Error('Card record not found.');
        }
        // Verify scroll card exists and is text/markdown
        const scrollRecords = await (0, p2p_1.readCore)(scrollCardId);
        if (!Array.isArray(scrollRecords) || scrollRecords.length === 0) {
            throw new Error('Scroll card not found.');
        }
        let scrollCardRecord = null;
        for (let i = scrollRecords.length - 1; i >= 0; i -= 1) {
            const raw = scrollRecords[i];
            if (!raw || typeof raw !== 'string')
                continue;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
                    scrollCardRecord = parsed;
                    break;
                }
            }
            catch { /* ignore */ }
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
        if (existingScrolls.some((s) => s.cardId === scrollCardId)) {
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
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(updatedCardRecord));
        console.log('[Scroll] Attached scroll', scrollCardId, 'to card', cardId);
        return { success: true, scroll: newScroll };
    });
    // Detach a scroll from a card
    electron_1.ipcMain.handle('detach-card-scroll', async (_event, payload) => {
        const { cardId, scrollCardId } = payload || {};
        if (!cardId || typeof cardId !== 'string') {
            throw new Error('cardId is required to detach scroll.');
        }
        if (!scrollCardId || typeof scrollCardId !== 'string') {
            throw new Error('scrollCardId is required to detach scroll.');
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
                if (parsed && (parsed.type === 'card' || parsed.mediaKind || parsed.cardId)) {
                    cardRecord = parsed;
                    break;
                }
            }
            catch { /* ignore */ }
        }
        if (!cardRecord) {
            throw new Error('Card record not found.');
        }
        const existingScrolls = Array.isArray(cardRecord.scrolls) ? cardRecord.scrolls : [];
        const filteredScrolls = existingScrolls.filter((s) => s.cardId !== scrollCardId);
        if (filteredScrolls.length === existingScrolls.length) {
            throw new Error('Scroll not found on this card.');
        }
        const updatedCardRecord = {
            ...cardRecord,
            updatedAt: new Date().toISOString(),
            scrolls: filteredScrolls,
        };
        await (0, p2p_1.appendToCore)(cardId, JSON.stringify(updatedCardRecord));
        console.log('[Scroll] Detached scroll', scrollCardId, 'from card', cardId);
        return { success: true };
    });
    // Get list of text/markdown cards for scroll picker
    electron_1.ipcMain.handle('get-text-cards-for-scroll', async () => {
        try {
            const records = await (0, p2p_1.readCore)(CARD_LIBRARY_CORE_NAME);
            const textCards = [];
            const seenCardIds = new Set();
            for (const raw of records) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const data = JSON.parse(raw);
                    if (!data || data.type !== 'card-index')
                        continue;
                    const cardId = data.cardId || data.coreName;
                    if (!cardId || seenCardIds.has(cardId))
                        continue;
                    seenCardIds.add(cardId);
                    // Check index entry first for mediaType
                    let mediaType = data.mediaType || data.mediaKind || '';
                    let name = data.name || data.title || cardId;
                    // If no mediaType in index, read the actual card core
                    if (!mediaType) {
                        try {
                            const cardRecords = await (0, p2p_1.readCore)(cardId);
                            if (Array.isArray(cardRecords) && cardRecords.length > 0) {
                                // Find the card record (usually last one with type='card')
                                for (let i = cardRecords.length - 1; i >= 0; i--) {
                                    const cardRaw = cardRecords[i];
                                    if (!cardRaw || typeof cardRaw !== 'string')
                                        continue;
                                    try {
                                        const cardData = JSON.parse(cardRaw);
                                        if (cardData && (cardData.type === 'card' || cardData.mediaType || cardData.mediaKind)) {
                                            mediaType = cardData.mediaType || cardData.mediaKind || '';
                                            name = cardData.name || cardData.title || name;
                                            break;
                                        }
                                    }
                                    catch { /* ignore */ }
                                }
                            }
                        }
                        catch { /* card core might not exist */ }
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
                }
                catch { /* ignore */ }
            }
            // Sort by createdAt descending
            textCards.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            console.log('[Scroll] Found', textCards.length, 'text/markdown cards');
            return textCards;
        }
        catch (error) {
            console.error('[Scroll] Failed to get text cards:', error);
            return [];
        }
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
    // ============================================================================
    // CARD SETS IPC HANDLERS
    // ============================================================================
    const CARD_SETS_CORE_NAME = 'card-sets';
    // Get all card sets
    electron_1.ipcMain.handle('card-sets:list', async () => {
        try {
            await (0, p2p_1.createCore)(CARD_SETS_CORE_NAME);
            const records = await (0, p2p_1.readCore)(CARD_SETS_CORE_NAME);
            const sets = [];
            for (const raw of records) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.type === 'card-set' || parsed.type === 'merged-set') {
                        sets.push(parsed);
                    }
                }
                catch { /* ignore parse errors */ }
            }
            // Sort by createdAt descending (newest first)
            sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return sets;
        }
        catch (err) {
            console.error('[CardSets] Error listing sets:', err.message);
            return [];
        }
    });
    // Get a specific card set by ID
    electron_1.ipcMain.handle('card-sets:get', async (_event, setId) => {
        try {
            const records = await (0, p2p_1.readCore)(CARD_SETS_CORE_NAME);
            for (const raw of records) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.setId === setId || parsed.mergedSetId === setId) {
                        return parsed;
                    }
                }
                catch { /* ignore */ }
            }
            return null;
        }
        catch (err) {
            console.error('[CardSets] Error getting set:', err.message);
            return null;
        }
    });
    // Create a new card set (called by pipeline)
    electron_1.ipcMain.handle('card-sets:create', async (_event, cardSet) => {
        try {
            await (0, p2p_1.createCore)(CARD_SETS_CORE_NAME);
            await (0, p2p_1.appendToCore)(CARD_SETS_CORE_NAME, JSON.stringify(cardSet));
            console.log('[CardSets] Created card set:', cardSet.setId, cardSet.name);
            return { success: true, setId: cardSet.setId };
        }
        catch (err) {
            console.error('[CardSets] Error creating set:', err.message);
            throw err;
        }
    });
    // Create a merged set (references other sets)
    electron_1.ipcMain.handle('card-sets:create-merged', async (_event, mergedSet) => {
        try {
            await (0, p2p_1.createCore)(CARD_SETS_CORE_NAME);
            const record = {
                ...mergedSet,
                type: 'merged-set',
                mergedSetId: mergedSet.mergedSetId || `merged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await (0, p2p_1.appendToCore)(CARD_SETS_CORE_NAME, JSON.stringify(record));
            console.log('[CardSets] Created merged set:', record.mergedSetId, record.name);
            return { success: true, mergedSetId: record.mergedSetId };
        }
        catch (err) {
            console.error('[CardSets] Error creating merged set:', err.message);
            throw err;
        }
    });
    // Get cards for a set (resolves merged sets recursively)
    electron_1.ipcMain.handle('card-sets:get-card-ids', async (_event, setId) => {
        try {
            const records = await (0, p2p_1.readCore)(CARD_SETS_CORE_NAME);
            const cardIds = new Set();
            // Helper to resolve a set
            const resolveSet = (id, visited) => {
                if (visited.has(id))
                    return; // Prevent cycles
                visited.add(id);
                for (const raw of records) {
                    if (!raw || typeof raw !== 'string')
                        continue;
                    try {
                        const parsed = JSON.parse(raw);
                        // Direct card set
                        if (parsed.type === 'card-set' && parsed.setId === id) {
                            parsed.cardIds?.forEach((cid) => cardIds.add(cid));
                        }
                        // Merged set - resolve references
                        if (parsed.type === 'merged-set' && parsed.mergedSetId === id) {
                            parsed.sourceSetIds?.forEach((sid) => resolveSet(sid, visited));
                            parsed.sourceMergedSetIds?.forEach((mid) => resolveSet(mid, visited));
                        }
                    }
                    catch { /* ignore */ }
                }
            };
            resolveSet(setId, new Set());
            return Array.from(cardIds);
        }
        catch (err) {
            console.error('[CardSets] Error resolving set card IDs:', err.message);
            return [];
        }
    });
    // ============================================================================
    // PERSISTENCE LAYER IPC HANDLERS
    // ============================================================================
    // Search cards with full-text and filters
    electron_1.ipcMain.handle('persistence:search-cards', async (_event, query) => {
        const adapter = (0, persistence_1.getPersistence)();
        if (!adapter || !adapter.isReady()) {
            console.warn('[Persistence] Not ready for search');
            return [];
        }
        try {
            return await adapter.searchCards(query);
        }
        catch (err) {
            console.error('[Persistence] Search error:', err.message);
            return [];
        }
    });
    // Get RAG context for agents
    electron_1.ipcMain.handle('persistence:get-rag-context', async (_event, query) => {
        const adapter = (0, persistence_1.getPersistence)();
        if (!adapter || !adapter.isReady()) {
            return [];
        }
        try {
            return await adapter.getRagContext(query);
        }
        catch (err) {
            console.error('[Persistence] RAG error:', err.message);
            return [];
        }
    });
    // Get graph neighbors
    electron_1.ipcMain.handle('persistence:get-neighbors', async (_event, query) => {
        const adapter = (0, persistence_1.getPersistence)();
        if (!adapter || !adapter.isReady()) {
            return [];
        }
        try {
            return await adapter.getGraphNeighbors(query);
        }
        catch (err) {
            console.error('[Persistence] Graph error:', err.message);
            return [];
        }
    });
    // Get persistence stats
    electron_1.ipcMain.handle('persistence:get-stats', async () => {
        const adapter = (0, persistence_1.getPersistence)();
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
        }
        catch (err) {
            console.error('[Persistence] Stats error:', err.message);
            return null;
        }
    });
    // Profile & System Stats IPC
    electron_1.ipcMain.handle('get-profile', async () => {
        const profile = store.get('userProfile', { displayName: 'Anon Node', bio: '' });
        console.log('[Profile IPC] get-profile returning:', JSON.stringify(profile));
        return profile;
    });
    electron_1.ipcMain.handle('save-profile', async (_event, profile) => {
        console.log('[Profile IPC] save-profile called with:', JSON.stringify(profile));
        store.set('userProfile', profile);
        const saved = store.get('userProfile');
        console.log('[Profile IPC] After save, stored value:', JSON.stringify(saved));
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
                tags: ['operator-profile'],
            };
            await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(libraryEntry));
            // Emit to persistence layer
            (0, persistence_1.emitCardEvent)('CARD_CREATED', {
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
    // Repair/Migration: Fix Hell Week cards to have Set Card as parent
    electron_1.ipcMain.handle('repair-hell-week-parents', async () => {
        console.log('[Repair] Starting Hell Week parent repair...');
        const repaired = [];
        const errors = [];
        try {
            // Read all cards from card-library
            const libraryRecords = await (0, p2p_1.readCore)(CARD_LIBRARY_CORE_NAME);
            // Build a map of setId -> setCardId from cards that have both
            const setIdToSetCardId = new Map();
            const cardsBySetId = new Map();
            // First pass: find Set Cards and build mapping
            for (const raw of libraryRecords) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.type !== 'card-index')
                        continue;
                    // If this is a Set Card, map its ID
                    if (parsed.cardType === 'set') {
                        // Set Cards use their own cardId as the setId
                        setIdToSetCardId.set(parsed.cardId, parsed.cardId);
                    }
                    // Collect cards by setId for legacy mapping
                    if (parsed.setId) {
                        if (!cardsBySetId.has(parsed.setId)) {
                            cardsBySetId.set(parsed.setId, []);
                        }
                        cardsBySetId.get(parsed.setId).push(parsed);
                    }
                }
                catch { /* ignore */ }
            }
            // Second pass: fix cards that have setId but no parentCardId
            for (const raw of libraryRecords) {
                if (!raw || typeof raw !== 'string')
                    continue;
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.type !== 'card-index')
                        continue;
                    if (parsed.cardType === 'set')
                        continue; // Skip Set Cards
                    // Check if card needs repair
                    const needsParent = parsed.setId && !parsed.parentCardId;
                    const needsMemberOfSets = parsed.setId && (!parsed.memberOfSets || parsed.memberOfSets.length === 0);
                    if (needsParent || needsMemberOfSets) {
                        const setCardId = parsed.setId; // For Hell Week, setId IS the Set Card ID
                        // Create repaired entry
                        const repairedEntry = {
                            ...parsed,
                            cardType: parsed.cardType || 'standard',
                            parentCardId: setCardId,
                            memberOfSets: parsed.memberOfSets || [{
                                    setCardId: setCardId,
                                    joinedAt: parsed.createdAt || new Date().toISOString(),
                                    addedBy: 'repair',
                                }],
                            updatedAt: new Date().toISOString(),
                        };
                        // Append repaired entry
                        await (0, p2p_1.appendToCore)(CARD_LIBRARY_CORE_NAME, JSON.stringify(repairedEntry));
                        repaired.push(parsed.cardId);
                        console.log('[Repair] Fixed card:', parsed.cardId, '-> parent:', setCardId);
                    }
                }
                catch (err) {
                    errors.push(`${raw.substring(0, 50)}: ${err.message}`);
                }
            }
            console.log('[Repair] Completed. Repaired:', repaired.length, 'Errors:', errors.length);
            return { repaired: repaired.length, errors, repairedIds: repaired };
        }
        catch (err) {
            console.error('[Repair] Failed:', err);
            return { repaired: 0, errors: [err.message], repairedIds: [] };
        }
    });
}
electron_1.app.on('ready', async () => {
    // Initialize P2P and optionally auto-start local llama.cpp server, then open the window
    (0, p2p_1.initP2P)();
    // Initialize persistence layer (SQLite projection engine)
    (0, persistence_1.initPersistence)().catch(err => {
        console.error('[Persistence] Init error:', err);
    });
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
