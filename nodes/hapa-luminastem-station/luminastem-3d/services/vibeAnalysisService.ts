
import { VibeFingerprintV1 } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Constants for Analysis - FIXED for Determinism
const TARGET_SAMPLE_RATE = 22050; 
const FFT_SIZE = 2048;
const HOP_SIZE = 1024;
const VECTOR_DIMS = 32; 

class VibeAnalysisService {
    
    // --- MAIN API ---

    async analyzeAudioBuffer(
        buffer: AudioBuffer, 
        scope: "stem" | "deck" | "loop" | "render", 
        hashes: string[],
        slice?: { start: number, end: number }
    ): Promise<VibeFingerprintV1> {
        
        // 1. Deterministic Downmix & Resample
        const audioData = this.resampleAndDownmix(buffer, TARGET_SAMPLE_RATE, slice);
        
        // 2. Extract Features
        const features = this.extractFeatures(audioData);
        
        // 3. Create Vector
        const vector = this.constructVector(features);
        
        // 4. Quantize
        const vectorB64 = this.quantizeVector(vector);

        const fp: VibeFingerprintV1 = {
            schema_version: "vibe_fingerprint.v1",
            id: uuidv4(),
            created_at: Date.now(),
            source: {
                scope,
                asset_hashes: hashes,
                slice: slice || null
            },
            vector_int8_b64: vectorB64,
            features: {
                bpm_estimate: features.bpm,
                bpm_confidence: features.bpmConfidence,
                rms_mean: features.rmsMean,
                crest_factor: features.crestFactor, 
                spectral_centroid_mean: features.centroidMean,
                rolloff_mean: features.rolloffMean,
                flatness_mean: features.flatnessMean,
                band_energy: features.bandEnergyMean,
                onset_rate: features.onsetRate
            },
            analysis_version: "1.0.0"
        };
        
        return fp;
    }

    // --- DSP PIPELINE ---

    private resampleAndDownmix(buffer: AudioBuffer, targetRate: number, slice?: { start: number, end: number }): Float32Array {
        const numChannels = buffer.numberOfChannels;
        const sourceRate = buffer.sampleRate;
        const sourceData = [];
        
        for (let i = 0; i < numChannels; i++) {
            sourceData.push(buffer.getChannelData(i));
        }

        let startSample = 0;
        let endSample = buffer.length;

        if (slice) {
            startSample = Math.floor(slice.start * sourceRate);
            endSample = Math.floor(slice.end * sourceRate);
            // Clamp
            startSample = Math.max(0, startSample);
            endSample = Math.min(buffer.length, endSample);
        }

        const sourceLength = endSample - startSample;
        // Limit to 30s to prevent hang/CPU spike
        const maxSourceSamples = 30 * sourceRate; 
        const processLength = Math.min(sourceLength, maxSourceSamples);

        const ratio = sourceRate / targetRate;
        const targetLength = Math.floor(processLength / ratio);
        const result = new Float32Array(targetLength);

        for (let i = 0; i < targetLength; i++) {
            const sourceIndex = i * ratio;
            const idxInt = Math.floor(sourceIndex);
            const idxFrac = sourceIndex - idxInt;
            
            // Linear Interpolation
            const idxA = startSample + idxInt;
            const idxB = Math.min(startSample + processLength - 1, idxA + 1);

            let sampleA = 0;
            let sampleB = 0;

            // Mix channels
            for (let c = 0; c < numChannels; c++) {
                sampleA += sourceData[c][idxA];
                sampleB += sourceData[c][idxB];
            }
            sampleA /= numChannels;
            sampleB /= numChannels;

            result[i] = sampleA * (1 - idxFrac) + sampleB * idxFrac;
        }

        return result;
    }

