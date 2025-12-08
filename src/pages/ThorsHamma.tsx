import React, { useState, useEffect, useRef } from 'react';
import { useHand } from '../contexts/HandContext';
import ForgeResults from '../components/forge/ForgeResults';

// Types for the log entries
interface LogEntry {
  timestamp: string;
  source: 'SYS' | 'NET' | 'CAM' | 'LEO' | 'THOR' | 'ERR';
  message: string;
}

// Types for forge results
interface ForgeResult {
  setCard: any;
  childCards: any[];
  stats: { totalCards: number; totalSkills: number; totalSynergies: number };
  sourceUrl: string;
}

const ThorsHamma: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [_error, setError] = useState<string | null>(null);
  const [forgeResult, setForgeResult] = useState<ForgeResult | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  
  // Ref for auto-scrolling terminal
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Access to the Hand context
  const { cards } = useHand();

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (source: LogEntry['source'], message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source,
      message
    }]);
  };

  const handleStrike = async () => {
    if (!url) return;
    if (!url.startsWith('http')) {
      addLog('ERR', 'Invalid Target. Protocol required (http/https).');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setLogs([]); // Clear logs for new run
    setForgeResult(null); // Clear previous results
    setShowLogs(true); // Show terminal during processing
    
    addLog('SYS', `Targeting URL: ${url}`);
    addLog('SYS', `Hand Context Loaded: ${cards.length} Cards`);

    try {
      if (window.electronAPI?.processThorUrl) {
        addLog('NET', 'Initiating Uplink...');
        
        // This listener will be set up in the useEffect or via a more persistent connection
        // For now, we simulate the start
        await window.electronAPI.processThorUrl(url, cards);
      } else {
        throw new Error("Electron API not available");
      }
    } catch (err: any) {
      setError(err.message);
      addLog('ERR', err.message);
      setIsProcessing(false);
    }
  };

  // Listen for updates from backend via IPC
  useEffect(() => {
    if (!window.electronAPI?.onThorUpdate) return;
    
    const cleanup = window.electronAPI.onThorUpdate((data) => {
      const { type, payload } = data;
      if (type === 'log') {
        addLog(payload.source, payload.message);
      } else if (type === 'complete') {
        setIsProcessing(false);
        addLog('SYS', '✅ Sequence Complete. Artifacts Forged.');
        // Store the forge result for display
        if (payload && payload.setCard) {
          setForgeResult(payload);
          setShowLogs(false); // Collapse logs to show results
        }
      } else if (type === 'error') {
        setIsProcessing(false);
        setError(payload.message);
        addLog('ERR', payload.message);
      }
    });

    return cleanup;
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-cyan-500 font-mono overflow-hidden relative selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Background Grid & Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-gray-950 opacity-80 pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-cyan-900/30 bg-gray-900/50 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20 animate-pulse" />
            <rux-icon icon="bolt" size="large" className="text-cyan-400 relative z-10"></rux-icon>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-[0.2em] text-cyan-400 uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              Thor's Hamma
            </h1>
            <div className="text-xs text-cyan-600/80 tracking-widest uppercase mt-1">
              External Reality Forge // v1.0
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-cyan-700">
          <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-ping' : 'bg-cyan-900'}`} />
          {isProcessing ? 'SYSTEM BUSY' : 'SYSTEM READY'}
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col items-center p-8 relative z-10 overflow-y-auto ${forgeResult ? 'justify-start' : 'justify-center'}`}>
        
        {/* Input Section */}
        <div className="w-full max-w-4xl space-y-8">
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-gray-900 ring-1 ring-cyan-900/50 rounded-lg p-1 flex items-center shadow-2xl">
              <div className="pl-4 pr-2 text-cyan-600">
                <rux-icon icon="link" size="small"></rux-icon>
              </div>
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ENTER TARGET URL_PROTOCOL://"
                className="w-full bg-transparent border-none text-cyan-100 placeholder-cyan-800/50 focus:ring-0 text-xl font-bold py-4 tracking-wider"
                spellCheck={false}
                disabled={isProcessing}
              />
              <button 
                onClick={handleStrike}
                disabled={isProcessing || !url}
                className={`
                  px-8 py-4 rounded-md font-black tracking-widest text-lg uppercase transition-all duration-300
                  ${isProcessing 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-cyan-600 hover:bg-cyan-500 text-black shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]'
                  }
                `}
              >
                {isProcessing ? 'FORGING...' : 'STRIKE'}
              </button>
            </div>
          </div>

          {/* Forge Results (shown when complete) */}
          {forgeResult && !isProcessing && (
            <ForgeResults 
              result={forgeResult}
              onForgeAnother={() => {
                setForgeResult(null);
                setUrl('');
                setLogs([]);
                setShowLogs(true);
              }}
            />
          )}

          {/* Terminal Output (collapsible) */}
          <div className={`bg-black/80 rounded-lg border border-cyan-900/50 shadow-inner backdrop-blur-sm relative transition-all duration-300 ${
            forgeResult && !showLogs ? 'h-12 cursor-pointer' : 'h-64'
          }`}>
            {/* Terminal Header */}
            <div 
              className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 cursor-pointer"
              onClick={() => forgeResult && setShowLogs(!showLogs)}
            >
              <div className="flex items-center gap-2">
                {forgeResult && (
                  <span className={`text-cyan-600 text-xs transition-transform ${showLogs ? 'rotate-90' : ''}`}>▶</span>
                )}
                <span className="text-[10px] text-cyan-800 font-bold tracking-widest">TERMINAL_LOG</span>
              </div>
              <span className="text-[10px] text-cyan-700">{logs.length} entries</span>
            </div>
            
            {/* Terminal Content */}
            <div 
              ref={logContainerRef}
              className={`overflow-y-auto font-mono text-sm space-y-1 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent px-4 pb-4 pt-12 ${
                forgeResult && !showLogs ? 'hidden' : 'block h-[calc(100%-0.5rem)]'
              }`}
            >
              {logs.length === 0 && (
                <div className="h-full flex items-center justify-center text-cyan-900/40 italic">
                  Waiting for input sequence...
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 hover:bg-cyan-900/10 p-0.5 rounded">
                  <span className="text-cyan-700 select-none">[{log.timestamp}]</span>
                  <span className={`font-bold w-20 text-center select-none ${
                    log.source === 'ERR' ? 'text-red-500' : 
                    log.source === 'SYS' ? 'text-blue-400' :
                    log.source === 'THOR' ? 'text-amber-400' :
                    log.source === 'LEO' ? 'text-green-400' :
                    'text-cyan-400'
                  }`}>
                    {log.source === 'THOR' ? '🐱' : log.source === 'LEO' ? '🐕' : ''} [{log.source}]
                  </span>
                  <span className={`${log.source === 'ERR' ? 'text-red-400' : 'text-cyan-100/90'}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              {isProcessing && (
                <div className="animate-pulse text-cyan-500 mt-2">_</div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-cyan-900/20 text-center text-[10px] text-cyan-800 tracking-[0.3em]">
        HAPA AG // THOR PROTOCOL // SECURE CHANNEL
      </footer>
    </div>
  );
};

export default ThorsHamma;
