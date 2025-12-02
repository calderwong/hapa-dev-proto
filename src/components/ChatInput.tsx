// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';

export interface Attachment {
    file: File;
    preview: string;
    base64: string;
    mimeType: string;
}

interface ChatInputProps {
    onSend: (text: string, attachments: Attachment[]) => void;
    isLoading: boolean;
    chatMode: 'request-response' | 'realtime';
    provider: 'gemini' | 'openai' | 'llama';
    onStop: () => void;
    attachments: Attachment[];
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) {
                reject(new Error('Failed to read audio blob'));
                return;
            }
            const base64Data = result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
    });
};

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    isLoading,
    chatMode,
    provider,
    onStop,
    attachments,
    setAttachments,
}) => {
    const [input, setInput] = useState('');
    // const [attachments, setAttachments] = useState<Attachment[]>([]); // Lifted up
    const [isRecording, setIsRecording] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const openaiSessionIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.electronAPI || !window.electronAPI.onAudioTranscriptStream) return;

        const handler = (payload: { sessionId: string; delta: string; fullText: string }) => {
            if (!payload) return;
            if (!payload.fullText && !payload.delta) return;
            if (!openaiSessionIdRef.current || payload.sessionId !== openaiSessionIdRef.current) {
                return;
            }
            setLiveTranscript(payload.fullText || payload.delta || '');
        };

        window.electronAPI.onAudioTranscriptStream(handler);
    }, []);

    const addAttachmentFromBlob = async (blob: Blob, mimeType: string, fileName: string) => {
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve(base64Data);
            };
            reader.readAsDataURL(blob);
        });

        const file = new File([blob], fileName, { type: mimeType });
        const preview = URL.createObjectURL(blob);

        setAttachments((prev) => [
            ...prev,
            {
                file,
                preview,
                base64,
                mimeType,
            },
        ]);
    };
    const processFiles = async (fileList: FileList | File[]) => {
        if (!fileList || (fileList as any).length === 0) return;

        const newAttachments: Attachment[] = [];

        for (let i = 0; i < (fileList as any).length; i++) {
            const file = (fileList as any)[i] as File;
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');

            if (!isImage && !isVideo && !isAudio) {
                alert(`File type ${file.type} not supported. Only images, video, and audio are supported.`);
                continue;
            }

            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.readAsDataURL(file);
            });

            newAttachments.push({
                file,
                preview: URL.createObjectURL(file),
                base64,
                mimeType: file.type,
            });
        }

        if (newAttachments.length > 0) {
            setAttachments((prev) => [...prev, ...newAttachments]);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFiles(e.target.files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleCaptureImage = async () => {
        if (chatMode !== 'realtime') return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('getUserMedia is not supported in this environment.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;

            await new Promise<void>((resolve) => {
                video.onloadedmetadata = () => {
                    video.play().then(() => resolve()).catch(() => resolve());
                };
            });

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

            stream.getTracks().forEach((track) => track.stop());

            const blob: Blob = await new Promise((resolve) => {
                canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
            });

            await addAttachmentFromBlob(blob, 'image/png', `snapshot-${Date.now()}.png`);
        } catch (err) {
            console.error('Failed to capture image from camera:', err);
        }
    };

    const handleToggleRecording = async () => {
        if (chatMode !== 'realtime') return;

        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        try {
            if (provider === 'openai' && window.electronAPI?.openaiStartAudioSession) {
                try {
                    const session = await window.electronAPI.openaiStartAudioSession();
                    openaiSessionIdRef.current = session.sessionId;
                    setLiveTranscript('');
                } catch (error) {
                    console.error('Failed to start OpenAI audio session:', error);
                    openaiSessionIdRef.current = null;
                    setLiveTranscript('');
                }
            } else {
                openaiSessionIdRef.current = null;
                setLiveTranscript('');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            recordedChunksRef.current = [];

            recorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);

                    if (
                        provider === 'openai' &&
                        chatMode === 'realtime' &&
                        openaiSessionIdRef.current &&
                        window.electronAPI?.openaiAppendAudioChunk
                    ) {
                        try {
                            const base64 = await blobToBase64(event.data);
                            await window.electronAPI.openaiAppendAudioChunk({
                                sessionId: openaiSessionIdRef.current,
                                base64,
                                mimeType: event.data.type || 'audio/webm',
                            });
                        } catch (chunkError) {
                            console.error('Failed to append OpenAI audio chunk:', chunkError);
                        }
                    }
                }
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                if (recordedChunksRef.current.length === 0) return;
                const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                recordedChunksRef.current = [];

                if (!(provider === 'openai' && chatMode === 'realtime')) {
                    await addAttachmentFromBlob(blob, 'audio/webm', `recording-${Date.now()}.webm`);
                }
            };

            mediaRecorderRef.current = recorder;
            recorder.start(800);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start audio recording:', err);
        }
    };

    const handleSendClick = () => {
        if (!input.trim() && attachments.length === 0) return;
        onSend(input, attachments);
        setInput('');
        setAttachments([]);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragOver(false);
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        console.log('ChatInput: Attaching global capture-phase drag listeners');

        let dragCounter = 0;

        const handleWindowDragEnter = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
                if (Array.from(event.dataTransfer.types || []).includes('Files')) {
                    dragCounter += 1;
                    if (!isDragOver) {
                        setIsDragOver(true);
                    }
                }
            }
        };

        const handleWindowDragOver = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
                if (Array.from(event.dataTransfer.types || []).includes('Files') && !isDragOver) {
                    setIsDragOver(true);
                }
            }
        };

        const handleWindowDragLeave = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (Array.from(event.dataTransfer?.types || []).includes('Files')) {
                dragCounter = Math.max(dragCounter - 1, 0);
                if (dragCounter === 0) {
                    setIsDragOver(false);
                }
            }
        };

        const handleWindowDrop = async (event: DragEvent) => {
            console.log('Global drop detected (capture)', event.dataTransfer?.files);
            event.preventDefault();
            event.stopPropagation();

            const dt = event.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0) {
                return;
            }

            dragCounter = 0;
            setIsDragOver(false);
            await processFiles(dt.files as any);
        };

        // Use capture phase (true) to intercept events before they hit elements
        window.addEventListener('dragenter', handleWindowDragEnter, true);
        window.addEventListener('dragover', handleWindowDragOver, true);
        window.addEventListener('dragleave', handleWindowDragLeave, true);
        window.addEventListener('drop', handleWindowDrop, true);

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter, true);
            window.removeEventListener('dragover', handleWindowDragOver, true);
            window.removeEventListener('dragleave', handleWindowDragLeave, true);
            window.removeEventListener('drop', handleWindowDrop, true);
        };
    }, [isDragOver, processFiles]);

    return (
        <div className="flex-none p-4 bg-gray-900/95 backdrop-blur border-t border-astro-border relative z-10">
            {/* Decorative top glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-astro-primary/50 to-transparent"></div>

            <div className="max-w-4xl mx-auto flex flex-col gap-2">
                {/* Live Transcript Display */}
                {provider === 'openai' && chatMode === 'realtime' && liveTranscript && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-astro-dark border border-astro-primary/30 text-astro-primary text-xs font-mono animate-pulse mb-2">
                        <rux-icon icon="graphic-eq" size="small"></rux-icon>
                        <span>{liveTranscript}</span>
                    </div>
                )}

                {/* Attachment Preview Bar */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                        {attachments.map((att, index) => (
                            <div key={index} className="relative group flex-shrink-0">
                                {att.mimeType.startsWith('image/') ? (
                                    <img
                                        src={att.preview}
                                        alt="preview"
                                        className="h-12 w-12 object-cover rounded border border-astro-border shadow-lg"
                                    />
                                ) : (
                                    <div className="h-12 w-12 flex items-center justify-center bg-astro-dark rounded border border-astro-border shadow-lg">
                                        <span className="text-[9px] font-mono text-astro-off uppercase">
                                            {att.mimeType.split('/')[1] || 'FILE'}
                                        </span>
                                    </div>
                                )}
                                <button
                                    onClick={() => removeAttachment(index)}
                                    className="absolute -top-2 -right-2 bg-astro-critical text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-black/50"
                                    title="Remove attachment"
                                >
                                    <rux-icon icon="close" size="extra-small"></rux-icon>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Input Deck */}
                <div
                    className={`relative group bg-gray-800/50 rounded-xl border ${isDragOver ? 'border-astro-primary shadow-[0_0_20px_rgba(77,182,172,0.35)] bg-gray-800/80' : 'border-astro-border'} p-2 flex items-end gap-2 transition-all duration-300 focus-within:border-astro-primary/70 focus-within:shadow-[0_0_20px_rgba(77,182,172,0.1)] focus-within:bg-gray-800/80`}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                >

                    {isDragOver && (
                        <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-astro-primary/60 bg-astro-primary/10 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-astro-primary transition-opacity duration-200 animate-pulse px-6">
                            <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.35em] leading-none">
                                <rux-icon icon="cloud-upload" size="medium"></rux-icon>
                                <span>Drop to Attach</span>
                            </div>
                            <span className="text-[10px] font-mono tracking-[0.4em] opacity-80 whitespace-nowrap">Images · Video · Audio</span>
                        </div>
                    )}

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        multiple
                        accept="image/*,video/*,audio/*"
                        title="Attach media file"
                    />

                    {/* Left Actions */}
                    <div className="flex-none">
                        <rux-button
                            icon="attach-file"
                            size="small"
                            secondary
                            borderless
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            title="Attach File"
                            className="hover:text-astro-primary transition-colors"
                        ></rux-button>
                        <rux-button
                            icon="camera-alt"
                            size="small"
                            secondary
                            borderless
                            onClick={handleCaptureImage}
                            disabled={isLoading || chatMode !== 'realtime'}
                            title="Capture Image (Realtime Mode)"
                            className="hover:text-astro-primary transition-colors"
                        ></rux-button>
                    </div>

                    {/* Text Area */}
                    <div className="flex-1 min-w-0 py-1.5">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Enter command or message..."
                            className="w-full bg-transparent border-none text-white px-2 py-0 focus:ring-0 focus:outline-none resize-none leading-relaxed placeholder-gray-500 font-sans text-sm"
                            disabled={isLoading}
                            style={{ minHeight: '24px', maxHeight: '120px', height: '24px' }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = '24px';
                                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                            }}
                        />
                    </div>

                    {/* Right Actions */}
                    <div className="flex-none flex gap-2 items-center pb-0.5">
                        <rux-button
                            icon={isRecording ? "stop" : "mic"}
                            size="small"
                            secondary
                            borderless
                            className={isRecording ? "text-astro-critical animate-pulse" : "hover:text-white transition-colors"}
                            onClick={handleToggleRecording}
                            disabled={isLoading || chatMode !== 'realtime'}
                            title={chatMode !== 'realtime' ? "Enable Realtime Mode to Record" : "Toggle Voice"}
                        ></rux-button>

                        <div className="h-6 w-px bg-gray-700 mx-1"></div>

                        <rux-button
                            icon={isLoading ? "stop" : "send"}
                            size="small"
                            onClick={isLoading ? onStop : handleSendClick}
                            disabled={!input.trim() && attachments.length === 0 && !isLoading}
                            title="Execute"
                            className={isLoading ? "border-astro-critical text-astro-critical" : ""}
                        ></rux-button>
                    </div>
                </div>

                {/* Status Footer */}
                <div className="flex justify-between items-center px-2 mt-1 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-[10px] text-astro-primary font-mono tracking-wider uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]'}`}></span>
                        <span>{provider} :: {isLoading ? 'PROCESSING' : 'SYSTEM READY'}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">HAPA NODE v0.1.0</div>
                </div>
            </div>
        </div>
    );
};

// Memoize to prevent re-renders when parent state changes (like veoOptions with large base64 images)
export default React.memo(ChatInput);
