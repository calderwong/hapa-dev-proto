
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Stars, Float, Edges, PointerLockControls, RoundedBox, Sphere, Ring, Cylinder, Torus, Box, TorusKnot, Text, useVideoTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PlacedPart, ViewMode, HullVisuals, Part, PlacedPart as IPlacedPart, EnvironmentConfig } from '../types';

// Fix for JSX intrinsic elements not being recognized by TypeScript in certain environments
const Group = 'group' as any;
const Mesh = 'mesh' as any;
const BoxGeometry = 'boxGeometry' as any;
const ConeGeometry = 'coneGeometry' as any;
const DodecahedronGeometry = 'dodecahedronGeometry' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const MeshBasicMaterial = 'meshBasicMaterial' as any;
const MeshPhysicalMaterial = 'meshPhysicalMaterial' as any;
const ShaderMaterial = 'shaderMaterial' as any;
const PointLight = 'pointLight' as any;
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;

const ensureHexColor = (color: string | undefined): string => {
  if (!color) return '#64748b';
  const normalized = color.trim().toUpperCase().replace(/\s+/g, '_');
  const colorMap: Record<string, string> = {
    'TITANIUM_SILVER': '#A5A9B4',
    'NEON_CYAN': '#00F2FF',
    'ELECTRIC_BLUE': '#7DF9FF',
    'VOID_BLACK': '#0A0A0A',
    'CRIMSON_PULSE': '#FF0033',
    'EMERALD_GLOW': '#39FF14',
    'PLASMA_PURPLE': '#A855F7',
    'STEALTH_GREY': '#2D2D2D',
    'SOLAR_GOLD': '#FFD700',
    'CARBON_FIBER': '#1C1C1C'
  };
  if (colorMap[normalized]) return colorMap[normalized];
  if (color.startsWith('#')) return color;
  const cssFriendly = color.toLowerCase().replace(/_/g, '');
  const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(color);
  if (isHex) return color;
  return /^[a-z]+$/i.test(cssFriendly) ? cssFriendly : '#64748b';
};

const NebulaShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#4f46e5") },
    uOpacity: { value: 0.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying vec3 vPosition;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      float n = snoise(vPosition * 0.05 + uTime * 0.1);
      float alpha = smoothstep(0.2, 0.8, n) * uOpacity;
      gl_FragColor = vec4(uColor, alpha);
    }
  `
};

const CoronaShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#fbbf24") }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float fresnel = pow(1.0 - dot(vNormal, vViewDir), 3.0);
      float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
      gl_FragColor = vec4(uColor, fresnel * pulse);
    }
  `
};

const AsteroidField: React.FC = () => {
  const asteroidData = useMemo(() => {
    return Array.from({ length: 50 }).map(() => ({
      position: [(Math.random() - 0.5) * 120, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 120] as [number, number, number],
      scale: 0.4 + Math.random() * 2.5,
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
      speed: (Math.random() - 0.5) * 0.005
    }));
  }, []);

  return (
    // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
    <Group>
      {asteroidData.map((data, i) => (
        <Float key={i} speed={1.5} rotationIntensity={1.5} floatIntensity={0.5} position={data.position}>
          {/* Fixed: Using Mesh constant to avoid JSX.IntrinsicElements errors */}
          <Mesh scale={data.scale} rotation={data.rotation}>
            {/* Fixed: Using DodecahedronGeometry constant to avoid JSX.IntrinsicElements errors */}
            <DodecahedronGeometry args={[1, 1]} />
            {/* Fixed: Using MeshStandardMaterial constant to avoid JSX.IntrinsicElements errors */}
            <MeshStandardMaterial color="#334155" roughness={0.9} metalness={0.1} flatShading />
          </Mesh>
        </Float>
      ))}
    </Group>
  );
};

const NebulaCloud: React.FC<{ cloud: any }> = ({ cloud }) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    if (shaderRef.current) shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <Sphere args={[cloud.scale, 32, 32]} position={cloud.position}>
      {/* Fixed: Using ShaderMaterial constant to avoid JSX.IntrinsicElements errors */}
      <ShaderMaterial
        ref={shaderRef}
        attach="material"
        args={[NebulaShader]}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: cloud.color },
          uOpacity: { value: cloud.opacity }
        }}
      />
    </Sphere>
  );
};

