
import React, { useEffect, useState } from 'react';
import { TelemetryData, RenderAsset } from '../types';
import { geminiService } from '../services/geminiService';
import { sessionService } from '../services/sessionService';

interface TelemetryPanelProps {
  data: TelemetryData;
  isPlaying: boolean;
  cameraShakeEnabled: boolean;
  setCameraShakeEnabled: (v: boolean) => void;
  shakeIntensity: number;
  setShakeIntensity: (v: number) => void;
  aiEnabled: boolean;
  setAiEnabled: (v: boolean) => void;
  showVectors: boolean;
  setShowVectors: (v: boolean) => void;
  showTerrain: boolean;
  setShowTerrain: (v: boolean) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ 
  data, isPlaying, cameraShakeEnabled, setCameraShakeEnabled, shakeIntensity, setShakeIntensity,
  aiEnabled, setAiEnabled, showVectors, setShowVectors, showTerrain, setShowTerrain, onExport, onImport,
  isOpen, setIsOpen
}) => {
  const [insight, setInsight] = useState<string>("Initializing Neural Link...");
  const [renders, setRenders] = useState<RenderAsset[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let interval: any;
    const fetchInsight = async () => {
      if (isPlaying && aiEnabled) {
        const context = `Active Stems: ${data.activeStems}. Avg dB: ${data.averageDecibels.toFixed(1)}. Loop: ${data.loopCount}`;
        const text = await geminiService.getMathExplanation(context);
        setInsight(text);
      } else if (!aiEnabled) {
        setInsight("AI Co-Pilot Offline.");
      }
    };

    if (isPlaying && aiEnabled) {
      fetchInsight();
      interval = setInterval(fetchInsight, 15000);
    } else {
        setInsight(aiEnabled ? "Waiting for audio input..." : "AI Co-Pilot Offline.");
    }
    
    // Sync renders on open
    if(isOpen) {
        setRenders(sessionService.getRenders());
    }
    
    return () => clearInterval(interval);
  }, [isPlaying, data.activeStems, aiEnabled, isOpen]);

  const handleRenderSession = () => {
      if (isRendering) return;
      setIsRendering(true);
      const evt = new CustomEvent('hapa-render', { 
          detail: { scope: 'SESSION', start: 0, duration: -1 } // Duration calculated in App
      });
      window.dispatchEvent(evt);
      setTimeout(() => {
          setIsRendering(false);
          setRenders(sessionService.getRenders()); // Refresh list
      }, 3000);
  };

  const downloadRender = (r: RenderAsset) => {
      if (!r.blob) return;
      const url = URL.createObjectURL(r.blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = r.name || "untitled_render";
      a.download = `${safeName.replace(/\s/g, '_')}_${r.id.substring(0,4)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
  };

  return (
    <>
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`fixed top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-lg border backdrop-blur-md transition-all ${isOpen ? 'bg-green-500 text-black border-green-500' : 'bg-black/50 text-green-500 border-green-500/30'}`}
        >
            <i className={`fas ${isOpen ? 'fa-times' : 'fa-chart-line'}`}></i>
        </button>

        <div className={`fixed top-0 right-0 h-full w-80 bg-black/90 backdrop-blur-xl border-l border-green-500/20 z-20 transform transition-transform duration-300 ease-in-out pt-20 px-6 pb-6 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <h2 className="text-xl font-black text-white mb-6 tracking-wider border-b border-green-500/30 pb-2">TELEMETRY</h2>

            <div className="mb-6 bg-green-900/10 border border-green-500/20 rounded p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <div className="text-[10px] text-green-400 font-bold mb-2 flex items-center gap-2">
                    <i className="fas fa-brain"></i> AI CO-PILOT
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto"></div>
                </div>
                <p className="text-xs text-green-100/80 leading-relaxed font-mono">{insight}</p>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="accent-green-500" />
                    <span className="text-[10px] text-gray-400">ENABLE NEURAL LINK</span>
                </label>
            </div>

            <div className="space-y-4 mb-8">
                <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">SIGNAL INTENSITY</div>
                    <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-75" style={{ width: `${Math.min(100, data.averageDecibels + 100)}%` }}></div>
                    </div>
                    <div className="text-right text-xs text-green-400 font-mono mt-1">{data.averageDecibels.toFixed(1)} dB</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
                         <div className="text-[10px] text-gray-500">CYCLES</div>
                         <div className="text-lg font-bold text-white">{data.loopCount}</div>
                     </div>
                     <div className="bg-gray-900/50 p-2 rounded border border-gray-800">
                         <div className="text-[10px] text-gray-500">STEMS</div>
                         <div className="text-lg font-bold text-white">{data.activeStems}</div>
                     </div>
                </div>
            </div>

            <h3 className="text-xs font-bold text-gray-400 mb-4 tracking-widest">SYSTEM CONFIG</h3>
            
            <div className="space-y-4">
                 <div>
                    <label className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>CAMERA SHAKE</span>
                        <input type="checkbox" checked={cameraShakeEnabled} onChange={(e) => setCameraShakeEnabled(e.target.checked)} className="accent-green-500" />
                    </label>
                    <input type="range" min="0" max="5" step="0.1" value={shakeIntensity} onChange={(e) => setShakeIntensity(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 accent-green-500 rounded appearance-none" />
                 </div>

                 <div className="space-y-2">
                    <label className="flex items-center gap-3 text-xs text-gray-300 p-2 bg-gray-900/30 rounded hover:bg-gray-900/60 transition cursor-pointer">
                        <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} className="accent-cyan-500" />
                        VECTOR OVERLAY
                    </label>
                    <label className="flex items-center gap-3 text-xs text-gray-300 p-2 bg-gray-900/30 rounded hover:bg-gray-900/60 transition cursor-pointer">
                        <input type="checkbox" checked={showTerrain} onChange={(e) => setShowTerrain(e.target.checked)} className="accent-purple-500" />
                        SPECTROGRAM TERRAIN
                    </label>
                 </div>
            </div>

            {/* Render Manager */}
            <div className="mt-8 pt-4 border-t border-gray-800">
                <h3 className="text-xs font-bold text-cyan-400 mb-2 tracking-widest">OFFLINE BOUNCES</h3>
                <button 
                    onClick={handleRenderSession}
                    disabled={isRendering || data.activeStems === 0}
                    className="w-full mb-3 py-2 bg-cyan-900/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500 hover:text-black rounded text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isRendering ? <span className="animate-pulse">RENDERING...</span> : <><i className="fas fa-compact-disc"></i> BOUNCE FULL SESSION</>}
                </button>
                
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {renders.length === 0 && <div className="text-[10px] text-gray-600 text-center py-2">NO RENDERS FOUND</div>}
                    {renders.map(r => (
                        <div key={r.id} className="flex justify-between items-center bg-gray-900 p-2 rounded border border-gray-800 group hover:border-cyan-500/30">
                            <div className="overflow-hidden">
                                <div className="text-[10px] text-white truncate w-32">{r.name}</div>
                                <div className="text-[9px] text-gray-500 font-mono">{r.hash.substring(0,8)}... • {(r.duration).toFixed(1)}s</div>
                            </div>
                            <button onClick={() => downloadRender(r)} className="text-cyan-500 hover:text-cyan-300 px-2">
                                <i className="fas fa-download"></i>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 pt-6 border-t border-gray-800 flex flex-col gap-3">
                 <div className="flex justify-between items-center px-1">
                     <span className="text-[9px] text-gray-600 font-mono">HAPA CARD BUNDLE v1</span>
                     <i className="fas fa-cube text-gray-600"></i>
                 </div>
                 <button onClick={onExport} className="w-full py-2 bg-gray-800 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 text-xs rounded transition flex items-center justify-center gap-2">
                     <i className="fas fa-file-export"></i> EXPORT CARD BUNDLE
                 </button>
                 <label className="w-full py-2 bg-gray-800 hover:bg-purple-900/50 text-purple-400 border border-purple-500/30 text-xs rounded transition text-center cursor-pointer flex items-center justify-center gap-2">
                     <i className="fas fa-file-import"></i> IMPORT CARD BUNDLE
                     <input type="file" accept=".zip" className="hidden" onChange={onImport} />
                 </label>
            </div>
        </div>
    </>
  );
};

export default TelemetryPanel;
