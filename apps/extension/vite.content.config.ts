import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Important: don't clear dist folder
        lib: {
            entry: resolve(__dirname, 'src/content.ts'),
            formats: ['iife'],
            name: 'content',
            fileName: () => 'content.js'
        }
    }
})