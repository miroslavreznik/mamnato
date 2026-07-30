# MámNaTo?

**Orientační finanční přehled pro jednotlivce, páry i rodiny v Česku.** Pomáhá pochopit vlastní rozpočet a rozhodnout se, jestli si můžete dovolit vlastní bydlení a jak reálné jsou vaše finanční cíle (důchod, dítě, vlastní cíle).

Celá aplikace běží v prohlížeči, **žádný backend, žádné přihlášení, žádná data neopouštějí váš počítač.** Zadané hodnoty se ukládají jen do `localStorage` vašeho prohlížeče.

🔗 **Živá ukázka:** https://miroslavreznik.github.io/mamnato/

---

## Obsah

- [Co aplikace umí](#co-aplikace-umí)
- [Jak to funguje](#jak-to-funguje)
- [Metodika a zdroje](#metodika-a-zdroje)
- [Ochrana dat](#ochrana-dat)
- [Technologie](#technologie)
- [Struktura projektu](#struktura-projektu)
- [Spuštění lokálně](#spuštění-lokálně)
- [Testy a kontrola kvality](#testy-a-kontrola-kvality)
- [Nasazení](#nasazení)
- [Upozornění](#upozornění)

---

## Co aplikace umí

### Průvodce (wizard)
Krok za krokem se zeptá na vše potřebné. Kroky se přizpůsobují podle režimu a zvolených cílů:

1. **Režim**, jednotlivec / pár / rodina s dětmi
2. **Příjmy**, čisté měsíční příjmy domácnosti (u páru/rodiny i druhá osoba, rodičovský příspěvek) a nepovinný **věk** žadatelů (ovlivní akontaci, horizont spoření na důchod i splatnost hypotéky)
3. **Výdaje**, po kategoriích, předvyplněné průměrem ČR. Zbytné výdaje lze volitelně **rozepsat do skupin** (zábava, předplatné, dovolená, nákupy), pomůže uvědomit si, za co se vlastně platí
4. **Úspory**, celková částka, volitelně rozdělená na běžný/spořicí účet a investice (upozorní na peníze ležící ladem)
5. **Cíle**, nemovitost, dítě/rodina, důchod, jiné (lze vybrat víc)
6. **Nemovitost** *(jen při cíli nemovitost)*, cena, sazba, fixace, rozdělení úspor na akontaci. Výše akontace se řídí věkem žadatele (do 36 let 10 %, jinak 20 %) a upozorní, pokud by hypotéka byla splacena až po ~70 letech věku
7. **Vlastní cíle** *(jen při cíli „jiné")*, co chci, kolik potřebuji a za jak dlouho

### Výsledky (dashboard)
Přehled je rozdělený do **záložek**, na širokém okně jako sloupec vlevo, na mobilu jako pruh nahoře: **Přehled**, **Rozpočet**, **Bydlení** *(jen při cíli nemovitost)*, záložka pojmenovaná podle vašich cílů (**Důchod**, **Dítě a důchod**, jméno vlastního cíle…), **Co kdyby** a **Slovníček**.

**Většinu čísel jde přepsat přímo ve výsledcích** a přehled se přepočítá včetně odpovědi nahoře: výdaje, akontace, sazba, částky u cílů, délka rodičovské i termín narození dítěte na časové ose.

#### Přehled
- **Odpověď jako první**: *Máte na to* / *Máte na to, ale bude to napjaté* / *Zatím na to nemáte, ale je to o koupi, ne o dnešku* / *Zatím na to nemáte*, s jednou větou proč a s rozpadem na dílčí otázky („Dosáhnete na vlastní bydlení?", „Zbyde vám pak na zbytek?")
- **Časová osa** jako jedna stuha od dneška do důchodu: měsíc po měsíci přes spoření na akontaci, koupi (pokles o akontaci, nájem → hypotéka a náklady na vlastnictví), narození dítěte (náklady dle věku), rodičovskou a **doplacení hypotéky**. Barví se podle napětí rozpočtu, ne podle výše úspor, takže rok se schodkem je vidět dřív, než peníze dojdou. Události jsou na ní pojmenované, termínem narození dítěte jde táhnout.
- **Výřez osy** (10 let / 20 let / celý plán) pro ty, koho zajímají nejbližší roky zblízka; co zůstalo za výřezem, se dopíše větou pod grafem
- **Nejtěsnější místo plánu** s vysvětlením, co se v tu chvíli děje
- **Stav jednotlivých cílů** a měsíční rozpočet dnes i po koupi

#### Rozpočet
- **Kam jde váš příjem**: jeden graf rozdělí příjem na výdaje, spoření na cíle a volnou rezervu. Klepnutím položku vypnete a hned vidíte, jestli by pak odpověď vyšla jinak
- **Zbytné výdaje po skupinách** *(když je rozpis vyplněn)*, vypnout jde i jednotlivá položka
- **Vaše výdaje**: pole pro každou kategorii se součtem hned pod nimi

#### Bydlení *(jen při cíli nemovitost)*
- **Kalkulačka nemovitosti**, akontace (10 % / 20 % dle věku), výše hypotéky, měsíční splátka, čas na naspoření, jednorázové náklady při koupi, připomínka refixace
- **Ukazatele DTI a DSTI**, orientační bankovní vodítka (viz [Metodika](#metodika-a-zdroje))
- **Celkové náklady na bydlení**, nájem dnes proti splátce a nákladům na vlastnictví
- **Koupě vs. nájem**, vývoj čistého jmění při koupi proti investování rozdílu, se závěrem slovy
- **Daňové úlevy**, odpočet úroků z hypotéky a daňové zvýhodnění na dítě

#### Vaše cíle
- **Důchodový plánovač**, projekce portfolia z toho, co už máte naspořeno, pravidlo 4 %, porovnání nástrojů, přepínač nominálních a reálných částek
- **Náklady na dítě** dle věku
- **Rodičovská: co udělá s rozpočtem** *(pár/rodina s cílem dítě)*, mateřská a rodičovský příspěvek zvlášť, protože se výrazně liší; ukáže, co zbyde v nejhorším měsíci a jestli rezerva pokryje celou dobu
- **Plánovač vlastních cílů**, cíl je měsíční částka z volných peněz a appka řekne, jestli s ní termín vyjde

#### Co kdyby
Samostatné pískoviště: každý cíl má **přepínač** (včetně „nekupovat"), pod zapnutým cílem jsou jeho parametry (cena nemovitosti, sazba, délka rodičovské). Živá časová osa se překresluje hned a původní scénář zůstává vidět jako přerušovaný obrys, takže je poznat, jestli si člověk pomohl. Dlaždice pod grafem ukazují rozdíl proti původnímu scénáři.

### Napříč aplikací
- 🌗 **Tmavý / světlý režim**
- 🔗 **Sdílet přehled odkazem**, celý scénář se zakóduje do adresy (nic na server). Před zkopírováním appka vypíše, co v odkazu bude, protože odkaz nejde zneplatnit; příjemci se cizí scénář nikdy neuloží sám, dokud se nerozhodne
- 🖨️ **Vytisknout / uložit do PDF**, přehled bez aplikačního rámu, s hlavičkou a datem
- 💾 **Automatické ukládání** do prohlížeče (lze se vrátit a pokračovat)
- 📱 Responzivní design pro mobil i desktop

---

## Jak to funguje

Aplikace má tři vrstvy:

```
Průvodce (React UI)  →  Výpočetní jádro (čisté funkce)  →  Výsledky (grafy + verdikt)
        │                                                          
        └──────────────  stav se ukládá do localStorage  ─────────┘
```

- **UI** (`src/components`) sbírá vstupy a vykresluje výsledky.
- **Výpočetní jádro** (`src/engine`) je čistý TypeScript bez závislosti na Reactu, snadno testovatelné (viz [testy](#testy-a-kontrola-kvality)).
- **Stav** (`src/store`) drží data průvodce a stará se o uložení/načtení včetně validace (poškozená nebo starší data se doplní na aktuální tvar, nikdy nespadnou do výpočtů).

---

## Metodika a zdroje

Předvyplněné hodnoty vychází z veřejných dat **ČSÚ** a **ČNB** (datum platnosti v `src/engine/defaults.ts`, aktuálně `2026-07`). Uživatel může vše přepsat.

**Regulace ČNB (úvěrové ukazatele).** Aplikace odráží stav, kdy je závazný už jen limit **LTV** (poměr výše úvěru k ceně):
- max **80 %**, u žadatelů **do 36 let až 90 %** → povinná akontace **20 %**, resp. **10 %**.
- Horní limity **DSTI** (od 7/2023) a **DTI** (od 1/2024) ČNB závazně nevyžaduje. Aplikace je proto ukazuje jako **orientační bankovní vodítko** (banky je i tak běžně posuzují, typicky DSTI ~45 %, DTI ~8,5×), ne jako závazný limit.

**Další výpočty:**
- **Hypotéka**, standardní anuitní splátka.
- **Věk žadatele**, nejmladší do 36 let → nižší akontace (10 %); horizont spoření na důchod se počítá do 65 let; upozornění, pokud by hypotéka byla splacena až po ~70 letech.
- **Rodičovská**, mzda pečujícího rodiče se nahradí dávkami ve dvou fázích: mateřská (70 % redukovaného denního vyměřovacího základu dle ČSSZ, 28 týdnů) a po ní rodičovský příspěvek 350 000 Kč rozložený na zbytek. Průměr za celou dobu by realitu posunul, protože mateřská je vyšší a kratší.
- **Důchod / investice**, složené úročení; reálný výnos přes Fisherovu rovnici (očištění o inflaci), pravidlo bezpečného výběru 4 %.
- **Cíle**, každý cíl je měsíční částka z volných peněz, kterou si uživatel nastaví; appka počítá, jestli s ní termín vyjde, a nabízí, co s tím.
- **Časová osa**, konstantní příjmy i výdaje, bez výnosů a inflace, tedy **všechno v dnešních cenách**. Není to čisté jmění: akontace z úspor odejde a hodnota nemovitosti se zpátky nepřičte (to ukazuje graf koupě vs. nájem). Horizont sahá k odchodu do důchodu, nejméně deset let a nejvýš čtyřicet.

> ⚠️ Regulatorní pravidla se mění, před reálným rozhodnutím si aktuální limity a sazby ověřte u ČNB nebo své banky.

---

## Ochrana dat

- **Bez backendu a bez účtu.** Nic se nikam neodesílá.
- Všechny zadané údaje zůstávají v `localStorage` daného prohlížeče a zařízení.
- Odkaz na živou ukázku je veřejný, ale data, která do ní kdokoli zadá, zůstávají jen v jeho prohlížeči, nejsou nikde sdílená ani viditelná ostatním.
- Tlačítko **„Začít znovu"** data z prohlížeče smaže.
- **Produkční build to vynucuje technicky.** Do hlavičky se vkládá CSP s `connect-src 'none'`, `script-src 'self'` a `font-src 'self'`, takže stránka nemá kam data odeslat, i kdyby chtěla. Žádné CDN, externí fonty ani analytika.
- **Sdílený odkaz** nese data zakódovaná v adrese, ne na serveru. Než se zkopíruje, appka vypíše, co v něm bude. Komu se přehled otevře z cizího odkazu a má vlastní uložená data, tomu se cizí scénář neuloží sám: zápis zůstane zamčený, dokud se nerozhodne.

---

## Technologie

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Recharts · Vitest · ESLint

---

## Struktura projektu

```
src/
├── components/
│   ├── wizard/          Průvodce, kontejner, krokovník, jednotlivé kroky (Step1–Step7)
│   ├── results/         Výsledky, dashboard a jednotlivé grafy/karty + chartTheme
│   └── ui/              Sdílené prvky (NumberInput, NumField, Tooltip, ThemeToggle…)
├── engine/              Výpočetní jádro (čisté funkce, bez Reactu):
│   ├── cashflow.ts      příjmy, výdaje, disponibilní částka, míra úspor, rezerva
│   ├── mortgage.ts      splátka, akontace (dle věku), DTI, DSTI, čas na naspoření
│   ├── savings.ts       projekce úspor, koupě vs. nájem, důchod
│   ├── allocation.ts    výchozí rozdělení volných peněz na cíle
│   ├── budget.ts        rozpočet dnes a po koupi
│   ├── expenseBreakdown.ts  rozpad příjmu pro graf rozpočtu, vypínání položek
│   ├── expenseFields.ts katalog výdajových kategorií (průvodce i výsledky)
│   ├── discretionary.ts katalog a součty zbytných výdajů po skupinách
│   ├── childCost.ts     náklady na dítě dle věku
│   ├── scenarios.ts     rule-based scénáře dostupnosti nemovitosti
│   ├── rateGuidance.ts  LTV pásma a orientační přirážky bank k sazbě
│   ├── purchaseCosts.ts jednorázové náklady při koupi
│   ├── downPayment.ts   rozvaha nad akontací: bezpečné maximum, cena i alternativa
│   ├── renovation.ts    rekonstrukce a souběh nájmu s úrokem
│   ├── taxRelief.ts     odpočet úroků a daňové zvýhodnění na dítě
│   ├── wealthTimeline.ts vývoj úspor přes plánované události, horizont plánu
│   ├── journey.ts       podklad pro časovou osu: napětí, události, nejtěsnější místo
│   ├── whatIf.ts        porovnání scénáře před a po změně
│   ├── parentalLeave.ts  dopad rodičovské na rozpočet, mateřská a příspěvek zvlášť
│   ├── readiness.ts     stav jednotlivých cílů
│   ├── verdict.ts       formulace odpovědi „Máte na to"
│   ├── summary.ts       celkový verdikt a stav cílů dohromady
│   ├── tips.ts          co s tím: konkrétní rady podle situace
│   ├── assumptions.ts   předpoklady výpočtu pro uživatele i pro tisk
│   ├── goalNames.ts     jak se cíle jmenují směrem k uživateli
│   ├── estimate.ts      „appka to odhadne, ale jde to přepsat"
│   ├── preview.ts       průběžný náhled v průvodci
│   ├── format.ts        všechna čísla, částky a časové údaje pro uživatele
│   └── defaults.ts      předvyplněné hodnoty a konstanty (ČSÚ/ČNB/ČBA)
├── store/               Stav průvodce (reducer) + ukládání do localStorage s validací
└── types/               Sdílené TypeScript typy

tests/                   Vitest testy jádra (engine) a úložiště (store)
e2e/                     Playwright testy průchodu aplikací
docs/                    Poznámky k záměrům, které ještě nejsou hotové
.github/workflows/       CI/CD, nasazení na GitHub Pages
```

---

## Spuštění lokálně

**Požadavky:** Node.js `^20.19` nebo `>=22.12` (kvůli Vite 8) a npm.

```bash
npm install        # instalace závislostí
npm run dev        # vývojový server → http://localhost:5173
```

Další příkazy:

```bash
npm run build      # produkční build do dist/ (tsc -b && vite build)
npm run preview    # lokální náhled produkčního buildu
npm run lint       # ESLint
npm run test       # testy (jednorázově)
npm run test:watch # testy v watch režimu
```

---

## Testy a kontrola kvality

Výpočetní jádro je pokryté unit testy (Vitest), **374 testů ve 33 souborech** pokrývá cash flow, hypotéku, sazby podle LTV, úspory a důchodovou projekci, časovou osu, scénáře, souhrn a verdikt, náklady na dítě, rodičovskou, daňové úlevy, rozpad zbytných výdajů, formátování i validaci uloženého stavu.

Průchod aplikací hlídá **68 e2e testů (Playwright)** v Chromiu i ve WebKitu (jádro Safari): celý průvodce, dynamické přepočty, editace výdajů ve výsledcích, časová osa a její výřez, „Co kdyby", odkládání cílů, kontrast textu ve světlém i tmavém režimu, ovládání klávesnicí, tisk, záchranná obrazovka při chybě a sdílení odkazem.

Dvě sady se schválně přeskakují a pouštějí se ručně, protože nic netvrdí a slouží k posouzení okem: pixelové porovnání (`VISUAL=1`) a otisky deseti person (`PERSONY=1`).

```bash
npm run test        # jednorázově
npm run test:watch  # ve watch režimu
npm run test:e2e    # Playwright
```

```bash
npm run test
```

---

## Nasazení

Projekt se **automaticky nasazuje na GitHub Pages** při každém pushi do větve `main` (workflow `.github/workflows/deploy.yml`).

**Jednorázové zapnutí** (stačí jednou): v repozitáři **Settings → Pages → Build and deployment → Source → „GitHub Actions"**. Poté je aplikace na `https://<uživatel>.github.io/<repo>/` (zde https://miroslavreznik.github.io/mamnato/).

> V `vite.config.ts` je pro produkční build nastaven `base: '/mamnato/'`, aby se assety načítaly ze správného podadresáře. Vývojový server běží na kořeni `/`.

**Alternativy** (stačí propojit repozitář, jde o statickou SPA, v repu je `vercel.json` s SPA rewrites):
- **Vercel** / **Netlify**, build command `npm run build`, output directory `dist`.

---

## Upozornění

MámNaTo? je **orientační nástroj**, ne finanční, právní ani daňové poradenství. Výsledky jsou modelové odhady (sazby, výnosy ani inflaci nelze předpovědět). Před reálným rozhodnutím se poraďte s bankou nebo nezávislým finančním poradcem.
