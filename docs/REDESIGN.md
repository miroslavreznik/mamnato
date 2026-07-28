# Podklad pro redesign

Tenhle dokument je pro toho, kdo bude nový vzhled implementovat. Popisuje, co
se v appce **může** změnit, co se změnit **nesmí**, a co v současném kódu
redesignu půjde proti srsti.

Návrh dorazil: směr **„Cesta"** (handoff `design_handoff_cesta_redesign`).
Hrdinou výsledků je časová osa života nakreslená jako barevná stuha, „co kdyby"
dostává vlastní záložku. Krok 1 (barvy a fonty) je hotový, viz níže.

## 0. Rozhodnutí, která návrh nechal otevřená

| Otázka | Rozhodnuto |
| --- | --- |
| Fonty z Google Fonts, nebo vlastní? | **Vlastní.** `<link>` na fonts.gstatic.com by poslal Googlu IP adresu každého návštěvníka a neprošel by ani přes CSP. Woff2 jsou v `public/fonts/`. |
| `caution` 3,46:1 a `bad` 4,21:1 nesplňují AA | **Ztmaveno** na 4,5:1. Odstín zůstal, ubrala se světlost. |
| „Ostatní cíle" sloučit do Cesty? | Odloženo na krok 4. Karty cílů mají editovatelné částky, do dlaždice se nevejdou. |
| Má „Cesta" nahradit „Souhrn"? | Ano, ale textový odstavec pod verdiktem zůstává. |
| Kolik událostí na stuze? | Čtyři: koupě, dítě, konec rodičovské, nejnižší bod. |
| Víc scénářů „co kdyby" vedle sebe? | Ne, jeden proti původnímu. |

## 1. Co se nesmí ztratit

### Produktový slib

Appka běží **celá v prohlížeči**. Žádný backend, přihlášení, analytika, reklama,
CDN, externí font ani volání API. Zadané hodnoty jdou jen do `localStorage`,
sdílení se kóduje do fragmentu URL (`#s=`).

Není to detail implementace, ale slib napsaný v UI i v právním upozornění, a
produkční build ho vynucuje technicky: `vite.config.ts` posílá hlavičku CSP
s `connect-src 'none'` a `font-src 'self'`.

**Pro redesign to znamená:** písma se musí přibalit do repozitáře (`public/`),
ne načítat z Google Fonts. Ikony jako inline SVG, ne z ikonového CDN. Žádné
`@import url(...)` v CSS. Když nový design potřebuje font, který nejde
distribuovat, je to blokující věc a musí se probrat dřív, než se začne.

### Rozdělení na vrstvy

```
components/wizard  →  engine (čisté funkce)  →  components/results
```

`src/engine/` je jediný zdroj pravdy pro **veškerou matematiku a veškeré
formulace verdiktů**. Komponenty nepočítají nic vlastního. Redesign může
libovolně měnit, jak se výsledek zobrazí, ale nesmí si začít počítat sám;
jinak se čísla na dvou místech rozejdou. Stalo se to už třikrát a pokaždé to
uživatel poznal dřív než my.

Engine má 300 jednotkových testů a **redesign se jich nesmí dotknout**. Když
padne test v `tests/engine/`, znamená to, že se změnila matematika, ne vzhled.

### Jazyk a typografie

- Texty jsou česky a **vykají**, včetně nadpisů, chybových hlášek i `aria-label`.
- **Žádná dlouhá pomlčka `—`.** Hlídá to `tests/no-em-dash.test.ts`.
- Čísla přes `engine/format.ts`, nikdy ručně. `czkPerMonth()` do dlaždic
  („12 345 Kč/měs."), `czkMonthly()` do vět („12 345 Kč měsíčně").
  Hlídá to `tests/typography.test.ts`.
- V JSX atributech pozor na uvozovky: české `„…"` uvnitř atributu je v pořádku,
  rovná ASCII `"` parser rozbije. Stalo se to už třikrát.

### Přístupnost a dotyk

Tohle nejsou přání, ale věci, které se v revizích opakovaně opravovaly:

- Dotykové cíle minimálně **44 × 44 px**.
- Pole na mobilu minimálně **16 px**, jinak iOS Safari při kliknutí zoomne
  celou stránku (řeší `src/index.css`).
