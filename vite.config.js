import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // BUG 12: set base so assets resolve correctly when served from /Chat/ on GitHub Pages
  base: process.env.NODE_ENV === 'production' ? '/Chat/' : '/',
  build: {
    outDir: 'dist',
  }
})
