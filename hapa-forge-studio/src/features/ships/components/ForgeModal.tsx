
import React, { useEffect, useRef, useState } from 'react';
import { ForgeConfig, ForgeRole, ForgeMagnitude, ForgeFocus } from '../types';

interface ForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForge: (config: ForgeConfig) => void;
  loading: boolean;
}

export const ForgeModal: React.FC<ForgeModalProps> = ({ isOpen, onClose, onForge, loading }) => {
  const [directive, setDirective] = useState('');
  const [role, setRole] = useState<ForgeRole>('INTERCEPTOR');
  const [magnitude, setMagnitude] = useState<ForgeMagnitude>('STANDARD');
  const [focus, setFocus] = useState<ForgeFocus>('MOBILITY');

  const directiveRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (loading) return;
    directiveRef.current?.focus();
  }, [isOpen, loading]);

  if (!isOpen) return null;

  const ROLES: { value: ForgeRole; label: string; icon: string }[] = [
    { value: 'SCOUT', label: 'Scout', icon: 'fa-eye' },
    { value: 'INTERCEPTOR', label: 'Interceptor', icon: 'fa-jet-fighter' },
    { value: 'FREIGHTER', label: 'Freighter', icon: 'fa-truck-ramp-box' },
    { value: 'DESTROYER', label: 'Destroyer', icon: 'fa-burst' },
    { value: 'EXPLORER', label: 'Explorer', icon: 'fa-compass' },
  ];

  const MAGNITUDES: { value: ForgeMagnitude; label: string; desc: string }[] = [
    { value: 'COMPACT', label: 'Compact', desc: 'Fast fabrication' },
    { value: 'STANDARD', label: 'Standard', desc: 'Balanced build' },
    { value: 'COLOSSAL', label: 'Colossal', desc: 'Heavy resources' },
  ];

  const FOCUSES: { value: ForgeFocus; label: string; icon: string }[] = [
    { value: 'MOBILITY', label: 'Speed', icon: 'fa-gauge-high' },
    { value: 'DEFENSE', label: 'Protection', icon: 'fa-shield-halved' },
    { value: 'ORDNANCE', label: 'Combat', icon: 'fa-gun' },
    { value: 'UTILITY', label: 'Logistics', icon: 'fa-gears' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl glass-panel p-8 relative shadow-[0_0_100px_rgba(14,165,233,0.15)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-orbitron text-sky-400 mb-1 flex items-center gap-3 uppercase tracking-tighter">
              <i className="fa-solid fa-microchip animate-pulse"></i>
              NEURAL FORGE CORE
            </h2>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-black">Strategic Fabrication Terminal</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-all">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-b-4 border-sky-500 rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-t-2 border-emerald-500 rounded-full animate-spin-reverse duration-500"></div>
              <i className="fa-solid fa-atom absolute inset-0 flex items-center justify-center text-sky-400 animate-pulse"></i>
            </div>
            <div className="font-orbitron text-sky-400 mb-2 tracking-widest text-lg">ASSEMBLING VOLUMETRIC GRID...</div>
            <p className="text-slate-500 text-xs italic uppercase tracking-widest animate-pulse">Consulting Gemini-3 Architectural Arrays</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Strategic Role */}
              <section>
                <label className="text-[10px] text-sky-600 uppercase tracking-widest font-black mb-3 block">Tactical Profile</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded border text-left transition-all group ${
                        role === r.value 
                          ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <i className={`fa-solid ${r.icon} text-xs ${role === r.value ? 'animate-bounce' : ''}`}></i>
                      <span className="text-[10px] uppercase font-bold tracking-wider">{r.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Magnitude */}
              <section>
                <label className="text-[10px] text-sky-600 uppercase tracking-widest font-black mb-3 block">Vessel Magnitude</label>
                <div className="flex gap-2">
                  {MAGNITUDES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMagnitude(m.value)}
                      className={`flex-1 px-2 py-3 rounded border text-center transition-all ${
                        magnitude === m.value 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-black tracking-tighter mb-0.5">{m.label}</div>
                      <div className="text-[8px] opacity-40 uppercase leading-none">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* System Focus */}
              <section>
                <label className="text-[10px] text-sky-600 uppercase tracking-widest font-black mb-3 block">System Focus</label>
                <div className="grid grid-cols-4 gap-2">
                  {FOCUSES.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFocus(f.value)}
                      title={f.label}
                      className={`aspect-square flex flex-col items-center justify-center rounded border transition-all ${
                        focus === f.value 
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-500'
                      }`}
                    >
                      <i className={`fa-solid ${f.icon} text-sm`}></i>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-col space-y-6">
              {/* Directive */}
              <section className="flex-1 flex flex-col">
                <label className="text-[10px] text-sky-600 uppercase tracking-widest font-black mb-3 block">Neural Directive</label>
                <textarea
                  ref={directiveRef}
                  value={directive}
                  onChange={(e) => setDirective(e.target.value)}
                  placeholder="e.g. Twin-hull design with integrated plasma stabilizers and dorsal gunner seat..."
                  className="flex-1 w-full bg-slate-900/80 border border-slate-800 rounded p-4 text-slate-200 outline-none focus:border-sky-500 transition-colors resize-none font-mono text-[11px] placeholder:text-slate-700 custom-scrollbar"
                />
              </section>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-slate-800/50">
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 border border-slate-700 text-slate-500 font-orbitron text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all font-black"
                >
                  ABORT
                </button>
                <button 
                  onClick={() => onForge({ directive: directive.trim(), role, magnitude, focus })}
                  className="flex-[2] py-4 bg-sky-600 hover:bg-sky-500 text-white font-orbitron text-[10px] uppercase tracking-[0.2em] px-8 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl shadow-sky-900/20 font-black"
                >
                  EXECUTE SEQUENCE
                </button>
              </div>
            </div>
          </div>
        )}
        
        <style>{`
          @keyframes spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          .animate-spin-reverse {
            animation: spin-reverse 2s linear infinite;
          }
        `}</style>
      </div>
    </div>
  );
};