const Nebula: React.FC = () => {
  const nebulaClouds = useMemo(() => {
    return Array.from({ length: 8 }).map(() => ({
      position: [(Math.random() - 0.5) * 250, (Math.random() - 0.5) * 150, (Math.random() - 0.5) * 250] as [number, number, number],
      color: new THREE.Color(["#4f46e5", "#7c3aed", "#db2777", "#2563eb"][Math.floor(Math.random() * 4)]),
      scale: 30 + Math.random() * 50,
      opacity: 0.04 + Math.random() * 0.06
    }));
  }, []);

  return (
    // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
    <Group>
      {nebulaClouds.map((cloud, i) => (
        <NebulaCloud key={i} cloud={cloud} />
      ))}
    </Group>
  );
};

const SolarFlare: React.FC = () => {
  const coronaRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    if (coronaRef.current) coronaRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
    <Group position={[150, 80, -200]}>
      <Sphere args={[20, 32, 32]}>
        {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
        <MeshBasicMaterial color="#fffbe6" />
      </Sphere>
      {/* Fixed: Using PointLight constant to avoid JSX.IntrinsicElements errors */}
      <PointLight intensity={50} distance={1500} color="#fbbf24" castShadow />
      
      <Sphere args={[24, 32, 32]}>
        {/* Fixed: Using ShaderMaterial constant to avoid JSX.IntrinsicElements errors */}
        <ShaderMaterial
          ref={coronaRef}
          attach="material"
          args={[CoronaShader]}
          transparent
          side={THREE.DoubleSide}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#fbbf24") }
          }}
        />
      </Sphere>

      <Sphere args={[30, 32, 32]}>
        {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
        <MeshBasicMaterial color="#f59e0b" transparent opacity={0.15} />
      </Sphere>
    </Group>
  );
};

const CelestialBodies: React.FC<{ environmentConfig: EnvironmentConfig }> = ({ environmentConfig }) => (
  // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
  <Group>
    {!environmentConfig.showSolarFlare && (
      // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
      <Group position={[80, 40, -100]}>
        <Sphere args={[15, 32, 32]}>
          {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
          <MeshBasicMaterial color="#fffbe6" />
        </Sphere>
        {/* Fixed: Using PointLight constant to avoid JSX.IntrinsicElements errors */}
        <PointLight intensity={10} distance={500} color="#fffbe6" castShadow />
      </Group>
    )}
    
    {environmentConfig.showSolarFlare && <SolarFlare />}
    {environmentConfig.showNebula && <Nebula />}
    {environmentConfig.showAsteroids && <AsteroidField />}

    {/* Fixed: Using Group constant to avoid JSX.IntrinsicElements errors */}
    <Group position={[-120, 20, 50]}>
      <Sphere args={[10, 32, 32]}>
        {/* Fixed: Using MeshPhysicalMaterial constant to avoid JSX.IntrinsicElements errors */}
        <MeshPhysicalMaterial color="#94a3b8" roughness={0.8} metalness={0.1} emissive="#1e293b" emissiveIntensity={0.2} />
      </Sphere>
      {/* Fixed: Using PointLight constant to avoid JSX.IntrinsicElements errors */}
      <PointLight intensity={5} distance={300} color="#94a3b8" />
    </Group>
  </Group>
);

const EngineFlame: React.FC<{ color: string, scale?: number, isFiring?: boolean }> = ({ color, scale = 1, isFiring = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const safeColor = ensureHexColor(color);
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      const s = (isFiring ? 1.5 : 0.8) + Math.sin(t * 40) * 0.15;
      meshRef.current.scale.set(s * scale, s * scale * (isFiring ? 3.0 : 1.5), s * scale);
      if (meshRef.current.material instanceof THREE.MeshBasicMaterial) {
        meshRef.current.material.opacity = (isFiring ? 0.9 : 0.4) + Math.sin(t * 25) * 0.2;
      }
    }
  });
  return (
    // Fixed: Using Mesh constant to avoid JSX.IntrinsicElements errors
    <Mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      {/* Fixed: Using ConeGeometry constant to avoid JSX.IntrinsicElements errors */}
      <ConeGeometry args={[0.3, 2.0, 16]} />
      {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
      <MeshBasicMaterial color={safeColor} transparent opacity={0.8} />
    </Mesh>
  );
};

