import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발: /api·/t 요청을 프로덕션 Vercel 함수로 프록시 (CORS 회피)
    proxy: {
      '/api': {
        target: 'https://content-auto-delta.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      '/t': {
        target: 'https://content-auto-delta.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
