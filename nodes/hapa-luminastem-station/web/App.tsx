
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Vector3, MathUtils } from 'three';
import Scene from './components/Scene';
import TelemetryPanel from './components/TelemetryPanel';
import EngineeringPanel from './components/EngineeringPanel';
import AutomationPanel from './components/AutomationPanel';
import VibePanel from './components/VibePanel';
import LibraryPanel from './components/LibraryPanel';
import LoopPackWizard from './components/LoopPackWizard';
import DropDockOverlay from './components/DropDockOverlay';
import HandInput from './components/HandInput'; 
import TransportControls from './components/TransportControls';
import KeyframePanel from './components/KeyframePanel';
import MediaDock from './components/MediaDock';
import EffectsPanel from './components/EffectsPanel'; 
import { audioService } from './services/audioService';
import { geminiService } from './services/geminiService';
import { sessionService } from './services/sessionService';
import { vibeAnalysisService } from './services/vibeAnalysisService';
import { analysisQueueService } from './services/analysisQueueService'; 
import { showScriptEngine } from './services/showScriptEngine';
import { timelineScheduler } from './services/timelineScheduler';
import { effectsService } from './services/effectsService'; 
import { AudioStem, TelemetryData, SessionData, HandData, FormationType, FormationConfig, VisualSettings, AudioFxSettings, LoopClip, IntegrityReport, LibraryLoopRef, LibraryBundle, SessionStateSnapshot, SessionEvent, MediaClip, MediaPlacement } from './types';
import { FFT_SIZE } from './constants';
import { v4 as uuidv4 } from 'uuid';

const WaveformCanvas = ({ stem, color, height = 32 }: { stem: AudioStem, color: string, height?: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const dataArray = new Uint8Array(stem.analyserNode.frequencyBinCount);
        let animationId: number;
        
        const draw = () => {
            stem.analyserNode.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (stem.isMuted) {
                ctx.globalAlpha = 0.2;
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height/2);
                ctx.lineTo(canvas.width, canvas.height/2);
                ctx.stroke();
                
                const barWidth = (canvas.width / dataArray.length) * 4;
                let x = 0; const centerY = canvas.height / 2;
                ctx.fillStyle = '#444';
                for(let i = 0; i < dataArray.length; i+=2) {
                    const barHeight = (dataArray[i] / 255) * (canvas.height * 0.4); 
                    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
                    x += barWidth + 1;
                }
                ctx.globalAlpha = 1.0;
            } else {
                const barWidth = (canvas.width / dataArray.length) * 2.5;
                let x = 0; const centerY = canvas.height / 2;
                for(let i = 0; i < dataArray.length; i++) {
                    const barHeight = (dataArray[i] / 255) * (canvas.height / 2); 
                    ctx.fillStyle = color; ctx.shadowBlur = 4; ctx.shadowColor = color;
                    ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
                    ctx.fillRect(x, centerY, barWidth, barHeight);
                    x += barWidth + 1;
                    if (x > canvas.width) break;
                }
            }
            animationId = requestAnimationFrame(draw);
        };
        draw(); 
        return () => cancelAnimationFrame(animationId);
    }, [stem, color, stem.isMuted]);
    return <canvas ref={canvasRef} width={120} height={height} className={`w-full bg-black/80 rounded border transition-colors ${stem.isMuted ? 'border-red-900/30' : 'border-white/10'}`} />;
};

const HoloMixer = ({ values, onChange }: { values: {a:number, b:number, c:number}, onChange: (v: {a:number, b:number, c:number}) => void }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const puckPos = useRef({ x: 50, y: 33 });
    const targetPos = useRef({ x: 50, y: 33 });
    const rafRef = useRef<number>();

    useEffect(() => {
        const cx = (values.a * 0 + values.b * 100 + values.c * 50) / (values.a + values.b + values.c);
        const cy = (values.a * 100 + values.b * 100 + values.c * 0) / (values.a + values.b + values.c);
        if (!isNaN(cx)) targetPos.current = { x: cx, y: cy };
        puckPos.current = { x: cx || 50, y: cy || 33 };
    }, []);

    useEffect(() => {
        const loop = () => {
            puckPos.current.x = MathUtils.lerp(puckPos.current.x, targetPos.current.x, 0.15);
            puckPos.current.y = MathUtils.lerp(puckPos.current.y, targetPos.current.y, 0.15);
            const x = puckPos.current.x; const y = puckPos.current.y;
            const maxDist = 100;
            const distA = Math.sqrt(Math.pow(x - 0, 2) + Math.pow(y - 100, 2));
            const distB = Math.sqrt(Math.pow(x - 100, 2) + Math.pow(y - 100, 2));
            const distC = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(y - 0, 2));
            let valA = Math.max(0, 1 - distA / maxDist);
            let valB = Math.max(0, 1 - distB / maxDist);
            let valC = Math.max(0, 1 - distC / maxDist);
            const maxVal = Math.max(valA, valB, valC);
            if(maxVal > 0) { valA /= maxVal; valB /= maxVal; valC /= maxVal; }
            onChange({ a: valA, b: valB, c: valC });
            rafRef.current = requestAnimationFrame(loop);
        };
        loop();
        return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, []);

    const handleMove = (e: any) => {
        if (!dragging || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let x = ((clientX - rect.left) / rect.width) * 100;
        let y = ((clientY - rect.top) / rect.height) * 100;
        x = Math.max(0, Math.min(100, x)); y = Math.max(0, Math.min(100, y));
        targetPos.current = { x, y };
    };

    return (
        <div className="relative w-48 h-48 select-none group" ref={containerRef} onMouseMove={handleMove} onTouchMove={handleMove} onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)} onTouchEnd={() => setDragging(false)} onMouseDown={(e) => { setDragging(true); handleMove(e); }} onTouchStart={(e) => { setDragging(true); handleMove(e); }}>
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]">
                <defs><linearGradient id="holoGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="cyan" stopOpacity="0.1" /><stop offset="50%" stopColor="violet" stopOpacity="0.1" /><stop offset="100%" stopColor="lime" stopOpacity="0.1" /></linearGradient></defs>
                <polygon points="0,100 100,100 50,0" fill="url(#holoGradient)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <circle cx="0" cy="100" r={values.a * 40} fill="cyan" fillOpacity="0.1" /><circle cx="100" cy="100" r={values.b * 40} fill="#bd00ff" fillOpacity="0.1" /><circle cx="50" cy="0" r={values.c * 40} fill="#00ff88" fillOpacity="0.1" />
                <line x1="50" y1="33" x2={puckPos.current.x} y2={puckPos.current.y} stroke="white" strokeOpacity="0.3" />
                <g transform={`translate(${puckPos.current.x}, ${puckPos.current.y})`}>
                    <circle r="6" fill="transparent" stroke="white" strokeWidth="2" className={`transition-all duration-75 ${dragging ? 'stroke-cyan-400 scale-125' : ''}`} />
                    <circle r="2" fill="white" className="animate-pulse" />
                </g>
            </svg>
        </div>
    );
};

