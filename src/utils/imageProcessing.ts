/**
 * Apply Chroma Key (Green Screen) effect to an image.
 * Makes pixels matching the target color transparent.
 */
export async function applyChromaKey(
    image: HTMLImageElement, 
    colorHex: string, 
    tolerance: number = 10
): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const target = hexToRgb(colorHex);
    if (!target) return image;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Simple Euclidean distance
        // Optimize: We can avoid sqrt by comparing squared distance
        // R,G,B are 0-255. Tolerance is 0-100 roughly mapping to a distance.
        // Let's scale tolerance to be useful. 
        // Distance max is sqrt(255^2 * 3) ~ 441.
        // If tolerance is 0-100, we can treat it as % or absolute units.
        // Let's treat tolerance as absolute distance threshold (0-255).
        
        // Better approach for user-friendly tolerance (0-100):
        // Tolerance 0 = Exact match only.
        // Tolerance 100 = Match everything.
        // Threshold = (tolerance / 100) * 441.
        
        const dist = Math.sqrt(
            Math.pow(r - target.r, 2) + 
            Math.pow(g - target.g, 2) + 
            Math.pow(b - target.b, 2)
        );

        // Use a scaled threshold. 
        // A tolerance of 10 should handle jpeg artifacts (~20-30 distance).
        // So let's say threshold = tolerance * 3.
        const threshold = tolerance * 4.4; 

        if (dist <= threshold) {
            data[i + 3] = 0; // Alpha = 0
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const url = canvas.toDataURL('image/png');
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Auto-detect the background color from the top-left pixel.
 */
export function detectBackgroundColor(image: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#00FF00';

    ctx.drawImage(image, 0, 0);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    
    const r = pixel[0].toString(16).padStart(2, '0');
    const g = pixel[1].toString(16).padStart(2, '0');
    const b = pixel[2].toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
}
