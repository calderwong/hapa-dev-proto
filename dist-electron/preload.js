"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('Preload script is running!');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    listGeminiModels: () => electron_1.ipcRenderer.invoke('list-gemini-models'),
    listOpenAIModels: () => electron_1.ipcRenderer.invoke('list-openai-models'),
    listLlamaModels: () => electron_1.ipcRenderer.invoke('list-llama-models'),
    chatWithGemini: (data) => electron_1.ipcRenderer.invoke('chat-with-gemini', data),
    chatWithOpenAI: (data) => electron_1.ipcRenderer.invoke('chat-with-openai', data),
    chatWithLlama: (data) => electron_1.ipcRenderer.invoke('chat-with-llama', data),
    getLlamaSettings: () => electron_1.ipcRenderer.invoke('get-llama-settings'),
    saveLlamaSettings: (settings) => electron_1.ipcRenderer.invoke('save-llama-settings', settings),
    getLlamaStatus: () => electron_1.ipcRenderer.invoke('get-llama-status'),
    startLlamaServer: () => electron_1.ipcRenderer.invoke('start-llama-server'),
    stopLlamaServer: () => electron_1.ipcRenderer.invoke('stop-llama-server'),
    listLlamaLocalModels: () => electron_1.ipcRenderer.invoke('list-llama-local-models'),
    hfSearchGGUFModels: (params) => electron_1.ipcRenderer.invoke('hf-search-gguf-models', params),
    deleteLlamaModel: (params) => electron_1.ipcRenderer.invoke('delete-llama-model', params),
    downloadLlamaModel: (params) => electron_1.ipcRenderer.invoke('download-llama-model', params),
    geminiListRequests: () => electron_1.ipcRenderer.invoke('gemini-list-requests'),
    geminiSaveRequest: (entry) => electron_1.ipcRenderer.invoke('gemini-save-request', entry),
    getAdminSettings: () => electron_1.ipcRenderer.invoke('get-admin-settings'),
    saveAdminSettings: (settings) => electron_1.ipcRenderer.invoke('save-admin-settings', settings),
    onChatStream: (listener) => {
        electron_1.ipcRenderer.on('chat-stream', (_event, payload) => listener(payload));
    },
    openaiStartAudioSession: () => electron_1.ipcRenderer.invoke('openai-audio-start-session'),
    openaiAppendAudioChunk: (params) => electron_1.ipcRenderer.invoke('openai-audio-append-chunk', params),
    openaiStopAudioSession: (params) => electron_1.ipcRenderer.invoke('openai-audio-stop-session', params),
    onAudioTranscriptStream: (listener) => {
        electron_1.ipcRenderer.on('audio-transcript-stream', (_event, payload) => listener(payload));
    },
    revidEstimateCredits: (params) => electron_1.ipcRenderer.invoke('revid-estimate-credits', params),
    revidRender: (params) => electron_1.ipcRenderer.invoke('revid-render', params),
    revidGetStatus: (params) => electron_1.ipcRenderer.invoke('revid-get-status', params),
    revidListProjects: (params) => electron_1.ipcRenderer.invoke('revid-list-projects', params),
    p2pCreateCore: (name) => electron_1.ipcRenderer.invoke('p2p-create-core', name),
    p2pAppend: (data) => electron_1.ipcRenderer.invoke('p2p-append', data),
    p2pRead: (name) => electron_1.ipcRenderer.invoke('p2p-read', name),
});
console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? window.electronAPI : 'window not defined');
