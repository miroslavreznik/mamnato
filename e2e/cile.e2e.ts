import { test, expect, type Page } from '@playwright/test'

/**
 * Vlastní cíle: cíl je měsíční částka z volných peněz.
 *
 * Vzniklo to z konkrétního rozporu na obrazovce. Karta měla u každého cíle
 * pole „kolik na tento cíl měsíčně dávám", ale stav pod ním počítala z toho,
 * jak by se disponibilní částka rozdělila mezi cíle podle pořadí. Pole to
 * nebralo v úvahu, takže vedle sebe stálo „dávám 14 667 Kč" a „na tento cíl
 * odkládáte 33 334 Kč". Verdikt nahoře přitom rozděloval ještě třetí balík.
 *
 * Testuje se tedy jediná věc, ale z několika stran: **platí částka, kterou
 * uživatel nastavil.** Nic ji nepřerozděluje, nezávisí na pořadí cílů a to,
 * co karta říká, sedí s tím, co říká odpověď nahoře.
 */

const num = (page: Page, label: string) =>
  page.getByRole('textbox', { name: label, exact: true })

const digits = (s: string | null) => Number((s ?? '').replace(/[^\d]/g, ''))

/** Pár s vlastními cíli a bez bydlení: nejkratší cesta k té kartě. */
async function toGoals(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('mode-couple').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('45000')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('38000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('22000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('250000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-other').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()
  await page.locator('#tab-cile').click()
}

const slider = (page: Page, i = 0) =>
  page.getByRole('slider', { name: 'Kolik na tento cíl měsíčně dávám' }).nth(i)

test('částka u cíle je ta, kterou uživatel nastavil', async ({ page }) => {
  await toGoals(page)
  const s = slider(page)
  await s.fill('9000')

  // Vedle posuvníku musí stát táž částka. Porovnává se číslo, ne řetězec:
  // oddělovač tisíců je úzká nezlomitelná mezera a její kód se liší podle
  // verze ICU, takže na shodu textu se spolehnout nedá.
  await expect(s).toHaveValue('9000')
  const shown = await page.getByTestId('goal-allocation').first().textContent()
  expect(digits(shown)).toBe(9000)
})

test('víc než volné peníze rozdat nejde', async ({ page }) => {
  await toGoals(page)
  const s = slider(page)

  // Strop posuvníku je vlastní částka plus to, co je zrovna volné. Kdyby
  // šlo dát víc, rozpočet by tiše spadl do mínusu a appka by přitom tvrdila,
  // že cíl vychází.
  const before = digits(await s.getAttribute('max'))
  await s.fill(String(before))
  const after = digits(await s.getAttribute('max'))
  expect(after).toBe(before)

  // Po rozdání všeho už „volných zbývá" nic a přidat nejde.
  await expect(page.getByText(/Volné peníze jsou rozdané/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Přidat na cíl' }).first()).toBeDisabled()
})

test('dva cíle si peníze nepřehazují podle pořadí', async ({ page }) => {
  await toGoals(page)
  await page.getByRole('button', { name: /Přidat další cíl/ }).click()

  await slider(page, 0).fill('4000')
  await slider(page, 1).fill('3000')

  // Druhý cíl dostane svoje tři tisíce, ne zbytek po prvním. Přesně tohle
  // dělalo rozdělování podle pořadí: první si vzal, co potřeboval, a na
  // druhý zbylo, co zbylo, ať měl uživatel u pole napsáno cokoli.
  await expect(slider(page, 0)).toHaveValue('4000')
  await expect(slider(page, 1)).toHaveValue('3000')
})

test('odložení cíle v Co kdyby uvolní peníze a přepočítá celý přehled', async ({ page }) => {
  await toGoals(page)
  await page.getByRole('button', { name: /Přidat další cíl/ }).click()
  await page.locator('#cile').getByRole('textbox', { name: 'Cílová částka' }).first().fill('600000')
  await slider(page, 0).fill('5000')
  await slider(page, 1).fill('5000')

  await page.locator('#tab-cokdyby').click()
  const first = page.locator('#cokdyby [data-testid^="whatif-goal-other:"]').first()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await first.click()

  // Odložený cíl přestane ukrajovat z rozpočtu: zbývá měsíčně víc než předtím.
  await page.locator('#tab-cile').click()
  await expect(page.getByText(/Volných zbývá/).first()).toBeVisible()

  // A hlavně: zmizel ze seznamu cílů, takže ho verdikt nepočítá mezi
  // nesplněné. Dřív šlo cíl odložit jen v kartě, kde to byl místní stav
  // a nezměnilo to ani rozpočet, ani odpověď nahoře.
  await expect(slider(page)).toHaveCount(1)
})
