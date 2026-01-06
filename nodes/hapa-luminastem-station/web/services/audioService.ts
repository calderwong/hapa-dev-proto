import { FFT_SIZE, SMOOTHING_TIME_CONSTANT, SIGIL_MAP_LOW, SIGIL_MAP_MID, SIGIL_MAP_HIGH, SIGIL_MAP_FLUX } from '../constants';
import { TempoConfig, AudioStem, AudioFxSettings, AutomationLane, AutomationPoint, VibeVector } from '../types';
import { timelineScheduler } from './timelineScheduler';

class AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  
  // FX Chain
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayGain: GainNode | null = null;

  // Audition / Preview
  private previewNode: AudioBufferSourceNode | null = null;
  private previewGain: GainNode | null = null;

  // Transport State
  private startTime: number = 0; // Context time when play started
  private offset: number = 0; // Where in the file we started
  private playbackRate: number = 1.0;
  private isPlaying: boolean = false;

  // Automation State
  private automationLanes: Map<string, AutomationLane> = new Map();
  private lastRecordTime: Map<string, number> = new Map();
  private RECORD_THROTTLE = 0.05; // 50ms resolution

  // Metronome State
  private tempoConfig: TempoConfig = {
      bpm: 120,
      gridOffset: 0,
      subdivision: 4,
      snapEnabled: false,
      metronomeEnabled: false
  };
  private nextNoteTime: number = 0.0;
  private scheduleAheadTime: number = 0.1; // seconds
  private currentBeatInBar: number = 0;

  getAudioContext(): AudioContext {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterGain = this.context.createGain();
      this.masterAnalyser = this.context.createAnalyser();
      this.compressor = this.context.createDynamicsCompressor();
      
      // FX: Reverb
      this.reverbNode = this.context.createConvolver();
      this.reverbGain = this.context.createGain();
      this.reverbGain.gain.value = 0; 
      this.generateImpulseResponse(2.0, 2.0); 

      // FX: Delay
      this.delayNode = this.context.createDelay(5.0);
      this.delayFeedback = this.context.createGain();
      this.delayGain = this.context.createGain();
      this.delayNode.delayTime.value = 0.5; 
      this.delayFeedback.gain.value = 0.4;
      this.delayGain.gain.value = 0; 
      
      // Audition Bus (Bypass FX, direct to Destination)
      this.previewGain = this.context.createGain();
      this.previewGain.gain.value = 0.8;
      this.previewGain.connect(this.context.destination);

      this.masterAnalyser.fftSize = FFT_SIZE;
      this.masterAnalyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
      
      // Routing
      this.masterGain.connect(this.compressor);
      this.masterGain.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.compressor);

      this.masterGain.connect(this.delayNode);
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.delayGain);
      this.delayGain.connect(this.compressor);

      this.compressor.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.context.destination);
    }
    return this.context;
  }

  // --- PREVIEW / AUDITION ---
  
  startAudition(buffer: AudioBuffer) {
      if (!this.context) this.getAudioContext();
      this.resumeContext();
      this.stopAudition();

      this.previewNode = this.context!.createBufferSource();
      this.previewNode.buffer = buffer;
      this.previewNode.loop = true;
      this.previewNode.connect(this.previewGain!);
      this.previewNode.start();
  }

  stopAudition() {
      if (this.previewNode) {
          try { this.previewNode.stop(); } catch(e) {}
          this.previewNode.disconnect();
          this.previewNode = null;
      }
  }

  // --- VIBE VECTOR ENGINE ---
  
  analyzeVibe(stems: AudioStem[], rangeStart: number, rangeEnd: number): VibeVector {
      // 1. Snapshot Audio (Simulated Mix)
      const sampleRate = 44100; // Assume standard
      const steps = 64; // How many analysis snapshots to take across the range
      const stepSize = (rangeEnd - rangeStart) / steps;
      
      let totalEnergy = 0;
      let lowEnergy = 0;
      let midEnergy = 0;
      let highEnergy = 0;
      let fluxAccum = 0;
      let centroidAccum = 0;

      const activeStems = stems.filter(s => !s.isMuted);
      if (activeStems.length === 0) return this.createZeroVector();
      
      for (let i = 0; i < steps; i++) {
          const t = rangeStart + i * stepSize;
          let windowSum = 0;

          // Band filters (Simple accumulators)
          let l = 0, m = 0, h = 0;
          const windowSize = 256;

          for (let j = 0; j < windowSize; j++) {
             const sampleIdx = Math.floor((t * sampleRate) + j);
             let sampleMix = 0;
             activeStems.forEach(stem => {
                 if (sampleIdx < stem.buffer.length) {
                     sampleMix += stem.buffer.getChannelData(0)[sampleIdx] * stem.volume; 
                 }
             });
             
             windowSum += sampleMix * sampleMix;
             l += Math.abs(sampleMix); 
          }
          
          const rms = Math.sqrt(windowSum / windowSize);
          totalEnergy += rms;

          const val = rms * 100;
          lowEnergy += val * (Math.abs(Math.sin(t * 50)) * 0.8);
          midEnergy += val * (Math.abs(Math.sin(t * 200)) * 0.6);
          highEnergy += val * (Math.abs(Math.sin(t * 1000)) * 0.4);
          
          const centroid = (lowEnergy * 100 + midEnergy * 1000 + highEnergy * 5000) / (lowEnergy + midEnergy + highEnergy + 0.001);
          centroidAccum += centroid;

          if (i > 0) {
              fluxAccum += Math.abs(rms - (totalEnergy / i));
          }
      }

      // Normalize
      const norm = (v: number) => Math.min(255, Math.max(0, Math.floor(v * 255)));
      const factor = 1 / steps;
      
      const fBass = Math.min(1, lowEnergy * factor * 0.5);
      const fMid = Math.min(1, midEnergy * factor * 0.6);
      const fHigh = Math.min(1, highEnergy * factor * 0.8);
      const fDyn = Math.min(1, totalEnergy * factor * 2.0);
      const fBright = Math.min(1, (centroidAccum * factor) / 5000);
      const fFlux = Math.min(1, fluxAccum * factor * 5);

      const bytes = new Uint8Array([
          norm(fBass), 
          norm(fMid), 
          norm(fHigh), 
          norm(fDyn), 
          norm(fBright), 
          norm(fFlux)
      ]);

      return {
          bass: fBass,
          mid: fMid,
          high: fHigh,
          dynamics: fDyn,
          brightness: fBright,
          flux: fFlux,
          bytes: bytes,
          base64: this.bytesToBase64(bytes),
          sigil: this.generateSigil(bytes),
          hexHash: this.bytesToHex(bytes)
      };
  }

  private createZeroVector(): VibeVector {
      const b = new Uint8Array([0,0,0,0,0,0]);
      return { bass:0, mid:0, high:0, dynamics:0, brightness:0, flux:0, bytes:b, base64: "AAAAAA==", sigil: "🌑🌑🌑🌑", hexHash: "000000000000" };
  }

  private generateSigil(bytes: Uint8Array): string {
      const low = SIGIL_MAP_LOW[bytes[0] % SIGIL_MAP_LOW.length];
      const mid = SIGIL_MAP_MID[bytes[1] % SIGIL_MAP_MID.length];
      const high = SIGIL_MAP_HIGH[bytes[2] % SIGIL_MAP_HIGH.length];
      const flux = SIGIL_MAP_FLUX[bytes[5] % SIGIL_MAP_FLUX.length];
      return `${low}${mid}${high}${flux}`;
  }

  private bytesToBase64(bytes: Uint8Array): string {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
  }

  private bytesToHex(bytes: Uint8Array): string {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // --- TRANSPORT LOGIC ---

  getCurrentTime(): number {
    if (!this.context) return 0;
    if (this.isPlaying) {
      return this.offset + (this.context.currentTime - this.startTime) * this.playbackRate;
    }
    return this.offset;
  }
  
  // Alias for readability in fixes
  getTransportTime(): number {
      return this.getCurrentTime();
  }

  getIsPlaying(): boolean {
      return this.isPlaying;
  }

  updateTempoConfig(config: Partial<TempoConfig>) {
      this.tempoConfig = { ...this.tempoConfig, ...config };
      if (this.isPlaying) {
          if (this.tempoConfig.metronomeEnabled && this.nextNoteTime === 0) {
               // Initialize beat time if just enabled
               this.nextNoteTime = this.context?.currentTime || 0;
          }
      }
  }
  
  getTempoConfig(): TempoConfig {
      return { ...this.tempoConfig };
  }

  // --- AUTOMATION ENGINE ---

  ensureLane(targetId: string, param: string, label?: string, color?: string) {
      const key = `${targetId}:${param}`;
      if (!this.automationLanes.has(key)) {
          this.automationLanes.set(key, {
              id: key,
              targetId,
              param,
              points: [],
              mode: 'OFF',
              label: label || param,
              color: color || '#ffffff'
          });
      }
      return this.automationLanes.get(key)!;
  }

  setLaneMode(laneId: string, mode: 'READ' | 'WRITE' | 'OFF') {
      const lane = this.automationLanes.get(laneId);
      if (lane) lane.mode = mode;
  }

  clearLane(laneId: string) {
      const lane = this.automationLanes.get(laneId);
      if (lane) lane.points = [];
  }

  getLanes(): AutomationLane[] {
      return Array.from(this.automationLanes.values());
  }

  recordAutomation(targetId: string, param: string, value: number) {
      if (!this.isPlaying) return; 

      const key = `${targetId}:${param}`;
      const lane = this.automationLanes.get(key);
      
      if (!lane || lane.mode !== 'WRITE') return;

      const now = this.getCurrentTime();
      const lastRec = this.lastRecordTime.get(key) || -1;

      if (now - lastRec > this.RECORD_THROTTLE) {
          lane.points.push({ time: now, value });
          this.lastRecordTime.set(key, now);
      }
  }

  applyAutomation(stems: AudioStem[], setMixerValues: (v: any) => void, setAudioSettings: (v: any) => void) {
      if (!this.isPlaying) return;

      const now = this.getCurrentTime();

      this.automationLanes.forEach(lane => {
          if (lane.mode !== 'READ') return;
          if (lane.points.length === 0) return;

          const val = this.interpolate(lane.points, now);
          if (val === null) return;

          if (lane.targetId === 'global') {
              if (lane.param === 'reverb') {
                  if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(val, this.context!.currentTime, 0.05);
              } 
              else if (lane.param === 'delay') {
                  if (this.delayGain) this.delayGain.gain.setTargetAtTime(val, this.context!.currentTime, 0.05);
              }
              else if (lane.param.startsWith('mixer')) {
                  const channel = lane.param.replace('mixer', '').toLowerCase(); 
                  window.dispatchEvent(new CustomEvent('hapa-auto-mixer', { detail: { channel, value: val } }));
              }
          } else {
              const stem = stems.find(s => s.id === lane.targetId);
              if (stem) {
                  if (lane.param === 'filterCutoff') {
                       window.dispatchEvent(new CustomEvent('hapa-auto-stem', { 
                           detail: { id: stem.id, param: 'y', value: val } 
                       }));
                  }
              }
          }
      });
  }

  private interpolate(points: AutomationPoint[], time: number): number | null {
      let p1 = points[0];
      let p2 = points[0];
      
      if (time < p1.time) return p1.value;

      for (let i = 0; i < points.length; i++) {
          if (points[i].time <= time) {
              p1 = points[i];
          } else {
              p2 = points[i];
              break;
          }
      }

      if (p1 === p2) return p1.value;

      const t = (time - p1.time) / (p2.time - p1.time);
      return p1.value + (p2.value - p1.value) * t;
  }

  loadAutomation(lanes: AutomationLane[]) {
      this.automationLanes.clear();
      lanes.forEach(l => this.automationLanes.set(l.id, l));
  }

  // --- METRONOME ENGINE (Timeline Integrated) ---
  
  // Called by App loop to schedule upcoming beats
  processMetronome() {
      if (!this.context || !this.isPlaying || !this.tempoConfig.metronomeEnabled) return;

      const lookahead = this.scheduleAheadTime; // 0.1s
      
      while (this.nextNoteTime < this.context.currentTime + lookahead) {
          // Schedule Audio Click
          this.scheduleNote(this.currentBeatInBar, this.nextNoteTime);
          
          // Schedule Visual/Logic Event via TimelineScheduler
          // Calculate transport time for this beat
          // transport = offset + (contextTime - startTime) * rate
          const transportTime = this.offset + (this.nextNoteTime - this.startTime) * this.playbackRate;
          
          timelineScheduler.schedule(transportTime, 'METRONOME_BEAT', { beat: this.currentBeatInBar }, () => {
              // Dispatch event for UI
              window.dispatchEvent(new CustomEvent('hapa-beat', { detail: { beat: this.currentBeatInBar }}));
          });

          this.nextNote();
      }
  }

  private nextNote() {
      const secondsPerBeat = 60.0 / this.tempoConfig.bpm;
      this.nextNoteTime += secondsPerBeat;
      this.currentBeatInBar++;
      if (this.currentBeatInBar === 4) {
          this.currentBeatInBar = 0;
      }
  }

  private scheduleNote(beatNumber: number, time: number) {
      if (!this.context) return;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.connect(gain);
      gain.connect(this.context.destination); 
      if (beatNumber === 0) {
          osc.frequency.value = 1760; 
      } else {
          osc.frequency.value = 880; 
      }
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.055);
  }

  // --- GRID MATH ---
  
  snapTime(time: number): number {
      if (!this.tempoConfig.snapEnabled) return time;
      const bps = this.tempoConfig.bpm / 60;
      const beatDuration = 1 / bps;
      const step = beatDuration * (4 / this.tempoConfig.subdivision);
      const relativeTime = time - this.tempoConfig.gridOffset;
      const snappedRelative = Math.round(relativeTime / step) * step;
      return Math.max(0, snappedRelative + this.tempoConfig.gridOffset);
  }

  // --- PLAYBACK ---

  syncPlay(nodes: { source: AudioBufferSourceNode | null, buffer: AudioBuffer, lowPass: BiquadFilterNode }[], startOffset?: number) {
      if (!this.context) this.getAudioContext();
      if (!this.context) return;
      this.resumeContext();

      // Only reset start times if we are starting from stopped or explicitly seeking
      if (startOffset !== undefined) {
          this.offset = startOffset;
          this.startTime = this.context.currentTime;
      } else if (!this.isPlaying) {
          // Starting from current offset
          this.startTime = this.context.currentTime;
      }

      this.isPlaying = true;
      
      // Metronome Reset
      if (this.tempoConfig.metronomeEnabled) {
          const bps = this.tempoConfig.bpm / 60;
          const beatDur = 1/bps;
          const transportTime = this.offset - this.tempoConfig.gridOffset;
          const beatsPassed = Math.floor(transportTime / beatDur);
          const nextBeatTransportTime = (beatsPassed + 1) * beatDur + this.tempoConfig.gridOffset;
          
          // transport = offset + (ctxTime - startTime)
          // nextBeatTransport = offset + (nextNoteCtxTime - startTime)
          // nextNoteCtxTime - startTime = nextBeatTransport - offset
          // nextNoteCtxTime = startTime + nextBeatTransport - offset
          
          this.nextNoteTime = this.startTime + (nextBeatTransportTime - this.offset) / this.playbackRate;
          this.currentBeatInBar = (beatsPassed + 1) % 4;
      }

      return nodes.map(item => {
          if (item.source) {
              try { item.source.stop(); } catch(e) {}
          }
          const newSource = this.context!.createBufferSource();
          newSource.buffer = item.buffer;
          newSource.loop = true;
          newSource.playbackRate.value = this.playbackRate;
          newSource.connect(item.lowPass);
          const safeOffset = this.offset % item.buffer.duration;
          newSource.start(0, safeOffset);
          return newSource;
      });
  }
  
  spawnStemAtTransport(buffer: AudioBuffer, lowPass: BiquadFilterNode): AudioBufferSourceNode | null {
      if (!this.context || !this.isPlaying) return null;
      
      const transportTime = this.getCurrentTime();
      const newSource = this.context.createBufferSource();
      newSource.buffer = buffer;
      newSource.loop = true;
      newSource.playbackRate.value = this.playbackRate;
      newSource.connect(lowPass);
      
      const safeOffset = transportTime % buffer.duration;
      newSource.start(0, safeOffset);
      return newSource;
  }

  syncStop(nodes: (AudioBufferSourceNode | null)[]) {
      if (!this.context) return;
      this.offset = this.getCurrentTime(); // Save position
      this.isPlaying = false;
      
      nodes.forEach(node => {
          if (node) {
              try { node.stop(); } catch(e) {}
          }
      });
  }

  syncSeek(nodes: { source: AudioBufferSourceNode | null, buffer: AudioBuffer, lowPass: BiquadFilterNode }[], time: number): (AudioBufferSourceNode | null)[] {
      this.offset = time;
      if (this.isPlaying) {
          // Restart nodes at new time
          return this.syncPlay(nodes, time) as (AudioBufferSourceNode | null)[];
      }
      return nodes.map(n => null); 
  }

  setLoop(nodes: AudioBufferSourceNode[], start: number, end: number, enabled: boolean) {
      nodes.forEach(node => {
          if (node) {
              node.loop = enabled;
              if (enabled) {
                  node.loopStart = start;
                  node.loopEnd = end;
              } else {
                  node.loopStart = 0;
                  if (node.buffer) node.loopEnd = node.buffer.duration;
              }
          }
      });
  }

  // --- SETUP ---

  private generateImpulseResponse(duration: number, decay: number) {
      if (!this.context || !this.reverbNode) return;
      const rate = this.context.sampleRate;
      const length = rate * duration;
      const impulse = this.context.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
          const n = i; 
          const e = Math.pow(1 - n / length, decay); 
          left[i] = (Math.random() * 2 - 1) * e;
          right[i] = (Math.random() * 2 - 1) * e;
      }
      this.reverbNode.buffer = impulse;
  }

  setEffects(reverbAmt: number, delayAmt: number) {
      if (!this.context) return;
      const t = this.context.currentTime;
      if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(reverbAmt, t, 0.1);
      if (this.delayGain) this.delayGain.gain.setTargetAtTime(delayAmt, t, 0.1);
  }

  getMasterAnalyser(): AnalyserNode {
    this.getAudioContext(); 
    return this.masterAnalyser!;
  }

  async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    const copy = arrayBuffer.slice(0);
    return await ctx.decodeAudioData(copy);
  }

  createStemNodes(buffer: AudioBuffer): { 
    analyser: AnalyserNode; 
    gain: GainNode;
    lowPassNode: BiquadFilterNode;
    highPassNode: BiquadFilterNode;
  } {
    const ctx = this.getAudioContext();
    
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    
    const lowPassNode = ctx.createBiquadFilter();
    lowPassNode.type = 'lowpass';
    lowPassNode.frequency.value = 22000;
    lowPassNode.Q.value = 1;

    const highPassNode = ctx.createBiquadFilter();
    highPassNode.type = 'highpass';
    highPassNode.frequency.value = 0;
    highPassNode.Q.value = 1;
    
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

    lowPassNode.connect(highPassNode);
    highPassNode.connect(analyser); 
    analyser.connect(gain);         
    
    if (this.masterGain) {
        gain.connect(this.masterGain);
    } else {
        gain.connect(ctx.destination);
    }

    return { analyser, gain, lowPassNode, highPassNode };
  }

  resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  setPlaybackRate(nodes: AudioBufferSourceNode[], rate: number) {
      this.playbackRate = rate;
      const now = this.context?.currentTime || 0;
      nodes.forEach(node => {
          if (node && node.playbackRate) {
            node.playbackRate.setTargetAtTime(rate, now, 0.1);
          }
      });
  }

  triggerStutter(nodes: AudioBufferSourceNode[], enabled: boolean, interval: number) {
      if (!this.context) return;
      nodes.forEach(node => {
         if (node) {
             const currentTime = this.getCurrentTime();
             if (enabled) {
                 const loopStart = Math.floor(currentTime / interval) * interval;
                 node.loopStart = loopStart;
                 node.loopEnd = loopStart + interval;
                 node.loop = true;
             } else {
                 node.loopStart = 0;
                 if (node.buffer) node.loopEnd = node.buffer.duration;
             }
         }
      });
  }

  updateSpatialFilters(lowPass: BiquadFilterNode, highPass: BiquadFilterNode, yPos: number) {
     const now = this.context?.currentTime || 0;
     if (yPos > 1) {
         const frequency = Math.min(10000, (yPos - 1) * 1000);
         highPass.frequency.setTargetAtTime(frequency, now, 0.1);
         lowPass.frequency.setTargetAtTime(22000, now, 0.1); 
     } else if (yPos < -1) {
         const val = Math.abs(yPos + 1);
         const frequency = Math.max(100, 20000 - (val * 3000));
         lowPass.frequency.setTargetAtTime(frequency, now, 0.1);
         highPass.frequency.setTargetAtTime(0, now, 0.1); 
     } else {
         lowPass.frequency.setTargetAtTime(22000, now, 0.1);
         highPass.frequency.setTargetAtTime(0, now, 0.1);
     }
  }

  getCoarseWaveform(buffer: AudioBuffer, samples: number = 128): number[] {
      const rawData = buffer.getChannelData(0);
      const step = Math.floor(rawData.length / samples);
      const waveform: number[] = [];
      for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * step;
          for (let j = 0; j < step; j++) {
              if (start + j < rawData.length) {
                  sum += rawData[start + j] * rawData[start + j];
              }
          }
          const rms = Math.sqrt(sum / step);
          waveform.push(Math.min(1, rms * 5)); 
      }
      return waveform;
  }

  // --- OFFLINE RENDER ---

  async renderAudio(
    stems: AudioStem[],
    settings: AudioFxSettings,
    mixerValues: { a: number, b: number, c: number },
    startTime: number,
    duration: number
  ): Promise<{ buffer: AudioBuffer; blob: Blob }> {
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

      const oMasterGain = offlineCtx.createGain();
      const oCompressor = offlineCtx.createDynamicsCompressor();
      
      const oReverb = offlineCtx.createConvolver();
      if (this.reverbNode && this.reverbNode.buffer) {
          oReverb.buffer = this.reverbNode.buffer; 
      }
      const oReverbGain = offlineCtx.createGain();
      
      const oDelay = offlineCtx.createDelay(5.0);
      const oDelayFeedback = offlineCtx.createGain();
      const oDelayGain = offlineCtx.createGain();

      oReverbGain.gain.value = settings.reverbAmount;
      oDelay.delayTime.value = 0.5; 
      oDelayFeedback.gain.value = 0.4;
      oDelayGain.gain.value = settings.delayAmount;
      
      oMasterGain.connect(oCompressor);
      oMasterGain.connect(oReverb);
      oReverb.connect(oReverbGain);
      oReverbGain.connect(oCompressor);

      oMasterGain.connect(oDelay);
      oDelay.connect(oDelayFeedback);
      oDelayFeedback.connect(oDelay);
      oDelay.connect(oDelayGain);
      oDelayGain.connect(oCompressor);

      oCompressor.connect(offlineCtx.destination);

      stems.forEach(stem => {
          if (stem.isMuted) return;

          const source = offlineCtx.createBufferSource();
          source.buffer = stem.buffer;
          source.loop = true; 
          source.playbackRate.value = settings.playbackSpeed;

          const lp = offlineCtx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = stem.lowPassNode.frequency.value;
          
          const hp = offlineCtx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = stem.highPassNode.frequency.value;

          const gain = offlineCtx.createGain();

          let vol = 1.0;
          if (settings.mixAllStems) {
             const weights = [mixerValues.a, mixerValues.b, mixerValues.c];
             const myWeight = weights[stem.fleetId || 0];
             const total = weights.reduce((a,b) => a+b, 0);
             if (total > 0.01) vol = Math.min(1.0, myWeight / Math.max(0.3, (total * 0.5))); 
             else vol = 0;
          }
          gain.gain.value = stem.volume * vol;

          source.connect(lp);
          lp.connect(hp);
          hp.connect(gain);
          gain.connect(oMasterGain);

          const startOffset = startTime % stem.buffer.duration;
          source.start(0, startOffset);
      });

      const renderedBuffer = await offlineCtx.startRendering();
      const blob = this.encodeWAV(renderedBuffer);
      return { buffer: renderedBuffer, blob };
  }

  encodeWAV(buffer: AudioBuffer): Blob {
      const numChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const format = 1; 
      const bitDepth = 16;
      
      let result;
      if (numChannels === 2) {
          result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
      } else {
          result = buffer.getChannelData(0);
      }

      const bufferLength = result.length * 2 + 44;
      const dataView = new DataView(new ArrayBuffer(bufferLength));

      this.writeString(dataView, 0, 'RIFF');
      dataView.setUint32(4, 36 + result.length * 2, true);
      this.writeString(dataView, 8, 'WAVE');

      this.writeString(dataView, 12, 'fmt ');
      dataView.setUint32(16, 16, true);
      dataView.setUint16(20, format, true);
      dataView.setUint16(22, numChannels, true);
      dataView.setUint32(24, sampleRate, true);
      dataView.setUint32(28, sampleRate * numChannels * 2, true);
      dataView.setUint16(32, numChannels * 2, true);
      dataView.setUint16(34, bitDepth, true);

      this.writeString(dataView, 36, 'data');
      dataView.setUint32(40, result.length * 2, true);

      this.floatTo16BitPCM(dataView, 44, result);

      return new Blob([dataView], { type: 'audio/wav' });
  }

  private floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
      for (let i = 0; i < input.length; i++, offset += 2) {
          const s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
  }

  private writeString(view: DataView, offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
      }
  }

  private interleave(inputL: Float32Array, inputR: Float32Array) {
      const length = inputL.length + inputR.length;
      const result = new Float32Array(length);
      let index = 0;
      let inputIndex = 0;
      while (index < length) {
          result[index++] = inputL[inputIndex];
          result[index++] = inputR[inputIndex];
          inputIndex++;
      }
      return result;
  }
}

export const audioService = new AudioService();