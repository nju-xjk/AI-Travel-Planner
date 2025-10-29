import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/planner': 'http://localhost:3000',
      '/budget': 'http://localhost:3000',
      '/expenses': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/speech': 'http://localhost:3000',
    },
  },
});