const RadarFocus = () => <div className="w-48 h-48 border rounded-full border-gray-700 flex items-center justify-center text-xs text-gray-500">RADAR ACTIVE</div>;

const CompactStemRow: React.FC<{ stem: AudioStem, color: string, onToggleMute: (id: string) => void }> = React.memo(({ stem, color, onToggleMute }) => (
    <div className="bg-gray-900/80 border border-gray-800 rounded p-1 mb-1 hover:border-white/20 transition group">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold truncate w-16" style={{ color }}>{stem.name}</span>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleMute(stem.id); }}
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${stem.isMuted ? 'bg-red-500 border-red-500 text-black' : 'border-gray-600 hover:border-white text-gray-500'}`}
            >
                <i className={`fas fa-volume-${stem.isMuted ? 'mute' : 'up'} text-[8px]`}></i>
            </button>
        </div>
        <div className="h-6 w-full bg-black rounded overflow-hidden relative">
            <WaveformCanvas stem={stem} color={color} height={24} />
            {stem.isMuted && <div className="absolute inset-0 bg-red-900/20 backdrop-blur-[1px]"></div>}
        </div>
    </div>
));

const App: React.FC = () => {
  const [stems, setStems] = useState<AudioStem[]>([]);
  const [selectedStemIds, setSelectedStemIds] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [mixerValues, setMixerValuesState] = useState({ a: 1, b: 0, c: 0 });
  const [focusPoint, setFocusPoint] = useState<{x: number, y: number} | null>(null);
  
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [engineeringOpen, setEngineeringOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [vibeOpen, setVibeOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [keyframesOpen, setKeyframesOpen] = useState(false);
  const [mediaDockOpen, setMediaDockOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  
  const [cameraShakeEnabled, setCameraShakeEnabled] = useState(true);
  const [shakeIntensity, setShakeIntensity] = useState(1.0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [showVectors, setShowVectors] = useState(false);
  const [showTerrain, setShowTerrain] = useState(true);
  
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
      meshDistortion: 0, wireframeMode: false, connectionLines: true, connectionElasticity: 1, particleDensity: 1, chromaticAberration: 0, gridWarp: 0
  });
  const [audioFxSettings, setAudioFxSettingsState] = useState<AudioFxSettings>({
      playbackSpeed: 1, reverbAmount: 0, delayAmount: 0, stutterEnabled: false, stutterInterval: 0.25, mixAllStems: false
  });

  const [timeScale, setTimeScale] = useState(1.0);
  const [spatialFocus, setSpatialFocus] = useState(false);
  const [orbitMode, setOrbitMode] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [handControlEnabled, setHandControlEnabled] = useState(false);
  const [handData, setHandData] = useState<HandData | null>(null);
  
  const [currentFormation, setCurrentFormation] = useState<FormationType>(FormationType.SWARM);
  const [customFormation, setCustomFormation] = useState<FormationConfig | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>({ fps: 60, activeStems: 0, totalPolyCount: 0, fftSize: FFT_SIZE, sampleRate: 44100, frequencyBinCount: FFT_SIZE / 2, averageDecibels: -100, mathExplanation: "", loopCount: 0, bpm: 120 });
  const [loops, setLoops] = useState<LoopClip[]>([]);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  
  const [mediaClips, setMediaClips] = useState<MediaClip[]>([]);
  const [mediaPlacements, setMediaPlacements] = useState<MediaPlacement[]>([]);

  // Import Flow State
  const [pendingImport, setPendingImport] = useState<{ type: string, zip: any, hash: string, filename: string, audioFiles: string[] } | null>(null);

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);
  const [dragHasAudio, setDragHasAudio] = useState(false);
  const [dragHasZip, setDragHasZip] = useState(false);
  const dragCounter = useRef(0);

  const nextFleetId = useRef<number>(0);
  const timeRaf = useRef<number>();

  const setAudioFxSettings = (update: any) => {
      setAudioFxSettingsState(prev => {
          const newState = typeof update === 'function' ? update(prev) : update;
          if (newState.reverbAmount !== prev.reverbAmount) {
             audioService.ensureLane('global', 'reverb', 'Global Reverb', '#bd00ff');
             audioService.recordAutomation('global', 'reverb', newState.reverbAmount);
          }
          if (newState.delayAmount !== prev.delayAmount) {
             audioService.ensureLane('global', 'delay', 'Global Delay', '#00ffff');
             audioService.recordAutomation('global', 'delay', newState.delayAmount);
          }
          return newState;
      });
  };

  const setMixerValues = (newVal: { a: number, b: number, c: number }) => {
      setMixerValuesState(newVal);
      audioService.ensureLane('global', 'mixerA', 'Mixer Deck A', '#00ffff');
      audioService.ensureLane('global', 'mixerB', 'Mixer Deck B', '#bd00ff');
      audioService.ensureLane('global', 'mixerC', 'Mixer Deck C', '#00ff88');

      audioService.recordAutomation('global', 'mixerA', newVal.a);
      audioService.recordAutomation('global', 'mixerB', newVal.b);
      audioService.recordAutomation('global', 'mixerC', newVal.c);
  };

  const applyAIAction = (action: any) => {
      switch(action.type) {
          case 'SET_REVERB': setAudioFxSettings((p: any) => ({ ...p, reverbAmount: action.value })); break;
          case 'SET_DELAY': setAudioFxSettings((p: any) => ({ ...p, delayAmount: action.value })); break;
          case 'SET_SPEED': setAudioFxSettings((p: any) => ({ ...p, playbackSpeed: action.value })); break;
          case 'SET_MIXER': 
              if (action.target) {
                  const k = action.target.toLowerCase();
                  setMixerValues({ ...mixerValues, [k]: action.value });
              }
              break;
      }
  };

  // --- KEYFRAME ENGINE ---

  const captureSnapshot = useCallback(() => {
      // 1. Capture State
      const state: SessionStateSnapshot = {
          timestamp: audioService.getCurrentTime(),
          stems: stems.map(s => ({
              id: s.id,
              vol: s.volume,
              muted: s.isMuted,
              pos: { x: s.position.x, y: s.position.y, z: s.position.z },
              fleetId: s.fleetId
          })),
          mixer: mixerValues,
          audioSettings: audioFxSettings,
          visualSettings: visualSettings,
          effectsState: effectsService.getState(),
          activeLoopId: null, 
          tempo: audioService.getTempoConfig()
      };
      return state;
  }, [stems, mixerValues, audioFxSettings, visualSettings]);

  useEffect(() => {
      const handleRequestSnapshot = (e: CustomEvent) => {
          const { label, kind } = e.detail;
          const state = captureSnapshot();
          sessionService.createKeyframe(state, label, kind);
      };

      const handleRestoreState = (e: CustomEvent) => {
          const { snapshotId } = e.detail;
          const kf = sessionService.getKeyframeSnapshot(snapshotId);
          if (!kf) return;
          
          sessionService.logEvent('KEYFRAME_RESTORED', { snapshotId });

          const state = kf.state;

          // 1. Pause Audio & Reset Transport
          if (isPlaying) togglePlay(); 
          // We must ensure audio graph is clean or syncSeek works
          audioService.syncStop(stems.map(s => s.sourceNode));
          
          // 2. Restore React State
          setMixerValuesState(state.mixer);
          setAudioFxSettingsState(state.audioSettings);
          setVisualSettings(state.visualSettings);
          audioService.updateTempoConfig(state.tempo);
          
          // Restore FX State
          if (state.effectsState) {
              effectsService.restoreState(state.effectsState);
          }

          // 3. Restore Stems (Complex because of objects)
          setStems(prev => prev.map(s => {
              const snapStem = state.stems.find(ss => ss.id === s.id);
              if (snapStem) {
                  return {
                      ...s,
                      volume: snapStem.vol,
                      isMuted: snapStem.muted,
                      position: new Vector3(snapStem.pos.x, snapStem.pos.y, snapStem.pos.z),
                      fleetId: snapStem.fleetId,
                      sourceNode: null
                  };
              }
              return s;
          }));

          // 4. Update Time
          const seekEvent = new CustomEvent('hapa-seek', { detail: state.timestamp });
          window.dispatchEvent(seekEvent);
      };

      window.addEventListener('hapa-request-snapshot', handleRequestSnapshot as EventListener);
      window.addEventListener('hapa-restore-state', handleRestoreState as EventListener);
      return () => {
          window.removeEventListener('hapa-request-snapshot', handleRequestSnapshot as EventListener);
          window.removeEventListener('hapa-restore-state', handleRestoreState as EventListener);
      };
  }, [captureSnapshot, isPlaying, stems]);

  useEffect(() => {
    const loop = () => {
        if (isPlaying) {
            const t = audioService.getCurrentTime();
            setCurrentTime(t);
            audioService.applyAutomation(stems, setMixerValues, setAudioFxSettings);
            timelineScheduler.tick(t);
            audioService.processMetronome(); 
        }
        timeRaf.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { if(timeRaf.current) cancelAnimationFrame(timeRaf.current); };
  }, [isPlaying, stems]); 

  useEffect(() => {
      audioService.setEffects(audioFxSettings.reverbAmount, audioFxSettings.delayAmount);
      const activeNodes = stems.map(s => s.sourceNode).filter(n => n !== null) as AudioBufferSourceNode[];
      audioService.triggerStutter(activeNodes, audioFxSettings.stutterEnabled, audioFxSettings.stutterInterval);
      audioService.setPlaybackRate(activeNodes, audioFxSettings.playbackSpeed);
      if (activeNodes.length > 0) sessionService.logEvent('FX_UPDATE', audioFxSettings);
  }, [audioFxSettings, stems]); 

  useEffect(() => {
      const handleSeek = (e: any) => {
          const t = e.detail;
          sessionService.logEvent('SEEK', { time: t });
          timelineScheduler.clearFuture(t);
          const active = stems.filter(s => !s.isMuted);
          const nodes = active.map(s => ({ source: s.sourceNode, buffer: s.buffer, lowPass: s.lowPassNode }));
          const newSources = audioService.syncSeek(nodes, t);
          setStems(prev => {
              const next = [...prev];
              let idx = 0;
              for (let i = 0; i < next.length; i++) {
                  if (!next[i].isMuted) {
                      next[i].sourceNode = newSources[idx];
                      idx++;
                  } else {
                      next[i].sourceNode = null;
                  }
              }
              return next;
          });
          setCurrentTime(t);
      };
      window.addEventListener('hapa-seek', handleSeek);
      return () => window.removeEventListener('hapa-seek', handleSeek);
  }, [stems, isPlaying]);

  useEffect(() => {
      const handleRender = async (e: any) => {
          const { scope, start, duration } = e.detail;
          const totalDur = stems.reduce((acc, s) => Math.max(acc, s.duration), 0);
          const finalDuration = duration === -1 ? totalDur : duration;
          try {
              const result = await audioService.renderAudio(
                  stems, 
                  audioFxSettings, 
                  mixerValues, 
                  start, 
                  finalDuration
              );
              await sessionService.addRender(result.blob, {
                  name: scope === 'LOOP' ? `Loop ${Math.floor(start)}-${Math.floor(start+finalDuration)}` : 'Session Bounce',
                  scope,
                  duration: finalDuration,
                  sampleRate: 44100
              });
              const renderHash = await sessionService.computeHash(result.blob);
              analysisQueueService.enqueueWithBuffer('DSP_FINGERPRINT', {
                  scope: 'render',
                  assetHashes: [renderHash]
              }, result.buffer);
          } catch (err) {
              console.error("Render Failed", err);
          }
      };
      window.addEventListener('hapa-render', handleRender);
      return () => window.removeEventListener('hapa-render', handleRender);
  }, [stems, audioFxSettings, mixerValues]);

  const processFiles = async (fileList: FileList | File[], targetDeck?: number) => {
    audioService.resumeContext();
    const newStems: AudioStem[] = [];
    const files = Array.from(fileList).filter((f: any) => f.type.startsWith('audio/')) as File[];
    let fleetId = targetDeck !== undefined ? targetDeck : (nextFleetId.current++ % 3);
    let deckColor = fleetId === 0 ? "#00ffff" : fleetId === 1 ? "#bd00ff" : "#00ff88";
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const hash = await sessionService.computeHash(file); 
      const audioBuffer = await audioService.decodeAudioData(arrayBuffer);
      const { analyser, gain, lowPassNode, highPassNode } = audioService.createStemNodes(audioBuffer);
      const coarseWaveform = audioService.getCoarseWaveform(audioBuffer, 128);
      const cleanName = file.name.substring(0, 12);
      let x = fleetId === 0 ? -18 : fleetId === 1 ? 18 : 0;
      
      let source: AudioBufferSourceNode | null = null;
      if (isPlaying) {
          source = audioService.spawnStemAtTransport(audioBuffer, lowPassNode);
      }

      const stemId = uuidv4();

      analysisQueueService.enqueueWithBuffer('DSP_FINGERPRINT', {
          scope: 'stem',
          assetHashes: [hash],
          stemId: stemId
      }, audioBuffer);

      newStems.push({ 
          id: stemId, 
          hash, 
          name: cleanName, 
          rawBlob: file, 
          buffer: audioBuffer, 
          sourceNode: source, 
          analyserNode: analyser, 
          gainNode: gain, 
          lowPassNode, highPassNode, 
          position: new Vector3(x + (Math.random()-0.5)*5, 0, 0), 
          color: deckColor, 
          isPlaying, 
          isMuted: false, 
          volume: 1.0, 
          fleetId: fleetId || 0, 
          smartVolume: 1.0, 
          focusMultiplier: 1.0, 
          duration: audioBuffer.duration, 
          coarseWaveform: coarseWaveform
      });
      sessionService.logEvent('IMPORT_STEM', { name: cleanName, hash, deck: fleetId });
    }
    setStems(prev => [...prev, ...newStems]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, deck: number) => { if (e.target.files) processFiles(e.target.files, deck); };
  
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items.length > 0) { let hasAudio = false; let hasZip = false; for (let i = 0; i < e.dataTransfer.items.length; i++) { const item = e.dataTransfer.items[i]; if (item.kind === 'file') { if (item.type.startsWith('audio/') || item.type === '') hasAudio = true; if (item.type.includes('zip') || item.type.includes('compressed') || item.type === '') hasZip = true; } } setDragHasAudio(hasAudio); setDragHasZip(hasZip); setDragActive(true); } };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current <= 0) { setDragActive(false); dragCounter.current = 0; } };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); dragCounter.current = 0; if (e.dataTransfer.files) { const items = Array.from(e.dataTransfer.files) as File[]; const zips = items.filter(f => f.name.endsWith('.zip')); const audio = items.filter(f => f.type.startsWith('audio/')); if (zips.length > 0) handleZipImport(zips[0]); if (audio.length > 0) processFiles(audio); } };
  
  // Memoized Handlers for Performance
  const togglePlay = useCallback(() => { if (isPlaying) { sessionService.logEvent('STOP', {}); const active = stems.map(s => s.sourceNode); audioService.syncStop(active); setStems(prev => prev.map(s => ({ ...s, sourceNode: null }))); setIsPlaying(false); } else { sessionService.logEvent('PLAY', {}); const activeStems = stems.filter(s => !s.isMuted); const nodes = activeStems.map(s => ({ source: null, buffer: s.buffer, lowPass: s.lowPassNode })); const newSources = audioService.syncPlay(nodes); setStems(prev => { const next = [...prev]; let sourceIdx = 0; return next.map(s => { if (!s.isMuted && newSources && newSources[sourceIdx]) { const node = newSources[sourceIdx]; if (activeStems.find(a => a.id === s.id)) { sourceIdx++; return { ...s, sourceNode: node }; } } return s; }); }); setIsPlaying(true); } }, [isPlaying, stems]);
  
  const onSelectStem = useCallback((id: string, multi: boolean) => { if (multi) { setSelectedStemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); } else { setSelectedStemIds([id]); } }, []);
  
  const toggleMute = useCallback((id: string) => { setStems(prev => prev.map(s => { if (s.id === id) { const newMuted = !s.isMuted; if (isPlaying) { if (newMuted) { if (s.sourceNode) try { s.sourceNode.stop(); } catch(e) {} } else { s.sourceNode = audioService.spawnStemAtTransport(s.buffer, s.lowPassNode); } } if (isPlaying) sessionService.logEvent('MUTE_TOGGLE', { id, muted: newMuted }); return { ...s, isMuted: newMuted }; } return s; })); }, [isPlaying]);
  
  const mergeStems = () => { if (selectedStemIds.length < 2) return; const groupId = uuidv4(); setStems(prev => prev.map(s => selectedStemIds.includes(s.id) ? { ...s, groupId } : s)); setSelectedStemIds([]); };
  
  const updateStemPosition = useCallback((id: string, newPos: Vector3, isShiftHeld: boolean = false) => { if (isPlaying) { audioService.ensureLane(id, 'filterCutoff', `Filter (Y-Axis) - ${id.substring(0,4)}`, '#ff00ff'); audioService.recordAutomation(id, 'filterCutoff', newPos.y); } sessionService.logEvent('STEM_POS_UPDATE', { id, pos: {x:newPos.x, y:newPos.y, z:newPos.z} }); setStems(prev => { const target = prev.find(s => s.id === id); if (!target) return prev; if (target.groupId) { const delta = newPos.clone().sub(target.position); return prev.map(s => { if (s.groupId === target.groupId) { return { ...s, position: s.position.clone().add(delta) }; } return s; }); } return prev.map(s => s.id === id ? { ...s, position: newPos } : s); }); }, [isPlaying]);
  
  const handleExport = async () => { const blob = await sessionService.exportSession(stems, visualSettings, audioFxSettings, mixerValues); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `lumina_card_bundle_${Date.now()}.zip`; a.click(); URL.revokeObjectURL(url); };
  const handleZipImport = async (file: File) => { try { const result = await sessionService.importZip(file); if (result.type === 'hapa_bundle') { if (confirm(`Open "${file.name}" as Session? Cancel to add to Library.`)) { handleOpenSession(file); } else { sessionService.processHapaToLibrary(result.zip, result.hash, file.name); setLibraryOpen(true); } } else if (result.type === 'loop_pack') { setPendingImport({ ...result, filename: file.name }); } else { alert("Unknown Zip Format. No audio found."); } } catch (e) { console.error(e); alert("Import failed."); } };
  const handleOpenSession = async (file: File) => { setIsPlaying(false); audioService.syncStop(stems.map(s => s.sourceNode)); setIntegrityReport(null); try { const data = await sessionService.importSession(file); if (data.integrity.status === 'UNTRUSTED') setIntegrityReport(data.integrity); setStems(data.stems); setLoops(sessionService.getLoops()); if (data.settings.visual) setVisualSettings(data.settings.visual); if (data.settings.audio) setAudioFxSettingsState(data.settings.audio); if (data.settings.mixer) setMixerValuesState(data.settings.mixer); setMediaClips([...sessionService.getMediaClips()]); setMediaPlacements([...sessionService.getMediaPlacements()]); setCurrentTime(0); } catch(err) { console.error("Import failed", err); alert("Bundle corruption detected."); } };
  const handleImportInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) handleZipImport(e.target.files[0]); };
  const handleLoopJump = (l: LoopClip) => { const event = new CustomEvent('hapa-seek', { detail: l.start }); window.dispatchEvent(event); sessionService.logEvent('SEEK', { loopId: l.id }); };
  const handleRestoreKeyframe = (id: string) => { const event = new CustomEvent('hapa-restore-state', { detail: { snapshotId: id } }); window.dispatchEvent(event); };
  const handleCloneLoop = async (loop: LibraryLoopRef, bundle: LibraryBundle) => { const insertionTime = currentTime; const duration = loop.duration || 10; const newLoopClip: LoopClip = { id: uuidv4(), name: loop.title, start: insertionTime, end: insertionTime + duration, color: '#ffffff' }; sessionService.addLoop(newLoopClip); const newStems: AudioStem[] = []; const deckIds = Object.keys(loop.assetMap).map(Number); for (const deckId of deckIds) { const assetId = loop.assetMap[deckId]; const assetData = await sessionService.getAssetFromBundle(bundle.bundleId, assetId); if (assetData) { const { analyser, gain, lowPassNode, highPassNode } = audioService.createStemNodes(assetData.buffer); const coarseWaveform = audioService.getCoarseWaveform(assetData.buffer); let deckColor = deckId === 0 ? "#00ffff" : deckId === 1 ? "#bd00ff" : "#00ff88"; let x = deckId === 0 ? -18 : deckId === 1 ? 18 : 0; const stemId = uuidv4(); newStems.push({ id: stemId, hash: assetId, name: `${loop.title} - ${deckId === 0 ? 'A' : deckId === 1 ? 'B' : 'C'}`, rawBlob: assetData.blob, buffer: assetData.buffer, sourceNode: null, analyserNode: analyser, gainNode: gain, lowPassNode, highPassNode, position: new Vector3(x + (Math.random()-0.5)*2, 0, (Math.random()-0.5)*2), color: deckColor, isPlaying: false, isMuted: false, volume: 1.0, fleetId: deckId, smartVolume: 1.0, focusMultiplier: 1.0, duration: assetData.buffer.duration, coarseWaveform }); analysisQueueService.enqueueWithBuffer('DSP_FINGERPRINT', { scope: 'stem', assetHashes: [assetId], stemId: stemId }, assetData.buffer); } } setStems(prev => [...prev, ...newStems]); setLoops([...sessionService.getLoops()]); sessionService.logEvent('LIB_LOOP_CLONED', { loopId: loop.id, bundleId: bundle.bundleId, newLoopId: newLoopClip.id, count: newStems.length }); };
  const handlePlaceClip = (clip: MediaClip, mode: 'world' | 'camera' | 'fleetA' | 'fleetB' | 'fleetC') => { const placement: MediaPlacement = { id: uuidv4(), clipHash: clip.hash, position: mode === 'camera' ? { x: 5, y: -2, z: 0 } : { x: (Math.random()-0.5)*10, y: 5, z: (Math.random()-0.5)*10 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, attachMode: mode, loop: true, opacity: 0.9, emissiveGain: 1.0 }; sessionService.addMediaPlacement(placement); setMediaPlacements([...sessionService.getMediaPlacements()]); };
  const handleAddStemFromClip = async (clip: MediaClip) => { if (!clip.blob) return; try { audioService.resumeContext(); const arrayBuffer = await clip.blob.arrayBuffer(); const buffer = await audioService.decodeAudioData(arrayBuffer); const { analyser, gain, lowPassNode, highPassNode } = audioService.createStemNodes(buffer); const coarseWaveform = audioService.getCoarseWaveform(buffer); const newStem: AudioStem = { id: uuidv4(), hash: clip.hash, name: clip.label, rawBlob: clip.blob, buffer: buffer, sourceNode: null, analyserNode: analyser, gainNode: gain, lowPassNode, highPassNode, position: new Vector3(0, 0, 0), color: '#ffffff', isPlaying: isPlaying, isMuted: false, volume: 1.0, fleetId: 2, smartVolume: 1.0, focusMultiplier: 1.0, duration: buffer.duration, coarseWaveform }; setStems(prev => [...prev, newStem]); sessionService.logEvent('IMPORT_STEM', { id: newStem.id, hash: clip.hash, fromClip: true }); analysisQueueService.enqueueWithBuffer('DSP_FINGERPRINT', { scope: 'stem', assetHashes: [clip.hash], stemId: newStem.id }, buffer); if (isPlaying) { newStem.sourceNode = audioService.spawnStemAtTransport(buffer, lowPassNode); } } catch (err: any) { console.error("Failed to add stem from clip", err); if (err.message && err.message.includes("Unable to decode audio data")) { alert("The captured clip does not contain a valid audio track."); } else { alert("Could not decode audio from clip."); } } };

  useEffect(() => { setLoops([...sessionService.getLoops()]); }, [stems]); 

  const totalDuration = stems.reduce((acc, s) => Math.max(acc, s.duration), 10);
  const stemsByName = useRef<Record<string, number>>({});
  stemsByName.current = stems.reduce((acc, stem) => { acc[stem.name] = (acc[stem.name] || 0) + 1; return acc; }, {} as Record<string, number>);

  const onToggleSolo = useCallback((id: string) => {
      // Toggle logic... (simplified for brevity, assume default behavior)
      // Usually would be full logic here.
      // But keeping existing logic for safety, just wrapping in memo if needed.
      // Actually `StemMesh` takes `onToggleSolo`.
      // For now, let's just use a simple wrapper to satisfy linting/performance.
      setStems(prev => prev.map(s => {
          // Logic...
          return s; 
      }));
  }, []); // Placeholder if logic complex, but ideally copy logic from previous turn.
  // Wait, I should not delete logic.
  // Re-pasting original toggleSolo logic but wrapped.
  
  // NOTE: I am reusing the logic from previous turn for `toggleMute`, `togglePlay`, etc.
  // `onToggleSolo` was empty in previous turn `{}`. I will keep it empty for now or standard.
  // The provided `App.tsx` has `onToggleSolo={() => {}}`.
  // So I will define it as empty callback.
  const handleToggleSolo = useCallback((id: string) => {}, []);

  // Handler for Stem Drag End (needed for Scene props)
  const onStemDragEnd = useCallback((id: string) => {}, []);

  return (
    <div 
        className="relative w-full h-screen overflow-hidden font-mono select-none text-white pointer-events-none" 
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter} 
        onDragLeave={handleDragLeave} 
        onDrop={onDrop}
    >
      <div className="absolute inset-0 pointer-events-none z-0">
          <Scene 
            stems={stems} updateStemPosition={updateStemPosition} onStemDragEnd={onStemDragEnd}
            cameraShakeEnabled={cameraShakeEnabled} shakeIntensity={shakeIntensity} showVectors={showVectors} showTerrain={showTerrain}
            spatialFocus={spatialFocus} orbitMode={orbitMode} timeScale={timeScale}
            flightMode={flightMode} flightSpeed={1} obstacleDensity={0.5}
            handData={handData} handControlEnabled={handControlEnabled} handSmoothness={0.05} handSpread={0}
            currentFormation={currentFormation} customFormation={customFormation}
            mixerValues={mixerValues} focusPoint={focusPoint} stemsByName={stemsByName.current}
            onToggleMute={toggleMute}
            onToggleSolo={handleToggleSolo} visualSettings={visualSettings}
            selectedStemIds={selectedStemIds} onSelectStem={onSelectStem}
            mixAllStems={audioFxSettings.mixAllStems}
            mediaClips={mediaClips}
            mediaPlacements={mediaPlacements}
          />
      </div>

      <div className="absolute inset-0 z-50 pointer-events-none">
          <DropDockOverlay active={dragActive} hasAudio={dragHasAudio} hasZip={dragHasZip} />
          {/* Hand Input needs pointer events enabled for camera feed? No, it's non-interactive view usually. */}
          {/* But if we want debug clicks, we might. Defaulting to none is safer for scene interaction. */}
          <div className="pointer-events-none">
             <HandInput enabled={handControlEnabled} onHandUpdate={setHandData} />
          </div>
      </div>

      {/* INTEGRITY ALERT */}
      {integrityReport && integrityReport.status === 'UNTRUSTED' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500 text-white px-4 py-2 rounded-lg shadow-[0_0_20px_red] max-w-lg pointer-events-auto">
              <div className="flex items-center gap-2 font-bold mb-1">
                  <i className="fas fa-exclamation-triangle"></i> UNTRUSTED BUNDLE
              </div>
              <p className="text-xs opacity-80 mb-2">Hashes do not match manifest. Assets may have been modified externally.</p>
              <ul className="text-[10px] font-mono bg-black/50 p-2 rounded max-h-20 overflow-y-auto">
                  {integrityReport.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              <button onClick={() => setIntegrityReport(null)} className="mt-2 w-full text-xs bg-red-800 hover:bg-red-700 py-1 rounded">DISMISS</button>
          </div>
      )}

      {/* IMPORT WIZARD */}
      {pendingImport && (
          <div className="pointer-events-auto relative z-[60]">
              <LoopPackWizard 
                  filename={pendingImport.filename}
                  files={pendingImport.audioFiles}
                  onCancel={() => setPendingImport(null)}
                  onConfirm={(config) => {
                      sessionService.processPackToLibrary(pendingImport.zip, pendingImport.hash, pendingImport.filename, config);
                      setPendingImport(null);
                      setLibraryOpen(true);
                  }}
              />
          </div>
      )}

      <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-green-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]">
              LUMINASTEM <span className="text-sm font-normal text-white/50">// KEYFRAME ENGINE V1</span>
          </h1>
          <div className="flex gap-4 mt-1 text-[10px] text-gray-400 bg-black/50 px-2 py-1 rounded inline-block">
             <span className={stems.length > 0 ? "text-green-400 animate-pulse" : ""}>SYSTEM: {stems.length > 0 ? 'ONLINE' : 'STANDBY'}</span>
          </div>
          {selectedStemIds.length > 1 && (
              <div className="mt-2 pointer-events-auto">
                  <button onClick={mergeStems} className="bg-white text-black text-xs font-bold px-3 py-1 rounded hover:bg-cyan-400 shadow-[0_0_15px_white]">
                      <i className="fas fa-link mr-1"></i> MERGE GROUP ({selectedStemIds.length})
                  </button>
              </div>
          )}
      </div>

      <div className="absolute top-4 right-4 z-20 flex gap-2 pointer-events-auto">
          <button onClick={() => setEffectsOpen(!effectsOpen)} className="w-10 h-10 rounded-full border border-yellow-500/50 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-magic"></i></button>
          <button onClick={() => setAutomationOpen(!automationOpen)} className="w-10 h-10 rounded-full border border-orange-500/50 bg-orange-900/20 text-orange-400 hover:bg-orange-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-robot"></i></button>
          <button onClick={() => setEngineeringOpen(!engineeringOpen)} className="w-10 h-10 rounded-full border border-purple-500/50 bg-purple-900/20 text-purple-400 hover:bg-purple-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-cogs"></i></button>
          <button onClick={() => setVibeOpen(!vibeOpen)} className="w-10 h-10 rounded-full border border-pink-500/50 bg-pink-900/20 text-pink-400 hover:bg-pink-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-fingerprint"></i></button>
          <button onClick={() => setLibraryOpen(!libraryOpen)} className="w-10 h-10 rounded-full border border-blue-500/50 bg-blue-900/20 text-blue-400 hover:bg-blue-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-book-open"></i></button>
          <button onClick={() => setTelemetryOpen(!telemetryOpen)} className="w-10 h-10 rounded-full border border-green-500/50 bg-green-900/20 text-green-400 hover:bg-green-500 hover:text-black transition flex items-center justify-center"><i className="fas fa-chart-line"></i></button>
      </div>

      {/* TOP DECK C */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-5xl p-2 z-20 pointer-events-auto bg-black/60 backdrop-blur-md border-b border-green-500/30 rounded-b-3xl transition hover:bg-black/90 group shadow-[0_0_20px_rgba(0,255,136,0.1)]">
           <div className="flex justify-between items-center px-4 pb-2 mb-1 border-b border-white/5">
                <span className="text-xs font-bold text-green-400 tracking-widest">DECK C (TOP)</span>
                <label className="text-[9px] bg-green-500/20 text-green-400 px-3 py-1 rounded hover:bg-green-500 hover:text-black font-bold cursor-pointer">LOAD C <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 2)} multiple /></label>
           </div>
           <div className="flex gap-2 overflow-x-auto px-2 pb-2 custom-scrollbar">
                {stems.filter(s => s.fleetId === 2).length === 0 && <div className="w-full text-center text-[10px] text-gray-500 py-2">NO DATA LOADED</div>}
                {stems.filter(s => s.fleetId === 2).map(s => (
                    <div key={s.id} className="w-32 flex-shrink-0">
                         <CompactStemRow stem={s} color="#00ff88" onToggleMute={toggleMute} />
                    </div>
                ))}
           </div>
      </div>

      {/* SIDEBARS - ADJUSTED BOTTOM TO 56 */}
      <div className={`absolute left-0 top-32 bottom-56 w-64 p-4 transition-transform duration-300 z-10 pointer-events-auto ${stems.length > 0 ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full bg-black/60 backdrop-blur-md border-r border-cyan-500/30 rounded-r-3xl">
              <div className="p-4 border-b border-cyan-500/20 bg-cyan-900/20 flex justify-between items-center rounded-tr-3xl"><span className="text-xs font-bold text-cyan-400">DECK A</span><label className="text-[9px] px-2 py-1 bg-cyan-900/40 text-cyan-300 rounded cursor-pointer">LOAD A <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 0)} /></label></div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stems.filter(s => s.fleetId === 0).map(s => (
                      <CompactStemRow key={s.id} stem={s} color="#00ffff" onToggleMute={toggleMute} />
                  ))}
              </div>
          </div>
      </div>
      <div className={`absolute right-0 top-32 bottom-56 w-64 p-4 transition-transform duration-300 z-10 pointer-events-auto ${stems.length > 0 ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex flex-col h-full bg-black/60 backdrop-blur-md border-l border-purple-500/30 rounded-l-3xl">
              <div className="p-4 border-b border-purple-500/20 bg-purple-900/20 flex justify-between items-center rounded-tl-3xl"><span className="text-xs font-bold text-purple-400">DECK B</span><label className="text-[9px] px-2 py-1 bg-purple-900/40 text-purple-300 rounded cursor-pointer">LOAD B <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, 1)} /></label></div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stems.filter(s => s.fleetId === 1).map(s => (
                      <CompactStemRow key={s.id} stem={s} color="#bd00ff" onToggleMute={toggleMute} />
                  ))}
              </div>
          </div>
      </div>

      {/* BOTTOM CONTROL DECK - MOVED TO BOTTOM-32 */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-6xl h-40 bg-black/80 backdrop-blur-xl border border-white/10 rounded-t-3xl flex items-center justify-between px-10 shadow-2xl z-30 pointer-events-auto pb-4">
          <div className="flex flex-col items-center gap-4 w-48">
             <div className="grid grid-cols-2 gap-2 w-full">
                   <button onClick={() => setFlightMode(!flightMode)} className={`p-2 rounded border transition text-xs font-bold ${flightMode ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-gray-700 text-gray-500'}`}>FLIGHT</button>
                   <button onClick={() => setHandControlEnabled(!handControlEnabled)} className={`p-2 rounded border transition text-xs font-bold ${handControlEnabled ? 'bg-green-500/20 border-green-500 text-green-300' : 'border-gray-700 text-gray-500'}`}>HANDS</button>
              </div>
          </div>
          <div className="flex gap-12 items-center justify-center flex-1 h-full py-2">
              <HoloMixer values={mixerValues} onChange={setMixerValues} />
              <div className="h-24 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
              <RadarFocus />
          </div>
          <div className="flex flex-col items-end gap-3 w-48">
               <div className="text-right"><div className="text-[10px] text-gray-500 tracking-widest mb-1">FORMATION</div><button onClick={() => setCurrentFormation(FormationType.SWARM)} className="w-full text-xs px-3 py-2 border border-gray-600 rounded bg-gray-900/50 text-gray-300">{currentFormation}</button></div>
          </div>
      </div>

      {/* NEW TRANSPORT BAR - Z-50 - FIXED POSITIONING */}
      <div className="absolute inset-x-0 bottom-0 z-50 pointer-events-none">
          {/* Container is pointer-events-none so drags pass through empty space, but TransportControls inside enables its own pointer-events */}
          <TransportControls 
            isPlaying={isPlaying} 
            onPlayPause={togglePlay} 
            totalDuration={totalDuration} 
            currentTime={currentTime} 
            loops={loops}
            onLoopSelect={handleLoopJump}
            onToggleKeyframes={() => setKeyframesOpen(!keyframesOpen)}
            isKeyframesOpen={keyframesOpen}
          />
      </div>
      
      {/* PANELS (Drawers) - Z-40 */}
      <div className="relative z-40 pointer-events-auto">
          <KeyframePanel 
             isOpen={keyframesOpen} 
             setIsOpen={setKeyframesOpen}
             onRestore={handleRestoreKeyframe}
             currentTransportTime={currentTime}
          />

          <EngineeringPanel 
            isOpen={engineeringOpen} setIsOpen={setEngineeringOpen}
            visualSettings={visualSettings} setVisualSettings={setVisualSettings}
            audioSettings={audioFxSettings} setAudioSettings={setAudioFxSettings}
            onReset={() => {}}
          />

          <AutomationPanel
            isOpen={automationOpen} setIsOpen={setAutomationOpen}
            isPlaying={isPlaying}
          />

          <EffectsPanel 
            isOpen={effectsOpen}
            setIsOpen={setEffectsOpen}
          />

          <VibePanel
            isOpen={vibeOpen}
            setIsOpen={setVibeOpen}
            stems={stems}
            mixerValues={mixerValues}
            audioSettings={audioFxSettings}
            onApplyAction={applyAIAction}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
          
          <LibraryPanel
              isOpen={libraryOpen}
              setIsOpen={setLibraryOpen}
              onCloneLoop={handleCloneLoop}
          />
          
          <MediaDock 
              isOpen={mediaDockOpen}
              setIsOpen={setMediaDockOpen}
              onPlaceClip={handlePlaceClip}
              onAddStem={handleAddStemFromClip}
          />
          
          <TelemetryPanel 
            isOpen={telemetryOpen} setIsOpen={setTelemetryOpen} data={telemetry} isPlaying={isPlaying}
            cameraShakeEnabled={cameraShakeEnabled} setCameraShakeEnabled={setCameraShakeEnabled} shakeIntensity={shakeIntensity} setShakeIntensity={setShakeIntensity}
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled} showVectors={showVectors} setShowVectors={setShowVectors} showTerrain={showTerrain} setShowTerrain={setShowTerrain}
            onExport={handleExport} onImport={handleImportInput}
          />
      </div>
      
      {/* Floating Media Toggle */}
      <button 
          onClick={() => setMediaDockOpen(!mediaDockOpen)}
          className={`fixed right-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] ${mediaDockOpen ? 'bg-gray-200 text-black border-white' : 'bg-black/50 text-gray-400 border-white/30'} pointer-events-auto`}
          title="Media Capture"
          style={{ top: '340px' }}
      >
          <i className={`fas ${mediaDockOpen ? 'fa-times' : 'fa-camera'}`}></i>
      </button>
    </div>
  );
};

export default App;
