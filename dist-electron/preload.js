"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('Preload script is running!');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    listGeminiModels: () => electron_1.ipcRenderer.invoke('list-gemini-models'),
    chatWithGemini: (data) => electron_1.ipcRenderer.invoke('chat-with-gemini', data),
    p2pCreateCore: (name) => electron_1.ipcRenderer.invoke('p2p-create-core', name),
    p2pAppend: (data) => electron_1.ipcRenderer.invoke('p2p-append', data),
    p2pRead: (name) => electron_1.ipcRenderer.invoke('p2p-read', name),
});
console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? window.electronAPI : 'window not defined');
