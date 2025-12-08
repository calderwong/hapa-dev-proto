// @ts-nocheck
import React from 'react';

interface ModelProvenance {
  commonName: string;
  provider: string;
  modelAuthor: string;
  modelName: string;
  timestamp: string;
  requestId?: string;
}

interface CardData {
  chunk_id: string;
  truth_analysis: {
    facts: string[];
    desires: string[];
  };
  card_data: {
    name: string;
    lore: string;
    skills: Array<{
      name: string;
      description: string;
      type: 'Passive' | 'Active';
    }>;
    stats: {
      level: number;
      type: string;
    };
  };
  media_prompts: {
    base_image: string;
    video_loop: string;
    generated_image_local?: string;
  };
  provenance?: {
    thor: ModelProvenance;
    leo: ModelProvenance;
  };
}

interface CardDetailsProps {
  card: CardData;
  cardIndex: number;
  totalCards: number;
  onClose: () => void;
  pipelineStatus: string;
  pipelineProgress: number;
}

// Rarity based on card type
const getRarity = (type: string): { name: string; color: string; stars: number } => {
  const rarities: Record<string, { name: string; color: string; stars: number }> = {
    'Concept': { name: 'COMMON', color: 'text-gray-400', stars: 1 },
    'Entity': { name: 'UNCOMMON', color: 'text-green-400', stars: 2 },
    'Rule': { name: 'RARE', color: 'text-blue-400', stars: 3 },
    'Principle': { name: 'EPIC', color: 'text-purple-400', stars: 4 },
    'Law': { name: 'LEGENDARY', color: 'text-amber-400', stars: 5 },
  };
  return rarities[type] || rarities['Concept'];
};

// Stat bar component
const StatBar: React.FC<{ label: string; value: number; max?: number; color: string }> = ({ 
  label, value, max = 100, color 
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-400 font-mono">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-right text-gray-300 font-mono">{value}</span>
    </div>
  );
};

