import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface Connection {
    fromCardId: string;
    toCardId: string;
    fromPosition: [number, number, number];
    toPosition: [number, number, number];
    type: 'parent-child' | 'extraction' | 'generated' | 'card-component' | 'derived-from' | 'sibling' | 'reference';
}

interface CardConnectionsProps {
    connections: Connection[];
}

const CONNECTION_COLORS: Record<string, string> = {
    'parent-child': '#22d3ee',  // Cyan
    'extraction': '#a855f7',    // Purple
    'generated': '#f59e0b',     // Amber
    'card-component': '#6b7280', // Gray - subtle for card->component
    'derived-from': '#a855f7',  // Purple
    'sibling': '#10b981',       // Green
    'reference': '#3b82f6',     // Blue
};

export const CardConnections: React.FC<CardConnectionsProps> = ({ connections }) => {
    return (
        <group>
            {connections.map((conn, i) => (
                <ConnectionLine key={`${conn.fromCardId}-${conn.toCardId}-${i}`} connection={conn} />
            ))}
        </group>
    );
};

interface ConnectionLineProps {
    connection: Connection;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ connection }) => {
    const particlesRef = useRef<THREE.Points>(null);
    
    const { fromPosition, toPosition, type } = connection;
    const color = CONNECTION_COLORS[type] || CONNECTION_COLORS['parent-child'];
    
    // Calculate curve points for a nice arc
    const curvePoints = useMemo(() => {
        const start = new THREE.Vector3(...fromPosition);
        const end = new THREE.Vector3(...toPosition);
        const mid = new THREE.Vector3()
            .addVectors(start, end)
            .multiplyScalar(0.5);
        
        // Add some curve height based on distance
        const distance = start.distanceTo(end);
        mid.z += distance * 0.2;
        
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        return curve.getPoints(50);
    }, [fromPosition, toPosition]);
    
    // Create particle positions along the line
    const particleCount = 5;
    const particlePositions = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        return positions;
    }, []);
    
    // Animate particles flowing along the line
    useFrame((state) => {
        if (particlesRef.current) {
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
            
            for (let i = 0; i < particleCount; i++) {
                const t = ((state.clock.elapsedTime * 0.3 + i / particleCount) % 1);
                const pointIndex = Math.floor(t * (curvePoints.length - 1));
                const point = curvePoints[pointIndex];
                
                positions[i * 3] = point.x;
                positions[i * 3 + 1] = point.y;
                positions[i * 3 + 2] = point.z;
            }
            
            particlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });
    
    return (
        <group>
            {/* Main connection line */}
            <Line
                points={curvePoints}
                color={color}
                lineWidth={2}
                transparent
                opacity={0.6}
                dashed={type === 'extraction'}
                dashScale={type === 'extraction' ? 10 : undefined}
            />
            
            {/* Animated particles flowing along line */}
            <points ref={particlesRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[particlePositions, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    color={color}
                    size={0.1}
                    transparent
                    opacity={0.8}
                    sizeAttenuation
                />
            </points>
            
            {/* Glow effect at connection points */}
            <mesh position={fromPosition}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} />
            </mesh>
            <mesh position={toPosition}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} />
            </mesh>
        </group>
    );
};

export default CardConnections;
