// build.ts
import fs from 'fs-extra'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function buildExtension() {
    // Clean dist folder first
    console.log('Cleaning dist folder...')
    await fs.remove('dist')
    await fs.ensureDir('dist')

    // Build in sequence
    console.log('Building popup...')
    await build({
        configFile: resolve(__dirname, 'vite.popup.config.ts'),
        mode: 'production'
    })

    console.log('Building background script...')
    await build({
        configFile: resolve(__dirname, 'vite.background.config.ts'),
        mode: 'production'
    })

    console.log('Building content script...')
    await build({
        configFile: resolve(__dirname, 'vite.content.config.ts'),
        mode: 'production'
    })

    // Copy manifest and other assets
    console.log('Copying manifest...')
    await fs.copy(
        resolve(__dirname, 'public/manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
    )

    console.log('Build complete!')
}

buildExtension().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})