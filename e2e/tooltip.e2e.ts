import { test, expect, type Page } from '@playwright/test'

/**
 * Nápověda musí být čitelná, ne jen otevřená.
 *
 * Sáhla na ni změna palety: bublina měla `text-page` na `bg-card`, jenže
 * v novém vzhledu má karta stejnou barvu jako stránka. Nápověda se otevírala
 * dál, jen byl text neviditelný, takže to neodhalil žádný existující test,
 * který se ptal jen na to, jestli je vidět element.
 *
 * Tenhle test se proto ptá na kontrast, ne na přítomnost.
 */

function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, b2] = c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((v) => v / 255)
    const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2)
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

async function openFirstTooltip(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await page.getByTestId('wizard-next').click() // → Příjmy, kde jsou nápovědy
  await page.getByRole('button', { name: 'Nápověda' }).first().click()
  const tip = page.getByRole('tooltip').first()
  await expect(tip).toBeVisible()
  return tip
}

for (const scheme of ['light', 'dark'] as const) {
  test(`nápověda je čitelná v ${scheme === 'light' ? 'světlém' : 'tmavém'} režimu`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    const tip = await openFirstTooltip(page)

    const { color, background } = await tip.evaluate((el) => {
      const s = getComputedStyle(el)
      return { color: s.color, background: s.backgroundColor }
    })

    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5)
  })
}

test('klepnutím připnutá nápověda zůstane a zavře se Escapem', async ({ page }) => {
  const tip = await openFirstTooltip(page)

  // Myš musí pryč z ikony. Dokud nad ní stojí, drží nápovědu hover a nešlo by
  // poznat, jestli připnutí vůbec funguje.
  await page.mouse.move(5, 400)
  await expect(tip).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('klepnutí jinam připnutou nápovědu zavře', async ({ page }) => {
  await openFirstTooltip(page)
  await page.mouse.click(5, 400)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})