    private extractFeatures(audioData: Float32Array) {
        const frames = Math.floor((audioData.length - FFT_SIZE) / HOP_SIZE);
        if (frames <= 0) return this.getZeroFeatures();

        const window = this.getHanningWindow(FFT_SIZE);
        
        // Feature Accumulators
        let sumRMS = 0;
        let sumRMS2 = 0;
        let maxPeak = 0; // For Crest Factor
        let sumCentroid = 0;
        let sumCentroid2 = 0;
        let sumRolloff = 0;
        let sumRolloff2 = 0;
        let sumFlatness = 0;
        let sumFlatness2 = 0;
        
        // 8 Bands
        const bandBoundaries = [4, 19, 39, 150, 300, 500, 800, 1023];
        const bandEnergySum = new Float32Array(8);
        const bandEnergySum2 = new Float32Array(8);

        const onsets = [];
        let prevEnergy = 0;

        for (let i = 0; i < frames; i++) {
            const start = i * HOP_SIZE;
            const frame = new Float32Array(FFT_SIZE);
            
            // Windowing
            for (let j = 0; j < FFT_SIZE; j++) {
                const val = audioData[start + j];
                frame[j] = val * window[j];
                if (Math.abs(val) > maxPeak) maxPeak = Math.abs(val);
            }

            // FFT
            const spectrum = this.computeSpectrum(frame);

            // 1. RMS
            let e = 0;
            for(let j=0; j<FFT_SIZE; j++) e += frame[j] * frame[j];
            const rms = Math.sqrt(e / FFT_SIZE);
            sumRMS += rms;
            sumRMS2 += rms * rms;

            // 2. Onset (Flux)
            if (e > prevEnergy * 1.5 && e > 0.001) {
                onsets.push(start / TARGET_SAMPLE_RATE);
            }
            prevEnergy = e;

            // 3. Spectral Features
            let totalSpecEnergy = 0;
            let weightedSum = 0;
            let geomMeanLog = 0;
            
            for (let j = 0; j < spectrum.length; j++) {
                const mag = spectrum[j];
                totalSpecEnergy += mag;
                weightedSum += j * mag;
                geomMeanLog += Math.log(mag + 1e-10);
            }

            // Centroid
            const centroid = totalSpecEnergy > 0 ? (weightedSum / totalSpecEnergy) / spectrum.length : 0;
            sumCentroid += centroid;
            sumCentroid2 += centroid * centroid;

            // Rolloff (85%)
            let cumEnergy = 0;
            let rolloff = 0;
            const thresh = totalSpecEnergy * 0.85;
            for (let j = 0; j < spectrum.length; j++) {
                cumEnergy += spectrum[j];
                if (cumEnergy >= thresh) {
                    rolloff = j / spectrum.length;
                    break;
                }
            }
            sumRolloff += rolloff;
            sumRolloff2 += rolloff * rolloff;

            // Flatness
            const arithMean = totalSpecEnergy / spectrum.length;
            const geomMean = Math.exp(geomMeanLog / spectrum.length);
            const flatness = arithMean > 0 ? geomMean / arithMean : 0;
            sumFlatness += flatness;
            sumFlatness2 += flatness * flatness;

            // Bands
            let prevBin = 0;
            for(let b=0; b<8; b++) {
                let bE = 0;
                const limit = bandBoundaries[b];
                for(let k=prevBin; k<limit; k++) {
                    bE += spectrum[k];
                }
                prevBin = limit;
                const nBE = totalSpecEnergy > 0 ? bE / totalSpecEnergy : 0;
                bandEnergySum[b] += nBE;
                bandEnergySum2[b] += nBE * nBE;
            }
        }

        // Stats
        const mean = (sum: number) => sum / frames;
        const variance = (sum: number, sum2: number) => (sum2 / frames) - (mean(sum) * mean(sum));
        
        const rmsMean = mean(sumRMS);
        const crestFactor = rmsMean > 0 ? maxPeak / rmsMean : 0;

        // BPM Guess
        let bpm = 120;
        if (onsets.length > 4) {
            const intervals = [];
            for(let i=1; i<onsets.length; i++) intervals.push(onsets[i] - onsets[i-1]);
            intervals.sort((a,b) => a-b);
            const median = intervals[Math.floor(intervals.length/2)];
            if (median > 0.2) bpm = 60 / median;
            while (bpm < 70) bpm *= 2;
            while (bpm > 160) bpm /= 2;
        }

        return {
            rmsMean,
            rmsVar: variance(sumRMS, sumRMS2),
            crestFactor,
            centroidMean: mean(sumCentroid),
            centroidVar: variance(sumCentroid, sumCentroid2),
            rolloffMean: mean(sumRolloff),
            rolloffVar: variance(sumRolloff, sumRolloff2),
            flatnessMean: mean(sumFlatness),
            flatnessVar: variance(sumFlatness, sumFlatness2),
            bandEnergyMean: Array.from(bandEnergySum).map(v => v/frames),
            bandEnergyVar: Array.from(bandEnergySum).map((v, i) => (bandEnergySum2[i]/frames) - (v/frames)**2),
            onsetRate: onsets.length / (frames * HOP_SIZE / TARGET_SAMPLE_RATE),
            bpm: Math.round(bpm),
            bpmConfidence: 0.5
        };
    }

