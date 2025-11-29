export interface Settings {
    geminiKey: string;
    openaiKey: string;
    firebaseConfig: string;
    revidKey: string;
    wormhole?: WormholeSettings;
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

export interface RevidMediaItem {
    id: string;
    mid: string;
    uid?: string;
    prompt?: string;
    mediaUrl: string;
    imagePreview?: string;
    fileType?: string;
    type: 'video' | 'image' | 'audio' | 'unknown';
    orientation?: string;
    raw?: any;
}

export type WormholeProviderId = 'gemini' | 'openai' | 'llama-local' | 'none';

export interface WormholeStepConfig {
    provider: WormholeProviderId;
    model?: string;
}

export type WormholeStepStatusCode = 'pending' | 'in_progress' | 'complete' | 'failed' | 'partial';

export interface WormholeStepStatus {
    status: WormholeStepStatusCode;
    provider?: WormholeProviderId;
    model?: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
}

export type WormholeMediaType = 'text' | 'markdown' | 'pdf' | 'audio' | 'video';

export interface WormholeSettings {
    transcription?: WormholeStepConfig;
    summarization?: WormholeStepConfig;
    keyTerms?: WormholeStepConfig;
    wikiUpdate?: WormholeStepConfig;
}

export interface WormholeIngestParams {
    path?: string;
    bytesBase64?: string;
    mediaType?: WormholeMediaType;
    ownerDid?: string;
    tags?: string[];
    sourceLabel?: string;
    fileName?: string;
    originalUrl?: string;
}

export interface WormholeIngestResult {
    contentId: string;
    cardId: string;
    hypercoreKey?: string;
    mediaType: WormholeMediaType;
    status: WormholeStepStatusCode;
}

export interface WormholeRunStepParams {
    cardId: string;
    overrideProvider?: WormholeProviderId;
    overrideModel?: string;
}

export interface WormholeRunStepResult {
    cardId: string;
    step: 'ingest' | 'transcription' | 'summarization' | 'keyTerms' | 'wikiUpdate';
    status: WormholeStepStatus;
}

export interface WormholeStatusQuery {
    cardId?: string;
    contentId?: string;
}

export interface WormholeStatus {
    cardId: string;
    contentId: string;
    processing: {
        ingest: WormholeStepStatus;
        transcription?: WormholeStepStatus;
        summarization?: WormholeStepStatus;
        keyTerms?: WormholeStepStatus;
        wikiUpdate?: WormholeStepStatus;
    };
}

export interface WormholeSummary {
    id: string;
    kind: 'short' | 'medium' | 'outline';
    text: string;
    provider: string;
    model?: string;
    createdAt: string;
    version?: string;
}

export interface WormholeKeyTerm {
    term: string;
    type?: string;
    confidence?: number;
}

export interface WormholeDerivedArtifacts {
    cardId: string;
    contentId: string;
    transcripts?: Array<{
        id: string;
        text: string;
        createdAt: string;
        provider: string;
        model?: string;
    }>;
    summaries?: WormholeSummary[];
    keyTerms?: WormholeKeyTerm[];
    wikiEntries?: Array<{
        term: string;
        wikiId: string;
        url?: string;
    }>;
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
    revidSearchMedia?: (params: {
        search?: string;
        mediaType?: string;
        topK?: number;
    }) => Promise<{ results: RevidMediaItem[]; count: number }>;
    revidDownloadMedia?: (params: {
        mediaUrl: string;
        id: string;
        type?: string;
        fileType?: string;
    }) => Promise<{
        localPath: string;
        fileName: string;
        mimeType: string;
        size: number;
    }>;
    wormholeIngestContent?: (params: WormholeIngestParams) => Promise<WormholeIngestResult>;
    wormholeRunTranscription?: (params: WormholeRunStepParams) => Promise<WormholeRunStepResult>;
    wormholeRunSummarization?: (params: WormholeRunStepParams) => Promise<WormholeRunStepResult>;
    wormholeRunKeyTerms?: (params: WormholeRunStepParams) => Promise<WormholeRunStepResult>;
    wormholeRunWikiUpdate?: (params: WormholeRunStepParams) => Promise<WormholeRunStepResult>;
    wormholeGetStatus?: (params: WormholeStatusQuery) => Promise<WormholeStatus>;
    wormholeGetDerivedArtifacts?: (params: { cardId: string }) => Promise<WormholeDerivedArtifacts>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
