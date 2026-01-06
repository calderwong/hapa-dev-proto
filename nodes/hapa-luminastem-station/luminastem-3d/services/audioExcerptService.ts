
import { audioService } from './audioService';

class AudioExcerptService {
    
    // Finds the 10-second window with highest RMS energy
    async createSmartExcerpt(buffer: AudioBuffer, maxDuration: number = 10): Promise<{ blob: Blob, start: number, end: number }> {
        const duration = Math.min(buffer.duration, maxDuration);
        const windowSize = 1.0; // 1 second analysis windows
        
        let bestStart = 0;
        let maxEnergy = -1;
        
        if (buffer.duration > duration) {
            // Scan for loudest section
            const channelData = buffer.getChannelData(0);
            const sampleRate = buffer.sampleRate;
            const windowSamples = Math.floor(windowSize * sampleRate);
            const step = Math.floor(windowSamples / 2); // 50% overlap
            
            for (let i = 0; i < channelData.length - windowSamples; i += step) {
                let sum = 0;
                // Simple RMS check (sampled for speed)
                for (let j = 0; j < windowSamples; j+=100) {
                    const s = channelData[i + j];
                    sum += s * s;
                }
                const rms = Math.sqrt(sum / (windowSamples / 100));
                
                if (rms > maxEnergy) {
                    maxEnergy = rms;
                    bestStart = (i / sampleRate);
                }
            }
            
            // Adjust start to capture a bit before the peak if possible
            bestStart = Math.max(0, bestStart - (duration / 2));
            // Clamp end
            if (bestStart + duration > buffer.duration) {
                bestStart = Math.max(0, buffer.duration - duration);
            }
        }

        const excerptBuffer = await this.sliceBuffer(buffer, bestStart, duration);
        const blob = audioService.encodeWAV(excerptBuffer);
        return { blob, start: bestStart, end: bestStart + duration };
    }

    private async sliceBuffer(buffer: AudioBuffer, start: number, duration: number): Promise<AudioBuffer> {
        const ctx = audioService.getAudioContext();
        const rate = buffer.sampleRate;
        const startFrame = Math.floor(start * rate);
        const endFrame = Math.min(Math.floor((start + duration) * rate), buffer.length);
        const frameCount = endFrame - startFrame;
        
        const newBuffer = ctx.createBuffer(buffer.numberOfChannels, frameCount, rate);
        
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c).subarray(startFrame, endFrame);
            newBuffer.copyToChannel(data, c);
        }
        
        return newBuffer;
    }
}

export const audioExcerptService = new AudioExcerptService();
