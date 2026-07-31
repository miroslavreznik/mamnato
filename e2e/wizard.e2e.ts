import { test, expect, type Page } from '@playwright/test'

/**
 * Kotvy, které přežijí redesign.
 *
 * Navigace, cíle, režim a záložky se hledají přes `data-testid` (a u záložek
 * přes `id`, které stejně drží `aria-labelledby`). Popisky, ikony i rozvržení
 * se změnou vzhledu klidně změní, ale chování zůstane; test o tom, jestli
 * průvodce dojde na výsledky, nemá padat kvůli tomu, že se tlačítko
 * přejmenovalo.
 *
 * Naopak texty, které jsou samy předmětem testu (verdikt, varování, částky),
 * se dál hledají podle znění. Tam je to znění to, co se ověřuje.
 */

// Přechod na další krok průvodce. Na posledním kroku se tlačítko jmenuje
// „Zobrazit výsledky", ale je to pořád ono.
async function next(page: Page) {
  await page.getByTestId('wizard-next').click()
}

// Poslední krok: odeslání do výsledků. Jméno má jen kvůli čitelnosti testů.
const finish = next

// Zapnutí nebo vypnutí cíle na kroku Cíle.
async function pickGoal(page: Page, goal: 'property' | 'retirement' | 'child' | 'other') {
  await page.getByTestId(`goal-${goal}`).click()
}

// Přepnutí záložky výsledků.
async function openTab(page: Page, id: 'souhrn' | 'rozpocet' | 'bydleni' | 'cile' | 'slovnicek') {
  await page.locator(`#tab-${id}`).click()
}

// „Jsme na výsledcích." Dřív se to poznávalo podle nadpisu „Váš finanční plán",
// jenže ten se sloučením horní lišty zrušil a shodil dvacet testů naráz.
async function expectResults(page: Page) {
  await expect(page.getByTestId('results')).toBeVisible()
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
  await pickGoal(page, 'retirement')
  await finish(page)
  await expectResults(page)
})

test('věk do 36 let sníží povinnou akontaci na 10 %', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  // Pole má vedle sebe krokovací tlačítka se stejným názvem, proto exact.
  await page.getByRole('textbox', { name: 'Můj věk', exact: true }).fill('30')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await expect(page.getByText(/Doporučená akontace \(10 %\)/)).toBeVisible()
})

test('výběr „Jiné" přidá krok vlastních cílů a název dorazí do výsledků', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'other')
  await next(page) // → krok Vlastní cíle
  await expect(page.getByText('Vaše vlastní cíle')).toBeVisible()
  await page.getByPlaceholder(/Auto, dovolená/).fill('Dovolená')
  await finish(page)
  await openTab(page, 'cile')
  await expect(page.getByPlaceholder(/Auto, dovolená/)).toHaveValue('Dovolená')
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
  await pickGoal(page, 'child')
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)
  // sekce „Cíle" je ve výchozím stavu sbalená → otevřít přes horní navigaci
  await openTab(page, 'cile')
  // Rodičovská se s cílem „dítě" zapíná sama: je to nejdražší položka plánu
  // a za tlačítkem na podzáložce ji většina lidí nenašla.
  await expect(page.getByText('Rodičovská: co udělá s rozpočtem')).toBeVisible()
  await expect(page.getByRole('button', { name: /Spočítat dopad rodičovské/ })).toHaveCount(0)
  await expect(page.getByText('Volná rezerva během rodičovské')).toBeVisible()

  // Volno má dvě fáze: mateřská je vyšší a kratší, rodičovský příspěvek nižší.
  // Rozpis fází je i v kartě předpokladů, proto se míří jen do téhle karty.
  const phases = page.getByText('Dávky se v čase mění').locator('xpath=..')
  await expect(phases).toBeVisible()
  await expect(phases.getByText(/Mateřská \(prvních 28 týdnů\)/)).toBeVisible()
  await expect(phases.getByText(/Rodičovský příspěvek \(\d+ měs\.\)/)).toBeVisible()

  // Fixní balík rodičovské: kratší volno → vyšší dávka ve druhé fázi.
  const benefit = page.getByRole('textbox', { name: 'Měsíční příjem během rodičovské', exact: true })
  const asNumber = async () => Number((await benefit.inputValue()).replace(/\D/g, ''))
  const before = await asNumber()
  await page.getByRole('textbox', { name: 'Délka rodičovské v měsících', exact: true }).fill('18')
  await expect.poll(asNumber).toBeGreaterThan(before)
})

