
import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, Vector3, DoubleSide, AdditiveBlending, MathUtils, IcosahedronGeometry, Color, Group } from 'three';
import { Html } from '@react-three/drei';
import { AudioStem, VisualSettings } from '../types';
import { audioService } from '../services/audioService';

interface StemMeshProps {
  stem: AudioStem;
  onSelect: (id: string, multi: boolean) => void;
  isSelected: boolean;
  showVectors: boolean;
  spatialFocus: boolean; 
  orbitMode: boolean; 
  timeScale: number;
  flightMode: boolean;
  mixerValues: { a: number, b: number, c: number };
  focusPoint: { x: number, y: number } | null;
  totalStemsInGroup: number;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  visualSettings: VisualSettings;
  mixAllStems?: boolean; // New prop
}

// --- VISUALS ---

const ConstructionEffect = ({ color, progressRef }: { color: string, progressRef: React.MutableRefObject<number> }) => {
    const group = useRef<Group>(null);
    const barRef = useRef<HTMLDivElement>(null);

    useFrame((state) => {
        if (!group.current) return;
        const p = progressRef.current;
        group.current.rotation.y = state.clock.elapsedTime * 8;
        group.current.rotation.x = Math.sin(state.clock.elapsedTime * 5) * 0.2;
        const inv = 1 - p;
        group.current.scale.setScalar(1 + inv * 0.5);
        group.current.children.forEach((c: any) => {
             if (c.material) {
                 c.material.opacity = inv;
                 c.material.transparent = true;
             }
        });
        if (barRef.current) barRef.current.style.width = `${p * 100}%`;
    });

    return (
        <group ref={group}>
            <mesh><boxGeometry args={[2.2, 2.2, 2.2]} /><meshBasicMaterial color={color} wireframe /></mesh>
            <mesh rotation={[Math.PI/2, 0, 0]}><ringGeometry args={[2.5, 2.6, 32]} /><meshBasicMaterial color={color} side={DoubleSide} /></mesh>
            <Html position={[0, 2.5, 0]} center transform sprite={false} zIndexRange={[100, 0]}>
                <div className="flex flex-col items-center w-24">
                     <div className="w-full h-1 bg-gray-900 border border-white/20 rounded overflow-hidden backdrop-blur-sm">
                         <div ref={barRef} className="h-full bg-white shadow-[0_0_5px_white]" style={{ width: '0%' }}></div>
                     </div>
                </div>
            </Html>
        </group>
    );
};

