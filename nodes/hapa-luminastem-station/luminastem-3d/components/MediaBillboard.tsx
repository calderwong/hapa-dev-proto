import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, Mesh, Vector3, VideoTexture, Group } from 'three';
import { MediaPlacement, MediaClip } from '../types';
import { Text } from '@react-three/drei';

interface MediaBillboardProps {
    placement: MediaPlacement;
    clip: MediaClip;
    attachTargets: { [key: string]: Vector3 }; // Fleet positions etc.
    cameraPos: Vector3;
}

const MediaBillboard: React.FC<MediaBillboardProps> = ({ placement, clip, attachTargets, cameraPos }) => {
    const groupRef = useRef<Group>(null);
    const [videoTexture, setVideoTexture] = useState<VideoTexture | null>(null);
    const { camera } = useThree();

    useEffect(() => {
        if (!clip.blob) return;

        let videoElement: HTMLVideoElement | null = null;
        let texture: VideoTexture | null = null;
        
        // Fix: Mime-based check instead of kind check
        const isVideo = clip.mimeType.startsWith('video/');

        if (isVideo) {
            videoElement = document.createElement('video');
            videoElement.src = URL.createObjectURL(clip.blob);
            videoElement.loop = placement.loop;
            videoElement.muted = true; 
            videoElement.playsInline = true;
            videoElement.play().catch(e => console.warn("Auto-play blocked", e));
            
            texture = new VideoTexture(videoElement);
            setVideoTexture(texture);
        } else {
            setVideoTexture(null);
        }

        return () => {
            // Fix: Clean up specific instances to prevent leaks
            if (videoElement) {
                videoElement.pause();
                if (videoElement.src) URL.revokeObjectURL(videoElement.src);
            }
            if (texture) {
                texture.dispose();
            }
        };
    }, [clip.id, clip.blob, clip.mimeType, placement.loop]);

    useFrame(() => {
        if (!groupRef.current) return;

        let targetPos = new Vector3(placement.position.x, placement.position.y, placement.position.z);
        
        if (placement.attachMode === 'camera') {
            // HUD Mode: Sticky to camera
            groupRef.current.position.copy(camera.position);
            groupRef.current.quaternion.copy(camera.quaternion);
            
            // Local offset relative to camera
            groupRef.current.translateX(placement.position.x);
            groupRef.current.translateY(placement.position.y);
            groupRef.current.translateZ(placement.position.z - 10); // Push out
            return; 
        } 
        
        if (placement.attachMode.startsWith('fleet')) {
            const fleetPos = attachTargets[placement.attachMode];
            if (fleetPos) {
                targetPos.add(fleetPos);
            }
        }

        groupRef.current.position.lerp(targetPos, 0.1);
        
        // Face camera for world objects
        groupRef.current.lookAt(cameraPos);
    });

    const isMic = clip.kind === 'mic';
    const hasVideo = !!videoTexture;

    return (
        <group ref={groupRef}>
            {/* The Screen */}
            <mesh scale={[placement.scale.x * 4, placement.scale.y * 2.25, 1]}>
                <planeGeometry />
                {hasVideo ? (
                    <meshBasicMaterial map={videoTexture!} side={DoubleSide} transparent opacity={placement.opacity} />
                ) : (
                    <meshBasicMaterial color="#111" side={DoubleSide} transparent opacity={0.8} />
                )}
            </mesh>
            
            {/* Frame/Decor */}
            <mesh scale={[placement.scale.x * 4.1, placement.scale.y * 2.35, 1]}>
                 <planeGeometry />
                 <meshBasicMaterial color={isMic ? '#00ff88' : '#ffffff'} wireframe transparent opacity={0.2} />
            </mesh>

            {/* Audio Visual Placeholder if no video */}
            {!hasVideo && (
                <group>
                    {/* Background Bar */}
                    <mesh position={[0, 0, 0.01]}>
                        <planeGeometry args={[placement.scale.x * 3.5, 0.1]} />
                        <meshBasicMaterial color="#333" />
                    </mesh>
                     {/* Label */}
                    <Text position={[0, 0.5, 0.02]} fontSize={0.3} color="#00ff88" anchorX="center" anchorY="middle">
                        AUDIO CLIP
                    </Text>
                     {/* Sub-label */}
                    <Text position={[0, -0.5, 0.02]} fontSize={0.2} color="#aaaaaa" anchorX="center" anchorY="middle">
                        {clip.label.substring(0, 20)}
                    </Text>
                </group>
            )}
        </group>
    );
};

export default MediaBillboard;