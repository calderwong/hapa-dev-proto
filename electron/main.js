"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var path = require("path");
var isDev = require("electron-is-dev");
var electron_store_1 = require("electron-store");
var generative_ai_1 = require("@google/generative-ai");
var p2p_1 = require("./p2p");
// Initialize store
var store = new electron_store_1.default();
function createWindow() {
    var win = new electron_1.BrowserWindow({
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
electron_1.app.whenReady().then(function () {
    // IPC Handlers for Settings
    electron_1.ipcMain.handle('get-settings', function () {
        return {
            geminiKey: store.get('geminiKey', ''),
            firebaseConfig: store.get('firebaseConfig', ''),
        };
    });
    electron_1.ipcMain.handle('save-settings', function (_event, settings) {
        store.set('geminiKey', settings.geminiKey);
        store.set('firebaseConfig', settings.firebaseConfig);
        return true;
    });
    // IPC Handler to list available models - fetch from API with fallback
    electron_1.ipcMain.handle('list-gemini-models', function () { return __awaiter(void 0, void 0, void 0, function () {
        var apiKey, response, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = store.get('geminiKey');
                    if (!apiKey) {
                        // Return common models if no API key
                        return [2 /*return*/, [
                                { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
                                { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
                                { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
                            ]];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey)];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (data.models && Array.isArray(data.models)) {
                        return [2 /*return*/, data.models
                                .filter(function (m) { var _a; return (_a = m.supportedGenerationMethods) === null || _a === void 0 ? void 0 : _a.includes('generateContent'); })
                                .map(function (m) { return ({
                                name: m.name.replace('models/', ''),
                                displayName: m.displayName || m.name.replace('models/', ''),
                                description: m.description || '',
                            }); })];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error('Error fetching models from API:', error_1);
                    return [3 /*break*/, 5];
                case 5: 
                // Fallback to common model names
                return [2 /*return*/, [
                        { name: 'gemini-pro', displayName: 'Gemini Pro', description: 'Standard model' },
                        { name: 'gemini-1.5-flash-001', displayName: 'Gemini 1.5 Flash', description: 'Fast model' },
                        { name: 'gemini-1.5-pro-001', displayName: 'Gemini 1.5 Pro', description: 'Advanced model' },
                    ]];
            }
        });
    }); });
    // IPC Handler for Gemini Chat
    // IPC Handler for Gemini Chat
    electron_1.ipcMain.handle('chat-with-gemini', function (_event_1, _a) { return __awaiter(void 0, [_event_1, _a], void 0, function (_event, _b) {
        var apiKey, genAI, model_1, sendMessageWithRetry_1, error_2;
        var message = _b.message, history = _b.history, modelName = _b.model, attachments = _b.attachments;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    apiKey = store.get('geminiKey');
                    if (!apiKey) {
                        throw new Error('Gemini API Key not found. Please configure it in Settings.');
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
                    model_1 = genAI.getGenerativeModel({ model: modelName || 'gemini-pro' });
                    sendMessageWithRetry_1 = function (currentHistory) { return __awaiter(void 0, void 0, void 0, function () {
                        var chat, parts, result, response, text, error_3;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 3, , 6]);
                                    chat = model_1.startChat({
                                        history: currentHistory,
                                    });
                                    parts = [];
                                    if (attachments && attachments.length > 0) {
                                        parts = attachments.map(function (att) { return ({
                                            inlineData: {
                                                mimeType: att.mimeType,
                                                data: att.data
                                            }
                                        }); });
                                    }
                                    parts.push({ text: message });
                                    console.log('Sending message to Gemini:', { model: modelName, partsCount: parts.length, historyLength: currentHistory.length });
                                    return [4 /*yield*/, chat.sendMessage(parts)];
                                case 1:
                                    result = _b.sent();
                                    return [4 /*yield*/, result.response];
                                case 2:
                                    response = _b.sent();
                                    text = response.text();
                                    console.log('Received response from Gemini:', text.substring(0, 50) + '...');
                                    return [2 /*return*/, text];
                                case 3:
                                    error_3 = _b.sent();
                                    console.error('Gemini attempt failed:', error_3);
                                    if (!(((_a = error_3.message) === null || _a === void 0 ? void 0 : _a.includes('thought_signature')) && currentHistory.length > 0)) return [3 /*break*/, 5];
                                    console.log('Retrying with empty history due to thought_signature error...');
                                    return [4 /*yield*/, sendMessageWithRetry_1([])];
                                case 4: return [2 /*return*/, _b.sent()];
                                case 5: throw error_3;
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, sendMessageWithRetry_1(history)];
                case 2: return [2 /*return*/, _c.sent()];
                case 3:
                    error_2 = _c.sent();
                    console.error('Gemini Error:', error_2);
                    throw new Error("Gemini Error: ".concat(error_2.message));
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // IPC Handlers for P2P
    electron_1.ipcMain.handle('p2p-create-core', function (_event, name) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, p2p_1.createCore)(name)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); });
    electron_1.ipcMain.handle('p2p-append', function (_event_1, _a) { return __awaiter(void 0, [_event_1, _a], void 0, function (_event, _b) {
        var name = _b.name, data = _b.data;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, p2p_1.appendToCore)(name, data)];
                case 1: return [2 /*return*/, _c.sent()];
            }
        });
    }); });
    electron_1.ipcMain.handle('p2p-read', function (_event, name) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, p2p_1.readCore)(name)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); });
    // Initialize P2P
    (0, p2p_1.initP2P)();
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
