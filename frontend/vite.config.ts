import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // Default to localhost:8000 for local development
        // Set VITE_API_PROXY_TARGET=http://web:8000 when running in Docker
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
            // Log cookies being sent
            const cookies = req.headers.cookie;
            console.log('Cookies:', cookies ? cookies.substring(0, 100) + '...' : 'none');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/media': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      // NOTE: WebSocket connections (/ws/*) are NOT proxied through Vite.
      // They connect directly to the backend (ws://localhost:8000 in dev).
      // See src/utils/websocket.ts for the architecture decision and VITE_WS_URL config.
    },
  },
})