test('výsledky jsou v sekcích, „Bydlení" je sbalené a otevře se z navigace', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'property')
  await next(page) // krok Vlastní bydlení
  await finish(page)
  await expectResults(page)
  // Souhrn je otevřený, detail bydlení sbalený
  await expect(page.getByRole('heading', { name: 'Kalkulačka nemovitosti' })).toBeHidden()
  await openTab(page, 'bydleni')
  await expect(page.getByRole('heading', { name: 'Kalkulačka nemovitosti' })).toBeVisible()
})

test('odškrtnutí výdaje v grafu přepočítá celý souhrn (dynamické výsledky)', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)
  // výchozí jednotlivec: příjem 39 500, výdaje 29 000 → disponibilní +10 500
  await expect(page.getByText(/\+10.500/).first()).toBeVisible()
  // odškrtnout zbytné výdaje (3 000) v grafu rozpočtu → disponibilní +13 500
  await openTab(page, 'rozpocet')
  await page.getByRole('button', { name: /Zábava, dovolená, koníčky/ }).first().click()
  await openTab(page, 'souhrn')
  await expect(page.getByText(/\+13.500/).first()).toBeVisible()
  await openTab(page, 'rozpocet')
  // tabulková podoba rozpočtu (nahrazuje bývalou sekci „Podrobný rozpočet")
  await page.getByRole('button', { name: 'Zobrazit čísla v tabulce' }).click()
  await expect(page.getByText('= Volná rezerva')).toBeVisible()
})

test('částka na cíl se nastavuje v kartě cíle a promítne se do rozpočtu', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)

  // Částka patří ke svému cíli, ne do rozpočtu
  await openTab(page, 'cile')
  const amount = page.getByRole('textbox', { name: 'Měsíční částka k investování', exact: true })
  await amount.fill('5000')
  // Nejdřív ověřit, že se hodnota opravdu zapsala, jinak by následná kontrola
  // rozpočtu selhala jen kvůli pomalejšímu vykreslení.
  await expect(amount).toHaveValue(/5.?000/)

  // Rozpočet to musí zohlednit: 39 500 − 29 000 − 5 000 = 5 500 volných
  await openTab(page, 'souhrn')
  await expect
    .poll(async () => /volných zůstává\s*5.500/.test(await page.locator('#souhrn').innerText()), { timeout: 10_000 })
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
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)
  await openTab(page, 'bydleni')
  // posuvník akontace ve výsledcích → hypotéka = 5 500 000 − 200 000
  await page.getByRole('slider', { name: 'Akontace z úspor' }).fill('200000')
  await expect(page.getByText(/5\s?300\s?000 Kč/).first()).toBeVisible()
  // rozhodovací nápovědy u posuvníku
  // Oddělovač tisíců je nezlomitelná mezera, proto \s a ne obyčejná mezera.
  await expect(page.getByText(/Každých \+100\s000\s?Kč akontace/)).toBeVisible()
  await expect(page.getByText(/Alternativa:/)).toBeVisible()
  await expect(page.getByText(/Bezpečné maximum|za bezpečnou hranicí|6měsíční rezervu/).first()).toBeVisible()
})

