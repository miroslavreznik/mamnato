import { test, expect, type Page } from '@playwright/test'

/**
 * Záložka „Co kdyby".
 *
 * Podstatné na ní není, že se dá hýbat posuvníkem, ale že je vidět proti
 * čemu: původní scénář zůstane jako přerušovaný obrys a čísla se ukazují
 * jako rozdíl. Bez toho vypadá každý scénář stejně rozumně.
 */

async function toWhatIf(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await page.locator('#tab-cokdyby').click()
}

const ghost = (page: Page) => page.locator('#cokdyby path[stroke-dasharray="8 8"]')

test('duch původního scénáře se objeví, až když je s čím porovnávat', async ({ page }) => {
  await toWhatIf(page)
  await expect(ghost(page)).toHaveCount(0)

  await page.getByRole('slider', { name: 'Cena nemovitosti' }).fill('3000000')
  await expect(ghost(page)).toHaveCount(1)
})

test('posuvník ceny přepočítá splátku a ukáže rozdíl', async ({ page }) => {
  await toWhatIf(page)
  const payment = page.locator('#cokdyby').getByText('Měsíční splátka').locator('xpath=..')
  const asNumber = async () => {
    const t = (await payment.textContent()) ?? ''
    // Jen `\s`: různé druhy mezer se v regexu psát nemají, ESLint je hlásí
    // jako neviditelné znaky a druh oddělovače tisíců se navíc liší podle
    // verze ICU. `\s` v Unicode režimu pokryje obojí.
    return Number((t.match(/([\d\s]+)\s*Kč/u)?.[1] ?? '').replace(/\s/gu, ''))
  }
  const before = await asNumber()
  await expect(payment).toContainText('beze změny')

  await page.getByRole('slider', { name: 'Cena nemovitosti' }).fill('3000000')
  await expect.poll(asNumber).toBeLessThan(before)
  await expect(payment).not.toContainText('beze změny')
})

test('vrátit původní scénář zahodí posuvníky', async ({ page }) => {
  await toWhatIf(page)
  const back = page.getByRole('button', { name: 'Vrátit původní scénář' })
  await expect(back).toBeDisabled()

  await page.getByRole('slider', { name: 'Cena nemovitosti' }).fill('3000000')
  await expect(back).toBeEnabled()
  await back.click()

  await expect(back).toBeDisabled()
  await expect(ghost(page)).toHaveCount(0)
})

test('posuvníky nemění Cestu, jsou to jen úvahy', async ({ page }) => {
  await toWhatIf(page)
  await page.getByRole('slider', { name: 'Cena nemovitosti' }).fill('3000000')

  // Na Cestě musí zůstat splátka podle skutečně zadané ceny. Kdyby ji
  // posuvník změnil, přestalo by být poznat, co uživatel má a co si přeje.
  await page.locator('#tab-souhrn').click()
  await expect(page.locator('#souhrn')).toContainText('28 857')
})
