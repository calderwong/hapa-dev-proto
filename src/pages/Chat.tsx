
// @ts-nocheck
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/Button';
import { ChatInput, type Attachment, type AttachedMessageCard } from '../components/ChatInput';
import VeoOptionsPanel, { type VeoOptions } from '../components/VeoOptionsPanel';
import ImagenOptionsPanel, { type ImagenOptions } from '../components/ImagenOptionsPanel';

// Memoized component for Veo options bar to prevent expensive base64 re-processing
const VeoOptionsBar = memo(({ 
  veoOptions, 
  onExpand 
}: { 
  veoOptions: VeoOptions; 
  onExpand: () => void;
}) => {
  // Memoize data URLs to avoid recomputing on every render
  const startFrameDataUrl = useMemo(() => 
    veoOptions.startFrameBase64 
      ? `data:${veoOptions.startFrameMimeType};base64,${veoOptions.startFrameBase64}`
      : null,
    [veoOptions.startFrameBase64, veoOptions.startFrameMimeType]
  );

  const endFrameDataUrl = useMemo(() => 
    veoOptions.endFrameBase64 
      ? `data:${veoOptions.endFrameMimeType};base64,${veoOptions.endFrameBase64}`
      : null,
    [veoOptions.endFrameBase64, veoOptions.endFrameMimeType]
  );

  return (
    <button
      onClick={onExpand}
      className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-purple-400 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 rounded-lg transition-all w-full justify-center"
    >
      <rux-icon icon="videocam" size="extra-small"></rux-icon>
      <span>Configure Video Options</span>
      <span className="text-purple-400/60">
        ({veoOptions.aspectRatio} • {veoOptions.resolution} • {veoOptions.durationSeconds}s • {veoOptions.imageMode === 'none' ? 'Text only' : veoOptions.imageMode})
      </span>
      {/* Start frame thumbnail indicator */}
      {startFrameDataUrl && (
        <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-purple-500/30">
          <img
            src={startFrameDataUrl}
            alt="Start frame"
            className="w-6 h-6 rounded object-cover border border-purple-500/50"
          />
          <span className="text-purple-300 text-[10px]">
            {veoOptions.imageMode === 'loop' ? '🔄' : '▶'}
          </span>
          {endFrameDataUrl && veoOptions.imageMode === 'start-end-frame' && (
            <>
              <span className="text-purple-400/40">→</span>
              <img
                src={endFrameDataUrl}
                alt="End frame"
                className="w-6 h-6 rounded object-cover border border-purple-500/50"
              />
            </>
          )}
        </div>
      )}
      <rux-icon icon="keyboard-arrow-down" size="extra-small"></rux-icon>
    </button>
  );
});

// Card source info for attachments from Card Library
interface AttachmentCardSource {
  cardId: string;
  coreName: string;
  mediaKind: 'image' | 'video' | 'audio';
  name?: string;
}

interface ChatAttachmentPreview {
  mimeType: string;
  previewUrl: string;
  fileName?: string;
  dataUrl?: string;
  // Card source info (if attachment came from card library)
  fromCard?: AttachmentCardSource;
}

// Attached message card reference (for context)
interface AttachedMessageCard {
  cardId: string;
  coreName: string;
  role: 'user' | 'model';
  preview: string; // Truncated content
  attachmentCount?: number;
  thumbnail?: string;
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
  // Video generation fields
  video?: {
    base64?: string;
    localPath?: string;
    fileName?: string;
    mimeType?: string;
  };
  isVideoGenerating?: boolean;
  videoProgress?: number;
  // Attached message cards (context references)
  attachedMessageCards?: AttachedMessageCard[];
  // Parent card references (cards whose media was attached)
  parentCardRefs?: AttachmentCardSource[];
}

interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  isVideoModel?: boolean;
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
const AIMLAPI_MODEL_STORAGE_KEY = 'defaultAimlApiModel';
const LLAMA_MODEL_STORAGE_KEY = 'defaultLlamaModel';
const PROVIDER_STORAGE_KEY = 'defaultChatProvider';

type ChatMode = 'request-response' | 'realtime';
const CHAT_MODE_STORAGE_KEY = 'defaultChatMode';
const CHAT_MESSAGES_STORAGE_KEY = 'chatMessages';
const CHAT_ARCHIVES_STORAGE_KEY = 'chatArchives';
const CHAT_THREAD_ID_STORAGE_KEY = 'currentChatThreadId';
const CARD_LIBRARY_CORE_NAME = 'card-library';
const CHAT_IMAGE_CARD_STATE_STORAGE_PREFIX = 'chatImageCardState';
const CHAT_EXTRACTED_CARDS_STORAGE_KEY = 'chatExtractedCards';
const CHAT_MESSAGE_CARDS_STORAGE_KEY = 'chatMessageCards';

