// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import PageContainer from '../components/PageContainer';
import CardWorkspace from '../components/CardWorkspace';
import { calculateCardQuality, getTierBadge } from '../utils/cardQuality';
import { playPickUpSound, playDropSound, playForgeHoverSound } from '../utils/audio';
// import { useToast } from '../context/ToastContext';

interface CardIndexEntry {
    cardId: string;
    name?: string;
    createdAt: string;
    coreName?: string;
    thumbnail?: string;
    mediaKind?: 'image' | 'video' | 'audio' | 'message' | 'pet';
    cardRecord?: any;
    raw?: any;
}

// Triad Types
type TriadPillar = 'love' | 'truth' | 'conviction';

interface StackedCard {
    uid: string; // Unique ID for this specific instance in the stack
    card: CardIndexEntry;
}

interface ForgedAvatar {
    name: string;
    archetype: string;
    bio: string;
    visualPrompt: string;
    voiceSamples: string[];
    moveSet: string[];
    stats: {
        love: number;
        truth: number;
        conviction: number;
    };
    video?: {
        localPath: string;
        mimeType: string;
    };
}

const toFileUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('file://')) return path;
    const normalized = path.replace(/\\/g, '/');
    return `file:///${normalized}`;
};

const CARD_LIBRARY_CORE_NAME = 'card-library';

