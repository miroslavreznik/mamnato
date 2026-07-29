import { test, expect, type Page } from '@playwright/test'

/**
 * Průchod appkou tabulátorem.
 *
 * Ověřuje dvě věci, které se okem nepoznají, dokud si člověk nezkusí appku
 * ovládat bez myši:
 *
 * 1. **Fokus je vidět.** Appka nemá jeden globální fokusový prstenec, každý
 *    prvek si ho nese sám (`focus:ring-2`), takže se dá zapomenout. Přesně
 *    to se stalo úchopu ve stuze: `focus:outline-none` bez náhrady, u prvku,
 *    který se přitom ovládá výhradně klávesnicí.
 * 2. **Fokus nezmizí.** Nesmí skončit na prvku, který není vidět, ani se
 *    vrátit na `body` uprostřed obrazovky.
 *
 * Neověřuje pořadí prvků. Appka nikde nepoužívá kladný `tabindex`, takže
 * pořadí plyne z pořadí v DOM, a to je kontrola pro prohlížeč, ne pro test.
 */

/** Co se počítá za viditelný fokus. */
function focusReport() {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return { tag: 'body', label: '', visible: false, sized: false }

  const s = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  // Tailwind kreslí `ring-2` přes `box-shadow`, prohlížeč přes `outline`.
  // Stačí jedno z nich, ne obojí.
  const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0
  const shadow = s.boxShadow !== 'none' && s.boxShadow !== ''
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    visible: outline || shadow,
    sized: r.width > 0 && r.height > 0,
  }
}

/**
 * Přechody musí pryč, jinak se měří stav uprostřed prolnutí. Tlačítko „Další"
 * má `transition-all`, takže se mu prstenec roztahuje z nuly a hned po
 * stisku tabulátoru vrací `outline-width: 0px`. Vypadá to jako chybějící
 * fokus a není. Stejná past už jednou chytila test kontrastu.
 */
async function noTransitions(page: Page) {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
}

async function tabThrough(page: Page, steps: number) {
  const seen: ReturnType<typeof focusReport>[] = []
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(focusReport)
    if (r.tag === 'body') break
    seen.push(r)
  }
  return seen
}

test('v průvodci je fokus na každém prvku vidět', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await noTransitions(page)
  await page.getByRole('button', { name: /Spustit přehled/ }).click()

  const seen = await tabThrough(page, 40)
  expect(seen.length).toBeGreaterThan(3)

  const bad = seen.filter((r) => !r.visible || !r.sized)
  expect(bad, bad.map((r) => `${r.tag} „${r.label}"`).join('\n')).toEqual([])
})

test('na výsledcích je fokus na každém prvku vidět včetně úchopu ve stuze', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await noTransitions(page)
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()

  // Úchop ve stuze zvlášť: je to jediný prvek, který se myší ovládá tažením,
  // takže na něj tabulátorem nikdo náhodou nenarazí a chybějící prstenec
  // se nepozná.
  const grip = page.getByRole('slider', { name: 'Za jak dlouho čekáte dítě' })
  await grip.focus()
  const gripFocus = await page.evaluate(focusReport)
  expect(gripFocus.visible, 'úchop ve stuze nemá vidět fokus').toBe(true)

  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  const seen = await tabThrough(page, 60)
  expect(seen.length).toBeGreaterThan(5)

  const bad = seen.filter((r) => !r.visible || !r.sized)
  expect(bad, bad.map((r) => `${r.tag} „${r.label}"`).join('\n')).toEqual([])
})

test('do lišty záložek se vstoupí jednou a mezi nimi se jezdí šipkami', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()

  // Tabulátor smí do lišty vstoupit jen jednou: ostatní záložky mají
  // `tabIndex -1`, jinak by se uživatel klávesnice k obsahu prokousával
  // přes všechny.
  const stops = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"]')].filter((t) => t.getAttribute('tabindex') === '0').length)
  expect(stops).toBe(1)

  await page.locator('#tab-souhrn').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#tab-rozpocet')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#tab-rozpocet')).toBeFocused()

  // Doleva z první záložky se objede dokola, ne že se fokus zasekne.
  // Klikem, ne fokusem: šipka se řídí vybranou záložkou, ne zaostřenou,
  // a po předchozím kroku je vybraný Rozpočet.
  await page.locator('#tab-souhrn').click()
  await page.keyboard.press('ArrowLeft')
  const last = page.locator('[role="tab"]').last()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  await expect(last).toBeFocused()
})
