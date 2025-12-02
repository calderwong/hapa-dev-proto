// @ts-nocheck
// Note: @imgly/background-removal is loaded dynamically to avoid startup issues

export interface RemovalProgress {
    stage: 'loading' | 'processing' | 'done' | 'error';
    progress: number; // 0-100
    message: string;
}

export type ProgressCallback = (progress: RemovalProgress) => void;

/**
 * Remove background from an image using AI-powered segmentation.
 * Runs entirely in the browser using ONNX models.
 * 
 * @param imageSource - URL, Blob, or File of the image
 * @param onProgress - Optional callback for progress updates
 * @returns Blob with transparent background (PNG format)
 */
export async function removeImageBackground(
    imageSource: string | Blob | File,
    onProgress?: ProgressCallback
): Promise<Blob> {
    try {
        onProgress?.({ stage: 'loading', progress: 0, message: 'Loading AI model...' });
        
        // Dynamic import to avoid loading at app startup
        const { removeBackground } = await import('@imgly/background-removal');
        
        const config = {
            debug: false,
            model: 'medium' as const,
            output: {
                format: 'image/png' as const,
                quality: 1.0,
            },
            progress: (key: string, current: number, total: number) => {
                if (onProgress) {
                    const percent = Math.round((current / total) * 100);
                    let stage: RemovalProgress['stage'] = 'processing';
                    let message = 'Processing...';

                    if (key.includes('fetch') || key.includes('load')) {
                        stage = 'loading';
                        message = 'Loading AI model...';
                    } else if (key.includes('compute') || key.includes('inference')) {
                        stage = 'processing';
                        message = 'Removing background...';
                    }

                    onProgress({ stage, progress: percent, message });
                }
            },
        };
        
        const result = await removeBackground(imageSource, config);
        
        onProgress?.({ stage: 'done', progress: 100, message: 'Complete!' });
        
        return result;
    } catch (error) {
        onProgress?.({ 
            stage: 'error', 
            progress: 0, 
            message: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw error;
    }
}

/**
 * Remove background and return as an HTMLImageElement ready for canvas use.
 */
export async function removeBackgroundAsImage(
    imageSource: string | Blob | File,
    onProgress?: ProgressCallback
): Promise<HTMLImageElement> {
    const blob = await removeImageBackground(imageSource, onProgress);
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * Remove background from an existing HTMLImageElement.
 */
export async function removeBackgroundFromElement(
    imageElement: HTMLImageElement,
    onProgress?: ProgressCallback
): Promise<HTMLImageElement> {
    // Convert HTMLImageElement to Blob
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(imageElement, 0, 0);
    
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('Failed to convert image to blob'));
                return;
            }
            
            try {
                const result = await removeBackgroundAsImage(blob, onProgress);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, 'image/png');
    });
}
