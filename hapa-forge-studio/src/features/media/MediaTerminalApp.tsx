import React from 'react';
import MediaSidebar from './components/MediaSidebar';
import VeoTerminal from './components/VeoTerminal';
import BackgroundGrid from './components/BackgroundGrid';

const App: React.FC = () => {
  return (
    <div className="flex h-screen w-screen bg-[#05060a] text-white overflow-hidden relative font-sans selection:bg-hapa-blue selection:text-black">
      
      {/* Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-hapa-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-hapa-purple/5 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Decorative Background Grid of "Cards" */}
      <BackgroundGrid />

      {/* Main Layout */}
      <div className="relative z-10 flex w-full h-full backdrop-blur-[2px]">
        <MediaSidebar />
        
        {/* Content Area */}
        <main className="flex-1 flex flex-col relative">
            {/* Top Bar for "cards" look */}
            <div className="h-16 flex items-center px-6 gap-4 border-b border-white/5 bg-black/20">
                <div className="w-32 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center">
                    <div className="w-16 h-1 bg-gradient-to-r from-green-500 to-transparent rounded" />
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-10 h-10 rounded border border-white/10 bg-cover bg-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer" style={{backgroundImage: `url(https://picsum.photos/50/50?random=${i+100})`}} />
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-4 text-xs font-mono text-gray-500">
                    <span>NET.ONLINE</span>
                    <span>BIT.IDLE</span>
                    <span>STP.NOMINAL</span>
                </div>
            </div>

            <VeoTerminal />
        </main>
      </div>

      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_3px,3px_100%] bg-size-[100%_3px,3px_100%]" />
    </div>
  );
};

export default App;