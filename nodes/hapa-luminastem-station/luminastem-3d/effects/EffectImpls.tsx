
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Color, AdditiveBlending, MathUtils } from 'three';
import { createPRNG } from '../services/prng';
import { AudioStem, EffectInstance } from '../types';
import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing';

// --- SHARED TYPES ---
interface EffectProps {
    instance: EffectInstance;
    stems: AudioStem[];
    beat: number; // trigger signal
}

// --- 1. PARTICLE TRAIL ---
export const ParticleTrail: React.FC<EffectProps> = ({ instance, stems }) => {
    const { count, speed, size, color } = instance.params;
    const meshRef = useRef<any>(null);
    const prng = useMemo(() => createPRNG(instance.seed), [instance.seed]);
    
    // Static particles pool
    const particles = useMemo(() => {
        return new Array(200).fill(0).map(() => ({
            pos: new Vector3(0, -1000, 0), // hide initially
            vel: new Vector3(0, 0, 0),
            life: 0,
            maxLife: 1 + prng.random()
        }));
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        // Spawning Logic
        // Find loudest stem to emit from
        let loudestStem: AudioStem | null = null;
        let maxVol = 0;
        stems.forEach(s => {
            if (!s.isMuted && s.volume > maxVol && s.smartVolume > 0.1) {
                maxVol = s.volume * s.smartVolume;
                loudestStem = s;
            }
        });

        // Update Particles
        const positions = meshRef.current.geometry.attributes.position.array;
        
        for(let i=0; i<particles.length; i++) {
            const p = particles[i];
            
            if (p.life <= 0 && loudestStem && prng.random() < (count * 0.1)) {
                // Respawn
                p.pos.copy(loudestStem.position);
                // Add jitter
                p.pos.x += prng.range(-1, 1);
                p.pos.y += prng.range(-1, 1);
                p.pos.z += prng.range(-1, 1);
                
                p.vel.set(
                    prng.range(-0.5, 0.5),
                    prng.range(0.5, 2.0) * speed,
                    prng.range(-0.5, 0.5)
                );
                p.life = p.maxLife;
            } else if (p.life > 0) {
                p.life -= delta;
                p.pos.add(p.vel.clone().multiplyScalar(delta * 10));
                p.vel.y *= 0.98; // gravity/drag
            } else {
                p.pos.set(0, -1000, 0);
            }

            positions[i*3] = p.pos.x;
            positions[i*3+1] = p.pos.y;
            positions[i*3+2] = p.pos.z;
        }
        
        meshRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={particles.length} array={new Float32Array(particles.length * 3)} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={size} color={color} transparent opacity={0.6} blending={AdditiveBlending} sizeAttenuation depthWrite={false} />
        </points>
    );
};

// --- 2. BEAT PULSE LIGHT ---
export const BeatPulseLight: React.FC<EffectProps> = ({ instance, beat }) => {
    const { color, intensity, decay } = instance.params;
    const lightRef = useRef<any>(null);
    const targetIntensity = useRef(0);

    // Listen to beat triggers externally passed or implied?
    // Since we don't have direct event subscription here easily without context,
    // we rely on `beat` prop changing.
    
    // However, beat is a counter. 
    useEffect(() => {
        targetIntensity.current = intensity * 2; // Spike
    }, [beat]);

    useFrame((state, delta) => {
        if (lightRef.current) {
            targetIntensity.current = MathUtils.lerp(targetIntensity.current, 0, delta * decay);
            lightRef.current.intensity = targetIntensity.current;
        }
    });

    return <pointLight ref={lightRef} position={[0, 10, 0]} color={color} distance={100} />;
};

// --- 3. CAMERA ORBIT RIG ---
export const CameraOrbitRig: React.FC<EffectProps> = ({ instance }) => {
    const { radius, speed, height, lookAtY } = instance.params;
    const { camera } = useThree();
    
    useFrame((state) => {
        if (!instance.enabled) return;
        const t = state.clock.elapsedTime * speed * 0.1;
        
        camera.position.x = Math.cos(t) * radius;
        camera.position.z = Math.sin(t) * radius;
        camera.position.y = height + Math.sin(t * 0.5) * 5;
        
        camera.lookAt(0, lookAtY, 0);
    });

    return null; // Logic only
};

// --- 4. ZOOM HIT ---
export const ZoomHit: React.FC<EffectProps> = ({ instance, beat }) => {
    const { amount, recovery } = instance.params;
    const { camera } = useThree();
    const baseFov = useRef(50);
    const targetFov = useRef(50);

    useEffect(() => {
        baseFov.current = (camera as any).fov || 50;
        targetFov.current = baseFov.current;
    }, []);

    useEffect(() => {
        // On beat, punch in
        targetFov.current = baseFov.current - amount; 
    }, [beat]);

    useFrame((state, delta) => {
        // Recover
        targetFov.current = MathUtils.lerp(targetFov.current, baseFov.current, delta * recovery);
        
        if ((camera as any).fov !== targetFov.current) {
            (camera as any).fov = targetFov.current;
            camera.updateProjectionMatrix();
        }
    });

    return null;
};

// --- 5. COLOR GRADE SHIFT ---
// Note: Requires EffectComposer context usually. 
// We can use a simple overlay or modify ambient light if post-proc is tricky to inject.
// But R3F PostProcessing is robust. Let's use it if available in Scene.
// Actually, Scene.tsx already has EffectComposer. We can inject children there?
// `EffectsRenderer` is rendered inside Scene. 
// Standard EffectComposer cannot be nested easily.
// FALLBACK: Use a full-screen quad with custom shader OR simple Fog/Ambient manipulation.
// Let's go with Ambient Light color shifting.

export const ColorGradeShift: React.FC<EffectProps> = ({ instance }) => {
    const { speed, saturation } = instance.params;
    const { scene } = useThree();
    
    useFrame((state) => {
        const t = state.clock.elapsedTime * speed;
        // Cycle background or ambient
        const h = (t % 10) / 10;
        const color = new Color().setHSL(h, saturation, 0.1); // Dark bg
        scene.background = color;
    });
    
    // Cleanup on unmount
    useEffect(() => {
        return () => { scene.background = new Color('#020205'); };
    }, []);

    return null;
};
