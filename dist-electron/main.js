"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const isDev = __importStar(require("electron-is-dev"));
const electron_store_1 = __importDefault(require("electron-store"));
const generative_ai_1 = require("@google/generative-ai");
const p2p_1 = require("./p2p");
// Initialize store
const store = new electron_store_1.default();
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    // IPC Handlers for Settings
    electron_1.ipcMain.handle('get-settings', () => {
        return {
            geminiKey: store.get('geminiKey', ''),
            firebaseConfig: store.get('firebaseConfig', ''),
        };
    });
    electron_1.ipcMain.handle('save-settings', (_event, settings) => {
        store.set('geminiKey', settings.geminiKey);
        store.set('firebaseConfig', settings.firebaseConfig);
        return true;
    });
    // IPC Handler to list available models - fetch from API with fallback
    electron_1.ipcMain.handle('list-gemini-models', async () => {
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            // Return common models if no API key
            return [
                { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
                { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
                { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
            ];
        }
        try {
            // Try to fetch models from API using fetch
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
                return data.models
                    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m) => ({
                    name: m.name.replace('models/', ''),
                    displayName: m.displayName || m.name.replace('models/', ''),
                    description: m.description || '',
                }));
            }
        }
        catch (error) {
            console.error('Error fetching models from API:', error);
        }
        // Fallback to common model names
        return [
            { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
            { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
            { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
        ];
    });
    // IPC Handler for Gemini Chat
    electron_1.ipcMain.handle('chat-with-gemini', async (_event, { message, history, model: modelName }) => {
        const apiKey = store.get('geminiKey');
        if (!apiKey) {
            throw new Error('Gemini API Key not found. Please configure it in Settings.');
        }
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            const selectedModel = modelName || 'gemini-pro';
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const chat = model.startChat({
                history: history.map((h) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }],
                })),
            });
            const result = await chat.sendMessage(message);
            const response = await result.response;
            const text = response.text();
            return text;
        }
        catch (error) {
            console.error('Gemini Error:', error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    });
    // IPC Handlers for P2P
    electron_1.ipcMain.handle('p2p-create-core', async (_event, name) => {
        return await (0, p2p_1.createCore)(name);
    });
    electron_1.ipcMain.handle('p2p-append', async (_event, { name, data }) => {
        return await (0, p2p_1.appendToCore)(name, data);
    });
    electron_1.ipcMain.handle('p2p-read', async (_event, name) => {
        return await (0, p2p_1.readCore)(name);
    });
    // Initialize P2P
    (0, p2p_1.initP2P)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
