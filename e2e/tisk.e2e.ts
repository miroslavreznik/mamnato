import { test, expect, type Page } from '@playwright/test'

/**
 * Tisk do PDF.
 *
 * Výsledky mají po redesignu dva sloupce, stuhu a šest záložek, a každá
 * z těch změn se tisku dotýká. Sticky lišta i boční sloupec se v tisku chovají
 * jinak než na obrazovce a šest záložek se musí vytisknout všech, ne jen ta
 * vybraná.
 *
 * Test needěluje krásu, na to je oko. Ověřuje tři věci, které se dají zkazit
 * tiše: že v PDF je obsah všech záložek, že se do něj nedostaly ovládací
 * prvky, a že stránka nepřeteče na šířku.
 */

async function toResults(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-retirement').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()
}

/**
 * Zapne tiskový režim tak, jak ho zapíná appka: rozbalí všechny záložky
 * a přepne média. Skutečné `window.print()` v testu volat nejde, dialog
 * by běh zastavil.
 */
async function enterPrintMode(page: Page) {
  await page.getByRole('button', { name: 'Vytisknout / PDF' }).click()
  await page.emulateMedia({ media: 'print' })
  // Appka dává grafům 300 ms na vykreslení po rozbalení sekcí.
  await page.waitForTimeout(500)
}

test('v tisku je obsah všech záložek, ne jen vybrané', async ({ page }) => {
  await toResults(page)
  await enterPrintMode(page)

  for (const id of ['souhrn', 'rozpocet', 'bydleni', 'cile', 'cokdyby', 'slovnicek']) {
    await expect(page.locator(`#${id}`), `záložka ${id}`).toBeVisible()
  }
})

test('do tisku se nedostanou ovládací prvky', async ({ page }) => {
  await toResults(page)
  await enterPrintMode(page)

  // Lišta se záložkami, akce i posuvníky jsou k ničemu na papíře a braly by
  // místo obsahu.
  await expect(page.getByRole('tablist')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Vytisknout / PDF' })).toBeHidden()
})

test('tisková stránka nepřeteče na šířku', async ({ page }) => {
  await toResults(page)
  await enterPrintMode(page)

  // Šířka A4 s okraji, zhruba. Dvousloupcové výsledky jsou hlavní podezřelý:
  // boční sloupec má na obrazovce pevných 340 px.
  await page.setViewportSize({ width: 794, height: 1123 })
  await page.waitForTimeout(300)

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })
  expect(overflow).toBeLessThanOrEqual(1)
})

test('co je v tisku vidět, nesmí záviset na vytištěném pozadí', async ({ page }) => {
  // Prohlížeče ve výchozím nastavení pozadí netisknou. Světlý text na tmavé
  // ploše se pak změní v prázdné místo. Kontrast se proto neměří proti vlastní
  // ploše, ale proti bílému papíru.
  await toResults(page)
  await enterPrintMode(page)

  const bad = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const rgb = (c: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data]
    }
    const lum = ([r, g, b]: number[]) => {
      const f = (x: number) => {
        const v = x / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const onPaper = (c: string, alpha: number) => {
      const [r, g, b] = rgb(c)
      const mixed = [r, g, b].map((v) => v * alpha + 255 * (1 - alpha))
      return (1.05) / (lum(mixed) + 0.05)
    }

    const out: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3 && n.textContent?.trim())
        .map((n) => n.textContent!.trim())
        .join(' ')
      if (!own || !/[\p{L}\p{N}]/u.test(own)) continue
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.display === 'none') continue
      if (!el.getBoundingClientRect().width) continue
      const cr = onPaper(s.color, Number(s.opacity))
      if (cr < 3) out.push(`${el.tagName.toLowerCase()} „${own.slice(0, 40)}" ${cr.toFixed(2)}:1`)
    }
    return out
  })

  expect(bad, bad.join('\n')).toEqual([])
})
