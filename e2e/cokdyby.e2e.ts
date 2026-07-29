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

/**
 * Odkládání cílů v Co kdyby.
 *
 * Odložit cíl šlo dřív jen v kartě vlastních cílů a byl to místní stav:
 * zešedla karta a nic víc. Teď je to vypnutá položka jako každá jiná a platí
 * pro celý přehled.
 *
 * Odložení ale nemá stejný účinek jako posuvník, a testuje se právě ten
 * rozdíl. Odložení důchodu **křivkou jmění nehne**: spoření na cíl zůstává
 * jměním, jen leží jinde. Změní se jen volné peníze. Odložení bydlení naopak
 * zruší koupi, takže se tvar změní a duch původní cesty má co ukázat.
 */
test.describe('odkládání cílů', () => {
  const num = (page: Page, label: string) =>
    page.getByRole('textbox', { name: label, exact: true })

  async function toWhatIf(page: Page) {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await page.getByRole('button', { name: /Spustit přehled/ }).click()
    await page.getByTestId('mode-couple').click()
    await page.getByTestId('wizard-next').click()
    await num(page, 'Čistý měsíční příjem: osoba 1').fill('48000')
    await num(page, 'Čistý měsíční příjem: osoba 2').fill('36000')
    await page.getByTestId('wizard-next').click()
    await num(page, 'Nájem (bez energií a poplatků)').fill('19000')
    await page.getByTestId('wizard-next').click()
    await num(page, 'Celkové úspory').fill('900000')
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('goal-property').click()
    await page.getByTestId('goal-retirement').click()
    await page.getByTestId('wizard-next').click()
    await num(page, 'Cílová cena nemovitosti').fill('6000000')
    await page.getByTestId('wizard-next').click()
    await page.locator('#tab-cokdyby').click()
  }

  const ribbonPath = (page: Page) =>
    page.locator('#cokdyby svg[aria-label^="Vývoj úspor"] path[stroke-width="9"]').first()
  const ghost = (page: Page) =>
    page.locator('#cokdyby svg[aria-label^="Vývoj úspor"] path[stroke-dasharray="8 8"]')

  test('odložení důchodu uvolní peníze, ale cestou nehne', async ({ page }) => {
    await toWhatIf(page)
    const before = await ribbonPath(page).getAttribute('d')

    await page.getByRole('checkbox', { name: /důchod/i }).uncheck()

    // Tvar se nezmění, takže se ani neslibuje duch, který by nebyl vidět.
    expect(await ribbonPath(page).getAttribute('d')).toBe(before)
    await expect(ghost(page)).toHaveCount(0)
    await expect(page.getByText(/Na cestě to nevypadá jinak/)).toBeVisible()

    // Zato volných peněz přibude, a to je celý účinek odložení.
    const tile = page.getByText('Volných měsíčně').locator('..')
    await expect(tile).toBeVisible()
    const delta = await tile.locator('p').last().textContent()
    expect(delta, 'dlaždice volných peněz neukázala přírůstek').toMatch(/^\+/)
  })

  test('odložení bydlení zruší koupi a ukáže původní cestu jako obrys', async ({ page }) => {
    await toWhatIf(page)
    const before = await ribbonPath(page).getAttribute('d')

    await page.getByRole('checkbox', { name: /akontaci/i }).uncheck()

    expect(await ribbonPath(page).getAttribute('d')).not.toBe(before)
    await expect(ghost(page)).toHaveCount(1)
    await expect(page.getByText(/Zkoušíte to bez toho, co jste odložili/)).toBeVisible()
  })

  test('vrácení scénáře zapne odložené cíle zpátky', async ({ page }) => {
    await toWhatIf(page)
    await page.getByRole('checkbox', { name: /důchod/i }).uncheck()
    await expect(page.getByRole('button', { name: 'Vrátit původní scénář' })).toBeEnabled()

    await page.getByRole('button', { name: 'Vrátit původní scénář' }).click()
    await expect(page.getByRole('checkbox', { name: /důchod/i })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Vrátit původní scénář' })).toBeDisabled()
  })
})
