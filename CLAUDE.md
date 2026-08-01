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
npx tsc -b           # jen typová kontrola (POZOR: `tsc --noEmit` nekontroluje nic)
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

Dvě sady se schválně přeskakují a pouštějí se ručně: `VISUAL=1` u pixelového
porovnání a `PERSONY=1` u otisků person. Ani jedna nic netvrdí, obojí je
podklad k posouzení okem.

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
  Sazba se odvozuje z délky fixace (`suggestedRate()`), dokud ji uživatel nezadá ručně;
  proto `state.property.mortgageRate` **záměrně chybí ve výchozím stavu** a `undefined`
  tam znamená „řiď se fixací", ne „chybí data".
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
- `readiness.ts` + `verdict.ts`: `summary.ts` jen skládá jejich výsledky. Hodnocení
  jednotlivých cílů je v prvním, formulace odpovědi ve druhém.
- `reserve.ts`: jediné místo, kde se počítá nouzová rezerva (cílová částka,
  co je stranou, kolik chybí, kdy bude plná). Kdo kupuje, poměřuje se výdaji
  **po koupi** a „stranou" má jen to, co po akontaci zbyde. Bere si to cíl
  `reserve`, `readiness.ts` i `nextStep.ts`; ten vzorec byl dřív jen uvnitř
  `nextStep` a nešel použít jinde, aniž by se opsal.
- `childCost.ts`: náklady na dítě podle věku a `plannedChildren()`, tedy **kolik
  dětí plán počítá**. To číslo si berou náklady, dávky během rodičovské
  (u dvou a víc narozených současně je mateřská 37 týdnů a příspěvek
  525 000 Kč), daňové zvýhodnění i všechny popisky. Model počítá, že děti
  přijdou naráz; kdo na to sáhne, ať to drží ve všech třech.
