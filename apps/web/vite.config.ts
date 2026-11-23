import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development, /api is proxied to the Fastify server so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy: { '/api': 'http://localhost:8787' } },
});