    private getHanningWindow(size: number) {
        const win = new Float32Array(size);
        for(let i=0; i<size; i++) {
            win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        return win;
    }

    private computeSpectrum(timeData: Float32Array): Float32Array {
        const n = timeData.length;
        const real = new Float32Array(timeData);
        const imag = new Float32Array(n).fill(0);

        this.fft(real, imag);

        const half = n / 2;
        const mag = new Float32Array(half);
        for(let i=0; i<half; i++) {
            mag[i] = Math.sqrt(real[i]*real[i] + imag[i]*imag[i]);
        }
        return mag;
    }

    private fft(real: Float32Array, imag: Float32Array) {
        const n = real.length;
        if (n <= 1) return;

        let j = 0;
        for (let i = 0; i < n; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
            let m = n >> 1;
            while (m >= 1 && j >= m) {
                j -= m;
                m >>= 1;
            }
            j += m;
        }

        for (let s = 1; s < n; s <<= 1) { 
            const m = s << 1;
            const theta = -Math.PI / s;
            const w_r = Math.cos(theta);
            const w_i = Math.sin(theta);
            
            for (let k = 0; k < n; k += m) { 
                let wm_r = 1;
                let wm_i = 0;
                for (let j = 0; j < s; j++) { 
                    const u_r = real[k + j];
                    const u_i = imag[k + j];
                    const t_r = wm_r * real[k + j + s] - wm_i * imag[k + j + s];
                    const t_i = wm_r * imag[k + j + s] + wm_i * real[k + j + s];

                    real[k + j] = u_r + t_r;
                    imag[k + j] = u_i + t_i;
                    real[k + j + s] = u_r - t_r;
                    imag[k + j + s] = u_i - t_i;

                    const temp_r = wm_r;
                    wm_r = wm_r * w_r - wm_i * w_i;
                    wm_i = temp_r * w_i + wm_i * w_r;
                }
            }
        }
    }

    private getZeroFeatures() {
        return {
            rmsMean: 0, rmsVar: 0, crestFactor: 0, centroidMean: 0, centroidVar: 0, 
            rolloffMean: 0, rolloffVar: 0, flatnessMean: 0, flatnessVar: 0,
            bandEnergyMean: new Array(8).fill(0), bandEnergyVar: new Array(8).fill(0),
            onsetRate: 0, bpm: 120, bpmConfidence: 0
        };
    }

    // --- VECTORIZATION & QUANTIZATION ---

    private constructVector(f: any): Float32Array {
        const v = new Float32Array(VECTOR_DIMS);
        // Pack features into fixed vector
        v[0] = f.rmsMean;
        v[1] = f.rmsVar;
        v[2] = f.centroidMean;
        v[3] = f.centroidVar;
        v[4] = f.rolloffMean;
        v[5] = f.rolloffVar;
        v[6] = f.flatnessMean;
        v[7] = f.onsetRate;
        
        for(let i=0; i<8; i++) v[8+i] = f.bandEnergyMean[i];
        for(let i=0; i<8; i++) v[16+i] = f.bandEnergyVar[i];
        
        v[24] = f.bpm / 200; 
        v[25] = f.crestFactor / 10;
        
        return v;
    }

    public dequantizeVector(b64: string): Float32Array {
        const binary = atob(b64);
        const len = binary.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            u8[i] = binary.charCodeAt(i);
        }
        const int8 = new Int8Array(u8.buffer);
        const float = new Float32Array(len);
        
        for(let i=0; i<len; i++) {
            float[i] = int8[i] / 127.0;
        }
        return float;
    }

    private quantizeVector(v: Float32Array): string {
        let sumSq = 0;
        for(let i=0; i<v.length; i++) sumSq += v[i] * v[i];
        const norm = Math.sqrt(sumSq) || 1;
        
        const int8 = new Int8Array(v.length);
        for(let i=0; i<v.length; i++) {
            const val = (v[i] / norm);
            const clamped = Math.max(-1, Math.min(1, val));
            int8[i] = Math.round(clamped * 127);
        }

        const u8 = new Uint8Array(int8.buffer);
        let binary = '';
        for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
        }
        
        return btoa(binary);
    }
}

export const vibeAnalysisService = new VibeAnalysisService();
