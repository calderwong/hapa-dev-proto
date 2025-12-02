import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script is running!');

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
    listGeminiModels: () => ipcRenderer.invoke('list-gemini-models'),
    listOpenAIModels: () => ipcRenderer.invoke('list-openai-models'),
    listLlamaModels: () => ipcRenderer.invoke('list-llama-models'),
    chatWithGemini: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) =>
        ipcRenderer.invoke('chat-with-gemini', data),
    chatWithOpenAI: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) =>
        ipcRenderer.invoke('chat-with-openai', data),
    chatWithLlama: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) =>
        ipcRenderer.invoke('chat-with-llama', data),
    getLlamaSettings: () => ipcRenderer.invoke('get-llama-settings'),
    saveLlamaSettings: (settings: any) => ipcRenderer.invoke('save-llama-settings', settings),
    getLlamaStatus: () => ipcRenderer.invoke('get-llama-status'),
    startLlamaServer: () => ipcRenderer.invoke('start-llama-server'),
    stopLlamaServer: () => ipcRenderer.invoke('stop-llama-server'),
    listLlamaLocalModels: () => ipcRenderer.invoke('list-llama-local-models'),
    hfSearchGGUFModels: (params: { query: string }) =>
        ipcRenderer.invoke('hf-search-gguf-models', params),
    deleteLlamaModel: (params: { path: string }) => ipcRenderer.invoke('delete-llama-model', params),
    downloadLlamaModel: (params: { url: string; fileName?: string }) =>
        ipcRenderer.invoke('download-llama-model', params),
    geminiListRequests: () => ipcRenderer.invoke('gemini-list-requests'),
    geminiSaveRequest: (entry: any) => ipcRenderer.invoke('gemini-save-request', entry),
    getAdminSettings: () => ipcRenderer.invoke('get-admin-settings'),
    saveAdminSettings: (settings: any) => ipcRenderer.invoke('save-admin-settings', settings),
    onChatStream: (listener: (payload: any) => void) => {
        ipcRenderer.on('chat-stream', (_event, payload) => listener(payload));
    },
    openaiStartAudioSession: () => ipcRenderer.invoke('openai-audio-start-session'),
    openaiAppendAudioChunk: (params: { sessionId: string; base64: string; mimeType: string }) =>
        ipcRenderer.invoke('openai-audio-append-chunk', params),
    openaiStopAudioSession: (params: { sessionId: string }) =>
        ipcRenderer.invoke('openai-audio-stop-session', params),
    onAudioTranscriptStream: (listener: (payload: any) => void) => {
        ipcRenderer.on('audio-transcript-stream', (_event, payload) => listener(payload));
    },
    revidEstimateCredits: (params: { creationParams: any }) =>
        ipcRenderer.invoke('revid-estimate-credits', params),
    revidRender: (params: any) =>
        ipcRenderer.invoke('revid-render', params),
    revidGetStatus: (params: { pid: string }) =>
        ipcRenderer.invoke('revid-get-status', params),
    revidListProjects: (params: { limit?: number }) =>
        ipcRenderer.invoke('revid-list-projects', params),
    revidSearchMedia: (params: { search?: string; mediaType?: string; topK?: number }) =>
        ipcRenderer.invoke('revid-search-media', params),
    revidDownloadMedia: (params: { mediaUrl: string; id: string; type?: string; fileType?: string }) =>
        ipcRenderer.invoke('revid-download-media', params),
    wormholeIngestContent: (params: any) =>
        ipcRenderer.invoke('wormhole-ingest-content', params),
    wormholeRunTranscription: (params: any) =>
        ipcRenderer.invoke('wormhole-run-transcription', params),
    wormholeRunSummarization: (params: any) =>
        ipcRenderer.invoke('wormhole-run-summarization', params),
    wormholeRunKeyTerms: (params: any) =>
        ipcRenderer.invoke('wormhole-run-keyterms', params),
    wormholeRunWikiUpdate: (params: any) =>
        ipcRenderer.invoke('wormhole-run-wiki-update', params),
    wormholeGetStatus: (params: any) =>
        ipcRenderer.invoke('wormhole-get-status', params),
    wormholeGetDerivedArtifacts: (params: { cardId: string }) =>
        ipcRenderer.invoke('wormhole-get-derived-artifacts', params),
    wormholeGetCardText: (params: { cardId: string }) =>
        ipcRenderer.invoke('wormhole-get-card-text', params),
    wormholeGetWikiIndex: () => ipcRenderer.invoke('wormhole-get-wiki-index'),
    p2pCreateCore: (name: string) => ipcRenderer.invoke('p2p-create-core', name),
    p2pAppend: (data: { name: string; data: string }) => ipcRenderer.invoke('p2p-append', data),
    p2pRead: (name: string, options?: any) => ipcRenderer.invoke('p2p-read', name, options),
    p2pGetLength: (name: string) => ipcRenderer.invoke('p2p-get-length', name),
    toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
    getProfile: () => ipcRenderer.invoke('get-profile'),
    saveProfile: (profile: any) => ipcRenderer.invoke('save-profile', profile),
    saveProfileImage: (params: any) => ipcRenderer.invoke('save-profile-image', params),
    getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
    // Video generation with Veo models
    // Supports: text-to-video, image-to-video (start frame), interpolation (start+end frame)
    generateVideoWithGemini: (data: {
        prompt: string;
        model?: string;
        // Start frame
        imageBase64?: string;
        imageMimeType?: string;
        // End frame for interpolation
        lastFrameBase64?: string;
        lastFrameMimeType?: string;
        // Video parameters
        aspectRatio?: '16:9' | '9:16';
        resolution?: '720p' | '1080p';
        durationSeconds?: '4' | '5' | '6' | '8';
        negativePrompt?: string;
        personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
        loopMode?: boolean;
    }) => ipcRenderer.invoke('generate-video-with-gemini', data),
    onVideoGenerationProgress: (listener: (payload: any) => void) => {
        ipcRenderer.on('video-generation-progress', (_event, payload) => listener(payload));
    },
});

console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? (window as any).electronAPI : 'window not defined');
