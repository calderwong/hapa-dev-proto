import { defineCustomElements } from '@astrouxds/astro-web-components/loader';
import '@astrouxds/astro-web-components/dist/astro-web-components/astro-web-components.css';

let astroInitialized = false;

export function setupAstro() {
  if (astroInitialized) return;
  if (typeof window === 'undefined') return;

  // Set the path for Astro icons
  (window as any).RUX_ICONS_PATH = '/icons/';

  defineCustomElements(window as any);
  astroInitialized = true;
}
