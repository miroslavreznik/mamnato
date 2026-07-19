import { defineConfig, devices } from '@playwright/test'

// V tomto kontejneru je Chromium předinstalovaný; lokálně stačí spustit s
//   PW_CHROMIUM=/opt/pw-browsers/chromium npm run test:e2e
// V CI se prohlížeč doinstaluje přes `npx playwright install`.
const executablePath = process.env.PW_CHROMIUM || undefined

const PORT = 4173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // ať se to neplete s vitest testy (*.test.ts)
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: {
      // Testy běží proti localhostu, žádná proxy není potřeba.
      args: ['--no-proxy-server'],
      ...(executablePath ? { executablePath } : {}),
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
