import { test, expect, type Page } from '@playwright/test'

/**
 * Nikde nesmí být text, který splývá s vlastním pozadím.
 *
 * Vzniklo to z konkrétní chyby: nápověda měla světlý text na `bg-card`, jenže
 * v novém vzhledu má karta stejnou barvu jako stránka, takže text zmizel.
 * Bublina se dál otevírala, jen nešla přečíst, a žádný existující test se
 * neptal na to, jestli je text vidět, jen jestli element existuje.
 *
 * Práh je 3:1, ne 4,5:1. Tenhle test nehlídá čitelnost podle WCAG, na to jsou
 * spočítané tokeny v `index.css`; hlídá jen to, že text nezmizel úplně.
 * Vyšší práh by hlásil i legitimně tlumené popisky.
 */

/**
 * Projde stránku a vrátí prvky, jejichž text splývá s podkladem.
 *
 * Barvy se nerozebírají regexem: Tailwind 4 je vydává v zápisu `oklab()`
 * a parsování čísel z něj dá nesmysl (značka appky vycházela na 1,69:1,
 * ačkoli má přes jedenáct). Převod dělá plátno, tedy skutečná barva na
 * obrazovce, ať je zapsaná jakkoli.
 */
function findInvisibleText(): string[] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  const cache = new Map<string, number[]>()

  const resolve = (c: string): number[] => {
    const hit = cache.get(c)
    if (hit) return hit
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const d = [...ctx.getImageData(0, 0, 1, 1).data]
    cache.set(c, d)
    return d
  }

  // Průhlednou barvu složí na podklad, aby se počítalo s tím, co je vidět.
  const over = (fg: number[], bg: number[]): number[] => {
    const a = fg[3] / 255
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(255)
  }

  const lum = ([r, g, b]: number[]) => {
    const f = (x: number) => {
      const v = x / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  // Podklady od prvku nahoru až po první neprůhledný, složené odspodu.
  // Poloprůhledná lišta nad stránkou by jinak vyšla jako úplně jiná barva,
  // než jakou uživatel vidí.
  const bgOf = (el: Element): number[] => {
    const layers: number[][] = []
    let n: Element | null = el
    while (n && n !== document.documentElement) {
      const c = resolve(getComputedStyle(n).backgroundColor)
      if (c[3] > 0) {
        layers.push(c)
        if (c[3] === 255) break
      }
      n = n.parentElement
    }
    layers.push(resolve('white'))
    return layers.reduceRight((acc, c) => over(c, acc))
  }

  const bad: string[] = []
  for (const el of document.querySelectorAll('body *')) {
    // Jen prvky s vlastním textem, ne obaly. Pole nemají textový uzel, ale
    // `value`, takže by je procházka minula: přesně tak se do appky dostalo
    // pole s náklady na dítě, které mělo v tmavém režimu černý text na tmavém
    // podkladu (1,4:1). Vypadalo jako prázdné a nikdo si toho nevšiml.
    // Posuvníky a zaškrtávátka mají `value` („on", „4.8"), ale nekreslí
    // z něj ani písmenko: měřit u nich kontrast textu nedává smysl.
    const textual = ['text', 'number', 'tel', 'search', 'email', 'url', '']
    const own = el instanceof HTMLInputElement
      ? (textual.includes(el.getAttribute('type') ?? '') ? el.value.trim() : '')
      : [...el.childNodes]
        .filter((n) => n.nodeType === 3 && n.textContent?.trim())
        .map((n) => n.textContent!.trim())
        .join(' ')
    if (!own) continue
    // Emoji se kreslí vlastními barvami, ne `color`, takže jejich kontrast
    // nic neznamená. Přeskakuje se text bez jediného písmene a číslice.
    if (!/[\p{L}\p{N}]/u.test(own)) continue

    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    const bg = bgOf(el)
    // Text uvnitř SVG se nebarví přes `color`, ale přes `fill`. Bez tohohle
    // se u popisků os a stuhy měřila zděděná barva, která se nikde nekreslí.
    const paint = el.namespaceURI === 'http://www.w3.org/2000/svg' ? s.fill : s.color
    if (!paint || paint === 'none') continue
    const fg = over(resolve(paint), bg)
    const cr = ratio(fg, bg)
    if (cr < 3) bad.push(`${el.tagName.toLowerCase()} „${own.slice(0, 40)}" ${cr.toFixed(2)}:1`)
  }
  return bad
}

async function walk(page: Page, scheme: 'light' | 'dark'): Promise<string[]> {
  await page.emulateMedia({ colorScheme: scheme })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  // Přechody musí pryč, jinak se měří barva uprostřed prolnutí. Pozadí
  // stránky má `transition-colors`, takže hned po přepnutí motivu vrací
  // ještě světlou hodnotu, a tmavý režim pak vycházel jako samá chyba.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })

  const found: string[] = []
  const collect = async (where: string) => {
    const bad = await page.evaluate(findInvisibleText)
    found.push(...bad.map((b) => `${where}: ${b}`))
  }

  await collect('úvod')
  await page.getByRole('button', { name: /Spustit přehled/ }).click()
  await collect('průvodce')

  // Nápověda je nejčastější oběť: leží nad obsahem a má vlastní podklad.
  await page.getByTestId('wizard-next').click()
  await page.getByRole('button', { name: 'Nápověda' }).first().click()
  await collect('nápověda')
  await page.keyboard.press('Escape')

  for (let i = 0; i < 3; i++) await page.getByTestId('wizard-next').click()
  await page.getByTestId('goal-property').click()
  await page.getByTestId('goal-retirement').click()
  // I dítě: jeho karta má vlastní tabulku polí a rodičovskou.
  await page.getByTestId('goal-child').click()
  await page.getByTestId('wizard-next').click()
  await page.getByTestId('wizard-next').click()

  for (const tab of ['souhrn', 'rozpocet', 'bydleni', 'cile', 'cokdyby', 'slovnicek']) {
    await page.locator(`#tab-${tab}`).click()
    await page.waitForTimeout(150)
    await collect(`záložka ${tab}`)
  }
  return found
}

for (const scheme of ['light', 'dark'] as const) {
  test(`nikde nesplývá text s pozadím, ${scheme === 'light' ? 'světlý' : 'tmavý'} režim`, async ({ page }) => {
    const found = await walk(page, scheme)
    expect(found, found.join('\n')).toEqual([])
  })
}
