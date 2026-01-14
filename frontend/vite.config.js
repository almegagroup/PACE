import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:54321/functions/v1',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
