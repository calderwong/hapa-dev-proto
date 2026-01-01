
import React from 'react';
import { AIAnalysis } from '../types';

interface AIModalProps {
  analysis: AIAnalysis | null;
  loading: boolean;
  onClose: () => void;
}

export const AIModal: React.FC<AIModalProps> = ({ analysis, loading, onClose }) => {
  if (!analysis && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl glass-panel p-8 relative overflow-hidden">
        {/* Animated accent border */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-500 animate-gradient-x"></div>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
            <div className="font-orbitron text-sky-400 animate-pulse">SYNCHRONIZING WITH GEMINI AI...</div>
            <p className="text-slate-500 text-xs">Simulating neural pathways and design efficiency...</p>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-sky-400 font-orbitron text-2xl">{analysis.role}</h2>
                <div className="text-emerald-500 font-orbitron text-sm">DESIGN SCORE: {analysis.efficiencyScore}/100</div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">Analysis Completed</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-800 italic text-slate-300 leading-relaxed text-sm">
              "{analysis.lore}"
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-emerald-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-plus-circle"></i> Strengths
                </h4>
                <ul className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-red-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-minus-circle"></i> Weaknesses
                </h4>
                <ul className="space-y-2">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-orbitron text-xs transition-all"
              >
                CLOSE TERMINAL
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
