---
name: e2e
description: Spustí Playwright testy v tomhle kontejneru, kde je potřeba obejít proxy a předat cestu k předinstalovanému Chromiu. Použij vždy při spouštění nebo ladění e2e testů.
---

# Spuštění e2e testů

Playwright tady nejde spustit prostým `npm run test:e2e`. Kontejner má proxy pro
odchozí provoz a předinstalovaný jen Chromium.

## Celá sada

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy NO_PROXY="localhost,127.0.0.1" \
  PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --project=chromium
```

`--project=chromium` je povinné. Konfigurace obsahuje i projekt `webkit`, ale jeho
binárka se stáhnout nedá (proxy vrací 403 na download host). Bez toho přepínače
běh spadne na chybějícím prohlížeči.

## Jeden test

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy NO_PROXY="localhost,127.0.0.1" \
  PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --project=chromium -g "část názvu testu"
```

## WebKit

Ve WebKitu se testy ověří **až v CI** (workflow `.github/workflows/ci.yml` doinstaluje
oba prohlížeče). Když sáhneš na e2e, buď k tomu upřímný: lokálně máš ověřené jen
Chromium. Rozdíly, které už WebKit odhalil:

- `clipboard-read` a `clipboard-write` nejsou známá oprávnění → schránku v testu
  podstrč vlastní implementací přes `page.addInitScript`, ne přes `permissions`.
- `Control+A` znamená v Safari „na začátek řádku", ne „vybrat vše" → tam, kde
  netestuješ psaní, používej `fill()`.

## Psaní testů

- Soubory musí končit `.e2e.ts`, jinak je `testMatch` nenajde.
- Čísla porovnávej jako čísla, ne jako řetězce. Aplikace formátuje přes
  `toLocaleString('cs-CZ')`, takže oddělovač tisíců je úzká nezlomitelná mezera
  a vizuálně shodné řetězce se neshodují. Použij
  `Number(text.replace(/[^\d]/g, ''))` a `expect.poll`.
- Pole doprovázená krokovacími tlačítky mají tři prvky se stejným názvem
  (`Snížit: X`, `X`, `Zvýšit: X`). Miř na `getByRole('textbox', { name, exact: true })`,
  ne na `getByLabel`.
- Po zápisu do pole nejdřív ověř, že hodnota dorazila (`toHaveValue`), a teprve pak
  kontroluj následek jinde na stránce. Bez toho testy v paralelním běhu občas flakují.

## Když test selže

Spusť ho samostatně přes `-g`. Když projde sám a padá jen v celé sadě, jde o časování,
ne o chybu v aplikaci: zpevni asertaci, nezvyšuj naslepo timeout.
