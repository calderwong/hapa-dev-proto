
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, Line, Environment, CameraShake, Text } from '@react-three/drei';
import { EffectComposer, ChromaticAberration } from '@react-three/postprocessing';
import { Vector3, Plane, MathUtils, AdditiveBlending, BufferGeometry, Float32BufferAttribute, Vector2 } from 'three';
import StemMesh from './StemMesh';
import LoopNavigator from './LoopNavigator';
import MediaBillboard from './MediaBillboard';
import EffectsRenderer from './EffectsRenderer'; 
import { AudioStem, HandData, FormationType, FormationConfig, VisualSettings, MediaClip, MediaPlacement } from '../types';

interface SceneProps {
  stems: AudioStem[];
  updateStemPosition: (id: string, newPos: Vector3, isShiftHeld: boolean) => void;
  onStemDragEnd: (id: string) => void;
  cameraShakeEnabled: boolean;
  shakeIntensity: number;
  showVectors: boolean;
  showTerrain: boolean;
  spatialFocus: boolean;
  orbitMode: boolean;
  timeScale: number;
  flightMode: boolean;
  flightSpeed: number;
  obstacleDensity: number;
  handData: HandData | null;
  handControlEnabled: boolean;
  handSmoothness: number;
  handSpread: number;
  currentFormation: FormationType;
  customFormation: FormationConfig | null;
  mixerValues: { a: number, b: number, c: number };
  focusPoint: { x: number, y: number } | null;
  stemsByName: Record<string, number>;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  visualSettings: VisualSettings;
  selectedStemIds: string[];
  onSelectStem: (id: string, multi: boolean) => void;
  mixAllStems: boolean;
  mediaClips: MediaClip[];
  mediaPlacements: MediaPlacement[];
}

// --- HARMONIC TETHERS ---
const HarmonicTethers = ({ stems, enabled, elasticity }: { stems: AudioStem[], enabled: boolean, elasticity: number }) => {
    const lineRef = useRef<any>(null);
    
    useFrame(() => {
        if (!enabled || !lineRef.current) return;
        
        // Find close stems and draw lines
        const points: Vector3[] = [];
        // Only connect if same fleet or grouped
        for (let i = 0; i < stems.length; i++) {
            for (let j = i + 1; j < stems.length; j++) {
                const s1 = stems[i];
                const s2 = stems[j];
                const dist = s1.position.distanceTo(s2.position);
                
                // Connection Logic: Close distance OR same Group
                if (dist < 15 * elasticity || (s1.groupId && s1.groupId === s2.groupId)) {
                     // Midpoint vibration
                     const mid = s1.position.clone().add(s2.position).multiplyScalar(0.5);
                     // Add slight noise based on volume
                     mid.y += (Math.random() - 0.5) * (s1.volume + s2.volume) * elasticity;
                     
                     points.push(s1.position);
                     points.push(mid);
                     points.push(mid);
                     points.push(s2.position);
                }
            }
        }
        
        if (points.length > 0) {
            lineRef.current.geometry.setFromPoints(points);
        } else {
             // Clear
             lineRef.current.geometry.setFromPoints([new Vector3(0,0,0), new Vector3(0,0,0)]);
        }
    });

    if (!enabled) return null;

    return (
        <lineSegments ref={lineRef}>
            <bufferGeometry />
            <lineBasicMaterial color="#00ff88" transparent opacity={0.3} blending={AdditiveBlending} />
        </lineSegments>
    );
};

