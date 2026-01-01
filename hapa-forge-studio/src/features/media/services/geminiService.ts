import { createGenAI } from '@/shared/genai/client';
import { getApiKey, getModelSettings } from '@/shared/genai/settings';
import { AspectRatio } from '../types';

// Helper to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const ensureApiKey = async (): Promise<boolean> => {
  return !!getApiKey();
};

/**
 * The original mini-app was designed for AI Studio environments that can open a key selection modal.
 * In this merged app, we route users to /settings.
 */
export const promptForApiKey = async (): Promise<void> => {
  alert('Open Settings and paste your Gemini API key.');
};

const appendKeyIfMissing = (uri: string): string => {
  const key = getApiKey();
  if (!key) return uri;
  if (uri.includes('key=')) return uri;
  const joiner = uri.includes('?') ? '&' : '?';
  return `${uri}${joiner}key=${encodeURIComponent(key)}`;
};

export const generateVeoVideo = async (
  imageBase64: string,
  prompt: string,
  aspectRatio: AspectRatio,
  mimeType: string,
  onProgress: (msg: string) => void
): Promise<string> => {
  const ai = createGenAI();
  const { videoModel } = getModelSettings();

  onProgress('Initializing quantum matrix...');

  let operation = await ai.models.generateVideos({
    model: videoModel,
    prompt: prompt || 'Animate this scene in a cinematic, futuristic style.',
    image: {
      imageBytes: imageBase64,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio,
    },
  });

  onProgress('Video generation operation started. Polling neural net...');

  while (!operation.done) {
    onProgress('Rendering holographic stream... (This may take a minute)');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if ((operation as any).error) {
    throw new Error(
      `Generation failed: ${(operation as any).error?.message || 'Unknown error'}`
    );
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error('No video URI returned.');

  onProgress('Download complete. Establishing visual feed.');
  return appendKeyIfMissing(videoUri);
};
