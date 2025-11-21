import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import Store from 'electron-store';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initP2P, createCore, appendToCore, readCore } from './p2p';

// Initialize store
const store = new Store();

function createWindow() {
    const win = new BrowserWindow({
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
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    // IPC Handlers for Settings
    ipcMain.handle('get-settings', () => {
        return {
            geminiKey: (store.get('geminiKey', '') as string),
            firebaseConfig: (store.get('firebaseConfig', '') as string),
        };
    });

    ipcMain.handle('save-settings', (_event, settings: { geminiKey: string; firebaseConfig: string }) => {
        store.set('geminiKey', settings.geminiKey);
        store.set('firebaseConfig', settings.firebaseConfig);
        return true;
    });

    // IPC Handler to list available models - fetch from API with fallback
    ipcMain.handle('list-gemini-models', async () => {
        const apiKey = (store.get('geminiKey') as string);
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
            const data: any = await response.json();

            if (data.models && Array.isArray(data.models)) {
                return data.models
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => ({
                        name: m.name.replace('models/', ''),
                        displayName: m.displayName || m.name.replace('models/', ''),
                        description: m.description || '',
                    }));
            }
        } catch (error: any) {
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
    ipcMain.handle('chat-with-gemini', async (_event, { message, history, model: modelName }: { message: string; history: any[]; model?: string }) => {
        const apiKey = (store.get('geminiKey') as string);
        if (!apiKey) {
            throw new Error('Gemini API Key not found. Please configure it in Settings.');
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const selectedModel = modelName || 'gemini-pro';
            const model = genAI.getGenerativeModel({ model: selectedModel });

            const chat = model.startChat({
                history: history.map((h: any) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }],
                })),
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            const text = response.text();
            return text;
        } catch (error: any) {
            console.error('Gemini Error:', error);
            throw new Error(`Gemini Error: ${error.message}`);
        }
    });

    // IPC Handlers for P2P
    ipcMain.handle('p2p-create-core', async (_event, name: string) => {
        return await createCore(name);
    });

    ipcMain.handle('p2p-append', async (_event, { name, data }: { name: string; data: string }) => {
        return await appendToCore(name, data);
    });

    ipcMain.handle('p2p-read', async (_event, name: string) => {
        return await readCore(name);
    });

    // Initialize P2P
    initP2P();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
