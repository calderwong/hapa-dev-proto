import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/Button';

interface ChatAttachmentPreview {
    mimeType: string;
    previewUrl: string;
    fileName?: string;
    dataUrl?: string;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    attachments?: ChatAttachmentPreview[];
    provider?: 'gemini' | 'openai' | 'llama';
    model?: string;
}

interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
}

interface Attachment {
    file: File;
    preview: string;
    base64: string;
    mimeType: string;
}

const GEMINI_MODEL_STORAGE_KEY = 'defaultGeminiModel';
const OPENAI_MODEL_STORAGE_KEY = 'defaultOpenAIModel';
const LLAMA_MODEL_STORAGE_KEY = 'defaultLlamaModel';
const PROVIDER_STORAGE_KEY = 'defaultChatProvider';

type ChatMode = 'request-response' | 'realtime';
const CHAT_MODE_STORAGE_KEY = 'defaultChatMode';
const CHAT_MESSAGES_STORAGE_KEY = 'chatMessages';
const CHAT_ARCHIVES_STORAGE_KEY = 'chatArchives';
const CHAT_THREAD_ID_STORAGE_KEY = 'currentChatThreadId';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const CHAT_IMAGE_CARD_STATE_STORAGE_PREFIX = 'chatImageCardState';

const formatProviderLabel = (value: 'gemini' | 'openai' | 'llama') => {
    if (value === 'gemini') return 'Gemini';
    if (value === 'openai') return 'OpenAI';
    return 'Local (llama.cpp)';
};

