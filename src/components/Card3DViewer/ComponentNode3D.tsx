import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphNode, NodeType } from './graphTypes';

// Node type visual config
const NODE_CONFIG: Record<NodeType, { icon: string; defaultColor: string; shape: 'sphere' | 'box' | 'octahedron' }> = {
    card: { icon: '📇', defaultColor: '#22d3ee', shape: 'box' },
    image: { icon: '🖼️', defaultColor: '#22d3ee', shape: 'box' },
    video: { icon: '🎬', defaultColor: '#a855f7', shape: 'octahedron' },
    audio: { icon: '🎵', defaultColor: '#f59e0b', shape: 'sphere' },
    transcript: { icon: '📝', defaultColor: '#10b981', shape: 'sphere' },
    summary: { icon: '📋', defaultColor: '#3b82f6', shape: 'sphere' },
    keyterm: { icon: '🔑', defaultColor: '#ec4899', shape: 'sphere' },
    avatar: { icon: '👤', defaultColor: '#8b5cf6', shape: 'sphere' },
    text: { icon: '📄', defaultColor: '#64748b', shape: 'box' },
    wiki: { icon: '📚', defaultColor: '#14b8a6', shape: 'sphere' },
};

interface ComponentNode3DProps {
    node: GraphNode;
    position?: [number, number, number];
    isFocused?: boolean;
    onClick?: () => void;
}

export const ComponentNode3D: React.FC<ComponentNode3DProps> = ({
    node,
    position = [0, 0, 0],
    isFocused = false,
    onClick,
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    
    const config = NODE_CONFIG[node.type] || NODE_CONFIG.card;
    const nodeColor = node.color || config.defaultColor;
    const nodeSize = (node.size || 0.6) * 0.8; // Scale down a bit
    
    // Load texture for image nodes
    const texture = useMemo(() => {
        if (node.thumbnailUrl && (node.type === 'image' || node.type === 'video')) {
            const loader = new THREE.TextureLoader();
            try {
                const tex = loader.load(node.thumbnailUrl);
                tex.minFilter = THREE.LinearFilter;
                return tex;
            } catch {
                return null;
            }
        }
        return null;
    }, [node.thumbnailUrl, node.type]);
    
    // Gentle float animation
    useFrame((state) => {
        if (groupRef.current) {
            const offset = node.id.charCodeAt(0) * 0.1;
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6 + offset) * 0.03;
            
            // Slight rotation for non-focused nodes
            if (!isFocused) {
                groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4 + offset) * 0.1;
            }
        }
    });
    
    const renderShape = () => {
        const material = (
            <meshStandardMaterial
                color={nodeColor}
                metalness={0.3}
                roughness={0.7}
                emissive={nodeColor}
                emissiveIntensity={isFocused ? 0.3 : hovered ? 0.15 : 0.05}
            />
        );
        
        switch (config.shape) {
            case 'box':
                return (
                    <mesh castShadow receiveShadow>
                        <boxGeometry args={[nodeSize, nodeSize, nodeSize * 0.3]} />
                        {material}
                    </mesh>
                );
            case 'octahedron':
                return (
                    <mesh castShadow receiveShadow>
                        <octahedronGeometry args={[nodeSize * 0.5]} />
                        {material}
                    </mesh>
                );
            case 'sphere':
            default:
                return (
                    <mesh castShadow receiveShadow>
                        <sphereGeometry args={[nodeSize * 0.4, 16, 16]} />
                        {material}
                    </mesh>
                );
        }
    };
    
    return (
        <group
            ref={groupRef}
            position={position}
            scale={hovered ? 1.1 : 1}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Glow effect */}
            <mesh position={[0, 0, -0.05]} scale={[1.3, 1.3, 1]}>
                <sphereGeometry args={[nodeSize * 0.5, 16, 16]} />
                <meshBasicMaterial
                    color={nodeColor}
                    transparent
                    opacity={isFocused ? 0.4 : hovered ? 0.25 : 0.1}
                />
            </mesh>
            
            {/* Main shape */}
            {renderShape()}
            
            {/* Texture overlay for images */}
            {texture && (node.type === 'image' || node.type === 'video') && (
                <mesh position={[0, 0, nodeSize * 0.16]}>
                    <planeGeometry args={[nodeSize * 0.9, nodeSize * 0.9]} />
                    <meshBasicMaterial map={texture} />
                </mesh>
            )}
            
            {/* Hero badge for hero images */}
            {node.isHero && (
                <mesh position={[nodeSize * 0.4, nodeSize * 0.4, 0.1]}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial color="#fbbf24" />
                </mesh>
            )}
            
            {/* HTML label */}
            <Html
                position={[0, -nodeSize * 0.6, 0]}
                center
                distanceFactor={8}
                style={{ pointerEvents: 'none' }}
            >
                <div className="select-none text-center">
                    <div className="text-lg">{config.icon}</div>
                    <div 
                        className="text-[9px] font-mono px-1 py-0.5 rounded whitespace-nowrap max-w-[80px] truncate"
                        style={{ 
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: nodeColor,
                        }}
                    >
                        {node.label}
                    </div>
                    {node.index !== undefined && (
                        <div className="text-[8px] text-gray-500">
                            #{node.index + 1}
                        </div>
                    )}
                </div>
            </Html>
        </group>
    );
};

export default ComponentNode3D;
