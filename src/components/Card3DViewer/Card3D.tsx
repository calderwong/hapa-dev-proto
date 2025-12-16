import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// Tier colors and labels
const TIER_CONFIG: Record<string, { color: string; label: string; glow: number }> = {
    common: { color: '#6b7280', label: 'COMMON', glow: 0.2 },
    uncommon: { color: '#10b981', label: 'UNCOMMON', glow: 0.3 },
    rare: { color: '#3b82f6', label: 'RARE', glow: 0.4 },
    epic: { color: '#a855f7', label: 'EPIC', glow: 0.5 },
    legendary: { color: '#f97316', label: 'LEGENDARY', glow: 0.6 },
    mythic: { color: '#ec4899', label: 'MYTHIC', glow: 0.8 },
};

const TIER_TEXT_CLASS: Record<string, string> = {
    common: 'text-gray-400',
    uncommon: 'text-emerald-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-orange-400',
    mythic: 'text-pink-400',
};

// Media kind icons
const MEDIA_ICONS: Record<string, string> = {
    video: '🎬',
    image: '🖼️',
    audio: '🎵',
    document: '📄',
};

let MEDIA_OVERLAY_TEXTURE: THREE.CanvasTexture | null = null;

function getMediaOverlayTexture(): THREE.CanvasTexture | null {
    if (MEDIA_OVERLAY_TEXTURE) return MEDIA_OVERLAY_TEXTURE;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, canvas.width * 0.52);
    grad.addColorStop(0, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.02)');
    grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < canvas.height; y += 5) {
        ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let y = 2; y < canvas.height; y += 5) {
        ctx.fillRect(0, y, canvas.width, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    MEDIA_OVERLAY_TEXTURE = tex;
    return tex;
}

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
    hasSummary?: boolean;
    hasKeyTerms?: boolean;
    hasImages?: boolean;
    childCount?: number;
    labelLodDistance?: number;
    skills?: string[];
    lore?: string;
    facts?: string[];
    desires?: string[];
    keyTerms?: string[];
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const Card3D: React.FC<Card3DProps> = ({
    cardId,
    name,
    tier = 'common',
    mediaKind = 'document',
    thumbnailUrl,
    videoUrl: _videoUrl,
    position = [0, 0, 0],
    scale = 1,
    isFocused = false,
    isParent = false,
    isChild = false,
    hasSummary = false,
    hasKeyTerms = false,
    hasImages = false,
    childCount = 0,
    labelLodDistance = 12,
    skills = [],
    lore,
    facts = [],
    desires = [],
    keyTerms = [],
    onClick,
    onDoubleClick,
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const [showLabel, setShowLabel] = useState(true);
    const { camera } = useThree();
    
    // Card dimensions - slightly smaller for cleaner look
    const cardWidth = 1.8;
    const cardHeight = 2.4;
    const cardDepth = 0.08;
    
    const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.common;
    const tierTextClass = TIER_TEXT_CLASS[tier] || TIER_TEXT_CLASS.common;
    const mediaIcon = MEDIA_ICONS[mediaKind] || MEDIA_ICONS.document;
    
    // Load texture if thumbnail available
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [textureFailed, setTextureFailed] = useState(false);
    const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(null);

    const thumbnailStatusColor = !thumbnailUrl
        ? '#475569'
        : texture
            ? '#22c55e'
            : textureFailed
                ? '#ef4444'
                : resolvedThumbnailUrl
                    ? '#f59e0b'
                    : '#38bdf8';

    useEffect(() => {
        let cancelled = false;
        setTexture(null);
        setTextureFailed(false);
        setResolvedThumbnailUrl(null);
        if (!thumbnailUrl) return;

        const resolveUrl = async (): Promise<string> => {
            const raw = String(thumbnailUrl);
            if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('http://') || raw.startsWith('https://')) {
                return raw;
            }
            const api = (typeof window !== 'undefined' ? (window as any).electronAPI : null) as any;
            const isWindowsPath = /^[A-Za-z]:[\\/]/.test(raw);
            const isUncPath = raw.startsWith('\\\\');

            if (raw.startsWith('file://') || isWindowsPath || isUncPath) {
                const decoded = (() => {
                    try {
                        return decodeURI(raw);
                    } catch {
                        return raw;
                    }
                })();

                const localPath = decoded.startsWith('file://')
                    ? decoded.replace(/^file:\/\//, '').replace(/^\/+/, '').replace(/\//g, '\\')
                    : decoded;

                if (api?.readFileAsBase64) {
                    const result = await api.readFileAsBase64(localPath);
                    if (typeof result === 'string') {
                        const mimeType = localPath.toLowerCase().endsWith('.png')
                            ? 'image/png'
                            : localPath.toLowerCase().endsWith('.jpg') || localPath.toLowerCase().endsWith('.jpeg')
                                ? 'image/jpeg'
                                : localPath.toLowerCase().endsWith('.webp')
                                    ? 'image/webp'
                                    : localPath.toLowerCase().endsWith('.gif')
                                        ? 'image/gif'
                                        : 'application/octet-stream';
                        return `data:${mimeType};base64,${result}`;
                    }
                    if (result?.base64) {
                        const mimeType = result.mimeType || 'application/octet-stream';
                        return `data:${mimeType};base64,${result.base64}`;
                    }
                }
            }
            return raw;
        };

        (async () => {
            try {
                const url = await resolveUrl();
                if (cancelled) return;
                setResolvedThumbnailUrl(url);
            } catch {
                if (cancelled) return;
                setResolvedThumbnailUrl(null);
                setTextureFailed(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [thumbnailUrl]);

    useEffect(() => {
        let cancelled = false;
        setTexture(null);
        setTextureFailed(false);
        if (!resolvedThumbnailUrl) return;

        const loader = new THREE.TextureLoader();
        loader.load(
            resolvedThumbnailUrl,
            (tex) => {
                if (cancelled) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.generateMipmaps = false;
                tex.needsUpdate = true;
                setTexture(tex);
            },
            undefined,
            (_err) => {
                if (cancelled) return;
                setTexture(null);
                setTextureFailed(true);
            }
        );

        return () => {
            cancelled = true;
        };
    }, [resolvedThumbnailUrl]);

    const mediaOverlayTexture = useMemo(() => getMediaOverlayTexture(), []);
    
    // Floating animation - more subtle for non-focused cards
    // Also compute distance-based LOD for labels
    useFrame((state) => {
        if (groupRef.current) {
            const floatIntensity = isFocused ? 0.08 : 0.04;
            const rotateIntensity = isFocused ? 0.03 : hovered ? 0.02 : 0;
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + cardId.charCodeAt(0)) * floatIntensity;

            const baseRotY = Math.sin(state.clock.elapsedTime * 0.3) * rotateIntensity;
            const camDx = camera.position.x - groupRef.current.position.x;
            const camDy = camera.position.y - groupRef.current.position.y;
            const tiltX = hovered && !isFocused ? THREE.MathUtils.clamp(camDy * 0.03, -0.18, 0.18) : 0;
            const tiltY = hovered && !isFocused ? THREE.MathUtils.clamp(-camDx * 0.03, -0.18, 0.18) : 0;
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, tiltX, 0.12);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, baseRotY + tiltY, 0.12);
            groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.12);

            // Distance-based label LOD
            const dist = camera.position.distanceTo(groupRef.current.position);
            const shouldShow = isFocused || hovered || dist < labelLodDistance;
            if (shouldShow !== showLabel) setShowLabel(shouldShow);
        }
    });
    
    // Badge indicators
    const badges: string[] = [];
    if (hasSummary) badges.push('📝');
    if (hasKeyTerms) badges.push('🔑');
    if (hasImages) badges.push('🖼️');
    if (childCount > 0) badges.push(`👶${childCount}`);

    const mediaWidth = cardWidth - 0.24;
    const mediaHeight = cardHeight * 0.56;

    const detailLevel = isFocused ? 2 : hovered ? 1 : 0;

    const lorePreview = useMemo(() => {
        const raw = String(lore ?? '').replace(/\s+/g, ' ').trim();
        if (!raw) return undefined;
        const max = detailLevel >= 2 ? 110 : 60;
        return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
    }, [detailLevel, lore]);

    const factChips = useMemo(() => {
        const arr = Array.isArray(facts) ? facts : [];
        const max = detailLevel >= 2 ? 2 : 0;
        return max > 0 ? arr.filter(Boolean).slice(0, max) : [];
    }, [detailLevel, facts]);

    const desireChips = useMemo(() => {
        const arr = Array.isArray(desires) ? desires : [];
        const max = detailLevel >= 2 ? 2 : 0;
        return max > 0 ? arr.filter(Boolean).slice(0, max) : [];
    }, [detailLevel, desires]);
    
    return (
        <group
            ref={groupRef}
            position={position}
            scale={hovered && !isFocused ? scale * 1.05 : scale}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            <mesh position={[0, 0, -0.16]} scale={[1.2, 1.2, 1]}>
                <planeGeometry args={[cardWidth, cardHeight]} />
                <meshBasicMaterial
                    color={tierConfig.color}
                    transparent
                    opacity={isFocused ? tierConfig.glow * 1.1 : hovered ? tierConfig.glow * 0.75 : tierConfig.glow * 0.25}
                    side={THREE.DoubleSide}
                />
            </mesh>

            <RoundedBox
                args={[cardWidth + 0.06, cardHeight + 0.06, cardDepth + 0.02]}
                radius={0.09}
                smoothness={4}
                position={[0, 0, 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={tierConfig.color}
                    metalness={0.9}
                    roughness={0.25}
                    emissive={tierConfig.color}
                    emissiveIntensity={isFocused ? 0.25 : hovered ? 0.12 : 0.05}
                />
            </RoundedBox>

            <RoundedBox
                args={[cardWidth, cardHeight, cardDepth]}
                radius={0.085}
                smoothness={4}
                position={[0, 0, 0.005]}
                castShadow
                receiveShadow
            >
                <meshPhysicalMaterial
                    color="#0b1220"
                    metalness={0.25}
                    roughness={0.72}
                    clearcoat={0.35}
                    clearcoatRoughness={0.85}
                />
            </RoundedBox>
            
            {/* Quality bar at top */}
            <mesh position={[0, cardHeight / 2 - 0.06, cardDepth / 2 + 0.005]}>
                <planeGeometry args={[cardWidth - 0.1, 0.08]} />
                <meshBasicMaterial color={tierConfig.color} />
            </mesh>

            <mesh position={[cardWidth / 2 - 0.14, cardHeight / 2 - 0.14, cardDepth / 2 + 0.01]}>
                <circleGeometry args={[0.06, 16]} />
                <meshStandardMaterial
                    color="#0b1220"
                    metalness={0.8}
                    roughness={0.35}
                    emissive={tierConfig.color}
                    emissiveIntensity={hovered || isFocused ? 0.2 : 0.08}
                />
            </mesh>
            
            {/* Main content area - show thumbnail or placeholder */}
            <RoundedBox
                args={[mediaWidth + 0.08, mediaHeight + 0.08, 0.02]}
                radius={0.06}
                smoothness={4}
                position={[0, 0.15, cardDepth / 2 - 0.01]}
            >
                <meshStandardMaterial
                    color="#070b12"
                    metalness={0.65}
                    roughness={0.32}
                    emissive={tierConfig.color}
                    emissiveIntensity={isFocused ? 0.08 : hovered ? 0.05 : 0.02}
                />
            </RoundedBox>

            <mesh position={[0, 0.15, cardDepth / 2 + 0.02]} renderOrder={2000}>
                <planeGeometry args={[mediaWidth, mediaHeight]} />
                {texture ? (
                    <meshBasicMaterial
                        key={`thumb-tex:${resolvedThumbnailUrl || 'unknown'}`}
                        map={texture}
                        toneMapped={false}
                        depthWrite={false}
                        depthTest={false}
                        side={THREE.DoubleSide}
                    />
                ) : (
                    <meshBasicMaterial
                        key="thumb-fallback"
                        color="#0f172a"
                        toneMapped={false}
                        depthWrite={false}
                        depthTest={false}
                        side={THREE.DoubleSide}
                    />
                )}
            </mesh>

            {!texture && (
                <mesh position={[0, 0.15, cardDepth / 2 + 0.009]} renderOrder={11}>
                    <planeGeometry args={[mediaWidth + 0.02, mediaHeight + 0.02]} />
                    <meshPhysicalMaterial
                        color="#0ea5e9"
                        transparent
                        opacity={isFocused ? 0.14 : hovered ? 0.11 : 0.08}
                        roughness={0.06}
                        metalness={0}
                        transmission={0.7}
                        thickness={0.08}
                        ior={1.15}
                        clearcoat={1}
                        clearcoatRoughness={0.14}
                        depthWrite={false}
                        depthTest={false}
                    />
                </mesh>
            )}

            {mediaOverlayTexture && !texture && (
                <mesh position={[0, 0.15, cardDepth / 2 + 0.0105]} renderOrder={12}>
                    <planeGeometry args={[mediaWidth + 0.03, mediaHeight + 0.03]} />
                    <meshBasicMaterial
                        map={mediaOverlayTexture}
                        color="#ffffff"
                        transparent
                        opacity={isFocused ? 0.24 : hovered ? 0.18 : 0.12}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        depthTest={false}
                    />
                </mesh>
            )}

            {!texture && (
                <mesh position={[0, 0.05, cardDepth / 2 + 0.012]} renderOrder={20}>
                    <planeGeometry args={[cardWidth - 0.12, cardHeight - 0.18]} />
                    <meshPhysicalMaterial
                        color="#0ea5e9"
                        transparent
                        opacity={0.08}
                        roughness={0.08}
                        metalness={0}
                        transmission={0.6}
                        thickness={0.1}
                        ior={1.15}
                        clearcoat={1}
                        clearcoatRoughness={0.12}
                        depthWrite={false}
                        depthTest={false}
                    />
                </mesh>
            )}
            
            {/* HTML overlay for rich content (LOD: hidden when far) */}
            {showLabel && (
            <Html
                position={[0, -cardHeight * 0.28, cardDepth / 2 + 0.02]}
                center
                distanceFactor={6}
                wrapperClass="pointer-events-none"
            >
                <div className="select-none w-44">
                    <div className="rounded-lg border border-gray-700/60 bg-gray-950/75 backdrop-blur-sm px-2 py-1.5">
                        <div className="flex items-center justify-between">
                            <div
                                className={`text-[8px] font-bold tracking-[0.22em] opacity-90 ${tierTextClass}`}
                            >
                                {tierConfig.label}
                            </div>
                            <div className="text-[10px] opacity-75">{mediaIcon}</div>
                        </div>

                        {(!thumbnailUrl || !texture || textureFailed) && (
                            <div className="mt-1 flex items-center justify-center h-16 rounded bg-gray-900/60 border border-gray-800/60">
                                <span className="text-2xl opacity-60">{mediaIcon}</span>
                            </div>
                        )}

                        <div className="mt-1 text-white text-[11px] font-mono text-center rounded bg-black/40 border border-gray-800/60 px-2 py-1 truncate">
                            {name?.substring(0, 28) || 'Untitled'}
                        </div>

                        {badges.length > 0 && (
                            <div className="flex justify-center gap-1 mt-1">
                                {badges.map((badge, i) => (
                                    <span key={i} className="text-[8px] bg-gray-800/60 border border-gray-700/60 px-1 rounded">
                                        {badge}
                                    </span>
                                ))}
                            </div>
                        )}
                    
                    {/* Relationship indicator */}
                    {(isParent || isChild) && (
                        <div className={`text-center text-[9px] font-mono mt-1 ${
                            isParent ? 'text-cyan-400' : 'text-purple-400'
                        }`}>
                            {isParent ? '▲ PARENT' : '▼ CHILD'}
                        </div>
                    )}
                    
                    {/* Key Terms / Skills */}
                    {keyTerms.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap justify-center gap-0.5">
                            {keyTerms.slice(0, 3).map((term, i) => (
                                <span key={i} className="text-[7px] bg-emerald-900/60 text-emerald-300 px-1 py-0.5 rounded">
                                    {term.length > 12 ? term.slice(0, 10) + '…' : term}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* Skills */}
                    {skills.length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                            {skills.slice(0, detailLevel >= 2 ? 3 : 2).map((skill, i) => (
                                <span key={i} className="text-[7px] bg-amber-900/60 text-amber-300 px-1 py-0.5 rounded font-bold">
                                    ⚡ {skill.length > 10 ? skill.slice(0, 8) + '…' : skill}
                                </span>
                            ))}
                        </div>
                    )}

                    {(factChips.length > 0 || desireChips.length > 0) && (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                            {factChips.map((t, i) => (
                                <span key={`f:${i}`} className="text-[7px] bg-cyan-900/50 text-cyan-200 px-1 py-0.5 rounded">
                                    ✓ {String(t).length > 18 ? String(t).slice(0, 16) + '…' : String(t)}
                                </span>
                            ))}
                            {desireChips.map((t, i) => (
                                <span key={`d:${i}`} className="text-[7px] bg-fuchsia-900/45 text-fuchsia-200 px-1 py-0.5 rounded">
                                    ⇢ {String(t).length > 18 ? String(t).slice(0, 16) + '…' : String(t)}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* Lore snippet */}
                    {lorePreview && detailLevel >= 1 && (
                        <div className="mt-1 text-[6px] text-gray-400 italic text-center leading-tight max-h-6 overflow-hidden">
                            "{lorePreview}"
                        </div>
                    )}
                    </div>
                </div>
            </Html>
            )}

            {isFocused && (
                <mesh position={[cardWidth / 2 - 0.11, cardHeight / 2 - 0.11, cardDepth / 2 + 0.03]} renderOrder={50}>
                    <circleGeometry args={[0.03, 16]} />
                    <meshBasicMaterial color={thumbnailStatusColor} toneMapped={false} depthWrite={false} depthTest={false} />
                </mesh>
            )}
            
            {/* Focus ring - animated */}
            {isFocused && (
                <mesh position={[0, 0, -0.08]} rotation={[0, 0, 0]}>
                    <ringGeometry args={[cardWidth * 0.52, cardWidth * 0.56, 6]} />
                    <meshBasicMaterial
                        color={tierConfig.color}
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
