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
const broadcastChatStream = (provider, delta, done) => {
    const [win] = electron_1.BrowserWindow.getAllWindows();
    if (!win)
        return;
    if (!delta && !done)
        return;
    win.webContents.send('chat-stream', { provider, delta, done: !!done });
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
const getAppIconPath = () => {
    const base = electron_is_dev_1.default ? '../public' : '../dist';
    return path.join(__dirname, base, 'hapa-cat.png');
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
        },
    });
    if (electron_is_dev_1.default) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    // Settings IPC handlers
    electron_1.ipcMain.handle('get-settings', () => {
        return {
            geminiKey: store.get('geminiKey', ''),
            openaiKey: store.get('openaiKey', ''),
            firebaseConfig: store.get('firebaseConfig', ''),
            revidKey: store.get('revidKey', ''),
        };
    });
    electron_1.ipcMain.handle('save-settings', (_event, settings) => {
        store.set('geminiKey', settings.geminiKey);
        store.set('openaiKey', settings.openaiKey);
        store.set('firebaseConfig', settings.firebaseConfig);
        store.set('revidKey', settings.revidKey);
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
    // List available Gemini models
    electron_1.ipcMain.handle('list-gemini-models', async () => {
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            // Fallback list when no API key is configured
            return [
                { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
                { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
                { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
            ];
        }
        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
                return data.models
                    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m) => ({
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName || m.name.replace('models/', ''),
                    description: m.description || '',
                }));
            }
        }
        catch (error) {
            console.error('Error fetching models from API:', error);
        }
        // Fallback to common model names on error
        return [
            { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
            { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
            { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
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
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            throw new Error('Gemini API Key not found. Please configure it in Settings.');
        }
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName || 'gemini-pro' });
            const toContentHistory = (items) => items.map((item) => ({
                role: item.role === 'model' ? 'model' : 'user',
                parts: [{ text: item.content }],
            }));
            const sendMessageWithRetry = async (currentHistory) => {
                try {
                    const resolvedModel = (modelName || 'gemini-pro').toString();
                    const lowerModel = resolvedModel.toLowerCase();
                    const isImageModel = lowerModel.includes('image') || lowerModel.includes('nano-banana');
                    // For image-generation models (for example Nano Banana / gemini-*-image),
                    // use the generateContent image endpoint instead of chat streaming so we
                    // can reliably access inlineData image bytes.
                    if (isImageModel) {
                        const textContext = currentHistory
                            .map((item) => `${item.role === 'model' ? 'Assistant' : 'User'}: ${item.content}`)
                            .join('\n');
                        const prompt = textContext && textContext.trim().length > 0
                            ? `${textContext}\n\nUser: ${message}`
                            : message;
                        const contents = [
                            {
                                role: 'user',
                                parts: [{ text: prompt }],
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
                        return combined || '';
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
                    for await (const chunk of streamResult.stream) {
                        try {
                            const chunkText = chunk.text?.() ?? '';
                            if (typeof chunkText === 'string' && chunkText.trim().length > 0) {
                                accumulatedText += chunkText;
                                broadcastChatStream('gemini', chunkText, false);
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
                        broadcastChatStream('gemini', '', true);
                        return accumulatedText || response.text?.() || '';
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
                    broadcastChatStream('gemini', '', true);
                    return combined || response.text?.() || '';
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
                        }
                        else {
                            // Classic behavior: each event is just the new chunk.
                            fullText += rawText;
                        }
                        if (deltaText.length === 0) {
                            continue;
                        }
                        broadcastChatStream('openai', deltaText, false);
                    }
                    catch (error) {
                        console.error('Failed to parse OpenAI stream chunk:', error, dataStr);
                    }
                }
            }
        }
        return fullText;
    });
    // Chat with a local llama.cpp server exposing an OpenAI-compatible /v1/chat/completions API
    electron_1.ipcMain.handle('chat-with-llama', async (_event, { message, history, model: modelName, }) => {
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
                        }
                        else {
                            // Classic behavior: each event is just the new chunk.
                            fullText += rawText;
                        }
                        if (deltaText.length === 0) {
                            continue;
                        }
                        broadcastChatStream('llama', deltaText, false);
                    }
                    catch (error) {
                        console.error('Failed to parse Llama stream chunk:', error, dataStr);
                    }
                }
            }
        }
        return fullText;
    });
    // P2P IPC handlers
    electron_1.ipcMain.handle('p2p-create-core', async (_event, name) => {
        return (0, p2p_1.createCore)(name);
    });
    electron_1.ipcMain.handle('p2p-append', async (_event, { name, data }) => {
        return (0, p2p_1.appendToCore)(name, data);
    });
    electron_1.ipcMain.handle('p2p-read', async (_event, name) => {
        return (0, p2p_1.readCore)(name);
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