const formatProviderLabel = (value: 'gemini' | 'openai' | 'llama' | 'aimlapi') => {
  if (value === 'gemini') return 'Gemini';
  if (value === 'openai') return 'OpenAI';
  if (value === 'aimlapi') return 'AIMLAPI';
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
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'llama' | 'aimlapi'>('gemini');
  const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
  const [openaiModels, setOpenaiModels] = useState<ModelInfo[]>([]);
  const [aimlApiModels, setAimlApiModels] = useState<ModelInfo[]>([]);
  const [llamaModels, setLlamaModels] = useState<ModelInfo[]>([]);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-pro');
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState('gpt-4.1-mini');
  const [selectedAimlApiModel, setSelectedAimlApiModel] = useState('gpt-4o');
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
  const [inputAttachments, setInputAttachments] = useState<Attachment[]>([]);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  
  // Attached message cards for context reference
  const [attachedMessageCards, setAttachedMessageCards] = useState<AttachedMessageCard[]>([]);
  
  // Card picker modal state
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [cardLibraryCards, setCardLibraryCards] = useState<any[]>([]);

  // Veo video generation options
  const [showVeoPanel, setShowVeoPanel] = useState(false);
  // Track video save states: 'idle' | 'saving' | 'saved'
  const [videoSaveStates, setVideoSaveStates] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  // Track extracted cards: { msgId: { firstFrame: { cardId, coreName, dataUrl }, ... } }
  type ExtractedCard = { cardId: string; coreName: string; dataUrl: string; kind: 'image' | 'audio' };
  const [extractedCards, setExtractedCards] = useState<Record<string, Record<string, ExtractedCard>>>(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CHAT_EXTRACTED_CARDS_STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
    }
    return {};
  });
  // Track in-progress extractions
  const [extractingStates, setExtractingStates] = useState<Record<string, Record<string, boolean>>>({});
  const [veoOptions, setVeoOptions] = useState<VeoOptions>({
    imageMode: 'none',
    aspectRatio: '16:9',
    resolution: '720p',
    durationSeconds: '8',
    negativePrompt: '',
    personGeneration: 'allow_adult',
  });

  // Imagen image generation options
  const [showImagenPanel, setShowImagenPanel] = useState(false);
  const [imagenOptions, setImagenOptions] = useState<ImagenOptions>({
    numberOfImages: 4,
    imageSize: '1K',
    aspectRatio: '1:1',
    personGeneration: 'allow_adult',
    negativePrompt: '',
    outputMimeType: 'image/png',
  });
  
  // Drag-drop state for frame slots
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);
  const [frameDropTarget, setFrameDropTarget] = useState<'start' | 'end' | null>(null);
  const dragCounterRef = useRef(0);
  
  // Media sidebar state
  const [showMediaSidebar, setShowMediaSidebar] = useState(true);
  const MEDIA_SIDEBAR_STORAGE_KEY = 'chatMediaSidebarVisible';

  // Track which messages have been saved as cards (persisted per thread) - must be before threadMedia useMemo
  const [messageCardState, setMessageCardState] = useState<{
    [messageId: string]: { hasCard: boolean; cardCoreName?: string; isSaving?: boolean; thumbnail?: string; content?: string };
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${CHAT_MESSAGE_CARDS_STORAGE_KEY}_${threadId}`);
        return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
    }
    return {};
  });

  // Persist messageCardState when it changes
  useEffect(() => {
    if (Object.keys(messageCardState).length > 0) {
      try {
        // Strip thumbnail and content to save localStorage space (avoid QuotaExceededError)
        const toSave = Object.entries(messageCardState).reduce((acc, [k, v]) => {
          acc[k] = { 
            hasCard: v.hasCard, 
            cardCoreName: v.cardCoreName, 
            isSaving: v.isSaving 
          };
          return acc;
        }, {} as typeof messageCardState);
        localStorage.setItem(`${CHAT_MESSAGE_CARDS_STORAGE_KEY}_${threadId}`, JSON.stringify(toSave));
      } catch (e) {
        console.warn('Failed to persist messageCardState (quota exceeded?):', e);
      }
    }
  }, [messageCardState, threadId]);

  // Check if current model is a Veo video model
  const isVeoModelSelected = provider === 'gemini' && selectedGeminiModel?.toLowerCase().startsWith('veo-');
  const selectedVeoModelInfo = geminiModels.find(m => m.name === selectedGeminiModel);

  // Check if current model is an Imagen/image generation model
  const isImagenModelSelected = useMemo(() => {
    if (provider !== 'gemini') return false;
    const lower = selectedGeminiModel?.toLowerCase() || '';
    return (
      lower.includes('imagen') ||
      lower.includes('nano-banana') ||
      lower.includes('image-generation') ||
      (lower.includes('image') && !lower.includes('video'))
    );
  }, [provider, selectedGeminiModel]);

  // Helper to extract embedded images from markdown content (e.g., ![image](data:...))
  const extractEmbeddedImages = (content: string): Array<{ dataUrl: string; mimeType: string; index: number }> => {
    const images: Array<{ dataUrl: string; mimeType: string; index: number }> = [];
    const regex = /!\[.*?\]\((data:([^;]+);base64,[^)]+)\)/g;
    let match;
    let index = 0;
    while ((match = regex.exec(content)) !== null) {
      images.push({
        dataUrl: match[1],
        mimeType: match[2] || 'image/png',
        index: index++,
      });
    }
    return images;
  };

  // Compute all media items from the current thread for the sidebar
  type ThreadMediaItem = {
    id: string;
    type: 'video' | 'image' | 'audio' | 'message';
    source: 'generated' | 'extracted' | 'attachment' | 'saved';
    dataUrl?: string;
    localPath?: string;
    mimeType?: string;
    label: string;
    messageId: string;
    cardId?: string;
    coreName?: string;
    // Message card specific
    messageContent?: string;
    messageRole?: 'user' | 'model';
    attachmentCount?: number;
  };
  
  const threadMedia = useMemo<ThreadMediaItem[]>(() => {
    const items: ThreadMediaItem[] = [];
    
    messages.forEach((msg) => {
      // Add generated videos
      if (msg.video?.localPath) {
        items.push({
          id: `video-${msg.id}`,
          type: 'video',
          source: 'generated',
          localPath: msg.video.localPath,
          mimeType: msg.video.mimeType,
          label: 'Generated Video',
          messageId: msg.id,
        });
      }
      
      // Add extracted frames/audio for this message
      const msgExtracted = extractedCards[msg.id];
      if (msgExtracted) {
        Object.entries(msgExtracted).forEach(([extractType, card]) => {
          items.push({
            id: `${extractType}-${msg.id}`,
            type: card.kind === 'audio' ? 'audio' : 'image',
            source: 'extracted',
            dataUrl: card.dataUrl,
            label: extractType === 'firstFrame' ? '1st Frame' : extractType === 'lastFrame' ? 'Last Frame' : 'Audio',
            messageId: msg.id,
            cardId: card.cardId,
            coreName: card.coreName,
          });
        });
      }
      
      // Add image attachments from user messages
      if (msg.role === 'user' && msg.attachments) {
        msg.attachments.forEach((att, idx) => {
          if (att.mimeType?.startsWith('image/')) {
            items.push({
              id: `attachment-${msg.id}-${idx}`,
              type: 'image',
              source: 'attachment',
              dataUrl: att.dataUrl || att.previewUrl,
              mimeType: att.mimeType,
              label: att.fileName || 'Attachment',
              messageId: msg.id,
            });
          }
        });
      }
      
      // Add saved message cards
      const msgCardInfo = messageCardState[msg.id];
      if (msgCardInfo?.hasCard && msgCardInfo.cardCoreName) {
        // Re-derive thumbnail if missing (since we don't persist it anymore)
        let thumbnail = msgCardInfo.thumbnail;
        if (!thumbnail) {
          thumbnail = msg.attachments?.[0]?.dataUrl || msg.attachments?.[0]?.previewUrl;
          if (!thumbnail) {
             // Try to extract from content (e.g. generated images)
             const embedded = extractEmbeddedImages(msg.content);
             if (embedded.length > 0) thumbnail = embedded[0].dataUrl;
          }
        }

        items.push({
          id: `msgcard-${msg.id}`,
          type: 'message',
          source: 'saved',
          dataUrl: thumbnail,
          label: msg.role === 'user' ? 'Request Card' : 'Response Card',
          messageId: msg.id,
          cardId: msgCardInfo.cardCoreName,
          coreName: msgCardInfo.cardCoreName,
          messageContent: msgCardInfo.content || msg.content,
          messageRole: msg.role,
          attachmentCount: msg.attachments?.length,
        });
      }
    });
    
    return items;
  }, [messages, extractedCards, messageCardState]);

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

  // Helper for image card state keys
  const getAttachmentCardStateKey = (messageId: string, attachmentIndex: number) => {
    return `${messageId}:${attachmentIndex}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load card library for picker - enriches with card record to get mediaKind
  const loadCardLibrary = async () => {
    if (!window.electronAPI?.p2pRead) return;
    try {
      const entries = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
      
      // Parse card-index entries
      const parsedMap = new Map<string, any>();
      for (const raw of entries) {
        if (!raw || typeof raw !== 'string') continue;
        try {
          const data = JSON.parse(raw);
          if (!data || data.type !== 'card-index') continue;
          const cardId = String(data.cardId || data.id || '');
          if (!cardId) continue;
          parsedMap.set(cardId, { ...data, cardId });
        } catch { /* ignore */ }
      }
      
      // Enrich with card records to determine mediaKind
      const enriched = await Promise.all(
        Array.from(parsedMap.values()).map(async (entry) => {
          if (!entry.coreName || !window.electronAPI?.p2pRead) return entry;
          try {
            const cardData = await window.electronAPI.p2pRead(entry.coreName);
            const cardRecord = cardData?.[0] ? JSON.parse(cardData[0]) : null;
            if (!cardRecord) return entry;
            
            // Determine media kind and get data
            let mediaKind: string | undefined;
            let thumbnail = entry.thumbnail;
            let mediaLocalPath: string | undefined;
            
            if (cardRecord.kind === 'message' || cardRecord.message) {
              mediaKind = 'message';
              if (cardRecord.attachments?.[0]?.dataUrl) {
                thumbnail = thumbnail || cardRecord.attachments[0].dataUrl;
              }
            } else if (cardRecord.image) {
              mediaKind = 'image';
              mediaLocalPath = cardRecord.image.localPath;
              thumbnail = thumbnail || cardRecord.image.dataUrl || cardRecord.image.remoteUrl;
            } else if (cardRecord.video) {
              mediaKind = 'video';
              mediaLocalPath = cardRecord.video.localPath;
            } else if (cardRecord.audio) {
              mediaKind = 'audio';
              mediaLocalPath = cardRecord.audio.localPath;
            }
            
            return { ...entry, mediaKind, thumbnail, mediaLocalPath, cardRecord };
          } catch { return entry; }
        })
      );
      
      // Filter to only media cards (not message cards)
      const mediaCards = enriched
        .filter((e) => e.mediaKind && e.mediaKind !== 'message')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      
      setCardLibraryCards(mediaCards);
    } catch (e) {
      console.error('Failed to load card library:', e);
    }
  };

  // Handler to open card picker
  const handleOpenCardPicker = async () => {
    await loadCardLibrary();
    setShowCardPicker(true);
  };

  // Handler to add card from picker as attachment
  const handleAddCardAsAttachment = async (card: any) => {
    if (!card) return;
    
    console.log('Adding card as attachment:', card);
    
    // Get the media data from the card - try multiple sources
    let dataUrl: string | undefined;
    let mimeType = 'image/png';
    
    // Priority: thumbnail > cardRecord data > mediaLocalPath
    if (card.thumbnail && card.thumbnail.startsWith('data:')) {
      dataUrl = card.thumbnail;
    } else if (card.cardRecord?.image?.dataUrl) {
      dataUrl = card.cardRecord.image.dataUrl;
    } else if (card.cardRecord?.image?.remoteUrl) {
      dataUrl = card.cardRecord.image.remoteUrl;
    } else if (card.mediaLocalPath && window.electronAPI?.readFileAsBase64) {
      try {
        const base64 = await window.electronAPI.readFileAsBase64(card.mediaLocalPath);
        const ext = card.mediaLocalPath.split('.').pop()?.toLowerCase();
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'mp4') mimeType = 'video/mp4';
        else if (ext === 'webm') mimeType = 'video/webm';
        dataUrl = `data:${mimeType};base64,${base64}`;
      } catch (e) {
        console.error('Failed to read card media from local path:', e);
      }
    }
    
    // Final fallback: try to get from video thumbnail or any other source
    if (!dataUrl && card.cardRecord?.video?.thumbnailDataUrl) {
      dataUrl = card.cardRecord.video.thumbnailDataUrl;
    }
    
    if (!dataUrl) {
      console.warn('No media data found for card:', card.cardId, card);
      alert('Unable to load media from this card. Try an image card with a thumbnail.');
      return;
    }
    
    // Extract base64 from dataUrl
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      console.warn('Invalid dataUrl format:', dataUrl?.substring(0, 50));
      return;
    }
    
    mimeType = base64Match[1];
    const base64 = base64Match[2];
    
    // Create attachment with card source info
    const newAttachment: Attachment = {
      file: new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], card.name || `card-${card.cardId}`, { type: mimeType }),
      preview: dataUrl,
      base64,
      mimeType,
      fromCard: {
        cardId: card.cardId,
        coreName: card.coreName,
        mediaKind: card.mediaKind || 'image',
        name: card.name,
      },
    };
    
    console.log('Created attachment:', newAttachment.mimeType, newAttachment.fromCard);
    setInputAttachments(prev => [...prev, newAttachment]);
    setShowCardPicker(false);
  };

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

      if (window.electronAPI?.listAimlApiModels) {
        const availableAimlApiModels = await window.electronAPI.listAimlApiModels();
        if (availableAimlApiModels && availableAimlApiModels.length > 0) {
          setAimlApiModels(availableAimlApiModels);
          const storedAimlApiModel =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(AIMLAPI_MODEL_STORAGE_KEY)
              : null;
          if (storedAimlApiModel) {
            const match = availableAimlApiModels.find((model) => model.name === storedAimlApiModel);
            if (match) {
              setSelectedAimlApiModel(match.name);
            } else {
              setSelectedAimlApiModel(availableAimlApiModels[0].name);
            }
          } else {
            setSelectedAimlApiModel(availableAimlApiModels[0].name);
          }
        }
      }

      if (typeof window !== 'undefined') {
        const storedProvider = window.localStorage.getItem(PROVIDER_STORAGE_KEY) as
          | 'gemini'
          | 'openai'
          | 'llama'
          | 'aimlapi'
          | null;
        if (storedProvider === 'gemini' || storedProvider === 'openai' || storedProvider === 'llama' || storedProvider === 'aimlapi') {
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

  // Global drag event detection for frame drop zones
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Check if it's an image being dragged (from card library)
      const hasImageType = e.dataTransfer?.types?.includes('application/json') || 
                           e.dataTransfer?.types?.includes('Files');
      if (hasImageType && isVeoModelSelected) {
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) {
          setIsDraggingFrame(true);
          // Auto-expand Veo panel for easier dropping
          if (!showVeoPanel) {
            setShowVeoPanel(true);
          }
        }
      }
    };
    
    const handleDragLeave = (e: DragEvent) => {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingFrame(false);
        setFrameDropTarget(null);
      }
    };
    
    const handleDragEnd = () => {
      dragCounterRef.current = 0;
      setIsDraggingFrame(false);
      setFrameDropTarget(null);
    };
    
    const handleDrop = () => {
      dragCounterRef.current = 0;
      setIsDraggingFrame(false);
      setFrameDropTarget(null);
    };

    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragleave', handleDragLeave, true);
    window.addEventListener('dragend', handleDragEnd, true);
    window.addEventListener('drop', handleDrop, true);
    
    return () => {
      window.removeEventListener('dragenter', handleDragEnter, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
      window.removeEventListener('dragend', handleDragEnd, true);
      window.removeEventListener('drop', handleDrop, true);
    };
  }, [isVeoModelSelected, showVeoPanel]);

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

  // Create a video card in the library
  const createVideoCard = async (params: {
    videoPath: string;
    videoBase64?: string;
    mimeType: string;
    source: 'chat' | 'generation';
    message: Message;
    fileName?: string;
  }): Promise<string | null> => {
    if (
      typeof window === 'undefined' ||
      !window.electronAPI ||
      !window.electronAPI.wormholeIngestContent
    ) {
      console.warn('Wormhole API not available; cannot create Video Card');
      return null;
    }

    try {
      // Use wormhole ingest to create a video card
      const result = await window.electronAPI.wormholeIngestContent({
        path: params.videoPath,
        mediaType: 'video',
        sourceLabel: `chat-video-${params.source}`,
        fileName: params.fileName || `video-${Date.now()}.mp4`,
        tags: ['video', 'chat-generated', params.message.model || 'unknown'],
      });

      console.log('Video card created:', result);
      return result?.cardId || null;
    } catch (error) {
      console.error('Failed to create Video Card:', error);
      return null;
    }
  };

  // Create a message card in the library - stores full message context
  const createMessageCard = async (message: Message): Promise<string | null> => {
    if (
      typeof window === 'undefined' ||
      !window.electronAPI ||
      !window.electronAPI.p2pCreateCore ||
      !window.electronAPI.p2pAppend
    ) {
      console.warn('P2P API not available; cannot create Message Card');
      return null;
    }

    const createdAt = new Date().toISOString();
    const cardCoreName = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const coreInfo = await window.electronAPI.p2pCreateCore(cardCoreName);

      // Prepare attachments with full data including card source
      const attachments = message.attachments?.map((att, idx) => ({
        index: idx,
        fileName: att.fileName,
        mimeType: att.mimeType,
        dataUrl: att.dataUrl || att.previewUrl,
        fromCard: att.fromCard, // Preserve card source info
      })) || [];

      // Extract embedded images from message content (e.g., generated images from Nano Banana)
      const embeddedImages = extractEmbeddedImages(message.content);
      console.log(`Found ${embeddedImages.length} embedded images in message content`);

      // Get any extracted cards for this message
      const msgExtracted = extractedCards[message.id] || {};

      // Build parent references (cards whose media was attached or context cards)
      const parentCards: Array<{ cardId: string; coreName: string; relation: string }> = [];
      
      // Add parent cards from attachments
      if (message.parentCardRefs) {
        message.parentCardRefs.forEach(ref => {
          parentCards.push({
            cardId: ref.cardId,
            coreName: ref.coreName,
            relation: 'media-attached',
          });
        });
      }
      
      // Add context cards (attached message cards)
      if (message.attachedMessageCards) {
        message.attachedMessageCards.forEach(card => {
          parentCards.push({
            cardId: card.cardId,
            coreName: card.coreName,
            relation: 'context-reference',
          });
        });
      }

      // Create the message card record
      const cardRecord = {
        type: 'card',
        kind: 'message',
        id: cardCoreName,
        createdAt,
        // Thread context
        thread: {
          id: threadId,
          messageId: message.id,
        },
        // Message content
        message: {
          role: message.role,
          content: message.content,
          provider: message.provider,
          model: message.model,
          metrics: message.metrics,
        },
        // Attachments (images, videos, audio sent with message)
        attachments,
        // Generated/embedded images from AI response (e.g., from Nano Banana)
        generatedImages: embeddedImages.length > 0 ? embeddedImages : undefined,
        // Video if generated
        video: message.video ? {
          localPath: message.video.localPath,
          fileName: message.video.fileName,
          mimeType: message.video.mimeType,
        } : undefined,
        // Extracted frames/audio cards
        extractedCards: Object.entries(msgExtracted).reduce((acc, [type, card]) => {
          acc[type] = {
            cardId: card.cardId,
            coreName: card.coreName,
            kind: card.kind,
          };
          return acc;
        }, {} as Record<string, any>),
        // Parent card lineage (cards this message was derived from)
        parentCards: parentCards.length > 0 ? parentCards : undefined,
        // Core info
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

      // Add to library index
      await window.electronAPI.p2pCreateCore(CARD_LIBRARY_CORE_NAME);
      
      // Generate a thumbnail for the card (prefer: attachments > embedded images > video)
      const thumbnail = attachments.length > 0 && attachments[0].dataUrl
        ? attachments[0].dataUrl
        : embeddedImages.length > 0
          ? embeddedImages[0].dataUrl
          : message.video?.localPath
            ? undefined // Could extract thumbnail from video later
            : undefined;

      const libraryEntry = {
        type: 'card-index',
        cardId: cardCoreName,
        createdAt,
        threadId,
        messageId: message.id,
        kind: 'message',
        name: `${message.role === 'user' ? 'Request' : 'Response'}: ${message.content.slice(0, 50)}${message.content.length > 50 ? '...' : ''}`,
        mediaKind: 'message',
        provider: message.provider,
        model: message.model,
        coreName: cardCoreName,
        coreKey: coreInfo?.key,
        coreDiscoveryKey: coreInfo?.discoveryKey,
        thumbnail,
        attachmentCount: attachments.length,
        generatedImageCount: embeddedImages.length,
        hasVideo: !!message.video,
      };

      await window.electronAPI.p2pAppend({
        name: CARD_LIBRARY_CORE_NAME,
        data: JSON.stringify(libraryEntry),
      });

      console.log('Message card created:', cardCoreName);
      return cardCoreName;
    } catch (error) {
      console.error('Failed to create Message Card:', error);
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

  const handleSend = async (text: string, currentAttachments: Attachment[], msgCards?: AttachedMessageCard[]) => {
    if (!text.trim() && currentAttachments.length === 0 && (!msgCards || msgCards.length === 0)) return;
    if (isLoading) return;

    let modelName: string | undefined;
    if (provider === 'gemini') {
      modelName = selectedGeminiModel;
    } else if (provider === 'openai') {
      modelName = selectedOpenAIModel;
    } else if (provider === 'aimlapi') {
      modelName = selectedAimlApiModel;
    } else {
      modelName = selectedLlamaModel || (llamaModels[0]?.name ?? undefined);
    }

    // Extract parent card refs from attachments that came from card library
    const parentCardRefs = currentAttachments
      .filter(att => att.fromCard)
      .map(att => att.fromCard!);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachments: currentAttachments.map((att) => ({
        mimeType: att.mimeType,
        previewUrl: att.preview,
        fileName: att.file?.name,
        dataUrl: `data:${att.mimeType};base64,${att.base64}`,
        // Preserve card source info
        fromCard: att.fromCard,
      })),
      provider,
      model: modelName,
      // Include attached message cards as context references
      attachedMessageCards: msgCards && msgCards.length > 0 ? msgCards : undefined,
      // Include parent card refs (cards whose media was attached)
      parentCardRefs: parentCardRefs.length > 0 ? parentCardRefs : undefined,
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

    // Check if this is a Veo video generation model
    const isVeoModel = modelName?.toLowerCase().startsWith('veo-');
    const selectedModelInfo = geminiModels.find(m => m.name === modelName);
    const isVideoGeneration = isVeoModel || selectedModelInfo?.isVideoModel;

    const history = [...messages, userMessage]
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    // For video generation, mark the assistant message specially
    if (isVideoGeneration) {
      assistantMessage.isVideoGenerating = true;
      assistantMessage.content = '🎬 Generating video...';
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      if (window.electronAPI) {
        // Handle Veo video generation separately
        if (isVideoGeneration && window.electronAPI.generateVideoWithGemini) {
          console.log('Starting Veo video generation...');
          
          // Build video payload from veoOptions
          const videoPayload: any = {
            prompt: userMessage.content,
            model: modelName,
            // Video parameters from options panel
            aspectRatio: veoOptions.aspectRatio,
            resolution: veoOptions.resolution,
            durationSeconds: veoOptions.durationSeconds,
            negativePrompt: veoOptions.negativePrompt || undefined,
            personGeneration: veoOptions.personGeneration,
          };

          // Handle image input based on selected mode
          if (veoOptions.imageMode !== 'none') {
            // Use image from veoOptions panel if set, otherwise fall back to chat attachment
            const imageAttachment = currentAttachments.find(att => att.mimeType.startsWith('image/'));
            
            if (veoOptions.startFrameBase64 && veoOptions.startFrameMimeType) {
              // Use image from Veo panel
              videoPayload.imageBase64 = veoOptions.startFrameBase64;
              videoPayload.imageMimeType = veoOptions.startFrameMimeType;
            } else if (imageAttachment) {
              // Fall back to chat attachment
              videoPayload.imageBase64 = imageAttachment.base64;
              videoPayload.imageMimeType = imageAttachment.mimeType;
            }

            // Handle end frame for interpolation mode
            if (veoOptions.imageMode === 'start-end-frame' && veoOptions.endFrameBase64 && veoOptions.endFrameMimeType) {
              videoPayload.lastFrameBase64 = veoOptions.endFrameBase64;
              videoPayload.lastFrameMimeType = veoOptions.endFrameMimeType;
            }

            // Handle loop mode - uses same image for start and end
            if (veoOptions.imageMode === 'loop') {
              videoPayload.loopMode = true;
            }
          }

          try {
            const videoResult = await window.electronAPI.generateVideoWithGemini(videoPayload);
            
            if (activeRequestIdRef.current !== requestId) return;

            const endTime = Date.now();
            const duration = endTime - startTime;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                    ...m,
                    content: `✅ Video generated successfully! (${videoResult.durationSeconds}s)`,
                    isVideoGenerating: false,
                    video: {
                      base64: videoResult.videoBase64,
                      localPath: videoResult.videoPath,
                      fileName: videoResult.videoFileName,
                      mimeType: videoResult.mimeType,
                    },
                    model: videoResult.model,
                    provider: 'gemini' as const,
                    metrics: { startTime, endTime, duration }
                  }
                  : m,
              ),
            );
          } catch (videoError: any) {
            if (activeRequestIdRef.current !== requestId) return;
            
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                    ...m,
                    content: `❌ Video generation failed: ${videoError.message}`,
                    isVideoGenerating: false,
                  }
                  : m,
              ),
            );
          } finally {
            // Clean up for video generation
            if (activeRequestIdRef.current === requestId) {
              assistantMessageIdRef.current = null;
              activeRequestIdRef.current = null;
              setIsLoading(false);
            }
          }
          return;
        }

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
        } else if (provider === 'aimlapi') {
          const content = await window.electronAPI.chatWithAimlApi(payload);
          result = { content, model: modelName || 'unknown', provider: 'aimlapi' };
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
                : provider === 'aimlapi'
                  ? "I'm a mock AIMLAPI response. Please run in Electron to use real API."
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
    const raw = e.target.value as 'gemini' | 'openai' | 'llama' | 'aimlapi';
    const value: 'gemini' | 'openai' | 'llama' | 'aimlapi' =
      raw === 'openai' ? 'openai' : raw === 'llama' ? 'llama' : raw === 'aimlapi' ? 'aimlapi' : 'gemini';

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
    } else if (provider === 'aimlapi') {
      setSelectedAimlApiModel(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AIMLAPI_MODEL_STORAGE_KEY, value);
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
    provider === 'gemini' ? geminiModels : provider === 'openai' ? openaiModels : provider === 'aimlapi' ? aimlApiModels : llamaModels;

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
          m.provider === 'gemini' || m.provider === 'openai' || m.provider === 'llama' || m.provider === 'aimlapi'
            ? m.provider
            : undefined,
        model: typeof m.model === 'string' ? m.model : undefined,
        // Restore video metadata
        video: m.video?.localPath ? {
          localPath: m.video.localPath,
          fileName: m.video.fileName,
          mimeType: m.video.mimeType,
        } : undefined,
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
          // Persist video metadata (without large base64 to save space)
          video: m.video ? {
            localPath: m.video.localPath,
            fileName: m.video.fileName,
            mimeType: m.video.mimeType,
          } : undefined,
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

  // Persist extracted cards to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Strip dataUrl to save space (avoid QuotaExceededError)
      const toSave = Object.entries(extractedCards).reduce((acc, [msgId, types]) => {
        acc[msgId] = Object.entries(types).reduce((tAcc, [type, card]) => {
           tAcc[type] = { ...card, dataUrl: undefined };
           return tAcc;
        }, {} as any);
        return acc;
      }, {} as typeof extractedCards);
      localStorage.setItem(CHAT_EXTRACTED_CARDS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.error('Failed to persist extracted cards:', err);
    }
  }, [extractedCards]);

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
              <rux-option value="aimlapi" label="AIMLAPI"></rux-option>
              <rux-option value="llama" label="Llama"></rux-option>
            </rux-select>

            <div className="w-px h-4 bg-gray-700"></div>

            <select
              value={
                provider === 'gemini'
                  ? selectedGeminiModel
                  : provider === 'openai'
                    ? selectedOpenAIModel
                    : provider === 'aimlapi'
                      ? selectedAimlApiModel
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

      {/* Main Content Area with optional Media Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-60">
              {/* ... (Empty State) ... */}
              <div className="w-24 h-24 rounded-full bg-astro-surface border border-astro-border flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(79,172,254,0.1)]">
                <rux-icon icon="satellite" size="large" className="text-astro-primary"></rux-icon>
              </div>
              <h1 className="text-3xl font-light tracking-widest uppercase text-white mb-2">Hapa Node</h1>
              <p className="text-astro-off text-sm max-w-md">
                Secure AI Operations Terminal. Select a model and begin transmission.
              </p>
              {(provider === 'gemini' ? selectedGeminiModel : provider === 'openai' ? selectedOpenAIModel : provider === 'aimlapi' ? selectedAimlApiModel : selectedLlamaModel) && (
                <div className="mt-8 flex items-center gap-2 px-3 py-1 rounded-full bg-astro-surface border border-astro-border text-xs text-astro-primary">
                  <rux-icon icon="memory" size="extra-small"></rux-icon>
                  <span>Active: {provider === 'gemini' ? selectedGeminiModel : provider === 'openai' ? selectedOpenAIModel : provider === 'aimlapi' ? selectedAimlApiModel : selectedLlamaModel}</span>
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
                        {/* Display attached message cards (context references) */}
                        {msg.attachedMessageCards && msg.attachedMessageCards.length > 0 && (
                          <div className="mb-3 flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400/70">
                              <rux-icon icon="link" size="10px" className="mr-1 inline"></rux-icon>
                              Referenced:
                            </span>
                            {msg.attachedMessageCards.map((card) => (
                              <button
                                key={card.cardId}
                                onClick={() => navigate(`/cards?cardId=${card.coreName}`)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 border border-purple-500/30 rounded text-[10px] text-purple-300 hover:bg-purple-500/30 hover:border-purple-400 transition-all"
                                title={`View message card: ${card.preview}`}
                              >
                                <rux-icon 
                                  icon={card.role === 'user' ? 'person' : 'smart-toy'} 
                                  size="10px"
                                  className={card.role === 'user' ? 'text-cyan-400' : 'text-purple-400'}
                                ></rux-icon>
                                <span className="max-w-[120px] truncate">{card.preview}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-3">
                            {msg.attachments.map((att, index) => {
                              const stateKey = getAttachmentCardStateKey(msg.id, index);
                              const stateEntry = imageCardState[stateKey];
                              const alreadyCarded = !!stateEntry?.hasCard;
                              const isFromCard = !!att.fromCard;
                              return (
                                <div key={index} className="group relative">
                                  {att.mimeType.startsWith('image/') ? (
                                    <div className={`relative rounded overflow-hidden bg-black/30 ${
                                      isFromCard 
                                        ? 'border-2 border-purple-500/70 ring-1 ring-purple-500/30' 
                                        : 'border border-astro-border'
                                    }`}>
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
                                      {/* Card source badge */}
                                      {isFromCard && (
                                        <button
                                          onClick={() => navigate(`/cards?cardId=${att.fromCard?.coreName}`)}
                                          className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-purple-600/90 rounded text-[9px] text-white font-medium hover:bg-purple-500 transition-colors"
                                          title={`From card: ${att.fromCard?.name || att.fromCard?.cardId}`}
                                        >
                                          <rux-icon icon="photo-library" size="10px"></rux-icon>
                                          <span>Library</span>
                                        </button>
                                      )}
                                      {/* Upload badge for non-card attachments */}
                                      {!isFromCard && (
                                        <div className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-cyan-600/90 rounded text-[9px] text-white font-medium">
                                          <rux-icon icon="cloud-upload" size="10px"></rux-icon>
                                          <span>Upload</span>
                                        </div>
                                      )}
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
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded bg-astro-dark/50 ${
                                      isFromCard 
                                        ? 'border-2 border-purple-500/70' 
                                        : 'border border-astro-border'
                                    }`}>
                                      <rux-icon icon="insert-drive-file" size="small" className={isFromCard ? 'text-purple-400' : 'text-astro-off'}></rux-icon>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-mono truncate max-w-[150px]">{att.fileName}</span>
                                        <span className="text-[9px] text-astro-off uppercase">{att.mimeType.split('/')[1]}</span>
                                      </div>
                                      {isFromCard && (
                                        <rux-icon icon="photo-library" size="extra-small" className="text-purple-400" title="From Library"></rux-icon>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Video display for Veo-generated videos */}
                        {msg.video && msg.video.localPath && (
                          <div className="mb-4 group relative">
                            <div className="relative rounded-lg overflow-hidden border border-purple-500/50 bg-black/50 max-w-md">
                              <video
                                src={`file://${msg.video.localPath}`}
                                controls
                                className="w-full h-auto max-h-80"
                                poster=""
                              >
                                Your browser does not support video playback.
                              </video>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-2">
                                {(() => {
                                  const saveState = videoSaveStates[msg.id] || 'idle';
                                  const isSaving = saveState === 'saving';
                                  const isSaved = saveState === 'saved';
                                  
                                  return (
                                    <button
                                      onClick={async () => {
                                        if (isSaving || isSaved) return;
                                        if (msg.video?.localPath) {
                                          setVideoSaveStates(prev => ({ ...prev, [msg.id]: 'saving' }));
                                          const cardId = await createVideoCard({
                                            videoPath: msg.video.localPath,
                                            mimeType: msg.video.mimeType || 'video/mp4',
                                            source: 'generation',
                                            message: msg,
                                            fileName: msg.video.fileName,
                                          });
                                          if (cardId) {
                                            setVideoSaveStates(prev => ({ ...prev, [msg.id]: 'saved' }));
                                          } else {
                                            setVideoSaveStates(prev => ({ ...prev, [msg.id]: 'idle' }));
                                          }
                                        }
                                      }}
                                      disabled={isSaving || isSaved}
                                      className={`group/btn flex items-center rounded backdrop-blur-sm border transition-all duration-300 ease-out overflow-hidden h-9 p-0 ${
                                        isSaved 
                                          ? 'bg-emerald-500/90 text-white border-emerald-400/50 w-[100px] cursor-default' 
                                          : isSaving
                                            ? 'bg-amber-500/80 text-black border-amber-400/50 w-[100px] cursor-wait'
                                            : 'bg-black/80 hover:bg-purple-500 text-purple-400 hover:text-black border-white/10 w-9 hover:w-[130px]'
                                      }`}
                                      title={isSaved ? 'Already saved' : isSaving ? 'Saving...' : 'Save to Library'}
                                    >
                                      <div className="w-9 h-full flex items-center justify-center flex-none">
                                        {isSaved ? (
                                          <rux-icon icon="check" size="small"></rux-icon>
                                        ) : isSaving ? (
                                          <div className="w-4 h-4 border-2 border-black/50 border-t-black rounded-full animate-spin"></div>
                                        ) : (
                                          <rux-icon icon="add-to-photos" size="small"></rux-icon>
                                        )}
                                      </div>
                                      <span className={`text-xs font-bold whitespace-nowrap transition-opacity duration-200 pr-3 ${
                                        isSaved || isSaving ? 'opacity-100' : 'opacity-0 group-hover/btn:opacity-100'
                                      }`}>
                                        {isSaved ? 'Saved ✓' : isSaving ? 'Saving...' : 'Save to Lib'}
                                      </span>
                                    </button>
                                  );
                                })()}
                              </div>
                              <div className="absolute bottom-2 left-2 px-2 py-1 bg-purple-900/80 rounded text-xs text-purple-200 flex items-center gap-1">
                                <rux-icon icon="videocam" size="extra-small"></rux-icon>
                                Veo Generated
                              </div>
                            </div>
                            {/* Extraction buttons and previews */}
                            <div className="mt-2 space-y-2">
                              <div className="flex gap-2">
                                {(['firstFrame', 'lastFrame', 'audio'] as const).map((extractType) => {
                                  const msgCards = extractedCards[msg.id] || {};
                                  const card = msgCards[extractType];
                                  const isExtracting = extractingStates[msg.id]?.[extractType] || false;
                                  const isDone = !!card;
                                  
                                  const labels = {
                                    firstFrame: { icon: 'first-page', label: 'First Frame', doneLabel: 'Extracted' },
                                    lastFrame: { icon: 'last-page', label: 'Last Frame', doneLabel: 'Extracted' },
                                    audio: { icon: 'audiotrack', label: 'Audio', doneLabel: 'Extracted' },
                                  };
                                  const config = labels[extractType];
                                  
                                  return (
                                    <button
                                      key={extractType}
                                      onClick={async () => {
                                        if (isExtracting || isDone) return;
                                        if (!msg.video?.localPath) return;
                                        
                                        setExtractingStates(prev => ({
                                          ...prev,
                                          [msg.id]: { ...prev[msg.id], [extractType]: true }
                                        }));
                                        
                                        try {
                                          let result: any;
                                          if (extractType === 'audio') {
                                            result = await window.electronAPI.extractVideoAudio({ videoPath: msg.video.localPath });
                                          } else {
                                            const frameType = extractType === 'firstFrame' ? 'first' : 'last';
                                            result = await window.electronAPI.extractVideoFrame({ 
                                              videoPath: msg.video.localPath, 
                                              frameType 
                                            });
                                          }
                                          
                                          // Create card core name (matches library pattern)
                                          const coreName = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                                          const parentVideoCardId = videoSaveStates[msg.id] === 'saved' ? msg.id : undefined;
                                          const dataUrl = extractType === 'audio' 
                                            ? `data:${result.mimeType};base64,${result.audioBase64}`
                                            : `data:${result.mimeType};base64,${result.imageBase64}`;
                                          
                                          // Create the card record
                                          const cardRecord = extractType === 'audio' ? {
                                            type: 'card',
                                            id: coreName,
                                            kind: 'audio',
                                            title: `Audio from ${msg.video.fileName || 'Veo Video'}`,
                                            audio: { dataUrl },
                                            mimeType: result.mimeType,
                                            parentVideoId: parentVideoCardId,
                                            tags: ['extracted', 'audio', 'veo'],
                                            createdAt: new Date().toISOString(),
                                          } : {
                                            type: 'card',
                                            id: coreName,
                                            kind: 'image',
                                            title: `${extractType === 'firstFrame' ? 'First' : 'Last'} Frame from ${msg.video.fileName || 'Veo Video'}`,
                                            image: { dataUrl },
                                            mimeType: result.mimeType,
                                            parentVideoId: parentVideoCardId,
                                            tags: ['extracted', 'frame', extractType === 'firstFrame' ? 'first' : 'last', 'veo'],
                                            createdAt: new Date().toISOString(),
                                          };
                                          
                                          // Create core and save card
                                          await window.electronAPI.p2pCreateCore(coreName);
                                          await window.electronAPI.p2pAppend({ name: coreName, data: JSON.stringify(cardRecord) });
                                          
                                          // Add to library index (cardId = coreName for proper lookup)
                                          await window.electronAPI.p2pCreateCore('card-library');
                                          await window.electronAPI.p2pAppend({ name: 'card-library', data: JSON.stringify({
                                            type: 'card-index',
                                            cardId: coreName,
                                            coreName,
                                            kind: extractType === 'audio' ? 'audio' : 'image',
                                            parentVideoId: parentVideoCardId,
                                          })});
                                          
                                          // Store in state for persistence and preview
                                          setExtractedCards(prev => ({
                                            ...prev,
                                            [msg.id]: { 
                                              ...prev[msg.id], 
                                              [extractType]: { 
                                                cardId: coreName, 
                                                coreName, 
                                                dataUrl,
                                                kind: extractType === 'audio' ? 'audio' : 'image'
                                              } 
                                            }
                                          }));
                                        } catch (err) {
                                          console.error('Extraction failed:', err);
                                        } finally {
                                          setExtractingStates(prev => ({
                                            ...prev,
                                            [msg.id]: { ...prev[msg.id], [extractType]: false }
                                          }));
                                        }
                                      }}
                                      disabled={isExtracting || isDone}
                                      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-all ${
                                        isDone
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : isExtracting
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-purple-900/30 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                                      }`}
                                      title={isDone ? 'Already extracted' : `Extract ${config.label}`}
                                    >
                                      {isExtracting ? (
                                        <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                      ) : isDone ? (
                                        <rux-icon icon="check" size="extra-small"></rux-icon>
                                      ) : (
                                        <rux-icon icon={config.icon} size="extra-small"></rux-icon>
                                      )}
                                      {isDone ? config.doneLabel : isExtracting ? 'Extracting...' : config.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Extracted content previews - DRAGGABLE to Veo frame slots */}
                              {Object.keys(extractedCards[msg.id] || {}).length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                  {Object.entries(extractedCards[msg.id] || {}).map(([type, card]) => (
                                    <div
                                      key={type}
                                      draggable={card.kind === 'image'}
                                      onDragStart={(e) => {
                                        if (card.kind !== 'image') return;
                                        // Extract base64 from dataUrl
                                        const [header, base64] = card.dataUrl.split(',');
                                        const mimeType = header.match(/data:(.*?);/)?.[1] || 'image/png';
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                          cardId: card.cardId,
                                          name: type === 'firstFrame' ? 'First Frame' : 'Last Frame',
                                          mediaKind: 'image',
                                          image: { dataUrl: card.dataUrl },
                                          coreName: card.coreName,
                                        }));
                                        e.dataTransfer.setData('text/plain', card.cardId);
                                        e.dataTransfer.effectAllowed = 'copy';
                                      }}
                                      onClick={() => navigate(`/cards?cardId=${card.coreName}`)}
                                      className={`group relative rounded border border-purple-500/30 overflow-hidden hover:border-purple-400 transition-all cursor-pointer ${
                                        card.kind === 'image' ? 'cursor-grab active:cursor-grabbing' : ''
                                      }`}
                                      title={card.kind === 'image' 
                                        ? `Drag to Veo frame slot, or click to view in Card Library`
                                        : `View audio in Card Library`}
                                    >
                                      {card.kind === 'image' ? (
                                        <img src={card.dataUrl} alt={type} className="w-16 h-16 object-cover" draggable={false} />
                                      ) : (
                                        <div className="w-16 h-16 bg-purple-900/40 flex items-center justify-center">
                                          <rux-icon icon="audiotrack" size="small" className="text-purple-400"></rux-icon>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        {card.kind === 'image' ? (
                                          <rux-icon icon="pan-tool" size="extra-small" className="text-cyan-400"></rux-icon>
                                        ) : (
                                          <rux-icon icon="open-in-new" size="extra-small" className="text-white"></rux-icon>
                                        )}
                                      </div>
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-purple-300 px-1 py-0.5 text-center truncate">
                                        {type === 'firstFrame' ? '1st Frame' : type === 'lastFrame' ? 'Last Frame' : 'Audio'}
                                      </div>
                                      {/* Drag hint for image frames */}
                                      {card.kind === 'image' && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <rux-icon icon="pan-tool" size="1rem" className="text-white scale-75"></rux-icon>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Video generation progress indicator */}
                        {msg.isVideoGenerating && (
                          <div className="mb-4 p-4 rounded-lg border border-purple-500/30 bg-purple-900/20 flex items-center gap-3">
                            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                            <div className="flex-1">
                              <div className="text-sm text-purple-300 font-medium">Generating video with Veo...</div>
                              <div className="text-xs text-purple-400/70">This may take 1-3 minutes</div>
                            </div>
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

                                const handleReattach = async () => {
                                  if (!src) return;
                                  try {
                                    let blob: Blob;
                                    let mimeType = 'image/png';
                                    let base64 = '';

                                    if (src.startsWith('data:')) {
                                      const arr = src.split(',');
                                      const match = arr[0].match(/:(.*?);/);
                                      mimeType = match ? match[1] : 'image/png';
                                      const bstr = atob(arr[1]);
                                      let n = bstr.length;
                                      const u8arr = new Uint8Array(n);
                                      while (n--) {
                                        u8arr[n] = bstr.charCodeAt(n);
                                      }
                                      blob = new Blob([u8arr], { type: mimeType });
                                      base64 = arr[1];
                                    } else {
                                      const response = await fetch(src);
                                      blob = await response.blob();
                                      mimeType = blob.type;
                                      base64 = await new Promise<string>((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          const res = reader.result as string;
                                          resolve(res.split(',')[1]);
                                        };
                                        reader.readAsDataURL(blob);
                                      });
                                    }

                                    const fileName = alt || `reattached-${Date.now()}.png`;
                                    const file = new File([blob], fileName, { type: mimeType });
                                    const preview = URL.createObjectURL(blob);

                                    setInputAttachments(prev => [...prev, {
                                      file,
                                      preview,
                                      base64,
                                      mimeType
                                    }]);
                                  } catch (err) {
                                    console.error('Failed to re-attach image:', err);
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
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleReattach(); }}
                                        className="group/btn flex items-center bg-black/80 hover:bg-astro-primary text-astro-primary hover:text-black rounded backdrop-blur-sm border border-white/10 transition-all duration-300 ease-out overflow-hidden h-9 w-9 hover:w-[110px] p-0"
                                        title="Use as Input"
                                      >
                                        <div className="w-9 h-full flex items-center justify-center flex-none">
                                          <rux-icon icon="input" size="small"></rux-icon>
                                        </div>
                                        <span className="text-xs font-bold whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 pr-3">Use Input</span>
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
                        
                        {/* Message Actions Bar */}
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                          {(() => {
                            const msgCardState = messageCardState[msg.id];
                            const isSaving = msgCardState?.isSaving;
                            const hasCard = msgCardState?.hasCard;
                            
                            const handleSaveMessage = async () => {
                              if (isSaving || hasCard) return;
                              
                              setMessageCardState(prev => ({
                                ...prev,
                                [msg.id]: { hasCard: false, isSaving: true }
                              }));
                              
                              const cardCoreName = await createMessageCard(msg);
                              
                              // Get thumbnail: prefer attachments, then embedded images in content
                              let thumbnail = msg.attachments?.[0]?.dataUrl || msg.attachments?.[0]?.previewUrl;
                              if (!thumbnail) {
                                // Extract embedded images from content (e.g., generated by Nano Banana)
                                const embeddedImages = extractEmbeddedImages(msg.content);
                                if (embeddedImages.length > 0) {
                                  thumbnail = embeddedImages[0].dataUrl;
                                }
                              }
                              
                              setMessageCardState(prev => ({
                                ...prev,
                                [msg.id]: { 
                                  hasCard: !!cardCoreName, 
                                  cardCoreName: cardCoreName || undefined,
                                  isSaving: false,
                                  thumbnail,
                                  content: msg.content.slice(0, 100),
                                }
                              }));
                            };
                            
                            return (
                              <button
                                onClick={handleSaveMessage}
                                disabled={isSaving}
                                className={`group/save flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                  hasCard 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' 
                                    : isSaving
                                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 cursor-wait'
                                      : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/30'
                                }`}
                                title={hasCard 
                                  ? `Saved as card: ${msgCardState?.cardCoreName}` 
                                  : isSaving 
                                    ? 'Saving...' 
                                    : 'Save this message as a card in the library'}
                              >
                                {isSaving ? (
                                  <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <rux-icon icon={hasCard ? 'check' : 'note-add'} size="12px"></rux-icon>
                                )}
                                <span>{hasCard ? 'Saved to Library' : isSaving ? 'Saving...' : 'Save as Card'}</span>
                                {(msg.attachments?.length || 0) > 0 && !hasCard && !isSaving && (
                                  <span className="ml-1 px-1 py-0.5 bg-purple-500/30 rounded text-purple-300 text-[8px]">
                                    +{msg.attachments?.length} media
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                          
                          {messageCardState[msg.id]?.hasCard && (
                            <button
                              onClick={() => navigate(`/cards?cardId=${messageCardState[msg.id]?.cardCoreName}`)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 transition-all"
                              title="View message card in library"
                            >
                              <rux-icon icon="open-in-new" size="12px"></rux-icon>
                              <span>View Card</span>
                            </button>
                          )}
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
        
        {/* Media Sidebar - Thread Gallery */}
        {threadMedia.length > 0 && (
          <div className={`flex-none border-l border-gray-800 bg-gray-900/50 transition-all duration-300 ${
            showMediaSidebar ? 'w-48' : 'w-10'
          }`}>
            {/* Toggle Button */}
            <button
              onClick={() => setShowMediaSidebar(!showMediaSidebar)}
              className="w-full px-2 py-2 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 border-b border-gray-800 transition-colors"
              title={showMediaSidebar ? 'Collapse media gallery' : 'Expand media gallery'}
            >
              <rux-icon 
                icon={showMediaSidebar ? 'chevron-right' : 'chevron-left'} 
                size="extra-small"
              ></rux-icon>
              {showMediaSidebar && (
                <span className="font-medium uppercase tracking-wider">Media ({threadMedia.length})</span>
              )}
            </button>
            
            {/* Media Items */}
            {showMediaSidebar && (
              <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                {threadMedia.map((item) => (
                  <div
                    key={item.id}
                    draggable={item.type === 'image' || item.type === 'message'}
                    onDragStart={(e) => {
                      if (item.type === 'message') {
                        // Drag message card with content for attaching to prompt
                        e.dataTransfer.setData('application/x-message-card', JSON.stringify({
                          cardId: item.cardId,
                          coreName: item.coreName,
                          role: item.messageRole,
                          preview: item.messageContent?.slice(0, 100) || '',
                          thumbnail: item.dataUrl,
                          attachmentCount: item.attachmentCount,
                        }));
                        e.dataTransfer.setData('text/plain', item.messageContent || '');
                        
                        // If message has image thumbnail, also allow dragging as image
                        if (item.dataUrl) {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            cardId: item.cardId,
                            name: item.label,
                            mediaKind: 'image',
                            image: { dataUrl: item.dataUrl },
                            coreName: item.coreName,
                          }));
                        }
                        e.dataTransfer.effectAllowed = 'copy';
                      } else if (item.type === 'image' && item.dataUrl) {
                        // Drag image for Veo frame slots
                        e.dataTransfer.setData('application/json', JSON.stringify({
                          cardId: item.cardId,
                          name: item.label,
                          mediaKind: 'image',
                          image: { dataUrl: item.dataUrl },
                          coreName: item.coreName,
                        }));
                        e.dataTransfer.setData('text/plain', item.cardId || item.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    onClick={() => {
                      if (item.coreName) {
                        navigate(`/cards?cardId=${item.coreName}`);
                      }
                    }}
                    className={`group relative rounded border border-gray-700/50 overflow-hidden transition-all hover:border-purple-500/50 ${
                      item.type === 'image' || item.type === 'message' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    }`}
                    title={item.type === 'image' 
                      ? `${item.label} - Drag to frame slot or click to view`
                      : item.type === 'message'
                        ? `${item.label} - Drag to input to attach context, or click to view`
                        : `${item.label} - Click to view`}
                  >
                    {/* Thumbnail */}
                    {item.type === 'video' ? (
                      <div className="w-full h-20 bg-gray-800 flex items-center justify-center">
                        <rux-icon icon="videocam" size="small" className="text-purple-400"></rux-icon>
                      </div>
                    ) : item.type === 'audio' ? (
                      <div className="w-full h-16 bg-gray-800 flex items-center justify-center">
                        <rux-icon icon="audiotrack" size="small" className="text-cyan-400"></rux-icon>
                      </div>
                    ) : item.type === 'message' ? (
                      item.dataUrl ? (
                        /* Message card with image thumbnail */
                        <div className="relative w-full h-20">
                          <img 
                            src={item.dataUrl} 
                            alt={item.label}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay badge */}
                          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="flex items-center gap-1">
                              <rux-icon icon={item.messageRole === 'user' ? 'person' : 'smart-toy'} size="10px" className="text-purple-400"></rux-icon>
                              <span className="text-[8px] text-white font-medium truncate">{item.messageRole === 'user' ? 'Request' : 'Response'}</span>
                            </div>
                          </div>
                          {/* Card badge */}
                          <div className="absolute top-1 right-1 px-1 py-0.5 bg-purple-600/80 rounded text-[7px] text-white font-bold">
                            CARD
                          </div>
                        </div>
                      ) : (
                        /* Message card without image - show text preview */
                        <div className="w-full h-20 p-1.5 bg-gradient-to-br from-purple-900/60 to-gray-800 flex flex-col">
                          <div className="flex items-center gap-1 mb-1">
                            <rux-icon icon={item.messageRole === 'user' ? 'person' : 'smart-toy'} size="12px" className="text-purple-400"></rux-icon>
                            <span className="text-[8px] text-purple-300 font-medium">{item.messageRole === 'user' ? 'Request' : 'Response'}</span>
                          </div>
                          <p className="text-[8px] text-gray-300 line-clamp-2 flex-1">{item.messageContent?.slice(0, 60)}...</p>
                          {(item.attachmentCount || 0) > 0 && (
                            <div className="flex items-center gap-0.5 text-[7px] text-purple-400 mt-0.5">
                              <rux-icon icon="attach-file" size="10px"></rux-icon>
                              <span>{item.attachmentCount}</span>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <img 
                        src={item.dataUrl} 
                        alt={item.label}
                        draggable={false}
                        className="w-full h-20 object-cover"
                      />
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {item.type === 'image' ? (
                        <rux-icon icon="pan-tool" size="extra-small" className="text-cyan-400"></rux-icon>
                      ) : item.type === 'message' ? (
                        <rux-icon icon="input" size="extra-small" className="text-purple-400"></rux-icon>
                      ) : (
                        <rux-icon icon="open-in-new" size="extra-small" className="text-white"></rux-icon>
                      )}
                    </div>
                    
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                      <p className="text-[9px] text-white truncate font-medium">{item.label}</p>
                      <p className="text-[8px] text-gray-400 truncate capitalize">{item.source}</p>
                    </div>
                    
                    {/* Type badge */}
                    <div className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                      item.type === 'video' ? 'bg-purple-500' :
                      item.type === 'audio' ? 'bg-cyan-500' :
                      item.type === 'message' ? 'bg-purple-600' : 'bg-green-500'
                    }`}>
                      <rux-icon 
                        icon={item.type === 'video' ? 'videocam' : item.type === 'audio' ? 'audiotrack' : item.type === 'message' ? 'chat' : 'image'} 
                        size="12px"
                        className="text-white"
                      ></rux-icon>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Collapsed State - Just icons */}
            {!showMediaSidebar && (
              <div className="p-1 space-y-1 overflow-y-auto">
                {threadMedia.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    draggable={item.type === 'image'}
                    onDragStart={(e) => {
                      if (item.type !== 'image' || !item.dataUrl) return;
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        cardId: item.cardId,
                        name: item.label,
                        mediaKind: 'image',
                        image: { dataUrl: item.dataUrl },
                        coreName: item.coreName,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className={`w-8 h-8 rounded border border-gray-700/50 overflow-hidden transition-all hover:border-purple-500/50 ${
                      item.type === 'image' ? 'cursor-grab' : 'cursor-pointer'
                    }`}
                    title={item.label}
                  >
                    {item.type === 'image' && item.dataUrl ? (
                      <img src={item.dataUrl} alt={item.label} className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        item.type === 'video' ? 'bg-purple-900/50' : 'bg-cyan-900/50'
                      }`}>
                        <rux-icon 
                          icon={item.type === 'video' ? 'videocam' : 'audiotrack'} 
                          size="12px"
                          className={item.type === 'video' ? 'text-purple-400' : 'text-cyan-400'}
                        ></rux-icon>
                      </div>
                    )}
                  </div>
                ))}
                {threadMedia.length > 10 && (
                  <div className="w-8 h-8 rounded border border-gray-700/50 bg-gray-800/50 flex items-center justify-center text-[10px] text-gray-400">
                    +{threadMedia.length - 10}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Veo Video Options Panel */}
      {isVeoModelSelected && (
        <div className="px-4 pb-0">
          <div className="max-w-4xl mx-auto">
            {!showVeoPanel ? (
              <VeoOptionsBar 
                veoOptions={veoOptions} 
                onExpand={() => setShowVeoPanel(true)} 
              />
            ) : (
              <VeoOptionsPanel
                modelName={selectedGeminiModel}
                options={veoOptions}
                onOptionsChange={setVeoOptions}
                onClose={() => setShowVeoPanel(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Imagen Image Generation Options Panel */}
      {isImagenModelSelected && (
        <div className="px-4 pb-0">
          <div className="max-w-4xl mx-auto">
            {!showImagenPanel ? (
              /* Collapsed bar showing current settings */
              <button
                onClick={() => setShowImagenPanel(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#172635] border border-[#2b4a63] rounded-lg hover:border-purple-500/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <rux-icon icon="palette" size="small" className="text-purple-400"></rux-icon>
                  <span className="text-sm text-white font-medium">Image Options</span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-300">{imagenOptions.aspectRatio}</span>
                    <span className="px-1.5 py-0.5 bg-cyan-500/20 rounded text-cyan-300">{imagenOptions.imageSize}</span>
                    <span className="px-1.5 py-0.5 bg-green-500/20 rounded text-green-300">{imagenOptions.numberOfImages} imgs</span>
                  </div>
                </div>
                <rux-icon icon="settings" size="small" className="text-gray-500 group-hover:text-purple-400 transition-colors"></rux-icon>
              </button>
            ) : (
              <ImagenOptionsPanel
                modelName={selectedGeminiModel}
                options={imagenOptions}
                onOptionsChange={setImagenOptions}
                onClose={() => setShowImagenPanel(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Input Console */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        chatMode={chatMode}
        provider={provider}
        onStop={handleStop}
        attachments={inputAttachments}
        setAttachments={setInputAttachments}
        attachedMessageCards={attachedMessageCards}
        setAttachedMessageCards={setAttachedMessageCards}
        onOpenCardPicker={handleOpenCardPicker}
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

      {/* Card Library Picker Modal */}
      {showCardPicker && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => setShowCardPicker(false)}
        >
          <div 
            className="bg-[#1b2d3e] border border-[#2b4a63] rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#2b4a63] bg-[#172635] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <rux-icon icon="photo-library" size="small" className="text-purple-400"></rux-icon>
                <span className="font-bold text-white">Select from Card Library</span>
              </div>
              <button
                onClick={() => setShowCardPicker(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                title="Close"
              >
                <rux-icon icon="close" size="small"></rux-icon>
              </button>
            </div>
            
            {/* Card Grid */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)] bg-[#1b2d3e]">
              {cardLibraryCards.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <rux-icon icon="photo-library" size="large" className="opacity-30 mb-3"></rux-icon>
                  <p>No cards with media found in your library</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {cardLibraryCards.map((card) => (
                    <button
                      key={card.cardId}
                      onClick={() => handleAddCardAsAttachment(card)}
                      className="group relative aspect-square rounded-lg border border-[#2b4a63] overflow-hidden hover:border-purple-500 hover:ring-2 hover:ring-purple-500/30 transition-all hover:scale-105 bg-[#101923]"
                    >
                      {/* Thumbnail */}
                      {card.thumbnail || card.cardRecord?.image?.dataUrl ? (
                        <img
                          src={card.thumbnail || card.cardRecord?.image?.dataUrl}
                          alt={card.name || card.cardId}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#101923] flex items-center justify-center">
                          <rux-icon 
                            icon={card.mediaKind === 'video' ? 'videocam' : card.mediaKind === 'audio' ? 'audiotrack' : 'image'} 
                            size="medium"
                            className="text-[#2b4a63]"
                          ></rux-icon>
                        </div>
                      )}
                      
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/30 transition-colors flex items-center justify-center">
                        <rux-icon icon="add-circle" size="large" className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"></rux-icon>
                      </div>
                      
                      {/* Type badge */}
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        card.mediaKind === 'video' ? 'bg-purple-600' :
                        card.mediaKind === 'audio' ? 'bg-cyan-600' : 'bg-green-600'
                      } text-white shadow-md`}>
                        {card.mediaKind}
                      </div>
                      
                      {/* Name */}
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-[9px] text-white truncate font-medium">{card.name || card.cardId?.slice(0, 12)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