const Forge: React.FC = () => {
    // const { showToast } = useToast();
    const showToast = (type: string, title: string, message?: string) => alert(`${title}: ${message || ''}`);
    // State
    const [inventory, setInventory] = useState<CardIndexEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debugMode, setDebugMode] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<CardIndexEntry | null>(null);
    const [inspectingCard, setInspectingCard] = useState<CardIndexEntry | null>(null);
    
    // The Triad Stacks
    const [redStack, setRedStack] = useState<StackedCard[]>([]); // Love
    const [blueStack, setBlueStack] = useState<StackedCard[]>([]); // Truth
    const [greenStack, setGreenStack] = useState<StackedCard[]>([]); // Conviction

    // ... (Drag/Gen state) ...
    // Drag State
    const [draggedCard, setDraggedCard] = useState<CardIndexEntry | null>(null);
    const [draggedStackItem, setDraggedStackItem] = useState<{ card: StackedCard, source: TriadPillar, index: number } | null>(null);
    const [dragOverPillar, setDragOverPillar] = useState<TriadPillar | null>(null);

    // Generation State
    const [isForging, setIsForging] = useState(false);
    const [forgingStep, setForgingStep] = useState<string>('');
    const [forgedAvatar, setForgedAvatar] = useState<ForgedAvatar | null>(null);
    const [manifesting, setManifesting] = useState(false);
    const [generatedVisualUrl, setGeneratedVisualUrl] = useState<string | null>(null);
    const [generatedVisualPath, setGeneratedVisualPath] = useState<string | null>(null);
    
    // Model Selection - Default to 1.5 Pro for better JSON compliance
    const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-pro');
    const [availableModels, setAvailableModels] = useState<{name: string, displayName: string}[]>([]);

    useEffect(() => {
        // Fetch available models
        const fetchModels = async () => {
            if (window.electronAPI?.listGeminiModels) {
                try {
                    const models = await window.electronAPI.listGeminiModels();
                    const textModels = models.filter((m: any) => !m.isVideoModel);
                    setAvailableModels(textModels);
                    // Default to 1.5 Pro for best JSON instruction following
                    if (textModels.some((m: any) => m.name === 'gemini-1.5-pro')) {
                        setSelectedModel('gemini-1.5-pro');
                    } else if (textModels.some((m: any) => m.name === 'gemini-2.0-flash-exp')) {
                        setSelectedModel('gemini-2.0-flash-exp');
                    }
                } catch (e) {
                    console.error("Failed to fetch models", e);
                }
            }
        };
        fetchModels();
    }, []);

    // Enrichment Logic (Copied from CardLibrary.tsx)
    const enrichWithCardRecords = async (entries: CardIndexEntry[]): Promise<CardIndexEntry[]> => {
        if (!window.electronAPI || !window.electronAPI.p2pRead) {
            return entries;
        }

        const enriched = await Promise.all(
            entries.map(async (entry) => {
                if (!entry.coreName) {
                    return entry;
                }

                try {
                    const records = await window.electronAPI.p2pRead(entry.coreName);
                    if (!Array.isArray(records) || records.length === 0) {
                        return entry;
                    }

                    let cardRecord: any | null = null;
                    for (let i = records.length - 1; i >= 0; i -= 1) {
                        const raw = records[i];
                        if (!raw || typeof raw !== 'string') continue;
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && (parsed.type === 'card' || parsed.type === 'pet')) {
                                cardRecord = parsed;
                                break;
                            }
                        } catch {
                            // ignore parse errors for individual records
                        }
                    }

                    if (!cardRecord) {
                        return entry;
                    }

                    let mediaKind: 'image' | 'video' | 'audio' | 'message' | undefined;
                    let mediaLocalPath: string | undefined;
                    let mediaRemoteUrl: string | undefined;
                    let mediaMimeType: string | undefined;
                    let messageContent: string | undefined;
                    let messageRole: 'user' | 'model' | undefined;
                    let attachmentCount: number | undefined;
                    let hasVideo: boolean | undefined;

                    if (cardRecord.kind === 'message' || cardRecord.message) {
                        // Message card
                        mediaKind = 'message';
                        messageContent = cardRecord.message?.content;
                        messageRole = cardRecord.message?.role;
                        attachmentCount = cardRecord.attachments?.length;
                        hasVideo = !!cardRecord.video;
                        // Use first attachment as thumbnail if available
                        if (cardRecord.attachments?.[0]?.dataUrl) {
                            mediaRemoteUrl = cardRecord.attachments[0].dataUrl;
                        }
                    } else if (cardRecord.image) {
                        mediaKind = 'image';
                        mediaLocalPath = cardRecord.image.localPath;
                        mediaRemoteUrl = cardRecord.image.remoteUrl || cardRecord.image.dataUrl;
                        mediaMimeType = cardRecord.image.mimeType;
                    } else if (cardRecord.video) {
                        mediaKind = 'video';
                        mediaLocalPath = cardRecord.video.localPath;
                        mediaRemoteUrl = cardRecord.video.remoteUrl;
                        mediaMimeType = cardRecord.video.mimeType;
                    } else if (cardRecord.audio) {
                        mediaKind = 'audio';
                        mediaLocalPath = cardRecord.audio.localPath;
                        mediaRemoteUrl = cardRecord.audio.remoteUrl;
                        mediaMimeType = cardRecord.audio.mimeType;
                    }

                    // IMPORTANT: Prefer record values over index values if index values are missing
                    return {
                        ...entry,
                        name: entry.name || cardRecord.name || cardRecord.title || 'Untitled',
                        mediaKind: mediaKind || entry.mediaKind || 'text',
                        mediaLocalPath,
                        mediaRemoteUrl,
                        mediaMimeType,
                        messageContent,
                        messageRole,
                        attachmentCount,
                        hasVideo,
                        subType: cardRecord.subType,
                        derivedGif: cardRecord.derivedGif,
                        cardRecord,
                    };
                } catch {
                    return entry;
                }
            }),
        );

        return enriched;
    };

    // Load Inventory
    const loadInventory = async () => {
        setLoading(true);
        setError(null);
        
        console.log("Forge: Loading inventory...");

        if (!window.electronAPI?.p2pRead) {
            const msg = "System Interface (ElectronAPI) not ready.";
            console.error(msg);
            setError(msg);
            setLoading(false);
            return;
        }

        try {
            let items: string[] = [];
            try {
                items = await window.electronAPI.p2pRead(CARD_LIBRARY_CORE_NAME);
                console.log(`Forge: Read ${items.length} items from card-library`);
            } catch (e) {
                console.warn("Card library not found or empty", e);
                items = [];
            }

            const parsedMap = new Map<string, CardIndexEntry>();

            for (const raw of items) {
                if (!raw || typeof raw !== 'string') continue;
                try {
                    const data = JSON.parse(raw);
                    if (!data || data.type !== 'card-index') continue;
                    
                    const cardId = String(data.cardId || data.id || '');
                    if (!cardId) continue;

                    const entry: CardIndexEntry = {
                        cardId,
                        name: data.name,
                        createdAt: data.createdAt,
                        coreName: data.coreName,
                        thumbnail: data.thumbnail,
                        mediaKind: data.mediaKind,
                        raw: data
                    };

                    const existing = parsedMap.get(cardId);
                    if (existing) {
                        parsedMap.set(cardId, { ...existing, ...entry });
                    } else {
                        parsedMap.set(cardId, entry);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }

            const parsed = Array.from(parsedMap.values());
            console.log(`Forge: Parsed ${parsed.length} unique cards before enrichment`);
            
            // Safe Sort by newest
            parsed.sort((a, b) => {
                const dateA = String(a.createdAt || '');
                const dateB = String(b.createdAt || '');
                return dateB.localeCompare(dateA);
            });
            
            // Enrich with actual data
            const enriched = await enrichWithCardRecords(parsed);
            console.log(`Forge: Enriched ${enriched.length} cards`);

            // Re-sort after enrichment just in case enrichment added better dates (though usually it doesn't)
            enriched.sort((a, b) => {
                const dateA = String(a.createdAt || '');
                const dateB = String(b.createdAt || '');
                return dateB.localeCompare(dateA);
            });

            setInventory(enriched);
        } catch (e: any) {
            console.error("Failed to load forge inventory", e);
            setError(e.message || "Failed to load inventory");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    // Filter Inventory
    const filteredInventory = inventory.filter(c => {
        const searchLower = search.toLowerCase();
        const nameMatch = (c.name || 'Untitled').toLowerCase().includes(searchLower);
        const idMatch = (c.cardId || '').toLowerCase().includes(searchLower);
        return nameMatch || idMatch;
    });

    // ... (Drag Handlers keep existing)

    const handleManifestAppearance = async () => {
        if (!forgedAvatar || !window.electronAPI?.generateVideoWithGemini) return;
        
        setManifesting(true);
        console.log('[Forge Video] Starting video generation for:', forgedAvatar.name);
        
        try {
            // Use Veo to generate a "Motion Portrait"
            const videoPrompt = `A cinematic, mystical portrait of ${forgedAvatar.name}, ${forgedAvatar.archetype}. ${forgedAvatar.visualPrompt}. 8k resolution, highly detailed, rpg character art style.`;
            console.log('[Forge Video] Prompt:', videoPrompt);
            
            const result = await window.electronAPI.generateVideoWithGemini({
                prompt: videoPrompt,
                durationSeconds: '8', // Use 8s as it's a standard supported duration
                aspectRatio: '9:16', // Portrait mode
                loopMode: true // Implicitly handled by backend if supported, or we just loop the video
            });
            
            console.log('[Forge Video] Result:', result);

            if (result && result.localPath) {
                const path = result.localPath;
                // Ensure proper file URL format for Electron
                const normalizedPath = path.replace(/\\/g, '/');
                const url = normalizedPath.startsWith('file://') ? normalizedPath : `file:///${normalizedPath}`;
                
                console.log('[Forge Video] Path:', path);
                console.log('[Forge Video] URL:', url);
                
                // Update state
                setGeneratedVisualPath(path);
                setGeneratedVisualUrl(url);
                
                // Persist to avatar state immediately so it doesn't get lost
                setForgedAvatar(prev => {
                    if (!prev) return null;
                    const updated = {
                        ...prev,
                        video: {
                            localPath: path,
                            mimeType: result.mimeType || 'video/mp4'
                        }
                    };
                    console.log('[Forge Video] Updated avatar state:', updated.video);
                    return updated;
                });

                showToast('success', 'Manifestation Complete', 'The avatar has taken physical form.');
            } else {
                console.error('[Forge Video] No localPath in result:', result);
                showToast('error', 'Video Error', 'Video was generated but path is missing.');
            }
        } catch (e) {
            console.error("[Forge Video] Manifestation failed:", e);
            showToast('error', 'Manifestation Failed', 'The visual form could not be stabilized.');
        } finally {
            setManifesting(false);
        }
    };

    const handleBindSoul = async () => {
        if (!forgedAvatar || !window.electronAPI?.p2pCreateCore) return;

        try {
            const cardId = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            
            // 1. Create Avatar Record
            const avatarRecord = {
                type: 'avatar',
                id: cardId,
                name: forgedAvatar.name,
                kind: 'pet', // Treat as pet/entity for now
                subType: 'avatar',
                createdAt: new Date().toISOString(),
                
                // The Soul
                profile: {
                    archetype: forgedAvatar.archetype,
                    bio: forgedAvatar.bio,
                    voiceSamples: forgedAvatar.voiceSamples,
                    moveSet: forgedAvatar.moveSet,
                    visualPrompt: forgedAvatar.visualPrompt
                },
                
                // Stats
                stats: forgedAvatar.stats,
                
                // Lineage
                lineage: {
                    love: redStack.map(i => i.card.cardId),
                    truth: blueStack.map(i => i.card.cardId),
                    conviction: greenStack.map(i => i.card.cardId)
                },

                // Media (The Manifested Video)
                video: generatedVisualPath ? {
                    localPath: generatedVisualPath,
                    mimeType: 'video/mp4'
                } : undefined,
                
                // Fallback image (if we had one, or use video thumbnail)
                thumbnail: null 
            };

            // 2. Save to Hypercore
            await window.electronAPI.p2pCreateCore(cardId);
            await window.electronAPI.p2pAppend({
                name: cardId,
                data: JSON.stringify(avatarRecord)
            });

            // 3. Index in Card Library
            await window.electronAPI.p2pAppend({
                name: 'card-library',
                data: JSON.stringify({
                    type: 'card-index',
                    cardId: cardId,
                    coreName: cardId,
                    name: forgedAvatar.name,
                    createdAt: avatarRecord.createdAt,
                    mediaKind: 'pet', // Shows up as Pet/Avatar
                    thumbnail: null // Will need to generate thumb from video later
                })
            });

            // 4. Reset / Success
            showToast('success', 'Soul Bound!', `${forgedAvatar.name} has entered the Hapaverse.`);
            setForgedAvatar(null);
            setRedStack([]);
            setBlueStack([]);
            setGreenStack([]);
            setGeneratedVisualUrl(null);
            setGeneratedVisualPath(null);

        } catch (e) {
            console.error("Binding failed:", e);
            showToast('error', 'Binding Failed', 'The soul could not be anchored to this realm.');
        }
    };

    // ... (handleForgeAvatar logic keeps existing)
    const handleInventoryDragStart = (e: React.DragEvent, card: CardIndexEntry) => {
        playPickUpSound();
        setDraggedCard(card);
        e.dataTransfer.effectAllowed = 'copy';
        // Standard Hapa Drag Data
        e.dataTransfer.setData('application/json', JSON.stringify({
            cardId: card.cardId,
            type: 'card-transfer',
            cardRecord: card.cardRecord
        }));
    };

    const handleInventoryDragEnd = () => {
        setDraggedCard(null);
    };

    const handleStackDragEnd = () => {
        setDraggedStackItem(null);
    };

    // Drag Handlers - Stack Source (Reordering)
    const handleStackDragStart = (e: React.DragEvent, item: StackedCard, pillar: TriadPillar, index: number) => {
        playPickUpSound();
        e.stopPropagation();
        setDraggedStackItem({ card: item, source: pillar, index });
        e.dataTransfer.effectAllowed = 'move';
    };

    // Drop Zone Handlers
    const handleDragOver = (e: React.DragEvent, pillar: TriadPillar) => {
        e.preventDefault();
        setDragOverPillar(pillar);
        e.dataTransfer.dropEffect = draggedStackItem ? 'move' : 'copy';
    };

    const handleDrop = (e: React.DragEvent, targetPillar: TriadPillar) => {
        e.preventDefault();
        setDragOverPillar(null);
        playDropSound();

        // Case 1: Dropping from Inventory
        if (draggedCard) {
            const newStackItem: StackedCard = {
                uid: `stack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                card: draggedCard
            };

            if (targetPillar === 'love') setRedStack(prev => [...prev, newStackItem]);
            if (targetPillar === 'truth') setBlueStack(prev => [...prev, newStackItem]);
            if (targetPillar === 'conviction') setGreenStack(prev => [...prev, newStackItem]);
            
            setDraggedCard(null);
            return;
        }

        // Case 2: Reordering / Moving between stacks
        if (draggedStackItem) {
            const { card, source, index } = draggedStackItem;
            
            // Remove from source
            if (source === 'love') setRedStack(prev => prev.filter(i => i.uid !== card.uid));
            if (source === 'truth') setBlueStack(prev => prev.filter(i => i.uid !== card.uid));
            if (source === 'conviction') setGreenStack(prev => prev.filter(i => i.uid !== card.uid));

            // Add to target (append for now, could add insert logic later)
            // We need to preserve the StackedCard wrapper or create new if needed, 
            // but we should probably just move the object.
            
            const itemToMove = card.card; // This is the StackedCard object actually

            if (targetPillar === 'love') setRedStack(prev => [...prev, itemToMove]);
            if (targetPillar === 'truth') setBlueStack(prev => [...prev, itemToMove]);
            if (targetPillar === 'conviction') setGreenStack(prev => [...prev, itemToMove]);

            setDraggedStackItem(null);
        }
    };

    const removeFromStack = (pillar: TriadPillar, uid: string) => {
        if (pillar === 'love') setRedStack(prev => prev.filter(i => i.uid !== uid));
        if (pillar === 'truth') setBlueStack(prev => prev.filter(i => i.uid !== uid));
        if (pillar === 'conviction') setGreenStack(prev => prev.filter(i => i.uid !== uid));
    };

    const handleForgeAvatar = async () => {
        if (redStack.length === 0 && blueStack.length === 0 && greenStack.length === 0) return;
        
        setIsForging(true);
        setForgingStep('Harmonizing Triad Energies...');
        setForgedAvatar(null);
        let success = false;

        try {
            // 1. Compile Inputs
            const formatStack = (stack: StackedCard[], stackName: string) => stack.map((item, i) => {
                const card = item.card;
                const rec = card.cardRecord || card.raw || {};
                
                // DEBUG: Log what we have
                console.log(`[Forge Debug] ${stackName} Card ${i+1}:`, {
                    name: card.name,
                    mediaKind: card.mediaKind,
                    hasCardRecord: !!card.cardRecord,
                    hasRaw: !!card.raw,
                    recordKeys: Object.keys(rec)
                });
                
                // Extract rich context - try multiple sources
                let context = '';
                
                // Try card record fields
                if (rec.text) context = rec.text;
                else if (rec.content) context = rec.content; // Message/Note
                else if (rec.description) context = rec.description; // Wiki/Entity
                else if (rec.bio) context = rec.bio; // Pet/Avatar
                else if (rec.messageContent) context = rec.messageContent;
                else if (card.messageContent) context = card.messageContent;
                
                // Try raw data if no context yet
                if (!context && card.raw) {
                    if (card.raw.text) context = card.raw.text;
                    else if (card.raw.content) context = card.raw.content;
                    else if (card.raw.description) context = card.raw.description;
                }
                
                // Fallback to extracted text or tags
                if (!context && rec.extractedText) context = `[OCR]: ${rec.extractedText.slice(0, 300)}...`;
                if (!context && rec.tags && rec.tags.length > 0) context = `[Tags]: ${rec.tags.join(', ')}`;
                
                // Media description fallback
                if (!context) {
                    if (card.mediaKind === 'image') context = `[Visual Memory] ${card.name}`;
                    else if (card.mediaKind === 'video') context = `[Motion Memory] ${card.name}`;
                    else context = `[Data Card] ${card.name || 'Untitled'} - No text content found`;
                }

                console.log(`[Forge Debug] ${stackName} Card ${i+1} Context:`, context.slice(0, 200));
                return `[${i+1}] ${card.name || 'Untitled'} | Type: ${card.mediaKind || 'Data'} | Context: ${context.slice(0, 500)}`;
            }).join('\n');
            
            const redContent = formatStack(redStack, 'RED');
            const blueContent = formatStack(blueStack, 'BLUE');
            const greenContent = formatStack(greenStack, 'GREEN');
            
            const inputs = `
RED STACK (LOVE/DESIRE - Primary Motivations):
${redContent || '(Empty - no cards in this pillar)'}

BLUE STACK (TRUTH/MEMORY - Context & Facts):
${blueContent || '(Empty - no cards in this pillar)'}

GREEN STACK (CONVICTION/EXECUTION - Methods & Skills):
${greenContent || '(Empty - no cards in this pillar)'}
            `;
            
            console.log('[Forge Debug] Full LLM Input:', inputs);

            setForgingStep('Synthesizing Soul Matrix...');

            // 2. Construct Prompt
            const systemPrompt = `
You are the Soul Forge, a mystical system that synthesizes new digital entities (Avatars) from three alchemical inputs:
1. LOVE (Red): The entity's Desire, Purpose, and "Why".
2. TRUTH (Blue): The entity's Memory, Knowledge base, and "What".
3. CONVICTION (Green): The entity's Will, Execution methods, and "How".

Your task is to analyze the provided card stacks and synthesize a cohesive Avatar personality.
- If Red (Desire) conflicts with Blue (Truth), the personality should reflect that internal conflict.
- If Green (Conviction) is weak, the agent might be dreamy or hesitant.
- If all three align, the agent is powerful and focused.

IMPORTANT: Return ONLY a valid JSON object. Do not include markdown formatting (no \`\`\`json blocks), explanations, or preamble.
Structure:
{
  "name": "A creative, thematic name for this avatar",
  "archetype": "A 2-3 word class description (e.g. 'Code Architect', 'Truth Seeker')",
  "bio": "A 2-3 sentence backstory synthesizing the inputs.",
  "visualPrompt": "A detailed prompt for an image generator to create a portrait of this avatar. Include art style (cyber-mystic, rpg, etc).",
  "voiceSamples": ["Array of 5 short phrases showing how they speak"],
  "moveSet": ["Array of 5 'Skills' or 'Abilities' derived from the Green/Conviction stack"],
  "stats": {
    "love": number (1-100 based on stack intensity),
    "truth": number (1-100 based on stack intensity),
    "conviction": number (1-100 based on stack intensity)
  }
}
`;

            // 3. Call LLM
            // ...
            
            let responseText = '';
            
            if (window.electronAPI?.chatWithGemini) {
                // Try Gemini first
                const result = await window.electronAPI.chatWithGemini({
                    message: inputs,
                    model: selectedModel,
                    history: [
                        { role: 'user', parts: [{ text: systemPrompt }] },
                        { role: 'model', parts: [{ text: "I understand. I will output only raw JSON representing the synthesized avatar." }] }
                    ]
                });
                
                // Handle new object response format
                if (typeof result === 'object' && result.content) {
                    responseText = result.content;
                } else if (typeof result === 'string') {
                    responseText = result;
                }
            } else {
                throw new Error("No LLM Provider available");
            }

            // If we got a string back directly
            if (responseText) {
                console.log("Raw Forge Response:", responseText);
                
                // --- Robust JSON Extraction & Parsing ---
                let data: ForgedAvatar | null = null;
                
                const extractAndParse = (text: string): any => {
                    // 1. Try extracting { ... } block
                    let jsonStr = text.trim();
                    // Remove markdown code blocks
                    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
                    
                    const firstOpen = jsonStr.indexOf('{');
                    const lastClose = jsonStr.lastIndexOf('}');
                    
                    if (firstOpen !== -1 && lastClose !== -1) {
                        jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
                    }

                    try {
                        return JSON.parse(jsonStr);
                    } catch (e) {
                        console.warn("Standard JSON parse failed, attempting repairs...", e);
                        
                        // 2. Attempt repairs
                        // Remove JS comments // ...
                        let repaired = jsonStr.replace(/\/\/.*$/gm, '');
                        // Attempt to fix trailing commas
                        repaired = repaired.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                        
                        try {
                            return JSON.parse(repaired);
                        } catch (e2) {
                            console.warn("Repaired JSON parse failed...", e2);
                            return null;
                        }
                    }
                };

                data = extractAndParse(responseText);

                // 3. Regex Fallback (Last Resort)
                if (!data) {
                    console.warn("Falling back to Regex extraction...");
                    data = {
                        name: (responseText.match(/"name"\s*:\s*"([^"]*)"/) || [])[1] || "Unknown Soul",
                        archetype: (responseText.match(/"archetype"\s*:\s*"([^"]*)"/) || [])[1] || "Glitch Entity",
                        bio: (responseText.match(/"bio"\s*:\s*"([^"]*)"/) || [])[1] || "A soul forged from fragmented data.",
                        visualPrompt: (responseText.match(/"visualPrompt"\s*:\s*"([^"]*)"/) || [])[1] || "A mysterious digital ghost, glitch art style",
                        voiceSamples: [], // Hard to parse arrays with regex reliably
                        moveSet: [],
                        stats: {
                            love: 50,
                            truth: 50,
                            conviction: 50
                        }
                    } as ForgedAvatar;
                    
                    // Attempt to parse stats specifically
                    const loveMatch = responseText.match(/"love"\s*:\s*(\d+)/);
                    if (loveMatch) data.stats.love = parseInt(loveMatch[1]);
                    
                    const truthMatch = responseText.match(/"truth"\s*:\s*(\d+)/);
                    if (truthMatch) data.stats.truth = parseInt(truthMatch[1]);
                    
                    const convictionMatch = responseText.match(/"conviction"\s*:\s*(\d+)/);
                    if (convictionMatch) data.stats.conviction = parseInt(convictionMatch[1]);
                }

                if (data && data.name) {
                    setForgedAvatar(data as ForgedAvatar);
                    setForgingStep('Avatar Manifested.');
                    success = true;
                } else {
                    console.error("Final Parse Failed. Response was:", responseText);
                    throw new Error(`Failed to extract soul data. The spirit refused to take form.`);
                }
            }

        } catch (e) {
            console.error("Forging failed:", e);
            setForgingStep('Ritual Failed: ' + (e as any).message);
            // Only auto-close on error
            setTimeout(() => setIsForging(false), 3000);
        } finally {
            // If successful, we close the loading overlay immediately to show the result
            if (success) {
                setIsForging(false);
            }
        }
    };

    const handleSaveCardContent = async (newContent: string) => {
        if (!inspectingCard || !window.electronAPI?.p2pAppend) return;

        try {
            const cardId = inspectingCard.cardId;
            const coreName = inspectingCard.coreName || cardId;

            // Fetch latest to get current state
            const records = await window.electronAPI.p2pRead(coreName);
            let latestRecord: any = {};
            for (const r of records) {
                try {
                    const p = JSON.parse(r);
                    if (p.type === 'card') latestRecord = p;
                } catch { }
            }

            const updatedRecord = {
                ...latestRecord,
                text: newContent, // Update text content
                updatedAt: new Date().toISOString()
            };

            await window.electronAPI.p2pAppend({
                name: coreName,
                data: JSON.stringify(updatedRecord)
            });

            // Refresh inventory to show update
            loadInventory();
            showToast('success', 'Changes Saved', 'Card content updated successfully.');
        } catch (e) {
            console.error("Failed to save card content:", e);
            showToast('error', 'Save Failed', 'Could not persist changes to the network.');
        }
    };

    const adapterForWorkspace = (entry: CardIndexEntry) => {
        // Adapt Forge CardIndexEntry to CardWorkspace expected props
        const record = entry.cardRecord || entry.raw || {};
        return {
            id: entry.cardId,
            coreName: entry.coreName,
            type: entry.mediaKind === 'image' ? 'image' : 
                  entry.mediaKind === 'video' ? 'video' : 
                  'text', // Default to text
            timestamp: new Date(entry.createdAt || Date.now()).getTime(),
            data: {
                title: entry.name,
                text: entry.messageContent || record.text || record.content || '',
                url: entry.mediaLocalPath ? `file:///${entry.mediaLocalPath.replace(/\\/g, '/')}` : entry.mediaRemoteUrl || entry.thumbnail,
                imageUrl: entry.mediaLocalPath ? `file:///${entry.mediaLocalPath.replace(/\\/g, '/')}` : entry.mediaRemoteUrl || entry.thumbnail,
                attachments: record.attachments || [],
                tags: record.tags || []
            }
        };
    };

    // Hover Preview Component
    const HoverPreview = ({ card }: { card: CardIndexEntry }) => {
        const quality = calculateCardQuality(card);
        const record = card.cardRecord || {};
        const description = card.messageContent || record.text || record.content || record.description || 'No description available.';
        
        return (
            <div className="absolute left-[340px] top-20 z-50 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200 pointer-events-none">
                {/* Media Header */}
                <div className="w-full aspect-video bg-black relative overflow-hidden">
                     {card.mediaKind === 'video' && (card.mediaLocalPath || card.mediaRemoteUrl) ? (
                        <video 
                            src={card.mediaLocalPath ? `file:///${card.mediaLocalPath.replace(/\\/g, '/')}` : card.mediaRemoteUrl} 
                            autoPlay muted loop className="w-full h-full object-cover opacity-80" 
                        />
                    ) : card.thumbnail || card.mediaRemoteUrl ? (
                        <img src={card.thumbnail || card.mediaRemoteUrl} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-950">
                            <rux-icon icon="article" size="large"></rux-icon>
                        </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent`}></div>
                    
                    {/* Tier Badge */}
                    <div className="absolute top-2 right-2">
                         <span className={`text-[10px] px-2 py-1 rounded border backdrop-blur-md font-bold uppercase shadow-lg ${quality.badgeClass.replace('absolute', '')}`}>
                            {quality.tierLabel}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-1 leading-tight">{card.name || 'Untitled Card'}</h3>
                    <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-400 font-mono uppercase">
                        <span>{card.mediaKind || 'Text'}</span>
                        <span>•</span>
                        <span>{new Date(card.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="text-xs text-gray-300 line-clamp-6 leading-relaxed">
                        {description}
                    </div>

                    {/* Stats / Tags if any */}
                    {record.tags && record.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                            {record.tags.slice(0, 5).map((t: string) => (
                                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">#{t}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- RENDERERS ---

    const renderPillar = (pillar: TriadPillar, title: string, description: string, items: StackedCard[], colorClass: string, bgClass: string) => {
        const isOver = dragOverPillar === pillar;
        
        return (
            <div 
                className={`flex-1 flex flex-col rounded-xl border-2 transition-all duration-300 relative overflow-hidden ${
                    isOver ? `${colorClass} bg-opacity-20` : 'border-gray-800 bg-gray-900/40'
                } ${isOver ? 'scale-[1.01] shadow-[0_0_30px_rgba(0,0,0,0.5)]' : ''}`}
                onDragOver={(e) => handleDragOver(e, pillar)}
                onDragLeave={() => setDragOverPillar(null)}
                onDrop={(e) => handleDrop(e, pillar)}
            >
                {/* Header */}
                <div className={`p-4 border-b border-gray-800 backdrop-blur-md ${bgClass}`}>
                    <h3 className={`text-lg font-bold uppercase tracking-widest ${colorClass.replace('border-', 'text-')}`}>
                        {title}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-wider">
                        {description}
                    </p>
                </div>

                {/* Stack Drop Zone */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 min-h-[400px]">
                    {items.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50 pointer-events-none">
                            <rux-icon icon="input" size="large"></rux-icon>
                            <span className="text-xs font-mono uppercase">Drop Cards Here</span>
                        </div>
                    )}
                    
                    {items.map((item, idx) => {
                        const quality = calculateCardQuality(item.card);
                        
                        // Calculate Energy Pulse Params based on Index (Priority)
                        // Index 0 = High Energy, Fast Pulse
                        // Index 3+ = Low Energy, Slow/Static
                        const duration = Math.min(6, 2 + (idx * 1.5)); // 2s, 3.5s, 5s...
                        const glowRadius = Math.max(2, 15 - (idx * 4)); // 15px, 11px, 7px...
                        
                        // Colors based on Pillar
                        let baseColor = 'rgba(255,255,255,0.5)';
                        let brightColor = 'rgba(255,255,255,0.9)';
                        let glowColor = 'rgba(255,255,255,0.8)';
                        
                        if (pillar === 'love') {
                            baseColor = 'rgba(244, 63, 94, 0.5)'; // Red-500
                            brightColor = 'rgba(244, 63, 94, 1)';
                            glowColor = 'rgba(244, 63, 94, 0.8)';
                        } else if (pillar === 'truth') {
                            baseColor = 'rgba(34, 211, 238, 0.5)'; // Cyan-400
                            brightColor = 'rgba(34, 211, 238, 1)';
                            glowColor = 'rgba(34, 211, 238, 0.8)';
                        } else if (pillar === 'conviction') {
                            baseColor = 'rgba(16, 185, 129, 0.5)'; // Emerald-500
                            brightColor = 'rgba(16, 185, 129, 1)';
                            glowColor = 'rgba(16, 185, 129, 0.8)';
                        }

                        const style = {
                            '--forge-anim-duration': `${duration}s`,
                            '--forge-glow-radius': `${glowRadius}px`,
                            '--forge-color-base': baseColor,
                            '--forge-color-bright': brightColor,
                            '--forge-color-glow': glowColor,
                            '--forge-color-dim': baseColor.replace('0.5', '0.1')
                        } as React.CSSProperties;

                        return (
                            <div 
                                key={item.uid}
                                draggable
                                onDragStart={(e) => handleStackDragStart(e, item, pillar, idx)}
                                onDragEnd={handleStackDragEnd}
                                onMouseEnter={() => playForgeHoverSound()}
                                style={style}
                                className={`relative group border-2 border-transparent rounded p-2 flex items-center gap-3 shadow-lg cursor-grab active:cursor-grabbing transition-all animate-card-appear forge-energy-card`}
                            >
                                {/* Priority Index */}
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-400 z-10">
                                    {idx + 1}
                                </div>

                                {/* Thumbnail */}
                                <div className="w-10 h-10 rounded bg-black/50 flex-shrink-0 overflow-hidden border border-gray-800">
                                    {item.card.thumbnail ? (
                                        <img src={item.card.thumbnail} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                                            <rux-icon icon="article" size="small"></rux-icon>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-gray-200 truncate leading-none mb-1">
                                        {item.card.name || 'Untitled'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] px-1 rounded border ${quality.badgeClass.replace('absolute', '')}`}>
                                            {quality.tierLabel}
                                        </span>
                                        <span className="text-[9px] text-gray-500 font-mono truncate">
                                            {item.card.mediaKind || 'text'}
                                        </span>
                                    </div>
                                </div>

                                {/* Remove Button */}
                                <button 
                                    onClick={() => removeFromStack(pillar, item.uid)}
                                    className="w-6 h-6 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <rux-icon icon="close" size="small"></rux-icon>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <PageContainer>
            <div className="flex h-full overflow-hidden bg-gray-950 text-white relative">
                {/* Render Hover Preview */}
                {hoveredCard && !draggedCard && !isForging && !inspectingCard && (
                    <HoverPreview card={hoveredCard} />
                )}

                {/* Full Detail Modal */}
                {inspectingCard && (
                    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
                        <div className="w-full h-full max-w-6xl bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700 relative">
                            <CardWorkspace 
                                card={adapterForWorkspace(inspectingCard)} 
                                onClose={() => setInspectingCard(null)}
                                onSave={handleSaveCardContent}
                            />
                        </div>
                    </div>
                )}

                {/* LEFT PANEL: INVENTORY */}
                <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900/50 backdrop-blur relative z-10">
                    {/* ... Header ... */}
                    <div className="p-4 border-b border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase flex items-center gap-2">
                                <rux-icon icon="photo-library" size="small"></rux-icon>
                                Inventory ({filteredInventory.length})
                            </h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setDebugMode(!debugMode)} 
                                    className={`text-[10px] px-1 rounded ${debugMode ? 'bg-red-500 text-white' : 'text-gray-500'}`}
                                    title="Toggle Debug"
                                >
                                    DBG
                                </button>
                                <button 
                                    onClick={loadInventory} 
                                    className="text-gray-500 hover:text-white transition-colors"
                                    title="Refresh Inventory"
                                >
                                    <rux-icon icon="refresh" size="small"></rux-icon>
                                </button>
                            </div>
                        </div>
                        <rux-input
                            type="search"
                            placeholder="Search memory..."
                            value={search}
                            onInput={(e: any) => setSearch(e.target.value)}
                            size="small"
                            className="w-full"
                        ></rux-input>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {/* ... Loading/Error states ... */}
                        {loading && (
                            <div className="flex justify-center p-4">
                                <rux-progress type="circular"></rux-progress>
                            </div>
                        )}
                        {/* ... */}
                        {!loading && !error && filteredInventory.length === 0 && (
                            <div className="p-8 text-center opacity-50">
                                <rux-icon icon="sd-card-alert" size="large" className="mb-2"></rux-icon>
                                <p className="text-xs font-mono uppercase">No Cards Found</p>
                                <p className="text-[10px] text-gray-500 mt-1">Total: {inventory.length}</p>
                            </div>
                        )}

                        {debugMode && !loading && (
                            <div className="p-2 bg-black text-green-400 font-mono text-[10px] overflow-x-hidden break-words">
                                <p>Total: {inventory.length}</p>
                                <p>Filtered: {filteredInventory.length}</p>
                                <pre>{JSON.stringify(filteredInventory.slice(0, 3), null, 2)}</pre>
                            </div>
                        )}
                        
                        {!loading && !debugMode && filteredInventory.map(card => {
                            const quality = calculateCardQuality(card);
                            return (
                                <div 
                                    key={card.cardId}
                                    draggable
                                    onDragStart={(e) => handleInventoryDragStart(e, card)}
                                    onDragEnd={handleInventoryDragEnd}
                                    onMouseEnter={() => setHoveredCard(card)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    className={`p-2 rounded border border-gray-800 bg-gray-900 hover:border-purple-500/50 hover:bg-gray-800 cursor-grab active:cursor-grabbing transition-all group flex gap-3 items-center`}
                                >
                                    <div className="w-8 h-8 rounded bg-black/30 flex-shrink-0 overflow-hidden relative">
                                        {card.thumbnail ? (
                                            <img src={card.thumbnail} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                 <rux-icon icon="article" size="extra-small" className="text-gray-600"></rux-icon>
                                            </div>
                                        )}
                                        <div className={`absolute inset-0 border ${quality.borderClass} opacity-50`}></div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium text-gray-300 truncate group-hover:text-white transition-colors">
                                            {card.name || 'Untitled'}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className={`text-[8px] ${quality.tier === 'common' ? 'text-gray-500' : quality.tier === 'legendary' ? 'text-orange-400' : 'text-blue-400'}`}>
                                                {quality.tierLabel}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Inspect Button (Only visible on hover) */}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent drag start if accidental
                                            setInspectingCard(card);
                                            setHoveredCard(null); // Hide hover preview
                                        }}
                                        className="w-6 h-6 rounded hover:bg-cyan-900/50 text-gray-500 hover:text-cyan-400 hover:shadow-[0_0_10px_rgba(34,211,238,0.5)] hover:border-cyan-500/50 border border-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md"
                                        title="Open Neural Interface"
                                    >
                                        <rux-icon icon="open-in-new" size="extra-small"></rux-icon>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MAIN STAGE: THE FORGE */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Background FX */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/5 rounded-full blur-3xl"></div>
                    </div>
                    {/* Header */}
                    <div className="relative z-10 p-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 font-serif">
                                Hapa's Forge
                            </h1>
                            <div className="text-xs font-mono text-gray-500 mt-1 tracking-widest">
                                RITUAL OF SYNTHESIS
                            </div>
                        </div>
                        
                        {!isForging && !forgedAvatar && (
                            <div className="flex items-center gap-3">
                                {/* Model Selector */}
                                <div className="relative group">
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="appearance-none bg-black/40 border border-purple-500/30 text-purple-300 text-xs font-mono py-2 pl-3 pr-8 rounded uppercase tracking-wider hover:border-purple-500/60 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                                    >
                                        {availableModels.length > 0 ? (
                                            availableModels.map(m => (
                                                <option key={m.name} value={m.name} className="bg-gray-900 text-gray-300">
                                                    {m.displayName}
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Exp)</option>
                                                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                            </>
                                        )}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-purple-500">
                                        <rux-icon icon="arrow-drop-down" size="extra-small"></rux-icon>
                                    </div>
                                </div>

                                <rux-button 
                                    size="large" 
                                    icon="whatshot"
                                    onClick={handleForgeAvatar}
                                    className="shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-shadow"
                                    disabled={redStack.length === 0 && blueStack.length === 0 && greenStack.length === 0}
                                >
                                    FORGE AVATAR
                                </rux-button>
                            </div>
                        )}
                    </div>

                    {/* CONTENT AREA: Either Pillars OR Generation View OR Result View */}
                    
                    {/* Loading Overlay */}
                    {isForging && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50 animate-pulse"></div>
                                <rux-progress type="circular" className="relative z-10 scale-150"></rux-progress>
                            </div>
                            <h2 className="text-2xl font-bold text-white mt-8 tracking-widest animate-pulse">
                                {forgingStep}
                            </h2>
                            <p className="text-sm font-mono text-purple-400 mt-2">
                                Constructing Neural Pathways...
                            </p>
                        </div>
                    )}

                    {/* Result View (Character Sheet) */}
                    {forgedAvatar && !isForging && (
                        <div className="flex-1 relative z-10 p-8 overflow-y-auto animate-in slide-in-from-bottom-10 duration-700">
                             <div className="max-w-4xl mx-auto bg-gray-900/80 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl relative">
                                {/* Top Gradient */}
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-green-500 to-blue-500"></div>
                                
                                <div className="flex flex-col md:flex-row">
                                    {/* Left: Visuals & Stats */}
                                    <div className="w-full md:w-1/3 p-8 border-r border-gray-700 bg-black/20">
                                        {/* Avatar Placeholder / Video */}
                                        <div className="aspect-[3/4] rounded-lg border-2 border-purple-500/30 bg-black/50 flex flex-col items-center justify-center relative overflow-hidden group">
                                            {generatedVisualUrl ? (
                                                <video 
                                                    src={generatedVisualUrl} 
                                                    autoPlay 
                                                    loop 
                                                    muted 
                                                    playsInline 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <>
                                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20"></div>
                                                    {manifesting ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <rux-progress type="circular"></rux-progress>
                                                            <span className="text-xs text-purple-400 font-mono animate-pulse">MANIFESTING...</span>
                                                        </div>
                                                    ) : (
                                                        <rux-icon icon="person" size="large" className="text-gray-600"></rux-icon>
                                                    )}
                                                </>
                                            )}
                                            
                                            {!generatedVisualUrl && !manifesting && (
                                                <div className="absolute bottom-0 w-full p-3 bg-black/80 backdrop-blur text-center">
                                                    <button 
                                                        onClick={handleManifestAppearance}
                                                        className="text-xs text-purple-400 hover:text-white uppercase font-bold tracking-wider flex items-center justify-center gap-2 w-full"
                                                    >
                                                        <rux-icon icon="auto-fix-high" size="extra-small"></rux-icon>
                                                        Manifest Appearance
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="mt-8 space-y-4">
                                            {/* ... Stats bars ... */}
                                            <div>
                                                <div className="flex justify-between text-[10px] uppercase font-bold text-red-400 mb-1">
                                                    <span>Love</span>
                                                    <span>{forgedAvatar.stats.love}%</span>
                                                </div>
                                                <rux-progress value={forgedAvatar.stats.love} max={100} className="[&::part(progress)]:bg-red-500"></rux-progress>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] uppercase font-bold text-blue-400 mb-1">
                                                    <span>Truth</span>
                                                    <span>{forgedAvatar.stats.truth}%</span>
                                                </div>
                                                <rux-progress value={forgedAvatar.stats.truth} max={100} className="[&::part(progress)]:bg-blue-500"></rux-progress>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] uppercase font-bold text-emerald-400 mb-1">
                                                    <span>Conviction</span>
                                                    <span>{forgedAvatar.stats.conviction}%</span>
                                                </div>
                                                <rux-progress value={forgedAvatar.stats.conviction} max={100} className="[&::part(progress)]:bg-emerald-500"></rux-progress>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Lore & Details */}
                                    <div className="flex-1 p-8">
                                        <div className="flex justify-between items-start mb-2">
                                            <h2 className="text-4xl font-bold text-white font-serif tracking-wide">{forgedAvatar.name}</h2>
                                            <div className="px-3 py-1 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-mono uppercase tracking-widest">
                                                {forgedAvatar.archetype}
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6">Level 1 Avatar</div>

                                        <div className="space-y-8">
                                            <div className="prose prose-invert max-w-none">
                                                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider border-b border-gray-700 pb-2 mb-3">Bio</h3>
                                                <p className="text-gray-300 leading-relaxed text-sm">
                                                    {forgedAvatar.bio}
                                                </p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider border-b border-gray-700 pb-2 mb-3">Voice Print</h3>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {forgedAvatar.voiceSamples.map((sample, i) => (
                                                        <div key={i} className="flex gap-3 items-start p-2 rounded bg-gray-800/50">
                                                            <rux-icon icon="format-quote" size="extra-small" className="text-purple-500 mt-1"></rux-icon>
                                                            <span className="text-sm text-gray-300 italic">"{sample}"</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider border-b border-gray-700 pb-2 mb-3">Move Set (Capabilities)</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {forgedAvatar.moveSet.map((move, i) => (
                                                        <span key={i} className="px-3 py-1.5 rounded bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase flex items-center gap-2">
                                                            <rux-icon icon="code" size="extra-small"></rux-icon>
                                                            {move}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-12 pt-6 border-t border-gray-700 flex justify-end gap-4">
                                            <rux-button secondary onClick={() => setForgedAvatar(null)}>
                                                Discard
                                            </rux-button>
                                            <rux-button icon="save" onClick={handleBindSoul}>
                                                Bind Soul (Save)
                                            </rux-button>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}

                    {/* The Pillars (Input View) - Only show if not viewing result */}
                    {!forgedAvatar && (
                        <div className={`flex-1 relative z-10 p-6 grid grid-cols-3 gap-6 h-full overflow-hidden pb-12 transition-opacity duration-500 ${isForging ? 'opacity-0' : 'opacity-100'}`}>
                            
                            {/* RED: LOVE / INTENT */}
                            {renderPillar(
                                'love', 
                                'Love', 
                                'Desire • Purpose • Soul', 
                                redStack, 
                                'border-red-500 text-red-500', 
                                'bg-red-900/10'
                            )}

                            {/* GREEN: CONVICTION / EXECUTION (Center) */}
                            {/* Note: Swapped visual order to match design doc: Red (Left), Green (Center), Blue (Right) */}
                            {renderPillar(
                                'conviction', 
                                'Conviction', 
                                'Will • Execution • Hand', 
                                greenStack, 
                                'border-emerald-500 text-emerald-500', 
                                'bg-emerald-900/10'
                            )}

                            {/* BLUE: TRUTH / MEMORY */}
                            {renderPillar(
                                'truth', 
                                'Truth', 
                                'Memory • Context • Mind', 
                                blueStack, 
                                'border-blue-500 text-blue-500', 
                                'bg-blue-900/10'
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
};

export default Forge;
