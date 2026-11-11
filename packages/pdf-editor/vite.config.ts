import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

// Dependencias que no se empaquetan (incluye subrutas como react/jsx-runtime)
const external = [/^react($|\/)/, /^react-dom($|\/)/, /^@jmt-code\/pdf-creator($|\/)/, /^dompurify($|\/)/]

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'pdf-editor.js' : 'pdf-editor.cjs'),
    },
    rollupOptions: {
      external,
    }
  }
})
