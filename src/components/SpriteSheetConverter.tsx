// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';
import type { RemovalProgress } from '../utils/backgroundRemoval';
import { applyChromaKey, detectBackgroundColor } from '../utils/imageProcessing';

interface SpriteSheetConverterProps {
    imageUrl: string;
    onGenerate: (gifBlob: Blob, animationName: string) => void;
    onCancel: () => void;
    existingAnimationsCount?: number; // How many animations already exist from this sheet
}

const SpriteSheetConverter: React.FC<SpriteSheetConverterProps> = ({ 
    imageUrl, 
    onGenerate, 
    onCancel,
    existingAnimationsCount = 0 
}) => {
    // Animation Name (for multi-animation support)
    const [animationName, setAnimationName] = useState('');
    
    // Inputs
    const [rows, setRows] = useState(4);
    const [cols, setCols] = useState(4);
    const [frameDelay, setFrameDelay] = useState(150);
    const [offsetTop, setOffsetTop] = useState(0);
    const [offsetBottom, setOffsetBottom] = useState(0);
    const [offsetLeft, setOffsetLeft] = useState(0);
    const [offsetRight, setOffsetRight] = useState(0);

    // Background Removal
    const [removeBackground, setRemoveBackground] = useState(false);
    const [removalMode, setRemovalMode] = useState<'ai' | 'chroma'>('chroma'); // Default to chroma for sprites
    const [chromaColor, setChromaColor] = useState('#00FF00');
    const [chromaTolerance, setChromaTolerance] = useState(15);
    
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [bgRemovalProgress, setBgRemovalProgress] = useState<RemovalProgress | null>(null);
    const [processedImage, setProcessedImage] = useState<HTMLImageElement | null>(null);

    // State
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
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
            setOriginalImage(img);
            setProcessedImage(null); // Reset processed image when source changes
            
            // Auto-detect background color
            const detected = detectBackgroundColor(img);
            setChromaColor(detected);
        };
    }, [imageUrl]);

    // Handle background removal toggle & updates
    useEffect(() => {
        if (!originalImage) return;

        if (removeBackground) {
            handleRemoveBackground();
        } else {
            // User disabled background removal - use original
            setImage(originalImage);
            setProcessedImage(null);
        }
    }, [removeBackground, removalMode, chromaColor, chromaTolerance, originalImage]);

    const handleRemoveBackground = async () => {
        if (!originalImage) return;

        setIsRemovingBg(true);
        
        try {
            if (removalMode === 'ai') {
                setBgRemovalProgress({ stage: 'loading', progress: 0, message: 'Loading AI model...' });
                // Dynamic import to avoid loading at startup
                const { removeBackgroundFromElement } = await import('../utils/backgroundRemoval');
                
                const result = await removeBackgroundFromElement(originalImage, (progress) => {
                    setBgRemovalProgress(progress);
                });

                setProcessedImage(result);
                setImage(result);
                setBgRemovalProgress({ stage: 'done', progress: 100, message: 'Background removed!' });
            } else {
                // Chroma Key Mode
                const result = await applyChromaKey(originalImage, chromaColor, chromaTolerance);
                setProcessedImage(result);
                setImage(result);
            }
        } catch (error) {
            console.error('Background removal failed:', error);
            setBgRemovalProgress({ 
                stage: 'error', 
                progress: 0, 
                message: error instanceof Error ? error.message : 'Failed to remove background' 
            });
            // Fall back to original
            setImage(originalImage);
            // Don't auto-disable, let user see error
        } finally {
            setIsRemovingBg(false);
        }
    };

    // Draw checkerboard pattern for transparency visualization
    const drawCheckerboard = (ctx: CanvasRenderingContext2D, width: number, height: number, size: number = 10) => {
        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                const isLight = ((x / size) + (y / size)) % 2 === 0;
                ctx.fillStyle = isLight ? '#444' : '#333';
                ctx.fillRect(x, y, size, size);
            }
        }
    };

    // Draw Grid
    useEffect(() => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to match image
        canvas.width = image.width;
        canvas.height = image.height;

        // Draw checkerboard background if transparency mode is on
        if (removeBackground && processedImage) {
            drawCheckerboard(ctx, image.width, image.height, 8);
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, image.width, image.height);
        }

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

    }, [image, rows, cols, offsetTop, offsetBottom, offsetLeft, offsetRight, removeBackground, processedImage]);

    const handleGenerate = async () => {
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

        // Configure GIF with transparency support
        // Create inline worker from fetched script to avoid path issues in Electron
        let workerScript: string | undefined = undefined;
        
        try {
            // Fetch the worker script and create a blob URL
            const workerResponse = await fetch('/lib/gif.worker.js');
            const workerCode = await workerResponse.text();
            const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
            workerScript = URL.createObjectURL(workerBlob);
            console.log('[GIF] Created inline worker blob URL');
        } catch (err) {
            console.warn('[GIF] Could not create inline worker, falling back:', err);
        }
        
        const gifOptions: any = {
            workers: workerScript ? 2 : 0, // Use workers if we got the blob, otherwise fallback
            quality: 10,
            width: frameWidth,
            height: frameHeight,
            workerScript: workerScript,
            background: '#000000',
            debug: true
        };

        // Enable transparency if background was removed
        // GIF.js needs transparency as null (auto-detect) or a specific hex color
        if (removeBackground && processedImage) {
            gifOptions.transparent = null; // Auto-detect transparent color
        }

        console.log('[GIF] Creating encoder with options:', gifOptions);
        console.log('[GIF] Worker script path:', workerScript);
        const gif = new GIF(gifOptions);

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
                // Clear with transparency
                ctx.clearRect(0, 0, frameWidth, frameHeight);

                const sourceX = offsetLeft + (c * frameWidth);
                const sourceY = offsetTop + (r * frameHeight);

                ctx.drawImage(
                    image,
                    sourceX, sourceY, frameWidth, frameHeight,
                    0, 0, frameWidth, frameHeight
                );

                // Add frame - transparency is handled at GIF level, not per-frame
                gif.addFrame(ctx, { copy: true, delay: frameDelay });

                framesProcessed++;
                setProgress((framesProcessed / totalFrames) * 50);
            }
        }

        // Set a timeout to detect if workers are stuck
        let renderStarted = false;
        const timeoutId = setTimeout(() => {
            if (!renderStarted) {
                console.error('[GIF] Worker timeout - render never started');
                setStatus('GIF worker timeout. Try disabling background removal or refresh the page.');
                setIsGenerating(false);
                try {
                    gif.abort();
                } catch (e) {
                    console.warn('[GIF] Could not abort:', e);
                }
            }
        }, 15000); // 15 second timeout

        gif.on('progress', (p: number) => {
            renderStarted = true;
            clearTimeout(timeoutId);
            console.log('[GIF] Render progress:', p);
            setProgress(50 + (p * 50));
            setStatus(`Rendering GIF: ${Math.round(p * 100)}%`);
        });

        gif.on('finished', (blob: Blob) => {
            clearTimeout(timeoutId);
            console.log('[GIF] Render finished, blob size:', blob.size);
            const url = URL.createObjectURL(blob);
            setGeneratedGifUrl(url);
            setGeneratedBlob(blob);
            setIsGenerating(false);
            setStatus('Complete!');
        });

        gif.on('abort', () => {
            clearTimeout(timeoutId);
            console.error('[GIF] Render aborted');
            setStatus('GIF rendering was aborted');
            setIsGenerating(false);
        });

        setStatus('Rendering GIF...');
        console.log('[GIF] Starting render with', totalFrames, 'frames');
        console.log('[GIF] gif.frames:', gif.frames?.length);
        console.log('[GIF] gif.running:', gif.running);
        
        // Use setTimeout to ensure event listeners are registered before render starts
        setTimeout(() => {
            try {
                console.log('[GIF] Calling render()...');
                gif.render();
                console.log('[GIF] render() called, gif.running:', gif.running);
            } catch (err) {
                clearTimeout(timeoutId);
                console.error('[GIF] Render error:', err);
                setStatus('Error rendering GIF: ' + (err instanceof Error ? err.message : 'Unknown error'));
                setIsGenerating(false);
            }
        }, 100);
    };

    const handleConfirm = () => {
        if (generatedBlob) {
            const name = animationName.trim() || `Animation #${existingAnimationsCount + 1}`;
            onGenerate(generatedBlob, name);
            
            // Reset state for next animation
            resetForNextAnimation();
        }
    };
    
    const resetForNextAnimation = () => {
        setGeneratedGifUrl(null);
        setGeneratedBlob(null);
        setAnimationName('');
        setProgress(0);
        setStatus('');
        setIsGenerating(false);
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
                    {/* Animation Name */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase text-gray-500 font-bold flex items-center gap-2">
                            <rux-icon icon="label" size="extra-small"></rux-icon>
                            Animation Name
                        </label>
                        <input
                            type="text"
                            value={animationName}
                            onChange={(e) => setAnimationName(e.target.value)}
                            placeholder={`Animation #${existingAnimationsCount + 1}`}
                            className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        {existingAnimationsCount > 0 && (
                            <div className="text-[10px] text-cyan-400">
                                {existingAnimationsCount} animation{existingAnimationsCount > 1 ? 's' : ''} already created
                            </div>
                        )}
                    </div>

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

                    {/* Background Removal Toggle */}
                    <div className="space-y-2 border-t border-gray-700 pt-4">
                        <label className="text-xs uppercase text-gray-500 font-bold flex items-center gap-2">
                            <rux-icon icon="auto-fix-high" size="extra-small"></rux-icon>
                            Transparency
                        </label>
                        <button
                            onClick={() => !isRemovingBg && setRemoveBackground(!removeBackground)}
                            disabled={isRemovingBg}
                            className={`
                                w-full flex items-center justify-between p-3 rounded border transition-all
                                ${removeBackground 
                                    ? 'bg-green-900/30 border-green-500/50 text-green-300' 
                                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'}
                                ${isRemovingBg ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                            title="Remove background"
                        >
                            <span className="text-xs font-bold uppercase">Remove Background</span>
                            <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${removeBackground ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${removeBackground ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </button>
                        
                        {removeBackground && (
                            <div className="space-y-3 p-3 bg-black/30 rounded border border-white/5 mt-2">
                                {/* Method Selector */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-gray-500 font-bold">Method</label>
                                    <div className="flex bg-black/50 rounded p-1">
                                        <button
                                            onClick={() => setRemovalMode('chroma')}
                                            className={`flex-1 py-1 text-[10px] rounded font-bold transition-colors ${removalMode === 'chroma' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            Color Key
                                        </button>
                                        <button
                                            onClick={() => setRemovalMode('ai')}
                                            className={`flex-1 py-1 text-[10px] rounded font-bold transition-colors ${removalMode === 'ai' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            AI Model
                                        </button>
                                    </div>
                                </div>

                                {removalMode === 'chroma' ? (
                                    <>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <label className="text-[10px] uppercase text-gray-500 font-bold">Key Color</label>
                                                <span className="text-[10px] font-mono text-gray-400">{chromaColor}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="color" 
                                                    value={chromaColor}
                                                    onChange={(e) => setChromaColor(e.target.value)}
                                                    className="h-8 flex-1 bg-transparent border border-gray-600 rounded cursor-pointer"
                                                />
                                                <button
                                                    onClick={() => originalImage && setChromaColor(detectBackgroundColor(originalImage))}
                                                    className="px-2 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:bg-gray-600"
                                                    title="Auto-detect from top-left pixel"
                                                >
                                                    <rux-icon icon="colorize" size="extra-small"></rux-icon>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <label className="text-[10px] uppercase text-gray-500 font-bold">Tolerance</label>
                                                <span className="text-[10px] text-gray-400">{chromaTolerance}%</span>
                                            </div>
                                            <rux-slider
                                                min={0}
                                                max={100}
                                                value={chromaTolerance}
                                                onInput={(e: any) => setChromaTolerance(parseInt(e.target.value))}
                                            ></rux-slider>
                                        </div>
                                        <p className="text-[10px] text-gray-500 italic">
                                            Best for solid backgrounds (sprites).
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-[10px] text-gray-500 italic">
                                        AI segmentation. Best for photos/complex backgrounds. Slow.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Background Removal Progress */}
                    {isRemovingBg && bgRemovalProgress && (
                        <div className="space-y-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                            <div className="flex items-center gap-2 text-xs text-blue-300">
                                <rux-icon icon="hourglass-empty" size="extra-small" className="animate-spin"></rux-icon>
                                {bgRemovalProgress.message}
                            </div>
                            <rux-progress value={bgRemovalProgress.progress}></rux-progress>
                        </div>
                    )}

                    {bgRemovalProgress?.stage === 'done' && !isRemovingBg && (
                        <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-300 flex items-center gap-2">
                            <rux-icon icon="check-circle" size="extra-small"></rux-icon>
                            Background removed successfully!
                        </div>
                    )}

                    {bgRemovalProgress?.stage === 'error' && !isRemovingBg && (
                        <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-300 flex items-center gap-2">
                            <rux-icon icon="error" size="extra-small"></rux-icon>
                            {bgRemovalProgress.message}
                        </div>
                    )}

                    <div className="pt-4">
                        <PrimaryButton onClick={handleGenerate} disabled={isGenerating || isRemovingBg || !image} className="w-full">
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
                        <div className={`relative max-w-full max-h-full overflow-auto rounded ${removeBackground && processedImage ? 'checkerboard-bg p-2' : ''}`}>
                            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain border border-gray-800" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-sm text-green-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                {removeBackground && <rux-icon icon="check-circle" size="extra-small"></rux-icon>}
                                Preview Generated {removeBackground && '(Transparent)'}
                            </div>
                            <div className={`p-2 rounded ${removeBackground ? 'checkerboard-bg' : ''}`}>
                                <img 
                                    src={generatedGifUrl} 
                                    alt="Generated GIF" 
                                    className="max-w-full max-h-[400px] object-contain border border-green-500/50 rounded shadow-lg pixelated" 
                                />
                            </div>
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