- Absolutně umístěné popisky uvnitř polí musí mít `pointer-events-none`,
  jinak překryjí krokovací tlačítka a seberou jim kliknutí.
- Stav se nesmí sdělovat **jen barvou**. Nálepky u cílů mají slovo
  („V pořádku", „Pozor", „Nevychází"), vybraná volba má značku „✓ vybráno".
  Důvod je i praktický: v tisku se pozadí běžně nevytiskne.
- Záložky výsledků mají `role="tablist"`, `aria-selected` a přepínání šipkami.
- Sbalitelné bloky mají `aria-expanded`.

### Tisk a sdílení

- `@media print` v `src/index.css` a třídy `no-print` / `print-only`.
- Tisk musí zobrazit **všechny** záložky. Neřeší se to CSS: grafy se
  v `display: none` nevykreslí, takže `ResultsDashboard.handlePrint()`
  přepne stav, počká 300 ms a teprve pak tiskne.
- Sdílený odkaz se nikdy neukládá sám. Když příjemce už něco uloženého má,
  zápis se zamkne (`setPersistenceEnabled(false)`), dokud nerozhodne. Zámek
  je uvnitř `saveState()`, ne v komponentách, schválně.

## 2. Co redesign dostává k dispozici

### Data pro obrazovku výsledků

Celý souhrn vrací jediné volání:

```ts
evaluateOverall(state, allocations): OverallSummary
```

```ts
interface OverallSummary {
  status: 'good' | 'tight' | 'not_yet' | 'fix_budget';
  icon: string;
  verdict: {
    answer: 'yes' | 'yes_but' | 'no_but' | 'no';
    headline: string;      // „Máte na to"
    qualifier: string;     // „ale bude to napjaté"
    reason: string;        // jednořádkové zdůvodnění
    questions: {           // rozpad na dílčí otázky (jen u bydlení)
      question: string;
      answer: string;
      status: 'good' | 'caution' | 'warning';
      conditional?: boolean;   // platí jen za předpokladu → neutrální barva
    }[];
  };
  goals: { key; label; status; headline }[];
  budget: BudgetView | null;        // dnes
  budgetAfter: BudgetView | null;   // po koupi
  tips: { text; section?; actionLabel? }[];
}
```

Všechny formulace jsou hotové věty z enginu. Redesign je **nepřepisuje
v komponentě**; když je potřeba jiná formulace, mění se ve `verdict.ts`,
`readiness.ts` nebo `tips.ts`, kde k ní patří i testy.

### Ostatní vstupy pro UI

| Co | Odkud |
|---|---|
| Rozpad příjmu na výdaje, cíle a rezervu | `expenseBreakdown.incomeFlow()` |
| Režim „co kdyby" | `whatIf.evaluateWhatIf()` |
| Hypotéka (splátka, LTV, DTI, DSTI, akontace) | `mortgage.ts` |
| Projekce úspor, důchodu, srovnání s nájmem | `savings.ts` |
| Časová osa jmění | `wealthTimeline.ts` |
| Rodičovská (dvě fáze) | `parentalLeave.ts` |
| Daňové úlevy | `taxRelief.ts` |
| Předpoklady výpočtu | `assumptions.buildAssumptions()` |
| Formátování čísel a času | `format.ts` |
| Barvy grafů | `components/results/chartTheme.tsx` |

### Paleta grafů je hotová a ověřená

`chartTheme.tsx` drží osm kategoriálních odstínů zvlášť pro světlý a tmavý
režim. Není to náhodný výběr: prošly validátorem palety (skill `dataviz`) na
sousední dvojice, barvosleposti i kontrast vůči podkladu. Pořadí slotů je
závazné, protože záruka platí pro konkrétní posloupnost.

**Když redesign přinese vlastní paletu, musí projít stejným validátorem.**
Předchozí paleta měla dvojici s ΔE 3,2 při protanopii, tedy k nerozeznání.

## 3. Kde současný kód půjde proti srsti

Tohle je odpověď na otázku „co bude na redesignu bolet". Čísla jsou skutečná,
změřená v repozitáři.

### ~~Neexistuje vrstva návrhových proměnných~~ (hotovo)

Barvy byly napsané natvrdo jako dvojice „světlá dark:tmavá", 412 výskytů ve
48 souborech. Změna palety znamenala projít celou appku.

Teď je každá barva pojmenovaná podle role v `src/index.css` a tmavý režim se
řeší tam, ne v každé třídě zvlášť:

| Role | Třída | Bylo |
|---|---|---|
| pozadí stránky | `bg-page` | `bg-gray-50` / `gray-900` |
| pozadí karty | `bg-card` | `bg-white dark:bg-gray-800` |
| výplň uvnitř karty | `bg-sunken` | `bg-gray-50 dark:bg-gray-700/50` |
| nadpisy a částky | `text-ink` | `text-gray-900 dark:text-white` |
| popisky polí | `text-ink-label` | `text-gray-700 dark:text-gray-300` |
| běžný text | `text-ink-body` | `text-gray-600 dark:text-gray-300` |
| doplňky | `text-ink-muted` | `text-gray-500 dark:text-gray-400` |
| nejtišší popisky | `text-ink-faint` | `text-gray-400 dark:text-gray-500` |
| obrys karty | `border-line` | `border-gray-200 dark:border-gray-700` |
| obrys pole | `border-line-strong` | `border-gray-300 dark:border-gray-600` |
| značka | `text-brand` | `text-blue-600 dark:text-blue-400` |
| stavy | `text-good`, `text-caution`, `text-danger` | emerald / amber / red |

**Nový vzhled se dosadí do `:root` a `.dark` v `src/index.css`.** Komponenty
se nemusí měnit a `dark:` variantu k barvám už nepotřebují.

Hodnoty zůstaly stejné jako předtím, takže se zavedením proměnných nezměnil
ani jeden pixel; ověřeno pixelovým porovnáním dvanácti snímků ve světlém,
tmavém i mobilním zobrazení.

Co zbývá: **tónované podklady stavů** (`bg-blue-50 dark:bg-blue-900/30` a
podobné, asi 66 výskytů) a **hover stavy**. Jsou nepravidelné a většina z nich
zmizí sama, až vzniknou primitiva (`Card`, `Callout`). Rádiusy jsou pořád tři
bez pravidla: `rounded-lg` 80×, `rounded-xl` 40×, `rounded-2xl` 5×.

### ~~Chrome karty je zkopírovaná devatenáctkrát~~ (hotovo)

Tenhle řetězec byl v sedmnácti souborech:

```
bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6
```

Nahradila ho `ui/Card.tsx`:

```tsx
<Card title="Kalkulačka nemovitosti">…</Card>
<Card title="Daňové úlevy" subtitle="…">…</Card>
```

Hlavička má dvě podoby a obě se do komponenty vešly beze změny rozestupů:
samotný nadpis (`mb-4`), nebo nadpis těsně nad podnadpisem (`mb-1` a `mb-4`).
Ověřeno pixelovým porovnáním: nula rozdílných pixelů ve dvaceti čtyřech
snímcích.

Stejně vznikla `ui/Callout.tsx` pro tónované boxy se sdělením. Čtveřice tříd
(`bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300`)
byla rozepsaná po komponentách, v každé o kus jinak. Teď se předává tón:

```tsx
<Callout tone="danger" className="mt-3">…</Callout>
<Callout tone={whatIf.improved ? 'good' : 'neutral'} border className="mb-4">…</Callout>
```

Tóny jsou `brand`, `good`, `caution`, `danger` a `neutral`. Také ověřeno
pixelovým porovnáním na nulu.

**Zbývá:** `Badge` (nálepky stavů) a `Button`. A hlavně sloučit `ui/Alert.tsx`
s `Callout`: dělá totéž, ale s vlastní paletou (žlutá místo jantarové) a s
emoji. Sloučení už mění vzhled, proto patří až k novému návrhu, ne před něj.

### 24 komponent je čistě vizuálních, 28 čte z enginu

Čistě vizuální (nesahají na `engine/`) jsou hlavně `ui/*`, průvodce a obal
výsledků. Ty jde překreslit bez rizika pro výpočty.

Zbylých 28 kombinuje výpočet i vzhled v jednom souboru. Nepočítají samy
(volají engine), ale rozhodují o tom, co se zobrazí. U nich redesign musí
rozlišit, co je vzhled a co je pravidlo.

### Texty jsou na dvou místech

230 českých řetězců v komponentách, 170 v enginu. Dělicí čára je logická
(verdikty a hodnocení v enginu, popisky a nadpisy v komponentách), ale při
redesignu je potřeba ji znát, aby se copy neměnilo tam, kde k němu patří test.

### E2E testy jsou přilepené na dnešní texty a strukturu

`e2e/wizard.e2e.ts`, 26 testů:

| Způsob výběru | Výskytů |
|---|---|
| `getByText(...)` | 62 |
| `getByRole('button', …)` | 76 |
| `getByRole('tab' / 'textbox' / 'slider')` | 42 |
| `data-testid` | **0** |

**Důsledek:** redesign rozbije většinu e2e testů, a to i tehdy, když appka
funguje správně. A protože e2e je jediné, co hlídá průchod celou appkou,
zůstane redesign bez záchranné sítě přesně ve chvíli, kdy ji potřebuje
nejvíc.

Řešení je stabilní kotvy: `data-testid` na nosných prvcích (kroky průvodce,
pole, záložky, verdikt, dlaždice, přepínače v grafu) a testy přepsané na ně.
Tvrzení o obsahu (částky, verdikt) můžou zůstat textová, protože ta hlídají
chování, ne vzhled.

## 4. Mapa obrazovek

| Obrazovka | Komponenta | Poznámka |
|---|---|---|
| Uvítání | `WelcomeScreen.tsx` | hero, tři dlaždice, pokračování v rozdělané práci |
| Průvodce, obal | `wizard/WizardContainer.tsx` | drží stav, `StepIndicator`, `StepNavigation` |
| 1 Režim | `steps/Step1Mode.tsx` | tři volby, u rodiny počet dětí |
| 2 Příjmy | `steps/Step2Income.tsx` | 1–2 osoby, věk (nepovinný) |
| 3 Výdaje | `steps/Step3Expenses.tsx` | 7 polí + rozpis zbytných + zůstatek úvěrů |
| 4 Úspory | `steps/Step4Savings.tsx` | celkem + volitelný rozpad |
| 5 Cíle | `steps/Step5Goals.tsx` | čtyři dlaždice, ikony |
| 6 Vlastní bydlení | `steps/Step6Property.tsx` | cena, akontace, sazba, fixace, rekonstrukce |
| 7 Vlastní cíle | `steps/Step7CustomGoals.tsx` | jen když je zvolen cíl „Vlastní cíle" |
| Výsledky, obal | `results/ResultsDashboard.tsx` | stav, záložky, tisk, sdílení |
| Výsledky, hlavička | `results/ResultsHeader.tsx` | nadpis, režim, čtyři akce |
| Záložky | `results/ResultsTabs.tsx` | `role="tablist"`, lepivá lišta |
| Záložka Souhrn | `results/ResultsOverview.tsx` | verdikt, dvě otázky, dlaždice, cíle, rozpočet, rady |
| Záložka Rozpočet | `ExpenseBreakdownChart`, `DiscretionaryBreakdownChart`, `WealthTimelineChart` | |
| Záložka Bydlení | `SavingsChart`, `PropertyAffordability`, `DtiDstiIndicator`, `MortgageVsRent`, `CashFlowAfterChart`, `InvestmentComparisonChart`, `TaxReliefCard` | nejdelší záložka |
| Záložka Ostatní cíle | `RetirementPlanner`, `ChildCostPlanner`, `ParentalLeavePlanner`, `CustomGoalPlanner` | |
| Záložka Slovníček | `EducationalGlossary.tsx` | 24 hesel ve 4 skupinách |
| Pod záložkami | `AssumptionsCard`, `ui/Disclaimer` | vždy viditelné, i v tisku |

Výšky po záložkách na mobilu (390 px), pro představu o objemu obsahu:
Souhrn 2 862 px, Rozpočet 2 507 px, Bydlení 6 558 px, Ostatní cíle 2 417 px,
Slovníček 2 341 px.

## 5. Pořadí prací

1. ~~**Vrstva proměnných.**~~ Hotovo, viz výše.
2. ~~**Primitiva.**~~ Hotovo: `Card`, `Callout` a `fieldClass`. `Badge`
   a `Button` se schválně nedělaly, viz níže.
3. ~~**Kotvy pro testy.**~~ Hotovo, viz níže.
4. ~~**Barvy a fonty ze směru „Cesta".**~~ Hotovo, viz níže.
5. ~~**Sdílené prvky.**~~ Hotovo, viz níže.
6. **Skořápka.** `App.tsx` bez `max-w-3xl`, mřížka do 1280 px.
   `ResultsTabs` na pilulky, „Souhrn" → „Cesta", přidat „Co kdyby".
7. **Záložka Cesta.** `ResultsOverview` se rozpadne na `VerdictHeadline`,
   `JourneyRibbon`, `TightestPoint`, `GoalStatusGrid`, `NextSteps`.
   Největší kus, stuha ručně v SVG (ne Recharts).
8. **Záložka Co kdyby.** `whatIfState` + `baselineSnapshot`, duch původního
   scénáře, delta karty.
9. **Průvodce.** Průběžný náhled „zatím to vypadá takto".
10. **Kontrola.** Validátor palety, průchod personami, pixelové porovnání,
    tisk do PDF.

Kroky 1 až 3 nic nepředjímaly a byly hotové, ještě než návrh existoval.

### Sdílené prvky (krok 5)

**Značka.** Domeček s rostoucí šipkou zrušen, místo něj otazník v zeleném
čtverci. Otazník je vysazený **cestou, ne textem**: textová varianta by při
prvním načtení blikla systémovým fontem, a značka je to první, co je vidět.
Cesta je glyf „?" z Bricolage Grotesque 700, vytažený z toho samého souboru,
který appka posílá do prohlížeče, takže vypadá stejně jako nadpisy. Stejná
kresba je i ve `public/favicon.svg`; mění se obojí naráz.

Wordmark ztratil svůj otazník, protože ho nese značka vedle. Celý název drží
`aria-label`, takže čtečka i test slyší dál „MámNaTo?".

**Typografické role.** Pět rolí (`type-verdict`, `type-display`,
`type-section`, `type-hero`, `type-label`) je v `index.css`, ne rozepsaných
do tříd: každá má pevnou velikost, řádkování i prostrkání a rozepsané by to
bylo pět dlouhých řetězců na desítkách míst. Velikosti jsou `clamp()`, protože
návrh chce na mobilu menší verdikt (26–30 px) než na desktopu (46 px).
Devatenáct nadpisů, které měly tři různé velikosti, teď má jednu roli.

**`StatusBadge`.** Tvar, slovo a barva naráz. Tvar je u každého stavu jiný
(plné kolečko, čtvereček, čárka, prázdné kolečko), takže stav projde i tiskem
a barvoslepostí. Tónovaná pilulka zrušena: čtyři pilulky vedle sebe v mřížce
vypadaly jako čtyři tlačítka.

**`Alert` sloučen do `Callout`.** Byly to dva systémy tónovaných boxů, každý
s vlastní paletou. Emoji ikony (ℹ️ ⚠️ ❌) zrušeny, návrh je nechce. `role="alert"`
zůstalo jako prop `alert`, protože to není dekorace: ta hlášení vznikají reakcí
na to, co uživatel právě zadal.

**`HeroNumber` a `MonthsMeter`.** Číslo, kvůli kterému karta existuje, bylo
rozepsané v každé kartě zvlášť a pokaždé o kus jinak. Proužek je nově 10 px
místo 6, protože v šesti pixelech nešlo poznat „těsně pod limitem" od „přes
limit". Rezerva dostala místo proužku měřič po měsících: doporučení je 3 až 6
měsíců, což jsou počítatelné jednotky, a proužek je sléval do spojité škály.
Neúplný měsíc se kreslí poloviční sytostí, protože zaokrouhlit nahoru by lhalo.

Nula se u proužku kreslí jako **prázdná kolejnice**, ne jako krátký pahýl.
S proužkem 10 px se čtyřprocentní minimum četlo jako tečka, tedy „něco tam je".

### Barvy a fonty (krok 4)

Hodnoty jsou v `src/index.css`, odchylky od handoffu popsané přímo tam.
V komponentách nezůstala **ani jedna** přímá třída z Tailwind palety;
bylo jich 549 a všechny teď jdou přes tokeny, takže další změna palety
je zase jen jeden soubor.

Přibyly tokeny, které handoff nepojmenoval, ale potřebuje je: `shell`
a `raised` (podklad a aktivní pilulka přepínače záložek), pětice `tint-*`
(tónované podklady sdělení) a čtveřice `ribbon-*` (gradient stuhy).

Fonty jsou v `public/fonts/`, osm woff2 o 235 kB, jen subsety `latin`
a `latin-ext`. Ověřeno proti všem znakům v appce: čeština je pokrytá celá,
mimo subsety zůstávají jen emoji a čtyři symboly (→ ✓ ∞ ▲▼), které spadnou
na systémový font. Test v e2e potvrdil, že stránka nedělá **žádný** požadavek
mimo vlastní server.

Po tomhle kroku byla appka teplá a čitelná, ale bez displayového řezu
a se starou značkou. Obojí dodal krok 5.
Zbytek čeká na něj.

### Proč nevzniklo `Badge` ani `Button`

Sčítání ukázalo, že se neopakují. Nálepky stavů jsou tři a každá jiná,
plnotučné tlačítko je v appce třikrát, pokaždé s jiným rádiusem i odsazením.
Komponenta pro tři různá použití by byla jen další místo, kde se to hledá.
Až redesign řekne, jak má tlačítko vypadat, vznikne z jednoho tvaru, ne
z průniku tří.

### Kotvy pro testy

Nosné prvky mají `data-testid`, který nezávisí na popisku: `wizard-next`,
`wizard-back`, `goal-<klíč>`, `mode-<klíč>`. Záložky výsledků kotví `id`,
které stejně drží `aria-labelledby`.

E2E z nich má pomocníky (`next`, `finish`, `pickGoal`, `openTab`) a přešlo
na ně 71 volání. Tlačítko „Další" se na posledním kroku jmenuje „Zobrazit
výsledky" a testy ho hledaly podle názvu na jednadvaceti místech; přejmenovat
ho by dřív shodilo skoro celou sadu.

Texty, které jsou samy předmětem testu (verdikt, varování, částky), zůstávají
hledané podle znění. Tam je znění to, co se ověřuje, a kotva by test vyprázdnila.

### Pixelové porovnání

`e2e/visual.e2e.ts` pořídí otisk osmi obrazovek ve světlém, tmavém i mobilním
zobrazení. Běží jen s `VISUAL=1`, jinak se přeskočí, a otisky se nekomitují.

```
# před zásahem
VISUAL=1 npx playwright test --project=chromium visual --update-snapshots
# po zásahu
VISUAL=1 npx playwright test --project=chromium visual
```

Práh je nula rozdílných pixelů a dva běhy nezměněného kódu se shodnou. Stálo
to dvě opravy, obě kvůli grafům:

- Recharts animuje z JavaScriptu, takže `animation: none` ho nezastaví. Čeká
  se proto na ustálení geometrie SVG, ne pevný čas.
- `fullPage: true` si výšku okna dopočítá až v okamžiku snímku. Tím zmizí
  svislý posuvník, stránka se o jeho šířku rozšíří, `ResponsiveContainer` se
  přeměří a graf se rozjede znovu, takže snímek padne doprostřed animace,
  pokaždé jinam. Okno se proto zvětší na výšku obsahu předem a snímek se
  pořizuje bez `fullPage`.

Kdyby se otisk lišil sám se sebou, hledej příčinu tady, ne v náhodě. Plné
znění příkazu i s obejitím proxy je v CLAUDE.md.

## 6. Věci, které redesign může rovnou vyřešit

Z poslední UX revize zbyly neopravené body, které jsou návrhové, ne technické:

- **Krok Výdaje má osm polí předvyplněných průměrem ČR.** Uvítání slibuje tři
  minuty. Lidé to proklikají a dostanou plán postavený na cizích číslech.
  Řešením je rychlý start (příjem, nájem, úspory) nebo viditelné označení
  polí, která zůstala na výchozí hodnotě.
- **Grafy na mobilu.** „Vývoj jmění v čase" a „Koupě vs. nájem" mají na
  330 px deset popisků osy X.
- **Záložka Bydlení má 6 558 px.** Sedm karet pod sebou.
- **Tooltipy mají všechny `aria-label="Nápověda"`.** Čtečka přečte totéž
  třicetkrát bez kontextu.
