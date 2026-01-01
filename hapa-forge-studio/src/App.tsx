import React from 'react';
import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import SettingsPage from './pages/SettingsPage';

import CharacterStudioPage from './features/character/CharacterStudioPage';
import ShipStudioPage from './features/ships/ShipStudioPage';
import MediaStudioPage from './features/media/MediaStudioPage';
import LibraryPage from './features/library/LibraryPage';
import PortToHapaPage from './features/port/PortToHapaPage';

const NavLink: React.FC<{ to: string; label: string }> = ({ to, label }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={
        'px-3 py-2 rounded-md text-sm font-medium transition-colors ' +
        (active
          ? 'bg-white/10 text-white'
          : 'text-slate-300 hover:text-white hover:bg-white/5')
      }
    >
      {label}
    </Link>
  );
};

const TopNav: React.FC = () => {
  return (
    <header className="h-14 shrink-0 border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="h-full px-4 flex items-center gap-4">
        <Link to="/" className="font-orbitron text-sm tracking-wide text-white">
          Hapa Forge Studio
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/character" label="Character" />
          <NavLink to="/ship" label="Spaceship" />
          <NavLink to="/media" label="Media" />
          <NavLink to="/library" label="Library" />
          <NavLink to="/port" label="Port" />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NavLink to="/settings" label="Settings" />
        </div>
      </div>
    </header>
  );
};

export default function App() {
  return (
    <div className="h-full w-full flex flex-col">
      <TopNav />

      <div className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/character" element={<CharacterStudioPage />} />
          <Route path="/ship" element={<ShipStudioPage />} />
          <Route path="/media" element={<MediaStudioPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/port" element={<PortToHapaPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
