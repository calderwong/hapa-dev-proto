
import React from 'react';

interface MetricsManualProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MetricsManual: React.FC<MetricsManualProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      category: "Structural & Logistics",
      entries: [
        {
          title: "Dry Mass (t)",
          desc: "The total weight of the ship's physical frame. IMPACT: Higher mass requires more powerful Fusion Thrusters to achieve orbital velocity. Excessive mass without adequate propulsion leads to sluggish rotational responsiveness.",
          icon: "fa-weight-hanging",
          color: "text-slate-400"
        },
        {
          title: "Module Complexity",
          desc: "The total count of integrated parts. IMPACT: High complexity vessels require advanced Neural Forge processing. Each part added increases the structural stress on the ship's core lattice.",
          icon: "fa-cubes",
          color: "text-sky-500"
        },
        {
          title: "Life Support (Crew)",
          desc: "The maximum biological capacity of the vessel. IMPACT: Determined by the number of Cockpits and Crew Quarters. A ship with zero crew capacity cannot be legally commissioned for deep-space flight.",
          icon: "fa-users",
          color: "text-cyan-400"
        }
      ]
    },
    {
      category: "Energy Management",
      entries: [
        {
          title: "Energy Stability (MW)",
          desc: "The critical ratio between Power Generation (Reactors) and Power Draw (Active Modules). IMPACT: If 'Reactor Load' exceeds 100%, the ship enters an Emergency Brownout state where Shields and Weapons are automatically depowered.",
          icon: "fa-bolt",
          color: "text-sky-400"
        }
      ]
    },
    {
      category: "Combat & Survival",
      entries: [
        {
          title: "Hull Integrity",
          desc: "The raw health of the ship's frame. IMPACT: Once Integrity reaches zero, catastrophic decompression occurs. Unlike Armor, Integrity can only be restored at an orbital dry-dock.",
          icon: "fa-shield-halved",
          color: "text-emerald-400"
        },
        {
          title: "Armor HP (Mitigation)",
          desc: "The sacrificial health layer provided by specialized defense modules. IMPACT: Armor absorbs 100% of incoming kinetic energy until depleted, protecting the more fragile internal components.",
          icon: "fa-user-shield",
          color: "text-indigo-400"
        },
        {
          title: "Plating Thickness (mm)",
          desc: "The physical depth of the alloy skin. IMPACT: High plating values provide a passive 'damage threshold' that ignores small-arms fire and micro-meteoroid impacts entirely.",
          icon: "fa-layer-group",
          color: "text-slate-500"
        },
        {
          title: "Defense Rating",
          desc: "A weighted tactical assessment of your ship's survivability. IMPACT: Scores above 25.0 are graded as 'Dreadnought Class'. A rating below 5.0 is considered 'Critical Hazard' for combat zones.",
          icon: "fa-shield-bolt",
          color: "text-amber-500"
        }
      ]
    },
    {
      category: "Economic Impact",
      entries: [
        {
          title: "Fabrication Budget",
          desc: "The total credits required to forge the vessel. IMPACT: Higher budgets reflect more advanced AI synthesis and premium materials. Use the 'Neural Forge' to generate cost-effective alternatives.",
          icon: "fa-credit-card",
          color: "text-amber-600"
        }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl glass-panel p-8 relative overflow-hidden max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(14,165,233,0.15)]">
        {/* Animated accent border */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-600 via-sky-400 to-sky-600 shadow-[0_0_20px_rgba(14,165,233,0.5)]"></div>
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h2 className="text-xl font-orbitron text-sky-400 flex items-center gap-3">
              <i className="fa-solid fa-book-journal-whills animate-pulse"></i>
              ARCHITECT'S TECHNICAL MANUAL
            </h2>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Operational Parameters & Safety Protocols</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-all hover:rotate-90 duration-300">
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-orbitron text-sky-600 font-black uppercase tracking-[0.3em] whitespace-nowrap">
                  {section.category}
                </span>
                <div className="h-[1px] w-full bg-sky-900/30"></div>
              </div>
              
              <div className="space-y-6 pl-2">
                {section.entries.map((entry, i) => (
                  <div key={i} className="flex gap-5 group">
                    <div className={`w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-sm bg-slate-900/80 border border-slate-800 ${entry.color} group-hover:border-sky-500/50 group-hover:bg-sky-500/5 transition-all duration-300 shadow-inner`}>
                      <i className={`fa-solid ${entry.icon} text-2xl`}></i>
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="font-orbitron text-xs text-slate-100 mb-1.5 uppercase tracking-widest font-bold flex items-center gap-2">
                        {entry.title}
                        <div className="w-1 h-1 bg-sky-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed font-medium">
                        {entry.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-sky-900/20 flex justify-between items-center">
          <div className="text-[9px] text-slate-600 font-mono uppercase">Reference ID: ARCH-MAN-V5</div>
          <button 
            onClick={onClose} 
            className="px-10 py-2.5 bg-sky-600/10 border border-sky-500/50 hover:bg-sky-600 hover:text-white text-sky-400 font-orbitron text-[10px] uppercase tracking-[0.2em] transition-all shadow-[0_0_15px_rgba(14,165,233,0.1)] font-black"
          >
            CONFIRM RECEIPT
          </button>
        </div>
      </div>
    </div>
  );
};
