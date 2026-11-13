import { expect, test, type Page } from '@playwright/test'
import { createInitialState } from '../src/store/wizardStore'
import type { WizardState } from '../src/types'

const storageKey = 'mamnato_wizard_v1'
const ownIncome = 72000
const sharedIncome = 99000

function mortgagePlan(income: number, targetPrice: number): WizardState {
  return {
    ...createInitialState(),
    currentStep: 8,
    completedSteps: [1, 2, 3, 4, 5, 6],
    income: { person1NetMonthly: income },
    savings: { totalSavings: 1700000 },
    property: { targetPrice, mortgageRate: 0.048 },
    goals: ['property'],
  }
}

async function openSharedPlan(page: Page, sameDocument = false) {
  const own = mortgagePlan(ownIncome, 5000000)
  const shared = mortgagePlan(sharedIncome, 6000000)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sestavit finanční plán', exact: true })).toBeVisible()
  await page.evaluate(({ key, plan }) => localStorage.setItem(key, JSON.stringify(plan)), { key: storageKey, plan: own })
  if (!sameDocument) await page.goto('about:blank')
  await page.goto(`/#s=${Buffer.from(JSON.stringify(shared)).toString('base64url')}`)
  await expect(page.getByText(/přehled je z odkazu od někoho jiného/i)).toBeVisible()
}

const savedPlan = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as WizardState, storageKey)
const priceField = (page: Page) => page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true })

test('návrat ze sdíleného plánu opravdu otevře vlastní plán a další úprava ho nepřepíše', async ({ page }) => {
  await openSharedPlan(page, true)
  await page.getByRole('button', { name: 'Zpět na můj přehled', exact: true }).click()
  await expect(page.getByText(/přehled je z odkazu od někoho jiného/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Upravit údaje', exact: true }).click()
  await expect(priceField(page)).toHaveValue(/5\D000\D000/)
  await priceField(page).fill('5100000')
  await page.getByRole('button', { name: 'Zpět na přehled', exact: true }).click()
  await expect(page.getByTestId('results')).toBeVisible()
  await expect.poll(() => savedPlan(page)).toMatchObject({
    currentStep: 8,
    income: { person1NetMonthly: ownIncome },
    property: { targetPrice: 5100000 },
  })
})

test('sdílený plán má vlastní editaci a potvrzení uloží právě upravenou verzi', async ({ page }) => {
  await openSharedPlan(page)
  await page.getByRole('button', { name: 'Upravit údaje', exact: true }).click()
  await expect(priceField(page)).toHaveValue(/6\D000\D000/)
  await priceField(page).fill('6100000')
  await page.getByRole('button', { name: 'Zpět na přehled', exact: true }).click()
  await expect(page.getByTestId('results')).toBeVisible()
  expect(await savedPlan(page)).toMatchObject({
    income: { person1NetMonthly: ownIncome },
    property: { targetPrice: 5000000 },
  })

  await page.getByRole('button', { name: 'Uložit tenhle a přepsat svůj', exact: true }).click()
  await expect(page.getByText(/přehled je z odkazu od někoho jiného/i)).toHaveCount(0)
  expect(await savedPlan(page)).toMatchObject({
    currentStep: 8,
    income: { person1NetMonthly: sharedIncome },
    property: { targetPrice: 6100000 },
  })
  await page.reload()
  await page.getByRole('button', { name: 'Pokračovat tam, kde jste skončili', exact: true }).click()
  await page.getByRole('button', { name: 'Upravit údaje', exact: true }).click()
  await expect(priceField(page)).toHaveValue(/6\D100\D000/)
})

test('akontace se při psaní úspor nezmenší kvůli neúplnému číslu', async ({ page }) => {
  const plan = mortgagePlan(ownIncome, 6000000)
  plan.savings.downPaymentFromSavings = 1300000
  await page.goto(`/#s=${Buffer.from(JSON.stringify(plan)).toString('base64url')}`)
  await page.getByRole('button', { name: 'Upravit údaje', exact: true }).click()
  await page.getByRole('button', { name: /Zpět na krok 4/ }).click()
  const savings = page.getByRole('textbox', { name: 'Celkové úspory', exact: true })

  await savings.fill('')
  await savings.pressSequentially('1800000')
  await page.getByTestId('wizard-next').click()
  expect(await savedPlan(page)).toMatchObject({ savings: { totalSavings: 1800000, downPaymentFromSavings: 1300000 } })

  await page.getByRole('button', { name: /Zpět na krok 4/ }).click()
  await savings.fill('200000')
  await page.getByTestId('wizard-next').click()
  expect(await savedPlan(page)).toMatchObject({ savings: { totalSavings: 200000, downPaymentFromSavings: 200000 } })
})
