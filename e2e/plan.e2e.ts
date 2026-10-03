import { test, expect, type Page } from '@playwright/test'
import { createInitialState } from '../src/store/wizardStore'
import type { WizardState } from '../src/types'

const digits = (value: string) => value.replace(/\D/g, '')
const input = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })

async function openPlan(page: Page, overrides: Partial<WizardState> = {}) {
  const state: WizardState = {
    ...createInitialState(),
    currentStep: 8,
    income: { person1NetMonthly: 90000 },
    savings: { totalSavings: 300000 },
    person1Age: 40,
    goals: ['property', 'reserve', 'retirement', 'other'],
    property: { targetPrice: 4000000, mortgageRate: 0.05, loanTermYears: 30 },
    customGoals: [{ id: 'auto', name: 'Auto', targetAmount: 120000, targetMonths: 24 }],
    ...overrides,
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/#s=${Buffer.from(JSON.stringify(state)).toString('base64url')}`)
  await expect(page.getByTestId('results')).toBeVisible()
}

test('ruční odkládání přežije reload a sdílený odkaz včetně nuly', async ({ page, browser }) => {
  await page.addInitScript(() => {
    let copied = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { copied = text }, readText: async () => copied },
    })
  })
  await openPlan(page)
  await page.locator('#tab-cile').click()
  await input(page, 'Měsíční částka k investování').fill('0')
  await input(page, 'Kolik měsíčně odkládám na rezervu').fill('2000')
  await page.getByRole('slider', { name: 'Kolik na tento cíl měsíčně dávám' }).fill('1500')
  await page.locator('#tab-bydleni').click()
  await page.getByRole('slider', { name: 'Měsíční odkládání na akontaci' }).fill('4000')

  const verify = async (p: Page) => {
    await p.locator('#tab-cile').click()
    expect(Number(digits(await input(p, 'Měsíční částka k investování').inputValue()))).toBe(0)
    expect(digits(await input(p, 'Kolik měsíčně odkládám na rezervu').inputValue())).toBe('2000')
    await expect(p.getByRole('slider', { name: 'Kolik na tento cíl měsíčně dávám' })).toHaveValue('1500')
    await p.locator('#tab-bydleni').click()
    await expect(p.getByRole('slider', { name: 'Měsíční odkládání na akontaci' })).toHaveValue('4000')
    await p.locator('#tab-souhrn').click()
    return p.locator('#souhrn').getByTestId('cile-prehled').innerText()
  }
  const before = await verify(page)
  await page.reload()
  await page.getByRole('button', { name: 'Pokračovat tam, kde jste skončili' }).click()
  await expect(page.getByTestId('results')).toBeVisible()
  expect(await verify(page)).toBe(before)

  await page.getByRole('button', { name: 'Sdílet přehled', exact: true }).click()
  await expect(page.getByText('vámi nastavené měsíční částky spoření na cíle')).toBeVisible()
  await page.getByRole('button', { name: 'Zkopírovat odkaz', exact: true }).click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('#s=')
  const receiver = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  try {
    const shared = await receiver.newPage()
    await shared.goto(url)
    await expect(shared.getByTestId('results')).toBeVisible()
    expect(await verify(shared)).toBe(before)
  } finally {
    await receiver.close()
  }
})

test('požadovaná renta přepočítá připravenost i hlavní odpověď', async ({ page }) => {
  await openPlan(page, {
    goals: ['retirement'],
    savings: { totalSavings: 3078000 },
    retirementRates: { sp500: 0.03 },
    retirementMonthlyRent: 10000,
    allocationOverrides: { retirement: 1000 },
  })
  const goals = page.locator('#souhrn').getByTestId('cile-prehled')
  await expect(goals).toContainText(/Požadovaná renta.*vychází/)
  const verdict = page.locator('#souhrn').getByRole('heading', { name: /Máte na to|Zatím na to nemáte|Nejdřív/ })
  const before = await verdict.innerText()
  await page.locator('#tab-cile').click()
  await input(page, 'Požadovaná měsíční renta z vlastních úspor').fill('50000')
  await page.locator('#tab-souhrn').click()
  await expect(goals).toContainText(/Do požadované renty.*chybí/)
  expect(await verdict.innerText()).not.toBe(before)
  await expect(page.locator('#souhrn')).toContainText('Upravte důchodový plán, aby dosáhl na požadovanou rentu.')
})

test('bydlení uvádí energie po koupi a poplatky jako samostatnou informaci', async ({ page }) => {
  await openPlan(page, { goals: ['property'], savings: { totalSavings: 1500000 } })
  await page.locator('#tab-bydleni').click()
  await expect(page.getByText('Energie a poplatky:', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Náklady na vlastnictví (bez energií):', { exact: true })).toBeVisible()
  const fees = page.getByRole('complementary', { name: 'Informace o jednorázových nákladech koupě' })
  await expect(fees).toContainText('Pro vaši informaci')
  await expect(fees).toContainText('V časové ose, rezervě ani verdiktu se automaticky neodečítá')
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(fees).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
