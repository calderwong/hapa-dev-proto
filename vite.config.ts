import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Include Stencil core dependencies but let the web components lazy-load
    include: ['@stencil/core'],
  },
  resolve: {
    alias: {
      // Help Vite resolve Stencil's lazy-loaded components
      '@astrouxds/astro-web-components': path.resolve(__dirname, 'node_modules/@astrouxds/astro-web-components'),
    },
  },
  server: {
    fs: {
      // Allow serving files from node_modules for Stencil lazy loading
      allow: ['.', 'node_modules/@astrouxds'],
    },
  },
}))
