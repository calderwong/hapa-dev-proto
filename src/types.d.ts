export interface Settings {
    geminiKey: string;
    firebaseConfig: string;
}

export interface ElectronAPI {
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<boolean>;
    chatWithGemini: (data: { message: string; history: any[] }) => Promise<string>;
    p2pCreateCore: (name: string) => Promise<{ key: string; discoveryKey: string; length: number }>;
    p2pAppend: (data: { name: string; data: string }) => Promise<number>;
    p2pRead: (name: string) => Promise<string[]>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
