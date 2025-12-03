// Astro components are now loaded in index.html BEFORE this script runs
// See docs/TROUBLESHOOT_STENCIL_REACT.md for details
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Wait for Astro to be ready (set by index.html)
function waitForAstro(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).__ASTRO_READY__) {
      console.log('[main] Astro already ready');
      resolve();
      return;
    }
    
    const check = () => {
      if ((window as any).__ASTRO_READY__) {
        console.log('[main] Astro became ready');
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

async function init() {
  try {
    console.log('[main] Waiting for Astro...');
    await waitForAstro();
    console.log('[main] Rendering React');
    
    createRoot(document.getElementById('root')!).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err) {
    console.error('[main] Failed to initialize:', err);
  }
}

init();