const SceneContent: React.FC<SceneProps> = ({ 
    stems, updateStemPosition, onStemDragEnd, 
    cameraShakeEnabled, shakeIntensity, showVectors,
    handData, handControlEnabled, handSmoothness, handSpread,
    currentFormation, customFormation,
    spatialFocus, orbitMode, timeScale, showTerrain,
    mixerValues, focusPoint, stemsByName,
    onToggleMute, onToggleSolo, visualSettings,
    selectedStemIds, onSelectStem, mixAllStems,
    mediaClips, mediaPlacements
}) => {
  const { camera, raycaster } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = new Plane(new Vector3(0, 0, 1), 0); 
  const intersection = new Vector3();
  const [currentBeat, setCurrentBeat] = useState(0);
  
  const fleetsRef = useRef([
      { pos: new Vector3(-18, 0, 0), vel: new Vector3(0, 0, 0), rotation: 0, rotVel: 0.2, anchor: new Vector3(-18, 0, 0) },
      { pos: new Vector3(18, 0, 0), vel: new Vector3(0, 0, 0), rotation: 0, rotVel: 0.2, anchor: new Vector3(18, 0, 0) },
      { pos: new Vector3(0, 15, -5), vel: new Vector3(0, 0, 0), rotation: 0, rotVel: 0.2, anchor: new Vector3(0, 15, -5) }
  ]);

  const evaluateMath = (code: string, t: number, i: number, count: number) => {
      try { return new Function('t', 'i', 'count', 'Math', `return ${code}`)(t, i, count, Math); } catch (e) { return 0; }
  };

  useEffect(() => {
      const handleBeat = (e: any) => setCurrentBeat(e.detail.beat);
      window.addEventListener('hapa-beat', handleBeat);
      return () => window.removeEventListener('hapa-beat', handleBeat);
  }, []);

  useFrame((state, delta) => {
      // Formation & Fleet Logic (Simplified for clarity, keeps existing logic)
      fleetsRef.current.forEach((fleet, idx) => {
          fleet.rotation += fleet.rotVel * delta;
          fleet.pos.lerp(fleet.anchor, 0.01);
      });

      stems.forEach((stem) => {
          if (stem.sourceNode) { 
              const fleetIdx = stem.fleetId || 0;
              const fleet = fleetsRef.current[fleetIdx];
              
              // Only apply formation math if NOT being dragged
              const isSelected = selectedStemIds.includes(stem.id);
              
              if (!isDragging || !isSelected) {
                   const fleetStems = stems.filter(s => (s.fleetId || 0) === fleetIdx);
                   const localIndex = fleetStems.indexOf(stem);
                   const count = fleetStems.length;
                   let localPos = new Vector3();

                   // Formation Math...
                   const sRad = Math.max(5, handSpread);
                   const sAngle = (localIndex / count) * Math.PI * 2 + fleet.rotation;
                   localPos.set(Math.cos(sAngle) * sRad, Math.sin(sAngle) * (sRad * 0.5), 0);
                   
                   stem.position.lerp(fleet.pos.clone().add(localPos), handSmoothness);
              }
          }
      });
      state.camera.position.lerp(new Vector3(0, 10, 50), 0.05);
      state.camera.lookAt(0, 5, 0);
  });

  const handlePointerMove = (event: any) => {
    if (isDragging && selectedStemIds.length > 0) {
      dragPlane.normal.copy(camera.position).normalize();
      raycaster.setFromCamera(event.pointer, camera);
      raycaster.ray.intersectPlane(dragPlane, intersection);
      
      // If moving a group, we need a delta, but for simplicity here we just move the primary one
      if (selectedStemIds.length === 1) {
          updateStemPosition(selectedStemIds[0], intersection.clone(), event.shiftKey);
      } else {
          updateStemPosition(selectedStemIds[0], intersection.clone(), event.shiftKey);
      }
    }
  };

  const handlePointerUp = () => {
    if (isDragging) { 
        selectedStemIds.forEach(id => onStemDragEnd(id));
        setIsDragging(false); 
    }
  };

  const isPlaying = stems.some(s => s.isPlaying);

  // Prepare Fleet Targets for Attachments
  const attachTargets = {
      'fleetA': fleetsRef.current[0].pos,
      'fleetB': fleetsRef.current[1].pos,
      'fleetC': fleetsRef.current[2].pos
  };

  return (
    <>
      <color attach="background" args={['#020205']} />
      <ambientLight intensity={0.2} />
      <pointLight position={[20, 20, 20]} intensity={0.5} color="#00ffff" />
      <pointLight position={[-20, -10, 10]} intensity={0.5} color="#bd00ff" />
      
      <Stars radius={150} depth={50} count={5000} factor={4} saturation={1} fade speed={0.5} />
      
      <HarmonicTethers stems={stems} enabled={visualSettings.connectionLines} elasticity={visualSettings.connectionElasticity} />
      
      {showTerrain && (
          <group position={[0, -15, 0]}>
              <Grid args={[200, 200]} cellSize={4} cellColor="#1a1a2e" sectionColor="#00ff88" sectionSize={40} fadeDistance={80} />
              {/* Warp the grid visually if requested */}
              {visualSettings.gridWarp > 0 && <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.1, 0]}>
                   <planeGeometry args={[200, 200, 32, 32]} />
                   <meshBasicMaterial wireframe color="#00ff88" transparent opacity={visualSettings.gridWarp * 0.2} />
              </mesh>}
          </group>
      )}
      
      <CameraShake maxYaw={0.01 * shakeIntensity} maxPitch={0.01 * shakeIntensity} intensity={cameraShakeEnabled ? 1 : 0} />
      
      <EffectComposer>
         <ChromaticAberration offset={[visualSettings.chromaticAberration * 0.001, visualSettings.chromaticAberration * 0.001] as any} />
      </EffectComposer>

      {/* --- EFFECTS DECK --- */}
      <EffectsRenderer stems={stems} beat={currentBeat} />

      <LoopNavigator stems={stems} isPlaying={isPlaying} timeScale={timeScale} />

      <mesh visible={false} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <planeGeometry args={[100, 100]} />
      </mesh>

      {/* Render Audio Stems */}
      {stems.map((stem) => (
        <StemMesh 
          key={stem.id} 
          stem={stem} 
          isSelected={selectedStemIds.includes(stem.id)}
          onSelect={(id, multi) => { onSelectStem(id, multi); setIsDragging(true); }}
          showVectors={showVectors}
          spatialFocus={spatialFocus}
          orbitMode={orbitMode}
          timeScale={timeScale}
          flightMode={false} 
          mixerValues={mixerValues}
          focusPoint={focusPoint}
          totalStemsInGroup={stemsByName[stem.name] || 0}
          onToggleMute={onToggleMute}
          onToggleSolo={onToggleSolo}
          visualSettings={visualSettings}
          mixAllStems={mixAllStems}
        />
      ))}

      {/* Render Media Billboards */}
      {mediaPlacements.map(placement => {
          const clip = mediaClips.find(c => c.hash === placement.clipHash);
          if (!clip) return null;
          return (
              <MediaBillboard 
                  key={placement.id}
                  placement={placement}
                  clip={clip}
                  attachTargets={attachTargets}
                  cameraPos={camera.position}
              />
          );
      })}
      
      <OrbitControls makeDefault enabled={!isDragging && !handControlEnabled} maxDistance={90} minDistance={10} />
      <Environment preset="night" blur={0.6} />
    </>
  );
};

// Optimization: Memoize Scene to avoid full webgl re-render on transport updates
const Scene = React.memo((props: SceneProps) => {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas camera={{ position: [0, 10, 50], fov: 50 }} gl={{ antialias: true, alpha: false }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
});

export default Scene;
