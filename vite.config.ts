import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Custom plugin to exclude Stencil lazy-loaded chunks from Vite processing
    {
      name: 'stencil-loader',
      enforce: 'pre',
      resolveId(id) {
        // Don't process Stencil's internal chunks
        if (id.includes('@astrouxds') && id.includes('.entry.js')) {
          return { id, external: true };
        }
      },
    },
  ],
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Pre-bundle the loader but exclude lazy-loaded components
    include: ['@astrouxds/astro-web-components/loader'],
    exclude: ['@astrouxds/astro-web-components'],
  },
  resolve: {
    alias: {
      '@astrouxds/astro-web-components': path.resolve(__dirname, 'node_modules/@astrouxds/astro-web-components'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Allow serving ALL of node_modules for Stencil lazy loading
      allow: ['.', 'node_modules'],
    },
  },
}))
