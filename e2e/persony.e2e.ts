import { test, type Page } from '@playwright/test'

/**
 * Otisky se pořizují jen s `PERSONY=1`.
 *
 * Nejsou to testy: nic netvrdí a nic nemůže selhat, jen fotí celou stránku
 * v plné výšce, což je paměťově nejdražší věc v celé sadě. Samotné projití
 * všech deseti person trvá 37 sekund, ale ve společném běhu se zbytkem
 * (kontrast, tisk, klávesnice) se jedna z nich zasekla na půl druhé minuty
 * a spadla na limit. Samostatně se to nereprodukovalo ani jednou.
 *
 * Stejně je na tom pixelové porovnání za `VISUAL=1`. Obojí je nástroj pro
 * jedno sezení, ne kontrola pro CI.
 *
 *   PERSONY=1 … npx playwright test --project=chromium persony
 *
 * Plné znění příkazu i s obejitím proxy je v CLAUDE.md.
 */
const enabled = !!process.env.PERSONY
test.describe.configure({ mode: enabled ? 'parallel' : 'default', timeout: 90_000 })
test.beforeEach(() => test.skip(!enabled, 'otisky person: spusťte s PERSONY=1'))

const OUT = '/tmp/claude-0/-home-user-mamnato/ac41d95e-14fb-56b8-a040-5aa25aa88d4c/scratchpad'

const num = (page: Page, label: string) =>
  page.getByRole('textbox', { name: label, exact: true })

async function shot(page: Page, name: string) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  const w = page.viewportSize()!.width
  await page.setViewportSize({ width: w, height: Math.min(h, 3600) })
  await page.screenshot({ path: `${OUT}/persona-${name}.png` })
  await page.setViewportSize({ width: w, height: 900 })
}

test('persona 1: jednotlivec v nájmu, spoří jen na důchod', async ({ page }) => {
  // Úplně bez cílů se dál nedá: krok Cíle nepustí dál, dokud není vybraný
  // aspoň jeden. Nejbližší realistická varianta je „bydlení neřeším".
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('wizard-next').click()
  await page.waitForTimeout(2200)
  await shot(page, '1-bez-bydleni')
})

test('persona 2: pár, bydlení a dítě s rodičovskou', async ({ page }) => {
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
  await num(page, 'Celkové úspory').fill('900000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()

  await page.locator('#tab-cile').click()
  await page.getByRole('button', { name: /Spočítat dopad rodičovské/ }).click()
  await page.locator('#tab-souhrn').click()
  await page.waitForTimeout(2200)
  await shot(page, '2-par-dite')
})

test('persona 3: rodina se schodkem', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('mode-family').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('32000')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('24000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('21000')
  await num(page, 'Stávající splátky úvěrů').fill('6000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('80000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await page.waitForTimeout(2200)
  await shot(page, '3-rodina-schodek')
})

/**
 * Persony 8 a 9 míří na cesty, které dosud žádný průchod nepotkal:
 * mladého žadatele s desetiprocentní akontací a rodičovskou, a člověka
 * pár let před důchodem.
 */

test('persona 8: mladý pár do 36 let, LTV 90 % a rodičovská', async ({ page }) => {
  // Žadateli do 36 let banka půjčí až 90 % ceny, takže z vlastního stačí
  // desetina. Tuhle větev `downPaymentFraction` zatím nikdo neprošel.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('mode-couple').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('42000')
  await num(page, 'Věk: osoba 1').fill('29')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('35000')
  await num(page, 'Věk: osoba 2').fill('28')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('17000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('700000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Cílová cena nemovitosti').fill('5800000')
  await page.getByTestId('wizard-next').click()
  await page.waitForTimeout(2200)
  await shot(page, '8-mlady-par')

  await page.locator('#tab-bydleni').click()
  await page.waitForTimeout(2200)
  await shot(page, '8-bydleni')

  await page.locator('#tab-cile').click()
  await page.getByRole('button', { name: /Spočítat dopad rodičovské/ }).click()
  await page.waitForTimeout(2200)
  await shot(page, '8-rodicovska')
})

test('persona 9: pár let před důchodem, bez bydlení', async ({ page }) => {
  // Krátký horizont do důchodu je druhý konec škály: `yearsUntilRetirement`
  // se blíží jedničce a projekce má na složené úročení sotva pár let.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Můj čistý měsíční příjem').fill('54000')
  await num(page, 'Můj věk').fill('58')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('14000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('2200000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('wizard-next').click()
  await page.waitForTimeout(2200)
  await shot(page, '9-pred-duchodem')

  await page.locator('#tab-cile').click()
  await page.waitForTimeout(2200)
  await shot(page, '9-duchod')
})
