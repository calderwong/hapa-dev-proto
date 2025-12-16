import React, { Suspense, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Card3D } from './Card3D';
import { ComponentNode3D } from './ComponentNode3D';
import { CardConnections } from './CardConnections';
import { NexusNavigator } from './NexusNavigator';
import { Spaceship } from './Spaceship';
import { useViewer3DStore } from './viewer3DStore';
import { 
    extractGraphFromCard, 
    addCardRelationships, 
    type GraphNode 
} from './graphTypes';

const toFileUrl = (p?: string): string | undefined => {
    if (!p) return undefined;
    const raw = String(p);
    if (raw.startsWith('file://')) {
        if (!raw.startsWith('file:///')) {
            const after = raw.slice('file://'.length).replace(/\\/g, '/');
            if (/^[A-Za-z]:\//.test(after)) return `file:///${encodeURI(after)}`;
        }
        return raw;
    }
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw;
    }
    const normalized = raw.replace(/\\/g, '/');
    return `file:///${encodeURI(normalized)}`;
};

// Card tier calculation (simplified)
const calculateTier = (card: CardData): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' => {
    const badges = [];
    if (card.cardRecord?.summaries?.length) badges.push('summary');
    if (card.cardRecord?.keyTerms?.length) badges.push('keyTerms');
    if (card.cardRecord?.imageSet?.images?.length) badges.push('images');
    if (card.mediaKind === 'video') badges.push('video');
    
    if (badges.length >= 4) return 'mythic';
    if (badges.length >= 3) return 'legendary';
    if (badges.length >= 2) return 'epic';
    if (badges.length >= 1) return 'rare';
    return 'common';
};

// Get thumbnail URL from card
const getCardThumbnail = (card: CardData): string | undefined => {
    if (card.thumbnail) return toFileUrl(card.thumbnail);
    const rec = card.cardRecord || {};
    if (rec.video?.thumbnailDataUrl) {
        return String(rec.video.thumbnailDataUrl);
    }
    if (rec.video?.thumbnail) {
        return toFileUrl(rec.video.thumbnail);
    }
    const heroIdx = rec.imageSet?.heroIndex || 0;
    if (rec.imageSet?.images?.[heroIdx]?.localPath) {
        return toFileUrl(rec.imageSet.images[heroIdx].localPath);
    }
    if (rec.image?.localPath) {
        return toFileUrl(rec.image.localPath);
    }
    if (card.mediaLocalPath && card.mediaKind === 'image') {
        return toFileUrl(card.mediaLocalPath);
    }
    return undefined;
};

// Get video URL from card
const getCardVideo = (card: CardData): string | undefined => {
    if (card.mediaKind === 'video' && card.mediaLocalPath) {
        return toFileUrl(card.mediaLocalPath);
    }
    return undefined;
};

export interface CardData {
    cardId: string;
    name?: string;
    mediaKind?: string;
    thumbnail?: string;
    mediaLocalPath?: string;
    parentCardId?: string;
    cardRecord?: {
        parentCardId?: string;
        parentId?: string;
        childCardIds?: string[];
        children?: Array<{ cardId: string; type?: string; label?: string; imageUrl?: string; createdAt?: string }>;
        summaries?: any[];
        keyTerms?: any[];
        transcripts?: any[];
        imageSet?: {
            images?: { localPath: string; mimeType?: string; generatedAt?: string; craftedPrompt?: string }[];
            heroIndex?: number;
            displayOrder?: number[];
        };
        image?: { localPath: string; mimeType?: string };
        video?: { localPath: string; mimeType?: string; thumbnail?: string; thumbnailDataUrl?: string };
        audio?: { localPath: string; mimeType?: string };
        text?: string;
        content?: string;
        wormhole?: {
            transcripts?: any[];
            summaries?: any[];
            keyTerms?: any[];
        };
    };
}

function getCardParentId(card: CardData | undefined): string | undefined {
    if (!card) return undefined;
    return card.cardRecord?.parentCardId || card.parentCardId || card.cardRecord?.parentId;
}

function getCardChildIds(card: CardData | undefined): string[] {
    if (!card) return [];
    const ids = new Set<string>();

    (card.cardRecord?.childCardIds || []).forEach((id) => {
        if (id) ids.add(id);
    });

    (card.cardRecord?.children || []).forEach((c) => {
        if (c?.cardId) ids.add(c.cardId);
    });

    return Array.from(ids);
}

interface Card3DViewerProps {
    cards: CardData[];
    focusedCardId?: string;
    onCardSelect?: (cardId: string) => void;
    onClose?: () => void;
    onSearchQueryChange?: (q: string) => void;
    isSearching?: boolean;
    onRequestMoreGlobal?: () => void;
}

// Calculate positions for cards in constellation view
const calculateConstellationPositions = (
    focusedCard: CardData,
    parentCard: CardData | undefined,
    childCards: CardData[],
    siblingCards: CardData[],
    contextCards: CardData[] = [] // Nearby cards for context
): Map<string, [number, number, number]> => {
    const positions = new Map<string, [number, number, number]>();
    
    // Focused card at center
    positions.set(focusedCard.cardId, [0, 0, 0]);
    
    // Parent above
    if (parentCard) {
        positions.set(parentCard.cardId, [0, 2.5, -1.5]);
    }
    
    // Children in arc below
    childCards.forEach((child, i) => {
        const angle = (i - (childCards.length - 1) / 2) * 0.6;
        const x = Math.sin(angle) * 3;
        const z = Math.cos(angle) * 1.5 - 1;
        positions.set(child.cardId, [x, -2.5, z]);
    });
    
    // Siblings on sides (closer to center)
    siblingCards.forEach((sibling, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const offset = Math.floor(i / 2) + 1;
        positions.set(sibling.cardId, [side * 3 * offset, 0, -1]);
    });
    
    // Context cards - arrange in a ring around the constellation
    contextCards.forEach((card, i) => {
        if (positions.has(card.cardId)) return; // Skip if already positioned
        
        const angle = (i / contextCards.length) * Math.PI * 2 + Math.PI / 4;
        const radius = 5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius - 2;
        const y = (Math.random() - 0.5) * 1; // Slight vertical variation
        positions.set(card.cardId, [x, y, z]);
    });
    
    return positions;
};

