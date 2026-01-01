import React, { useState, useRef } from 'react';
import { ViewMode, LogEntry, HullVisuals, EnvironmentConfig } from '../types';
import { LiveServerMessage, Modality } from '@google/genai';
import { createGenAI } from '@/shared/genai/client';

interface HUDProps {
  shipName: string;
  onNameChange: (val: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentFloor: number;
  onFloorChange: (val: number) => void;
  isSymmetryEnabled: boolean;
  onSymmetryToggle: () => void;
  shipRotation: number;
  onShipRotationChange: (val: number) => void;
  isLaunchMode: boolean;
  onLaunchToggle: () => void;
  onAnalyze: () => void;
  onForgeOpen: () => void;
  onManualOpen: () => void;
  onVideoGen: () => void;
  onArtGen: () => void;
  onExport: () => void;
  hasHullVisuals: boolean;
  hullVisuals: HullVisuals | null;
  onHullVisualsChange: (v: HullVisuals) => void;
  logs: LogEntry[];
  hasSidebar: boolean;
  onFleetOpen: () => void;
  onToggleBridgeCam: () => void;
  isBridgeCamActive: boolean;
  onCaptureSnapshot: () => void;
  snapshots: string[];
  environmentConfig: EnvironmentConfig;
  onEnvironmentConfigChange: (config: EnvironmentConfig) => void;
}

// Helper functions for Gemini Live API
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const HUD: React.FC<HUDProps> = ({
  shipName,
  onNameChange,
  viewMode,
  onViewModeChange,
  currentFloor,
  onFloorChange,
  isLaunchMode,
  onLaunchToggle,
  onAnalyze,
  onForgeOpen,
  onFleetOpen,
  onManualOpen,
  onVideoGen,
  onArtGen,
  onExport,
  onToggleBridgeCam,
  isBridgeCamActive,
  onCaptureSnapshot,
  logs,
  hasSidebar,
  environmentConfig,
  onEnvironmentConfigChange,
  hasHullVisuals
}) => {
  const [isCommActive, setIsCommActive] = useState(false);
  const [showEnvMenu, setShowEnvMenu] = useState(false);
  const [showSynthOps, setShowSynthOps] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const toggleComm = async () => {
    if (isCommActive) {
      if (audioContextRef.current) audioContextRef.current.close();
      if (inputContextRef.current) inputContextRef.current.close();
      setIsCommActive(false);
      return;
    }

    try {
      const ai = createGenAI();
      setIsCommActive(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      let nextStartTime = 0;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            inputContextRef.current = inputCtx;
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const data = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(data.length);
              for (let i = 0; i < data.length; i++) {
                int16[i] = data[i] * 32768;
              }
              const base64 = encode(new Uint8Array(int16.buffer));
              sessionPromise.then(s => s.sendRealtimeInput({ 
                media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
              }));
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle interruptions
            if (msg.serverContent?.interrupted) {
              for (const src of sourcesRef.current) {
                src.stop();
              }
              sourcesRef.current.clear();
              nextStartTime = 0;
              return;
            }

            // Iterate through parts to find audio data
            const parts = msg.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                const bytes = decode(part.inlineData.data);
                const buffer = await decodeAudioData(bytes, outputCtx, 24000, 1);
                
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputCtx.destination);
                
                nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
                source.start(nextStartTime);
                nextStartTime += buffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }
            }
          },
          onerror: (e) => {
            console.error("Live AI error:", e);
            setIsCommActive(false);
          },
          onclose: () => {
            setIsCommActive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are AstraCore, the shipboard AI for the starship ${shipName}. You are efficient, futuristic, and helpful. Guide the user through spaceship fabrication.`,
        }
      });
    } catch (err) {
      console.error("Failed to start neural link:", err);
      setIsCommActive(false);
    }
  };

  const showFloorControls = !isLaunchMode && viewMode !== 'EXPLORE';

  return (
    <div className="absolute inset-0 pointer-events-none z-30 p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className={`flex flex-col gap-4 items-start pointer-events-auto transition-all duration-700 ${hasSidebar ? 'ml-80' : 'ml-0'}`}>
          <div className="glass-panel px-8 py-3 border-l-4 border-l-sky-500 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col min-w-[320px]">
            <span className="text-[9px] font-black text-sky-500/60 tracking-[0.5em] mb-1 uppercase">Docking Auth: Astra-Prime</span>
            <input 
              type="text" 
              value={shipName}
              onChange={(e) => onNameChange(e.target.value)}
              className="bg-transparent text-2xl font-orbitron text-sky-400 outline-none w-full placeholder:text-sky-900 font-black tracking-tighter"
              placeholder="SHIP-DESIGNATION..."
              disabled={isLaunchMode}
            />
          </div>

          <div className="glass-panel p-4 border border-sky-500/20 rounded-sm shadow-xl max-h-48 w-[320px] overflow-hidden flex flex-col gap-2 backdrop-blur-xl bg-slate-950/40">
            <div className="flex justify-between items-center border-b border-sky-500/10 pb-2 mb-1">
              <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Neural Logs</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-sky-500 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-sky-400 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
              {logs.map((log) => (
                <div key={log.id} className={`text-[10px] font-mono tracking-tight animate-in fade-in slide-in-from-left-4 duration-500 leading-tight ${log.type === 'CRITICAL' ? 'text-red-400' : log.type === 'NEURAL' ? 'text-purple-400' : 'text-slate-400'}`}>
                  <span className="opacity-40 mr-2">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  <span className="font-medium">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start pointer-events-auto">
          {!isLaunchMode && (
            <>
              <div className="relative">
                <button 
                  onClick={() => { setShowEnvMenu(!showEnvMenu); setShowSynthOps(false); }}
                  aria-label="Environment options"
                  title="Environment options"
                  className={`glass-panel w-12 h-12 flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 ${showEnvMenu ? 'text-sky-400 border-sky-400 bg-sky-500/20' : 'text-slate-400 border-slate-700 hover:text-sky-400 hover:border-sky-400'}`}
                >
                  <i className="fa-solid fa-mountain-sun text-lg"></i>
                </button>
                {showEnvMenu && (
                  <div className="absolute top-14 right-0 glass-panel p-3 flex flex-col gap-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                    <EnvToggle active={environmentConfig.showNebula} onClick={() => onEnvironmentConfigChange({ ...environmentConfig, showNebula: !environmentConfig.showNebula })} icon="fa-cloud" label="Nebula" />
                    <EnvToggle active={environmentConfig.showAsteroids} onClick={() => onEnvironmentConfigChange({ ...environmentConfig, showAsteroids: !environmentConfig.showAsteroids })} icon="fa-meteor" label="Asteroids" />
                    <EnvToggle active={environmentConfig.showSolarFlare} onClick={() => onEnvironmentConfigChange({ ...environmentConfig, showSolarFlare: !environmentConfig.showSolarFlare })} icon="fa-sun" label="Solar Flare" />
                  </div>
                )}
              </div>

              <div className="glass-panel p-1.5 rounded-sm flex gap-2 items-center shadow-2xl bg-slate-900/60 backdrop-blur-2xl">
                <ViewBtn active={viewMode === 'SYNTHESIZED'} onClick={() => onViewModeChange('SYNTHESIZED')} icon="fa-wand-magic-sparkles" label="Synth" />
                <ViewBtn active={viewMode === 'HULL'} onClick={() => onViewModeChange('HULL')} icon="fa-cube" label="Exterior" />
                <ViewBtn active={viewMode === 'CUTAWAY'} onClick={() => onViewModeChange('CUTAWAY')} icon="fa-layer-group" label="Interior" />
                <ViewBtn active={viewMode === 'EXPLORE'} onClick={() => onViewModeChange('EXPLORE')} icon="fa-person-walking" label="Walk" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className={`flex gap-3 pointer-events-auto transition-all duration-700 ${hasSidebar ? 'ml-80' : 'ml-0'}`}>
           <button 
            onClick={onToggleBridgeCam}
            className={`h-12 px-6 flex items-center gap-4 glass-panel border shadow-2xl transition-all hover:scale-105 active:scale-95 ${isBridgeCamActive ? 'bg-emerald-600/20 border-emerald-400 text-emerald-400' : 'text-slate-400 border-slate-700 hover:border-sky-500'}`}
          >
            <i className={`fa-solid ${isBridgeCamActive ? 'fa-video' : 'fa-video-slash'} text-lg`}></i>
            <span className="font-orbitron text-[10px] uppercase font-black tracking-widest">{isBridgeCamActive ? 'BRIDGE-CAM: ACTIVE' : 'BRIDGE-CAM: OFF'}</span>
          </button>
          
          {isBridgeCamActive && (
            <button 
              onClick={onCaptureSnapshot}
              className="h-12 px-8 bg-sky-600 text-white font-orbitron text-[10px] uppercase font-black rounded-sm hover:bg-sky-500 transition-all shadow-xl hover:shadow-sky-500/20 tracking-[0.2em]"
            >
              RECORD SNAPSHOT
            </button>
          )}

          <button 
            onClick={toggleComm}
            className={`h-12 px-6 flex items-center gap-4 glass-panel border shadow-2xl transition-all hover:scale-105 active:scale-95 ${isCommActive ? 'bg-purple-600/30 border-purple-400 text-purple-300 animate-pulse' : 'text-sky-400 border-sky-500/30 hover:border-sky-400'}`}
          >
            <i className="fa-solid fa-headset text-lg"></i>
            <span className="font-orbitron text-[10px] uppercase font-black tracking-widest">{isCommActive ? 'NEURAL LINK ACTIVE' : 'ASTRACRE COMMS'}</span>
          </button>
        </div>

        <div className="flex gap-4 items-end pointer-events-auto">
          {!isLaunchMode && (
            <>
              {showFloorControls && (
                <div className="glass-panel p-1.5 rounded-sm flex flex-col gap-2 items-center shadow-2xl bg-slate-900/60 backdrop-blur-2xl">
                  <button
                    onClick={() => onFloorChange(currentFloor + 1)}
                    aria-label="Increase deck"
                    title="Increase deck"
                    className="w-10 h-10 flex items-center justify-center text-sky-400 hover:bg-sky-500/10 transition-all rounded-sm border border-transparent hover:border-sky-500/30"
                  >
                    <i className="fa-solid fa-chevron-up"></i>
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">DECK</span>
                    <span className="text-xl font-orbitron font-black text-sky-400">{currentFloor}</span>
                  </div>
                  <button
                    onClick={() => onFloorChange(Math.max(0, currentFloor - 1))}
                    aria-label="Decrease deck"
                    title="Decrease deck"
                    className="w-10 h-10 flex items-center justify-center text-sky-400 hover:bg-sky-500/10 transition-all rounded-sm border border-transparent hover:border-sky-500/30"
                  >
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <div className="relative">
                  <button 
                    onClick={() => { setShowSynthOps(!showSynthOps); setShowEnvMenu(false); }}
                    aria-label="Synthesis operations"
                    title="Synthesis operations"
                    className={`h-14 w-14 glass-panel flex items-center justify-center transition-all shadow-2xl hover:scale-105 active:scale-95 border-sky-500/30 ${showSynthOps ? 'text-sky-400 bg-sky-500/20 border-sky-500' : 'text-sky-400'}`}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                  </button>
                  {showSynthOps && (
                    <div className="absolute bottom-16 right-0 glass-panel p-3 flex flex-col gap-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <h4 className="text-[9px] font-black text-sky-500 uppercase tracking-widest px-2 mb-1">Visual Synthesis</h4>
                      <SynthAction onClick={onArtGen} disabled={!hasHullVisuals} icon="fa-camera-retro" label="Cinematic Art" />
                      <SynthAction onClick={onVideoGen} disabled={!hasHullVisuals} icon="fa-film" label="Majestic Flyby" />
                      <div className="h-[1px] bg-sky-900/30 my-1"></div>
                      <SynthAction onClick={onExport} icon="fa-file-export" label="Vessel Manifest" />
                      <SynthAction onClick={onManualOpen} icon="fa-book-open" label="Tech Manual" />
                    </div>
                  )}
                </div>

                <button onClick={onFleetOpen} className="h-14 px-8 glass-panel flex items-center gap-3 text-sky-400 hover:border-sky-400 transition-all font-orbitron text-[11px] font-black tracking-widest shadow-2xl hover:scale-105 active:scale-95 uppercase border-sky-500/30">
                  <i className="fa-solid fa-layer-group text-lg"></i>Fleet
                </button>
                <button onClick={onForgeOpen} className="h-14 px-8 glass-panel flex items-center gap-3 text-sky-400 hover:border-sky-400 transition-all font-orbitron text-[11px] font-black tracking-widest shadow-2xl hover:scale-105 active:scale-95 uppercase border-sky-500/30">
                  <i className="fa-solid fa-microchip text-lg"></i>Forge
                </button>
                <button
                  onClick={onAnalyze}
                  aria-label="Analyze ship"
                  title="Analyze ship"
                  className="h-14 w-14 glass-panel flex items-center justify-center text-emerald-400 hover:border-emerald-400 transition-all shadow-2xl hover:scale-105 active:scale-95 border-emerald-500/30"
                >
                  <i className="fa-solid fa-brain text-xl"></i>
                </button>
              </div>
            </>
          )}

          <button 
            onClick={onLaunchToggle}
            className={`h-14 px-12 font-orbitron text-[13px] transition-all rounded-sm shadow-[0_0_50px_rgba(14,165,233,0.3)] flex items-center gap-6 border tracking-[0.3em] font-black hover:scale-105 active:scale-95 ${isLaunchMode ? 'bg-red-600/30 border-red-500 text-red-400' : 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-sky-500/20'}`}
          >
            <i className={`fa-solid ${isLaunchMode ? 'fa-square' : 'fa-rocket'} text-lg`}></i>
            {isLaunchMode ? 'ABORT SEQUENCE' : 'INITIATE LAUNCH'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ViewBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`px-4 py-2.5 rounded-sm flex items-center gap-3 text-[10px] uppercase font-black tracking-widest transition-all border ${active ? 'bg-sky-500/30 border-sky-400 text-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.3)] scale-105' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'}`}
  >
    <i className={`fa-solid ${icon} text-sm`}></i>
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const EnvToggle = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`px-4 py-2.5 rounded-sm flex items-center gap-4 text-[10px] uppercase font-black tracking-widest transition-all border ${active ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
  >
    <i className={`fa-solid ${icon} w-5 text-center text-sm`}></i>
    {label}
  </button>
);

const SynthAction = ({ onClick, icon, label, disabled = false }: { onClick: () => void, icon: string, label: string, disabled?: boolean }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`px-4 py-2.5 rounded-sm flex items-center gap-4 text-[10px] uppercase font-black tracking-widest transition-all border ${disabled ? 'opacity-30 cursor-not-allowed border-slate-800 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/5'}`}
  >
    <i className={`fa-solid ${icon} w-5 text-center text-sm`}></i>
    {label}
  </button>
);