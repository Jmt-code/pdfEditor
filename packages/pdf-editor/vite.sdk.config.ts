import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Build autocontenido para <script>: incluye React, ReactDOM, DOMPurify y pdf-creator.
// Uso: <script src=".../pdf-editor.sdk.js"></script> → window.PdfEditorSDK.createEditor(el, opts)
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/sdk-global.ts'),
      name: 'PdfEditorSDK',
      formats: ['iife'],
      fileName: () => 'pdf-editor.sdk.js',
    },
    rollupOptions: {
      output: {
        // El CSS va inyectado en el JS (sdk-global.ts); el fichero extra no se usa
        assetFileNames: 'pdf-editor.sdk.[ext]',
      },
    },
  },
})
