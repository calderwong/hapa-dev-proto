export type ModelSettings = {
  textModel: string;
  imageModel: string;
  videoModel: string;
};

export const DEFAULT_MODELS: ModelSettings = {
  textModel: 'gemini-3-flash-preview',
  imageModel: 'gemini-2.5-flash-image',
  videoModel: 'veo-3.1-fast-generate-preview',
};

const STORAGE_KEY_API_KEY = 'hapa_forge_api_key_v1';
const STORAGE_KEY_MODELS = 'hapa_forge_models_v1';

export const getApiKey = (): string | undefined => {
  const fromLocal = localStorage.getItem(STORAGE_KEY_API_KEY);
  if (fromLocal && fromLocal.trim().length > 0) return fromLocal.trim();

  // Vite define compatibility (legacy mini-app behaviour)
  const envKey = (process.env.API_KEY || process.env.GEMINI_API_KEY) as
    | string
    | undefined;
  if (envKey && envKey.trim().length > 0) return envKey.trim();

  return undefined;
};

export const setApiKey = (key: string) => {
  const cleaned = key.trim();
  if (!cleaned) {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY_API_KEY, cleaned);
};

export const getModelSettings = (): ModelSettings => {
  const raw = localStorage.getItem(STORAGE_KEY_MODELS);
  if (!raw) return DEFAULT_MODELS;
  try {
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return {
      textModel: parsed.textModel || DEFAULT_MODELS.textModel,
      imageModel: parsed.imageModel || DEFAULT_MODELS.imageModel,
      videoModel: parsed.videoModel || DEFAULT_MODELS.videoModel,
    };
  } catch {
    return DEFAULT_MODELS;
  }
};

export const setModelSettings = (settings: ModelSettings) => {
  localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(settings));
};

export const clearModelSettings = () => {
  localStorage.removeItem(STORAGE_KEY_MODELS);
};
