// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CardDetails from '../components/CardDetails';
// Astro web components are loaded globally via setupAstro.ts
// Using rux-* elements directly as custom elements

interface ModelProvenance {
  commonName: string;
  provider: string;
  modelAuthor: string;
  modelName: string;
  timestamp: string;
  requestId?: string;
}

type CardState = 'blob' | 'sorted' | 'illustrated' | 'animated' | 'committed';

interface HellWeekCard {
  cardId: string;
  hypercoreKey?: string;
  state: CardState;
  blob: { text: string; chunkIndex: number; totalChunks: number };
  cardData?: any;
  truthAnalysis?: any;
  mediaPrompts?: any;
  provenance: {
    leo?: ModelProvenance;
    thor?: ModelProvenance;
    imageGen?: ModelProvenance;
  };
  quests: any[];
  evolutions: any[];
  createdAt: string;
  updatedAt: string;
}

interface PipelineState {
  status: 'IDLE' | 'LEO_ANALYSIS' | 'LEO_REVIEW' | 'THOR_CHUNKING' | 'THOR_PROCESSING' | 'THOR_MEDIA_PENDING' | 'THOR_MEDIA_GENERATING' | 'THOR_REVIEW' | 'CONVICTION_FINALIZING' | 'COMPLETE';
  currentStep: string;
  progress: number;
  logs: string[];
  leoOutput: any | null;
  chunks: string[];
  cards: any[];
  collectionKey?: string;
  leoProvenance?: ModelProvenance;
  thorModel: 'fast-llm' | 'smart-llm';
  // Card-centric architecture
  runId?: string;
  hellWeekCards?: HellWeekCard[];
  // Card Set (created on completion)
  createdSetId?: string;
  createdSetName?: string;
}

interface PipelineSettings {
  thorModel: 'fast-llm' | 'smart-llm';
  thorThrottleMs: number;
  mediaThrottleMs: number;
}

// Pipeline phase definitions for clearer UX
type PipelinePhase = 'idle' | 'leo' | 'thor-cards' | 'thor-media' | 'conviction' | 'complete';

const getPhaseFromStatus = (status: PipelineState['status']): PipelinePhase => {
  if (status === 'IDLE') return 'idle';
  if (['LEO_ANALYSIS', 'LEO_REVIEW'].includes(status)) return 'leo';
  if (['THOR_CHUNKING', 'THOR_PROCESSING'].includes(status)) return 'thor-cards';
  if (['THOR_MEDIA_PENDING', 'THOR_MEDIA_GENERATING', 'THOR_REVIEW'].includes(status)) return 'thor-media';
  if (status === 'CONVICTION_FINALIZING') return 'conviction';
  if (status === 'COMPLETE') return 'complete';
  return 'idle';
};

const phaseOrder: PipelinePhase[] = ['idle', 'leo', 'thor-cards', 'thor-media', 'conviction', 'complete'];

