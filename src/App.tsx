// import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { initFirebase } from './firebase';

import P2P from './pages/P2P';
import Admin from './pages/Admin';
import LocalLlama from './pages/LocalLlama';
import Archives from './pages/Archives';
import Revid from './pages/Revid';
import RevidMedia from './pages/RevidMedia';
import CardLibrary from './pages/CardLibrary';

import WormholeAstro from './pages/WormholeAstro';
import Wiki from './pages/Wiki';

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
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
          <Route path="archives" element={<Archives />} />
          <Route path="p2p" element={<P2P />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<Admin />} />
          <Route path="local-llama" element={<LocalLlama />} />
          <Route path="revid" element={<Revid />} />
          <Route path="revid-media" element={<RevidMedia />} />
          <Route path="cards" element={<CardLibrary />} />
          <Route path="wormhole" element={<WormholeAstro />} />
          <Route path="wiki" element={<Wiki />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
