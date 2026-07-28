import { test, expect, type Page } from '@playwright/test'

/**
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

async function toResults(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  for (let i = 0; i < 4; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()
  await expect(page.getByTestId('results')).toBeVisible()
}

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