const Pipeline: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<PipelineState>({
    status: 'IDLE',
    currentStep: 'Waiting for Artifact',
    progress: 0,
    logs: [],
    leoOutput: null,
    chunks: [],
    cards: [],
    thorModel: 'fast-llm',
  });

  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [thorModel, setThorModel] = useState<'fast-llm' | 'smart-llm'>('fast-llm');
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  useEffect(() => {
    if (window.electronAPI?.onPipelineUpdate) {
      window.electronAPI.onPipelineUpdate((updatedState: PipelineState) => {
        setState(updatedState);
      });
    }
    
    // Load pipeline settings on mount
    const loadSettings = async () => {
      if (window.electronAPI?.getPipelineSettings) {
        const settings = await window.electronAPI.getPipelineSettings();
        setThorModel(settings.thorModel || 'fast-llm');
      }
    };
    loadSettings();
  }, []);

  // Handle Thor model toggle
  const handleThorModelChange = async (model: 'fast-llm' | 'smart-llm') => {
    setThorModel(model);
    if (window.electronAPI?.setThorModel) {
      await window.electronAPI.setThorModel(model);
    }
  };

  // Actual function to start the pipeline
  const handleStartPipeline = async (file: File) => {
    console.log("Starting pipeline with file:", file.name);
    
    try {
      // In Electron, file.path is available when dragging from native file explorer
      const anyFile = file as any;
      const filePath = anyFile && typeof anyFile.path === 'string' && anyFile.path.length > 0
        ? anyFile.path
        : null;
      
      if (filePath && window.electronAPI?.pipelineStart) {
         console.log("Starting pipeline with path:", filePath);
         await window.electronAPI.pipelineStart(filePath);
      } else if (window.electronAPI?.pipelineStartWithContent) {
         // Fallback: read file content and send it directly
         console.log("No file path available, reading content directly...");
         const content = await file.text();
         await window.electronAPI.pipelineStartWithContent(file.name, content);
      } else if (window.electronAPI?.pipelineStart) {
         // Last resort: try using the file name as a relative path hint
         console.error("Cannot start pipeline: file.path not available. Try using File > Open or drag from a local folder.");
         setState(prev => ({
           ...prev,
           logs: [...prev.logs, `Error: Could not get file path. Electron security may be blocking access. Try File > Open dialog instead.`]
         }));
      } else {
         console.error("Cannot start pipeline: API not available");
      }
    } catch (err) {
      console.error("Failed to start pipeline:", err);
    }
  };

  const handleAdvance = async () => {
      if (window.electronAPI?.pipelineAdvance) {
          await window.electronAPI.pipelineAdvance();
      }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleStartPipeline(e.dataTransfer.files[0]);
    }
  };

  // Compute current phase for visual indicator
  const currentPhase = useMemo(() => getPhaseFromStatus(state.status), [state.status]);
  const phaseIndex = phaseOrder.indexOf(currentPhase);
  
  // Stats for Thor phase
  const thorStats = useMemo(() => {
    const withImages = state.cards.filter(c => c.media_prompts?.generated_image_local).length;
    const total = state.cards.length;
    return { withImages, withoutImages: total - withImages, total };
  }, [state.cards]);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white overflow-hidden relative">
      {/* Header with Phase Indicator */}
      <header className="flex-shrink-0 border-b border-gray-700 bg-gray-800/50">
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <rux-icon icon="satellite-3" size="medium" className="text-astro-primary"></rux-icon>
            <div>
              <h1 className="text-lg font-bold tracking-wider">HELL WEEK PIPELINE</h1>
              <div className="text-xs text-gray-400 font-mono">
                {state.currentStep}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <rux-button icon="bug-report" size="small" secondary onClick={() => setIsDebugOpen(!isDebugOpen)}>
               {isDebugOpen ? 'Hide Logs' : 'Show Logs'}
             </rux-button>
          </div>
        </div>
        
        {/* Visual Phase Progress Bar */}
        <div className="h-12 px-6 flex items-center gap-2 bg-gray-900/50 border-t border-gray-800">
          {/* Phase 1: LEO */}
          <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            currentPhase === 'leo' ? 'border-pink-500 bg-pink-500/10 shadow-[0_0_10px_rgba(236,72,153,0.3)]' :
            phaseIndex > 1 ? 'border-pink-800 bg-pink-900/20 text-pink-300' : 'border-gray-700 text-gray-500'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              phaseIndex > 1 ? 'bg-pink-500 text-white' : currentPhase === 'leo' ? 'bg-pink-500/30 border border-pink-500 text-pink-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {phaseIndex > 1 ? '✓' : '1'}
            </div>
            <span className="text-xs font-mono font-bold">LEO</span>
            <span className="text-[10px] text-gray-500 hidden lg:inline">Context</span>
          </div>
          
          <rux-icon icon="arrow-right" size="extra-small" className="text-gray-600"></rux-icon>
          
          {/* Phase 2: THOR Cards */}
          <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            currentPhase === 'thor-cards' ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.3)]' :
            phaseIndex > 2 ? 'border-cyan-800 bg-cyan-900/20 text-cyan-300' : 'border-gray-700 text-gray-500'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              phaseIndex > 2 ? 'bg-cyan-500 text-white' : currentPhase === 'thor-cards' ? 'bg-cyan-500/30 border border-cyan-500 text-cyan-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {phaseIndex > 2 ? '✓' : '2'}
            </div>
            <span className="text-xs font-mono font-bold">THOR</span>
            <span className="text-[10px] text-gray-500 hidden lg:inline">Cards</span>
          </div>
          
          <rux-icon icon="arrow-right" size="extra-small" className="text-gray-600"></rux-icon>
          
          {/* Phase 3: THOR Media */}
          <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            currentPhase === 'thor-media' ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.3)]' :
            phaseIndex > 3 ? 'border-purple-800 bg-purple-900/20 text-purple-300' : 'border-gray-700 text-gray-500'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              phaseIndex > 3 ? 'bg-purple-500 text-white' : currentPhase === 'thor-media' ? 'bg-purple-500/30 border border-purple-500 text-purple-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {phaseIndex > 3 ? '✓' : '3'}
            </div>
            <span className="text-xs font-mono font-bold">MEDIA</span>
            <span className="text-[10px] text-gray-500 hidden lg:inline">Images</span>
          </div>
          
          <rux-icon icon="arrow-right" size="extra-small" className="text-gray-600"></rux-icon>
          
          {/* Phase 4: CONVICTION */}
          <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            ['conviction', 'complete'].includes(currentPhase) ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-gray-700 text-gray-500'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              currentPhase === 'complete' ? 'bg-amber-500 text-white' : currentPhase === 'conviction' ? 'bg-amber-500/30 border border-amber-500 text-amber-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {currentPhase === 'complete' ? '✓' : '4'}
            </div>
            <span className="text-xs font-mono font-bold">MINT</span>
            <span className="text-[10px] text-gray-500 hidden lg:inline">Vault</span>
          </div>
        </div>
      </header>

      {/* Main Content - Three Tracks */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6" onDragEnter={handleDrag}>
          
          {/* Drag Overlay */}
          {dragActive && (
            <div 
              className="absolute inset-0 z-50 bg-astro-primary/20 backdrop-blur-sm border-4 border-dashed border-astro-primary flex items-center justify-center"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="text-center animate-bounce">
                <rux-icon icon="cloud-upload" size="large" className="text-white mb-4 block mx-auto"></rux-icon>
                <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-lg">DROP ARTIFACT TO INGEST</h2>
              </div>
            </div>
          )}

          {/* LEO TRACK */}
          <div className={`flex-1 flex flex-col border border-gray-700 rounded-lg bg-gray-800/30 overflow-hidden transition-all duration-500 ${['LEO_ANALYSIS', 'LEO_REVIEW'].includes(state.status) ? 'ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'opacity-60'}`}>
             <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2 text-pink-400 font-bold font-mono">
                   <rux-icon icon="visibility" size="small"></rux-icon>
                   LEO (Love)
                </div>
                {['LEO_ANALYSIS', 'LEO_REVIEW'].includes(state.status) && <rux-status status="standby" className="animate-pulse"></rux-status>}
             </div>
             <div className="flex-1 p-4 relative">
                {state.status === 'IDLE' && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                        <rux-icon icon="library-books" size="large" className="opacity-20"></rux-icon>
                        <p className="text-sm font-mono">Waiting for artifact...</p>
                    </div>
                )}
                {state.status === 'LEO_ANALYSIS' && (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <div className="w-24 h-24 rounded-full border-4 border-pink-500/30 border-t-pink-500 animate-spin"></div>
                        <p className="font-mono text-pink-300 animate-pulse">Reading & Contextualizing...</p>
                    </div>
                )}
                {/* Placeholder for Result */}
                {state.leoOutput && (
                    <div className="h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto text-xs font-mono p-2 bg-black/50 rounded border border-gray-700 text-green-400 mb-2">
                            <pre>{JSON.stringify(state.leoOutput, null, 2)}</pre>
                        </div>
                        {state.status === 'LEO_REVIEW' && (
                            <div className="flex justify-center pt-2 border-t border-gray-700/50">
                                <rux-button icon="check" onClick={handleAdvance}>Approve Context</rux-button>
                            </div>
                        )}
                    </div>
                )}
             </div>
          </div>

          {/* THOR TRACK */}
          <div className={`flex-1 flex flex-col border border-gray-700 rounded-lg bg-gray-800/30 overflow-hidden transition-all duration-500 ${state.status.startsWith('THOR') ? 'ring-2 ring-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'opacity-60'}`}>
             <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono">
                   <rux-icon icon="build" size="small"></rux-icon>
                   THOR (Truth)
                </div>
                <div className="flex items-center gap-2">
                   {/* Thor Model Toggle */}
                   <div className="flex items-center gap-1 bg-gray-900/50 rounded px-2 py-0.5 border border-gray-700">
                      <button
                        onClick={() => handleThorModelChange('fast-llm')}
                        disabled={state.status !== 'IDLE' && state.status !== 'LEO_REVIEW'}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                          thorModel === 'fast-llm' 
                            ? 'bg-cyan-600 text-white' 
                            : 'text-gray-400 hover:text-cyan-300'
                        } ${state.status !== 'IDLE' && state.status !== 'LEO_REVIEW' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Fast LLM (Gemini 2.5 Flash)"
                      >
                        ⚡ Fast
                      </button>
                      <button
                        onClick={() => handleThorModelChange('smart-llm')}
                        disabled={state.status !== 'IDLE' && state.status !== 'LEO_REVIEW'}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                          thorModel === 'smart-llm' 
                            ? 'bg-cyan-600 text-white' 
                            : 'text-gray-400 hover:text-cyan-300'
                        } ${state.status !== 'IDLE' && state.status !== 'LEO_REVIEW' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Smart LLM (Gemini 2.5 Pro)"
                      >
                        🧠 Smart
                      </button>
                   </div>
                   {state.status.startsWith('THOR') && <rux-status status="standby" className="animate-pulse"></rux-status>}
                </div>
             </div>
             <div className="flex-1 p-4 overflow-hidden flex flex-col">
                {/* Thor Content */}
                 {!state.status.startsWith('THOR') && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                        <rux-icon icon="gavel" size="large" className="opacity-20"></rux-icon>
                        <p className="text-sm font-mono">Awaiting Context...</p>
                    </div>
                 )}
                 
                 {state.status === 'THOR_CHUNKING' && (
                     <div className="h-full flex flex-col items-center justify-center gap-4">
                         <div className="w-24 h-24 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin"></div>
                         <p className="font-mono text-cyan-300 animate-pulse">Shattering Artifact into Chunks...</p>
                         <div className="text-xs font-mono text-gray-400">
                            {state.chunks.length > 0 ? `${state.chunks.length} Chunks Created` : 'Analyzing Structure...'}
                         </div>
                     </div>
                 )}

                 {['THOR_PROCESSING', 'THOR_MEDIA_PENDING', 'THOR_MEDIA_GENERATING', 'THOR_REVIEW'].includes(state.status) && (
                     <div className="flex-1 flex flex-col overflow-hidden">
                         <div className="flex items-center justify-between mb-2">
                             <span className="text-xs font-mono text-cyan-400">
                                 {state.status === 'THOR_MEDIA_GENERATING' 
                                   ? `GENERATING IMAGES: ${state.cards.filter(c => c.media_prompts?.generated_image_local).length} / ${state.cards.length}`
                                   : state.status === 'THOR_REVIEW'
                                     ? `READY TO MINT: ${state.cards.length} cards`
                                     : `PROCESSED: ${state.cards.length} / ${state.chunks.length}`
                                 }
                             </span>
                             <rux-progress value={state.progress}></rux-progress>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                             {state.cards.map((card, idx) => (
                                 <div 
                                   key={idx} 
                                   onClick={() => setSelectedCard({ card, index: idx })}
                                   className="bg-gray-900/80 border border-cyan-900/50 p-3 rounded hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all cursor-pointer group relative"
                                 >
                                     {/* "Ready to Peruse" indicator for newly created cards */}
                                     <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" title="Click to view details" />
                                     
                                     <div className="flex justify-between items-start">
                                         <h3 className="text-cyan-300 font-bold text-sm group-hover:text-cyan-200 transition-colors">{card.card_data.name}</h3>
                                         <span className="text-[10px] font-mono bg-cyan-900/50 px-1 rounded text-cyan-200">{card.card_data.stats?.type || 'Concept'}</span>
                                     </div>
                                     <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">{card.card_data.lore}</p>
                                     
                                     {/* Show generated image if available */}
                                     {card.media_prompts?.generated_image_local && (
                                         <div className="mt-2 rounded overflow-hidden border border-cyan-800/50">
                                             <img 
                                                 src={`file://${card.media_prompts.generated_image_local}`} 
                                                 alt={card.card_data.name}
                                                 className="w-full h-24 object-cover"
                                             />
                                         </div>
                                     )}
                                     
                                     {/* Show prompt if no image yet */}
                                     {!card.media_prompts?.generated_image_local && (
                                         <div className="mt-2 pt-2 border-t border-gray-800 flex gap-2">
                                             <div className="flex-1 bg-black/30 p-1 rounded border border-gray-800">
                                                 <div className="text-[9px] text-gray-500 uppercase mb-0.5">Visual Prompt</div>
                                                 <p className="text-[10px] text-gray-300 line-clamp-2">{card.media_prompts?.base_image}</p>
                                             </div>
                                         </div>
                                     )}
                                     
                                     {/* Hover hint */}
                                     <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded pointer-events-none">
                                       <span className="text-xs font-mono text-cyan-300 bg-gray-900/90 px-2 py-1 rounded">Click to Peruse</span>
                                     </div>
                                 </div>
                             ))}
                             {state.status === 'THOR_PROCESSING' && (
                                 <div className="animate-pulse flex justify-center p-4">
                                     <span className="text-cyan-500 text-xs font-mono">Forging next card...</span>
                                 </div>
                             )}
                             {state.status === 'THOR_MEDIA_GENERATING' && (
                                 <div className="animate-pulse flex justify-center p-4">
                                     <span className="text-cyan-500 text-xs font-mono">Generating images...</span>
                                 </div>
                             )}
                         </div>

                         {state.status === 'THOR_MEDIA_PENDING' && (
                            <div className="pt-4 border-t border-gray-700/50">
                                {/* Phase complete banner */}
                                <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-700/50 rounded-lg text-center">
                                    <div className="flex items-center justify-center gap-2 text-cyan-400 font-bold mb-1">
                                        <rux-icon icon="check-circle" size="small"></rux-icon>
                                        Card Forging Complete!
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {thorStats.total} cards created from {state.chunks.length} chunks
                                    </p>
                                </div>
                                
                                {/* Next step explanation */}
                                <div className="mb-3 text-center">
                                    <p className="text-xs text-gray-300">
                                        <span className="text-purple-400 font-bold">Next:</span> Generate artwork for each card using AI
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        This may take a few minutes depending on card count
                                    </p>
                                </div>
                                
                                <div className="flex justify-center gap-2">
                                    <rux-button 
                                        icon="auto-fix-high" 
                                        onClick={handleAdvance}
                                        className="animate-pulse"
                                    >
                                        🎨 Generate Card Artwork
                                    </rux-button>
                                </div>
                                
                                {/* Skip option */}
                                <div className="mt-3 text-center">
                                    <button 
                                        onClick={() => window.electronAPI?.pipelineSkipMedia?.()}
                                        className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                                    >
                                        Skip artwork & proceed to minting
                                    </button>
                                </div>
                            </div>
                         )}
                         
                         {state.status === 'THOR_REVIEW' && (
                            <div className="pt-4 border-t border-gray-700/50">
                                {/* Media generation complete banner */}
                                <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg text-center">
                                    <div className="flex items-center justify-center gap-2 text-purple-400 font-bold mb-1">
                                        <rux-icon icon="check-circle" size="small"></rux-icon>
                                        Artwork Generation Complete!
                                    </div>
                                    <div className="flex justify-center gap-4 text-xs mt-2">
                                        <span className="text-green-400">✓ {thorStats.withImages} with art</span>
                                        {thorStats.withoutImages > 0 && (
                                            <span className="text-amber-400">⚠ {thorStats.withoutImages} without art</span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Handle failed images */}
                                {thorStats.withoutImages > 0 && (
                                    <div className="mb-4 p-2 bg-amber-900/20 border border-amber-800/50 rounded text-center">
                                        <p className="text-xs text-amber-300 mb-2">Some cards failed image generation</p>
                                        <div className="flex gap-2 justify-center">
                                            <rux-button 
                                                size="small" 
                                                secondary
                                                icon="refresh"
                                                onClick={() => window.electronAPI?.pipelineRetryFailed?.()}
                                            >
                                                Retry Failed
                                            </rux-button>
                                            <rux-button 
                                                size="small"
                                                secondary
                                                icon="skip-next"
                                                onClick={() => window.electronAPI?.pipelineSkipFailed?.()}
                                            >
                                                Continue Without
                                            </rux-button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Next step: Conviction */}
                                <div className="mb-3 text-center">
                                    <p className="text-xs text-gray-300">
                                        <span className="text-amber-400 font-bold">Final Step:</span> Mint cards to your permanent Hypercore vault
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        Cards will be stored permanently and visible in Card Library
                                    </p>
                                </div>
                                
                                <div className="flex justify-center">
                                    <rux-button 
                                        icon="verified-user" 
                                        onClick={handleAdvance}
                                        className="animate-pulse"
                                    >
                                        🏛️ Mint {state.cards.length} Cards to Vault
                                    </rux-button>
                                </div>
                            </div>
                         )}
                     </div>
                 )}
             </div>
          </div>

          {/* CONVICTION TRACK */}
          <div className={`flex-1 flex flex-col border border-gray-700 rounded-lg bg-gray-800/30 overflow-hidden transition-all duration-500 ${state.status === 'CONVICTION_FINALIZING' || state.status === 'COMPLETE' ? 'ring-2 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'opacity-60'}`}>
             <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold font-mono">
                   <rux-icon icon="verified-user" size="small"></rux-icon>
                   CONVICTION (Do)
                </div>
                {state.status === 'CONVICTION_FINALIZING' && <rux-status status="standby" className="animate-pulse"></rux-status>}
                {state.status === 'COMPLETE' && <rux-status status="normal"></rux-status>}
             </div>
             <div className="flex-1 p-4 flex flex-col">
                 {/* Awaiting state */}
                 {!['CONVICTION_FINALIZING', 'COMPLETE'].includes(state.status) && (
                     <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                        <rux-icon icon="storage" size="large" className="opacity-20"></rux-icon>
                        <p className="text-sm font-mono">Awaiting Construction...</p>
                    </div>
                 )}
                 
                 {/* Finalizing state */}
                 {state.status === 'CONVICTION_FINALIZING' && (
                     <div className="h-full flex flex-col items-center justify-center gap-4">
                         <div className="w-24 h-24 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin"></div>
                         <p className="font-mono text-amber-300 animate-pulse">Minting to Hypercore...</p>
                         <div className="text-xs font-mono text-gray-400">
                            Writing {state.cards.length} cards to permanent storage
                         </div>
                         <rux-progress value={state.progress}></rux-progress>
                     </div>
                 )}
                 
                 {/* Complete state */}
                 {state.status === 'COMPLETE' && (
                     <div className="h-full flex flex-col items-center justify-center gap-4">
                         <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                             <rux-icon icon="check" size="large" className="text-white"></rux-icon>
                         </div>
                         <h2 className="text-2xl font-bold text-amber-400">VAULTED</h2>
                         
                         {/* Card Set info */}
                         {state.createdSetName && (
                             <div className="text-center">
                                 <div className="text-[10px] text-amber-500 uppercase mb-1">Card Set Created</div>
                                 <div className="text-lg font-bold text-white">"{state.createdSetName}"</div>
                             </div>
                         )}
                         
                         <p className="text-sm text-gray-400 text-center">
                             {state.cards.length} cards minted successfully
                         </p>
                         
                         {state.collectionKey && (
                             <div className="mt-4 w-full bg-black/50 border border-amber-900/50 rounded p-3">
                                 <div className="text-[10px] text-amber-500 uppercase mb-1 font-bold">Collection Discovery Key</div>
                                 <code className="text-xs text-amber-200 break-all font-mono">
                                     {state.collectionKey}
                                 </code>
                             </div>
                         )}
                         
                         <div className="mt-4 flex gap-2">
                             <rux-button 
                                 icon="visibility" 
                                 secondary 
                                 onClick={() => navigate(state.createdSetId ? `/cards?setId=${state.createdSetId}` : '/cards')}
                             >
                                 View Set in Library
                             </rux-button>
                             <rux-button icon="refresh" onClick={() => window.location.reload()}>
                                 New Run
                             </rux-button>
                         </div>
                     </div>
                 )}
             </div>
          </div>

      </div>

      {/* Debug Drawer */}
      <div className={`absolute right-0 top-16 bottom-0 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl transition-transform duration-300 transform ${isDebugOpen ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="h-full flex flex-col">
            <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-4 font-mono text-xs font-bold text-gray-400">
               SYSTEM LOGS
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-2">
               {state.logs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-gray-300">
                     <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
                     <span>{log}</span>
                  </div>
               ))}
               {state.logs.length === 0 && <span className="text-gray-600 italic">No logs yet...</span>}
            </div>
         </div>
      </div>

      {/* Card Details Modal */}
      {selectedCard && (
        <CardDetails
          card={selectedCard.card}
          cardIndex={selectedCard.index}
          totalCards={state.cards.length}
          onClose={() => setSelectedCard(null)}
          pipelineStatus={state.status}
          pipelineProgress={state.progress}
        />
      )}
    </div>
  );
};

export default Pipeline;
