import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text, useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useViewer3DStore } from './viewer3DStore';

// Tier colors matching our card system
const TIER_COLORS = {
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
    tier: keyof typeof TIER_COLORS;
    mediaKind: 'image' | 'video' | 'audio' | 'message' | 'document';
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
    mediaKind,
    thumbnailUrl,
    videoUrl,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    isFocused = false,
    isParent = false,
    isChild = false,
    badges = [],
    onClick,
    onDoubleClick,
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const { globalMuted } = useViewer3DStore();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    
    // Card dimensions (poker card ratio: 2.5 x 3.5)
    const cardWidth = 2;
    const cardHeight = 2.8;
    const cardDepth = 0.08;
    
    const tierColor = TIER_COLORS[tier] || TIER_COLORS.common;
    
    // Load texture if available
    const texture = useMemo(() => {
        if (thumbnailUrl) {
            const loader = new THREE.TextureLoader();
            try {
                return loader.load(thumbnailUrl);
            } catch {
                return null;
            }
        }
        return null;
    }, [thumbnailUrl]);
    
    // Floating animation
    useFrame((state) => {
        if (meshRef.current) {
            // Gentle float
            meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + cardId.charCodeAt(0)) * 0.05;
            
            // Subtle rotation on hover
            if (hovered) {
                meshRef.current.rotation.y = rotation[1] + Math.sin(state.clock.elapsedTime * 2) * 0.02;
            }
        }
        
        // Glow pulse for focused card
        if (glowRef.current && isFocused) {
            const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7;
            (glowRef.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.5;
        }
    });
    
    // Handle video element
    const videoTexture = useMemo(() => {
        if (videoUrl && mediaKind === 'video') {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.crossOrigin = 'anonymous';
            video.loop = true;
            video.muted = globalMuted;
            video.playsInline = true;
            videoRef.current = video;
            
            const texture = new THREE.VideoTexture(video);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            return texture;
        }
        return null;
    }, [videoUrl, mediaKind]);
    
    // Play/pause video based on focus
    React.useEffect(() => {
        if (videoRef.current) {
            if (isFocused) {
                videoRef.current.play().catch(() => {});
            } else {
                videoRef.current.pause();
            }
        }
    }, [isFocused]);
    
    // Update mute state
    React.useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = globalMuted;
        }
    }, [globalMuted]);
    
    const cardMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: '#1a1a2e',
            metalness: 0.3,
            roughness: 0.7,
            map: videoTexture || texture || undefined,
        });
    }, [texture, videoTexture]);
    
    return (
        <group
            position={position}
            rotation={rotation}
            scale={scale}
        >
            {/* Glow effect behind card */}
            <mesh
                ref={glowRef}
                position={[0, 0, -0.1]}
                scale={[1.15, 1.15, 1]}
            >
                <planeGeometry args={[cardWidth, cardHeight]} />
                <meshBasicMaterial
                    color={tierColor}
                    transparent
                    opacity={isFocused ? 0.5 : hovered ? 0.3 : 0.15}
                    side={THREE.DoubleSide}
                />
            </mesh>
            
            {/* Main card body */}
            <RoundedBox
                ref={meshRef}
                args={[cardWidth, cardHeight, cardDepth]}
                radius={0.1}
                smoothness={4}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.4}
                    roughness={0.6}
                />
            </RoundedBox>
            
            {/* Card face with image/video */}
            <mesh position={[0, 0.1, cardDepth / 2 + 0.001]}>
                <planeGeometry args={[cardWidth - 0.2, cardHeight - 0.8]} />
                {cardMaterial && <primitive object={cardMaterial} attach="material" />}
            </mesh>
            
            {/* Quality bar (top) */}
            <mesh position={[0, cardHeight / 2 - 0.15, cardDepth / 2 + 0.002]}>
                <planeGeometry args={[cardWidth - 0.1, 0.15]} />
                <meshBasicMaterial color={tierColor} />
            </mesh>
            
            {/* Card name */}
            <Text
                position={[0, -cardHeight / 2 + 0.25, cardDepth / 2 + 0.01]}
                fontSize={0.12}
                color="#e2e8f0"
                anchorX="center"
                anchorY="middle"
                maxWidth={cardWidth - 0.3}
                font="/fonts/RobotoMono-Bold.ttf"
            >
                {name.substring(0, 25)}
            </Text>
            
            {/* Media kind icon indicator */}
            <Text
                position={[-cardWidth / 2 + 0.15, -cardHeight / 2 + 0.5, cardDepth / 2 + 0.01]}
                fontSize={0.15}
                color={tierColor}
                anchorX="center"
                anchorY="middle"
            >
                {mediaKind === 'video' ? '🎬' : mediaKind === 'image' ? '🖼️' : mediaKind === 'audio' ? '🎵' : '📄'}
            </Text>
            
            {/* Badges */}
            {badges.map((badge, i) => (
                <Text
                    key={badge}
                    position={[cardWidth / 2 - 0.2 - i * 0.25, -cardHeight / 2 + 0.5, cardDepth / 2 + 0.01]}
                    fontSize={0.12}
                    color="#fbbf24"
                    anchorX="center"
                    anchorY="middle"
                >
                    ⬡
                </Text>
            ))}
            
            {/* Parent/Child indicator */}
            {isParent && (
                <Text
                    position={[0, cardHeight / 2 + 0.2, 0]}
                    fontSize={0.15}
                    color="#22d3ee"
                    anchorX="center"
                    anchorY="middle"
                >
                    ▲ PARENT
                </Text>
            )}
            {isChild && (
                <Text
                    position={[0, -cardHeight / 2 - 0.2, 0]}
                    fontSize={0.12}
                    color="#a855f7"
                    anchorX="center"
                    anchorY="middle"
                >
                    ▼ CHILD
                </Text>
            )}
            
            {/* Focus ring */}
            {isFocused && (
                <mesh position={[0, 0, -0.05]}>
                    <ringGeometry args={[cardWidth * 0.7, cardWidth * 0.75, 32]} />
                    <meshBasicMaterial
                        color={tierColor}
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
