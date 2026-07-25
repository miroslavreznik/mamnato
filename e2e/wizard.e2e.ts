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

// Odhadovaná měsíční splátka z karty nemovitosti jako číslo.
async function monthlyPayment(page: Page): Promise<number> {
  const row = page.getByText('Odhadovaná měsíční splátka').locator('xpath=..')
  const text = (await row.textContent()) ?? ''
  const match = text.match(/([\d\s\u00a0\u202f]+)\s*Kč\/měs/)
  return Number((match?.[1] ?? '').replace(/[\s\u00a0\u202f]/g, ''))
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
  // Pole má vedle sebe krokovací tlačítka se stejným názvem, proto exact.
  await page.getByRole('textbox', { name: 'Můj věk', exact: true }).fill('30')
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
  await field.fill('')
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
  await expect(page.getByText('Volná rezerva během volna')).toBeVisible()
  // Fixní balík rodičovské: kratší volno → vyšší měsíční dávka (350 000 / 18 ≈ 19 444)
  const duration = page.getByRole('textbox', { name: 'Délka volna v měsících', exact: true })
  await duration.fill('18')
  await expect(page.getByRole('textbox', { name: 'Měsíční příjem během volna', exact: true })).toHaveValue(/19.444/)
})

test('výsledky jsou v sekcích, „Bydlení" je sbalené a otevře se z navigace', async ({ page }) => {
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

test('odškrtnutí výdaje v grafu přepočítá celý souhrn (dynamické výsledky)', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  // výchozí jednotlivec: příjem 39 500, výdaje 29 000 → disponibilní +10 500
  await expect(page.getByText(/\+10.500/).first()).toBeVisible()
  // odškrtnout zbytné výdaje (3 000) v grafu rozpočtu → disponibilní +13 500
  await page.getByRole('button', { name: /Zbytné/ }).first().click()
  await expect(page.getByText(/\+13.500/).first()).toBeVisible()
  // tabulková podoba rozpočtu (nahrazuje bývalou sekci „Podrobný rozpočet")
  await page.getByRole('button', { name: 'Zobrazit čísla v tabulce' }).click()
  await expect(page.getByText('= Volná rezerva')).toBeVisible()
})

test('částka na cíl se nastavuje v kartě cíle a promítne se do rozpočtu', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  // Částka patří ke svému cíli, ne do rozpočtu
  await page.getByRole('navigation').getByRole('button', { name: 'Cíle', exact: true }).click()
  const amount = page.getByRole('textbox', { name: 'Měsíční částka k investování', exact: true })
  await amount.fill('5000')
  // Nejdřív ověřit, že se hodnota opravdu zapsala, jinak by následná kontrola
  // rozpočtu selhala jen kvůli pomalejšímu vykreslení.
  await expect(amount).toHaveValue(/5.?000/)

  // Rozpočet to musí zohlednit: 39 500 − 29 000 − 5 000 = 5 500 volných
  await page.getByRole('navigation').getByRole('button', { name: 'Souhrn', exact: true }).click()
  await expect
    .poll(async () => /zbývá vám ještě\s*5.500/.test(await page.locator('#souhrn').innerText()), { timeout: 10_000 })
    .toBe(true)
})

test('akontací jde hýbat ve výsledcích a přepočítá hypotéku', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  const savings = page.locator('input[inputmode="decimal"]').first()
  await savings.fill('1000000')
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Bydlení', exact: true }).click()
  // posuvník akontace ve výsledcích → hypotéka = 5 500 000 − 200 000
  await page.getByRole('slider', { name: 'Akontace z úspor' }).fill('200000')
  await expect(page.getByText(/5\s?300\s?000 Kč/).first()).toBeVisible()
  // rozhodovací nápovědy u posuvníku
  await expect(page.getByText(/Každých \+100 000 Kč akontace/)).toBeVisible()
  await expect(page.getByText(/Alternativa:/)).toBeVisible()
  await expect(page.getByText(/Bezpečné maximum|za bezpečnou hranicí|6měsíční rezervu/).first()).toBeVisible()
})

