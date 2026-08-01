import { test, expect, type Page } from '@playwright/test'

/**
 * Změna jednoho čísla musí platit pro celou stránku.
 *
 * Výsledky jsou jedna souvislá odpověď: verdikt, časová osa, dlaždice a věty
 * u cílů mluví o témž plánu. Když se dá do některého pole sáhnout, musí se
 * přepočítat všechno, co na něm závisí, jinak stránka po úpravě tvrdí dvě
 * různé věci naráz.
 *
 * Vzniklo to z konkrétní chyby: rozdělení peněz mezi cíle se počítalo jednou
 * při otevření výsledků. Kdo si pak snížil výdaje, viděl vyšší disponibilní
 * částku, ale na akontaci se dál odkládalo staré číslo, takže „naspoříte za
 * 4 roky" zůstalo stát a časová osa kupovala ve stejný měsíc jako předtím.
 *
 * Testy proto nekontrolují konkrétní částky (ty se mění s výchozími daty),
 * ale **že se pohnuly**: sáhnou na vstup a porovnají odečty před a po.
 */

const num = (page: Page, label: string) =>
  page.getByRole('textbox', { name: label, exact: true })

/** Jen číslice, kvůli úzké nezlomitelné mezeře v českém formátu. */
const digits = (s: string | null) => (s ?? '').replace(/[^\d]/g, '')

async function toResults(page: Page, opts: { savings: string; goals: string[] }) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('mode-couple').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('48000')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('36000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('18000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill(opts.savings)
  await page.getByTestId('wizard-next').click()
  for (const g of opts.goals) await page.getByTestId(`goal-${g}`).click()
  await page.getByTestId('wizard-next').click()
  if (opts.goals.includes('property')) await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()
}

/**
 * Odečty, které musí sledovat plán.
 *
 * Měsíc koupě se čte z úchopu na stuze, ne z popisku obrázku: ten uvádí
 * události v celých letech, takže posun o pár měsíců by se v něm ztratil.
 */
async function readings(page: Page) {
  const tile = async (label: string) => digits(await page.getByTestId(`kpi-${label}`).innerText())
  const koupe = page.getByRole('slider', { name: 'Za jak dlouho chcete koupit' })
  return {
    verdikt: await page.locator('#souhrn h2').first().innerText(),
    splatka: await tile('Měsíční splátka'),
    akontace: await tile('Chybějící akontace'),
    rezerva: await tile('Rezerva po koupi vydrží'),
    mesicKoupe: (await koupe.count()) > 0 ? await koupe.getAttribute('aria-valuenow') : null,
    rozpocet: digits(await page.locator('#souhrn').getByText(/Po všech výdajích/).innerText()),
    cile: digits(await page.locator('#souhrn').getByTestId('cile-prehled').innerText()),
  }
}

test('snížení výdajů se propíše do celého přehledu', async ({ page }) => {
  await toResults(page, { savings: '400000', goals: ['property', 'retirement'] })
  const pred = await readings(page)

  await page.locator('#tab-rozpocet').click()
  await num(page, 'Jídlo a potraviny').fill('3000')
  await page.locator('#tab-souhrn').click()
  await page.waitForTimeout(400)
  const po = await readings(page)

  expect(po.rozpocet, 'rozpočet').not.toBe(pred.rozpocet)
  // Víc volných peněz znamená rychlejší akontaci: dřívější koupi na ose
  // i kratší termín v dlaždici.
  expect(Number(po.mesicKoupe), 'měsíc koupě').toBeLessThan(Number(pred.mesicKoupe))
  expect(po.akontace, 'dlaždice akontace').not.toBe(pred.akontace)
  // A na cíle jde jiná částka, takže se změní i věty u nich.
  expect(po.cile, 'věty u cílů').not.toBe(pred.cile)
})

test('změna sazby se propíše do splátky, rezervy i zadluženosti', async ({ page }) => {
  await toResults(page, { savings: '1500000', goals: ['property'] })
  const pred = await readings(page)

  await page.locator('#tab-bydleni').click()
  const dsti = page.getByText(/DSTI/).first()
  const dstiPred = digits(await dsti.locator('..').innerText())

  const sazba = page.getByRole('slider', { name: 'Úroková sazba' })
  await sazba.focus()
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)

  const dstiPo = digits(await dsti.locator('..').innerText())
  expect(dstiPo, 'DSTI').not.toBe(dstiPred)

  await page.locator('#tab-souhrn').click()
  await page.waitForTimeout(400)
  const po = await readings(page)
  expect(po.splatka, 'dlaždice splátky').not.toBe(pred.splatka)
  expect(po.rezerva, 'rezerva po koupi').not.toBe(pred.rezerva)
})

test('ručně zadaná částka u cíle přebije odhad a drží', async ({ page }) => {
  await toResults(page, { savings: '400000', goals: ['property', 'retirement'] })

  await page.locator('#tab-cile').click()
  const duchod = num(page, 'Měsíční částka k investování')
  await duchod.fill('3000')
  await page.waitForTimeout(300)

  await page.locator('#tab-rozpocet').click()
  await num(page, 'Jídlo a potraviny').fill('2000')
  await page.locator('#tab-cile').click()
  await page.waitForTimeout(300)
  expect(digits(await duchod.inputValue()), 'zadaná částka na důchod').toBe('3000')
})

test('náklady na dítě z karty platí pro celý plán', async ({ page }) => {
  await toResults(page, { savings: '600000', goals: ['property', 'child'] })

  const veta = () => page.locator('#souhrn').getByText(/Během rodičovské/).innerText()
  await page.locator('#souhrn').waitFor()
  const pred = await veta()
  const predOsa = digits(await page.getByRole('img', { name: /Vývoj úspor/ }).getAttribute('aria-label'))

  // Dvě děti stojí dvakrát tolik. Dokud si počet držela karta, ukazovala
  // náklady na dvě a osa vedle ní počítala jedno.
  await page.locator('#tab-cile').click()
  await num(page, 'Počet dětí').fill('2')
  await page.locator('#tab-souhrn').click()
  await page.waitForTimeout(400)

  expect(await veta(), 'věta o rodičovské').not.toBe(pred)
  expect(digits(await page.getByRole('img', { name: /Vývoj úspor/ }).getAttribute('aria-label')), 'časová osa')
    .not.toBe(predOsa)
})

test('výnos v Důchodu platí i pro větu o rentě a graf koupě vs. nájem', async ({ page }) => {
  await toResults(page, { savings: '600000', goals: ['property', 'retirement'] })
  const veta = () => page.locator('#souhrn').getByText(/při výnosu/).innerText()
  const pred = await veta()

  await page.locator('#tab-cile').click()
  await num(page, 'Výnos SP500 / globální akcie').fill('4')
  await page.waitForTimeout(300)

  // Věta v Přehledu počítá z téhož čísla…
  await page.locator('#tab-souhrn').click()
  await page.waitForTimeout(300)
  expect(await veta(), 'věta o rentě').not.toBe(pred)
  expect(await veta()).toContain('4 %')

  // …a graf koupě vs. nájem taky, je to jeden a týž předpoklad.
  await page.locator('#tab-bydleni').click()
  await page.waitForTimeout(300)
  expect(digits(await num(page, 'Výnos investic').inputValue()), 'výnos v Bydlení').toBe('4')
})
