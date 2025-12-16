export interface Settings {
    geminiKey: string;
    openaiKey: string;
    aimlapiKey: string;
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

export interface LocalVisionSettings {
    pythonPath: string;
    modelsDir: string;
    activeModel: string;
    port: number;
    autoStart: boolean;
}

export interface LocalVisionStatus {
    running: boolean;
    pid?: number;
    port?: number;
    model?: string;
    lastError?: string;
}

export interface VisionModel {
    repo_id: string;
    size: string;
    cached: boolean;
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
    }) => Promise<{ content: string; model: string; provider: string }>;
    chatWithOpenAI: (data: {
        message: string;
        history: any[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
    }) => Promise<{ content: string; model: string; provider: string }>;
    chatWithLlama: (data: {
        message: string;
        history: any[];
        model?: string;
        attachments?: { mimeType: string; data: string }[];
    }) => Promise<{ content: string; model: string; provider: string }>;
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
    readFileAsBase64?: (filePath: string) => Promise<{ base64: string; mimeType?: string } | string>;
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
    // Local Vision methods
    getLocalVisionSettings: () => Promise<LocalVisionSettings>;
    saveLocalVisionSettings: (settings: LocalVisionSettings) => Promise<boolean>;
    getLocalVisionStatus: () => Promise<LocalVisionStatus>;
    startLocalVision: () => Promise<LocalVisionStatus>;
    stopLocalVision: () => Promise<LocalVisionStatus>;
    listVisionModels: () => Promise<VisionModel[]>;
    downloadVisionModel: (params: { repo_id: string }) => Promise<any>;
    generateLocalImage: (params: any) => Promise<{ images: string[] }>;
    // End Local Vision
    hfSearchGGUFModels: (params: { query: string }) => Promise<HfGGUFSearchResult[]>;
    geminiListRequests: () => Promise<any[]>;
    geminiSaveRequest: (entry: any) => Promise<any>;
    getAdminSettings: () => Promise<AdminSettings>;
    saveAdminSettings: (settings: AdminSettings) => Promise<boolean>;
    p2pCreateCore: (name: string) => Promise<{ key: string; discoveryKey: string; length: number }>;
    p2pAppend: (data: { name: string; data: string }) => Promise<number>;
    p2pRead: (name: string, options?: any) => Promise<string[]>;
    p2pGetLength: (name: string) => Promise<number>;
    readFileAsBase64?: (filePath: string) => Promise<{ base64: string; mimeType?: string } | string>;
    onChatStream?: (
        listener: (payload: { provider: 'gemini' | 'openai' | 'llama'; delta: string; done?: boolean; model?: string }) => void,
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
    wormholeGetWikiIndex?: () => Promise<{ entryList: any[]; metaMap: any }>;
    toggleDevTools?: () => Promise<void>;
    getProfile?: () => Promise<UserProfile>;
    saveProfile?: (profile: UserProfile) => Promise<boolean>;
    saveProfileImage?: (params: { bytesBase64: string; mimeType: string }) => Promise<{ cardId: string; imageUrl: string }>;
    getSystemStats?: () => Promise<SystemStats>;
    processThorUrl?: (url: string, handCards: any[]) => Promise<{ success: boolean; cards?: any[]; error?: string }>;
    onThorUpdate?: (callback: (data: { type: string; payload: any }) => void) => () => void;
    // Media download/export
    saveMedia?: (params: { mediaPath: string; suggestedFilename?: string; mediaType?: 'image' | 'video' }) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    exportMedia?: (params: { mediaPath: string; fileName: string; mediaType?: 'image' | 'video' }) => Promise<{ success: boolean; path?: string; error?: string }>;
    exportAllMedia?: () => Promise<{ success: boolean; totalCards?: number; exportDir?: string; error?: string }>;
    savePrototype?: (data: { title: string; content: string }) => Promise<{ success: boolean; cardId?: string; filePath?: string; error?: string }>;
}

export interface UserProfile {
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    profileCardId?: string;
}

export interface SystemStats {
    storageUsageBytes: number;
    cardCount: number;
    wikiEntryCount: number;
    wormholeRunCount: number;
    p2pPeers: number;
    p2pPublicKey?: string;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }

    namespace JSX {
        interface IntrinsicElements {
            'rux-button': any;
            'rux-input': any;
            'rux-textarea': any;
            'rux-select': any;
            'rux-option': any;
            'rux-status': any;
            'rux-notification': any;
            'rux-tabs': any;
            'rux-tab': any;
            'rux-icon': any;
            'rux-global-status-bar': any;
            'rux-card': any;
            'rux-modal': any;
            'rux-checkbox': any;
            'rux-switch': any;
            'rux-slider': any;
            'rux-progress': any;
        }
    }
}
