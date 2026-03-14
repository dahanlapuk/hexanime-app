import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@capacitor-community/zip']
  },
  build: {
    rollupOptions: {
      external: ['@capacitor-community/zip']
    }
  }
})
