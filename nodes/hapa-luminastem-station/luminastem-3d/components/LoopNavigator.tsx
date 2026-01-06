
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, AdditiveBlending, Color, DoubleSide, InstancedBufferAttribute } from 'three';
import { Text } from '@react-three/drei';
import { AudioStem } from '../types';
import { audioService } from '../services/audioService';

interface LoopNavigatorProps {
    stems: AudioStem[];
    isPlaying: boolean;
    timeScale: number;
}

const LoopNavigator: React.FC<LoopNavigatorProps> = ({ stems, isPlaying, timeScale }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const cursorRef = useRef<any>(null);
    const scannerRef = useRef<any>(null);
    
    // Use the first active stem as the "Master Timekeeper"
    // In a real stem app, usually stems are uniform length.
    const masterStem = stems.length > 0 ? stems[0] : null;
    const duration = masterStem ? masterStem.duration : 10;
    const BAR_COUNT = 128;
    
    const dummy = useMemo(() => new Object3D(), []);
    const colors = useMemo(() => new Float32Array(BAR_COUNT * 3), []);

    // Initialize instanceColor attribute
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.instanceColor = new InstancedBufferAttribute(colors, 3);
        }
    }, [colors]);

    // Combine waveforms for visualization
    const aggregateWaveform = useMemo(() => {
        const result = new Array(BAR_COUNT).fill(0);
        if (stems.length === 0) return result;

        // Sum active stems
        let activeCount = 0;
        stems.forEach(stem => {
            if (!stem.isMuted && stem.coarseWaveform) {
                activeCount++;
                for(let i=0; i<BAR_COUNT; i++) {
                    // Resample if sizes differ (simple linear map here assuming 128)
                    const val = stem.coarseWaveform[i] || 0;
                    result[i] += val;
                }
            }
        });
        
        // Normalize
        if (activeCount > 0) {
            for(let i=0; i<BAR_COUNT; i++) result[i] /= Math.max(1, activeCount * 0.7);
        }
        return result;
    }, [stems]);

    useFrame((state) => {
        if (!meshRef.current || !cursorRef.current) return;

        // FIX: Use transport time instead of context time for correct position
        const time = audioService.getCurrentTime();
        const progress = (time % duration) / duration;
        
        // --- 1. Update Scanner Cursor ---
        const angle = progress * Math.PI * 2;
        const radius = 25;
        
        // The Cursor (Physical "Head")
        cursorRef.current.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        cursorRef.current.rotation.y = -angle;
        
        // The Scanner Wall (Laser Sheet)
        if (scannerRef.current) {
            scannerRef.current.rotation.y = -angle;
        }

        // --- 2. Update Waveform Bars ---
        for (let i = 0; i < BAR_COUNT; i++) {
            const barAngle = (i / BAR_COUNT) * Math.PI * 2; // 0 to 2PI
            
            // Determine relative position (Past vs Future)
            // We need to handle the wrap-around logic
            let dist = angle - barAngle;
            if (dist < 0) dist += Math.PI * 2; // Normalize to 0-2PI behind the cursor
            
            // dist is "How far behind the cursor is this bar?"
            // 0 = Just happened (Current)
            // small = Past
            // large (~2PI) = Future (Coming up)
            
            const isFuture = dist > Math.PI * 1.8 || dist < 0; // The slight wrap around area
            const isPast = !isFuture;

            const x = Math.cos(barAngle) * radius;
            const z = Math.sin(barAngle) * radius;
            
            // Audio Magnitude
            const mag = aggregateWaveform[i];
            
            dummy.position.set(x, 0, z);
            dummy.rotation.y = -barAngle;
            
            // Dynamic Height based on audio
            const baseScale = 0.2 + mag * 5;
            
            // If passed, pulse slightly, if future, maintain structure
            let scaleY = baseScale;
            if (Math.abs(dist) < 0.1) scaleY *= 1.5; // Highlight current
            
            dummy.scale.set(0.5, scaleY, 0.5);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // COLOR LOGIC
            const c = new Color();
            if (Math.abs(dist) < 0.05) {
                // THE NOW (White Hot)
                c.set('#ffffff');
            } else if (dist < Math.PI) {
                // PAST (Cool Cyan Trail - Fades with distance)
                const fade = Math.max(0.2, 1 - (dist / Math.PI));
                c.setHSL(0.5, 1, 0.5 * fade); 
            } else {
                // FUTURE (Dim Purple/Magenta - Shows potential)
                c.setHSL(0.8, 1, 0.1 + mag * 0.2); 
            }
            
            // If muted/silent, go dark
            if (mag < 0.01) c.set('#111111');

            c.toArray(colors, i * 3);
        }
        
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
        if (meshRef.current.instanceMatrix) {
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    if (stems.length === 0) return null;

    return (
        <group position={[0, -5, 0]}>
            {/* The Chrono-Ring (Instanced Bars) */}
            <instancedMesh ref={meshRef} args={[undefined, undefined, BAR_COUNT]}>
                <boxGeometry args={[0.8, 1, 0.8]} />
                <meshBasicMaterial toneMapped={false} vertexColors transparent opacity={0.8} />
            </instancedMesh>
            
            {/* Base Ring Graphics */}
            <mesh rotation={[-Math.PI/2, 0, 0]}>
                <ringGeometry args={[24.5, 25.5, 64]} />
                <meshBasicMaterial color="#333" transparent opacity={0.5} side={DoubleSide} />
            </mesh>
            
            {/* The Cursor Head */}
            <group ref={cursorRef}>
                {/* Glowing Tip */}
                <mesh position={[0, 2, 0]}>
                    <coneGeometry args={[0.5, 2, 4]} />
                    <meshBasicMaterial color="#00ff88" toneMapped={false} />
                </mesh>
                {/* Vertical Laser Line */}
                <mesh position={[0, 5, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 10]} />
                    <meshBasicMaterial color="#00ff88" transparent opacity={0.5} blending={AdditiveBlending} />
                </mesh>
            </group>
            
            {/* The Scanner Wall (Sweeping Effect) */}
            <group ref={scannerRef}>
                 <mesh position={[12, 5, 0]} rotation={[0, 0, 0]}>
                     <planeGeometry args={[25, 10]} />
                     <meshBasicMaterial 
                        color="#00ff88" 
                        transparent 
                        opacity={0.05} 
                        blending={AdditiveBlending} 
                        side={DoubleSide}
                        depthWrite={false}
                    />
                 </mesh>
            </group>

            {/* Labels */}
            <group rotation={[-Math.PI/2, 0, 0]}>
                <Text position={[0, 28, 0]} fontSize={1} color="gray" anchorX="center" anchorY="bottom">FUTURE (PREDICTIVE)</Text>
                <Text position={[0, -28, 0]} fontSize={1} color="cyan" anchorX="center" anchorY="top" rotation={[0, 0, Math.PI]}>PAST (HISTORY)</Text>
                <Text position={[28, 0, 0]} fontSize={1} color="white" anchorX="left" rotation={[0, 0, -Math.PI/2]}>NOW</Text>
            </group>
        </group>
    );
};

export default LoopNavigator;
