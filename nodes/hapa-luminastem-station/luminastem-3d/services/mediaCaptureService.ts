import { v4 as uuidv4 } from 'uuid';

class MediaCaptureService {
    private activeStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private recordingStartMs: number = 0;

    async getWebcamStream(opts: { audio: boolean } = { audio: true }): Promise<MediaStream> {
        this.stopStream();
        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }, // 720p preference
                audio: opts.audio
            });
            return this.activeStream;
        } catch (err) {
            console.error("Error accessing webcam:", err);
            throw err;
        }
    }

    async getMicStream(): Promise<MediaStream> {
        this.stopStream();
        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            return this.activeStream;
        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    async getScreenStream(opts: { audio: boolean } = { audio: false }): Promise<MediaStream> {
        this.stopStream();
        try {
            this.activeStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: opts.audio
            });
            return this.activeStream;
        } catch (err) {
            console.error("Error accessing screen share:", err);
            throw err;
        }
    }

    startRecording(stream: MediaStream): string {
        this.recordedChunks = [];
        this.recordingStartMs = Date.now();
        
        const hasVideo = stream.getVideoTracks().length > 0;
        const mimeType = this.getSupportedMimeType(hasVideo);
        const options: MediaRecorderOptions | undefined = mimeType ? { mimeType } : undefined;

        try {
            this.mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.warn(`MediaRecorder init failed with mimeType: ${mimeType}, trying default.`, e);
            try {
                this.mediaRecorder = new MediaRecorder(stream);
            } catch (e2) {
                console.error("MediaRecorder failed to initialize completely.", e2);
                throw e2;
            }
        }

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onerror = (event: any) => {
            console.error("MediaRecorder error:", event.error);
        };

        // Start with 1s chunks
        try {
            this.mediaRecorder.start(1000);
        } catch (e) {
            console.error("Failed to start MediaRecorder:", e);
        }
        
        return uuidv4(); // Session ID
    }

    async stopRecording(): Promise<{ blob: Blob, mimeType: string, durationSec: number }> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) return reject("No recorder active");

            const durationSec = (Date.now() - this.recordingStartMs) / 1000;

            this.mediaRecorder.onstop = () => {
                const type = this.mediaRecorder?.mimeType || (this.recordedChunks[0]?.type) || 'video/webm';
                const blob = new Blob(this.recordedChunks, { type });
                // Clean up tracks immediately after stop
                this.stopStream(); 
                resolve({ 
                    blob, 
                    mimeType: type,
                    durationSec: durationSec
                });
            };

            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            } else {
                // If it never started or already stopped
                this.stopStream();
                reject("Recorder was inactive");
            }
        });
    }

    stopStream() {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(track => track.stop());
            this.activeStream = null;
        }
        this.mediaRecorder = null;
    }

    private getSupportedMimeType(hasVideo: boolean): string {
        const videoTypes = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm",
            "video/mp4"
        ];
        const audioTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg",
            "audio/mp4"
        ];

        const types = hasVideo ? videoTypes : audioTypes;

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return "";
    }

    async generateThumbnail(blob: Blob): Promise<string> {
        if (blob.type.startsWith('audio/')) {
            return ""; // Audio clips don't have visual thumbnails
        }

        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = URL.createObjectURL(blob);
            video.muted = true;
            video.playsInline = true;
            
            // Wait for metadata to know duration, then seek a bit
            video.onloadedmetadata = () => {
                video.currentTime = Math.min(0.5, video.duration / 2);
            };

            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    URL.revokeObjectURL(video.src);
                    resolve(dataUrl);
                } else {
                    resolve("");
                }
            };
            
            // Error handling/timeout
            video.onerror = () => resolve("");
            setTimeout(() => resolve(""), 3000); 
        });
    }
}

export const mediaCaptureService = new MediaCaptureService();