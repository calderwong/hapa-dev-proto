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

const CONNECTION_STYLE: Record<Connection['type'], {
    lineWidth: number;
    opacity: number;
    dashed?: boolean;
    dashScale?: number;
    particles: number;
    particleSpeed: number;
    particleSize: number;
    endpointSize: number;
    endpointOpacity: number;
    arrowSize: number;
    arrowOpacity: number;
}> = {
    'parent-child': {
        lineWidth: 3.5,
        opacity: 0.55,
        particles: 0,
        particleSpeed: 0,
        particleSize: 0.1,
        endpointSize: 0.09,
        endpointOpacity: 0.5,
        arrowSize: 0,
        arrowOpacity: 0,
    },
    sibling: {
        lineWidth: 2.5,
        opacity: 0.5,
        particles: 0,
        particleSpeed: 0,
        particleSize: 0.1,
        endpointSize: 0.08,
        endpointOpacity: 0.45,
        arrowSize: 0,
        arrowOpacity: 0,
    },
    'card-component': {
        lineWidth: 1.2,
        opacity: 0.35,
        particles: 0,
        particleSpeed: 0,
        particleSize: 0.09,
        endpointSize: 0.06,
        endpointOpacity: 0.35,
        arrowSize: 0,
        arrowOpacity: 0,
    },
    extraction: {
        lineWidth: 2,
        opacity: 0.55,
        dashed: true,
        dashScale: 10,
        particles: 6,
        particleSpeed: 0.36,
        particleSize: 0.11,
        endpointSize: 0.07,
        endpointOpacity: 0.45,
        arrowSize: 0.14,
        arrowOpacity: 0.6,
    },
    generated: {
        lineWidth: 2,
        opacity: 0.55,
        dashed: true,
        dashScale: 18,
        particles: 7,
        particleSpeed: 0.44,
        particleSize: 0.12,
        endpointSize: 0.07,
        endpointOpacity: 0.45,
        arrowSize: 0.16,
        arrowOpacity: 0.65,
    },
    reference: {
        lineWidth: 2,
        opacity: 0.5,
        dashed: true,
        dashScale: 14,
        particles: 5,
        particleSpeed: 0.32,
        particleSize: 0.1,
        endpointSize: 0.065,
        endpointOpacity: 0.4,
        arrowSize: 0.14,
        arrowOpacity: 0.55,
    },
    'derived-from': {
        lineWidth: 2,
        opacity: 0.5,
        dashed: true,
        dashScale: 12,
        particles: 5,
        particleSpeed: 0.34,
        particleSize: 0.1,
        endpointSize: 0.065,
        endpointOpacity: 0.4,
        arrowSize: 0.14,
        arrowOpacity: 0.55,
    },
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
    const style = CONNECTION_STYLE[type] || CONNECTION_STYLE['parent-child'];
    
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

    const arrowTransform = useMemo(() => {
        if (!style.arrowSize) return null;
        if (curvePoints.length < 2) return null;
        const end = curvePoints[curvePoints.length - 1].clone();
        const prev = curvePoints[curvePoints.length - 2].clone();
        const dir = end.clone().sub(prev);
        if (dir.lengthSq() < 1e-6) return null;
        dir.normalize();

        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        const pos = end.clone().add(dir.clone().multiplyScalar(-style.arrowSize * 0.35));
        return { pos, quat };
    }, [curvePoints, style.arrowSize]);
    
    // Create particle positions along the line
    const particleCount = style.particles;
    const particlePositions = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        return positions;
    }, [particleCount]);
    
    // Animate particles flowing along the line
    useFrame((state) => {
        if (particlesRef.current) {
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
            
            for (let i = 0; i < particleCount; i++) {
                const t = ((state.clock.elapsedTime * style.particleSpeed + i / particleCount) % 1);
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
                lineWidth={style.lineWidth}
                transparent
                opacity={style.opacity}
                dashed={style.dashed}
                dashScale={style.dashScale}
            />
            
            {/* Animated particles flowing along line */}
            {particleCount > 0 && (
                <points ref={particlesRef}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            args={[particlePositions, 3]}
                        />
                    </bufferGeometry>
                    <pointsMaterial
                        color={color}
                        size={style.particleSize}
                        transparent
                        opacity={0.8}
                        sizeAttenuation
                    />
                </points>
            )}
            
            {/* Glow effect at connection points */}
            <mesh position={fromPosition}>
                <sphereGeometry args={[style.endpointSize, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={style.endpointOpacity} />
            </mesh>
            <mesh position={toPosition}>
                <sphereGeometry args={[style.endpointSize, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={style.endpointOpacity} />
            </mesh>

            {arrowTransform && (
                <mesh position={arrowTransform.pos} quaternion={arrowTransform.quat}>
                    <coneGeometry args={[style.arrowSize * 0.45, style.arrowSize, 10]} />
                    <meshBasicMaterial
                        color={color}
                        transparent
                        opacity={style.arrowOpacity}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </group>
    );
};

export default CardConnections;
