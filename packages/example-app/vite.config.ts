import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/pdfEditor/',
  build: {
    rollupOptions: {
      // Dos páginas: demo React (index) y demo del SDK en JavaScript puro (sdk.html)
      input: {
        main: resolve(__dirname, 'index.html'),
        sdk: resolve(__dirname, 'sdk.html'),
      },
    },
  },
})
