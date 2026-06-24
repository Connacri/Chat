import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Set base to './' so that built assets resolve correctly relative to index.html,
  // working perfectly on both Capacitor (Android/iOS) and subdirectory deployment (GitHub Pages)
  base: './',
  build: {
    outDir: 'dist',
  }
})
