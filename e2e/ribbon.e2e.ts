import { test, expect, type Page } from '@playwright/test'

/**
 * Chování stuhy: pohyb, úchop a dotykový cíl.
 *
 * Stuha se nesmí ztratit, když se vypne pohyb.
 *
 * Vstupní animace stuhu vykresluje zleva doprava a události na ni nechává
 * doskočit. První verze to dělala tak, že události měly ve výchozím stavu
 * `opacity: 0` a odkrývala je až animace. Jenže cokoli, co animaci zastaví,
 * je pak nesmazalo jen z pohybu, ale úplně: `prefers-reduced-motion`, tisk
 * i `animation: none` v testu pixelového porovnání. Události prostě zmizely.
 *
 * Tenhle test hlídá obojí. Není to test vzhledu, ale toho, že se obsah
 * neschová.
 */

async function toResults(page: Page, goal: 'property' | 'child' | 'retirement' = 'property') {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId(`goal-${goal}`).click()
  await page.getByTestId('wizard-next').click()
  if (goal === 'property') await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()
}

const childHandle = (page: Page) =>
  page.getByRole('slider', { name: 'Za jak dlouho čekáte dítě' })

const eventOpacity = (page: Page) =>
  page.evaluate(() => {
    const g = document.querySelector('.ribbon-event')
    return g ? Number(getComputedStyle(g).opacity) : -1
  })

test('s vypnutým pohybem je stuha i události rovnou vidět', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await toResults(page)
  expect(await eventOpacity(page)).toBe(1)
  const dash = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.ribbon-draw')!).strokeDasharray)
  expect(dash).toBe('none')
})

test('v tisku se stuha vykreslí celá', async ({ page }) => {
  await toResults(page)
  await page.emulateMedia({ media: 'print' })
  expect(await eventOpacity(page)).toBe(1)
  const dash = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.ribbon-draw')!).strokeDasharray)
  expect(dash).toBe('none')
})

test('puntík dítěte jde posunout klávesnicí a hlásí hodnotu česky', async ({ page }) => {
  await toResults(page, 'child')
  const handle = childHandle(page)
  await expect(handle).toHaveAttribute('aria-valuenow', '12')
  await expect(handle).toHaveAttribute('aria-valuetext', 'za 1 rok')

  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '13')

  // O rok dopředu jednou klávesou, jinak by se z nuly na osmdesát klikalo věčně.
  await page.keyboard.press('PageUp')
  await expect(handle).toHaveAttribute('aria-valuenow', '25')

  // Mez drží: doleva se nedá pod nulu.
  for (let i = 0; i < 30; i++) await page.keyboard.press('PageDown')
  await expect(handle).toHaveAttribute('aria-valuenow', '0')
})

test('tažením se puntík dítěte posune po ose', async ({ page }) => {
  await toResults(page, 'child')
  const handle = childHandle(page)
  // `boundingBox()` vrací souřadnice v dokumentu, ale myš se hýbe v okně:
  // dokud je stuha pod ohybem, klik dopadne úplně jinam. Nad stuhou přibyla
  // karta „A co teď", takže se to začalo dít.
  await handle.scrollIntoViewIfNeeded()
  const before = await handle.getAttribute('aria-valuenow')

  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()

  const after = await handle.getAttribute('aria-valuenow')
  expect(Number(after)).toBeGreaterThan(Number(before))
})

test('úchop dostane jen událost, se kterou opravdu jde hýbat', async ({ page }) => {
  // Koupě a dítě jsou otázka „kdy". Konec rodičovské plyne z délky volna
  // a doplacení z koupě plus splatnosti, takže tam by kroužek sliboval,
  // co neplatí.
  await toResults(page, 'property')
  await expect(page.getByRole('slider')).toHaveCount(1)
  await expect(page.getByRole('slider', { name: 'Za jak dlouho chcete koupit' })).toBeVisible()
})

test('koupi jde odsunout na později a stuha se přepočítá', async ({ page }) => {
  await toResults(page, 'property')
  const handle = page.getByRole('slider', { name: 'Za jak dlouho chcete koupit' })
  const from = Number(await handle.getAttribute('aria-valuenow'))

  await handle.focus()
  await page.keyboard.press('PageUp')
  await expect(handle).toHaveAttribute('aria-valuenow', String(from + 12))

  // Dřív než na akontaci naspoří se koupit nedá, mez to drží.
  for (let i = 0; i < 5; i++) await page.keyboard.press('PageDown')
  await expect(handle).toHaveAttribute('aria-valuenow', String(from))
})

