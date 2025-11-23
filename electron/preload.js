"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
console.log('Preload script is running!');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: function () { return electron_1.ipcRenderer.invoke('get-settings'); },
    saveSettings: function (settings) { return electron_1.ipcRenderer.invoke('save-settings', settings); },
    listGeminiModels: function () { return electron_1.ipcRenderer.invoke('list-gemini-models'); },
    chatWithGemini: function (data) { return electron_1.ipcRenderer.invoke('chat-with-gemini', data); },
    p2pCreateCore: function (name) { return electron_1.ipcRenderer.invoke('p2p-create-core', name); },
    p2pAppend: function (data) { return electron_1.ipcRenderer.invoke('p2p-append', data); },
    p2pRead: function (name) { return electron_1.ipcRenderer.invoke('p2p-read', name); },
});
console.log('Electron API exposed successfully!', typeof window !== 'undefined' ? window.electronAPI : 'window not defined');