type CameraPose = {
    target: [number, number, number];
    position: [number, number, number];
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CameraRig: React.FC<{
    pose: CameraPose | null;
    orbitRef: React.MutableRefObject<any | null>;
    onArrive?: () => void;
}> = ({ pose, orbitRef, onArrive }) => {
    const { camera } = useThree();
    const poseRef = useRef<CameraPose | null>(null);
    const settledFramesRef = useRef(0);
    const hasArrivedRef = useRef(false);

    useEffect(() => {
        poseRef.current = pose;
        settledFramesRef.current = 0;
        hasArrivedRef.current = false;
    }, [pose]);

    useFrame(() => {
        const currentPose = poseRef.current;
        const controls = orbitRef.current;
        if (!currentPose || !controls) return;

        const t = 0.12;
        const [tx, ty, tz] = currentPose.target;
        const [px, py, pz] = currentPose.position;

        controls.target.set(
            lerp(controls.target.x, tx, t),
            lerp(controls.target.y, ty, t),
            lerp(controls.target.z, tz, t),
        );

        camera.position.set(
            lerp(camera.position.x, px, t),
            lerp(camera.position.y, py, t),
            lerp(camera.position.z, pz, t),
        );

        controls.update();

        const dx = camera.position.x - px;
        const dy = camera.position.y - py;
        const dz = camera.position.z - pz;
        const posDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const txd = controls.target.x - tx;
        const tyd = controls.target.y - ty;
        const tzd = controls.target.z - tz;
        const targetDist = Math.sqrt(txd * txd + tyd * tyd + tzd * tzd);

        if (posDist < 0.03 && targetDist < 0.03) {
            settledFramesRef.current += 1;
        } else {
            settledFramesRef.current = 0;
        }

        if (!hasArrivedRef.current && settledFramesRef.current >= 8) {
            hasArrivedRef.current = true;
            poseRef.current = null;
            onArrive?.();
        }
    });

    return null;
};

type FormationType = 'spiral' | 'helix' | 'sphere' | 'grid' | 'cylinder' | 'wave' | 'dna';

const FORMATION_LABELS: Record<FormationType, string> = {
    spiral: 'SPIRAL',
    helix: 'HELIX',
    sphere: 'SPHERE',
    grid: 'GRID',
    cylinder: 'CYLINDER',
    wave: 'WAVE',
    dna: 'DNA',
};

const calculateFormationPositions = (
    orderedCards: CardData[],
    formation: FormationType,
): Map<string, [number, number, number]> => {
    const positions = new Map<string, [number, number, number]>();
    const n = orderedCards.length;
    if (n === 0) return positions;

    switch (formation) {
        case 'spiral': {
            // Flat golden-angle spiral (original)
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const spacing = 0.55;
            orderedCards.forEach((card, i) => {
                const r = spacing * Math.sqrt(i);
                const theta = i * goldenAngle;
                const x = r * Math.cos(theta);
                const z = r * Math.sin(theta);
                const y = ((i % 31) - 15) * 0.012;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'helix': {
            // Vertical helix / corkscrew
            const radius = 4;
            const pitch = 0.6; // vertical rise per revolution
            const turnsPerCard = 0.15;
            orderedCards.forEach((card, i) => {
                const theta = i * turnsPerCard * Math.PI * 2;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                const y = i * pitch - (n * pitch) / 2;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'sphere': {
            // Fibonacci sphere distribution
            const radius = Math.max(4, Math.sqrt(n) * 0.8);
            const goldenRatio = (1 + Math.sqrt(5)) / 2;
            orderedCards.forEach((card, i) => {
                const theta = 2 * Math.PI * i / goldenRatio;
                const phi = Math.acos(1 - 2 * (i + 0.5) / n);
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.cos(phi);
                const z = radius * Math.sin(phi) * Math.sin(theta);
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'grid': {
            // 3D grid with layers
            const cols = Math.ceil(Math.cbrt(n) * 1.5);
            const rows = Math.ceil(Math.sqrt(n / cols));
            const spacing = 3.5;
            orderedCards.forEach((card, i) => {
                const layer = Math.floor(i / (cols * rows));
                const inLayer = i % (cols * rows);
                const col = inLayer % cols;
                const row = Math.floor(inLayer / cols);
                const x = (col - cols / 2) * spacing;
                const y = (layer - Math.floor(n / (cols * rows)) / 2) * spacing * 1.2;
                const z = (row - rows / 2) * spacing;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'cylinder': {
            // Vertical cylinder with cards on surface
            const radius = 5;
            const cardsPerRing = Math.max(6, Math.ceil(Math.sqrt(n)));
            const ringSpacing = 2.5;
            orderedCards.forEach((card, i) => {
                const ring = Math.floor(i / cardsPerRing);
                const inRing = i % cardsPerRing;
                const theta = (inRing / cardsPerRing) * Math.PI * 2 + ring * 0.3;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                const y = ring * ringSpacing - (Math.floor(n / cardsPerRing) * ringSpacing) / 2;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'wave': {
            // Sinusoidal wave grid
            const cols = Math.ceil(Math.sqrt(n * 2));
            const spacing = 3;
            const amplitude = 3;
            const frequency = 0.4;
            orderedCards.forEach((card, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = (col - cols / 2) * spacing;
                const z = (row - Math.floor(n / cols) / 2) * spacing;
                const y = Math.sin(col * frequency) * Math.cos(row * frequency) * amplitude;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
        case 'dna': {
            // Double helix (DNA structure)
            const radius = 3;
            const pitch = 0.5;
            const turnsPerCard = 0.2;
            orderedCards.forEach((card, i) => {
                const strand = i % 2; // alternate between two strands
                const pairIndex = Math.floor(i / 2);
                const theta = pairIndex * turnsPerCard * Math.PI * 2 + strand * Math.PI;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                const y = pairIndex * pitch - (Math.floor(n / 2) * pitch) / 2;
                positions.set(card.cardId, [x, y, z]);
            });
            break;
        }
    }

    return positions;
};

export const Card3DViewer: React.FC<Card3DViewerProps> = ({
    cards,
    focusedCardId,
    onCardSelect,
    onClose,
    onSearchQueryChange,
    isSearching = false,
    onRequestMoreGlobal,
}) => {
    const { 
        viewMode, 
        globalMuted,
        focusCard,
        setGlobalMuted,
    } = useViewer3DStore();
    
    // Find focused card and its relationships
    const focusedCard = useMemo(() => 
        cards.find(c => c.cardId === focusedCardId) || cards[0],
        [cards, focusedCardId]
    );
    
    const parentCard = useMemo(() => {
        const parentId = getCardParentId(focusedCard);
        return parentId ? cards.find(c => c.cardId === parentId) : undefined;
    }, [focusedCard, cards]);
    
    const childCards = useMemo(() => {
        const focusedId = focusedCard?.cardId;
        if (!focusedId) return [];

        const childIds = new Set<string>();

        cards.forEach((c) => {
            const pid = getCardParentId(c);
            if (pid === focusedId) childIds.add(c.cardId);
        });

        getCardChildIds(focusedCard).forEach((id) => childIds.add(id));

        return Array.from(childIds)
            .map((id) => cards.find((c) => c.cardId === id))
            .filter(Boolean) as CardData[];
    }, [cards, focusedCard]);
    
    const siblingCards = useMemo(() => {
        if (!parentCard) return [];
        const parentId = parentCard.cardId;
        return cards.filter(c => 
            getCardParentId(c) === parentId &&
            c.cardId !== focusedCard?.cardId
        ).slice(0, 4); // Limit siblings shown
    }, [cards, parentCard, focusedCard]);
    
    // Context cards - nearby cards that aren't directly related
    const contextCards = useMemo(() => {
        if (!focusedCard) return [];
        
        const relatedIds = new Set<string>([focusedCard.cardId]);
        if (parentCard) relatedIds.add(parentCard.cardId);
        childCards.forEach(c => relatedIds.add(c.cardId));
        siblingCards.forEach(c => relatedIds.add(c.cardId));
        
        // If we have few related cards, add some context
        if (relatedIds.size < 5 && cards.length > 1) {
            const focusedIndex = cards.findIndex(c => c.cardId === focusedCard.cardId);
            const nearby: CardData[] = [];
            
            for (let i = 1; i <= 6 && nearby.length < 8; i++) {
                const prevIndex = focusedIndex - i;
                const nextIndex = focusedIndex + i;
                
                if (prevIndex >= 0 && !relatedIds.has(cards[prevIndex].cardId)) {
                    nearby.push(cards[prevIndex]);
                }
                if (nextIndex < cards.length && !relatedIds.has(cards[nextIndex].cardId)) {
                    nearby.push(cards[nextIndex]);
                }
            }
            return nearby;
        }
        return [];
    }, [focusedCard, parentCard, childCards, siblingCards, cards]);
    
    const [showComponents, setShowComponents] = useState(true);
    const [scopeMode, setScopeMode] = useState<'local' | 'global'>('local');
    const [formation, setFormation] = useState<FormationType>('spiral');
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isScopeSwitching, setIsScopeSwitching] = useState(false);
    const [globalEdgeCap, setGlobalEdgeCap] = useState<0 | 150 | 450>(450);
    const [edgeFilterStructural, setEdgeFilterStructural] = useState(true);
    const [edgeFilterFlow, setEdgeFilterFlow] = useState(true);
    const [edgeFilterParts, setEdgeFilterParts] = useState(true);
    const [shipMode, setShipMode] = useState(false);
    const [shipInvertY, setShipInvertY] = useState(false);
    const [hitCards, setHitCards] = useState<Set<string>>(new Set());

    const orbitRef = useRef<any | null>(null);
    const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
    const lastAutoFocusedCardIdRef = useRef<string | null>(null);
    
    // Extract graph nodes from focused card (components: images, videos, summaries, etc.)
    const graphData = useMemo(() => {
        if (!focusedCard) return { nodes: [], edges: [] };
        
        // Extract nodes from focused card
        let { nodes, edges } = extractGraphFromCard(focusedCard);
        
        // Add card relationships
        const withRelationships = addCardRelationships(cards, focusedCard.cardId, nodes, edges);
        
        return withRelationships;
    }, [focusedCard, cards]);
    
    // Calculate positions for component nodes (radiating from focused card)
    const componentPositions = useMemo(() => {
        const positions = new Map<string, [number, number, number]>();
        
        // Get component nodes (non-card nodes)
        const componentNodes = graphData.nodes.filter(n => n.type !== 'card');
        
        // Group by type for organized layout
        const byType: Record<string, GraphNode[]> = {};
        componentNodes.forEach(node => {
            if (!byType[node.type]) byType[node.type] = [];
            byType[node.type].push(node);
        });
        
        // Position each type group in a sector
        const typeOrder = ['image', 'video', 'audio', 'transcript', 'summary', 'keyterm', 'text', 'wiki'];
        let typeIndex = 0;
        
        typeOrder.forEach(type => {
            const nodesOfType = byType[type] || [];
            if (nodesOfType.length === 0) return;
            
            // Each type gets a sector of the circle around the focused card
            const sectorAngle = (typeIndex / typeOrder.length) * Math.PI * 2;
            const baseRadius = 2.5;
            
            nodesOfType.forEach((node, i) => {
                const angle = sectorAngle + (i * 0.25) - (nodesOfType.length * 0.125);
                const radius = baseRadius + (i % 2) * 0.5;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                const y = (i % 3 - 1) * 0.4;
                
                positions.set(node.id, [x, y, z]);
            });
            
            typeIndex++;
        });
        
        return positions;
    }, [graphData.nodes]);
    
    // Build component connections
    const componentConnections = useMemo(() => {
        if (!showComponents || scopeMode === 'global') return [];
        
        return graphData.edges
            .filter(edge => edge.type === 'card-component' || edge.type === 'derived-from')
            .map(edge => {
                const fromPos = edge.fromId === focusedCard?.cardId 
                    ? [0, 0, 0] as [number, number, number]
                    : componentPositions.get(edge.fromId) || [0, 0, 0];
                const toPos = componentPositions.get(edge.toId) || [0, 0, 0];
                
                return {
                    fromCardId: edge.fromId,
                    toCardId: edge.toId,
                    fromPosition: fromPos,
                    toPosition: toPos,
                    type: edge.type,
                };
            });
    }, [graphData.edges, focusedCard, componentPositions, showComponents, scopeMode]);
    
    const cardsToRender = useMemo(() => {
        if (scopeMode === 'global') {
            return cards;
        }

        const cardSet = new Set<CardData>();
        if (focusedCard) cardSet.add(focusedCard);
        if (parentCard) cardSet.add(parentCard);
        childCards.forEach(c => cardSet.add(c));
        siblingCards.forEach(c => cardSet.add(c));
        contextCards.forEach(c => cardSet.add(c));
        return Array.from(cardSet);
    }, [scopeMode, cards, focusedCard, parentCard, childCards, siblingCards, contextCards]);

    const filteredCards = useMemo(() => {
        const q = String(searchQuery || '').trim().toLowerCase();
        if (!q) return cardsToRender;

        const matches = cardsToRender.filter((c) => {
            const id = String(c.cardId || '').toLowerCase();
            const name = String(c.name || '').toLowerCase();
            return id.includes(q) || name.includes(q);
        });

        // Never lose context: keep the currently focused card visible even if it doesn't match.
        if (focusedCard && !matches.some((c) => c.cardId === focusedCard.cardId)) {
            return [focusedCard, ...matches];
        }

        return matches;
    }, [cardsToRender, searchQuery]);

    useEffect(() => {
        onSearchQueryChange?.(searchQuery);
    }, [onSearchQueryChange, searchQuery]);

    const orderedGlobalCards = useMemo(() => {
        if (!focusedCard) return filteredCards;
        const rest = filteredCards.filter((c) => c.cardId !== focusedCard.cardId);
        return [focusedCard, ...rest];
    }, [filteredCards, focusedCard]);

    const buildCameraPose = useCallback((target: [number, number, number], preset: 'focus' | 'top' | 'wide') => {
        const controls = orbitRef.current;

        const offset = (() => {
            if (preset === 'top') return [0, 12, 0.01] as [number, number, number];
            if (preset === 'wide') return [0, 0, 18] as [number, number, number];

            if (controls?.object?.position && controls?.target) {
                const cx = controls.object.position.x;
                const cy = controls.object.position.y;
                const cz = controls.object.position.z;
                const ox = cx - controls.target.x;
                const oy = cy - controls.target.y;
                const oz = cz - controls.target.z;
                return [ox, oy, oz] as [number, number, number];
            }
            return [0, 0, 8] as [number, number, number];
        })();

        return {
            target,
            position: [
                target[0] + offset[0],
                target[1] + offset[1],
                target[2] + offset[2],
            ] as [number, number, number],
        };
    }, []);

    // Calculate card positions
    const cardPositions = useMemo(() => {
        if (!focusedCard) return new Map();
        if (scopeMode === 'global') {
            return calculateFormationPositions(orderedGlobalCards, formation);
        }
        return calculateConstellationPositions(focusedCard, parentCard, childCards, siblingCards, contextCards);
    }, [focusedCard, scopeMode, orderedGlobalCards, formation, parentCard, childCards, siblingCards, contextCards]);

    const focusCameraOnCard = useCallback((cardId: string, preset: 'focus' | 'top' | 'wide' = 'focus') => {
        const pos = cardPositions.get(cardId) || [0, 0, 0];
        setCameraPose(buildCameraPose(pos as [number, number, number], preset));
    }, [buildCameraPose, cardPositions]);

    const enterLocalConstellation = useCallback(() => {
        if (!focusedCard) return;
        setScopeMode('local');
        setSearchQuery('');
        setShowComponents(true);
        // In local mode, the focused card is always at origin.
        setCameraPose(buildCameraPose([0, 0, 0], 'focus'));
    }, [buildCameraPose, focusedCard]);

    const toggleScopeMode = useCallback(() => {
        setIsScopeSwitching(true);
        // Allow the overlay to paint before we do the heavy recompute/mount.
        requestAnimationFrame(() => {
            setScopeMode((v) => {
                const next = v === 'global' ? 'local' : 'global';

                if (next === 'local') {
                    setSearchQuery('');
                    setShowComponents(true);
                    setCameraPose(buildCameraPose([0, 0, 0], 'focus'));
                } else {
                    setShowComponents(false);
                    lastAutoFocusedCardIdRef.current = null;
                }

                return next;
            });

            // Prevent flicker.
            setTimeout(() => setIsScopeSwitching(false), 250);
        });
    }, [buildCameraPose]);

    useEffect(() => {
        if (scopeMode !== 'global') return;
        const id = focusedCard?.cardId;
        if (!id) return;
        if (lastAutoFocusedCardIdRef.current === id) return;
        lastAutoFocusedCardIdRef.current = id;
        focusCameraOnCard(id, 'focus');
    }, [focusedCard?.cardId, focusCameraOnCard, scopeMode]);
    
    // Build connections
    const connections = useMemo(() => {
        const conns: any[] = [];
        const includedIds = new Set(filteredCards.map((c) => c.cardId));

        const edgeKeys = new Set<string>();
        const pushEdge = (edge: any) => {
            const key = `${edge.fromCardId}→${edge.toCardId}:${edge.type}`;
            if (edgeKeys.has(key)) return;
            edgeKeys.add(key);
            conns.push(edge);
        };

        if (scopeMode === 'global') {
            let count = 0;
            const maxEdges = globalEdgeCap;
            for (const card of filteredCards) {
                if (maxEdges === 0) break;
                if (count >= maxEdges) break;
                const parentId = getCardParentId(card);
                if (parentId && includedIds.has(parentId)) {
                    const fromPos = cardPositions.get(parentId);
                    const toPos = cardPositions.get(card.cardId);
                    if (fromPos && toPos) {
                        pushEdge({
                            fromCardId: parentId,
                            toCardId: card.cardId,
                            fromPosition: fromPos,
                            toPosition: toPos,
                            type: 'parent-child',
                        });
                        count++;
                    }
                }

                const childIds = getCardChildIds(card);
                for (const childId of childIds) {
                    if (count >= maxEdges) break;
                    if (!childId) continue;
                    if (!includedIds.has(childId)) continue;
                    const fromPos = cardPositions.get(card.cardId);
                    const toPos = cardPositions.get(childId);
                    if (!fromPos || !toPos) continue;
                    pushEdge({
                        fromCardId: card.cardId,
                        toCardId: childId,
                        fromPosition: fromPos,
                        toPosition: toPos,
                        type: 'parent-child',
                    });
                    count++;
                }
            }
            return conns;
        }
        
        if (parentCard && focusedCard) {
            const parentPos = cardPositions.get(parentCard.cardId) || [0, 3, -2];
            const focusedPos = cardPositions.get(focusedCard.cardId) || [0, 0, 0];
            pushEdge({
                fromCardId: parentCard.cardId,
                toCardId: focusedCard.cardId,
                fromPosition: parentPos,
                toPosition: focusedPos,
                type: 'parent-child',
            });
        }
        
        childCards.forEach(child => {
            const childPos = cardPositions.get(child.cardId) || [0, -3, 0];
            const fromId = focusedCard?.cardId;
            if (!fromId) return;
            const focusedPos = cardPositions.get(fromId) || [0, 0, 0];
            pushEdge({
                fromCardId: fromId,
                toCardId: child.cardId,
                fromPosition: focusedPos,
                toPosition: childPos,
                type: 'parent-child',
            });
        });

        siblingCards.forEach(sibling => {
            const siblingPos = cardPositions.get(sibling.cardId);
            const fromId = focusedCard?.cardId;
            if (!fromId) return;
            const focusedPos = cardPositions.get(fromId) || [0, 0, 0];
            if (!siblingPos) return;
            pushEdge({
                fromCardId: fromId,
                toCardId: sibling.cardId,
                fromPosition: focusedPos,
                toPosition: siblingPos,
                type: 'sibling',
            });
        });
        
        return conns;
    }, [scopeMode, filteredCards, cardPositions, parentCard, focusedCard, childCards, siblingCards, globalEdgeCap]);

    const filteredConnections = useMemo(() => {
        return connections.filter((c: { type: string }) => {
            if (c.type === 'card-component') return edgeFilterParts;
            if (c.type === 'parent-child' || c.type === 'sibling') return edgeFilterStructural;
            if (c.type === 'extraction' || c.type === 'generated' || c.type === 'reference' || c.type === 'derived-from') {
                return edgeFilterFlow;
            }
            return true;
        });
    }, [connections, edgeFilterFlow, edgeFilterParts, edgeFilterStructural]);

    const filteredComponentConnections = useMemo(() => {
        return componentConnections.filter((c: { type: string }) => {
            if (c.type === 'card-component') return edgeFilterParts;
            if (c.type === 'derived-from') return edgeFilterFlow;
            return true;
        });
    }, [componentConnections, edgeFilterFlow, edgeFilterParts]);
    
    // Navigation handlers
    const handleNavigateParent = useCallback(() => {
        if (parentCard) {
            focusCard(parentCard.cardId);
            onCardSelect?.(parentCard.cardId);
        }
    }, [parentCard, focusCard, onCardSelect]);
    
    const handleNavigateChild = useCallback((index: number) => {
        if (childCards[index]) {
            focusCard(childCards[index].cardId);
            onCardSelect?.(childCards[index].cardId);
        }
    }, [childCards, focusCard, onCardSelect]);
    
    const handleNavigateNext = useCallback(() => {
        if (siblingCards.length > 0) {
            focusCard(siblingCards[0].cardId);
            onCardSelect?.(siblingCards[0].cardId);
        }
    }, [siblingCards, focusCard, onCardSelect]);
    
    const handleNavigatePrev = useCallback(() => {
        if (siblingCards.length > 1) {
            focusCard(siblingCards[siblingCards.length - 1].cardId);
            onCardSelect?.(siblingCards[siblingCards.length - 1].cardId);
        }
    }, [siblingCards, focusCard, onCardSelect]);
    
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case '1': case '2': case '3': case '4': case '5':
                    // View modes handled by store
                    break;
                case 'r': case 'R':
                    useViewer3DStore.getState().resetView();
                    break;
                case 'm': case 'M':
                    setGlobalMuted(!globalMuted);
                    break;
                case 'Escape':
                    onClose?.();
                    break;
                case 'ArrowUp':
                    handleNavigateParent();
                    break;
                case 'ArrowDown':
                    handleNavigateChild(0);
                    break;
                case 'ArrowLeft':
                    handleNavigatePrev();
                    break;
                case 'ArrowRight':
                    handleNavigateNext();
                    break;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [globalMuted, setGlobalMuted, onClose, handleNavigateParent, handleNavigateChild, handleNavigatePrev, handleNavigateNext]);
    
    return (
        <div className="fixed inset-0 z-50 bg-black">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-3 bg-gray-900/80 hover:bg-red-500/30 border border-gray-700 hover:border-red-500/50 rounded-lg text-gray-400 hover:text-red-400 transition-all"
                title="Close (Esc)"
            >
                <span className="text-xl">✕</span>
            </button>

            <div className="absolute top-4 right-16 z-50 flex items-center gap-2">
                <button
                    onClick={() => setLeftOpen((v) => !v)}
                    className="px-2 py-1 rounded text-[10px] font-mono bg-gray-900/70 border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-cyan-500/40 transition-all"
                    title="Toggle Nexus Rail"
                >
                    RAIL
                </button>
                <button
                    onClick={() => setRightOpen((v) => !v)}
                    className="px-2 py-1 rounded text-[10px] font-mono bg-gray-900/70 border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-cyan-500/40 transition-all"
                    title="Toggle Inspector"
                >
                    INSPECT
                </button>
            </div>
            
            {/* Title bar */}
            <div className="absolute top-4 left-4 z-50">
                <div className="bg-gray-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-3">
                        <span className="text-cyan-400 text-xl">◈</span>
                        <div>
                            <div className="text-cyan-300 font-mono text-sm font-bold">CARD NEXUS</div>
                            <div className="text-gray-500 text-xs font-mono">
                                {focusedCard?.name || 'No card selected'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {leftOpen && (
                <div className="absolute top-20 left-4 z-50 w-72">
                    <div className="bg-gray-950/80 backdrop-blur-sm border border-cyan-500/20 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-800/70 flex items-center justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Nexus Rail</div>
                            <div className="text-[10px] font-mono text-gray-500">{filteredCards.length}/{cardsToRender.length}</div>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Search</div>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="name or id"
                                    className="mt-1 w-full bg-gray-900/70 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500/40"
                                />
                                {isSearching && (
                                    <div className="mt-1 text-[9px] font-mono text-cyan-300/80 tracking-wider">
                                        SEARCHING…
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleScopeMode}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                        scopeMode === 'global'
                                            ? 'bg-purple-900/25 border-purple-500/30 text-purple-200'
                                            : 'bg-gray-900/50 border-gray-800 text-gray-400'
                                    }`}
                                    title={scopeMode === 'global' ? 'Viewing global graph' : 'Viewing local constellation'}
                                >
                                    {scopeMode === 'global' ? 'GLOBAL' : 'LOCAL'}
                                </button>
                                <button
                                    onClick={() => setShowComponents((v) => !v)}
                                    disabled={scopeMode === 'global'}
                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                        scopeMode === 'global'
                                            ? 'bg-gray-900/10 border-gray-800 text-gray-600 cursor-not-allowed'
                                            : showComponents
                                                ? 'bg-cyan-900/30 border-cyan-500/30 text-cyan-200'
                                                : 'bg-gray-900/50 border-gray-800 text-gray-500'
                                    }`}
                                >
                                    PARTS
                                </button>
                                <button
                                    onClick={() => useViewer3DStore.getState().resetView()}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono bg-gray-900/50 border border-gray-800 text-gray-300 hover:border-cyan-500/30"
                                >
                                    RESET
                                </button>
                            </div>
                            {scopeMode === 'global' && (
                                <button
                                    onClick={enterLocalConstellation}
                                    className="w-full px-2 py-2 rounded-lg text-[10px] font-mono bg-cyan-900/20 border border-cyan-500/25 text-cyan-200 hover:border-cyan-500/50 transition-all"
                                >
                                    ENTER LOCAL CONSTELLATION
                                </button>
                            )}
                            {scopeMode === 'global' && (
                                <button
                                    onClick={() => onRequestMoreGlobal?.()}
                                    disabled={!onRequestMoreGlobal}
                                    className={`w-full px-2 py-2 rounded-lg text-[10px] font-mono border transition-all ${
                                        onRequestMoreGlobal
                                            ? 'bg-gray-900/50 border-gray-800 text-gray-200 hover:border-cyan-500/30'
                                            : 'bg-gray-900/10 border-gray-800 text-gray-600 cursor-not-allowed'
                                    }`}
                                    title="Load more cards into the global feed"
                                >
                                    LOAD MORE
                                </button>
                            )}
                            {scopeMode === 'global' && (
                                <div className="flex items-center gap-2">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Edges</div>
                                    <button
                                        onClick={() => setGlobalEdgeCap(0)}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                            globalEdgeCap === 0
                                                ? 'bg-purple-900/20 border-purple-500/35 text-purple-200'
                                                : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-purple-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        0
                                    </button>
                                    <button
                                        onClick={() => setGlobalEdgeCap(150)}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                            globalEdgeCap === 150
                                                ? 'bg-purple-900/20 border-purple-500/35 text-purple-200'
                                                : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-purple-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        150
                                    </button>
                                    <button
                                        onClick={() => setGlobalEdgeCap(450)}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all ${
                                            globalEdgeCap === 450
                                                ? 'bg-purple-900/20 border-purple-500/35 text-purple-200'
                                                : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-purple-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        450
                                    </button>
                                </div>
                            )}
                            <div className="rounded-lg bg-gray-900/40 border border-gray-800/70 p-2">
                                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Legend</div>
                                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                    <div className={`flex items-center gap-2 ${edgeFilterStructural ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-4 border-solid border-cyan-400" />
                                        <span className="text-[9px] text-gray-200">Parent/Child</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterStructural ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-2 border-solid border-emerald-400" />
                                        <span className="text-[9px] text-gray-200">Sibling</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterParts ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t border-solid border-gray-400/70" />
                                        <span className="text-[9px] text-gray-200">Parts</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterFlow ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-2 border-dashed border-purple-400" />
                                        <span className="text-[9px] text-gray-200">Extract/Derived</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterFlow && scopeMode !== 'global' && showComponents ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-2 border-dashed border-purple-300" />
                                        <span className="text-[9px] text-gray-200">Derived (Parts)</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterFlow ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-2 border-dashed border-amber-400" />
                                        <span className="text-[9px] text-gray-200">Generated</span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${edgeFilterFlow ? '' : 'opacity-40'}`}>
                                        <span className="w-6 border-t-2 border-dashed border-blue-400" />
                                        <span className="text-[9px] text-gray-200">Reference</span>
                                    </div>
                                </div>
                                {scopeMode !== 'global' && showComponents && (
                                    <div className="mt-2 text-[9px] text-gray-400">
                                        FLOW also toggles component <span className="font-mono text-gray-300">derived-from</span> edges in LOCAL.
                                    </div>
                                )}
                            </div>
                            <div className="rounded-lg bg-gray-900/40 border border-gray-800/70 p-2">
                                <div className="flex items-center justify-between">
                                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Filters</div>
                                    <button
                                        onClick={() => {
                                            setEdgeFilterStructural(true);
                                            setEdgeFilterFlow(true);
                                            setEdgeFilterParts(true);
                                        }}
                                        className="text-[9px] font-mono text-gray-400 hover:text-gray-200"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-1">
                                    <button
                                        onClick={() => setEdgeFilterStructural(v => !v)}
                                        className={`px-2 py-1 rounded text-[9px] font-mono border transition-all ${
                                            edgeFilterStructural
                                                ? 'bg-cyan-900/20 border-cyan-500/35 text-cyan-200'
                                                : 'bg-gray-900/40 border-gray-800 text-gray-500 hover:border-cyan-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        STRUCT
                                    </button>
                                    <button
                                        onClick={() => setEdgeFilterFlow(v => !v)}
                                        className={`px-2 py-1 rounded text-[9px] font-mono border transition-all ${
                                            edgeFilterFlow
                                                ? 'bg-purple-900/20 border-purple-500/35 text-purple-200'
                                                : 'bg-gray-900/40 border-gray-800 text-gray-500 hover:border-purple-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        FLOW
                                    </button>
                                    <button
                                        onClick={() => setEdgeFilterParts(v => !v)}
                                        className={`px-2 py-1 rounded text-[9px] font-mono border transition-all ${
                                            edgeFilterParts
                                                ? 'bg-gray-800/40 border-gray-500/35 text-gray-200'
                                                : 'bg-gray-900/40 border-gray-800 text-gray-500 hover:border-gray-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        PARTS
                                    </button>
                                </div>
                            </div>
                            {scopeMode === 'global' && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Formation</div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {(Object.keys(FORMATION_LABELS) as FormationType[]).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setFormation(f)}
                                                className={`px-1.5 py-1.5 rounded text-[9px] font-mono border transition-all ${
                                                    formation === f
                                                        ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200'
                                                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-emerald-500/25 hover:text-gray-200'
                                                }`}
                                            >
                                                {FORMATION_LABELS[f]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (!focusedCard) return;
                                        focusCameraOnCard(focusedCard.cardId, 'focus');
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono bg-gray-900/50 border border-gray-800 text-gray-300 hover:border-cyan-500/30"
                                >
                                    FOCUS
                                </button>
                                <button
                                    onClick={() => {
                                        if (!focusedCard) return;
                                        focusCameraOnCard(focusedCard.cardId, 'top');
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono bg-gray-900/50 border border-gray-800 text-gray-300 hover:border-cyan-500/30"
                                >
                                    TOP
                                </button>
                                <button
                                    onClick={() => {
                                        if (!focusedCard) return;
                                        focusCameraOnCard(focusedCard.cardId, 'wide');
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono bg-gray-900/50 border border-gray-800 text-gray-300 hover:border-cyan-500/30"
                                >
                                    WIDE
                                </button>
                            </div>
                            
                            {/* Ship Mode Toggle */}
                            <button
                                onClick={() => setShipMode(v => !v)}
                                className={`w-full px-2 py-2 rounded-lg text-[10px] font-mono border transition-all flex items-center justify-center gap-2 ${
                                    shipMode
                                        ? 'bg-orange-900/30 border-orange-500/40 text-orange-200'
                                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:border-orange-500/30 hover:text-orange-300'
                                }`}
                            >
                                <span className="text-lg">🚀</span>
                                {shipMode ? 'EXIT SHIP' : 'FLY SHIP'}
                            </button>
                            {shipMode && (
                                <div className="text-[9px] text-gray-500 bg-gray-900/50 rounded p-2 border border-gray-800">
                                    <div className="font-bold text-orange-400 mb-1">CONTROLS:</div>
                                    <button
                                        onClick={() => setShipInvertY(v => !v)}
                                        className={`w-full mb-2 px-2 py-1 rounded border text-[9px] font-mono transition-all ${
                                            shipInvertY
                                                ? 'bg-cyan-900/25 border-cyan-500/35 text-cyan-200'
                                                : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:border-cyan-500/25 hover:text-gray-200'
                                        }`}
                                    >
                                        INVERT Y: {shipInvertY ? 'ON' : 'OFF'}
                                    </button>
                                    <div>WASD / Arrows - Steer</div>
                                    <div>Shift - Thrust forward</div>
                                    <div>Ctrl - Reverse</div>
                                    <div>Q/E - Up/Down</div>
                                    <div>Space/Click - Fire!</div>
                                    <div className="mt-1 text-cyan-400">Hits: {hitCards.size}</div>
                                </div>
                            )}
                            
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Cards</div>
                                <div className="mt-2 max-h-64 overflow-auto space-y-1">
                                    {filteredCards.slice(0, 40).map((c) => {
                                        const active = c.cardId === focusedCard?.cardId;
                                        return (
                                            <button
                                                key={c.cardId}
                                                onClick={() => {
                                                    focusCard(c.cardId);
                                                    onCardSelect?.(c.cardId);
                                                    focusCameraOnCard(c.cardId, 'focus');
                                                }}
                                                className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition-all ${
                                                    active
                                                        ? 'bg-cyan-900/25 border-cyan-500/30 text-cyan-200'
                                                        : 'bg-gray-900/30 border-gray-800/70 text-gray-300 hover:border-cyan-500/20 hover:text-white'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-mono">{c.name || c.cardId}</div>
                                                        <div className="truncate text-[10px] text-gray-500 font-mono">{c.cardId}</div>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-mono flex-shrink-0">{String(c.mediaKind || 'doc').toUpperCase()}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {filteredCards.length > 40 && (
                                        <div className="text-[10px] text-gray-500 font-mono px-1">+{filteredCards.length - 40} more…</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {rightOpen && (
                <div className="absolute top-20 right-4 z-50 w-[360px] max-w-[40vw]">
                    <div className="bg-gray-950/80 backdrop-blur-sm border border-purple-500/20 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-800/70 flex items-center justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Inspector</div>
                            <div className="text-[10px] font-mono text-gray-500">{focusedCard?.mediaKind || 'document'}</div>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <div className="text-sm text-white font-mono truncate">{focusedCard?.name || 'No card selected'}</div>
                                <div className="text-[10px] text-gray-500 font-mono truncate">{focusedCard?.cardId}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-lg bg-gray-900/40 border border-gray-800/70 p-2">
                                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Children</div>
                                    <div className="text-xs font-mono text-purple-200">{childCards.length}</div>
                                </div>
                                <div className="rounded-lg bg-gray-900/40 border border-gray-800/70 p-2">
                                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Parts</div>
                                    <div className="text-xs font-mono text-cyan-200">{graphData.nodes.filter(n => n.type !== 'card').length}</div>
                                </div>
                                <div className="rounded-lg bg-gray-900/40 border border-gray-800/70 p-2">
                                    <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Edges</div>
                                    <div className="text-xs font-mono text-gray-200">{graphData.edges.length}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Lineage</div>
                                <div className="space-y-1">
                                    <button
                                        disabled={!parentCard}
                                        onClick={() => {
                                            if (!parentCard) return;
                                            focusCard(parentCard.cardId);
                                            onCardSelect?.(parentCard.cardId);
                                        }}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                                            parentCard
                                                ? 'bg-gray-900/30 border-cyan-500/20 text-cyan-200 hover:border-cyan-500/40'
                                                : 'bg-gray-900/10 border-gray-800 text-gray-600 cursor-not-allowed'
                                        }`}
                                    >
                                        ▲ {parentCard?.name || 'No parent'}
                                    </button>
                                    {childCards.slice(0, 6).map((c) => (
                                        <button
                                            key={c.cardId}
                                            onClick={() => {
                                                focusCard(c.cardId);
                                                onCardSelect?.(c.cardId);
                                            }}
                                            className="w-full text-left px-2 py-1.5 rounded-lg border border-purple-500/15 bg-gray-900/30 text-xs font-mono text-purple-200 hover:border-purple-500/30 transition-all"
                                        >
                                            ▼ {c.name || c.cardId}
                                        </button>
                                    ))}
                                    {childCards.length > 6 && (
                                        <div className="text-[10px] text-gray-500 font-mono px-1">+{childCards.length - 6} more…</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 3D Canvas */}
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
                <CameraRig pose={cameraPose} orbitRef={orbitRef} onArrive={() => setCameraPose(null)} />
                
                {/* Lighting */}
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 10, 10]} intensity={0.5} />
                <pointLight position={[-10, -10, -10]} intensity={0.3} color="#a855f7" />
                <spotLight
                    position={[0, 5, 5]}
                    angle={0.3}
                    penumbra={1}
                    intensity={0.5}
                    castShadow
                />
                
                {/* Background */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <color attach="background" args={['#0a0a1a']} />
                
                {/* Environment for reflections */}
                <Suspense fallback={null}>
                    <Environment preset="night" />
                </Suspense>
                
                {/* Connection lines */}
                <CardConnections connections={filteredConnections} />
                
                {/* Cards */}
                <Suspense fallback={null}>
                    {filteredCards.map(card => {
                        const position = cardPositions.get(card.cardId) || [0, 0, 0];
                        const isFocused = card.cardId === focusedCard?.cardId;
                        const isParent = card.cardId === parentCard?.cardId;
                        const isChild = childCards.some(c => c.cardId === card.cardId);
                        
                        // Count children for this card
                        const cardChildCount = cards.filter(c => 
                            c.cardRecord?.parentCardId === card.cardId ||
                            c.parentCardId === card.cardId
                        ).length;
                        
                        // Extract key terms as strings
                        const keyTermStrings = (card.cardRecord?.keyTerms || [])
                            .map((kt: any) => kt?.term || kt?.name || (typeof kt === 'string' ? kt : null))
                            .filter(Boolean)
                            .slice(0, 5);
                        
                        // Extract lore from summaries or content
                        const loreText = card.cardRecord?.summaries?.[0]?.text 
                            || card.cardRecord?.summaries?.[0]?.content
                            || card.cardRecord?.text
                            || card.cardRecord?.content
                            || undefined;
                        
                        return (
                            <Card3D
                                key={card.cardId}
                                cardId={card.cardId}
                                name={card.name || 'Untitled'}
                                tier={calculateTier(card)}
                                mediaKind={(card.mediaKind as any) || 'document'}
                                thumbnailUrl={getCardThumbnail(card)}
                                videoUrl={getCardVideo(card)}
                                position={position as [number, number, number]}
                                scale={isFocused ? 1.2 : isParent ? 0.9 : 0.75}
                                isFocused={isFocused}
                                isParent={isParent}
                                isChild={isChild}
                                hasSummary={!!card.cardRecord?.summaries?.length}
                                hasKeyTerms={!!card.cardRecord?.keyTerms?.length}
                                hasImages={!!card.cardRecord?.imageSet?.images?.length}
                                childCount={cardChildCount}
                                keyTerms={keyTermStrings}
                                lore={loreText}
                                onClick={() => {
                                    focusCard(card.cardId);
                                    onCardSelect?.(card.cardId);
                                    if (scopeMode === 'global') {
                                        focusCameraOnCard(card.cardId, 'focus');
                                    }
                                }}
                                onDoubleClick={() => {
                                    // Navigate into card's children
                                    if (childCards.length > 0) {
                                        handleNavigateChild(0);
                                    }
                                }}
                            />
                        );
                    })}
                </Suspense>
                
                {/* Component nodes (images, videos, summaries, etc.) */}
                {showComponents && (
                    <Suspense fallback={null}>
                        {graphData.nodes
                            .filter(node => node.type !== 'card')
                            .map(node => {
                                const position = componentPositions.get(node.id) || [0, 0, 0];
                                return (
                                    <ComponentNode3D
                                        key={node.id}
                                        node={node}
                                        position={position as [number, number, number]}
                                        isFocused={false}
                                        onClick={() => {
                                            // Could expand to show details
                                            console.log('Clicked component:', node);
                                        }}
                                    />
                                );
                            })}
                    </Suspense>
                )}
                
                {/* Component connection lines */}
                {showComponents && filteredComponentConnections.length > 0 && (
                    <CardConnections connections={filteredComponentConnections} />
                )}
                
                {/* Spaceship */}
                <Spaceship 
                    enabled={shipMode}
                    invertY={shipInvertY}
                    cardPositions={cardPositions}
                    onHitCard={(cardId) => {
                        setHitCards(prev => new Set(prev).add(cardId));
                        // Flash effect or select the card
                        focusCard(cardId);
                        onCardSelect?.(cardId);
                    }}
                />
                
                {/* Controls - disabled when in ship mode */}
                <OrbitControls
                    ref={orbitRef}
                    enabled={!shipMode}
                    enablePan={!shipMode}
                    enableZoom={!shipMode}
                    enableRotate={!shipMode}
                    minDistance={3}
                    maxDistance={50}
                    maxPolarAngle={Math.PI * 0.85}
                    minPolarAngle={Math.PI * 0.15}
                />
                
                {/* Post-processing effects */}
                <EffectComposer>
                    <Bloom
                        luminanceThreshold={0.2}
                        luminanceSmoothing={0.9}
                        intensity={0.5}
                    />
                    <Vignette eskil={false} offset={0.1} darkness={0.5} />
                </EffectComposer>
            </Canvas>

            {isScopeSwitching && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
                    <div className="rounded-xl border border-cyan-500/20 bg-gray-950/70 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="text-cyan-400 text-xl animate-pulse">◈</div>
                            <div>
                                <div className="text-cyan-200 font-mono text-xs font-bold tracking-widest">SWITCHING SCOPE</div>
                                <div className="text-gray-400 font-mono text-[10px] mt-0.5">Stitching constellation…</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Navigation Panel */}
            <NexusNavigator
                onNavigateParent={handleNavigateParent}
                onNavigateChild={handleNavigateChild}
                onNavigateNext={handleNavigateNext}
                onNavigatePrev={handleNavigatePrev}
                hasParent={!!parentCard}
                hasChildren={childCards.length > 0}
                hasSiblings={siblingCards.length > 0}
                childCount={childCards.length}
            />
            
            {/* Compact status bar - top right */}
            <div className="absolute top-4 right-16 z-50 flex items-center gap-2">
                <button
                    onClick={() => setShowComponents(!showComponents)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                        showComponents 
                            ? 'bg-cyan-900/50 border border-cyan-500/50 text-cyan-300' 
                            : 'bg-gray-900/70 border border-gray-700/50 text-gray-500'
                    }`}
                    title="Toggle component nodes (images, videos, summaries)"
                >
                    ◈ {graphData.nodes.filter(n => n.type !== 'card').length} parts
                </button>
                <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded px-2 py-1 text-[10px] font-mono text-gray-400">
                    {viewMode.toUpperCase()}
                </div>
                <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded px-2 py-1 text-[10px] font-mono text-gray-400">
                    {cardsToRender.length} cards
                </div>
                {parentCard && (
                    <div className="bg-cyan-900/30 border border-cyan-500/30 rounded px-2 py-1 text-[10px] font-mono text-cyan-400">
                        ▲ {parentCard.name?.slice(0, 15)}
                    </div>
                )}
                {childCards.length > 0 && (
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded px-2 py-1 text-[10px] font-mono text-purple-400">
                        ▼ {childCards.length} children
                    </div>
                )}
            </div>
        </div>
    );
};

export default Card3DViewer;