test('sazbou jde hýbat ve výsledcích a radí podle LTV', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  const savings = page.locator('input[inputmode="decimal"]').first()
  await savings.fill('1500000')
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Bydlení', exact: true }).click()

  // Výchozí akontace = povinné minimum 1,1 M z 5,5 M → LTV přesně 80 %
  await expect(page.getByText(/Vaše LTV je 80 %/)).toBeVisible()
  // Vyšší sazba → vyšší splátka (5,2 % → 7 % na úvěru 4,4 M)
  const before = await monthlyPayment(page)
  await page.getByRole('slider', { name: 'Úroková sazba' }).fill('7')
  await expect(page.getByText(/7,0 % ročně/).first()).toBeVisible()
  expect(await monthlyPayment(page)).toBeGreaterThan(before)
  // Nižší akontace → horší pásmo LTV a tip, kolik doplatit
  await page.getByRole('slider', { name: 'Akontace z úspor' }).fill('600000')
  await expect(page.getByText(/Vaše LTV je 89 %/)).toBeVisible()
  await expect(page.getByText(/dostanete se pod 80 % LTV/)).toBeVisible()
  await expect(page.getByText(/Riziko refixace/)).toBeVisible()
})

test('ve výsledcích jdou hodnoty měnit tlačítky + a − i na mobilu', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true })
  const page = await ctx.newPage()
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  // Krokování částky na cíl v jeho vlastní kartě (krok 500 Kč).
  // Porovnáváme čísla, ne řetězce: oddělovač tisíců je úzká nezlomitelná mezera.
  await page.getByRole('navigation').getByRole('button', { name: 'Cíle', exact: true }).click()
  const budget = page.getByRole('textbox', { name: 'Měsíční částka k investování', exact: true })
  await budget.scrollIntoViewIfNeeded()
  const amount = async () => Number((await budget.inputValue()).replace(/[^\d]/g, ''))
  const before = await amount()
  await page.getByRole('button', { name: 'Zvýšit: Měsíční částka k investování' }).click()
  await expect.poll(amount).toBe(before + 500)
  await page.getByRole('button', { name: 'Snížit: Měsíční částka k investování' }).click()
  await expect.poll(amount).toBe(before)

  // Stránka se na mobilu nesmí rolovat do šířky
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // Nápověda musí jít otevřít klepnutím (na dotyku není hover) a zase zavřít
  const help = page.getByRole('button', { name: 'Nápověda' }).first()
  await help.scrollIntoViewIfNeeded()
  await help.tap()
  await expect(page.getByRole('tooltip').first()).toBeVisible()
  await help.tap()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await ctx.close()
})

test('výsledky začínají přímou odpovědí Máte na to', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  // Odpověď musí být první a nejvýraznější věc v souhrnu
  const verdict = page.getByText(/^(Máte na to|Zatím na to nemáte|Rozpočet)/).first()
  await expect(verdict).toBeVisible()

  // Až za odpovědí následuje rozbor
  await expect(page.getByText(/Disponibilní částka/)).toBeVisible()
})

test('rozpočet umí co kdyby: vypnutí cíle změní celkovou odpověď', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  // Nízký příjem, aby se rezerva na dítě do rozpočtu nevešla
  await page.locator('input[inputmode="decimal"]').first().fill('33000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Dítě \/ rodina/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  await expect(page.getByText(/Zatím na to nemáte/).first()).toBeVisible()

  // Vypnutí cíle „dítě" musí odpověď zlepšit a říct to
  await page.getByRole('button', { name: /Rezerva na dítě/ }).click()
  await expect(page.getByText(/Bez vypnutých položek:/)).toBeVisible()
  await expect(page.getByText(/Pomohlo to\. Původně:/)).toBeVisible()

  // Vrácení zpět obnoví původní stav
  await page.getByRole('button', { name: 'Vrátit vše zpět' }).click()
  await expect(page.getByText(/Bez vypnutých položek:/)).toBeHidden()
})

test('bez podrobného rozpisu se jednotlivé zbytné položky nenabízejí', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()
  await expect(page.getByText('Z toho zbytné podrobně')).toBeHidden()
})

test('s podrobným rozpisem jde vypnout jedna zbytná položka', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await page.getByRole('button', { name: /Rozepsat zbytné výdaje/ }).click()
  await page.getByLabel('Zahraniční rekreace').fill('4000')
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Důchod \/ stáří/ }).first().click()
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  await expect(page.getByText('Z toho zbytné podrobně')).toBeVisible()

  const free = async () => {
    // Mezi popiskem a částkou je ještě ikonka nápovědy, proto [^\d]*
    const m = (await page.locator('#souhrn').innerText())
      .match(/Volná rezerva nyní[^\d]*([\d\s\u00a0\u202f]+)/)
    return Number((m?.[1] ?? '').replace(/[^\d]/g, ''))
  }
  const before = await free()
  // Vypnutím položky za 4 000 Kč vzroste volná rezerva přesně o 4 000 Kč
  await page.getByRole('button', { name: /Zahraniční rekreace/ }).click()
  await expect.poll(free).toBe(before + 4000)
})

