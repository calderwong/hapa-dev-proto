import React, { Suspense, useMemo, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Card3D } from './Card3D';
import { CardConnections } from './CardConnections';
import { NexusNavigator } from './NexusNavigator';
import { useViewer3DStore } from './viewer3DStore';

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
    if (card.thumbnail) return card.thumbnail;
    if (card.cardRecord?.imageSet?.images?.[0]?.localPath) {
        return `file://${card.cardRecord.imageSet.images[0].localPath}`;
    }
    if (card.cardRecord?.image?.localPath) {
        return `file://${card.cardRecord.image.localPath}`;
    }
    if (card.mediaLocalPath && card.mediaKind === 'image') {
        return `file://${card.mediaLocalPath}`;
    }
    return undefined;
};

// Get video URL from card
const getCardVideo = (card: CardData): string | undefined => {
    if (card.mediaKind === 'video' && card.mediaLocalPath) {
        return `file://${card.mediaLocalPath}`;
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
        summaries?: any[];
        keyTerms?: any[];
        imageSet?: {
            images?: { localPath: string }[];
        };
        image?: { localPath: string };
    };
}

interface Card3DViewerProps {
    cards: CardData[];
    focusedCardId?: string;
    onCardSelect?: (cardId: string) => void;
    onClose?: () => void;
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

export const Card3DViewer: React.FC<Card3DViewerProps> = ({
    cards,
    focusedCardId,
    onCardSelect,
    onClose,
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
        const parentId = focusedCard?.cardRecord?.parentCardId || focusedCard?.parentCardId;
        return parentId ? cards.find(c => c.cardId === parentId) : undefined;
    }, [focusedCard, cards]);
    
    const childCards = useMemo(() => 
        cards.filter(c => 
            c.cardRecord?.parentCardId === focusedCard?.cardId ||
            c.parentCardId === focusedCard?.cardId
        ),
        [cards, focusedCard]
    );
    
    const siblingCards = useMemo(() => {
        if (!parentCard) return [];
        return cards.filter(c => 
            (c.cardRecord?.parentCardId === parentCard.cardId ||
             c.parentCardId === parentCard.cardId) &&
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
    
    // Calculate card positions
    const cardPositions = useMemo(() => {
        if (!focusedCard) return new Map();
        return calculateConstellationPositions(focusedCard, parentCard, childCards, siblingCards, contextCards);
    }, [focusedCard, parentCard, childCards, siblingCards, contextCards]);
    
    // Build connections
    const connections = useMemo(() => {
        const conns: any[] = [];
        
        if (parentCard && focusedCard) {
            const parentPos = cardPositions.get(parentCard.cardId) || [0, 3, -2];
            const focusedPos = cardPositions.get(focusedCard.cardId) || [0, 0, 0];
            conns.push({
                fromCardId: parentCard.cardId,
                toCardId: focusedCard.cardId,
                fromPosition: parentPos,
                toPosition: focusedPos,
                type: 'parent-child',
            });
        }
        
        childCards.forEach(child => {
            const childPos = cardPositions.get(child.cardId) || [0, -3, 0];
            const focusedPos = cardPositions.get(focusedCard?.cardId || '') || [0, 0, 0];
            conns.push({
                fromCardId: focusedCard?.cardId || '',
                toCardId: child.cardId,
                fromPosition: focusedPos,
                toPosition: childPos,
                type: 'parent-child',
            });
        });
        
        return conns;
    }, [parentCard, focusedCard, childCards, cardPositions]);
    
    // Get all cards to render
    const cardsToRender = useMemo(() => {
        const cardSet = new Set<CardData>();
        
        // Add all related cards
        if (focusedCard) cardSet.add(focusedCard);
        if (parentCard) cardSet.add(parentCard);
        childCards.forEach(c => cardSet.add(c));
        siblingCards.forEach(c => cardSet.add(c));
        contextCards.forEach(c => cardSet.add(c));
        
        return Array.from(cardSet);
    }, [focusedCard, parentCard, childCards, siblingCards, contextCards]);
    
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
            
            {/* 3D Canvas */}
            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
                
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
                <CardConnections connections={connections} />
                
                {/* Cards */}
                <Suspense fallback={null}>
                    {cardsToRender.map(card => {
                        const position = cardPositions.get(card.cardId) || [0, 0, 0];
                        const isFocused = card.cardId === focusedCard?.cardId;
                        const isParent = card.cardId === parentCard?.cardId;
                        const isChild = childCards.some(c => c.cardId === card.cardId);
                        
                        // Count children for this card
                        const cardChildCount = cards.filter(c => 
                            c.cardRecord?.parentCardId === card.cardId ||
                            c.parentCardId === card.cardId
                        ).length;
                        
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
                                onClick={() => {
                                    focusCard(card.cardId);
                                    onCardSelect?.(card.cardId);
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
                
                {/* Controls */}
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={3}
                    maxDistance={20}
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
                <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded px-2 py-1 text-[10px] font-mono text-gray-400">
                    {viewMode.toUpperCase()}
                </div>
                <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-700/50 rounded px-2 py-1 text-[10px] font-mono text-gray-400">
                    {cardsToRender.length} visible
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
