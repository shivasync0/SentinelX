import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin requests avoid requiring CORS changes to the independent API.
const proxy = { '/api': { target: 'http://localhost:8000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
