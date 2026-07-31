import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발: `vercel dev`(3000)를 쓰거나, 파이썬 백엔드(uvicorn :8000)를 띄운 뒤 아래 프록시 사용
    proxy: {
      '/api': 'http://localhost:8000',
      '/t': 'http://localhost:8000',
    },
  },
})
