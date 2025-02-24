import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Important: don't clear dist folder
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html')
      },
      output: {
        format: 'es',
        dir: 'dist',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})