"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('Preload script is running!');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    listGeminiModels: () => electron_1.ipcRenderer.invoke('list-gemini-models'),
    listOpenAIModels: () => electron_1.ipcRenderer.invoke('list-openai-models'),
    listAimlApiModels: () => electron_1.ipcRenderer.invoke('list-aimlapi-models'),
    listLlamaModels: () => electron_1.ipcRenderer.invoke('list-llama-models'),
    chatWithAimlApi: (data) => electron_1.ipcRenderer.invoke('chat-with-aimlapi', data),
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
    // Local Vision
    getLocalVisionSettings: () => electron_1.ipcRenderer.invoke('get-local-vision-settings'),
    saveLocalVisionSettings: (settings) => electron_1.ipcRenderer.invoke('save-local-vision-settings', settings),
    getLocalVisionStatus: () => electron_1.ipcRenderer.invoke('get-local-vision-status'),
    startLocalVision: () => electron_1.ipcRenderer.invoke('start-local-vision'),
    stopLocalVision: () => electron_1.ipcRenderer.invoke('stop-local-vision'),
    listVisionModels: () => electron_1.ipcRenderer.invoke('list-vision-models'),
    downloadVisionModel: (params) => electron_1.ipcRenderer.invoke('download-vision-model', params),
    generateLocalImage: (params) => electron_1.ipcRenderer.invoke('generate-local-image', params),
    // End Local Vision
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
    revidSearchMedia: (params) => electron_1.ipcRenderer.invoke('revid-search-media', params),
    revidDownloadMedia: (params) => electron_1.ipcRenderer.invoke('revid-download-media', params),
    wormholeIngestContent: (params) => electron_1.ipcRenderer.invoke('wormhole-ingest-content', params),
    wormholeRunTranscription: (params) => electron_1.ipcRenderer.invoke('wormhole-run-transcription', params),
    wormholeRunSummarization: (params) => electron_1.ipcRenderer.invoke('wormhole-run-summarization', params),
    wormholeRunKeyTerms: (params) => electron_1.ipcRenderer.invoke('wormhole-run-keyterms', params),
    wormholeRunWikiUpdate: (params) => electron_1.ipcRenderer.invoke('wormhole-run-wiki-update', params),
    wormholeGetStatus: (params) => electron_1.ipcRenderer.invoke('wormhole-get-status', params),
    wormholeGetDerivedArtifacts: (params) => electron_1.ipcRenderer.invoke('wormhole-get-derived-artifacts', params),
    wormholeGetCardText: (params) => electron_1.ipcRenderer.invoke('wormhole-get-card-text', params),
    wormholeGetWikiIndex: () => electron_1.ipcRenderer.invoke('wormhole-get-wiki-index'),
    // Scroll attachment handlers
    attachCardScroll: (params) => electron_1.ipcRenderer.invoke('attach-card-scroll', params),
    detachCardScroll: (params) => electron_1.ipcRenderer.invoke('detach-card-scroll', params),
    getTextCardsForScroll: () => electron_1.ipcRenderer.invoke('get-text-cards-for-scroll'),
    p2pCreateCore: (name) => electron_1.ipcRenderer.invoke('p2p-create-core', name),
    p2pAppend: (data) => electron_1.ipcRenderer.invoke('p2p-append', data),
    p2pRead: (name, options) => electron_1.ipcRenderer.invoke('p2p-read', name, options),
    p2pGetLength: (name) => electron_1.ipcRenderer.invoke('p2p-get-length', name),
    toggleDevTools: () => electron_1.ipcRenderer.invoke('toggle-dev-tools'),
    getProfile: () => electron_1.ipcRenderer.invoke('get-profile'),
    saveProfile: (profile) => electron_1.ipcRenderer.invoke('save-profile', profile),
    saveProfileImage: (params) => electron_1.ipcRenderer.invoke('save-profile-image', params),
    getSystemStats: () => electron_1.ipcRenderer.invoke('get-system-stats'),
    // Video generation with Veo models
    // Supports: text-to-video, image-to-video (start frame), interpolation (start+end frame)
    generateVideoWithGemini: (data) => electron_1.ipcRenderer.invoke('generate-video-with-gemini', data),
    onVideoGenerationProgress: (listener) => {
        electron_1.ipcRenderer.on('video-generation-progress', (_event, payload) => listener(payload));
    },
    // Video extraction utilities
    extractVideoFrame: (data) => electron_1.ipcRenderer.invoke('extract-video-frame', data),
    extractVideoAudio: (data) => electron_1.ipcRenderer.invoke('extract-video-audio', data),
    // Image generation for cards (supports series continuation)
    generateImageForCard: (data) => electron_1.ipcRenderer.invoke('generate-image-for-card', data),
    // Create looping video from an image
    createLoopVideoForImage: (data) => electron_1.ipcRenderer.invoke('create-loop-video-for-image', data),
    // Listen for loop video generation progress
    onLoopVideoProgress: (listener) => {
        electron_1.ipcRenderer.on('loop-video-progress', (_event, payload) => listener(payload));
    },
    // Hell Week Pipeline
    pipelineStart: (filePath) => electron_1.ipcRenderer.invoke('pipeline:start', filePath),
    pipelineStartWithContent: (fileName, content) => electron_1.ipcRenderer.invoke('pipeline:start-with-content', { fileName, content }),
    pipelineAdvance: () => electron_1.ipcRenderer.invoke('pipeline:advance'),
    onPipelineUpdate: (listener) => {
        electron_1.ipcRenderer.on('pipeline:update', (_event, state) => listener(state));
    },
    // Pipeline Settings
    getPipelineSettings: () => electron_1.ipcRenderer.invoke('pipeline:get-settings'),
    savePipelineSettings: (settings) => electron_1.ipcRenderer.invoke('pipeline:save-settings', settings),
    setThorModel: (model) => electron_1.ipcRenderer.invoke('pipeline:set-thor-model', model),
    // Skip/Retry for failed images
    pipelineSkipMedia: () => electron_1.ipcRenderer.invoke('pipeline:skip-media'),
    pipelineSkipFailed: () => electron_1.ipcRenderer.invoke('pipeline:skip-failed'),
    pipelineRetryFailed: () => electron_1.ipcRenderer.invoke('pipeline:retry-failed'),
    pipelineGetFailedCount: () => electron_1.ipcRenderer.invoke('pipeline:get-failed-count'),
    // Recovery for orphaned cards
    pipelineRecoverCards: () => electron_1.ipcRenderer.invoke('pipeline:recover-cards'),
    // Repair Hell Week card parents
    repairHellWeekParents: () => electron_1.ipcRenderer.invoke('repair-hell-week-parents'),
    // Card Sets
    cardSetsCreate: (cardSet) => electron_1.ipcRenderer.invoke('card-sets:create', cardSet),
    cardSetsList: () => electron_1.ipcRenderer.invoke('card-sets:list'),
    cardSetsGet: (setId) => electron_1.ipcRenderer.invoke('card-sets:get', setId),
    cardSetsCreateMerged: (mergedSet) => electron_1.ipcRenderer.invoke('card-sets:create-merged', mergedSet),
    cardSetsGetCardIds: (setId) => electron_1.ipcRenderer.invoke('card-sets:get-card-ids', setId),
    // Vertex AI
    getVertexAISettings: () => electron_1.ipcRenderer.invoke('get-vertex-ai-settings'),
    saveVertexAISettings: (settings) => electron_1.ipcRenderer.invoke('save-vertex-ai-settings', settings),
    testVertexAIConnection: () => electron_1.ipcRenderer.invoke('test-vertex-ai-connection'),
    getVertexAIModels: () => electron_1.ipcRenderer.invoke('get-vertex-ai-models'),
    // Persistence Layer (SQLite Projection Engine)
    persistenceSearchCards: (query) => electron_1.ipcRenderer.invoke('persistence:search-cards', query),
    persistenceGetRagContext: (query) => electron_1.ipcRenderer.invoke('persistence:get-rag-context', query),
    persistenceGetNeighbors: (query) => electron_1.ipcRenderer.invoke('persistence:get-neighbors', query),
    persistenceGetStats: () => electron_1.ipcRenderer.invoke('persistence:get-stats'),
    // Thor's Hamma
    processThorUrl: (url, handCards) => electron_1.ipcRenderer.invoke('thor:process-url', { url, handCards }),
    onThorUpdate: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('thor-update', listener);
        return () => electron_1.ipcRenderer.removeListener('thor-update', listener);
    },
    // Media download/export
    saveMedia: (params) => electron_1.ipcRenderer.invoke('save-media', params),
    exportMedia: (params) => electron_1.ipcRenderer.invoke('export-media', params),
    exportAllMedia: () => electron_1.ipcRenderer.invoke('export-all-media'),
    savePrototype: (data) => electron_1.ipcRenderer.invoke('save-prototype', data),
});
console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? window.electronAPI : 'window not defined');