const SelectionReticle = () => {
    const ref = useRef<Mesh>(null);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.x = Math.sin(t * 0.5) * 0.2;
            ref.current.rotation.y += 0.02;
        }
    });
    return (
        <group>
            <mesh ref={ref}>
                <icosahedronGeometry args={[1.5, 0]} />
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <ringGeometry args={[2.2, 2.3, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={AdditiveBlending} side={DoubleSide} />
            </mesh>
        </group>
    );
};

const PlasmaShield = ({ color, intensity, seed, distortion, wireframe, ghostMode }: { color: string, intensity: number, seed: number, distortion: number, wireframe: boolean, ghostMode: boolean }) => {
    const ref = useRef<Mesh>(null);
    const ref2 = useRef<Mesh>(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (ref.current) {
            ref.current.rotation.y = t * 0.5 + seed;
            const distScale = 1 + Math.sin(t * 10) * distortion * 0.2;
            const s = (1.2 + (intensity - 1) * 0.3) * distScale;
            ref.current.scale.setScalar(s);
        }
        if (ref2.current) {
            ref2.current.rotation.x = -t * 0.8 + seed;
            const s = 1.1 + Math.sin(t * 5 + seed) * 0.05 + (intensity - 1) * 0.2;
            ref2.current.scale.setScalar(s);
        }
    });

    if (ghostMode) {
        return (
            <group>
                <mesh ref={ref}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial color="#555" wireframe transparent opacity={0.1} />
                </mesh>
            </group>
        );
    }

    return (
        <group>
            <mesh ref={ref}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color={color} wireframe transparent opacity={0.15 * intensity} blending={AdditiveBlending} />
            </mesh>
            <mesh ref={ref2}>
                <dodecahedronGeometry args={[0.85, wireframe ? 0 : 1]} />
                <meshBasicMaterial 
                    color={color} 
                    wireframe={wireframe}
                    transparent 
                    opacity={wireframe ? 0.5 : 0.1 * intensity} 
                    blending={AdditiveBlending} 
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
};

const DataParticles = ({ color, intensity, density }: { color: string, intensity: number, density: number }) => {
    const maxParticles = 40;
    const count = Math.min(maxParticles, Math.floor(12 * (density + 0.1)));
    const mesh = useRef<any>(null);
    const particles = useMemo(() => {
        return new Array(maxParticles).fill(0).map((_, i) => ({
            theta: Math.random() * Math.PI * 2,
            phi: Math.acos(2 * Math.random() - 1),
            speed: 0.5 + Math.random() * 1.5,
            radius: 1.5 + Math.random() * 0.5
        }));
    }, []);

    useFrame((state) => {
        if (!mesh.current || !mesh.current.geometry?.attributes?.position) return;
        const positions = mesh.current.geometry.attributes.position.array;
        
        for(let i=0; i<count; i++) {
            const p = particles[i];
            if (!p) continue; 
            p.theta += p.speed * 0.01 * intensity;
            
            // Explosion effect if density is high
            const r = density > 2 ? p.radius + Math.sin(state.clock.elapsedTime * 10) * 0.5 : p.radius;

            const x = r * Math.sin(p.phi) * Math.cos(p.theta);
            const y = r * Math.sin(p.phi) * Math.sin(p.theta);
            const z = r * Math.cos(p.phi);

            const idx = i * 3;
            positions[idx] = x;
            positions[idx+1] = y;
            positions[idx+2] = z;
        }
        mesh.current.geometry.attributes.position.needsUpdate = true;
        // Hide unused particles
        mesh.current.geometry.setDrawRange(0, count);
    });

    return (
        <points ref={mesh}>
             <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={maxParticles} array={new Float32Array(maxParticles * 3)} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.08 * density} color={color} transparent opacity={0.6} blending={AdditiveBlending} />
        </points>
    );
}

const ReactiveCore = ({ color, intensity, opacity, seed, wireframe, ghostMode }: { color: string, intensity: number, opacity: number, seed: number, wireframe: boolean, ghostMode: boolean }) => {
    const mesh = useRef<Mesh>(null);
    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.x = state.clock.elapsedTime * 0.2 + seed;
            mesh.current.rotation.y = state.clock.elapsedTime * 0.3 + seed;
        }
    });

    if (ghostMode) {
         return (
             <mesh ref={mesh}>
                <icosahedronGeometry args={[0.5, 1]} />
                <meshBasicMaterial color="#444" wireframe transparent opacity={0.2} />
             </mesh>
         );
    }

    return (
        <group>
            <mesh ref={mesh}>
                <icosahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial 
                    color={color}
                    emissive={color}
                    emissiveIntensity={intensity * 2}
                    roughness={0.2}
                    metalness={1}
                    wireframe={wireframe}
                />
            </mesh>
            {!wireframe && <mesh>
                <icosahedronGeometry args={[0.7, 1]} />
                <meshPhysicalMaterial 
                    color={color} roughness={0} metalness={0.1} transmission={0.9} thickness={1} transparent opacity={opacity} clearcoat={1}
                />
            </mesh>}
        </group>
    );
};

