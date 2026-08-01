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
 * Práh je nula rozdílných pixelů. Aby to bylo dosažitelné, musí se srovnat
 * dvě věci, obě kvůli grafům:
 *
 * 1. Recharts animuje z JavaScriptu, ne z CSS, takže `animation: none` na něj
 *    nestačí a snímek pořízený moc brzy se lišil i sám se sebou (u sloupcového
 *    grafu o dvacet pět tisíc pixelů). Místo pevného čekání se proto čeká na
 *    ustálení geometrie SVG (`settleCharts`), naměřeno kolem 1,8 s.
 *
 * 2. `fullPage: true` si výšku okna dopočítá až v okamžiku snímku. Tím zmizí
 *    svislý posuvník, stránka se o jeho šířku rozšíří, `ResponsiveContainer`
 *    se přeměří a graf se překreslí a znovu rozjede, takže se snímek pořídí
 *    uprostřed animace. Pokaždé jinde, takže se otisk lišil i proti sobě.
 *    Okno se proto zvětší na výšku obsahu předem (`fitViewport`) a snímek
 *    se pořizuje bez `fullPage`.
 */

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

/** Otisk geometrie všech SVG. Když se dvakrát po sobě nezmění, graf dojel. */
const chartSignature = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('svg')]
      .flatMap((s) => [...s.querySelectorAll('path,rect,line')])
      .map((el) => el.getAttribute('d') ?? `${el.getAttribute('width')}:${el.getAttribute('x')}`)
      .join('|')
  )

async function settleCharts(page: Page) {
  let prev = ''
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250)
    const now = await chartSignature(page)
    if (now === prev) return
    prev = now
  }
  throw new Error('Grafy se neustálily ani za 10 s')
}

/**
 * Zvětší okno na výšku obsahu, aby zmizel posuvník ještě před snímkem.
 * Výška se po překreslení může změnit, proto se to zopakuje.
 */
async function fitViewport(page: Page, width: number) {
  let height = 0
  for (let i = 0; i < 5; i++) {
    const next = await page.evaluate(() => document.documentElement.scrollHeight)
    if (next === height) break
    height = next
    await page.setViewportSize({ width, height })
  }
  return height
}

async function shoot(page: Page, name: string, width: number) {
  await fitViewport(page, width)
  await settleCharts(page)
  await freeze(page)
  await expect(page).toHaveScreenshot(name, { maxDiffPixels: 0 })
}

async function walk(page: Page, tag: string, width: number, height: number) {
  const reset = () => page.setViewportSize({ width, height })

  await page.setViewportSize({ width, height })
  await page.goto('/')
  await shoot(page, `${tag}-uvitani.png`, width)

  await reset()
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await next(page)
  await next(page)
  await shoot(page, `${tag}-vydaje.png`, width)

  await reset()
  await next(page)
  await next(page)
  await page.getByRole('button', { name: /Vlastní bydlení/ }).first().click()
  await page.getByRole('button', { name: /Důchod/ }).first().click()
  await next(page)
  await next(page)
  await expect(page.getByTestId('results')).toBeVisible()
  await shoot(page, `${tag}-souhrn.png`, width)

  for (const tab of ['Rozpočet', 'Bydlení', 'Ostatní cíle', 'Co kdyby', 'Slovníček']) {
    await reset()
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await shoot(page, `${tag}-${tab}.png`, width)
  }
}

test('desktop, světlý režim', async ({ page }) => {
  await walk(page, 'desktop', 1280, 900)
})

test('desktop, tmavý režim', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  // Výchozí je tmavý režim bez ohledu na systém, takže `colorScheme` sám
  // o sobě nestačí: motiv se musí nastavit tak, jak ho drží appka.
  await page.addInitScript((t) => {
    try { localStorage.setItem('mamnato_theme', t) } catch { /* ignore */ }
  }, 'dark')
  await walk(page, 'tmavy', 1280, 900)
})

test('mobil', async ({ page }) => {
  await walk(page, 'mobil', 390, 844)
})
