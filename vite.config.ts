import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // --- ANTHROPIC CORS PROXY ---
          '/anthropic-proxy': {
            target: 'https://api.anthropic.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/anthropic-proxy/, ''),
            headers: { 
              'anthropic-version': '2023-06-01' 
            },
          },
          // --- SCITELY CORS PROXY ---
          '/scitely-proxy': {
            target: 'https://api.scitely.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/scitely-proxy/, ''),
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.error('[Proxy Error] Scitely:', err);
              });
            },
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});