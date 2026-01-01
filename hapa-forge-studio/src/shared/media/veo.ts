import { AspectRatio } from '@/features/media/types';
import { generateVeoVideo } from '@/features/media/services/geminiService';

export type VeoAspectRatio = '16:9' | '9:16';

/**
 * Parse a base64 image dataUrl (data:<mime>;base64,<payload>) into base64 bytes + mimeType.
 */
export const dataUrlToBase64Parts = (
  dataUrl: string
): { mimeType: string; base64: string } => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Invalid image: expected a dataUrl string.');
  }
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Invalid image: expected a dataUrl starting with "data:".');
  }

  const [head, b64] = dataUrl.split(',');
  if (!head || !b64) {
    throw new Error('Invalid image dataUrl: missing base64 payload.');
  }

  // head example: data:image/png;base64
  const m = head.match(/data:(.*?);base64/i);
  const mimeType = m?.[1] || 'image/png';
  return { mimeType, base64: b64 };
};

export const generateVeoVideoFromDataUrl = async (args: {
  imageDataUrl: string;
  prompt: string;
  aspectRatio: VeoAspectRatio;
  onProgress?: (msg: string) => void;
}): Promise<string> => {
  const { mimeType, base64 } = dataUrlToBase64Parts(args.imageDataUrl);
  const ar =
    args.aspectRatio === '9:16' ? AspectRatio.PORTRAIT : AspectRatio.LANDSCAPE;

  return generateVeoVideo(
    base64,
    args.prompt,
    ar,
    mimeType,
    args.onProgress || (() => {})
  );
};
