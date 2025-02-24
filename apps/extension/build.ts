// build.ts
import autoprefixer from 'autoprefixer'
import fs from 'fs-extra'
import { dirname, resolve } from 'path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { fileURLToPath } from 'url'
import { build } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function buildExtension() {
    // Clean dist folder first
    console.log('Cleaning dist folder...')
    await fs.remove('dist')
    await fs.ensureDir('dist')

    // Process CSS with Tailwind first
    console.log('Processing Tailwind CSS...')
    const cssContent = await fs.readFile('src/index.css', 'utf8')
    const result = await postcss([
        tailwindcss('./tailwind.config.js'),
        autoprefixer
    ]).process(cssContent, {
        from: 'src/index.css',
        to: 'dist/assets/popup.css'
    })

    // Make sure assets folder exists
    await fs.ensureDir('dist/assets')

    // Write processed CSS
    await fs.writeFile('dist/assets/popup.css', result.css)
    console.log('Tailwind CSS processed and saved')

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

    // Copy manifest
    console.log('Copying manifest...')
    await fs.copy(
        resolve(__dirname, 'public/manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
    )

    // Update popup.html to correctly reference the CSS
    console.log('Updating popup.html...')
    let popupHtml = await fs.readFile('dist/popup.html', 'utf8')
    if (!popupHtml.includes('href="./assets/popup.css"')) {
        popupHtml = popupHtml.replace(
            '</head>',
            '<link rel="stylesheet" href="./assets/popup.css"></head>'
        )
        await fs.writeFile('dist/popup.html', popupHtml)
    }

    console.log('Build complete!')
}

buildExtension().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})