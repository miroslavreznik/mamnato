import { test, type Page } from '@playwright/test'

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
