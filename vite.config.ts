import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Slib „vaše data neopustí prohlížeč" byl doteď jen tvrzením v textu.
 * Tohle z něj dělá pravidlo, které vynucuje prohlížeč.
 *
 * Klíčová je direktiva `connect-src 'none'`: zakáže veškerý odchozí provoz
 * (fetch, XHR, WebSocket, sendBeacon), takže ani omylem přidaná analytika
 * nebo závislost s telemetrií nic neodešle. Zbytek drží všechny zdroje u nás.
 *
 * `'unsafe-inline'` je jen u stylů, kvůli `style={{…}}` v Reactu. Skripty ho
 * nemají: produkční build je jeden externí modul bez inline kódu.
 *
 * Přidává se **jen do produkčního buildu**. Dev server si vkládá vlastní
 * inline skript (preamble pro Fast Refresh), který by `script-src 'self'`
 * zablokoval a HMR by tiše přestal fungovat.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  // frame-ancestors se v <meta> ignoruje, musela by ho poslat HTTP hlavička.
  // GitHub Pages hlavičky nastavit nedovolí, takže ho tu neuvádíme, ať
  // policy neslibuje ochranu, kterou nemá.
  "base-uri 'none'",
  "object-src 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'mamnato-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      )
    },
  }
}

// GitHub Pages hostuje projekt na /<repo>/ (zde /mamnato/), proto v produkčním
// buildu nastavíme base. Ve vývoji (dev server) zůstává kořen '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/mamnato/' : '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
}))