const Chat: React.FC = () => {
    const navigate = useNavigate();
    const [threadId] = useState<string>(() => {
        if (typeof window === 'undefined') {
            return `thread-${Date.now()}`;
        }
        const existing = window.localStorage.getItem(CHAT_THREAD_ID_STORAGE_KEY);
        if (existing && typeof existing === 'string') {
            return existing;
        }
        const next = `thread-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        window.localStorage.setItem(CHAT_THREAD_ID_STORAGE_KEY, next);
        return next;
    });
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [provider, setProvider] = useState<'gemini' | 'openai' | 'llama'>('gemini');
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
    const [openaiModels, setOpenaiModels] = useState<ModelInfo[]>([]);
    const [llamaModels, setLlamaModels] = useState<ModelInfo[]>([]);
    const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-pro');
    const [selectedOpenAIModel, setSelectedOpenAIModel] = useState('gpt-4.1-mini');
    const [selectedLlamaModel, setSelectedLlamaModel] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [imageCardState, setImageCardState] = useState<{
        [key: string]: { hasCard: boolean; lastCardId?: string };
    }>({});
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const assistantMessageIdRef = useRef<string | null>(null);
    const activeRequestIdRef = useRef<string | null>(null);
    const [chatMode, setChatMode] = useState<ChatMode>('request-response');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [liveTranscript, setLiveTranscript] = useState('');
    const openaiSessionIdRef = useRef<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load available models on mount
    useEffect(() => {
        const loadModels = async () => {
            if (window.electronAPI?.listGeminiModels) {
                const availableGeminiModels = await window.electronAPI.listGeminiModels();
                if (availableGeminiModels && availableGeminiModels.length > 0) {
                    setGeminiModels(availableGeminiModels);
                    const storedGeminiModel =
                        typeof window !== 'undefined'
                            ? window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY)
                            : null;
                    if (storedGeminiModel) {
                        const match = availableGeminiModels.find((model) => model.name === storedGeminiModel);
                        if (match) {
                            setSelectedGeminiModel(match.name);
                        } else {
                            setSelectedGeminiModel(availableGeminiModels[0].name);
                        }
                    } else {
                        setSelectedGeminiModel(availableGeminiModels[0].name);
                    }
                }
            }

            if (window.electronAPI?.listLlamaModels) {
                const availableLlamaModels = await window.electronAPI.listLlamaModels();
                if (availableLlamaModels && availableLlamaModels.length > 0) {
                    setLlamaModels(availableLlamaModels);
                    const storedLlamaModel =
                        typeof window !== 'undefined'
                            ? window.localStorage.getItem(LLAMA_MODEL_STORAGE_KEY)
                            : null;
                    if (storedLlamaModel) {
                        const match = availableLlamaModels.find((model) => model.name === storedLlamaModel);
                        if (match) {
                            setSelectedLlamaModel(match.name);
                        } else {
                            setSelectedLlamaModel(availableLlamaModels[0].name);
                        }
                    } else {
                        setSelectedLlamaModel(availableLlamaModels[0].name);
                    }
                }
            }

            if (window.electronAPI?.listOpenAIModels) {
                const availableOpenAIModels = await window.electronAPI.listOpenAIModels();
                if (availableOpenAIModels && availableOpenAIModels.length > 0) {
                    setOpenaiModels(availableOpenAIModels);
                    const storedOpenAIModel =
                        typeof window !== 'undefined'
                            ? window.localStorage.getItem(OPENAI_MODEL_STORAGE_KEY)
                            : null;
                    if (storedOpenAIModel) {
                        const match = availableOpenAIModels.find((model) => model.name === storedOpenAIModel);
                        if (match) {
                            setSelectedOpenAIModel(match.name);
                        } else {
                            setSelectedOpenAIModel(availableOpenAIModels[0].name);
                        }
                    } else {
                        setSelectedOpenAIModel(availableOpenAIModels[0].name);
                    }
                }
            }

            if (typeof window !== 'undefined') {
                const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY) as
                    | 'gemini'
                    | 'openai'
                    | 'llama'
                    | null;
                if (storedProvider === 'gemini' || storedProvider === 'openai' || storedProvider === 'llama') {
                    setProvider(storedProvider);
                }

                const storedMode = window.localStorage.getItem(CHAT_MODE_STORAGE_KEY) as ChatMode | null;
                if (storedMode === 'request-response' || storedMode === 'realtime') {
                    setChatMode(storedMode);
                }
            }
        };
        loadModels();
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newAttachments: Attachment[] = [];

            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];

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
                    mimeType: file.type
                });
            }

            setAttachments(prev => [...prev, ...newAttachments]);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const addAttachmentFromBlob = async (blob: Blob, mimeType: string, fileName: string) => {
        const file = new File([blob], fileName, { type: mimeType });
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve(base64Data);
            };
            reader.readAsDataURL(file);
        });

        const attachment: Attachment = {
            file,
            preview: URL.createObjectURL(file),
            base64,
            mimeType,
        };

        setAttachments((prev) => [...prev, attachment]);
    };

    const getAttachmentCardStateKey = (messageId: string, index: number) =>
        `att:${messageId}:${index}`;

    const getMarkdownCardStateKey = (messageId: string, src: string) =>
        `md:${messageId}:${src.slice(0, 64)}`;

    const handleOpenCardFromState = (cardId?: string) => {
        if (!cardId) {
            navigate('/cards');
            return;
        }
        navigate(`/cards?cardId=${encodeURIComponent(cardId)}`);
    };

    const createImageCard = async (params: {
        dataUrl: string;
        mimeType: string;
        source: 'attachment' | 'markdown';
        message: Message;
        alt?: string;
    }): Promise<string | null> => {
        if (
            typeof window === 'undefined' ||
            !window.electronAPI ||
            !window.electronAPI.p2pCreateCore ||
            !window.electronAPI.p2pAppend
        ) {
            console.warn('P2P API not available; cannot create Card');
            return null;
        }

        const createdAt = new Date().toISOString();
        const cardCoreName = `card-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        try {
            const coreInfo = await window.electronAPI.p2pCreateCore(cardCoreName);

            const cardRecord = {
                type: 'card',
                kind: 'image',
                id: cardCoreName,
                createdAt,
                threadId,
                messageId: params.message.id,
                role: params.message.role,
                source: params.source,
                provider: params.message.provider,
                model: params.message.model,
                alt: params.alt,
                image: {
                    mimeType: params.mimeType,
                    dataUrl: params.dataUrl,
                },
                core: {
                    name: cardCoreName,
                    key: coreInfo?.key,
                    discoveryKey: coreInfo?.discoveryKey,
                    length: coreInfo?.length,
                },
            };

            await window.electronAPI.p2pAppend({
                name: cardCoreName,
                data: JSON.stringify(cardRecord),
            });

            await window.electronAPI.p2pCreateCore(CARD_LIBRARY_CORE_NAME);
            const libraryEntry = {
                type: 'card-index',
                cardId: cardCoreName,
                createdAt,
                threadId,
                messageId: params.message.id,
                provider: params.message.provider,
                model: params.message.model,
                coreName: cardCoreName,
                coreKey: coreInfo?.key,
                coreDiscoveryKey: coreInfo?.discoveryKey,
                thumbnail: params.dataUrl,
            };

            await window.electronAPI.p2pAppend({
                name: CARD_LIBRARY_CORE_NAME,
                data: JSON.stringify(libraryEntry),
            });
            return cardCoreName;
        } catch (error) {
            console.error('Failed to create Card Hypercore:', error);
            return null;
        }
    };

    const handleAddCardFromAttachment = async (
        message: Message,
        att: ChatAttachmentPreview,
        attachmentIndex: number,
    ) => {
        if (!att.mimeType.startsWith('image/')) return;

        const stateKey = getAttachmentCardStateKey(message.id, attachmentIndex);
        const stateEntry = imageCardState[stateKey];
        const alreadyCarded = !!stateEntry?.hasCard;
        if (alreadyCarded) {
            const proceed = window.confirm(
                'A Card has already been created from this image. Creating another will make a duplicate Card. Continue?',
            );
            if (!proceed) {
                return;
            }
        }

        let dataUrl = att.dataUrl;
        if (!dataUrl && att.previewUrl && att.previewUrl.startsWith('data:image/')) {
            dataUrl = att.previewUrl;
        }
        if (!dataUrl) {
            console.warn('No data URL available for image attachment; cannot create Card');
            return;
        }

        const cardId = await createImageCard({
            dataUrl,
            mimeType: att.mimeType,
            source: 'attachment',
            message,
            alt: att.fileName,
        });

        if (cardId) {
            setImageCardState((prev) => ({
                ...prev,
                [stateKey]: { hasCard: true, lastCardId: cardId },
            }));
        }
    };

    const handleAddCardFromMarkdownImage = async (
        message: Message,
        src?: string,
        alt?: string,
        stateKeyOverride?: string,
    ) => {
        if (!src || !src.startsWith('data:image/')) {
            return;
        }

        const stateKey = stateKeyOverride || getMarkdownCardStateKey(message.id, src);
        const stateEntry = imageCardState[stateKey];
        const alreadyCarded = !!stateEntry?.hasCard;
        if (alreadyCarded) {
            const proceed = window.confirm(
                'A Card has already been created from this image. Creating another will make a duplicate Card. Continue?',
            );
            if (!proceed) {
                return;
            }
        }

        let mimeType = 'image/png';
        const match = /^data:(image\/[^;]+);base64,/i.exec(src);
        if (match && match[1]) {
            mimeType = match[1];
        }

        const cardId = await createImageCard({
            dataUrl: src,
            mimeType,
            source: 'markdown',
            message,
            alt,
        });

        if (cardId) {
            setImageCardState((prev) => ({
                ...prev,
                [stateKey]: { hasCard: true, lastCardId: cardId },
            }));
        }
    };

    const handleStop = () => {
        if (!isLoading) return;
        assistantMessageIdRef.current = null;
        activeRequestIdRef.current = null;
        setIsLoading(false);
    };

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

    const handleToggleRecording = async () => {
        if (chatMode !== 'realtime') {
            return;
        }

        if (isRecording) {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== 'inactive') {
                recorder.stop();
            }
            setIsRecording(false);

            if (
                provider === 'openai' &&
                window.electronAPI?.openaiStopAudioSession &&
                openaiSessionIdRef.current
            ) {
                try {
                    const result = await window.electronAPI.openaiStopAudioSession({
                        sessionId: openaiSessionIdRef.current,
                    });
                    const finalText = (result.fullText || '').trim();
                    if (finalText) {
                        setLiveTranscript(finalText);
                        setInput((prev) => (prev ? `${prev} ${finalText}` : finalText));
                    }
                } catch (error) {
                    console.error('Failed to stop OpenAI audio session:', error);
                } finally {
                    openaiSessionIdRef.current = null;
                }
            }

            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('getUserMedia is not supported in this environment.');
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
            // Use a small timeslice so dataavailable fires periodically
            recorder.start(800);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start audio recording:', err);
        }
    };

    const handleCaptureImage = async () => {
        if (chatMode !== 'realtime') {
            return;
        }

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

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const currentAttachments = [...attachments];

        let modelName: string | undefined;
        if (provider === 'gemini') {
            modelName = selectedGeminiModel;
        } else if (provider === 'openai') {
            modelName = selectedOpenAIModel;
        } else {
            modelName = selectedLlamaModel || (llamaModels[0]?.name ?? undefined);
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            attachments: currentAttachments.map((att) => ({
                mimeType: att.mimeType,
                previewUrl: att.preview,
                fileName: att.file?.name,
                dataUrl: `data:${att.mimeType};base64,${att.base64}`,
            })),
            provider,
            model: modelName,
        };
        const assistantId = `${Date.now()}-assistant`;
        const assistantMessage: Message = {
            id: assistantId,
            role: 'model',
            content: '',
            provider,
            model: modelName,
        };
        assistantMessageIdRef.current = assistantId;

        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeRequestIdRef.current = requestId;

        const history = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInput('');
        setAttachments([]);
        setIsLoading(true);

        try {
            if (window.electronAPI) {
                const payload = {
                    message: userMessage.content,
                    history,
                    model: modelName,
                    attachments: currentAttachments.map(att => ({
                        mimeType: att.mimeType,
                        data: att.base64
                    }))
                };

                let response: string;
                if (provider === 'gemini') {
                    response = await window.electronAPI.chatWithGemini(payload);
                } else if (provider === 'openai') {
                    response = await window.electronAPI.chatWithOpenAI(payload);
                } else {
                    response = await window.electronAPI.chatWithLlama(payload);
                }

                if (activeRequestIdRef.current !== requestId) {
                    return;
                }

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId ? { ...m, content: response } : m,
                    ),
                );
            } else {
                // Fallback for browser dev mode (mock)
                setTimeout(() => {
                    if (activeRequestIdRef.current !== requestId) {
                        return;
                    }
                    const mockText =
                        provider === 'gemini'
                            ? "I'm a mock Gemini response. Please run in Electron to use real API."
                            : provider === 'openai'
                            ? "I'm a mock OpenAI response. Please run in Electron to use real API."
                            : "I'm a mock Llama (local) response. Please run in Electron with llama.cpp server to use real API.";
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantId ? { ...m, content: mockText } : m,
                        ),
                    );
                }, 1000);
            }
        } catch (error: any) {
            console.error(error);
            if (activeRequestIdRef.current !== requestId) {
                return;
            }
            const errorText = `Error: ${error.message || 'Failed to get response'}`;
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId ? { ...m, content: errorText } : m,
                ),
            );
        } finally {
            if (activeRequestIdRef.current === requestId) {
                assistantMessageIdRef.current = null;
                activeRequestIdRef.current = null;
                setIsLoading(false);
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleArchive = async () => {
        if (messages.length === 0) return;

        const snapshotMessages = messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            provider: m.provider,
            model: m.model,
        }));

        const archiveId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const modelSnapshot =
            provider === 'gemini'
                ? selectedGeminiModel
                : provider === 'openai'
                ? selectedOpenAIModel
                : selectedLlamaModel || (llamaModels[0]?.name ?? '');

        const payload = {
            id: archiveId,
            archivedAt: new Date().toISOString(),
            providerSnapshot: provider,
            modelSnapshot,
            messages: snapshotMessages,
        };

        try {
            if (window.electronAPI?.p2pCreateCore && window.electronAPI?.p2pAppend) {
                await window.electronAPI.p2pCreateCore('chat-archives');
                await window.electronAPI.p2pAppend({
                    name: 'chat-archives',
                    data: JSON.stringify(payload),
                });
            }

            if (typeof window !== 'undefined') {
                try {
                    const raw = window.localStorage.getItem(CHAT_ARCHIVES_STORAGE_KEY);
                    const existing = raw ? JSON.parse(raw) : [];
                    const next = Array.isArray(existing) ? [...existing, payload] : [payload];
                    window.localStorage.setItem(
                        CHAT_ARCHIVES_STORAGE_KEY,
                        JSON.stringify(next),
                    );
                } catch (storageError) {
                    console.error('Failed to store chat archive locally:', storageError);
                }

                window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
                const imageStateKey = `${CHAT_IMAGE_CARD_STATE_STORAGE_PREFIX}:${threadId}`;
                window.localStorage.removeItem(imageStateKey);
            }

            setMessages([]);
            setAttachments([]);
            setPreviewImage(null);
            setImageCardState({});
            assistantMessageIdRef.current = null;
            activeRequestIdRef.current = null;
        } catch (error) {
            console.error('Failed to archive chat:', error);
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newAttachments: Attachment[] = [];

            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const file = e.dataTransfer.files[i];

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
                    mimeType: file.type
                });
            }

            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const raw = e.target.value as 'gemini' | 'openai' | 'llama';
        const value: 'gemini' | 'openai' | 'llama' =
            raw === 'openai' ? 'openai' : raw === 'llama' ? 'llama' : 'gemini';

        setProvider(value);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PROVIDER_STORAGE_KEY, value);
        }
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (provider === 'gemini') {
            setSelectedGeminiModel(value);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, value);
            }
        } else if (provider === 'openai') {
            setSelectedOpenAIModel(value);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(OPENAI_MODEL_STORAGE_KEY, value);
            }
        } else {
            setSelectedLlamaModel(value);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(LLAMA_MODEL_STORAGE_KEY, value);
            }
        }
    };

    const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value === 'realtime' ? 'realtime' : 'request-response';
        setChatMode(value);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, value);
        }
    };

    const activeModels =
        provider === 'gemini' ? geminiModels : provider === 'openai' ? openaiModels : llamaModels;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.electronAPI || !window.electronAPI.onChatStream) return;

        const handler = (payload: { provider: 'gemini' | 'openai' | 'llama'; delta: string; done?: boolean }) => {
            if (!payload) return;

            if (payload.done) {
                assistantMessageIdRef.current = null;
                activeRequestIdRef.current = null;
                setIsLoading(false);
                return;
            }

            if (!payload.delta) {
                return;
            }

            const assistantId = assistantMessageIdRef.current;
            if (!assistantId) {
                return;
            }

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + payload.delta } : m,
                ),
            );
        };

        window.electronAPI.onChatStream(handler as any);
    }, []);

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

        window.electronAPI.onAudioTranscriptStream(handler as any);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;

            const restored: Message[] = parsed.map((m: any) => ({
                id: typeof m.id === 'string' ? m.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: m.role === 'model' ? 'model' : 'user',
                content: typeof m.content === 'string' ? m.content : '',
                provider:
                    m.provider === 'gemini' || m.provider === 'openai' || m.provider === 'llama'
                        ? m.provider
                        : undefined,
                model: typeof m.model === 'string' ? m.model : undefined,
            }));

            if (restored.length > 0) {
                setMessages(restored);
            }
        } catch (err) {
            console.error('Failed to restore chat messages from storage:', err);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handle = window.setTimeout(() => {
            try {
                const serializable = messages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    provider: m.provider,
                    model: m.model,
                }));
                window.localStorage.setItem(
                    CHAT_MESSAGES_STORAGE_KEY,
                    JSON.stringify(serializable),
                );
            } catch (err) {
                console.error('Failed to persist chat messages to storage:', err);
            }
        }, 400);

        return () => {
            window.clearTimeout(handle);
        };
    }, [messages]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const storageKey = `${CHAT_IMAGE_CARD_STATE_STORAGE_PREFIX}:${threadId}`;
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;

            const next: {
                [key: string]: { hasCard: boolean; lastCardId?: string };
            } = {};

            for (const key of Object.keys(parsed)) {
                const value: any = (parsed as any)[key];
                if (typeof value === 'boolean') {
                    if (value) {
                        next[key] = { hasCard: true };
                    }
                } else if (value && typeof value === 'object') {
                    const hasCard = !!value.hasCard || typeof value.lastCardId === 'string';
                    if (!hasCard) continue;
                    next[key] = {
                        hasCard,
                        lastCardId:
                            typeof value.lastCardId === 'string' ? (value.lastCardId as string) : undefined,
                    };
                }
            }

            if (Object.keys(next).length > 0) {
                setImageCardState(next);
            }
        } catch (err) {
            console.error('Failed to restore image card state from storage:', err);
        }
    }, [threadId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const storageKey = `${CHAT_IMAGE_CARD_STATE_STORAGE_PREFIX}:${threadId}`;
            window.localStorage.setItem(storageKey, JSON.stringify(imageCardState));
        } catch (err) {
            console.error('Failed to persist image card state to storage:', err);
        }
    }, [threadId, imageCardState]);

    return (
        <div
            className="flex flex-col h-full bg-gray-900 text-white relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-2xl pointer-events-none">
                    <div className="text-2xl font-semibold text-blue-100">Drop files here</div>
                </div>
            )}
            <header className="p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold">Chat</h2>
          <div className="flex items-center gap-3">
            <select
              value={provider}
              onChange={handleProviderChange}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              aria-label="Model provider"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="llama">Local (llama.cpp)</option>
            </select>
            {activeModels.length > 0 && (
              <select
                value={
                  provider === 'gemini'
                    ? selectedGeminiModel
                    : provider === 'openai'
                    ? selectedOpenAIModel
                    : selectedLlamaModel || (llamaModels[0]?.name ?? '')
                }
                onChange={handleModelChange}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                aria-label="Model"
              >
                {activeModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            )}
            <select
              value={chatMode}
              onChange={handleModeChange}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              aria-label="Chat mode"
            >
              <option value="request-response">Request/Response</option>
              <option value="realtime">Realtime (preview)</option>
            </select>
            <SecondaryButton
              type="button"
              onClick={handleArchive}
              disabled={messages.length === 0 || isLoading}
              rounded="full"
              className="text-xs px-3 py-1"
            >
              Archive chat
            </SecondaryButton>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-xl">Welcome to Hapa AI</p>
              <p className="text-sm mt-2">Configure your API keys in Settings to start chatting.</p>
              {(provider === 'gemini' ? selectedGeminiModel : selectedOpenAIModel) && (
                <p className="text-xs mt-4 text-gray-600">
                  Using {provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} model: {' '}
                  {provider === 'gemini' ? selectedGeminiModel : selectedOpenAIModel}
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100 border border-gray-700'
                  }`}
                >
                  {/* ... (keep existing interfaces) */}
                  {/* ... (inside component) */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att, index) => {
                        const stateKey = getAttachmentCardStateKey(msg.id, index);
                        const stateEntry = imageCardState[stateKey];
                        const alreadyCarded = !!stateEntry?.hasCard;
                        return (
                          <div key={index} className="relative flex flex-col items-start">
                            {att.mimeType.startsWith('image/') ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    src: att.previewUrl,
                                    alt: att.fileName || `attachment-${index + 1}`,
                                  })
                                }
                                className="block focus:outline-none"
                              >
                                <img
                                  src={att.previewUrl}
                                  alt={att.fileName || `attachment-${index + 1}`}
                                  className="max-h-32 rounded-lg border border-gray-700 object-contain bg-black/20 cursor-pointer"
                                />
                              </button>
                            ) : (
                              <div className="px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-xs">
                                <span className="font-mono break-all">
                                  {att.fileName || `Attachment ${index + 1}`}
                                </span>
                                <span className="block text-[10px] text-gray-300 mt-0.5">
                                  {att.mimeType}
                                </span>
                              </div>
                            )}
                            {att.mimeType.startsWith('image/') && (
                              <div className="mt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddCardFromAttachment(msg, att, index)}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full border border-purple-500 text-[10px] text-purple-200 hover:bg-purple-500/10"
                                  title={
                                    alreadyCarded
                                      ? 'A Card already exists for this image; click to create another.'
                                      : 'Save this image as a Card'
                                  }
                                >
                                  {alreadyCarded ? 'Add another Card' : 'Add to Card Stock'}
                                </button>
                                {alreadyCarded && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCardFromState(stateEntry?.lastCardId)}
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 hover:bg-purple-500/30"
                                      title="Open this Card in the Card Library"
                                    >
                                      Card created
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCardFromState(stateEntry?.lastCardId)}
                                      className="p-1 rounded-full border border-purple-500/60 text-purple-200 hover:bg-purple-500/20"
                                      aria-label="Open this Card in the Card Library"
                                      title="Open this Card in the Card Library"
                                    >
                                      <svg
                                        className="w-3 h-3"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          d="M7 5H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M9 11L17 3"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M11 3H17V9"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {msg.role === 'model' && msg.provider && msg.model && (
                    <p className="text-[10px] text-gray-400 mb-1">
                      {formatProviderLabel(msg.provider)} · {msg.model}
                    </p>
                  )}
                  <div className="prose prose-invert max-w-none break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      urlTransform={(uri) =>
                        uri && uri.startsWith('data:') ? uri : uri
                      }
                      components={{
                        img: ({ node, ...props }) => {
                          const src = (props as any).src as string | undefined;
                          const alt = (props as any).alt as string | undefined;
                          const isInlineDataImage =
                            typeof src === 'string' && src.startsWith('data:image/');
                          const stateKey =
                            isInlineDataImage && src ? getMarkdownCardStateKey(msg.id, src) : undefined;
                          const stateEntry = stateKey ? imageCardState[stateKey] : undefined;
                          const alreadyCarded = !!stateEntry?.hasCard;
                          return (
                            <div className="inline-flex flex-col max-w-full">
                              <img
                                {...props}
                                className="max-w-full rounded-lg my-2"
                              />
                              {isInlineDataImage && (
                                <div className="self-start mt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddCardFromMarkdownImage(msg, src, alt, stateKey)
                                    }
                                    className="inline-flex items-center px-2 py-0.5 rounded-full border border-purple-500 text-[10px] text-purple-200 hover:bg-purple-500/10"
                                    title={
                                      alreadyCarded
                                        ? 'A Card already exists for this image; click to create another.'
                                        : 'Save this image as a Card'
                                    }
                                  >
                                    {alreadyCarded ? 'Add another Card' : 'Add to Card Stock'}
                                  </button>
                                  {alreadyCarded && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCardFromState(stateEntry?.lastCardId)}
                                        className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 hover:bg-purple-500/30"
                                        title="Open this Card in the Card Library"
                                      >
                                        Card created
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCardFromState(stateEntry?.lastCardId)}
                                        className="p-1 rounded-full border border-purple-500/60 text-purple-200 hover:bg-purple-500/20"
                                        aria-label="Open this Card in the Card Library"
                                        title="Open this Card in the Card Library"
                                      >
                                        <svg
                                          className="w-3 h-3"
                                          viewBox="0 0 20 20"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path
                                            d="M7 5H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M9 11L17 3"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M11 3H17V9"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        },
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="text-blue-400 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p {...props} className="mb-2 last:mb-0" />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul {...props} className="list-disc pl-4 mb-2" />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol {...props} className="list-decimal pl-4 mb-2" />
                        ),
                        code: ({ node, inline, className, children, ...props }: any) => {
                          return inline ? (
                            <code
                              className="bg-gray-700 px-1 py-0.5 rounded text-sm"
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <code
                              className="block bg-gray-900 p-2 rounded text-sm overflow-x-auto my-2"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800/50 backdrop-blur">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {provider === 'openai' && chatMode === 'realtime' && liveTranscript && (
            <div className="text-xs text-gray-300 italic px-1">
              Live transcript: {liveTranscript}
            </div>
          )}
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={isLoading || chatMode !== 'realtime'}
            className={`p-2 rounded-full border ${
              chatMode !== 'realtime'
                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                : isRecording
                ? 'border-red-500 text-red-400 bg-red-500/10'
                : 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400'
            }`}
            title={
              chatMode !== 'realtime'
                ? 'Enable Realtime mode to record audio'
                : isRecording
                ? 'Stop recording'
                : 'Start recording'
            }
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
              <path d="M7 11a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A7 7 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleCaptureImage}
            disabled={isLoading || chatMode !== 'realtime'}
            className="p-2 rounded-full border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 disabled:border-gray-700 disabled:text-gray-600 disabled:cursor-not-allowed"
            title={
              chatMode !== 'realtime'
                ? 'Enable Realtime mode to capture camera image'
                : 'Capture image from camera'
            }
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
              <circle cx="12" cy="12" r="3.5" />
              <path d="M9 5l1.5-2h3L15 5" />
            </svg>
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              aria-label="Chat message"
              className="w-full bg-gray-900 border border-gray-600 rounded-full px-6 py-3 pl-12 focus:outline-none focus:border-blue-500 transition-colors pr-12 text-white placeholder-gray-500"
              disabled={isLoading}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept="image/*,video/*,audio/*"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors"
              disabled={isLoading}
              title="Attach files"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </button>
            {attachments.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full px-4">
                <div className="flex gap-2 overflow-x-auto py-2">
                  {attachments.map((att, index) => (
                    <div key={index} className="relative group flex-shrink-0">
                      {att.mimeType.startsWith('image/') ? (
                        <img
                          src={att.preview}
                          alt="preview"
                          className="h-16 w-16 object-cover rounded-lg border border-gray-600"
                        />
                      ) : (
                        <div className="h-16 w-16 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-600">
                          <span className="text-xs text-gray-400 uppercase">
                            {att.mimeType.split('/')[0]}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove attachment"
                        title="Remove attachment"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <PrimaryButton
            type="button"
            onClick={isLoading ? handleStop : handleSend}
            rounded="full"
            className="ml-3"
          >
            {isLoading ? 'Stop' : 'Send'}
          </PrimaryButton>
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-gray-900 text-white rounded-full p-1 shadow-lg border border-gray-700 hover:bg-red-600"
              aria-label="Close image preview"
            >
              ✕
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl border border-gray-800"
            />
            {previewImage.alt && (
              <div className="mt-2 text-xs text-gray-300 break-all text-center">
                {previewImage.alt}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
    );
};

export default Chat;
