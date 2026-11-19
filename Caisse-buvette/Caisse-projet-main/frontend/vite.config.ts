import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port du backend Express (doit correspondre à backend/src/server.ts)
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    // Écoute sur le réseau local : la caisse peut être ouverte depuis une tablette
    host: true,
    port: 5173,
    // Toutes les requêtes /api/* sont relayées vers le backend :
    // le frontend utilise des URL relatives, plus besoin de CORS.
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
});
