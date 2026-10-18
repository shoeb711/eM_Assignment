import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Any request starting with /api is forwarded to the Express API.
    // The browser sees one origin (localhost:5173), so login cookies work without CORS setup.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
