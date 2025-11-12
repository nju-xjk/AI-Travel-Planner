import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        // 将 /api/* 代理到后端根路径，避免与前端路由冲突
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});