- `plausibility.ts`: kontrola reálnosti zadaných výdajů („jídlo za 3 000 pro dva
  je hodně nízko"). **Nic nezakazuje a nic nemění**: neblokuje průvodce,
  nepřepisuje hodnoty, nesahá na verdikt. Hraničních případů je spousta
  (obědy v ceně práce, auto od zaměstnavatele, bydlení u rodičů), takže
  poslední slovo má uživatel a odklepnutá poznámka se ukládá do
  `state.dismissedChecks`. Prahy jsou schválně nízko, ne na průměru: falešné
  upozornění je dražší než zameškané.
- `whatIf.ts`: režim „co kdyby". Porovnává verdikt před a po vypnutí položky
  a vysvětluje, proč se nehnul.
- `wealthTimeline.ts` + `journey.ts`: časová osa úspor a její čtení. První simuluje
  měsíc po měsíci (spoření na akontaci, koupě, dítě dle věku, rodičovská, doplacení
  hypotéky), druhý z toho dělá napětí, události a nejtěsnější místo. **Není to čisté
  jmění**: akontace z `cash` odejde a hodnota nemovitosti se zpátky nepřičte.
  Horizont dává `planHorizonMonths()`, k důchodu, nejméně deset let a nejvýš čtyřicet.
- `goalNames.ts`: jak se cíle jmenují směrem k uživateli, včetně popisku záložky.
  Bylo to rozepsané na třech místech, pokaždé jinak.
- `expenseFields.ts`: katalog výdajových kategorií. Berou si ho průvodce
  (krok Výdaje) i výsledky (editor v Rozpočtu), aby se dva opisy nerozešly.
- `estimate.ts`: vzorec „appka to umí odhadnout, ale uživatel může přepsat".
  Používá ho sazba, náklady na vlastnictví i dávky na rodičovské. Rozlišuje
  přes `!= null`, takže zadaná nula je platná hodnota, ne „nevyplněno".
- `format.ts`: **všechna** čísla, částky a časové údaje pro uživatele.
  `czk()`, `czkPerMonth()` (do dlaždic), `czkMonthly()` (do vět), `formatRate()`,
  `percentCompact()`, `formatMonths()`, `formatYears()`. Nikdy neskládej „1 let"
  ani „12 345 Kč/měs." ručně a nedefinuj si vlastní `fmt`, bylo jich devět.

**Záložky výsledků.** `Přehled` (id `souhrn`), `Rozpočet`, `Bydlení`, záložka
pojmenovaná podle cílů (`goalsTabLabel()`), `Co kdyby`, `Slovníček`. Na širokém okně
je z lišty sloupec vlevo, na úzkém řádek nahoře; je to **jedna** komponenta ve dvou
podobách, protože `id` záložek drží `aria-controls` i kotvy testů. Id `souhrn` zůstává
i po přejmenování na „Přehled": je ve sdílených odkazech.

**Reaktivita výsledků.** `ResultsDashboard` drží stav (`state`, `allocations`,
`excludedExpenses`, `excludedGoals`) a odvozuje z něj `activeState` a `activeAllocations`.
Všechny karty počítají z těch odvozených hodnot, takže vypnutí položky přepočítá celou
stránku včetně verdiktu. Výjimkou je `ExpenseBreakdownChart`, který dostává **původní**
stav, aby šlo vypnutou položku zase zapnout; částky si dopočítá sám z upraveného stavu.

**Stav a persistence.** `store/wizardStore.tsx` (reducer) + `store/localStorage.ts`
s `normalizeState()`, která validuje a migruje uložený stav. Rozbitý zápis se zahodí
a spadne se na výchozí hodnoty, takže poškozený `localStorage` appku neshodí.
`store/shareLink.ts` kóduje stav do `#s=` (base64url).

**Většina výsledků je editovatelná** a zapisuje se do `state`, ne do „co kdyby":
výdaje (`ExpenseEditor`), akontace, sazba, částky u cílů, délka rodičovské. Jsou to
skutečné údaje, takže se ukládají a přepočítá se z nich celý přehled. Patří sem
i **termín dítěte** (`childInMonths`), i když se zadává tažením puntíku po stuze:
rozhoduje o tom, jestli rodičovská padne před koupi (platí se nájem) nebo po ní
(splátka) a kolik do té doby domácnost naspoří. Dokud si ho držela jen obrazovka,
věta u cíle „Během rodičovské vám bude chybět…" se posunem puntíku nezměnila.

Posuvníky v „Co kdyby" jsou naopak jen úvaha nad grafem a neukládají se nikdy;
totéž platí o **termínu koupě**, který drží obrazovka.
Odklad koupě přitom **nemění akontaci ani splátku**, jen termín; co se mezitím
naspoří, zůstane v hotovosti. Kdyby se tvářil jako vyšší akontace, rozešla by se
časová osa se splátkou, DSTI i verdiktem.

**Sdílený přehled se nikdy neukládá sám.** Když příjemce už něco uloženého má,
cizí scénář se jen zobrazí a zápis se zamkne přes `setPersistenceEnabled(false)`,
dokud uživatel nerozhodne. Zámek je schválně uvnitř `saveState()`, ne
v komponentách: kdyby se hlídal až tam, stačilo by jedno zapomenuté volání a
uživatel přijde o data. Dřív se sdílený stav ukládal rovnou a klik na cizí
odkaz cizí plán nenávratně přepsal.

**CSP je jen v produkčním buildu** (`vite.config.ts`, plugin `mamnato-csp`).
`connect-src 'none'` technicky vynucuje slib, že data neopustí prohlížeč.
Do `index.html` nepatří: dev server si vkládá vlastní inline skript pro Fast
Refresh, který by `script-src 'self'` zablokoval a HMR by tiše přestal fungovat.

## Konvence, na kterých záleží

**Typy kontroluj přes `npx tsc -b`, ne `tsc --noEmit`.** Kořenový `tsconfig.json`
má `"files": []` a jen odkazuje na `tsconfig.app.json` a `tsconfig.node.json`,
takže `tsc --noEmit` projde i nad souborem se zjevnou typovou chybou. Jediná
spolehlivá kontrola před commitem je `npm run build`.

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
(`replace(/[^\d]/g, '')`), jinak test selže na neviditelném rozdílu mezer. Konkrétní
druh mezery se liší podle verze ICU (U+00A0 vs U+202F), na to se nedá spoléhat.

**Číselná pole mají jedno chování.** Formátování tisíců za běhu i kotvení kurzoru
řeší `components/ui/numericText.ts`, který používá `NumberInput` i `NumField`.
Když se v poli text přeformátuje, musí se kurzor nastavit podle **počtu číslic
před ním**, ne podle pozice ve znacích. Bez toho odskakuje na konec (nula číslic
před kurzorem je platný stav, ne „nenalezeno"). Nové číselné pole ať jde přes
tyhle dvě komponenty, ne přes vlastní `<input>`.

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

`docs/DOKONCENI.md` je průběžný zápisník nálezů: co se našlo, co se opravilo a co
se schválně neopravilo a proč. Když najdeš něco, co se nechává být, patří to tam,
ne do commit message, kterou nikdo znovu nenajde.

## Závislosti

`npm audit` hlásí pět zranitelností v `brace-expansion` pod ESLintem. Opravit
je jde jen přes `npm audit fix --force`, což je breaking change na ESLintu.
Nechává se to být schválně: je to ReDoS v porovnávání cest, ESLint se nikdy
nepouští nad nedůvěryhodným vstupem a do prohlížeče se nic z toho nedostane.
Kdyby počet vzrostl nebo přibylo něco mimo tenhle řetězec, je to nový nález,
ne tenhle.

Revidováno 2026-07, tehdy opraveno `npm audit fix` (Vite 8.0.3 → 8.1.5,
postcss 8.5.8 → 8.5.24, js-yaml).

## Když si nejsi jistý

`docs/` obsahuje poznámky k záměrům, které ještě nejsou hotové (například `PODPORA.md`
k dobrovolným příspěvkům). Před implementací takové věci si dokument přečti, obsahuje
i důvody, proč se něco dělat nemá.
