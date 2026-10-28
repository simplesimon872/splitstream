import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// base './' makes the build work from any path (GitHub Pages project sites, IPFS, a CDN folder).
export default defineConfig({
  base: './',
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
})
