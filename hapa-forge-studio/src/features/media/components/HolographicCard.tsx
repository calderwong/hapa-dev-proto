import React from 'react';

interface Props {
  title: string;
  image?: string;
  type?: 'card' | 'module';
  active?: boolean;
}

const HolographicCard: React.FC<Props> = ({ title, image, type = 'card', active }) => {
  return (
    <div className={`
      relative group overflow-hidden rounded-lg border transition-all duration-300
      ${active 
        ? 'border-hapa-blue bg-hapa-blue/5 shadow-[0_0_20px_rgba(0,208,255,0.15)]' 
        : 'border-white/10 bg-black/40 hover:border-white/30'
      }
    `}>
      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] opacity-10 pointer-events-none" />
      
      {/* Content */}
      <div className="p-1 h-full flex flex-col">
        <div className="relative aspect-[3/4] overflow-hidden rounded border border-white/5 bg-gray-900">
          {image ? (
            <img 
              src={image} 
              alt={title} 
              className={`w-full h-full object-cover transition-transform duration-700 ${active ? 'scale-110' : 'group-hover:scale-105'}`} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <div className="w-12 h-12 rounded-full border border-white/10" />
            </div>
          )}
          
          {/* Holo Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {/* Active indicator */}
          {active && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-hapa-blue shadow-[0_0_10px_#00d0ff] animate-pulse" />
          )}
        </div>
        
        <div className="mt-2 px-1">
            <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-hapa-blue' : 'text-gray-400'}`}>
                {title}
                </h3>
                <span className="text-[9px] text-gray-600 font-mono">LV.01</span>
            </div>
        </div>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-white/30" />
      <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-white/30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-white/30" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-white/30" />
    </div>
  );
};

export default HolographicCard;