test('souhrn ukáže rozpočet dnes i po koupi a odkládání na akontaci', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)

  // Rozpočtová věta svítí i tomu, kdo si zvolil jen nemovitost, a má dvě období.
  // „Po koupi" je i v grafu rozpočtu, proto se míří jen do téhle kartičky.
  const rozpocet = page.locator('#souhrn').getByText('Měsíční rozpočet').locator('xpath=..')
  await expect(rozpocet).toBeVisible()
  await expect(rozpocet.getByText('Dnes', { exact: true })).toBeVisible()
  await expect(rozpocet.getByText('Po koupi', { exact: true })).toBeVisible()
  await expect(rozpocet.getByText(/Na akontaci už se neodkládá|Pomohla by levnější nemovitost/)).toBeVisible()

  // Po koupi zbývá míň než dnes: nájem vystřídá vyšší splátka s náklady na
  // vlastnictví. Záporná částka má české minus (U+2212), ne spojovník.
  const disposableIn = async (period: string) => {
    const text = await rozpocet.getByText(period, { exact: true }).locator('xpath=..').innerText()
    const match = text.match(/(−?[\d\s]+)\s*Kč/)
    const digits = Number((match?.[1] ?? '').replace(/\D/g, ''))
    return match?.[1].startsWith('−') ? -digits : digits
  }
  expect(await disposableIn('Po koupi')).toBeLessThan(await disposableIn('Dnes'))

  // Odkládání na akontaci je cíl s vlastním posuvníkem a termínem.
  await openTab(page, 'bydleni')
  const bydleni = page.locator('#bydleni')
  const saving = bydleni.getByRole('slider', { name: 'Měsíční odkládání na akontaci' })
  await saving.fill('10000')
  await expect(bydleni.getByText(/naspoříte za/).first()).toBeVisible()
})

test('sazbou jde hýbat ve výsledcích a radí podle LTV', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  const savings = page.locator('input[inputmode="decimal"]').first()
  await savings.fill('1500000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)
  await openTab(page, 'bydleni')

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
  await pickGoal(page, 'retirement')
  await finish(page)

  // Krokování částky na cíl v jeho vlastní kartě (krok 500 Kč).
  // Porovnáváme čísla, ne řetězce: oddělovač tisíců je úzká nezlomitelná mezera.
  await openTab(page, 'cile')
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

  // Nápověda musí jít otevřít klepnutím (na dotyku není hover) a zase zavřít.
  // Skryté záložky zůstávají v DOM, proto se míří do té zobrazené; dlaždice
  // v souhrnu mají nápovědu vždycky.
  await openTab(page, 'souhrn')
  const help = page.locator('#souhrn').getByRole('button', { name: 'Nápověda' }).first()
  await help.scrollIntoViewIfNeeded()
  await help.tap()
  await expect(page.getByRole('tooltip').first()).toBeVisible()
  await help.tap()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await ctx.close()
})

test('výsledky začínají přímou odpovědí Máte na to', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)

  // Odpověď musí být první a nejvýraznější věc v souhrnu
  const verdict = page.getByText(/^(Máte na to|Zatím na to nemáte|Rozpočet)/).first()
  await expect(verdict).toBeVisible()

  // Až za odpovědí následuje rozbor. Stejný pojem je i ve slovníčku,
  // proto se míří do souhrnu.
  await expect(page.locator('#souhrn').getByText(/Disponibilní částka/)).toBeVisible()
})

test('rozpočet umí co kdyby: vypnutí cíle změní celkovou odpověď', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  // Nízký příjem, aby se rezerva na dítě do rozpočtu nevešla
  await page.locator('input[inputmode="decimal"]').first().fill('33000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'child')
  await finish(page)

  await expect(page.getByText(/Zatím na to nemáte/).first()).toBeVisible()

  // Vypnutí cíle „dítě" musí odpověď zlepšit a říct to
  await openTab(page, 'rozpocet')
  await page.getByRole('button', { name: /Rezerva na dítě/ }).click()
  await expect(page.getByText(/Bez vypnutých položek:/)).toBeVisible()
  await expect(page.getByText(/Pomohlo to\. Původně:/)).toBeVisible()

  // Vrácení zpět obnoví původní stav
  await page.getByRole('button', { name: 'Vrátit vše zpět' }).click()
  await expect(page.getByText(/Bez vypnutých položek:/)).toBeHidden()
})

