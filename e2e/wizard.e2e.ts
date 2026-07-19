import { test, expect, type Page } from '@playwright/test'

// Přechod na další krok průvodce.
async function next(page: Page) {
  await page.getByRole('button', { name: /Další|Zobrazit výsledky/ }).last().click()
}

// Spustí průvodce z uvítací obrazovky (čistý kontext = tlačítko „Spustit přehled").
async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
}

// Kroky: 1 Režim → 2 Příjmy → 3 Výdaje → 4 Úspory → 5 Cíle.
// Z uvítání až na krok Cíle (4× další).
async function goToGoals(page: Page) {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await expect(page.getByText('Vaše finanční cíle')).toBeVisible()
}

test('projde průvodcem a zobrazí výsledky', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await expect(page.getByText('Váš finanční přehled')).toBeVisible()
})

test('věk do 36 let sníží povinnou akontaci na 10 %', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await page.getByLabel('Můj věk').fill('30')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost
  await expect(page.getByText(/Doporučená akontace \(10 %\)/)).toBeVisible()
})

test('výběr „Jiné" přidá krok vlastních cílů a název dorazí do výsledků', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Jiné/ }).first().click()
  await next(page) // → krok Vlastní cíle
  await expect(page.getByText('Vaše vlastní cíle')).toBeVisible()
  await page.getByPlaceholder(/Auto, dovolená, rezerva/).fill('Dovolená')
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await expect(page.getByText('Dovolená').first()).toBeVisible()
})

test('číselné pole jde smazat a napsat bez nuly vepředu', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await page.getByRole('button', { name: /Rozepsat zbytné výdaje/ }).click()
  const field = page.getByLabel('Kultura (kino, divadlo, knihy)')
  await field.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await expect(field).toHaveValue('')
  await field.pressSequentially('500')
  await expect(field).toHaveValue('500')
})

test('rodičovská: karta ukáže dopad na rozpočet u páru s cílem dítě', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /Jsme pár/ }).click()
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Dítě \/ rodina/ }).first().click()
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  // sekce „Cíle" je ve výchozím stavu sbalená → otevřít přes horní navigaci
  await page.getByRole('navigation').getByRole('button', { name: 'Cíle', exact: true }).click()
  await expect(page.getByText('Rodičovská: co udělá s rozpočtem')).toBeVisible()
  await page.getByRole('button', { name: /Spočítat dopad rodičovské/ }).click()
  await expect(page.getByText('Příjem během volna', { exact: true })).toBeVisible()
})

test('výsledky jsou v sekcích — „Bydlení" je sbalené a otevře se z navigace', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // krok Nemovitost
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await expect(page.getByText('Váš finanční přehled')).toBeVisible()
  // Souhrn je otevřený, detail bydlení sbalený
  await expect(page.getByRole('heading', { name: 'Kalkulačka nemovitosti' })).toBeHidden()
  await page.getByRole('navigation').getByRole('button', { name: 'Bydlení', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Kalkulačka nemovitosti' })).toBeVisible()
})

test('sdílený odkaz reprodukuje scénář v čistém prohlížeči', async ({ browser }) => {
  const ctx1 = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx1.newPage()
  await start(page)
  await next(page) // → Příjmy
  const income = page.locator('input[inputmode="decimal"]').first()
  await income.click()
  await page.keyboard.press('Control+a')
  await income.pressSequentially('54321')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await page.getByRole('button', { name: /Sdílet přehled/ }).click()
  await expect(page.getByText('Odkaz zkopírován')).toBeVisible()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('#s=')

  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(url)
  await expect(page2.getByText('Váš finanční přehled')).toBeVisible()
  await expect(page2.getByText(/54\s?321/).first()).toBeVisible()
  await ctx1.close()
  await ctx2.close()
})
