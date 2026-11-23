import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development, /api is proxied to the Fastify server so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  // Set VITE_ALLOW_TUNNEL=1 to open the dev server through an HTTPS tunnel (ngrok, cloudflared) for phone and Telegram tests.
  server: { port: 5173, host: true, allowedHosts: process.env.VITE_ALLOW_TUNNEL === '1' ? true : undefined, proxy: { '/api': 'http://localhost:8787' } },
});