test('bez podrobného rozpisu se jednotlivé zbytné položky nenabízejí', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)
  await openTab(page, 'rozpocet')
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
  await pickGoal(page, 'retirement')
  await finish(page)
  await openTab(page, 'rozpocet')

  await expect(page.getByText('Z toho zbytné podrobně')).toBeVisible()

  const free = async () => {
    // Mezi popiskem a částkou je ještě ikonka nápovědy, proto [^\d]*
    const m = (await page.locator('#rozpocet').innerText())
      .match(/Volná rezerva nyní[^\d]*([\d\s\u00a0\u202f]+)/)
    return Number((m?.[1] ?? '').replace(/[^\d]/g, ''))
  }
  const before = await free()
  // Vypnutím položky za 4 000 Kč vzroste volná rezerva přesně o 4 000 Kč.
  // Přepínač v grafu se pozná podle částky v závorce: editor výdajů níž má
  // u téže položky krokovací tlačítka „Snížit: …" a „Zvýšit: …".
  await page.getByRole('button', { name: /^Zahraniční rekreace \(/ }).click()
  await expect.poll(free).toBe(before + 4000)
})

test('výsledky obsahují právní upozornění včetně rozbalitelných podmínek', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)

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
  // Stačí vstoupit do průvodce: průběžný náhled ve spodní liště formátuje
  // částky už na prvním kroku. Dřív se muselo o krok dál, protože do té doby
  // se žádné číslo nesázelo.
  await start(page)

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
  await pickGoal(page, 'retirement')
  await finish(page)
  // Sdílení se od té doby ptá, co v odkazu bude; kopíruje až potvrzení.
  await page.getByRole('button', { name: /Sdílet přehled/ }).click()
  await page.getByRole('button', { name: 'Zkopírovat odkaz' }).click()
  await expect(page.getByText('Odkaz zkopírován')).toBeVisible()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('#s=')

  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(url)
  await expectResults(page2)
  await openTab(page2, 'rozpocet')
  await expect(page2.locator('#rozpocet').getByText(/54\s?321/).first()).toBeVisible()
  await ctx1.close()
  await ctx2.close()
})

test('kurzor zůstane tam, kde uživatel maže, a nespadne za poslední nulu', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení

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
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení

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

test('schodek na rodičovské krytý úsporami neshodí verdikt', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /Jsme pár/ }).click()
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Čistý měsíční příjem: osoba 1', exact: true }).fill('57000')
  await page.getByRole('textbox', { name: 'Čistý měsíční příjem: osoba 2', exact: true }).fill('100000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.locator('input[inputmode="decimal"]').first().fill('4800000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await pickGoal(page, 'child')
  await next(page) // → krok Vlastní bydlení
  await page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true }).fill('12500000')
  await finish(page)

  // Doma zůstane ten s vyšším příjmem → během rodičovské vzniká měsíční schodek,
  // rezerva po akontaci ho ale pokryje. Verdikt to musí zohlednit.
  await openTab(page, 'cile')
  await page.getByRole('button', { name: /Osoba 2/ }).click()

  await openTab(page, 'souhrn')
  await expect(page.getByText('Máte na to').first()).toBeVisible()
  await expect(page.getByText(/během rodičovské budete sahat do úspor/i)).toBeVisible()
})