const CardDetails: React.FC<CardDetailsProps> = ({
  card,
  cardIndex,
  totalCards,
  onClose,
  pipelineStatus,
  pipelineProgress,
}) => {
  const [showLightbox, setShowLightbox] = React.useState(false);
  const [videoGenStatus, setVideoGenStatus] = React.useState<'idle' | 'generating' | 'complete' | 'error'>('idle');
  const [generatedVideoPath, setGeneratedVideoPath] = React.useState<string | null>(null);
  const [showReveal, setShowReveal] = React.useState(false);
  
  const rarity = getRarity(card.card_data.stats?.type || 'Concept');
  const hasImage = !!card.media_prompts?.generated_image_local;
  
  // Handle video generation for this card
  const handleGenerateVideo = async () => {
    if (!hasImage || !window.electronAPI?.createLoopVideoForImage) return;
    
    setVideoGenStatus('generating');
    try {
      const result = await window.electronAPI.createLoopVideoForImage({
        parentCardId: card.chunk_id,
        imageId: `${card.chunk_id}_img_0`,
        imagePath: card.media_prompts.generated_image_local,
        originalPrompt: card.media_prompts.base_image || card.media_prompts.video_loop || '',
        cardName: card.card_data.name,
        imageOrder: 0
      });
      
      setVideoGenStatus('complete');
      
      if (result && result.videoPath) {
        setGeneratedVideoPath(`file://${result.videoPath}`);
        setShowReveal(true);
        // Play reveal sound (placeholder)
        // new Audio('path/to/reveal.mp3').play().catch(() => {});
        
        // Hide reveal after animation
        setTimeout(() => setShowReveal(false), 3000);
      }
    } catch (err) {
      console.error('Video generation failed:', err);
      setVideoGenStatus('error');
    }
  };
  
  // Generate pseudo-random stats based on card name for visual interest
  const generateStat = (seed: string, base: number = 50) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 50) + base;
  };
  
  const stats = {
    power: generateStat(card.card_data.name + 'power', 40),
    wisdom: generateStat(card.card_data.name + 'wisdom', 30),
    speed: generateStat(card.card_data.name + 'speed', 35),
    magic: generateStat(card.card_data.name + 'magic', 45),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-500/30 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Holographic border effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-50 blur-sm animate-pulse" />
        
        <div className="relative bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="relative h-14 bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
            {/* Quality Bar */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 px-6 py-1 rounded-b-lg bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 border-x border-b border-gray-600`}>
              <span className={`text-xs font-bold tracking-widest ${rarity.color}`}>
                {'★'.repeat(rarity.stars)}{'☆'.repeat(5 - rarity.stars)} {rarity.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <rux-icon icon="auto-awesome" size="small" className="text-cyan-400"></rux-icon>
              <span className="text-sm font-mono text-gray-400">CARD #{cardIndex + 1} / {totalCards}</span>
            </div>
            
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row gap-6 p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
            {/* Left Column - Card Visual */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              {/* Card Image - Clickable for Lightbox */}
              <div 
                className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 ${hasImage ? 'cursor-pointer group' : ''}`}
                onClick={() => hasImage && setShowLightbox(true)}
                title={hasImage ? "Click to enlarge" : undefined}
              >
                {hasImage ? (
                  <>
                    <img 
                      src={`file://${card.media_prompts.generated_image_local}`}
                      alt={card.card_data.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Video Loop Overlay */}
                    {generatedVideoPath && (
                      <video 
                        src={generatedVideoPath}
                        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
                        muted 
                        loop 
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => e.currentTarget.pause()}
                      />
                    )}

                    {/* Hover overlay (hidden if video is playing/present to allow clear view) */}
                    {!generatedVideoPath && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-3 py-1 rounded-full text-xs text-white flex items-center gap-1">
                          <rux-icon icon="zoom-in" size="extra-small"></rux-icon>
                          Click to enlarge
                        </div>
                      </div>
                    )}

                    {/* Gacha Reveal Animation */}
                    {showReveal && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                         {/* Flash Effect */}
                         <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                         
                         {/* Unlock Text */}
                         <div className="relative text-center animate-bounce">
                           <rux-icon icon="movie" size="large" className="text-emerald-400 mb-2 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]"></rux-icon>
                           <h3 className="text-xl font-bold text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                             VIDEO UNLOCKED!
                           </h3>
                         </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4">
                    <div className="w-20 h-20 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                    <span className="text-sm font-mono text-cyan-400 animate-pulse">
                      Awaiting Visual...
                    </span>
                    <p className="text-xs text-gray-500 text-center line-clamp-3">
                      {card.media_prompts?.base_image?.substring(0, 100)}...
                    </p>
                  </div>
                )}
                
                {/* Card name overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <h2 className="text-xl font-bold text-white drop-shadow-lg">
                    {card.card_data.name}
                  </h2>
                  <span className={`text-xs font-mono ${rarity.color}`}>
                    {card.card_data.stats?.type || 'Concept'}
                  </span>
                </div>
              </div>

              {/* State Indicator */}
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Evolution State</div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${hasImage ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`} />
                  <span className="text-sm font-mono text-gray-300">
                    {hasImage ? 'ILLUSTRATED' : 'SORTED'}
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  <div className="flex-1 h-1 rounded-full bg-emerald-500" title="Blob Created" />
                  <div className="flex-1 h-1 rounded-full bg-emerald-500" title="Thor Sorted" />
                  <div className={`flex-1 h-1 rounded-full ${hasImage ? 'bg-emerald-500' : 'bg-gray-700'}`} title="Image Generated" />
                  <div className="flex-1 h-1 rounded-full bg-gray-700" title="Video Generated" />
                  <div className="flex-1 h-1 rounded-full bg-gray-700" title="Committed" />
                </div>
              </div>
              
              {/* Video Generation Button */}
              {hasImage && (
                <button
                  onClick={handleGenerateVideo}
                  disabled={videoGenStatus === 'generating'}
                  className={`w-full py-3 px-4 rounded-lg border flex items-center justify-center gap-2 text-sm font-mono transition-all
                    ${videoGenStatus === 'generating' 
                      ? 'bg-purple-900/30 border-purple-500/50 text-purple-300 cursor-wait'
                      : videoGenStatus === 'complete'
                        ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300'
                        : videoGenStatus === 'error'
                          ? 'bg-red-900/30 border-red-500/50 text-red-300'
                          : 'bg-cyan-900/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/40 hover:border-cyan-500/50'
                    }`}
                >
                  {videoGenStatus === 'generating' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      Generating Video Loop...
                    </>
                  ) : videoGenStatus === 'complete' ? (
                    <>
                      <rux-icon icon="check-circle" size="small"></rux-icon>
                      Video Generated!
                    </>
                  ) : videoGenStatus === 'error' ? (
                    <>
                      <rux-icon icon="error" size="small"></rux-icon>
                      Failed - Try Again
                    </>
                  ) : (
                    <>
                      <rux-icon icon="movie" size="small"></rux-icon>
                      Generate Video Loop
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="lg:w-2/3 flex flex-col gap-4">
              {/* Stats */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <rux-icon icon="bar-chart" size="extra-small"></rux-icon>
                  STATS
                </div>
                <div className="grid gap-2">
                  <StatBar label="POWER" value={stats.power} color="bg-red-500" />
                  <StatBar label="WISDOM" value={stats.wisdom} color="bg-blue-500" />
                  <StatBar label="SPEED" value={stats.speed} color="bg-green-500" />
                  <StatBar label="MAGIC" value={stats.magic} color="bg-purple-500" />
                </div>
              </div>

              {/* Skills */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <rux-icon icon="flash-on" size="extra-small"></rux-icon>
                  SKILLS
                </div>
                <div className="space-y-2">
                  {card.card_data.skills?.map((skill, i) => (
                    <div key={i} className="flex items-start gap-2 bg-gray-900/50 rounded p-2">
                      <span className={`text-lg ${skill.type === 'Active' ? '⚔️' : '🛡️'}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-cyan-300">{skill.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            skill.type === 'Active' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                          }`}>
                            {skill.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{skill.description}</p>
                      </div>
                    </div>
                  ))}
                  {(!card.card_data.skills || card.card_data.skills.length === 0) && (
                    <p className="text-xs text-gray-500 italic">No skills defined</p>
                  )}
                </div>
              </div>

              {/* Flavor Text / Lore */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <rux-icon icon="format-quote" size="extra-small"></rux-icon>
                  LORE
                </div>
                <p className="text-sm text-gray-300 italic leading-relaxed">
                  "{card.card_data.lore}"
                </p>
              </div>

              {/* Lineage & Heritage */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <rux-icon icon="account-tree" size="extra-small"></rux-icon>
                  LINEAGE & HERITAGE
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {card.provenance?.leo && (
                    <div className="flex items-start gap-2">
                      <span className="text-pink-400">LEO:</span>
                      <div className="text-gray-400">
                        {card.provenance.leo.commonName} ({card.provenance.leo.modelName})
                        <span className="text-gray-600"> via {card.provenance.leo.provider}</span>
                        <span className="text-gray-600"> by {card.provenance.leo.modelAuthor}</span>
                      </div>
                    </div>
                  )}
                  {card.provenance?.thor && (
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400">THOR:</span>
                      <div className="text-gray-400">
                        {card.provenance.thor.commonName} ({card.provenance.thor.modelName})
                        <span className="text-gray-600"> via {card.provenance.thor.provider}</span>
                        <span className="text-gray-600"> by {card.provenance.thor.modelAuthor}</span>
                      </div>
                    </div>
                  )}
                  {!card.provenance && (
                    <p className="text-gray-500 italic">Provenance data not available</p>
                  )}
                </div>
              </div>

              {/* Truth Analysis */}
              {card.truth_analysis && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <rux-icon icon="psychology" size="extra-small"></rux-icon>
                    TRUTH ANALYSIS
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-emerald-400 uppercase mb-1">Facts</div>
                      <ul className="space-y-1">
                        {card.truth_analysis.facts?.slice(0, 3).map((fact, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-emerald-500">•</span>
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-400 uppercase mb-1">Desires</div>
                      <ul className="space-y-1">
                        {card.truth_analysis.desires?.slice(0, 3).map((desire, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className="text-amber-500">•</span>
                            {desire}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Pipeline Status */}
          <div className="h-12 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-mono">PIPELINE:</span>
              <span className={`text-xs font-mono ${
                pipelineStatus === 'COMPLETE' ? 'text-emerald-400' : 'text-cyan-400 animate-pulse'
              }`}>
                {pipelineStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${pipelineProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 font-mono">{pipelineProgress}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Lightbox Modal */}
      {showLightbox && hasImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-zoom-out"
          onClick={() => setShowLightbox(false)}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
              className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors"
              title="Close lightbox"
              aria-label="Close lightbox"
            >
              <rux-icon icon="close" size="small"></rux-icon>
            </button>
          </div>
          <img 
            src={`file://${card.media_prompts.generated_image_local}`}
            alt={card.card_data.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full">
            <span className="text-white font-mono text-sm">{card.card_data.name}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDetails;
