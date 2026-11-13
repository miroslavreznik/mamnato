import { expect, test, type Page } from '@playwright/test'

async function amount(page: Page, name: string, value: number) {
  const field = page.getByRole('textbox', { name, exact: true })
  await field.fill(String(value))
  await field.blur()
}

async function enterHousehold(page: Page, savings: number) {
  await page.getByRole('radio', { name: 'Ve dvou' }).check()
  await amount(page, 'Váš čistý příjem za měsíc', 50000)
  await amount(page, 'Čistý příjem druhé osoby za měsíc', 30000)
  await amount(page, 'Dostupné úspory na koupi a rezervu', savings)
  await page.getByRole('button', { name: 'Další', exact: true }).click()

  await amount(page, 'Běžné nezbytné výdaje bez bydlení a splátek', 33000)
  await amount(page, 'Nájem, který po stěhování přestanete platit', 18000)
  await amount(page, 'Dnešní energie a služby', 5500)
  await amount(page, 'Měsíční splátky ostatních úvěrů', 4000)
  await page.getByRole('button', { name: 'Další', exact: true }).click()
}

test('pár prověří konkrétní byt, vidí měsíční přebytek a rezervu po poplatcích', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Prověřit konkrétní byt', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Další', exact: true })).toBeDisabled()
  await enterHousehold(page, 1550000)
  await amount(page, 'Kupní cena bytu', 6000000)
  await page.getByRole('button', { name: 'Upravit hypotéku, náklady a rezervu' }).click()
  await amount(page, 'Úroková sazba hypotéky', 5)
  await amount(page, 'Fond oprav, údržba a pojištění bytu za měsíc', 5000)
  await amount(page, 'Energie a služby v novém bytě', 1500)
  await amount(page, 'Jednorázové náklady při koupi', 100000)
  await page.getByRole('button', { name: 'Prověřit byt', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Podle rozpočtu můžete koupit už teď.' })).toBeVisible()
  await expect(page.getByText(/Po výdajích a odkládání na cíle by zbývalo 10\s733 Kč/)).toBeVisible()
  await expect(page.getByText(/Po zaplacení vkladu a nákladů zbude 250\s000 Kč/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.getByRole('tab', { name: 'Bydlení', exact: true }).click()
  await expect(page.getByText('Odhadovaná měsíční splátka').locator('..')).toContainText(/25\s767 Kč/)
  await expect(page.getByRole('heading', { name: 'Celkové náklady na bydlení' })).toBeHidden()
  await page.getByRole('button', { name: 'Srovnání koupě a nájmu', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Celkové náklady na bydlení' })).toBeVisible()
})

test('cenový strop lze spočítat bez vybraného bytu a údaje zachovat v plném plánu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Zjistit, jak drahý byt hledat', exact: true }).click()
  await enterHousehold(page, 1300000)
  await expect(page.getByRole('textbox', { name: 'Kupní cena bytu' })).toHaveCount(0)
  await amount(page, 'Kolik vám má měsíčně zbýt po koupi', 10000)
  await page.getByRole('button', { name: 'Spočítat cenový strop' }).click()
  await expect(page.getByRole('heading', { name: /Hledejte byt do [\d\s]+ Kč/ })).toBeVisible()
  await expect(page.getByText(/Cenu omezu(jí|je)/)).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Pokračovat tam, kde jste skončili' }).click()
  await expect(page.getByRole('heading', { name: /Hledejte byt do [\d\s]+ Kč/ })).toBeVisible()
  await page.getByRole('button', { name: 'Přidat další finanční cíle' }).click()
  await expect(page.getByRole('heading', { name: 'Vaše finanční cíle' })).toBeVisible()
  await page.getByRole('button', { name: 'Zpět na krok 3: Výdaje' }).click()
  await expect(page.getByRole('textbox', { name: 'Souhrn nezbytných výdajů z rychlého výpočtu' })).toHaveValue(/33\s000/)
})