test('rekonstrukce se přičte k investici a během ní se platí jen úrok', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.locator('input[inputmode="decimal"]').first().fill('3000000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení

  await page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true }).fill('10000000')
  const requiredDp = async () =>
    Number(((await page.getByText(/Doporučená akontace/).locator('xpath=..').textContent()) ?? '').replace(/\D/g, ''))
  const before = await requiredDp()

  // Ve výchozím stavu se na rekonstrukci nikdo neptá, je to jen odkaz.
  await page.getByRole('button', { name: '+ Budu rekonstruovat' }).click()
  await page.getByRole('textbox', { name: 'Rozpočet na rekonstrukci', exact: true }).fill('2500000')

  // Akontace se počítá z celé investice, takže povyskočí.
  await expect.poll(requiredDp).toBeGreaterThan(before)
  // A během rekonstrukce se platí jen úrok z vyčerpané části.
  await expect(page.getByText(/Během rekonstrukce zaplatíte bance míň/)).toBeVisible()
})

test('report uvádí předpoklady výpočtu včetně toho, kdo jde na rodičovskou', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /Jsme pár/ }).click()
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Čistý měsíční příjem: osoba 2', exact: true }).fill('100000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await pickGoal(page, 'child')
  await next(page) // → krok Vlastní bydlení
  await finish(page)

  // Vybraná volba nesmí být poznat jen podle barvy, kvůli tisku i odečítači.
  await openTab(page, 'cile')
  await expect(page.getByRole('button', { name: /Osoba 1/ })).toHaveAttribute('aria-pressed', 'true')

  // <summary> se v accessibility stromu neexponuje jako tlačítko.
  await page.locator('summary', { hasText: 'Z čeho přehled počítá' }).click()
  // Stejný seznam je i ve verzi jen pro tisk, proto .first().
  const assumptions = page.locator('details', { hasText: 'Z čeho přehled počítá' })
  await expect(assumptions.getByText('Na rodičovské zůstane')).toBeVisible()
  await expect(assumptions.getByText(/Osoba 1 \(příjem/)).toBeVisible()
  await expect(assumptions.getByText('Úroková sazba')).toBeVisible()
})

test('sdílený odkaz nepřepíše data příjemce bez potvrzení', async ({ browser }) => {
  // Odesílatel: scénář s výrazným příjmem, ze kterého vznikne odkaz.
  const senderCtx = await browser.newContext()
  const sender = await senderCtx.newPage()
  await sender.addInitScript(() => {
    const store = { text: '' }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (t: string) => { store.text = t },
        readText: async () => store.text,
      },
    })
  })
  await start(sender)
  await next(sender) // → Příjmy
  await sender.locator('input[inputmode="decimal"]').first().fill('98765')
  await next(sender) // → Výdaje
  await next(sender) // → Úspory
  await next(sender) // → Cíle
  await pickGoal(sender, 'retirement')
  await finish(sender)
  await sender.getByRole('button', { name: /Sdílet přehled/ }).click()
  await sender.getByRole('button', { name: 'Zkopírovat odkaz' }).click()
  const sharedUrl = await sender.evaluate(() => navigator.clipboard.readText())

  // Příjemce si nejdřív udělá vlastní přehled s jiným příjmem.
  const recipientCtx = await browser.newContext()
  const recipient = await recipientCtx.newPage()
  await start(recipient)
  await next(recipient) // → Příjmy
  await recipient.locator('input[inputmode="decimal"]').first().fill('12345')
  await next(recipient) // → Výdaje
  await next(recipient) // → Úspory
  await next(recipient) // → Cíle
  await pickGoal(recipient, 'retirement')
  await finish(recipient)
  const saved = () => recipient.evaluate(() => localStorage.getItem('mamnato_wizard_v1'))
  expect(await saved()).toContain('12345')

  // Otevře cizí odkaz: vidí cizí přehled, ale svoje data má pořád uložená.
  // Mezikrok přes about:blank je nutný, jinak by šlo jen o změnu fragmentu
  // v rámci téhož dokumentu a stránka by se vůbec nenačetla znovu.
  await recipient.goto('about:blank')
  await recipient.goto(sharedUrl)
  await expect(recipient.getByText(/přehled je z odkazu od někoho jiného/i)).toBeVisible()
  expect(await saved()).toContain('12345')

  // Ani úprava hodnot v cizím přehledu nesmí jeho data přepsat.
  await openTab(recipient, 'cile')
  await recipient.getByRole('textbox', { name: 'Měsíční částka k investování', exact: true }).fill('4321')
  expect(await saved()).toContain('12345')

  // Návrat ke svému přehledu data zachová.
  await recipient.getByRole('button', { name: /Zpět na můj přehled/ }).click()
  expect(await saved()).toContain('12345')

  await senderCtx.close()
  await recipientCtx.close()
})