test('výsledky obsahují právní upozornění včetně rozbalitelných podmínek', async ({ page }) => {
  await goToGoals(page)
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost
  await page.getByRole('button', { name: /Zobrazit výsledky/ }).click()

  // Jádro upozornění musí být vidět bez rozklikávání
  await expect(page.getByText(/orientační modelové výpočty/)).toBeVisible()
  await expect(page.getByText(/Nejde o finanční, investiční, úvěrové ani daňové poradenství/)).toBeVisible()

  // Podrobnosti se rozbalí a pokrývají oba klíčové zákony i varování u sdílení
  await page.getByRole('button', { name: 'Zobrazit podrobné podmínky' }).click()
  await expect(page.getByText(/256\/2004 Sb\./)).toBeVisible()
  await expect(page.getByText(/257\/2016 Sb\./)).toBeVisible()
  await expect(page.getByText(/uvidí vaše příjmy, výdaje i úspory/)).toBeVisible()
})

test('při neočekávané chybě se ukáže záchranná obrazovka, ne bílá stránka', async ({ page }) => {
  // Simulace skutečné runtime chyby: formátování čísel se v renderu používá
  // napříč komponentami, takže výjimka v něm spolehlivě shodí strom.
  await page.addInitScript(() => {
    Number.prototype.toLocaleString = function () {
      throw new Error('simulovaná chyba pro test')
    }
  })
  await start(page)
  await next(page) // → Příjmy (první krok, kde se formátují čísla)

  await expect(page.getByText('Něco se pokazilo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Smazat data a začít znovu/ })).toBeVisible()
  // Uživatel musí vidět, že o data nepřišel
  await expect(page.getByText(/nikam se neodeslala/)).toBeVisible()
})

test('sdílený odkaz reprodukuje scénář v čistém prohlížeči', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const page = await ctx1.newPage()
  // WebKit nezná oprávnění clipboard-*, tak schránku nahradíme vlastní
  // implementací. Testuje se tím pořád stejná logika sdílení.
  await page.addInitScript(() => {
    const store = { text: '' }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (t: string) => { store.text = t },
        readText: async () => store.text,
      },
    })
  })
  await start(page)
  await next(page) // → Příjmy
  const income = page.locator('input[inputmode="decimal"]').first()
  await income.fill('54321')
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

test('kurzor zůstane tam, kde uživatel maže, a nespadne za poslední nulu', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost

  const price = page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true })
  await price.fill('12000000')

  // Kurzor za druhou číslici, smazat „2" a napsat „0": z 12 000 000 má být
  // 10 000 000. Dřív kurzor po smazání odskočil na konec a vzniklo 1 000 0000.
  await price.click()
  await price.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 2))
  await page.keyboard.press('Backspace')
  await page.keyboard.type('0')

  const digits = async () => Number(((await price.inputValue()) ?? '').replace(/\D/g, ''))
  await expect.poll(digits).toBe(10000000)
})

test('délka fixace mění nabízenou sazbu i splátku', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await page.getByRole('button', { name: /Nemovitost/ }).first().click()
  await next(page) // → krok Nemovitost

  const fixation = page.getByLabel('Doba fixace úrokové sazby')
  const rate = page.getByRole('textbox', { name: 'Úroková sazba hypotéky', exact: true })

  // Splátka ze souhrnu pod formulářem (v kroku průvodce je bez „/měs.").
  const payment = async () => {
    const row = page.getByText('Odhadovaná měsíční splátka:').locator('xpath=..')
    return Number(((await row.textContent()) ?? '').replace(/\D/g, ''))
  }

  await fixation.selectOption('3')
  await expect(rate).toHaveValue('4,7')
  const cheapFix = await payment()

  await fixation.selectOption('10')
  await expect(rate).toHaveValue('5,3')
  expect(await payment()).toBeGreaterThan(cheapFix)

  // Ručně zadaná sazba má přednost, fixace s ní přestane hýbat.
  await rate.fill('3')
  await rate.blur()
  await fixation.selectOption('1')
  await expect(rate).toHaveValue('3')
  await expect(page.getByText(/Sazbu máte zadanou ručně/)).toBeVisible()
})
