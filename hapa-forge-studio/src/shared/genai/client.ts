import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './settings';

export const createGenAI = () => {
  const key = getApiKey();
  if (!key) {
    throw new Error('No API key set. Add your Gemini API key in Settings.');
  }
  return new GoogleGenAI({ apiKey: key });
};