test('graf koupě vs. nájem vysvětlí čáry i závěr', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.locator('input[inputmode="decimal"]').first().fill('1500000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → krok Vlastní bydlení
  await finish(page)
  await openTab(page, 'bydleni')

  // Všechny tři čáry jsou vysvětlené, ne jen pojmenované v legendě.
  await expect(page.getByText(/Koupě vs\. nájem: vývoj čistého jmění/)).toBeVisible()
  await expect(page.getByText(/Nájem bez investování:/)).toBeVisible()
  await expect(page.getByText(/ušetřený rozdíl se utratí/)).toBeVisible()

  // A pod grafem je závěr slovy, ne jen tři čáry k luštění.
  await expect(page.getByText(/Za 30 let:/)).toBeVisible()
  await expect(page.getByText(/vychází o .* líp než|vycházejí zhruba nastejno/)).toBeVisible()

  // Parametry mají srozumitelné popisky bez žargonu.
  await expect(page.getByRole('textbox', { name: 'Výnos investic', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'O kolik ročně poroste nájem', exact: true })).toBeVisible()
})

test('průběžný náhled reaguje na psaní ještě v průvodci', async ({ page }) => {
  // Hlavní zlepšení průvodce: dopad každé změny je vidět hned, ne až na konci.
  await start(page)
  const strip = page.getByText('Zatím zbývá').locator('xpath=..')
  await expect(strip).toContainText('10 500')

  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Můj čistý měsíční příjem', exact: true }).fill('50000')
  await expect(strip).toContainText('21 000')

  await next(page) // → Výdaje
  // Pole má vedle sebe krokovací tlačítka se stejným názvem, proto exact.
  await page.getByRole('textbox', { name: 'Nájem (bez energií a poplatků)', exact: true }).fill('20000')
  await expect(strip).toContainText('13 000')
})

test('cesta dohlédne až k důchodu a ukáže doplacení hypotéky', async ({ page }) => {
  // Deset let byl původní horizont a končil dřív, než se stalo cokoli, na co
  // si člověk spoří. Třicátník s patnáctiletou hypotékou musí na cestě vidět
  // i to, jak mu po poslední splátce zbyde splátka v rozpočtu.
  await start(page)
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Můj věk', exact: true }).fill('30')
  await page.getByRole('textbox', { name: 'Můj čistý měsíční příjem', exact: true }).fill('70000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.getByRole('textbox', { name: 'Celkové úspory', exact: true }).fill('1500000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → Vlastní bydlení
  await page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true }).fill('4000000')
  await page.getByLabel('Délka hypotéky').selectOption('15')
  await finish(page)
  await expectResults(page)

  // Popisek stuhy nese délku horizontu, takže se dá ověřit bez čtení SVG.
  const stuha = page.getByRole('img', { name: /Vývoj úspor na/ })
  const popis = (await stuha.getAttribute('aria-label')) ?? ''
  const let_ = Number(popis.match(/Vývoj úspor na (\d+) let/)?.[1])
  expect(let_).toBe(35)
  expect(popis).toContain('Splaceno')
})

