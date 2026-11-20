import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Stable third-party code goes into its own long-lived chunks (better caching, smaller app entry)
const vendorChunk = (id) => {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react'
  if (/node_modules\/(axios|socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser|@socket\.io|xmlhttprequest-ssl)\//.test(id)) return 'vendor-net'
  if (/node_modules\/(date-fns)\//.test(id)) return 'vendor-date'
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: vendorChunk } } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
