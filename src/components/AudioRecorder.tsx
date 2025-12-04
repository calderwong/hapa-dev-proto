// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';

interface AudioRecorderProps {
    gifUrl: string;
    animationTitle: string;
    onSave: (audioBlob: Blob, name: string) => Promise<void>;
    onCancel: () => void;
}

type RecordingState = 'idle' | 'countdown' | 'recording' | 'preview' | 'saving';

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
    gifUrl, 
    animationTitle,
    onSave, 
    onCancel 
}) => {
    const [state, setState] = useState<RecordingState>('idle');
    const [countdown, setCountdown] = useState(3);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [clipName, setClipName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const gifRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const timerRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Request microphone permission on mount
    useEffect(() => {
        checkMicrophonePermission();
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
    };

    const checkMicrophonePermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
        } catch (err) {
            console.error('Microphone permission denied:', err);
            setHasPermission(false);
            setError('Microphone access denied. Please enable microphone permissions.');
        }
    };

    const startCountdown = async () => {
        setError(null);
        
        try {
            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            streamRef.current = stream;

            // Set up audio analyser for visualization
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Set up media recorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setState('preview');
            };

            // Start countdown
            setState('countdown');
            setCountdown(3);

            // Pause GIF at first frame (we'll restart it on record)
            if (gifRef.current) {
                gifRef.current.style.animationPlayState = 'paused';
            }

            // Countdown timer
            let count = 3;
            const countdownInterval = setInterval(() => {
                count--;
                setCountdown(count);
                if (count === 0) {
                    clearInterval(countdownInterval);
                    startRecording();
                }
            }, 1000);

        } catch (err) {
            console.error('Failed to start recording:', err);
            setError('Failed to access microphone. Please try again.');
            setState('idle');
        }
    };

    const startRecording = () => {
        setState('recording');
        setRecordingTime(0);

        // Start the GIF animation
        if (gifRef.current) {
            // Force GIF to restart by re-setting src
            const src = gifRef.current.src;
            gifRef.current.src = '';
            gifRef.current.src = src;
        }

        // Start recording
        mediaRecorderRef.current?.start(100); // Collect data every 100ms

        // Start timer
        const startTime = Date.now();
        timerRef.current = window.setInterval(() => {
            setRecordingTime((Date.now() - startTime) / 1000);
        }, 100);

        // Start waveform visualization
        drawWaveform();
    };

    const stopRecording = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        mediaRecorderRef.current?.stop();
        
        // Stop stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };

    const drawWaveform = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (state !== 'recording') return;
            
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                
                // Gradient from cyan to purple
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#06b6d4');
                gradient.addColorStop(1, '#a855f7');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();
    };

    const playPreview = () => {
        if (audioRef.current && gifRef.current) {
            // Restart GIF
            const src = gifRef.current.src;
            gifRef.current.src = '';
            gifRef.current.src = src;
            
            // Play audio
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    };

    const handleReRecord = () => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
        setState('idle');
    };

    const handleSave = async () => {
        if (!audioBlob) return;
        
        setState('saving');
        try {
            const name = clipName.trim() || `${animationTitle} - Sound Effect`;
            await onSave(audioBlob, name);
        } catch (err) {
            console.error('Failed to save audio:', err);
            setError('Failed to save audio. Please try again.');
            setState('preview');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full mx-4 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <rux-icon icon="mic" size="small" className="text-red-400"></rux-icon>
                        Record Sound Effect
                    </h3>
                    <button 
                        onClick={onCancel}
                        className="text-gray-400 hover:text-white transition-colors"
                        disabled={state === 'saving'}
                        title="Close"
                        aria-label="Close"
                    >
                        <rux-icon icon="close" size="small"></rux-icon>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                            <rux-icon icon="error" size="small"></rux-icon>
                            {error}
                        </div>
                    )}

                    {/* GIF Preview */}
                    <div className="relative aspect-square max-w-xs mx-auto bg-black/50 rounded-lg border border-gray-700 overflow-hidden">
                        <img 
                            ref={gifRef}
                            src={gifUrl} 
                            alt="Animation" 
                            className="w-full h-full object-contain"
                        />
                        
                        {/* Countdown Overlay */}
                        {state === 'countdown' && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <div className="text-6xl font-bold text-cyan-400 animate-pulse">
                                    {countdown}
                                </div>
                            </div>
                        )}

                        {/* Recording Indicator */}
                        {state === 'recording' && (
                            <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-900/80 px-2 py-1 rounded">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-400 text-xs font-mono">REC</span>
                            </div>
                        )}
                    </div>

                    {/* Waveform Visualization */}
                    {(state === 'recording') && (
                        <div className="bg-black/30 rounded-lg p-2 border border-gray-700">
                            <canvas 
                                ref={canvasRef}
                                width={500}
                                height={60}
                                className="w-full h-16 rounded"
                            />
                        </div>
                    )}

                    {/* Recording Time */}
                    {(state === 'recording' || state === 'preview') && (
                        <div className="text-center">
                            <div className="text-2xl font-mono text-cyan-400">
                                {formatTime(recordingTime)}
                            </div>
                            {state === 'recording' && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Click STOP when done
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio Preview */}
                    {audioUrl && state === 'preview' && (
                        <audio ref={audioRef} src={audioUrl} className="hidden" />
                    )}

                    {/* Clip Name Input (Preview State) */}
                    {state === 'preview' && (
                        <div className="space-y-2">
                            <label className="text-xs uppercase text-gray-500 font-bold">
                                Clip Name (Optional)
                            </label>
                            <input
                                type="text"
                                value={clipName}
                                onChange={(e) => setClipName(e.target.value)}
                                placeholder={`${animationTitle} - Sound Effect`}
                                className="w-full bg-black/20 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-black/20">
                    <div className="text-xs text-gray-500">
                        {hasPermission === false && 'Microphone access required'}
                        {state === 'idle' && hasPermission && 'Ready to record'}
                        {state === 'countdown' && 'Get ready...'}
                        {state === 'recording' && 'Recording in progress'}
                        {state === 'preview' && 'Review your recording'}
                        {state === 'saving' && 'Saving...'}
                    </div>
                    <div className="flex gap-3">
                        {state === 'idle' && (
                            <>
                                <SecondaryButton onClick={onCancel}>
                                    CANCEL
                                </SecondaryButton>
                                <PrimaryButton 
                                    onClick={startCountdown}
                                    disabled={!hasPermission}
                                >
                                    <rux-icon icon="mic" size="small" className="mr-2"></rux-icon>
                                    START RECORDING
                                </PrimaryButton>
                            </>
                        )}

                        {state === 'countdown' && (
                            <SecondaryButton onClick={() => {
                                cleanup();
                                setState('idle');
                            }}>
                                CANCEL
                            </SecondaryButton>
                        )}

                        {state === 'recording' && (
                            <PrimaryButton onClick={stopRecording}>
                                <rux-icon icon="stop" size="small" className="mr-2"></rux-icon>
                                STOP
                            </PrimaryButton>
                        )}

                        {state === 'preview' && (
                            <>
                                <SecondaryButton onClick={handleReRecord}>
                                    <rux-icon icon="replay" size="small" className="mr-2"></rux-icon>
                                    RE-RECORD
                                </SecondaryButton>
                                <SecondaryButton onClick={playPreview}>
                                    <rux-icon icon="play-arrow" size="small" className="mr-2"></rux-icon>
                                    PREVIEW
                                </SecondaryButton>
                                <PrimaryButton onClick={handleSave}>
                                    <rux-icon icon="save" size="small" className="mr-2"></rux-icon>
                                    SAVE
                                </PrimaryButton>
                            </>
                        )}

                        {state === 'saving' && (
                            <PrimaryButton disabled>
                                <rux-icon icon="autorenew" size="small" className="mr-2 animate-spin"></rux-icon>
                                SAVING...
                            </PrimaryButton>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudioRecorder;