test('výřez cesty zkrátí pohled, ale neschová, co je za ním', async ({ page }) => {
  // Výřez je způsob dívání, ne jiný plán. Když se ořízne doplacení hypotéky,
  // musí to být pod stuhou napsané, jinak si obrázek a karta vedle něj
  // odporují.
  await start(page)
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Můj věk', exact: true }).fill('30')
  await page.getByRole('textbox', { name: 'Můj čistý měsíční příjem', exact: true }).fill('70000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.getByRole('textbox', { name: 'Celkové úspory', exact: true }).fill('1500000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → Vlastní bydlení
  await page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true }).fill('4000000')
  await page.getByLabel('Délka hypotéky').selectOption('15')
  await finish(page)
  await expectResults(page)

  const stuha = page.getByRole('img', { name: /Vývoj úspor na/ })
  const roky = async () => Number(
    ((await stuha.getAttribute('aria-label')) ?? '').match(/Vývoj úspor na (\d+) let/)?.[1]
  )
  expect(await roky()).toBe(35)

  await page.getByRole('button', { name: '10 let', exact: true }).click()
  expect(await roky()).toBe(10)
  await expect(page.getByText(/Za zobrazeným úsekem/)).toBeVisible()

  await page.getByRole('button', { name: 'Celý plán', exact: true }).click()
  expect(await roky()).toBe(35)
  await expect(page.getByText(/Za zobrazeným úsekem/)).toHaveCount(0)
})

test('výdaje jdou přepsat rovnou ve výsledcích a přehled se přepočítá', async ({ page }) => {
  // Dřív se k výdajům dalo dostat jen tlačítkem „Upravit", které uživatele
  // vyhodí do průvodce a připraví o kontext. Otázka „co kdybych utrácel míň
  // za jídlo" ale patří k výsledkům, ne k formuláři.
  await start(page)
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Můj čistý měsíční příjem', exact: true }).fill('60000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await next(page) // → Cíle
  await pickGoal(page, 'retirement')
  await finish(page)
  await expectResults(page)

  // Čísla, ne řetězce: oddělovač tisíců se liší podle verze ICU.
  const numbersIn = (text: string) =>
    (text.match(/[\d\u00a0\u202f ]+(?=\s*Kč)/g) ?? []).map((m) => Number(m.replace(/\D/g, '')))

  const disposableText = async () => {
    const el = page.locator('#rozpocet').getByText('Zbývá').locator('..')
    return (await el.textContent()) ?? ''
  }

  await openTab(page, 'rozpocet')
  const before = numbersIn(await disposableText())[0]

  await page.getByRole('textbox', { name: 'Jídlo a potraviny', exact: true }).fill('20000')
  const after = numbersIn(await disposableText())[0]
  // Jídlo z 6 000 na 20 000 ubere z volných peněz 14 000.
  expect(before - after).toBe(14000)

  // A promítne se to i do odpovědi nahoře, ne jen do téhle karty.
  await openTab(page, 'souhrn')
  await expect(page.getByText(/Po všech výdajích vám měsíčně zbývá/)).toContainText('17 000')
})

test('sdílení nejdřív řekne, co v odkazu bude, a teprve pak kopíruje', async ({ page }) => {
  // Sdílení je jediná akce, která data pustí z prohlížeče ven, a odkaz nejde
  // vzít zpět. Seznam patří před zkopírování, ne za něj.
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)
  await expectResults(page)

  await page.getByRole('button', { name: 'Sdílet přehled' }).click()
  await expect(page.getByText('Odkaz ponese vaše údaje')).toBeVisible()
  await expect(page.getByText('čisté příjmy domácnosti')).toBeVisible()
  await expect(page.getByText(/vaše cíle: důchod/)).toBeVisible()
  // Dokud uživatel nepotvrdí, nekopíruje se: potvrzení o zkopírování nikde.
  await expect(page.getByText('Odkaz zkopírován')).toHaveCount(0)

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await expect(page.getByText('Odkaz ponese vaše údaje')).toHaveCount(0)
})

