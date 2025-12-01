// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';

interface SpriteSheetConverterProps {
    imageUrl: string;
    onGenerate: (gifBlob: Blob) => void;
    onCancel: () => void;
}

const SpriteSheetConverter: React.FC<SpriteSheetConverterProps> = ({ imageUrl, onGenerate, onCancel }) => {
    // Inputs
    const [rows, setRows] = useState(4);
    const [cols, setCols] = useState(4);
    const [frameDelay, setFrameDelay] = useState(150);
    const [offsetTop, setOffsetTop] = useState(0);
    const [offsetBottom, setOffsetBottom] = useState(0);
    const [offsetLeft, setOffsetLeft] = useState(0);
    const [offsetRight, setOffsetRight] = useState(0);

    // State
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [generatedGifUrl, setGeneratedGifUrl] = useState<string | null>(null);
    const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);

    // Load Image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Important for canvas manipulation if external URL
        img.src = imageUrl;
        img.onload = () => {
            setImage(img);
        };
    }, [imageUrl]);

    // Draw Grid
    useEffect(() => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to match image
        canvas.width = image.width;
        canvas.height = image.height;

        // Draw Image
        ctx.drawImage(image, 0, 0);

        // Calculate effective dimensions
        const effectiveWidth = image.width - offsetLeft - offsetRight;
        const effectiveHeight = image.height - offsetTop - offsetBottom;

        // Calculate frame dimensions
        const frameWidth = Math.floor(effectiveWidth / cols);
        const frameHeight = Math.floor(effectiveHeight / rows);

        // Draw Grid Overlay
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;

        // Draw outer border (offset area)
        ctx.strokeRect(offsetLeft, offsetTop, effectiveWidth, effectiveHeight);

        // Draw vertical lines
        for (let c = 1; c < cols; c++) {
            const x = offsetLeft + (c * frameWidth);
            ctx.beginPath();
            ctx.moveTo(x, offsetTop);
            ctx.lineTo(x, image.height - offsetBottom);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let r = 1; r < rows; r++) {
            const y = offsetTop + (r * frameHeight);
            ctx.beginPath();
            ctx.moveTo(offsetLeft, y);
            ctx.lineTo(image.width - offsetRight, y);
            ctx.stroke();
        }

    }, [image, rows, cols, offsetTop, offsetBottom, offsetLeft, offsetRight]);

    const handleGenerate = () => {
        if (!image) return;

        setIsGenerating(true);
        setStatus('Extracting frames...');
        setProgress(0);

        const GIF = (window as any).GIF;
        if (!GIF) {
            setStatus('Error: GIF library not loaded.');
            setIsGenerating(false);
            return;
        }

        // Calculate dimensions
        const effectiveWidth = image.width - offsetLeft - offsetRight;
        const effectiveHeight = image.height - offsetTop - offsetBottom;
        const frameWidth = Math.floor(effectiveWidth / cols);
        const frameHeight = Math.floor(effectiveHeight / rows);

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: frameWidth,
            height: frameHeight,
            workerScript: './lib/gif.worker.js'
        });

        // Create temp canvas for frame extraction
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frameWidth;
        tempCanvas.height = frameHeight;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        const totalFrames = rows * cols;
        let framesProcessed = 0;

        // Extract frames
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.clearRect(0, 0, frameWidth, frameHeight);

                const sourceX = offsetLeft + (c * frameWidth);
                const sourceY = offsetTop + (r * frameHeight);

                ctx.drawImage(
                    image,
                    sourceX, sourceY, frameWidth, frameHeight,
                    0, 0, frameWidth, frameHeight
                );

                gif.addFrame(ctx, { copy: true, delay: frameDelay });

                framesProcessed++;
                setProgress((framesProcessed / totalFrames) * 50);
            }
        }

        gif.on('progress', (p: number) => {
            setProgress(50 + (p * 50));
            setStatus(`Rendering GIF: ${Math.round(p * 100)}%`);
        });

        gif.on('finished', (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            setGeneratedGifUrl(url);
            setGeneratedBlob(blob);
            setIsGenerating(false);
            setStatus('Complete!');
        });

        setStatus('Rendering GIF...');
        gif.render();
    };

    const handleConfirm = () => {
        if (generatedBlob) {
            onGenerate(generatedBlob);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <rux-icon icon="animation" size="small"></rux-icon>
                    Sprite Sheet Converter
                </h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">
                    <rux-icon icon="close" size="small"></rux-icon>
                </button>
            </div>

            <div className="flex gap-4 h-full overflow-hidden">
                {/* Controls */}
                <div className="w-64 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-500 font-bold">Grid Layout</label>
                        <div className="grid grid-cols-2 gap-2">
                            <rux-input label="Rows" type="number" value={rows} onInput={(e: any) => setRows(parseInt(e.target.value) || 1)}></rux-input>
                            <rux-input label="Cols" type="number" value={cols} onInput={(e: any) => setCols(parseInt(e.target.value) || 1)}></rux-input>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-500 font-bold">Animation</label>
                        <rux-input label="Delay (ms)" type="number" value={frameDelay} onInput={(e: any) => setFrameDelay(parseInt(e.target.value) || 100)}></rux-input>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-500 font-bold">Offsets (px)</label>
                        <div className="grid grid-cols-2 gap-2">
                            <rux-input label="Top" type="number" value={offsetTop} onInput={(e: any) => setOffsetTop(parseInt(e.target.value) || 0)}></rux-input>
                            <rux-input label="Bottom" type="number" value={offsetBottom} onInput={(e: any) => setOffsetBottom(parseInt(e.target.value) || 0)}></rux-input>
                            <rux-input label="Left" type="number" value={offsetLeft} onInput={(e: any) => setOffsetLeft(parseInt(e.target.value) || 0)}></rux-input>
                            <rux-input label="Right" type="number" value={offsetRight} onInput={(e: any) => setOffsetRight(parseInt(e.target.value) || 0)}></rux-input>
                        </div>
                    </div>

                    <div className="pt-4">
                        <PrimaryButton onClick={handleGenerate} disabled={isGenerating || !image} className="w-full">
                            {isGenerating ? 'Processing...' : 'Generate Preview'}
                        </PrimaryButton>
                    </div>

                    {isGenerating && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-400">{status}</div>
                            <rux-progress value={progress}></rux-progress>
                        </div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden bg-black/40 rounded-lg p-4 items-center justify-center relative">
                    {!generatedGifUrl ? (
                        <div className="relative max-w-full max-h-full overflow-auto">
                            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain border border-gray-800" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-sm text-green-400 font-bold uppercase tracking-wider">Preview Generated</div>
                            <img src={generatedGifUrl} alt="Generated GIF" className="max-w-full max-h-[400px] object-contain border border-green-500/50 rounded shadow-lg" />
                            <div className="flex gap-2">
                                <SecondaryButton onClick={() => setGeneratedGifUrl(null)}>Back to Settings</SecondaryButton>
                                <PrimaryButton onClick={handleConfirm}>Save & Append to Card</PrimaryButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpriteSheetConverter;
