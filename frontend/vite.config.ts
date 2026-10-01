import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Nạp toàn bộ biến trong .env* (kể cả biến không có tiền tố VITE_) để dùng trong config.
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:5080'

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 5173,
      // Proxy /api sang backend. Nhờ nó, dev không cần bật CORS ở API,
      // và trình duyệt thấy FE và BE cùng origin nên cookie httpOnly gửi được bình thường.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  }
})
