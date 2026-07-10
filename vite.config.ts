import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages hostuje projekt na /<repo>/ (zde /mamnato/), proto v produkčním
// buildu nastavíme base. Ve vývoji (dev server) zůstává kořen '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mamnato/' : '/',
  plugins: [react(), tailwindcss()],
}))
