
import React, { useState, useMemo } from 'react';
import { Part, ShipStats, PartType } from '../types';
import { AVAILABLE_PARTS } from '../constants';
import { getMarketIntelligence } from '../services/marketService';

interface SidebarProps {
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  stats: ShipStats;
}

const CATEGORIES: { label: string, types: PartType[], icon: string }[] = [
  { label: 'Tactical', types: ['WEAPON'], icon: 'fa-crosshairs' },
  { label: 'Propulsion', types: ['ENGINE', 'REACTOR'], icon: 'fa-shuttle-space' },
  { label: 'Systems', types: ['COCKPIT', 'COMM'], icon: 'fa-satellite-dish' },
  { label: 'Living', types: ['QUARTERS', 'CARGO'], icon: 'fa-bed' },
  { label: 'Defense', types: ['HULL'], icon: 'fa-shield-halved' }
];

export const ShipSidebar: React.FC<SidebarProps> = ({ selectedPartId, onSelectPart, stats }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [marketInfo, setMarketInfo] = useState<{text: string, links: any[]} | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  
  const selectedPart = useMemo(() => 
    AVAILABLE_PARTS.find(p => p.id === selectedPartId) || null
  , [selectedPartId]);

  const filteredParts = AVAILABLE_PARTS.filter(p => CATEGORIES[activeTab].types.includes(p.type));

  const fetchMarket = async () => {
    if (!selectedPart) return;
    setLoadingMarket(true);
    try {
      const info = await getMarketIntelligence(selectedPart.name);
      setMarketInfo(info);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMarket(false);
    }
  };

  const powerBalance = stats.totalPowerGen - stats.totalPowerDraw;
  const powerPercentage = Math.min(100, Math.max(0, (stats.totalPowerDraw / (stats.totalPowerGen || 1)) * 100));

  return (
    <div className="w-80 h-full glass-panel border-r flex flex-col pointer-events-auto">
      <div className="p-4 border-b border-sky-900/50">
        <h2 className="text-sky-400 font-orbitron text-sm tracking-widest uppercase mb-4">Fabrication Lab</h2>
        <div className="flex gap-1 mb-4 border-b border-slate-800 pb-2 overflow-x-auto">
          {CATEGORIES.map((cat, i) => (
            <button key={i} onClick={() => { setActiveTab(i); setMarketInfo(null); }} className={`px-3 py-1.5 rounded text-[9px] uppercase font-bold flex flex-col items-center flex-1 transition-all ${activeTab === i ? 'text-sky-400 border-b-2 border-sky-500 bg-sky-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
              <i className={`fa-solid ${cat.icon} mb-1`}></i>{cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {filteredParts.map(part => (
            <button key={part.id} onClick={() => { onSelectPart(part.id); setMarketInfo(null); }} className={`aspect-square flex flex-col items-center justify-center rounded border transition-all ${selectedPartId === part.id ? 'bg-sky-500/20 border-sky-400 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              <i className={`${part.icon} text-lg mb-1`} style={{ color: part.color }}></i>
              <span className="text-[9px] truncate w-full text-center px-1 font-bold">{part.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {selectedPart && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="text-sky-400 text-xs uppercase tracking-wider mb-2 font-bold flex items-center justify-between">
              <span>Module Specs</span>
              <button onClick={fetchMarket} className="text-[9px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded border border-sky-500/30 hover:bg-sky-500 hover:text-white transition-all">
                {loadingMarket ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-globe mr-1"></i>MARKET INTEL</>}
              </button>
            </h3>
            <div className="bg-sky-500/5 border border-sky-500/20 rounded p-3 mb-4">
              <div className="flex items-center gap-3 mb-3 pb-2 border-b border-sky-500/10">
                <i className={`${selectedPart.icon} text-xl`} style={{ color: selectedPart.color }}></i>
                <div>
                  <div className="text-xs font-orbitron font-bold text-white uppercase">{selectedPart.name}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-tighter">Dim: {selectedPart.size[0]}x{selectedPart.size[1]}x{selectedPart.size[2]} Units</div>
                </div>
              </div>
              {marketInfo && (
                <div className="mb-4 p-2 bg-slate-900 border border-sky-500/20 text-[10px] text-slate-300 leading-relaxed rounded animate-in fade-in">
                  <div className="text-sky-400 font-bold mb-1 uppercase text-[8px]"><i className="fa-solid fa-satellite mr-1"></i>Market Analysis:</div>
                  {marketInfo.text}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {marketInfo.links.map((l, i) => <a key={i} href={l.uri} target="_blank" className="text-sky-500 underline text-[8px] truncate max-w-full">{l.title}</a>)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <PartStat label="Cost" value={`$${selectedPart.cost.toLocaleString()}`} color="text-amber-400" />
                <PartStat label="Mass" value={`${selectedPart.mass}t`} />
                <PartStat label="Output" value={selectedPart.powerGen > 0 ? `+${selectedPart.powerGen}MW` : `${selectedPart.powerDraw}MW`} color={selectedPart.powerGen > 0 ? "text-emerald-400" : "text-red-400"} />
                <PartStat label="Defense" value={selectedPart.armorValue} />
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-bold flex items-center gap-2"><i className="fa-solid fa-satellite-dish"></i>Live Telemetry</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 uppercase text-[9px]">Reactor Load</span>
                <span className={powerBalance < 0 ? 'text-red-400' : 'text-emerald-400'}>{powerPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-700 ${powerBalance < 0 ? 'bg-red-500' : 'bg-sky-400'}`} style={{ width: `${powerPercentage}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="Total Mass" value={`${stats.totalMass}t`} icon="fa-weight-hanging" />
              <StatBox label="Ship Integrity" value={stats.totalIntegrity} icon="fa-shield-halved" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PartStat = ({ label, value, color = "text-slate-200" }: { label: string, value: any, color?: string }) => (
  <div className="flex flex-col">
    <span className="text-[8px] text-slate-500 uppercase font-black leading-none mb-1">{label}</span>
    <span className={`text-[10px] font-orbitron font-medium leading-none ${color}`}>{value}</span>
  </div>
);

const StatBox = ({ label, value, icon }: { label: string, value: any, icon: string }) => (
  <div className="bg-slate-900/80 border border-slate-800 p-2 rounded hover:border-sky-900 transition-colors">
    <div className="flex items-center gap-2 mb-0.5"><i className={`fa-solid ${icon} text-[9px] text-sky-400`}></i><span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">{label}</span></div>
    <div className="text-[11px] font-orbitron text-slate-100">{value}</div>
  </div>
);
