
import React, { useRef } from 'react';
import { Fleet, ShipData } from '../types';

interface FleetModalProps {
  isOpen: boolean;
  onClose: () => void;
  fleets: Fleet[];
  activeFleetId: string;
  activeShipId: string;
  onSwitchFleet: (id: string) => void;
  onSwitchShip: (id: string) => void;
  onCreateFleet: () => void;
  onCreateShip: () => void;
  onDeleteShip: (id: string) => void;
  onCloneShip: (id: string) => void;
  onExportFleet: () => void;
}

export const FleetModal: React.FC<FleetModalProps> = ({ 
  isOpen, onClose, fleets, activeFleetId, activeShipId, onSwitchFleet, onSwitchShip, onCreateFleet, onCreateShip, onDeleteShip, onCloneShip, onExportFleet 
}) => {
  if (!isOpen) return null;

  const activeFleet = fleets.find(f => f.id === activeFleetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-6xl glass-panel p-8 relative shadow-[0_0_100px_rgba(14,165,233,0.15)] h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>
        
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-orbitron text-sky-400 mb-1 flex items-center gap-3 uppercase tracking-tighter">
              <i className="fa-solid fa-layer-group animate-pulse"></i>
              Unified Fleet Command
            </h2>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-black">Multi-Fleet Manifest & Hangar Control</p>
          </div>
          <div className="flex gap-4">
             <button 
              onClick={onCreateFleet}
              className="px-4 py-2 border border-sky-500/30 text-sky-500 hover:bg-sky-500/10 transition-all font-orbitron text-[9px] uppercase tracking-widest rounded-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              New Fleet
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-all ml-4">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        <div className="flex flex-1 gap-8 overflow-hidden">
          {/* Fleet Sidebar */}
          <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Available Fleets</h3>
            {fleets.map(f => (
              <button 
                key={f.id}
                onClick={() => onSwitchFleet(f.id)}
                className={`w-full p-4 text-left border rounded transition-all flex flex-col ${
                  activeFleetId === f.id 
                    ? 'border-sky-500 bg-sky-500/10 text-sky-400' 
                    : 'border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-orbitron uppercase font-bold truncate">{f.name}</div>
                <div className="text-[8px] opacity-60 uppercase">{f.ships.length} Vessels {f.isLocked ? '(Protected)' : ''}</div>
              </button>
            ))}
          </div>

          {/* Ships Content */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex justify-between items-center bg-slate-900/40 p-3 border border-slate-800 rounded">
               <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Current Sector</span>
                  <span className="text-xs font-orbitron text-sky-400 uppercase">{activeFleet?.name}</span>
               </div>
               <div className="flex gap-2">
                  <button onClick={onExportFleet} className="px-4 py-2 bg-amber-600/10 border border-amber-500/30 text-amber-500 text-[9px] font-orbitron uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all">Export Manifest</button>
                  {!activeFleet?.isLocked && (
                    <button onClick={onCreateShip} className="px-4 py-2 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-orbitron uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">Commission Hull</button>
                  )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2 custom-scrollbar content-start">
              {activeFleet?.ships.map((ship) => (
                <div 
                  key={ship.id}
                  className={`glass-panel p-4 rounded-sm border transition-all flex flex-col group relative ${
                    activeShipId === ship.id 
                      ? 'border-sky-500 bg-sky-500/5 shadow-[0_0_30px_rgba(14,165,233,0.1)]' 
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="aspect-video bg-slate-900 mb-3 rounded-sm overflow-hidden border border-slate-800 flex items-center justify-center relative">
                    {ship.conceptImageUrl ? (
                      <img src={ship.conceptImageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={ship.name} />
                    ) : (
                      <i className="fa-solid fa-rocket text-3xl text-slate-700"></i>
                    )}
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-slate-950/80 text-[8px] text-slate-400 uppercase tracking-tighter flex justify-between z-10">
                      <span>UNITS: {ship.parts.length}</span>
                      <span>{new Date(ship.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sky-400 font-orbitron text-xs uppercase truncate font-bold flex-1">{ship.name}</h3>
                    {!activeFleet.isLocked && (
                      <button onClick={() => onCloneShip(ship.id)} className="text-slate-500 hover:text-sky-400 transition-colors ml-2"><i className="fa-solid fa-clone text-[10px]"></i></button>
                    )}
                  </div>
                  <p className="text-slate-500 text-[9px] mb-4 uppercase tracking-widest italic truncate">{ship.analysis?.role || "In Dry Dock"}</p>

                  <div className="mt-auto flex gap-2">
                    <button 
                      onClick={() => onSwitchShip(ship.id)}
                      disabled={activeShipId === ship.id}
                      className={`flex-1 py-2 text-[9px] font-orbitron font-black uppercase tracking-widest transition-all rounded-sm ${
                        activeShipId === ship.id 
                          ? 'bg-slate-800 text-slate-600 cursor-default' 
                          : 'bg-sky-600/10 border border-sky-500/50 text-sky-400 hover:bg-sky-500 hover:text-white'
                      }`}
                    >
                      Interface
                    </button>
                    {!activeFleet.isLocked && (
                      <button onClick={() => onDeleteShip(ship.id)} className="px-3 py-2 bg-red-600/10 border border-red-500/50 text-red-500 hover:bg-red-600 hover:text-white transition-all rounded-sm"><i className="fa-solid fa-trash-can text-xs"></i></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/50 flex justify-between items-center text-[10px] text-slate-600 uppercase font-black tracking-widest">
           AstraForge Multi-Fleet Protocol v2.5 // Sector Index Active
        </div>
      </div>
    </div>
  );
};