const EngineThrusters = ({ color, intensity }: { color: string, intensity: number }) => {
    const count = 20;
    const mesh = useRef<any>(null);
    const particles = useMemo(() => new Array(count).fill(0).map((_, i) => ({ z: i * 0.3, offset: Math.random() * Math.PI * 2, speed: 0.2 + Math.random() * 0.5, radius: 0.1 + Math.random() * 0.2 })), []);

    useFrame((state) => {
        if (!mesh.current || !mesh.current.geometry?.attributes?.position) return;
        const positions = mesh.current.geometry.attributes.position.array;
        for(let i=0; i<count; i++) {
            const p = particles[i];
            p.z += p.speed * intensity;
            if(p.z > 5) p.z = 0; 
            const idx = i * 3;
            const angle = state.clock.elapsedTime * 10 + p.offset;
            positions[idx] = Math.cos(angle) * p.radius * (1 - p.z/5); 
            positions[idx+1] = Math.sin(angle) * p.radius * (1 - p.z/5); 
            positions[idx+2] = p.z + 0.8; 
        }
        mesh.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={mesh}>
             <bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={new Float32Array(count * 3)} itemSize={3} /></bufferGeometry>
            <pointsMaterial size={0.1} color={color} transparent opacity={0.8} blending={AdditiveBlending} />
        </points>
    );
};

const StemMesh: React.FC<StemMeshProps> = ({ 
    stem, onSelect, isSelected, showVectors, spatialFocus, 
    orbitMode, timeScale, flightMode, mixerValues, focusPoint, totalStemsInGroup,
    onToggleMute, onToggleSolo, visualSettings, mixAllStems
}) => {
  const meshRef = useRef<Mesh>(null);
  const groupRef = useRef<any>(null);
  const { camera } = useThree();
  
  const dataArray = useMemo(() => new Uint8Array(stem.analyserNode.frequencyBinCount), [stem.analyserNode]);
  const seed = useMemo(() => Math.random() * 100, []);
  const mountProgress = useRef(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  
  const orbitSpeed = useMemo(() => (Math.random() * 0.1 + 0.05) * (Math.random() > 0.5 ? 1 : -1), []);
  const orbitRadius = useMemo(() => 8 + Math.random() * 12, []);
  
  const currentVolumeRef = useRef<number>(0);
  const intensityRef = useRef<number>(1);
  const smartVolumeRef = useRef<number>(1); 

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (mountProgress.current < 1) {
        mountProgress.current += delta * 1.5;
        if (mountProgress.current >= 1) { mountProgress.current = 1; setIsFullyLoaded(true); }
    }

    stem.analyserNode.getByteFrequencyData(dataArray);
    let sum = 0; 
    const limit = Math.floor(dataArray.length / 4);
    for (let i = 0; i < limit; i++) sum += dataArray[i];
    const normVol = (sum / limit) / 256;
    currentVolumeRef.current = MathUtils.lerp(currentVolumeRef.current, normVol, 0.2); 
    intensityRef.current = 1 + currentVolumeRef.current * 3;

    // Logic: Smart Vol & Spatial Filter
    let calculatedVolume = 1.0;
    // IF mixAllStems is ON, we ALWAYS apply mixing regardless of if stem is unique.
    // IF mixAllStems is OFF, we ONLY apply mixing if there are >1 stems (Legacy behavior)
    if (mixAllStems || totalStemsInGroup > 1) {
         const weights = [mixerValues.a, mixerValues.b, mixerValues.c];
         const myWeight = weights[stem.fleetId || 0];
         const total = weights.reduce((a,b) => a+b, 0);
         // If total weight is near zero, everything fades.
         // Otherwise, normalize myWeight.
         // Added max(0.3) floor to ensure it doesn't get too quiet unless specifically mixed out.
         if (total > 0.01) calculatedVolume = Math.min(1.0, myWeight / Math.max(0.3, (total * 0.5))); 
         else calculatedVolume = 0;
    }
    smartVolumeRef.current = MathUtils.lerp(smartVolumeRef.current, calculatedVolume, 0.1);

    // Movement
    if (isSelected) {
        groupRef.current.position.copy(stem.position);
    } else if (flightMode) {
        // Flight logic...
        const z = stem.position.z * 0.2; 
        groupRef.current.position.lerp(new Vector3(stem.position.x, stem.position.y, z), 0.1);
    } else if (orbitMode) {
        const t = state.clock.elapsedTime * orbitSpeed * timeScale;
        groupRef.current.position.set(Math.cos(t) * orbitRadius, stem.position.y, Math.sin(t) * orbitRadius);
        stem.position.copy(groupRef.current.position);
        groupRef.current.lookAt(0, stem.position.y, 0); 
    } else {
        groupRef.current.position.lerp(stem.position, 0.1);
        if (meshRef.current) meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 * timeScale + seed) * (0.5 + currentVolumeRef.current);
    }

    const dist = camera.position.distanceTo(groupRef.current.position);
    const distanceFactor = 1 / (1 + Math.max(0, dist - 15) * 0.1);
    const targetVol = stem.isMuted ? 0 : (stem.volume * distanceFactor * smartVolumeRef.current);
    
    // NOTE: Analyser is now BEFORE Gain, so visualizer works even if Gain is 0.
    stem.gainNode.gain.setTargetAtTime(targetVol, state.clock.elapsedTime, 0.1);
    audioService.updateSpatialFilters(stem.lowPassNode, stem.highPassNode, groupRef.current.position.y);

    const loadingScale = MathUtils.smoothstep(mountProgress.current, 0, 1);
    if(meshRef.current) meshRef.current.scale.setScalar((1 + currentVolumeRef.current * 0.5) * loadingScale);
  });

  const isActive = smartVolumeRef.current > 0.05;

  return (
    <group 
        ref={groupRef} 
        position={stem.position}
        onClick={(e) => { e.stopPropagation(); onSelect(stem.id, e.shiftKey); }}
    >
      {!isFullyLoaded && <ConstructionEffect color={stem.color} progressRef={mountProgress} />}

      {isSelected && (
        <Html position={[0, -2, 0]} center zIndexRange={[100, 0]}>
             <div className="flex gap-2 bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] transform transition-all scale-100 origin-top">
                 <button onClick={(e) => { e.stopPropagation(); onToggleMute(stem.id); }} className={`px-3 py-1 rounded text-xs font-bold border ${stem.isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-gray-700/50 border-gray-600'}`}>{stem.isMuted ? 'UNMUTE' : 'MUTE'}</button>
                 <button onClick={(e) => { e.stopPropagation(); onToggleSolo(stem.id); }} className="px-3 py-1 rounded text-xs font-bold border border-yellow-500/30 bg-yellow-500/10 text-yellow-500">SOLO</button>
             </div>
        </Html>
      )}

      {flightMode && (<group position={[0, 0, 1.5]} rotation={[0, Math.PI, 0]}><EngineThrusters color={stem.color} intensity={intensityRef.current} /></group>)}

      {/* Group ID Indicator */}
      {stem.groupId && <mesh position={[0, 2.5, 0]}>
          <ringGeometry args={[0.5, 0.6, 6]} />
          <meshBasicMaterial color="#ffffff" />
      </mesh>}

      {isSelected && <SelectionReticle />}

      <group ref={meshRef}>
         <ReactiveCore color={stem.color} intensity={intensityRef.current} opacity={smartVolumeRef.current} seed={seed} wireframe={visualSettings.wireframeMode} ghostMode={stem.isMuted} />
         {isActive && !stem.isMuted && (
             <>
                 <PlasmaShield color={stem.color} intensity={intensityRef.current} seed={seed} distortion={visualSettings.meshDistortion} wireframe={visualSettings.wireframeMode} ghostMode={false} />
                 <DataParticles color={stem.color} intensity={intensityRef.current} density={visualSettings.particleDensity} />
             </>
         )}
         {stem.isMuted && <PlasmaShield color={stem.color} intensity={intensityRef.current} seed={seed} distortion={0} wireframe={true} ghostMode={true} />}
      </group>

      {showVectors && isActive && (
        <Html position={[0, 1.8, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border-l-2 border-green-500 shadow-lg">
                <div className="text-[10px] text-green-400 font-mono font-bold">{stem.name}</div>
            </div>
        </Html>
      )}
    </group>
  );
};

export default StemMesh;
