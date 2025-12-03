import { defineCustomElements } from '@astrouxds/astro-web-components/loader';
import '@astrouxds/astro-web-components/dist/astro-web-components/astro-web-components.css';

let astroInitialized = false;
let astroPromise: Promise<void> | null = null;

export function setupAstro(): Promise<void> {
  console.log('[setupAstro] Called, initialized:', astroInitialized);
  
  if (astroPromise) {
    return astroPromise;
  }
  
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  // Set the path for Astro icons - must be before defineCustomElements
  (window as any).RUX_ICONS_PATH = '/icons/';
  console.log('[setupAstro] RUX_ICONS_PATH set to:', (window as any).RUX_ICONS_PATH);

  // Define the custom elements and return the promise
  astroPromise = defineCustomElements(window as any)
    .then(() => {
      console.log('[setupAstro] defineCustomElements resolved successfully');
      astroInitialized = true;
    })
    .catch((err: unknown) => {
      console.error('[setupAstro] defineCustomElements failed:', err);
      throw err;
    });
    
  return astroPromise;
}