const Module: React.FC<ModuleProps> = ({ part, viewMode, currentFloor, isSelected, isHovered, onPointerDown, parts, hullVisuals, isFiringEngines, videoStream }) => {
  const reactorCoreRef = useRef<THREE.Group>(null);
  const [w, h, d] = part.size || [1, 1, 1];
  const isAbove = part.position[1] > currentFloor;
  const rotationRad = (part.rotation * Math.PI) / 180;
  const isSynthesized = viewMode === 'SYNTHESIZED';

  const emissiveColor = useMemo(() => new THREE.Color(ensureHexColor(isSynthesized && hullVisuals ? hullVisuals.emissiveColor : part.color)), [isSynthesized, hullVisuals, part.color]);

  useFrame((state) => {
    if (reactorCoreRef.current) {
      reactorCoreRef.current.rotation.y += 0.05;
      reactorCoreRef.current.rotation.z += 0.02;
    }
  });

  if (viewMode === 'CUTAWAY' && isAbove) return null;

  const isBack = !(parts || []).some(p => p.position[2] < part.position[2] && Math.abs(p.position[0] - part.position[0]) < 0.5 && Math.abs(p.position[1] - part.position[1]) < 0.5);

  const isGhosted = viewMode === 'CUTAWAY' && part.position[1] < currentFloor;
  const opacity = isGhosted ? 0.05 : 1.0;
  
  const baseColor = ensureHexColor(isSynthesized && hullVisuals ? hullVisuals.primaryColor : part.color);

  const metalness = isSynthesized && hullVisuals ? hullVisuals.reflectivity : 0.8;
  const roughness = isSynthesized && hullVisuals ? (1 - hullVisuals.reflectivity) * 0.5 : 0.2;

  const bodyMaterial = (
    // Fixed: Using MeshPhysicalMaterial constant to avoid JSX.IntrinsicElements errors
    <MeshPhysicalMaterial 
      color={baseColor} 
      metalness={metalness} 
      roughness={roughness} 
      transparent={opacity < 1} 
      opacity={opacity} 
      emissive={emissiveColor} 
      emissiveIntensity={0.1}
      clearcoat={isSynthesized ? 1 : 0} 
      clearcoatRoughness={0.1}
    />
  );

  return (
    // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
    <Group position={part.position} rotation={[0, rotationRad, 0]} onPointerDown={onPointerDown}>
      {/* Fixed: Using Mesh constant to avoid JSX.IntrinsicElements errors */}
      <Mesh userData={{ type: 'module_proxy', instanceId: part.instanceId }}>
        {/* Fixed: Using BoxGeometry constant to avoid JSX.IntrinsicElements errors */}
        <BoxGeometry args={[w, h, d]} />
        {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
        <MeshBasicMaterial visible={false} />
      </Mesh>

      {isSynthesized && hullVisuals ? (
        <RoundedBox args={[w, h, d]} radius={0.2} smoothness={10}>
          {bodyMaterial}
        </RoundedBox>
      ) : (
        <Box args={[w, h, d]}>
          {bodyMaterial}
          <Edges color={isSelected ? "#fff" : "#1e293b"} />
        </Box>
      )}

      {part.type === 'REACTOR' && !isGhosted && (
        // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
        <Group ref={reactorCoreRef}>
          <TorusKnot args={[0.3, 0.08, 128, 16]}>
            {/* Fixed: Using MeshStandardMaterial constant to avoid JSX.IntrinsicElements errors */}
            <MeshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={5} transparent opacity={0.6} />
          </TorusKnot>
        </Group>
      )}

      {part.type === 'ENGINE' && isBack && (
        // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
        <Group position={[0, 0, -d / 2 - 0.7]}>
          <EngineFlame color={emissiveColor.getStyle()} scale={w} isFiring={isFiringEngines} />
          {/* Fixed: Using PointLight constant to avoid JSX.IntrinsicElements errors */}
          <PointLight color={emissiveColor} intensity={isFiringEngines ? 15 : 5} distance={15} />
        </Group>
      )}

      {isSelected && (
        // Fixed: Using Group constant to avoid JSX.IntrinsicElements errors
        <Group>
          <Box args={[w + 0.1, h + 0.1, d + 0.1]}>
             {/* Fixed: Using MeshBasicMaterial constant to avoid JSX.IntrinsicElements errors */}
             <MeshBasicMaterial color="#0ea5e9" transparent opacity={0.1} wireframe />
          </Box>
          {/* Fixed: Using PointLight constant to avoid JSX.IntrinsicElements errors */}
          <PointLight color="#0ea5e9" intensity={2} distance={5} />
        </Group>
      )}
    </Group>
  );
};

interface ModuleProps {
  part: IPlacedPart;
  viewMode: ViewMode;
  currentFloor: number;
  isSelected: boolean;
  isHovered: boolean;
  onPointerDown: (e: any) => void;
  parts: IPlacedPart[];
  hullVisuals: HullVisuals | null;
  isFiringEngines: boolean;
  videoStream: MediaStream | null;
}

const ShipScene: React.FC<ShipSceneProps> = ({ 
  parts, currentFloor, viewMode, isLaunchMode, selectedInstanceId, onPartClick, onGridClick, onDeselectAll, hullVisuals, selectedPart, currentRotation, shipRotation, videoStream, environmentConfig
}) => {
  const containerRef = useRef<THREE.Group>(null);
  const [isFiringEngines, setIsFiringEngines] = useState(false);
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((state) => {
    if (containerRef.current) {
       containerRef.current.rotation.y = THREE.MathUtils.lerp(containerRef.current.rotation.y, (shipRotation * Math.PI) / 180, 0.1);
    }
    setIsFiringEngines(keys.current['KeyW'] || keys.current['KeyS']);
  });

  return (
    <>
      <CelestialBodies environmentConfig={environmentConfig} />
      <Stars radius={300} depth={50} count={10000} factor={8} saturation={1} fade speed={1} />
      {/* Fixed: Using AmbientLight constant to avoid JSX.IntrinsicElements errors */}
      <AmbientLight intensity={0.4} />
      {/* Fixed: Using DirectionalLight constant to avoid JSX.IntrinsicElements errors */}
      <DirectionalLight position={[150, 80, -200]} intensity={3} color="#fffbe6" castShadow />
      
      {!isLaunchMode && viewMode !== 'EXPLORE' && (
        <Grid infiniteGrid fadeDistance={80} sectionSize={5} cellSize={1} cellColor="#1e293b" sectionColor="#0ea5e9" position={[0, currentFloor - 0.5, 0]} />
      )}

      {viewMode === 'EXPLORE' && <><Player /><PointerLockControls /></>}

      {/* Fixed: Using Group constant to avoid JSX.IntrinsicElements errors */}
      <Group ref={containerRef} onPointerDown={(e) => {
        if (!e || !e.intersections || e.intersections.length === 0) return;
        const hit = e.intersections.find((i: any) => i.object?.userData?.type === 'module_proxy');
        if (hit) onPartClick(hit.object.userData.instanceId);
        else onDeselectAll();
      }}>
         {(parts || []).map(p => (
           <Module 
             key={p.instanceId} 
             part={p} 
             viewMode={viewMode} 
             currentFloor={currentFloor} 
             isSelected={selectedInstanceId === p.instanceId} 
             isHovered={false} 
             onPointerDown={() => {}} 
             parts={parts} 
             hullVisuals={hullVisuals} 
             isFiringEngines={isFiringEngines} 
             videoStream={videoStream} 
           />
         ))}
      </Group>

      <OrbitControls makeDefault minDistance={5} maxDistance={150} dampingFactor={0.05} />

      <EffectComposer multisampling={0}>
        <Bloom 
          intensity={1.0} 
          luminanceThreshold={0.9} 
          luminanceSmoothing={0.5} 
          mipmapBlur 
        />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
        <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation={false} modulationOffset={0} />
      </EffectComposer>
    </>
  );
};

const Player: React.FC = () => {
  const { camera } = useThree();
  const keys = useRef<{ [key: string]: boolean }>({});
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  useFrame(() => {
    const dir = new THREE.Vector3();
    const front = new THREE.Vector3(0, 0, (keys.current['KeyS'] ? 1 : 0) - (keys.current['KeyW'] ? 1 : 0));
    const side = new THREE.Vector3((keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0), 0, 0);
    dir.subVectors(front, side).normalize().multiplyScalar(0.15).applyQuaternion(camera.quaternion);
    camera.position.add(dir);
  });
  return null;
};

export const ShipCanvas: React.FC<ShipCanvasProps> = (props) => (
  <div className={`w-full h-full relative ${props.isPaused ? 'pointer-events-none' : ''}`}>
    <Canvas shadows dpr={props.isPaused ? 1 : [1, 2]} frameloop={props.isPaused ? 'demand' : 'always'}>
      <PerspectiveCamera makeDefault position={[35, 25, 35]} fov={35} />
      <ShipScene {...props} />
    </Canvas>
  </div>
);

interface ShipCanvasProps {
  parts: IPlacedPart[];
  currentFloor: number;
  viewMode: ViewMode;
  isLaunchMode: boolean;
  isPaused?: boolean;
  selectedInstanceId: string | null;
  onPartClick: (id: string) => void;
  onGridClick: (pos: [number, number, number]) => void;
  onDeselectAll: () => void;
  hullVisuals: HullVisuals | null;
  selectedPart: Part | null;
  currentRotation: number;
  shipRotation: number;
  videoStream: MediaStream | null;
  environmentConfig: EnvironmentConfig;
}

interface ShipSceneProps extends ShipCanvasProps {}
