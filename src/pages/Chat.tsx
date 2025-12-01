
// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { ChatInput, type Attachment } from '../components/ChatInput';

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
  metrics?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
}

const ElapsedTime: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span>{(elapsed / 1000).toFixed(1)}s</span>
  );
};



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

  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'llama'>('gemini');
  const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
  const [openaiModels, setOpenaiModels] = useState<ModelInfo[]>([]);
  const [llamaModels, setLlamaModels] = useState<ModelInfo[]>([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-pro');
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState('gpt-4.1-mini');
  const [selectedLlamaModel, setSelectedLlamaModel] = useState('');

  const [imageCardState, setImageCardState] = useState<{
    [key: string]: { hasCard: boolean; lastCardId?: string };
  }>({});
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const assistantMessageIdRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('request-response');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const loadProfile = async () => {
    if (window.electronAPI?.getProfile) {
      const profile = await window.electronAPI.getProfile();
      if (profile?.avatarUrl) {
        setUserAvatar(profile.avatarUrl);
      }
    }
  };

  useEffect(() => {
    loadProfile();
    const handleUpdate = () => loadProfile();
    window.addEventListener('user-profile-update', handleUpdate);
    return () => window.removeEventListener('user-profile-update', handleUpdate);
  }, []);



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



  const handleStop = () => {
    if (!isLoading) return;
    assistantMessageIdRef.current = null;
    activeRequestIdRef.current = null;
    setIsLoading(false);
  };

  const handleSend = async (text: string, currentAttachments: Attachment[]) => {
    if (!text.trim() && currentAttachments.length === 0) return;
    if (isLoading) return;

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
      content: text,
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
    const startTime = Date.now();
    startTimeRef.current = startTime;

    const assistantMessage: Message = {
      id: assistantId,
      role: 'model',
      content: '',
      provider,
      model: modelName,
      metrics: { startTime }
    };
    assistantMessageIdRef.current = assistantId;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestIdRef.current = requestId;

    console.log('Sending message with model:', modelName, 'Provider:', provider);

    const history = [...messages, userMessage]
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
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

        let result: { content: string; model: string; provider: string };
        if (provider === 'gemini') {
          result = await window.electronAPI.chatWithGemini(payload);
        } else if (provider === 'openai') {
          result = await window.electronAPI.chatWithOpenAI(payload);
        } else {
          result = await window.electronAPI.chatWithLlama(payload);
        }

        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                ...m,
                content: result.content,
                model: result.model,
                provider: result.provider as any,
                metrics: { startTime, endTime, duration }
              }
              : m,
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
      setPreviewImage(null);
      setImageCardState({});
      assistantMessageIdRef.current = null;
      activeRequestIdRef.current = null;
    } catch (error) {
      console.error('Failed to archive chat:', error);
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
    console.log('Model changed to:', value);
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

    const handler = (payload: {
      provider: 'gemini' | 'openai' | 'llama';
      delta: string;
      done?: boolean;
      model?: string;
    }) => {
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
          m.id === assistantId
            ? {
              ...m,
              content: m.content + payload.delta,
              model: payload.model || m.model,
            }
            : m,
        ),
      );
    };

    window.electronAPI.onChatStream(handler as any);
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
      className="flex flex-col h-full bg-astro-dark text-white relative overflow-hidden"
    >

      {/* Header - Comms Panel */}
      {/* Header - Comms Panel */}
      <div className="flex-none px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-astro-border flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-astro-primary/10 flex items-center justify-center border border-astro-primary/30">
              <rux-icon icon="chat" size="small" className="text-astro-primary"></rux-icon>
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-white tracking-widest uppercase leading-none">Comms</h2>
              <span className="text-[10px] text-astro-primary/80 font-mono tracking-wider">SECURE CHANNEL</span>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-700 mx-2"></div>

          <div className="flex items-center gap-2">
            <rux-status status={isLoading ? 'caution' : 'standby'} className="mt-1"></rux-status>
            <span className="text-xs text-gray-400 font-mono uppercase">
              {isLoading ? 'Transmitting...' : 'Standing By'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-800/50 rounded p-1 border border-gray-700">
            <rux-select
              value={provider}
              onRuxchange={(e: any) => handleProviderChange({ target: { value: e.target.value } } as any)}
              size="small"
              className="w-32"
            >
              <rux-option value="gemini" label="Gemini"></rux-option>
              <rux-option value="openai" label="OpenAI"></rux-option>
              <rux-option value="llama" label="Llama"></rux-option>
            </rux-select>

            <div className="w-px h-4 bg-gray-700"></div>

            <select
              value={
                provider === 'gemini'
                  ? selectedGeminiModel
                  : provider === 'openai'
                    ? selectedOpenAIModel
                    : selectedLlamaModel || (llamaModels[0]?.name ?? '')
              }
              onChange={handleModelChange}
              className="bg-gray-800 text-white text-sm rounded border border-gray-700 px-2 py-1 w-48 focus:outline-none focus:border-astro-primary"
            >
              {activeModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.displayName} ({m.name})
                </option>
              ))}
            </select>
          </div>

          <rux-select
            value={chatMode}
            onRuxchange={(e: any) => handleModeChange({ target: { value: e.target.value } } as any)}
            size="small"
            className="w-40"
          >
            <rux-option value="request-response" label="Standard Mode"></rux-option>
            <rux-option value="realtime" label="Realtime Voice"></rux-option>
          </rux-select>

          <rux-button
            icon="archive"
            size="small"
            secondary
            onClick={handleArchive}
            title="Archive Chat"
          >
            Archive
          </rux-button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-60">
              <div className="w-24 h-24 rounded-full bg-astro-surface border border-astro-border flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(79,172,254,0.1)]">
                <rux-icon icon="satellite" size="large" className="text-astro-primary"></rux-icon>
              </div>
              <h1 className="text-3xl font-light tracking-widest uppercase text-white mb-2">Hapa Node</h1>
              <p className="text-astro-off text-sm max-w-md">
                Secure AI Operations Terminal. Select a model and begin transmission.
              </p>
              {(provider === 'gemini' ? selectedGeminiModel : selectedOpenAIModel) && (
                <div className="mt-8 flex items-center gap-2 px-3 py-1 rounded-full bg-astro-surface border border-astro-border text-xs text-astro-primary">
                  <rux-icon icon="memory" size="extra-small"></rux-icon>
                  <span>Active: {provider === 'gemini' ? selectedGeminiModel : selectedOpenAIModel}</span>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => {
              // Hide empty assistant message while loading to avoid double-bubble
              if (msg.id === assistantMessageIdRef.current && !msg.content && isLoading) return null;

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`flex-none w-8 h-8 rounded flex items-center justify-center mt-1 overflow-hidden ${msg.role === 'user'
                      ? 'bg-astro-primary text-astro-dark'
                      : 'bg-astro-surface border border-astro-border text-astro-primary'
                      }`}>
                      {msg.role === 'user' && userAvatar ? (
                        <img src={userAvatar} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <rux-icon icon={msg.role === 'user' ? 'person' : 'processor'} size="small"></rux-icon>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={`flex flex-col min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          {msg.role === 'user' ? 'Operator' : 'AI System'}
                        </span>
                        {msg.role === 'model' && msg.provider && (
                          <span className="text-[10px] text-astro-off">
                            {formatProviderLabel(msg.provider)}
                            {msg.model && <span className="opacity-70"> :: {msg.model}</span>}
                          </span>
                        )}
                        {msg.metrics?.duration && (
                          <span className="text-[10px] text-astro-off opacity-50 font-mono">
                            {(msg.metrics.duration / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>

                      <div
                        className={`rounded px-5 py-4 shadow-sm text-sm leading-relaxed overflow-hidden ${msg.role === 'user'
                          ? 'bg-astro-hover/20 border border-astro-primary/30 text-white rounded-tr-none'
                          : 'bg-astro-surface border border-astro-border text-gray-100 rounded-tl-none'
                          }`}
                      >
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-3">
                            {msg.attachments.map((att, index) => {
                              const stateKey = getAttachmentCardStateKey(msg.id, index);
                              const stateEntry = imageCardState[stateKey];
                              const alreadyCarded = !!stateEntry?.hasCard;
                              return (
                                <div key={index} className="group relative">
                                  {att.mimeType.startsWith('image/') ? (
                                    <div className="relative rounded overflow-hidden border border-astro-border bg-black/30">
                                      <img
                                        src={att.previewUrl}
                                        alt={att.fileName || `attachment-${index + 1}`}
                                        className="h-24 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() =>
                                          setPreviewImage({
                                            src: att.previewUrl,
                                            alt: att.fileName || `attachment-${index + 1}`,
                                          })
                                        }
                                      />
                                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                        <button
                                          onClick={() => handleAddCardFromAttachment(msg, att, index)}
                                          className={`group/btn flex items-center rounded backdrop-blur-sm border border-white/10 transition-all duration-300 ease-out overflow-hidden h-9 w-9 hover:w-[130px] p-0 ${alreadyCarded ? 'bg-green-500/90 text-black border-green-400' : 'bg-black/80 hover:bg-astro-primary text-astro-primary hover:text-black'}`}
                                          title={alreadyCarded ? "Saved to Library" : "Save to Library"}
                                        >
                                          <div className="w-9 h-full flex items-center justify-center flex-none">
                                            <rux-icon icon={alreadyCarded ? "check" : "add-to-photos"} size="small"></rux-icon>
                                          </div>
                                          <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pr-3">
                                            {alreadyCarded ? "Saved" : "Save to Lib"}
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-astro-border bg-astro-dark/50">
                                      <rux-icon icon="insert-drive-file" size="small" className="text-astro-off"></rux-icon>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-mono truncate max-w-[150px]">{att.fileName}</span>
                                        <span className="text-[9px] text-astro-off uppercase">{att.mimeType.split('/')[1]}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-pre:bg-astro-dark prose-pre:border prose-pre:border-astro-border">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            urlTransform={(uri) => (uri && uri.startsWith('data:') ? uri : uri)}
                            components={{
                              code: ({ node, inline, className, children, ...props }: any) => {
                                return inline ? (
                                  <code className="bg-astro-dark px-1.5 py-0.5 rounded text-astro-primary font-mono text-xs" {...props}>
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block bg-astro-dark p-3 rounded border border-astro-border text-xs font-mono overflow-x-auto my-2" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              img: ({ node, src, alt, title, ...props }: any) => {
                                const [isHovered, setIsHovered] = useState(false);
                                const [isCarded, setIsCarded] = useState(false);

                                const handleDownload = () => {
                                  if (!src) return;
                                  const a = document.createElement('a');
                                  a.href = src;
                                  a.download = alt || `image-${Date.now()}.png`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                };

                                const handleCreateCard = async () => {
                                  if (!src) return;
                                  if (isCarded) return;

                                  try {
                                    let dataUrl = src;
                                    let mimeType = 'image/png'; // Default

                                    // If not a data URL, fetch it
                                    if (!src.startsWith('data:')) {
                                      const response = await fetch(src);
                                      const blob = await response.blob();
                                      mimeType = blob.type;
                                      dataUrl = await new Promise<string>((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result as string);
                                        reader.readAsDataURL(blob);
                                      });
                                    } else {
                                      const match = src.match(/^data:(.*?);base64,/);
                                      if (match) {
                                        mimeType = match[1];
                                      }
                                    }

                                    const cardId = await createImageCard({
                                      dataUrl,
                                      mimeType,
                                      source: 'markdown',
                                      message: msg,
                                      alt: alt || 'Generated Image',
                                    });

                                    if (cardId) {
                                      setIsCarded(true);
                                    }
                                  } catch (err) {
                                    console.error('Failed to create card from image:', err);
                                  }
                                };

                                return (
                                  <div
                                    className="relative group inline-block max-w-full"
                                    onMouseEnter={() => setIsHovered(true)}
                                    onMouseLeave={() => setIsHovered(false)}
                                  >
                                    <img
                                      src={src}
                                      alt={alt}
                                      title={title}
                                      className="max-w-full h-auto rounded border border-astro-border cursor-pointer"
                                      {...props}
                                      onClick={() => setPreviewImage({ src, alt: alt || 'Image' })}
                                    />
                                    <div className={`absolute top-2 right-2 flex gap-2 transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                                        className="group/btn flex items-center bg-black/80 hover:bg-astro-primary text-astro-primary hover:text-black rounded backdrop-blur-sm border border-white/10 transition-all duration-300 ease-out overflow-hidden h-9 w-9 hover:w-[110px] p-0"
                                        title="Download Image"
                                      >
                                        <div className="w-9 h-full flex items-center justify-center flex-none">
                                          <rux-icon icon="get-app" size="small"></rux-icon>
                                        </div>
                                        <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pr-3">Download</span>
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCreateCard(); }}
                                        className={`group/btn flex items-center rounded backdrop-blur-sm border border-white/10 transition-all duration-300 ease-out overflow-hidden h-9 w-9 hover:w-[130px] p-0 ${isCarded ? 'bg-green-500/90 text-black border-green-400' : 'bg-black/80 hover:bg-astro-primary text-astro-primary hover:text-black'}`}
                                        title={isCarded ? "Saved to Library" : "Save to Library"}
                                      >
                                        <div className="w-9 h-full flex items-center justify-center flex-none">
                                          <rux-icon icon={isCarded ? "check" : "add-to-photos"} size="small"></rux-icon>
                                        </div>
                                        <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pr-3">
                                          {isCarded ? "Saved" : "Save to Lib"}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="flex-none w-8 h-8 rounded bg-astro-surface border border-astro-border text-astro-primary flex items-center justify-center mt-1">
                  <rux-icon icon="processor" size="small"></rux-icon>
                </div>
                <div className="bg-astro-surface border border-astro-border rounded px-4 py-3 rounded-tl-none flex items-center gap-3">
                  <rux-progress type="indeterminate" className="w-24"></rux-progress>
                  <div className="flex items-center gap-2 text-astro-primary font-mono text-xs border-l border-astro-border pl-3">
                    <rux-icon icon="timer" size="extra-small"></rux-icon>
                    {startTimeRef.current && <ElapsedTime startTime={startTimeRef.current} />}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Console */}
      {/* Input Console */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        chatMode={chatMode}
        provider={provider}
        onStop={handleStop}
      />
      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-2 -right-2 bg-astro-surface text-white rounded-full p-2 border border-astro-border hover:bg-astro-hover transition-colors"
            >
              <rux-icon icon="close" size="small"></rux-icon>
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[85vh] w-auto rounded border border-astro-border shadow-2xl"
            />
            <div className="mt-2 text-center text-xs text-gray-400 font-mono">
              {previewImage.alt}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
