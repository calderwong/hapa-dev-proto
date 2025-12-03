import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Tier colors and labels
const TIER_CONFIG: Record<string, { color: string; label: string; glow: number }> = {
    common: { color: '#6b7280', label: 'COMMON', glow: 0.2 },
    uncommon: { color: '#10b981', label: 'UNCOMMON', glow: 0.3 },
    rare: { color: '#3b82f6', label: 'RARE', glow: 0.4 },
    epic: { color: '#a855f7', label: 'EPIC', glow: 0.5 },
    legendary: { color: '#f97316', label: 'LEGENDARY', glow: 0.6 },
    mythic: { color: '#ec4899', label: 'MYTHIC', glow: 0.8 },
};

// Media kind icons
const MEDIA_ICONS: Record<string, string> = {
    video: '🎬',
    image: '🖼️',
    audio: '🎵',
    document: '📄',
};

interface Card3DProps {
    cardId: string;
    name: string;
    tier?: string;
    mediaKind?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    isFocused?: boolean;
    isParent?: boolean;
    isChild?: boolean;
    badges?: string[];
    hasSummary?: boolean;
    hasKeyTerms?: boolean;
    hasImages?: boolean;
    childCount?: number;
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const Card3D: React.FC<Card3DProps> = ({
    cardId,
    name,
    tier = 'common',
    mediaKind = 'document',
    thumbnailUrl,
    position = [0, 0, 0],
    scale = 1,
    isFocused = false,
    isParent = false,
    isChild = false,
    hasSummary = false,
    hasKeyTerms = false,
    hasImages = false,
    childCount = 0,
    onClick,
    onDoubleClick,
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    
    // Card dimensions - slightly smaller for cleaner look
    const cardWidth = 1.8;
    const cardHeight = 2.4;
    const cardDepth = 0.08;
    
    const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.common;
    const mediaIcon = MEDIA_ICONS[mediaKind] || MEDIA_ICONS.document;
    
    // Load texture if thumbnail available
    const texture = useMemo(() => {
        if (thumbnailUrl) {
            const loader = new THREE.TextureLoader();
            try {
                const tex = loader.load(thumbnailUrl);
                tex.minFilter = THREE.LinearFilter;
                return tex;
            } catch {
                return null;
            }
        }
        return null;
    }, [thumbnailUrl]);
    
    // Floating animation - more subtle for non-focused cards
    useFrame((state) => {
        if (groupRef.current) {
            const floatIntensity = isFocused ? 0.08 : 0.04;
            const rotateIntensity = isFocused ? 0.03 : hovered ? 0.02 : 0;
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + cardId.charCodeAt(0)) * floatIntensity;
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * rotateIntensity;
        }
    });
    
    // Badge indicators
    const badges: string[] = [];
    if (hasSummary) badges.push('📝');
    if (hasKeyTerms) badges.push('🔑');
    if (hasImages) badges.push('🖼️');
    if (childCount > 0) badges.push(`👶${childCount}`);
    
    return (
        <group
            ref={groupRef}
            position={position}
            scale={hovered && !isFocused ? scale * 1.05 : scale}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Outer glow - tier-based intensity */}
            <mesh position={[0, 0, -0.12]} scale={[1.15, 1.15, 1]}>
                <planeGeometry args={[cardWidth, cardHeight]} />
                <meshBasicMaterial
                    color={tierConfig.color}
                    transparent
                    opacity={isFocused ? tierConfig.glow : hovered ? tierConfig.glow * 0.7 : tierConfig.glow * 0.3}
                    side={THREE.DoubleSide}
                />
            </mesh>
            
            {/* Card frame */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[cardWidth, cardHeight, cardDepth]} />
                <meshStandardMaterial
                    color="#0f172a"
                    metalness={0.4}
                    roughness={0.6}
                />
            </mesh>
            
            {/* Quality bar at top */}
            <mesh position={[0, cardHeight / 2 - 0.06, cardDepth / 2 + 0.005]}>
                <planeGeometry args={[cardWidth - 0.1, 0.08]} />
                <meshBasicMaterial color={tierConfig.color} />
            </mesh>
            
            {/* Main content area - show thumbnail or placeholder */}
            <mesh position={[0, 0.15, cardDepth / 2 + 0.005]}>
                <planeGeometry args={[cardWidth - 0.2, cardHeight * 0.55]} />
                {texture ? (
                    <meshBasicMaterial map={texture} />
                ) : (
                    <meshBasicMaterial color="#1e293b" />
                )}
            </mesh>
            
            {/* HTML overlay for rich content */}
            <Html
                position={[0, 0, cardDepth / 2 + 0.02]}
                center
                distanceFactor={6}
                style={{ pointerEvents: 'none' }}
            >
                <div className="select-none w-40">
                    {/* Tier label */}
                    <div 
                        className="text-center text-[8px] font-bold tracking-widest mb-1 opacity-80"
                        style={{ color: tierConfig.color }}
                    >
                        {tierConfig.label}
                    </div>
                    
                    {/* Media placeholder if no thumbnail */}
                    {!thumbnailUrl && (
                        <div className="flex items-center justify-center h-20 bg-gray-800/50 rounded mb-2">
                            <span className="text-3xl opacity-50">{mediaIcon}</span>
                        </div>
                    )}
                    
                    {/* Card name */}
                    <div className="text-white text-[10px] font-mono text-center bg-black/60 px-2 py-1 rounded truncate">
                        {name?.substring(0, 25) || 'Untitled'}
                    </div>
                    
                    {/* Badges row */}
                    {badges.length > 0 && (
                        <div className="flex justify-center gap-1 mt-1">
                            {badges.map((badge, i) => (
                                <span key={i} className="text-[8px] bg-gray-800/70 px-1 rounded">
                                    {badge}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* Relationship indicator */}
                    {(isParent || isChild) && (
                        <div className={`text-center text-[9px] font-mono mt-1 ${
                            isParent ? 'text-cyan-400' : 'text-purple-400'
                        }`}>
                            {isParent ? '▲ PARENT' : '▼ CHILD'}
                        </div>
                    )}
                </div>
            </Html>
            
            {/* Focus ring - animated */}
            {isFocused && (
                <mesh position={[0, 0, -0.08]} rotation={[0, 0, 0]}>
                    <ringGeometry args={[cardWidth * 0.52, cardWidth * 0.56, 6]} />
                    <meshBasicMaterial
                        color={tierConfig.color}
                        transparent
                        opacity={0.8}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
};

export default Card3D;
