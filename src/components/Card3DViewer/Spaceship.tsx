import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Projectile {
    id: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    createdAt: number;
}

interface SpaceshipProps {
    enabled: boolean;
    invertY?: boolean;
    onHitCard?: (cardId: string) => void;
    cardPositions?: Map<string, [number, number, number]>;
}

export const Spaceship: React.FC<SpaceshipProps> = ({ 
    enabled, 
    invertY = false,
    onHitCard,
    cardPositions = new Map(),
}) => {
    const shipRef = useRef<THREE.Group>(null);
    const reticleRef = useRef<THREE.Group>(null);
    const { camera } = useThree();
    
    // Ship state
    const [position, setPosition] = useState(new THREE.Vector3(0, 2, 10));
    const [rotation, setRotation] = useState(new THREE.Euler(0, Math.PI, 0));
    const [velocity, setVelocity] = useState(new THREE.Vector3());
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [projectileIdCounter, setProjectileIdCounter] = useState(0);
    
    // Input state
    const keysRef = useRef<Set<string>>(new Set());
    const mouseRef = useRef({ x: 0, y: 0 });

    const rayRef = useRef(new THREE.Ray());
    const sphereRef = useRef(new THREE.Sphere());
    const tmpVecARef = useRef(new THREE.Vector3());
    const tmpVecBRef = useRef(new THREE.Vector3());
    const tmpVecCRef = useRef(new THREE.Vector3());
    const bestHitRef = useRef(new THREE.Vector3());
    
    // Ship parameters
    const ACCELERATION = 0.015;
    const MAX_SPEED = 0.5;
    const DRAG = 0.98;
    const TURN_SPEED = 0.03;
    const MOUSE_TURN_SPEED = 0.06;
    const MOUSE_PITCH_SPEED = 0.05;
    const MOUSE_DEADZONE = 0.03;
    const PROJECTILE_SPEED = 1.5;
    const PROJECTILE_LIFETIME = 3000; // ms
    const FIRE_COOLDOWN = 150; // ms
    const RETICLE_FALLBACK_DISTANCE = 30;
    const lastFireRef = useRef(0);

    const fireProjectile = useCallback(() => {
        if (!shipRef.current) return;

        const shipPos = shipRef.current.position.clone();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(shipRef.current.rotation);

        const projectile: Projectile = {
            id: projectileIdCounter,
            position: shipPos.clone().add(direction.clone().multiplyScalar(0.8)),
            velocity: direction.multiplyScalar(PROJECTILE_SPEED),
            createdAt: Date.now(),
        };

        setProjectiles(prev => [...prev, projectile]);
        setProjectileIdCounter(prev => prev + 1);
    }, [PROJECTILE_SPEED, projectileIdCounter]);
    
    // Handle keyboard input
    useEffect(() => {
        if (!enabled) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.code);
            
            // Fire on Space
            if (e.code === 'Space') {
                const now = Date.now();
                if (now - lastFireRef.current > FIRE_COOLDOWN) {
                    lastFireRef.current = now;
                    fireProjectile();
                }
            }
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.code);
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        
        const handleClick = () => {
            const now = Date.now();
            if (now - lastFireRef.current > FIRE_COOLDOWN) {
                lastFireRef.current = now;
                fireProjectile();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleClick);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
        };
    }, [enabled, fireProjectile]);
    
    // Main update loop
    useFrame(() => {
        if (!enabled || !shipRef.current) return;
        
        const keys = keysRef.current;
        const newVelocity = velocity.clone();
        const newRotation = rotation.clone();

        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const pitchSign = invertY ? 1 : -1;
        if (Math.abs(mx) > MOUSE_DEADZONE) {
            newRotation.y -= mx * MOUSE_TURN_SPEED;
        }
        if (Math.abs(my) > MOUSE_DEADZONE) {
            newRotation.x = Math.max(
                -Math.PI / 3,
                Math.min(Math.PI / 3, newRotation.x + my * MOUSE_PITCH_SPEED * pitchSign),
            );
        }
        
        // Rotation (A/D or Arrow keys)
        if (keys.has('KeyA') || keys.has('ArrowLeft')) {
            newRotation.y += TURN_SPEED;
        }
        if (keys.has('KeyD') || keys.has('ArrowRight')) {
            newRotation.y -= TURN_SPEED;
        }
        
        // Pitch (W/S for up/down tilt)
        if (keys.has('KeyW') || keys.has('ArrowUp')) {
            newRotation.x = Math.min(newRotation.x + TURN_SPEED * 0.5 * pitchSign, Math.PI / 3);
        }
        if (keys.has('KeyS') || keys.has('ArrowDown')) {
            newRotation.x = Math.max(newRotation.x - TURN_SPEED * 0.5 * pitchSign, -Math.PI / 3);
        }
        
        // Forward thrust (Shift)
        if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyEuler(newRotation);
            newVelocity.add(forward.multiplyScalar(ACCELERATION));
        }
        
        // Backward (Ctrl)
        if (keys.has('ControlLeft') || keys.has('ControlRight')) {
            const backward = new THREE.Vector3(0, 0, 1);
            backward.applyEuler(newRotation);
            newVelocity.add(backward.multiplyScalar(ACCELERATION * 0.5));
        }
        
        // Strafe up/down (Q/E)
        if (keys.has('KeyQ')) {
            newVelocity.y += ACCELERATION * 0.5;
        }
        if (keys.has('KeyE')) {
            newVelocity.y -= ACCELERATION * 0.5;
        }
        
        // Apply drag and clamp speed
        newVelocity.multiplyScalar(DRAG);
        if (newVelocity.length() > MAX_SPEED) {
            newVelocity.normalize().multiplyScalar(MAX_SPEED);
        }
        
        // Update position
        const newPosition = position.clone().add(newVelocity);
        
        setVelocity(newVelocity);
        setRotation(newRotation);
        setPosition(newPosition);
        
        // Apply to mesh
        shipRef.current.position.copy(newPosition);
        shipRef.current.rotation.copy(newRotation);
        
        // Update camera to follow ship (third person)
        const cameraOffset = new THREE.Vector3(0, 2, 6);
        cameraOffset.applyEuler(newRotation);
        const cameraTarget = newPosition.clone().add(cameraOffset);
        camera.position.lerp(cameraTarget, 0.1);
        camera.lookAt(newPosition);

        if (reticleRef.current) {
            const ray = rayRef.current;
            const sphere = sphereRef.current;
            const tmpHit = tmpVecARef.current;
            const tmpCenter = tmpVecBRef.current;
            const aimDir = tmpVecCRef.current;
            const bestHit = bestHitRef.current;

            aimDir.set(0, 0, -1).applyEuler(newRotation).normalize();
            ray.set(newPosition, aimDir);

            let bestDist = Infinity;
            let hasHit = false;

            cardPositions.forEach((cardPos) => {
                tmpCenter.set(cardPos[0], cardPos[1], cardPos[2]);
                sphere.center.copy(tmpCenter);
                sphere.radius = 1.5;
                const hit = ray.intersectSphere(sphere, tmpHit);
                if (!hit) return;
                const d = hit.distanceTo(newPosition);
                if (d < bestDist) {
                    bestDist = d;
                    hasHit = true;
                    bestHit.copy(hit);
                }
            });

            if (hasHit) {
                reticleRef.current.position.copy(bestHit);
            } else {
                reticleRef.current.position.copy(
                    tmpHit.copy(newPosition).add(aimDir.clone().multiplyScalar(RETICLE_FALLBACK_DISTANCE)),
                );
            }
            reticleRef.current.lookAt(camera.position);
        }
        
        // Update projectiles
        const now = Date.now();
        setProjectiles(prev => {
            const updated: Projectile[] = [];
            
            for (const proj of prev) {
                // Remove expired projectiles
                if (now - proj.createdAt > PROJECTILE_LIFETIME) continue;
                
                // Move projectile
                proj.position.add(proj.velocity);
                
                // Check collision with cards
                let hit = false;
                cardPositions.forEach((cardPos, cardId) => {
                    const cardVec = new THREE.Vector3(...cardPos);
                    const dist = proj.position.distanceTo(cardVec);
                    if (dist < 1.5) {
                        hit = true;
                        onHitCard?.(cardId);
                    }
                });
                
                if (!hit) {
                    updated.push(proj);
                }
            }
            
            return updated;
        });
    });
    
    if (!enabled) return null;
    
    return (
        <>
            {/* Spaceship */}
            <group ref={shipRef} position={[position.x, position.y, position.z]}>
                {/* Main body - sleek arrow shape */}
                <mesh rotation={[0, 0, 0]}>
                    <coneGeometry args={[0.3, 1.2, 4]} />
                    <meshStandardMaterial 
                        color="#00ffff" 
                        emissive="#00aaaa"
                        emissiveIntensity={0.5}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>
                
                {/* Cockpit */}
                <mesh position={[0, 0.1, 0.1]}>
                    <sphereGeometry args={[0.15, 8, 8]} />
                    <meshStandardMaterial 
                        color="#ffffff"
                        emissive="#00ffff"
                        emissiveIntensity={0.3}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
                
                {/* Left wing */}
                <mesh position={[-0.4, 0, 0.2]} rotation={[0, 0, Math.PI / 6]}>
                    <boxGeometry args={[0.5, 0.05, 0.4]} />
                    <meshStandardMaterial 
                        color="#0088ff"
                        emissive="#004488"
                        emissiveIntensity={0.3}
                        metalness={0.9}
                        roughness={0.1}
                    />
                </mesh>
                
                {/* Right wing */}
                <mesh position={[0.4, 0, 0.2]} rotation={[0, 0, -Math.PI / 6]}>
                    <boxGeometry args={[0.5, 0.05, 0.4]} />
                    <meshStandardMaterial 
                        color="#0088ff"
                        emissive="#004488"
                        emissiveIntensity={0.3}
                        metalness={0.9}
                        roughness={0.1}
                    />
                </mesh>
                
                {/* Engine glow */}
                <mesh position={[0, 0, 0.6]}>
                    <sphereGeometry args={[0.12, 8, 8]} />
                    <meshBasicMaterial 
                        color="#ff6600"
                        transparent
                        opacity={0.9}
                    />
                </mesh>
                
                {/* Engine trail */}
                <mesh position={[0, 0, 0.9]}>
                    <coneGeometry args={[0.08, 0.5, 8]} />
                    <meshBasicMaterial 
                        color="#ff4400"
                        transparent
                        opacity={0.6}
                    />
                </mesh>
                
                {/* Point light for ship glow */}
                <pointLight color="#00ffff" intensity={0.5} distance={3} />
            </group>

            <group ref={reticleRef}>
                <mesh>
                    <ringGeometry args={[0.18, 0.24, 18]} />
                    <meshBasicMaterial color="#00ffff" transparent opacity={0.85} />
                </mesh>
                <mesh>
                    <circleGeometry args={[0.04, 12]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
                </mesh>
            </group>
            
            {/* Projectiles */}
            {projectiles.map(proj => (
                <mesh key={proj.id} position={[proj.position.x, proj.position.y, proj.position.z]}>
                    <sphereGeometry args={[0.1, 8, 8]} />
                    <meshBasicMaterial color="#ffff00" />
                    <pointLight color="#ffff00" intensity={0.3} distance={2} />
                </mesh>
            ))}
        </>
    );
};

export default Spaceship;
