// This is a standalone script to create icons
// Run with Node.js: node create-icons.js

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, 'public', 'icons');

// Create basic SVG icon content
const createIconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${size / 8}" fill="#4F46E5"/>
  <path d="M${size / 4} ${size / 2} L${size / 2} ${3 * size / 4} L${3 * size / 4} ${size / 4}" stroke="white" stroke-width="${size / 16}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// Ensure directory exists
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
  console.log(`Created directory: ${ICONS_DIR}`);
}

// Create icons of different sizes
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const iconPath = path.join(ICONS_DIR, `icon${size}.svg`);
  writeFileSync(iconPath, createIconSVG(size));
  console.log(`Created icon: ${iconPath}`);
});

console.log('All icons created successfully!');