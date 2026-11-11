import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// Dependencias que no se empaquetan (incluye subrutas como react/jsx-runtime)
const external = [/^react($|\/)/, /^react-dom($|\/)/, /^@jmt-code\/pdf-creator($|\/)/, /^dompurify($|\/)/]

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/sdk-global.ts'],
      // Un .d.ts autocontenido por entrada (sin imports relativos sin extensión, que
      // `moduleResolution: node16` no acepta) + copia .d.cts para los consumidores CommonJS
      rollupTypes: true,
      afterBuild: () => {
        for (const name of ['pdf-editor', 'sdk']) {
          copyFileSync(resolve(__dirname, `dist/${name}.d.ts`), resolve(__dirname, `dist/${name}.d.cts`))
        }
      },
    })
  ],
  build: {
    lib: {
      // Componente React (+ utilidades) y SDK independiente del framework
      entry: {
        'pdf-editor': resolve(__dirname, 'src/index.ts'),
        sdk: resolve(__dirname, 'src/sdk.tsx'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external,
      output: {
        // Un único style.css para ambas entradas
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'style.css' : '[name][extname]'),
      },
    }
  }
})
