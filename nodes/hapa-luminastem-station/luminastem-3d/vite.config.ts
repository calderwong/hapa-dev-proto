import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const lladaTarget = env.HAPA_LLADA_NODE_URL || 'http://127.0.0.1:8085';
  const lladaTokenEnv = env.HAPA_LLADA_NODE_TOKEN || process.env.HAPA_LLADA_NODE_TOKEN;

  let lladaToken = lladaTokenEnv;
  if (!lladaToken) {
    try {
      const tokenPath = path.resolve(__dirname, '../../hapa-llada-node/.node_token');
      if (existsSync(tokenPath)) {
        lladaToken = readFileSync(tokenPath, 'utf8').trim();
      }
    } catch (e) {
      // ignore
    }
  }

  const luminastemTarget = env.HAPA_LUMINASTEM_NODE_URL || 'http://127.0.0.1:8732';
  const luminastemTokenEnv = env.HAPA_LUMINASTEM_NODE_TOKEN || process.env.HAPA_LUMINASTEM_NODE_TOKEN;

  let luminastemToken = luminastemTokenEnv;
  if (!luminastemToken) {
    try {
      const tokenPath = path.resolve(__dirname, '../.node_token');
      if (existsSync(tokenPath)) {
        luminastemToken = readFileSync(tokenPath, 'utf8').trim();
      }
    } catch (e) {}
  }

  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
      proxy: {
        '/__hapa/llada': {
          target: lladaTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/__hapa\/llada/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (lladaToken) {
                proxyReq.setHeader('authorization', `Bearer ${lladaToken}`);
              }
            });
          },
        },
        '/__hapa/luminastem': {
          target: luminastemTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/__hapa\/luminastem/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (luminastemToken) {
                proxyReq.setHeader('authorization', `Bearer ${luminastemToken}`);
              }
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
