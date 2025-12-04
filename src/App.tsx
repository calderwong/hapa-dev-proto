// import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { initFirebase } from './firebase';
// import { ToastProvider } from './context/ToastContext'; // Temporarily disabled - causes white screen

import P2P from './pages/P2P';
import Admin from './pages/Admin';
import LocalLlama from './pages/LocalLlama';
import LocalVision from './pages/LocalVision';
import Archives from './pages/Archives';
import Revid from './pages/Revid';
import RevidMedia from './pages/RevidMedia';
import CardLibrary from './pages/CardLibrary';
import Forge from './pages/Forge';

import WormholeAstro from './pages/WormholeAstro';
import Wiki from './pages/Wiki';
import Profile from './pages/Profile';
import Pets from './pages/Pets';

function App() {
  useEffect(() => {
    const init = async () => {
      if (window.electronAPI) {
        const settings = await window.electronAPI.getSettings();
        if (settings.firebaseConfig) {
          initFirebase(settings.firebaseConfig);
        }
      }
    };
    init();
  }, []);

  return (
    <>
      {/* Hidden Stencil warmup - forces lazy-loaded components to fully initialize */}
      <div style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }} aria-hidden="true">
        <rux-icon icon="check"></rux-icon>
        <rux-status status="normal"></rux-status>
      </div>
      
      <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
          <Route path="archives" element={<Archives />} />
          <Route path="p2p" element={<P2P />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<Admin />} />
          <Route path="local-llama" element={<LocalLlama />} />
          <Route path="local-vision" element={<LocalVision />} />
          <Route path="revid" element={<Revid />} />
          <Route path="revid-media" element={<RevidMedia />} />
          <Route path="cards" element={<CardLibrary />} />
          <Route path="forge" element={<Forge />} />
          <Route path="wormhole" element={<WormholeAstro />} />
          <Route path="wiki" element={<Wiki />} />
          <Route path="profile" element={<Profile />} />
          <Route path="pets" element={<Pets />} />
        </Route>
      </Routes>
    </Router>
    </>
  );
}

export default App;
