import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  server: { proxy: { '/api/marketing': 'http://127.0.0.1:3001', '/api/whatsapp': 'http://127.0.0.1:3001' } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
