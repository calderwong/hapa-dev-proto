import React from 'react';
import HolographicCard from './HolographicCard';

const BackgroundGrid: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] grid grid-cols-6 gap-4 p-10 transform -rotate-6 scale-110">
            {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className={`transform transition-all duration-1000 ${Math.random() > 0.7 ? 'translate-y-4' : 'translate-y-0'}`}>
                    <HolographicCard 
                        title={`MODULE_${i}`} 
                        image={`https://picsum.photos/300/400?random=${i}`} 
                        active={false}
                    />
                </div>
            ))}
        </div>
        
        {/* Vignette */}
        <div className="absolute inset-0 bg-radial-gradient-vignette" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05060a] via-transparent to-[#05060a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05060a] via-transparent to-[#05060a]" />
    </div>
  );
};

export default BackgroundGrid;