import { defineCustomElements } from '@astrouxds/astro-web-components/loader';
import '@astrouxds/astro-web-components/dist/astro-web-components/astro-web-components.css';

let astroInitialized = false;

export function setupAstro() {
  console.log('[setupAstro] Called, initialized:', astroInitialized);
  if (astroInitialized) return;
  if (typeof window === 'undefined') return;

  // Set the path for Astro icons
  (window as any).RUX_ICONS_PATH = '/icons/';
  console.log('[setupAstro] RUX_ICONS_PATH set to:', (window as any).RUX_ICONS_PATH);

  defineCustomElements(window as any);
  console.log('[setupAstro] defineCustomElements called');
  astroInitialized = true;
}
