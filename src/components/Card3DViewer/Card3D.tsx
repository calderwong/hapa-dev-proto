import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Tier colors matching our card system
const TIER_COLORS: Record<string, string> = {
    common: '#6b7280',
    uncommon: '#10b981',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f97316',
    mythic: '#ec4899',
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
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const Card3D: React.FC<Card3DProps> = ({
    cardId,
    name,
    tier = 'common',
    mediaKind = 'document',
    position = [0, 0, 0],
    scale = 1,
    isFocused = false,
    isParent = false,
    isChild = false,
    onClick,
    onDoubleClick,
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    
    // Card dimensions
    const cardWidth = 2;
    const cardHeight = 2.8;
    const cardDepth = 0.1;
    
    const tierColor = TIER_COLORS[tier] || TIER_COLORS.common;
    
    // Floating animation
    useFrame((state) => {
        if (groupRef.current) {
            // Gentle float
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + cardId.charCodeAt(0)) * 0.1;
            // Gentle rotation
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
        }
    });
    
    return (
        <group
            ref={groupRef}
            position={position}
            scale={scale}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Glow effect behind card */}
            <mesh position={[0, 0, -0.15]} scale={[1.2, 1.2, 1]}>
                <planeGeometry args={[cardWidth, cardHeight]} />
                <meshBasicMaterial
                    color={tierColor}
                    transparent
                    opacity={isFocused ? 0.6 : hovered ? 0.4 : 0.2}
                    side={THREE.DoubleSide}
                />
            </mesh>
            
            {/* Main card body - simple box */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[cardWidth, cardHeight, cardDepth]} />
                <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.3}
                    roughness={0.7}
                />
            </mesh>
            
            {/* Quality bar (top) */}
            <mesh position={[0, cardHeight / 2 - 0.1, cardDepth / 2 + 0.01]}>
                <planeGeometry args={[cardWidth * 0.9, 0.12]} />
                <meshBasicMaterial color={tierColor} />
            </mesh>
            
            {/* Card content area - lighter background */}
            <mesh position={[0, 0, cardDepth / 2 + 0.01]}>
                <planeGeometry args={[cardWidth * 0.85, cardHeight * 0.6]} />
                <meshBasicMaterial color="#0f172a" />
            </mesh>
            
            {/* Media kind indicator */}
            <mesh position={[0, -0.8, cardDepth / 2 + 0.02]}>
                <planeGeometry args={[0.4, 0.4]} />
                <meshBasicMaterial 
                    color={mediaKind === 'video' ? '#a855f7' : mediaKind === 'image' ? '#22d3ee' : '#6b7280'} 
                />
            </mesh>
            
            {/* Focus ring */}
            {isFocused && (
                <mesh position={[0, 0, -0.1]}>
                    <ringGeometry args={[cardWidth * 0.55, cardWidth * 0.6, 32]} />
                    <meshBasicMaterial
                        color={tierColor}
                        transparent
                        opacity={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
            
            {/* HTML overlay for text */}
            <Html
                position={[0, -cardHeight / 2 + 0.3, cardDepth / 2 + 0.1]}
                center
                distanceFactor={8}
            >
                <div className="text-center pointer-events-none select-none">
                    <div className="text-white text-xs font-mono bg-black/70 px-2 py-1 rounded whitespace-nowrap max-w-[150px] truncate">
                        {name?.substring(0, 20) || 'Untitled'}
                    </div>
                    {isParent && (
                        <div className="text-cyan-400 text-[10px] mt-1">▲ PARENT</div>
                    )}
                    {isChild && (
                        <div className="text-purple-400 text-[10px] mt-1">▼ CHILD</div>
                    )}
                </div>
            </Html>
        </group>
    );
};

export default Card3D;
