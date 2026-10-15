import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep hooks and the renderer on exactly the same React module. This prevents
  // a duplicate React runtime from being introduced by dependency pre-bundling
  // or an HMR refresh, which otherwise makes hooks fail with a null dispatcher.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // sockjs-client references the Node.js global object, which doesn't exist in the
  // browser. Vite doesn't polyfill it by default, so we alias it to globalThis here.
  define: {
    global: 'globalThis',
  },
  server: {
    // Allow other devices on the same LAN to open the development server.
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'http://localhost:8080',
        ws: true
      },
      '/uploads': 'http://localhost:8080'
    }
  }
})

