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

async function toResults(page: Page, goal: 'property' | 'child' = 'property') {
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
  // U samotného bydlení je koupě odvozená od naspoření akontace, takže
  // se s ní přímo hýbat nedá a přerušovaný kroužek by sliboval, co neplatí.
  await toResults(page, 'property')
  await expect(page.getByRole('slider')).toHaveCount(0)
})

// Stuha má pevný viewBox, takže se jednotky uvnitř škálují podle šířky okna.
// Poloměr úchopu se proto přepočítává; napevno zadaná hodnota by pravidlo
// o 44px cíli splnila jen na jedné šířce.
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
