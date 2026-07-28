import { test, expect, type Page } from '@playwright/test'

/**
 * Vizuální porovnání pro redesign.
 *
 * Neběží s ostatními testy: bez `VISUAL=1` se přeskočí. Slouží k tomu, aby
 * šlo o změně vzhledu říct něco přesnějšího než „vypadá to stejně".
 *
 *   # otisk současného stavu (jednou, před zásahem)
 *   VISUAL=1 … npx playwright test --project=chromium visual --update-snapshots
 *
 *   # po zásahu: co se změnilo a o kolik pixelů
 *   VISUAL=1 … npx playwright test --project=chromium visual
 *
 * Plné znění příkazu i s obejitím proxy je v CLAUDE.md.
 *
 * Otisky se nekomitují (jsou v .gitignore). Vykreslení se liší podle sestavení
 * prohlížeče, takže otisk z tohohle kontejneru by v CI hlásil rozdíly, které
 * nikdo neudělal. Je to nástroj pro jedno sezení, ne test v CI.
 *
 * Práh je nula rozdílných pixelů. Ověřeno, že to jde, ale chce to dvě věci:
 * vypnout CSS animace a počkat, až dojedou grafy. Recharts animuje z
 * JavaScriptu, ne CSS, takže `animation: none` na něj nestačí a snímek
 * pořízený moc brzy se lišil i sám se sebou (u sloupcového grafu o dvacet
 * pět tisíc pixelů). Výchozí animace Rechartu trvá 1500 ms, čeká se déle.
 */

// Kolik počkat, než graf dojede. Recharts má výchozí animaci 1500 ms.
const CHART_SETTLE = 2500

const enabled = !!process.env.VISUAL
test.skip(!enabled, 'Vizuální porovnání běží jen s VISUAL=1')

async function next(page: Page) {
  await page.getByRole('button', { name: /Další|Zobrazit výsledky/ }).last().click()
}

async function freeze(page: Page) {
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important}',
  })
}

async function walk(page: Page, tag: string) {
  await page.goto('/')
  await freeze(page)
  await expect(page).toHaveScreenshot(`${tag}-uvitani.png`, { fullPage: true, maxDiffPixels: 0 })

  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await next(page)
  await next(page)
  await freeze(page)
  await expect(page).toHaveScreenshot(`${tag}-vydaje.png`, { fullPage: true, maxDiffPixels: 0 })

  await next(page)
  await next(page)
  await page.getByRole('button', { name: /Vlastní bydlení/ }).first().click()
  await page.getByRole('button', { name: /Důchod/ }).first().click()
  await next(page)
  await next(page)
  await expect(page.getByText('Váš finanční plán')).toBeVisible()
  await page.waitForTimeout(CHART_SETTLE)
  await freeze(page)
  await expect(page).toHaveScreenshot(`${tag}-souhrn.png`, { fullPage: true, maxDiffPixels: 0 })

  for (const tab of ['Rozpočet', 'Bydlení', 'Ostatní cíle', 'Slovníček']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await page.waitForTimeout(CHART_SETTLE)
    await freeze(page)
    await expect(page).toHaveScreenshot(`${tag}-${tab}.png`, { fullPage: true, maxDiffPixels: 0 })
  }
}

test('desktop, světlý režim', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await walk(page, 'desktop')
})

test('desktop, tmavý režim', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await walk(page, 'tmavy')
})

test('mobil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await walk(page, 'mobil')
})
