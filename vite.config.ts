import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        desktopAuth: resolve(import.meta.dirname, 'desktop-auth.html'),
        desktopAuthV2: resolve(import.meta.dirname, 'desktop-auth-v2.html'),
      },
    },
  },
});
