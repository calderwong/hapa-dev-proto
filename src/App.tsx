// import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { initFirebase } from './firebase';

import P2P from './pages/P2P';

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
          <Route path="p2p" element={<P2P />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
