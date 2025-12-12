declare module 'hypercore';
declare module 'hyperswarm';
declare module 'b4a';

export interface IElectronAPI {
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<any>;
  listGeminiModels: () => Promise<any[]>;
  listOpenAIModels: () => Promise<any[]>;
  listAimlApiModels: () => Promise<any[]>;
  listLlamaModels: () => Promise<any[]>;
  chatWithAimlApi: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) => Promise<string>;
  chatWithGemini: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) => Promise<{ content: string; model: string; provider: string }>;
  chatWithOpenAI: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) => Promise<{ content: string; model: string; provider: string }>;
  chatWithLlama: (data: { message: string; history: any[]; model?: string; attachments?: { mimeType: string; data: string }[] }) => Promise<{ content: string; model: string; provider: string }>;
  // Add other methods as needed, this is just a partial definition to satisfy TS for now
  [key: string]: any;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
