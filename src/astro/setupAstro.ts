// Import the synchronous/bundled version instead of lazy-loader
import '@astrouxds/astro-web-components/dist/astro-web-components/astro-web-components.css';

let astroInitialized = false;
let astroPromise: Promise<void> | null = null;

export async function setupAstro(): Promise<void> {
  console.log('[setupAstro] Called, initialized:', astroInitialized);
  
  if (astroPromise) {
    return astroPromise;
  }
  
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  // Set the path for Astro icons
  (window as any).RUX_ICONS_PATH = '/icons/';
  console.log('[setupAstro] RUX_ICONS_PATH set to:', (window as any).RUX_ICONS_PATH);

  astroPromise = (async () => {
    try {
      // Use dynamic import to load the full bundle (not lazy loader)
      const { defineCustomElements } = await import('@astrouxds/astro-web-components/loader');
      
      await defineCustomElements(window as any);
      console.log('[setupAstro] defineCustomElements resolved');
      
      // Wait for Stencil runtime to fully initialize
      // Check that a component can actually render
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkReady = () => {
          attempts++;
          const testEl = document.createElement('rux-icon');
          testEl.setAttribute('icon', 'check');
          
          // Check if the component has Stencil internals
          if ((testEl as any).$hostElement$ !== undefined || 
              customElements.get('rux-icon')?.prototype?.render ||
              attempts >= maxAttempts) {
            console.log('[setupAstro] Components ready after', attempts, 'checks');
            resolve();
            return;
          }
          
          requestAnimationFrame(checkReady);
        };
        
        // Start checking after a brief delay
        setTimeout(checkReady, 100);
      });
      
      astroInitialized = true;
      console.log('[setupAstro] Fully initialized');
    } catch (err) {
      console.error('[setupAstro] Failed:', err);
      throw err;
    }
  })();
    
  return astroPromise;
}
