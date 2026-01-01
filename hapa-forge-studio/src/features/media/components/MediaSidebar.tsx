import React from 'react';
import { 
  CloudLightning, 
  BookOpen, 
  Share2, 
  Database, 
  Video, 
  Settings, 
  ShieldAlert,
  Ghost,
  Cpu,
  Eye,
  Activity
} from 'lucide-react';
import { NavItem } from '../types';

const navItems: NavItem[] = [
  { id: 'wormhole', label: 'Wormhole', icon: <CloudLightning size={20} /> },
  { id: 'wiki', label: 'Wiki', icon: <BookOpen size={20} /> },
  { id: 'diagrams', label: 'Diagrams', icon: <Share2 size={20} /> },
  { id: 'archive', label: 'Archives', icon: <Database size={20} /> },
  { id: 'llama', label: 'Local Llama', icon: <Cpu size={20} /> },
  { id: 'vision', label: 'Local Vision', icon: <Eye size={20} /> },
  { id: 'revid', label: 'Revid (Veo)', icon: <Video size={20} />, active: true },
  { id: 'p2p', label: 'P2P Network', icon: <Activity size={20} /> },
];

const bottomItems: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  { id: 'admin', label: 'Admin', icon: <ShieldAlert size={20} /> },
  { id: 'sanctuary', label: 'Sanctuary', icon: <Ghost size={20} /> },
];

export const MediaSidebar: React.FC = () => {
  return (
    <div className="w-64 h-full bg-[#0a0b14] border-r border-[#1f2937] flex flex-col glass-panel z-20 flex-shrink-0">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 bg-black/20">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-hapa-blue to-hapa-purple flex items-center justify-center mr-3 animate-pulse-slow">
          <Cpu className="text-white" size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wider text-white">HAPA AI</h1>
          <p className="text-[10px] text-hapa-blue tracking-widest uppercase opacity-70">OPD TERMINAL</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.id}>
              <button 
                className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                  ${item.active 
                    ? 'bg-hapa-blue/10 text-hapa-blue shadow-[0_0_15px_rgba(0,208,255,0.1)] border border-hapa-blue/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <span className={`mr-3 ${item.active ? 'text-hapa-blue' : 'text-gray-500 group-hover:text-gray-300'}`}>
                  {item.icon}
                </span>
                {item.label}
                {item.active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-hapa-blue shadow-[0_0_5px_#00d0ff]" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Nav */}
      <div className="p-3 border-t border-gray-800">
         <ul className="space-y-1">
          {bottomItems.map((item) => (
            <li key={item.id}>
               <button className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <span className="mr-3 text-gray-500 group-hover:text-gray-300">
                  {item.icon}
                </span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 px-3">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
             <div className="h-full bg-gradient-to-r from-hapa-purple to-hapa-blue w-[75%]" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
            <span>RAM</span>
            <span>75%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaSidebar;