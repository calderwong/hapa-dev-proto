
import React from 'react';

interface DropDockOverlayProps {
    active: boolean;
    hasAudio: boolean;
    hasZip: boolean;
}

const DropDockOverlay: React.FC<DropDockOverlayProps> = ({ active, hasAudio, hasZip }) => {
    if (!active) return null;

    const baseClass = "flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all duration-300";
    const activeAudioClass = hasAudio ? "bg-cyan-900/40 border-cyan-400 text-cyan-400 scale-105 shadow-[0_0_50px_rgba(0,255,255,0.3)]" : "bg-black/40 border-gray-700 text-gray-600 opacity-50";
    const activeZipClass = hasZip ? "bg-purple-900/40 border-purple-400 text-purple-400 scale-105 shadow-[0_0_50px_rgba(180,0,255,0.3)]" : "bg-black/40 border-gray-700 text-gray-600 opacity-50";

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-12 flex gap-12 pointer-events-none animate-in fade-in duration-200">
            {/* AUDIO BAY */}
            <div className={`${baseClass} ${activeAudioClass}`}>
                <i className="fas fa-music text-6xl mb-4"></i>
                <h2 className="text-2xl font-black tracking-widest">AUDIO DOCK</h2>
                <div className="mt-2 text-xs font-mono opacity-80">WAV • MP3 • FLAC • OGG</div>
                {hasAudio && <div className="mt-4 px-4 py-1 bg-cyan-500 text-black text-xs font-bold rounded animate-pulse">DETECTED</div>}
            </div>

            {/* OR SEPARATOR */}
            <div className="flex flex-col justify-center items-center">
                <div className="h-full w-[1px] bg-gray-700"></div>
            </div>

            {/* ZIP BAY */}
            <div className={`${baseClass} ${activeZipClass}`}>
                <i className="fas fa-file-archive text-6xl mb-4"></i>
                <h2 className="text-2xl font-black tracking-widest">BUNDLE DOCK</h2>
                <div className="mt-2 text-xs font-mono opacity-80">SESSION • HAPA • LOOP PACK</div>
                {hasZip && <div className="mt-4 px-4 py-1 bg-purple-500 text-black text-xs font-bold rounded animate-pulse">DETECTED</div>}
            </div>
        </div>
    );
};

export default DropDockOverlay;
