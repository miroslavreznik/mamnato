# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co to je

MámNaTo? je česká finanční kalkulačka (React + TypeScript + Vite + Tailwind 4), která
odpovídá na otázku „mám na vlastní bydlení a na své cíle?". Běží **celá v prohlížeči**:
žádný backend, žádné přihlášení, žádná analytika. Zadané hodnoty jdou jen do `localStorage`,
sdílení probíhá zakódováním stavu do fragmentu URL.

To není detail implementace, ale **produktový slib**, který je napsaný v UI i v právním
upozornění. Cokoli, co by posílalo data ven (analytika, reklama, CDN, externí font,
volání API), ten slib porušuje a musí se probrat s uživatelem předem.

## Příkazy

```bash
npm run dev          # vývojový server (Vite, port 5173)
npm run build        # tsc -b && vite build
npm run lint         # ESLint (musí být čistý)
npm run test         # Vitest jednorázově
npm run test:watch   # Vitest ve watch režimu
npm run test:e2e     # Playwright (Chromium + WebKit)
npx tsc --noEmit     # jen typová kontrola
```

Jeden soubor nebo jeden test:

```bash
npx vitest run tests/engine/mortgage.test.ts
npx vitest run -t "calculates annuity"
npx playwright test --project=chromium -g "akontací jde hýbat"
```

### E2E v tomhle kontejneru

Chromium je předinstalovaný, WebKit se stáhnout nedá (proxy blokuje download host).
Playwright potřebuje obejít proxy a dostat cestu k prohlížeči:

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy NO_PROXY="localhost,127.0.0.1" \
  PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --project=chromium
```

Bez `--project=chromium` se pokusí spustit i WebKit a spadne. **WebKit ověří až CI**:
pokud sáhneš na e2e, počítej s tím, že výsledek uvidíš až tam.

## Architektura

Tři vrstvy, ostře oddělené:

```
components/wizard  →  engine (čisté funkce)  →  components/results
```

**`src/engine/`** je jediný zdroj pravdy pro všechny výpočty. Čisté funkce bez Reactu,
každá bere `WizardState` a vrací číslo nebo objekt. Sem patří veškerá matematika a
veškeré formulace verdiktů. Komponenty nepočítají nic vlastního; když v komponentě
vzniká vzorec, patří do enginu.

Klíčové moduly a jejich role:

- `mortgage.ts`: jediné místo, kde se skládá hypotéka. `mortgageRate()`, `loanTermYears()`,
  `ownershipCosts()`, `loanAmount()`, `mortgagePayment()`, `expensesAfterPurchase()`.
  **Vždy použij tyhle pomocníky**, nikdy neopakuj `state.property.mortgageRate ?? DEFAULTS…`;
  ten vzorec byl dřív rozkopírovaný v devíti souborech.
- `summary.ts`: celkový verdikt (`Máte na to` / `…ale bude to napjaté` / `Zatím na to nemáte…`)
  a stav jednotlivých cílů. Verdikt je to první, co uživatel na výsledcích vidí.
- `defaults.ts`: předvyplněné hodnoty **se zdrojem a datem revize** (`DEFAULTS_DATE`).
  Datum se zobrazuje uživateli, takže zastaralá data se sama prozradí. Při změně hodnot
  posuň datum a doplň zdroj do komentáře.
- `expenseBreakdown.ts`: `withExcludedExpenses()` / `withExcludedGoals()` pohánějí režim
  „co kdyby". Klíč s tečkou (`travel.abroad`) znamená položku podrobného rozpisu zbytných
  výdajů; vypnutím se snižuje i souhrnná položka `other`, aby se částka neodečetla dvakrát.
- `format.ts`: skloňování času. Nikdy neskládej „1 let" ručně.

**Reaktivita výsledků.** `ResultsDashboard` drží stav (`state`, `allocations`,
`excludedExpenses`, `excludedGoals`) a odvozuje z něj `activeState` a `activeAllocations`.
Všechny karty počítají z těch odvozených hodnot, takže vypnutí položky přepočítá celou
stránku včetně verdiktu. Výjimkou je `ExpenseBreakdownChart`, který dostává **původní**
stav, aby šlo vypnutou položku zase zapnout; částky si dopočítá sám z upraveného stavu.

**Stav a persistence.** `store/wizardStore.tsx` (reducer) + `store/localStorage.ts`
s `normalizeState()`, která validuje a migruje uložený stav. Rozbitý zápis se zahodí
a spadne se na výchozí hodnoty, takže poškozený `localStorage` appku neshodí.
`store/shareLink.ts` kóduje stav do `#s=` (base64url).

