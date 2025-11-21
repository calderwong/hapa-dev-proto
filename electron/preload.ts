import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script is running!');

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
    listGeminiModels: () => ipcRenderer.invoke('list-gemini-models'),
    chatWithGemini: (data: { message: string; history: any[]; model?: string }) => ipcRenderer.invoke('chat-with-gemini', data),
    p2pCreateCore: (name: string) => ipcRenderer.invoke('p2p-create-core', name),
    p2pAppend: (data: { name: string; data: string }) => ipcRenderer.invoke('p2p-append', data),
    p2pRead: (name: string) => ipcRenderer.invoke('p2p-read', name),
});

console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? (window as any).electronAPI : 'window not defined');
