import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/auth': 'http://127.0.0.1:3000',
      '/planner': 'http://127.0.0.1:3000',
      '/budget': 'http://127.0.0.1:3000',
      '/expenses': 'http://127.0.0.1:3000',
      '/settings': 'http://127.0.0.1:3000',
      '/metrics': 'http://127.0.0.1:3000',
      '/health': 'http://127.0.0.1:3000',
      '/speech': 'http://127.0.0.1:3000',
    },
  },
});