test('nápověda o editovatelnosti jde zavřít a nevrátí se', async ({ page }) => {
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)

  const hint = page.getByText(/Čísla v přehledu nejsou jen k prohlížení/)
  await expect(hint).toBeVisible()
  await page.getByRole('button', { name: 'Skrýt nápovědu' }).click()
  await expect(hint).toHaveCount(0)

  // Zavření přežije i načtení stránky: je to předvolba, ne stav obrazovky.
  // Po reloadu je uživatel zpátky na uvítání, odkud se pokračuje do průvodce
  // a z něj na výsledky.
  await page.reload()
  // Uložený stav je za posledním krokem, takže průvodce rovnou propustí dál.
  await page.getByRole('button', { name: /Pokračovat tam, kde jste skončili/ }).click()
  await expectResults(page)
  await expect(page.getByText(/Čísla v přehledu nejsou jen k prohlížení/)).toHaveCount(0)
})

test('z průvodce se jde vrátit na přehled bez doklikání kroků', async ({ page }) => {
  // Opravit jedno pole a pak se proklikat čtyřmi kroky zpátky je daň, kterou
  // platit nemusí: stav se ukládá po každé změně.
  await goToGoals(page)
  await pickGoal(page, 'retirement')
  await finish(page)
  await expectResults(page)

  await page.getByRole('button', { name: 'Upravit údaje' }).click()
  await expect(page.getByTestId('wizard-next')).toBeVisible()
  await page.getByTestId('wizard-back-to-results').click()
  await expectResults(page)
})

test('kdo průvodce teprve vyplňuje, návrat na přehled nevidí', async ({ page }) => {
  await start(page)
  await expect(page.getByTestId('wizard-back-to-results')).toHaveCount(0)
})

test('„A co teď" dá jeden krok s částkou a termínem', async ({ page }) => {
  // Přehled odpovídal na „mám na to", ale ne na „co s tím teď". Rady v pravém
  // sloupci jsou možnosti k promyšlení, ne úkol.
  await start(page)
  await next(page) // → Příjmy
  await page.getByRole('textbox', { name: 'Můj věk', exact: true }).fill('31')
  await page.getByRole('textbox', { name: 'Můj čistý měsíční příjem', exact: true }).fill('70000')
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.getByRole('textbox', { name: 'Celkové úspory', exact: true }).fill('400000')
  await next(page) // → Cíle
  await pickGoal(page, 'property')
  await next(page) // → Vlastní bydlení
  await page.getByRole('textbox', { name: 'Cílová cena nemovitosti', exact: true }).fill('6000000')
  await finish(page)
  await expectResults(page)

  const card = page.locator('#souhrn').getByText('A co teď').locator('..')
  await expect(card).toBeVisible()
  // Chybí akontace, takže krok je o ní a nese měsíční částku i termín.
  await expect(card).toContainText('akontaci')
  await expect(card).toContainText('odkládat měsíčně')
  // `\w` v JS neumí česká písmena bez unicode escapes, proto `\S`.
  await expect(card).toContainText(/hotovo v \S+ 20\d\d/)

  // Tlačítko vede na místo, kde se to nastavuje.
  await card.getByRole('button', { name: /Nastavit odkládání/ }).click()
  await expect(page.locator('#tab-bydleni')).toHaveAttribute('aria-selected', 'true')
})

test('bez rezervy je na řadě rezerva, ne cíle', async ({ page }) => {
  await start(page)
  await next(page) // → Příjmy
  await next(page) // → Výdaje
  await next(page) // → Úspory
  await page.getByRole('textbox', { name: 'Celkové úspory', exact: true }).fill('10000')
  await next(page) // → Cíle
  await pickGoal(page, 'retirement')
  await finish(page)

  const card = page.locator('#souhrn').getByText('A co teď').locator('..')
  await expect(card).toContainText('nouzovou rezervu')
})
