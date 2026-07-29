import { test, type Page } from '@playwright/test'

/**
 * Průchod appkou v tmavém režimu, čtyři jiné scénáře než v `persony.e2e.ts`.
 *
 * Tmavý režim hlídal jen `kontrast.e2e.ts`, jenže ten měří barvu textu proti
 * podkladu. Že něco přeteče, překryje se nebo zůstane prázdné, o tom neřekne
 * nic. To se pozná jedině pohledem na otisk.
 *
 * Scénáře jsou schválně jiné než ve světlé sadě, aby při té příležitosti
 * prošly cesty, které zatím nikdo neprošel: rekonstrukce, samostatné vlastní
 * cíle, všechny čtyři cíle naráz a koupě, na kterou rozpočet nestačí.
 *
 * Jako testy nic netvrdí, jen projdou a udělají otisk. Soud je na oku.
 */

// Otisky jsou dražší než testy: každý mění velikost okna na celou výšku
// stránky a fotí ji. Ve výchozím třicetisekundovém limitu to při plné sadě
// se dvěma workery občas nestihly, přestože samotný průchod trvá osm vteřin
// a šest opakování za sebou prošlo.
test.describe.configure({ timeout: 90_000 })

const OUT = '/tmp/claude-0/-home-user-mamnato/ac41d95e-14fb-56b8-a040-5aa25aa88d4c/scratchpad'

const num = (page: Page, label: string) =>
  page.getByRole('textbox', { name: label, exact: true })

async function start(page: Page, width = 1280) {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
}

/**
 * Přepnutí záložky a počkání, až se grafy dokreslí.
 *
 * Recharts kreslí čáry animovaně 1,5 s. Otisk pořízený hned po kliknutí je
 * zachytí useknuté v půlce a vypadá to jako chybný výpočet; poprvé mě to
 * poslalo hledat chybu v projekci cíle, která žádná nebyla.
 */
async function openTab(page: Page, id: string) {
  await page.locator(`#tab-${id}`).click()
  await page.waitForTimeout(2200)
}

async function shot(page: Page, name: string) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  const w = page.viewportSize()!.width
  await page.setViewportSize({ width: w, height: Math.min(h, 3600) })
  await page.screenshot({ path: `${OUT}/tma-${name}.png` })
  await page.setViewportSize({ width: w, height: 900 })
}

test('persona 4: jednotlivec, drahý byt s rekonstrukcí', async ({ page }) => {
  await start(page)
  await page.getByTestId('wizard-next').click()
  await num(page, 'Můj čistý měsíční příjem').fill('85000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('20000')
  await num(page, 'Energie, voda a poplatky za bydlení').fill('5000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('1800000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('wizard-next').click()

  await num(page, 'Cílová cena nemovitosti').fill('7500000')
  await page.getByRole('button', { name: /Budu rekonstruovat/ }).click()
  await num(page, 'Rozpočet na rekonstrukci').fill('900000')
  await shot(page, '4-pruvodce-rekonstrukce')
  await page.getByTestId('wizard-next').click()

  await page.waitForTimeout(2200)
  await shot(page, '4-rekonstrukce')
  await openTab(page, 'bydleni')
  await shot(page, '4-bydleni')
})

test('persona 5: pár jen s vlastními cíli, bez bydlení', async ({ page }) => {
  await start(page)
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

  // Tři cíle, které se dohromady do rozpočtu nevejdou: to je jediný způsob,
  // jak se dostat na stavy „potřebuje víc času" a „nezbývají prostředky".
  const fill = async (i: number, name: string, amount: string, months: string) => {
    const card = page.locator('div.border.border-line.rounded-xl').nth(i)
    await card.getByRole('textbox').first().fill(name)
    await card.getByRole('textbox', { name: 'Cílová částka' }).fill(amount)
    await card.getByRole('textbox', { name: 'Za kolik měsíců' }).fill(months)
  }
  await fill(0, 'Auto', '600000', '18')
  await page.getByRole('button', { name: /Přidat další cíl/ }).click()
  await fill(1, 'Rezerva', '400000', '12')
  await page.getByRole('button', { name: /Přidat další cíl/ }).click()
  await fill(2, 'Svatba', '350000', '10')
  await shot(page, '5-pruvodce-cile')
  await page.getByTestId('wizard-next').click()

  await page.waitForTimeout(2200)
  await shot(page, '5-vlastni-cile')
  await openTab(page, 'cile')
  await shot(page, '5-cile-detail')
})

test('persona 6: rodina se všemi čtyřmi cíli naráz', async ({ page }) => {
  await start(page)
  await page.getByTestId('mode-family').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('38000')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('29000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('19000')
  await num(page, 'Energie, voda a poplatky za bydlení').fill('6000')
  await num(page, 'Stávající splátky úvěrů').fill('7000')
  await num(page, 'Výdaje na děti').fill('6000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('400000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('goal-other').click()
  await page.getByTestId('wizard-next').click()

  await num(page, 'Cílová cena nemovitosti').fill('5500000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()

  await page.waitForTimeout(2200)
  await shot(page, '6-vsechny-cile')
  await openTab(page, 'cokdyby')
  await shot(page, '6-cokdyby')
})

test('persona 6b: totéž na mobilu', async ({ page }) => {
  await start(page, 390)
  await page.getByTestId('mode-family').click()
  await page.getByTestId('wizard-next').click()
  await num(page, 'Čistý měsíční příjem: osoba 1').fill('38000')
  await num(page, 'Čistý měsíční příjem: osoba 2').fill('29000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('19000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('400000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()

  await page.waitForTimeout(2200)
  await shot(page, '6b-mobil')
})

test('persona 7: koupě, na kterou rozpočet nestačí', async ({ page }) => {
  // Úspory na akontaci stačí, splátka ne. Je to jediná cesta, jak se dostat
  // na větev rozpočtu „splátka a náklady na bydlení by přerostly příjem",
  // kterou zatím žádný průchod neviděl.
  await start(page)
  await page.getByTestId('wizard-next').click()
  await num(page, 'Můj čistý měsíční příjem').fill('30000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Nájem (bez energií a poplatků)').fill('12000')
  await page.getByTestId('wizard-next').click()
  await num(page, 'Celkové úspory').fill('3000000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('wizard-next').click()

  await num(page, 'Cílová cena nemovitosti').fill('9000000')
  await page.getByTestId('wizard-next').click()

  await page.waitForTimeout(2200)
  await shot(page, '7-nedosazitelna-koupe')
  await openTab(page, 'rozpocet')
  await shot(page, '7-rozpocet')
})
