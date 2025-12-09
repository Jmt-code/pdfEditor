import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PdfEditor',
      fileName: 'pdf-editor'
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'pdf-generator'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'pdf-generator': 'PdfGenerator'
        }
      }
    }
  }
})