## Konvence, na kterých záleží

**Texty jsou česky a vykají.** Včetně nadpisů, chybových hlášek i `aria-label`.

**Žádná dlouhá pomlčka `—`.** V češtině se běžně nepoužívá a v textech působí strojově.
Místo ní patří čárka, dvojtečka, tečka nebo závorka. Hlídá to test
`tests/no-em-dash.test.ts`, který projde `src/` i `index.html`. Krátká pomlčka `–`
v rozsazích („3–6 měsíců", „80–90 % LTV") je v pořádku.

**Pozor na uvozovky v JSX atributech.** České `„…"` uvnitř atributu je v pořádku,
ale rovná ASCII `"` uvnitř takového řetězce parser rozbije. Stalo se to už třikrát.

**Recharts kolize.** `Tooltip` z Rechartu se jmenuje stejně jako vlastní `ui/Tooltip`.
V grafech se vlastní komponenta importuje jako `HelpTip`.

**Čísla česky.** `toLocaleString('cs-CZ')`, tedy desetinná čárka a úzká nezlomitelná
mezera jako oddělovač tisíců. V e2e testech proto **porovnávej čísla, ne řetězce**
(`replace(/[^\d]/g, '')`), jinak test selže na neviditelném rozdílu mezer.

**Dotykové cíle min. 44 px** a pole na mobilu min. 16 px (jinak iOS Safari zoomuje).
Absolutně umístěné popisky uvnitř polí musí mít `pointer-events-none`, jinak překryjí
krokovací tlačítka a seberou jim kliknutí.

## Testy

- `tests/`: Vitest nad enginem a store. Engine je čistý, takže se testuje přímo,
  bez DOM. Není nainstalovaný jsdom ani testing-library.
- `e2e/wizard.e2e.ts`: Playwright, průchod aplikací. Soubory musí končit `.e2e.ts`.

Když měníš chování enginu, přidej unit test. Když měníš tok v UI, přidej nebo uprav e2e.
Změna výchozích hodnot v `defaults.ts` rozbije e2e testy, které počítají s konkrétními
částkami; ty je potřeba dopočítat, ne otupit.

**Podezření na flaky test nejdřív reprodukuj**, teprve pak vysvětluj. Slouží k tomu
`npx playwright test --project=chromium -g "název" --repeat-each=8`. Když padne většina
opakování, není to náhoda ani prostředí, ale skutečná chyba v aplikaci. Stalo se to:
pád e2e byl svedený na zastaralý dev server, ve skutečnosti `NumField` při fokusu
přepisoval obsah pole a zapsané znaky se místo nahrazení připisovaly (`5 000` skončilo
jako `31 505 000`). Playwright k tomu přikládá `test-results/**/error-context.md`
se stavem stránky v okamžiku pádu, kde to bylo přímo vidět; přečti ho dřív, než
vymyslíš teorii.

## Git

Vývoj probíhá na větvi `claude/czech-calculator-questions-8vxvvb`, odtud se dělá
fast-forward merge do `main` a pushne se obojí. Commit messages jsou česky a popisují
**proč**, ne jen co.

## Když si nejsi jistý

`docs/` obsahuje poznámky k záměrům, které ještě nejsou hotové (například `PODPORA.md`
k dobrovolným příspěvkům). Před implementací takové věci si dokument přečti, obsahuje
i důvody, proč se něco dělat nemá.