// `viewBox` stuhy se řídí skutečnou šířkou, takže jedna jednotka je jeden
// pixel a poloměr úchopu je prostě 23. Dokud byl viewBox pevný, musel se
// přepočítávat, jinak by pravidlo o 44px cíli platilo jen na jedné šířce.
//
// Každá šířka je vlastní test, ne cyklus v jednom: po prvním průchodu je
// v localStorage uložený stav a uvítací obrazovka pak nabízí „Pokračovat"
// místo „Spustit přehled", takže druhé kolo neprojde ani na začátku.
for (const width of [390, 1280]) {
  test(`dotykový cíl úchopu má 44 px na šířce ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await toResults(page, 'child')
    const box = (await childHandle(page).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  })
}

test('schodkový úsek nese kromě barvy i vzorek', async ({ page }) => {
  // Jantarová a červená se od sebe těžko poznají i bez poruchy barvocitu
  // (naměřeno ΔE 10,7) a v tisku vůbec. Schodek proto musí být poznat
  // i tvarem, ne jen odstínem.
  await toResults(page, 'property')

  const hatch = page.locator('#souhrn svg path[stroke-dasharray="2 6"]')
  await expect(hatch).toHaveCount(1)

  // Vzorek se kreslí jen tam, kde schodek opravdu je: má ořez na jeho úseky.
  const clip = await hatch.getAttribute('clip-path')
  expect(clip).toMatch(/^url\(#deficit-/)

  // A pořád je to vzorek, ne souvislý tah.
  //
  // Vzniklo to z konkrétní chyby: vzorek měl třídu `ribbon-draw`, která
  // nastavuje `stroke-dasharray: 3000` v CSS. To přebilo atribut na prvku,
  // protože CSS je silnější než prezentační atribut, a zářezy se slily
  // v jeden tah barvou plochy. Schodkový úsek se pak stuhu nepruhoval, ale
  // mazal: u plánu, který je v mínusu celých deset let, z ní zbyla skoro
  // prázdná plocha. V DOM přitom vypadalo všechno v pořádku.
  const dash = await hatch.evaluate((el) => getComputedStyle(el).strokeDasharray)
  expect(dash, `vzorek se slil v souvislý tah: ${dash}`).toMatch(/^2px[, ] ?6px$/)
})

/**
 * Popisky se nesmějí překrývat.
 *
 * Vzniklo to z průchodu persony „pár, bydlení a dítě": bubliny „Koupě"
 * a „Dítě" jsou rok od sebe a dosedly na sebe, text „Konec rodičovské" vytekl
 * z pilulky ven a částka nejnižšího bodu ležela přes kroužek úchopu. Sazba
 * se počítá z odhadu šířky písma, takže se to znovu rozejde tiše: nic
 * nespadne, jen se to překryje.
 */
test('popisky na stuze se nepřekrývají', async ({ page }) => {
  const num = (label: string) => page.getByRole('textbox', { name: label, exact: true })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('mode-couple').click()
  await page.getByTestId('wizard-next').click()
  await num('Čistý měsíční příjem: osoba 1').fill('48000')
  await num('Čistý měsíční příjem: osoba 2').fill('36000')
  await page.getByTestId('wizard-next').click()
  await num('Nájem (bez energií a poplatků)').fill('18000')
  await page.getByTestId('wizard-next').click()
  await num('Celkové úspory').fill('900000')
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-child').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await page.locator('#tab-cile').click()
  await page.locator('#tab-souhrn').click()
  await expect(page.getByTestId('results')).toBeVisible()

  const geom = await page.evaluate(() => {
    const svg = document.querySelector('#souhrn svg[aria-label^="Vývoj úspor"]')!
    const box = (el: Element) => {
      const b = (el as SVGGraphicsElement).getBBox()
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }
    const groups = [...svg.querySelectorAll('g.ribbon-event')]
    return {
      events: groups
        .filter((g) => g.querySelector('rect'))
        .map((g) => ({
          pill: box(g.querySelector('rect')!),
          text: box(g.querySelector('text')!),
          // Puntík a případný kroužek úchopu; průhledná dotyková plocha ne.
          dots: [...g.querySelectorAll('circle')]
            .filter((c) => c.getAttribute('fill') !== 'transparent')
            .map((c) => ({
              cx: Number(c.getAttribute('cx')),
              cy: Number(c.getAttribute('cy')),
              r: Number(c.getAttribute('r')),
            })),
        })),
      lowest: groups.filter((g) => !g.querySelector('rect')).map((g) => box(g.querySelector('text')!))[0],
    }
  })

  // Scénář musí být opravdu ten hustý, jinak test nic nehlídá.
  expect(geom.events.length).toBeGreaterThanOrEqual(3)
  expect(geom.lowest).toBeTruthy()

  // Text se vejde do své pilulky.
  for (const e of geom.events) {
    expect(e.text.x, `text přetéká z pilulky: ${e.text.x} < ${e.pill.x}`).toBeGreaterThanOrEqual(e.pill.x - 0.5)
    expect(e.text.x + e.text.w).toBeLessThanOrEqual(e.pill.x + e.pill.w + 0.5)
  }

  // Dvě pilulky se nepotkají.
  const pills = geom.events.map((e) => e.pill).sort((a, b) => a.x - b.x)
  for (let i = 1; i < pills.length; i++) {
    expect(pills[i].x, 'pilulky se překrývají').toBeGreaterThanOrEqual(pills[i - 1].x + pills[i - 1].w)
  }

  // Popisek nejnižšího bodu nesmí ležet na žádném puntíku.
  for (const e of geom.events) {
    for (const d of e.dots) {
      const apart = geom.lowest.x > d.cx + d.r || geom.lowest.x + geom.lowest.w < d.cx - d.r
        || geom.lowest.y > d.cy + d.r || geom.lowest.y + geom.lowest.h < d.cy - d.r
      expect(apart, `popisek nejnižšího bodu leží na puntíku ${d.cx};${d.cy}`).toBe(true)
    }
  }
})

test('bez schodku se vzorek nekreslí', async ({ page }) => {
  // Spoření na důchod rozpočet neprohne: peníze se jen přesunou, ze jmění
  // nezmizí, takže cesta zůstane celou dobu v klidu.
  await toResults(page, 'retirement')
  await expect(page.locator('#souhrn svg path[stroke-dasharray="2 6"]')).toHaveCount(0)
})
