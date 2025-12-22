// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';

export interface Attachment {
    file: File;
    preview: string;
    base64: string;
    mimeType: string;
    // Card source info (if attachment came from card library)
    fromCard?: {
        cardId: string;
        coreName: string;
        mediaKind: 'image' | 'video' | 'audio';
        name?: string;
    };
}

// Attached message card reference for context
export interface AttachedMessageCard {
    cardId: string;
    coreName: string;
    role: 'user' | 'model';
    preview: string; // Truncated content
    attachmentCount?: number;
    thumbnail?: string;
}

interface ChatInputProps {
    onSend: (text: string, attachments: Attachment[], attachedMessageCards?: AttachedMessageCard[]) => void;
    isLoading: boolean;
    chatMode: 'request-response' | 'realtime';
    provider: 'gemini' | 'openai' | 'llama';
    onStop: () => void;
    attachments: Attachment[];
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
    attachedMessageCards?: AttachedMessageCard[];
    setAttachedMessageCards?: React.Dispatch<React.SetStateAction<AttachedMessageCard[]>>;
    onOpenCardPicker?: () => void; // Opens card library picker
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
    attachedMessageCards = [],
    setAttachedMessageCards,
    onOpenCardPicker,
}) => {
    const [input, setInput] = useState('');
    // const [attachments, setAttachments] = useState<Attachment[]>([]); // Lifted up
    const [isRecording, setIsRecording] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isDraggingMessageCard, setIsDraggingMessageCard] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachMenuRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const openaiSessionIdRef = useRef<string | null>(null);
    const attachmentsRef = useRef<Attachment[]>([]);
    attachmentsRef.current = attachments;

    const revokePreviewUrl = (url?: string) => {
        if (!url) return;
        if (!url.startsWith('blob:')) return;
        try {
            URL.revokeObjectURL(url);
        } catch {
        }
    };

    useEffect(() => {
        return () => {
            for (const att of attachmentsRef.current) {
                revokePreviewUrl(att.preview);
            }
        };
    }, []);
    
    // Close attach menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
                setShowAttachMenu(false);
            }
        };
        if (showAttachMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showAttachMenu]);

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
        setAttachments((prev) => {
            const next = prev.filter((_, i) => i !== index);
            const removed = prev[index];
            revokePreviewUrl(removed?.preview);
            return next;
        });
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
        if (!input.trim() && attachments.length === 0 && attachedMessageCards.length === 0) return;
        onSend(input, attachments, attachedMessageCards.length > 0 ? attachedMessageCards : undefined);
        setInput('');
        // Clear attached message cards after sending
        if (setAttachedMessageCards && attachedMessageCards.length > 0) {
            setAttachedMessageCards([]);
        }
        for (const att of attachments) {
            revokePreviewUrl(att.preview);
        }
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
                const types = Array.from(event.dataTransfer.types || []);
                // Check for card drag (message card or image card with JSON)
                const isCardDrag = types.includes('application/x-message-card') || types.includes('application/json');
                const isFileDrag = types.includes('Files');
                
                if (isCardDrag || isFileDrag) {
                    dragCounter += 1;
                    if (isCardDrag) {
                        setIsDraggingMessageCard(true);
                    } else {
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
                // No state changes here - just maintain drop effect
                // State is already set by dragenter
            }
        };

        const handleWindowDragLeave = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const types = Array.from(event.dataTransfer?.types || []);
            const isCardDrag = types.includes('application/x-message-card') || types.includes('application/json');
            const isFileDrag = types.includes('Files');
            
            if (isCardDrag || isFileDrag) {
                dragCounter = Math.max(dragCounter - 1, 0);
                if (dragCounter === 0) {
                    setIsDragOver(false);
                    setIsDraggingMessageCard(false);
                }
            }
        };

        const handleWindowDrop = async (event: DragEvent) => {
            console.log('Global drop detected (capture)', event.dataTransfer?.files);
            event.preventDefault();
            event.stopPropagation();

            const dt = event.dataTransfer;
            if (!dt) return;
            
            dragCounter = 0;
            setIsDragOver(false);
            setIsDraggingMessageCard(false);
            
            // Check for message card drop - could have both message context AND image data
            const msgCardData = dt.getData('application/x-message-card');
            const jsonData = dt.getData('application/json');
            
            // If it has image data (from message card with thumbnail or image card), add as attachment
            if (jsonData) {
                try {
                    const cardData = JSON.parse(jsonData);
                    const imageUrl = cardData.image?.dataUrl || cardData.thumbnail;
                    
                    if (imageUrl && imageUrl.startsWith('data:')) {
                        // Extract base64 and create attachment (like library method)
                        const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (base64Match) {
                            const mimeType = base64Match[1];
                            const base64 = base64Match[2];
                            const file = new File(
                                [Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
                                cardData.name || `card-${cardData.cardId || 'image'}`,
                                { type: mimeType }
                            );
                            
                            const newAttachment: Attachment = {
                                file,
                                preview: imageUrl,
                                base64,
                                mimeType,
                                fromCard: cardData.cardId ? {
                                    cardId: cardData.cardId,
                                    coreName: cardData.coreName,
                                    mediaKind: cardData.mediaKind || 'image',
                                    name: cardData.name,
                                } : undefined,
                            };
                            
                            setAttachments(prev => [...prev, newAttachment]);
                            console.log('Added card image as attachment:', newAttachment.mimeType);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse card JSON data', e);
                }
            }
            
            // If it's just a message card (for context reference, no image)
            if (msgCardData && setAttachedMessageCards && !jsonData) {
                try {
                    const card: AttachedMessageCard = JSON.parse(msgCardData);
                    // Avoid duplicates
                    setAttachedMessageCards(prev => {
                        if (prev.some(c => c.cardId === card.cardId)) return prev;
                        return [...prev, card];
                    });
                    return;
                } catch (e) {
                    console.error('Failed to parse message card data', e);
                }
            }
            
            // Handle file drops
            if (dt.files && dt.files.length > 0) {
                await processFiles(dt.files as any);
            }
        };

        // Clipboard paste handler for images
        const handleWindowPaste = async (event: ClipboardEvent) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return;
            
            const items = clipboardData.items;
            const imageItems: DataTransferItem[] = [];
            
            // Check for image items in clipboard
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    imageItems.push(item);
                }
            }
            
            // If no images, let the default paste behavior handle it
            if (imageItems.length === 0) return;
            
            // Prevent default paste (we're handling images)
            event.preventDefault();
            
            // Process each image from clipboard
            for (const item of imageItems) {
                const blob = item.getAsFile();
                if (blob) {
                    // Generate a filename based on timestamp
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const extension = item.type.split('/')[1] || 'png';
                    const fileName = `clipboard-${timestamp}.${extension}`;
                    
                    await addAttachmentFromBlob(blob, item.type, fileName);
                }
            }
        };

        // Use capture phase (true) to intercept events before they hit elements
        window.addEventListener('dragenter', handleWindowDragEnter, true);
        window.addEventListener('dragover', handleWindowDragOver, true);
        window.addEventListener('dragleave', handleWindowDragLeave, true);
        window.addEventListener('drop', handleWindowDrop, true);
        window.addEventListener('paste', handleWindowPaste, true);

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter, true);
            window.removeEventListener('dragover', handleWindowDragOver, true);
            window.removeEventListener('dragleave', handleWindowDragLeave, true);
            window.removeEventListener('drop', handleWindowDrop, true);
            window.removeEventListener('paste', handleWindowPaste, true);
        };
    }, [isDragOver, processFiles, addAttachmentFromBlob]);

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

                {/* Attached Message Cards - Context Reference */}
                {(attachedMessageCards.length > 0 || isDraggingMessageCard) && (
                    <div className={`mb-2 p-2 rounded-lg border-2 transition-all duration-300 ${
                        isDraggingMessageCard 
                            ? 'border-purple-400 bg-purple-500/10 border-dashed shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                            : 'border-purple-500/50 bg-gradient-to-r from-purple-900/30 to-gray-900/50'
                    } ${attachedMessageCards.length > 0 ? 'animate-[contextGlow_2s_ease-in-out_infinite]' : ''}`}
                    style={{
                        '--context-glow-color': 'rgba(168,85,247,0.2)',
                    } as React.CSSProperties}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <rux-icon icon="chat" size="12px" className="text-purple-400"></rux-icon>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                                {isDraggingMessageCard ? 'Drop to Attach Context' : 'Context Attached'}
                            </span>
                            {attachedMessageCards.length > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/30 rounded text-purple-300">
                                    {attachedMessageCards.length}
                                </span>
                            )}
                        </div>
                        {attachedMessageCards.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {attachedMessageCards.map((card) => (
                                    <div 
                                        key={card.cardId}
                                        className="group flex items-center gap-2 px-2 py-1.5 bg-gray-800/60 rounded border border-purple-500/30 hover:border-purple-400 transition-all"
                                    >
                                        <rux-icon 
                                            icon={card.role === 'user' ? 'person' : 'smart-toy'} 
                                            size="12px" 
                                            className={card.role === 'user' ? 'text-cyan-400' : 'text-purple-400'}
                                        ></rux-icon>
                                        <span className="text-[10px] text-gray-300 max-w-[150px] truncate">
                                            {card.preview}
                                        </span>
                                        {(card.attachmentCount || 0) > 0 && (
                                            <span className="text-[8px] px-1 py-0.5 bg-gray-700 rounded text-gray-400">
                                                +{card.attachmentCount}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (setAttachedMessageCards) {
                                                    setAttachedMessageCards(prev => prev.filter(c => c.cardId !== card.cardId));
                                                }
                                            }}
                                            className="ml-1 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove context"
                                        >
                                            <rux-icon icon="close" size="12px"></rux-icon>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isDraggingMessageCard && attachedMessageCards.length === 0 && (
                            <div className="text-center py-2 text-[10px] text-purple-400/70">
                                Drop message card here to reference in your prompt
                            </div>
                        )}
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
                                        className={`h-12 w-12 object-cover rounded shadow-lg ${
                                            att.fromCard 
                                                ? 'border-2 border-purple-500/70 ring-1 ring-purple-500/30' 
                                                : 'border border-astro-border'
                                        }`}
                                    />
                                ) : (
                                    <div className={`h-12 w-12 flex items-center justify-center bg-astro-dark rounded shadow-lg ${
                                        att.fromCard 
                                            ? 'border-2 border-purple-500/70 ring-1 ring-purple-500/30' 
                                            : 'border border-astro-border'
                                    }`}>
                                        <span className="text-[9px] font-mono text-astro-off uppercase">
                                            {att.mimeType.split('/')[1] || 'FILE'}
                                        </span>
                                    </div>
                                )}
                                {/* Card source badge */}
                                {att.fromCard && (
                                    <div className="absolute -bottom-1 -left-1 bg-purple-600 rounded-full p-0.5 shadow-sm border border-purple-400/50" title={`From card: ${att.fromCard.name || att.fromCard.cardId}`}>
                                        <rux-icon icon="photo-library" size="10px" className="text-white"></rux-icon>
                                    </div>
                                )}
                                {/* Upload badge for non-card attachments */}
                                {!att.fromCard && (
                                    <div className="absolute -bottom-1 -left-1 bg-cyan-600 rounded-full p-0.5 shadow-sm border border-cyan-400/50" title="Uploaded file">
                                        <rux-icon icon="cloud-upload" size="10px" className="text-white"></rux-icon>
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
                    <div className="flex-none flex items-center">
                        {/* Attachment Button with Dropdown */}
                        <div className="relative" ref={attachMenuRef}>
                            <rux-button
                                icon="attach-file"
                                size="small"
                                secondary
                                borderless
                                onClick={() => setShowAttachMenu(!showAttachMenu)}
                                disabled={isLoading}
                                title="Attach Media"
                                className="hover:text-astro-primary transition-colors"
                            ></rux-button>
                            
                            {/* Attachment Menu Dropdown */}
                            {showAttachMenu && (
                                <div 
                                    className="absolute bottom-full left-0 mb-2 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[200px]"
                                    style={{ backgroundColor: '#1b2d3e', border: '1px solid #2b4a63' }}
                                >
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setShowAttachMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors"
                                        style={{ color: '#ffffff', backgroundColor: 'transparent' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(43, 74, 99, 0.5)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <rux-icon icon="folder-open" size="small" style={{ color: '#22d3ee' }}></rux-icon>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#ffffff' }}>Upload File</div>
                                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>From your device</div>
                                        </div>
                                    </button>
                                    {onOpenCardPicker && (
                                        <button
                                            onClick={() => {
                                                onOpenCardPicker();
                                                setShowAttachMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors"
                                            style={{ color: '#ffffff', backgroundColor: 'transparent', borderTop: '1px solid #2b4a63' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(43, 74, 99, 0.5)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <rux-icon icon="photo-library" size="small" style={{ color: '#a855f7' }}></rux-icon>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#ffffff' }}>From Library</div>
                                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>Select a card</div>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
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
