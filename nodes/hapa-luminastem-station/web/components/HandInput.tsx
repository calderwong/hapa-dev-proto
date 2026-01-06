
import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../types';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandInputProps {
    enabled: boolean;
    onHandUpdate: (data: HandData | null) => void;
}

const HandInput: React.FC<HandInputProps> = ({ enabled, onHandUpdate }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastVideoTimeRef = useRef<number>(-1);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>();
    const [modelLoaded, setModelLoaded] = useState(false);
    const [hasPermission, setHasPermission] = useState(true);
    
    // For calculating velocity/twirl
    const prevIndexPos = useRef<{x:number, y:number} | null>(null);
    const prevWristPos = useRef<{x:number, y:number, z:number, time: number} | null>(null);

    // 1. Initialize MediaPipe
    useEffect(() => {
        const initHandLandmarker = async () => {
            console.log("HandInput: Initializing MediaPipe...");
            try {
                const visionFiles = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                );
                
                handLandmarkerRef.current = await HandLandmarker.createFromOptions(visionFiles, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 1
                });
                console.log("HandInput: Model loaded successfully.");
                setModelLoaded(true);
            } catch (e) {
                console.error("HandInput: Failed to load HandLandmarker", e);
            }
        };
        initHandLandmarker();
    }, []);

    // 2. Setup Webcam
    useEffect(() => {
        if (!enabled) {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
            onHandUpdate(null);
            return;
        }

        const startWebcam = async () => {
            console.log("HandInput: Requesting webcam access...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
                console.log("HandInput: Webcam access granted.");
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener('loadeddata', () => {
                        console.log("HandInput: Video data loaded, starting prediction loop.");
                        predict();
                    });
                }
            } catch (err) {
                console.error("HandInput: Webcam access denied", err);
                setHasPermission(false);
            }
        };

        if (modelLoaded) {
            startWebcam();
        }

        return () => {
             if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
    }, [enabled, modelLoaded]);

    // 3. Prediction Loop
    const predict = async () => {
        if (!enabled || !handLandmarkerRef.current || !videoRef.current) return;

        let startTimeMs = performance.now();
        
        // Ensure video has dimensions to prevent "ROI width and height must be > 0" error
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            if (videoRef.current.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = videoRef.current.currentTime;
                
                try {
                    const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
                    
                    if (results.landmarks && results.landmarks.length > 0) {
                        const landmarks = results.landmarks[0]; // First hand
                        
                        const wrist = landmarks[0];
                        const thumbTip = landmarks[4];
                        const indexTip = landmarks[8];
                        const middleTip = landmarks[12];
                        const ringTip = landmarks[16];
                        const pinkyTip = landmarks[20];
                        
                        const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x-p2.x, 2) + Math.pow(p1.y-p2.y, 2));
                        
                        // Gesture Logic
                        const indexDist = dist(wrist, indexTip);
                        const pinkyDist = dist(wrist, pinkyTip);

                        // Average extension of fingers
                        const avgExt = (indexDist + dist(wrist, middleTip) + dist(wrist, ringTip) + pinkyDist) / 4;
                        
                        const isClosed = avgExt < 0.25; 
                        const isSpread = avgExt > 0.45 && dist(indexTip, pinkyTip) > 0.3; // Fingers splayed

                        // Twirl/Activity Calculation (2D Plane)
                        let gestureDelta = 0;
                        if (prevIndexPos.current) {
                            const dx = indexTip.x - prevIndexPos.current.x;
                            const dy = indexTip.y - prevIndexPos.current.y;
                            gestureDelta = Math.sqrt(dx*dx + dy*dy) * 100; // Normalize
                        }
                        prevIndexPos.current = { x: indexTip.x, y: indexTip.y };

                        // Velocity Calculation (3D)
                        let velocity = { x: 0, y: 0, z: 0 };
                        const now = performance.now();
                        if (prevWristPos.current) {
                            const dt = (now - prevWristPos.current.time) / 1000; // Seconds
                            if (dt > 0) {
                                velocity.x = (wrist.x - prevWristPos.current.x) / dt;
                                velocity.y = (wrist.y - prevWristPos.current.y) / dt;
                                velocity.z = (wrist.z - prevWristPos.current.z) / dt;
                            }
                        }
                        prevWristPos.current = { x: wrist.x, y: wrist.y, z: wrist.z, time: now };

                        const x = -((landmarks[9].x * 2) - 1); 
                        const y = -((landmarks[9].y * 2) - 1); 

                        onHandUpdate({
                            landmarks: landmarks.map(l => ({ x: l.x, y: l.y, z: l.z })),
                            isClosed,
                            isSpread,
                            gestureDelta,
                            screenPosition: { x, y },
                            velocity
                        });
                    } else {
                        onHandUpdate(null);
                    }
                } catch (err) {
                    // Occasional errors in MP processing loop can happen
                    console.warn("HandInput: Prediction error", err);
                }
            }
        }

        requestRef.current = requestAnimationFrame(predict);
    };

    return (
        <div className={`fixed bottom-28 right-4 z-50 pointer-events-none transition-opacity duration-300 ${enabled ? 'opacity-100' : 'opacity-0'}`}>
            <div className="relative rounded-lg overflow-hidden border-2 border-green-500 shadow-[0_0_20px_rgba(0,255,100,0.5)] bg-black w-40 h-32">
                {!modelLoaded && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-green-500 bg-black/80 z-20">LOADING MODEL...</div>}
                {!hasPermission && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-500 bg-black/80 text-center p-2 z-20">CAMERA BLOCKED</div>}
                
                {/* Visual Processing Layers for Neon Effect */}
                <div className="absolute inset-0 bg-green-900/20 mix-blend-overlay pointer-events-none z-10"></div>
                <div className="absolute inset-0 border-[1px] border-green-500/30 pointer-events-none z-10 rounded-lg"></div>
                
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover transform -scale-x-100" 
                    style={{
                        // High Contrast + Grayscale + Brightness Thresholding = "Mask" look
                        filter: 'grayscale(100%) contrast(200%) brightness(0.7) drop-shadow(0px 0px 5px #00ff88)'
                    }}
                />
                
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,255,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
                
                <div className="absolute top-0 left-0 bg-black text-green-400 text-[8px] px-1 font-mono border-br border-green-500 z-20">
                    OPTICAL FEED
                </div>
            </div>
        </div>
    );
};

export default HandInput;
