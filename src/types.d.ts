export interface Settings {
    geminiKey: string;
    openaiKey: string;
    firebaseConfig: string;
    revidKey: string;
}

export type AudioMode = 'transcribe' | 'realtime';

export interface AdminSettings {
    audioMode: AudioMode;
}

export interface LlamaSettings {
    serverPath: string;
    modelsDir: string;
    defaultModel: string;
    port: number;
    autoStart: boolean;
    favorites?: string[];
}

export interface LlamaStatus {
    running: boolean;
    pid?: number;
    model?: string;
    port?: number;
    lastError?: string;
}

export interface LocalLlamaModel {
    name: string;
    path: string;
    sizeBytes?: number;
    mtime?: string;
}

export interface HfGGUFSearchResult {
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

export interface ElectronAPI {
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<boolean>;
    listGeminiModels: () => Promise<any[]>;
    listOpenAIModels: () => Promise<any[]>;
    listLlamaModels: () => Promise<any[]>;
    listLlamaLocalModels: () => Promise<LocalLlamaModel[]>;
    chatWithGemini: (data: {
        message: string;
        history: any[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
    }) => Promise<string>;
    chatWithOpenAI: (data: {
        message: string;
        history: any[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
    }) => Promise<string>;
    chatWithLlama: (data: {
        message: string;
        history: any[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
    }) => Promise<string>;
    getLlamaSettings: () => Promise<LlamaSettings>;
    saveLlamaSettings: (settings: LlamaSettings) => Promise<boolean>;
    getLlamaStatus: () => Promise<LlamaStatus>;
    startLlamaServer: () => Promise<LlamaStatus>;
    stopLlamaServer: () => Promise<LlamaStatus>;
    downloadLlamaModel: (params: { url: string; fileName?: string }) => Promise<{ path: string }>;
    deleteLlamaModel: (params: { path: string }) => Promise<boolean>;
    hfSearchGGUFModels: (params: { query: string }) => Promise<HfGGUFSearchResult[]>;
    geminiListRequests: () => Promise<any[]>;
    geminiSaveRequest: (entry: any) => Promise<any>;
    getAdminSettings: () => Promise<AdminSettings>;
    saveAdminSettings: (settings: AdminSettings) => Promise<boolean>;
    p2pCreateCore: (name: string) => Promise<{ key: string; discoveryKey: string; length: number }>;
    p2pAppend: (data: { name: string; data: string }) => Promise<number>;
    p2pRead: (name: string) => Promise<string[]>;
    onChatStream?: (
        listener: (payload: { provider: 'gemini' | 'openai' | 'llama'; delta: string; done?: boolean }) => void,
    ) => void;
    openaiStartAudioSession?: () => Promise<{ sessionId: string }>;
    openaiAppendAudioChunk?: (params: {
        sessionId: string;
        base64: string;
        mimeType: string;
    }) => Promise<{ sessionId: string; delta: string; fullText: string }>;
    openaiStopAudioSession?: (params: { sessionId: string }) => Promise<{ sessionId: string; fullText: string }>;
    onAudioTranscriptStream?: (
        listener: (payload: { sessionId: string; delta: string; fullText: string }) => void,
    ) => void;
    revidEstimateCredits?: (params: { creationParams: any }) => Promise<any>;
    revidRender?: (params: any) => Promise<any>;
    revidGetStatus?: (params: { pid: string }) => Promise<any>;
    revidListProjects?: (params: { limit?: number }) => Promise<any>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
