# MámNaTo?

**Orientační finanční přehled pro jednotlivce, páry i rodiny v Česku.** Pomáhá pochopit vlastní rozpočet a rozhodnout se, jestli si můžete dovolit vlastní bydlení a jak reálné jsou vaše finanční cíle (důchod, dítě, vlastní cíle).

Celá aplikace běží v prohlížeči — **žádný backend, žádné přihlášení, žádná data neopouštějí váš počítač.** Zadané hodnoty se ukládají jen do `localStorage` vašeho prohlížeče.

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

1. **Režim** — jednotlivec / pár / rodina s dětmi
2. **Příjmy** — čisté měsíční příjmy domácnosti (u páru/rodiny i druhá osoba, rodičovský příspěvek)
3. **Výdaje** — po kategoriích, předvyplněné průměrem ČR. Zbytné výdaje lze volitelně **rozepsat do skupin** (zábava, předplatné, dovolená, nákupy) — pomůže uvědomit si, za co se vlastně platí
4. **Úspory** — celková částka, volitelně rozdělená na běžný/spořicí účet a investice (upozorní na peníze ležící ladem)
5. **Cíle** — nemovitost, dítě/rodina, důchod, jiné (lze vybrat víc)
6. **Nemovitost** *(jen při cíli nemovitost)* — cena, sazba, fixace, rozdělení úspor na akontaci; přepínač **„žadatel do 36 let"** (vyšší LTV → nižší akontace)
7. **Vlastní cíle** *(jen při cíli „jiné")* — co chci, kolik potřebuji a za jak dlouho

### Výsledky (dashboard)
- **Verdikt na základě cílů** — srozumitelné shrnutí („v dosahu" / „napjaté" / „zatím ne" / „nejdřív vyrovnat rozpočet") s konkrétními tipy
- **Rozpočet: kam jde váš příjem** — jeden graf rozdělí příjem na výdaje, spoření na jednotlivé cíle a volnou rezervu; částky na cíle jdou upravovat živě
- **Zbytné výdaje: za co utrácíte** — rozpad podrobného rozpisu po skupinách *(když je vyplněn)*
- **Cash flow přehled** — příjmy, výdaje (nezbytné/zbytné), disponibilní částka
- **Kalkulačka nemovitosti** — akontace (dynamicky 10 % / 20 % dle věku), výše hypotéky, měsíční splátka, čas na naspoření, připomínka refixace
- **Ukazatele DTI a DSTI** — orientační bankovní vodítka (viz [Metodika](#metodika-a-zdroje))
- **Vývoj úspor** a **cash flow po koupi**
- **Koupě vs. nájem** — vývoj čistého jmění při koupi vs. investování rozdílu
- **Důchodový plánovač** — projekce portfolia, pravidlo 4 %, porovnání výnosů
- **Kalkulačka nákladů na dítě** a **plánovač vlastních cílů** (priority, odklad, doporučené nástroje)
- **Slovníček pojmů** — LTV, akontace, DTI/DSTI, fixace…

### Napříč aplikací
- 🌗 **Tmavý / světlý režim**
- 🖨️ **Vytisknout / uložit do PDF** — přehled bez aplikačního rámu, s hlavičkou a datem
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
- **Výpočetní jádro** (`src/engine`) je čistý TypeScript bez závislosti na Reactu — snadno testovatelné (viz [testy](#testy-a-kontrola-kvality)).
- **Stav** (`src/store`) drží data průvodce a stará se o uložení/načtení včetně validace (poškozená nebo starší data se doplní na aktuální tvar, nikdy nespadnou do výpočtů).

---

## Metodika a zdroje

Předvyplněné hodnoty vychází z veřejných dat **ČSÚ** a **ČNB** (datum platnosti v `src/engine/defaults.ts`, aktuálně `2025-01`). Uživatel může vše přepsat.

**Regulace ČNB (úvěrové ukazatele).** Aplikace odráží stav, kdy je závazný už jen limit **LTV** (poměr výše úvěru k ceně):
- max **80 %**, u žadatelů **do 36 let až 90 %** → povinná akontace **20 %**, resp. **10 %**.
- Horní limity **DSTI** (od 7/2023) a **DTI** (od 1/2024) ČNB závazně nevyžaduje. Aplikace je proto ukazuje jako **orientační bankovní vodítko** (banky je i tak běžně posuzují, typicky DSTI ~45 %, DTI ~8,5×), ne jako závazný limit.

**Další výpočty:**
- **Hypotéka** — standardní anuitní splátka.
- **Důchod / investice** — složené úročení; reálný výnos přes Fisherovu rovnici (očištění o inflaci), pravidlo bezpečného výběru 4 %.
- **Cíle** — prioritní alokace disponibilní částky; u nesplnitelných cílů návrhy (prodloužit horizont, snížit částku, přesunout prioritu).

> ⚠️ Regulatorní pravidla se mění — před reálným rozhodnutím si aktuální limity a sazby ověřte u ČNB nebo své banky.

---

## Ochrana dat

- **Bez backendu a bez účtu.** Nic se nikam neodesílá.
- Všechny zadané údaje zůstávají v `localStorage` daného prohlížeče a zařízení.
- Odkaz na živou ukázku je veřejný, ale data, která do ní kdokoli zadá, zůstávají jen v jeho prohlížeči — nejsou nikde sdílená ani viditelná ostatním.
- Tlačítko **„Začít znovu"** data z prohlížeče smaže.

---

## Technologie

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Recharts · Vitest · ESLint

---

## Struktura projektu

```
src/
├── components/
│   ├── wizard/          Průvodce — kontejner, krokovník, jednotlivé kroky (Step1–Step7)
│   ├── results/         Výsledky — dashboard a jednotlivé grafy/karty + chartTheme
│   └── ui/              Sdílené prvky (NumberInput, NumField, Tooltip, ThemeToggle…)
├── engine/              Výpočetní jádro (čisté funkce, bez Reactu):
│   ├── cashflow.ts      příjmy, výdaje, disponibilní částka, míra úspor, rezerva
│   ├── mortgage.ts      splátka, akontace (dle věku), DTI, DSTI, čas na naspoření
│   ├── savings.ts       projekce úspor, koupě vs. nájem, důchod, alokace cílů
│   ├── allocation.ts    výchozí rozdělení disponibilní částky na cíle
│   ├── expenseBreakdown.ts  rozpad příjmu pro graf rozpočtu
│   ├── discretionary.ts katalog a součty zbytných výdajů po skupinách
│   ├── childCost.ts     náklady na dítě dle věku
│   ├── scenarios.ts     rule-based scénáře dostupnosti nemovitosti
│   ├── summary.ts       celkový verdikt a připravenost jednotlivých cílů
│   └── defaults.ts      předvyplněné hodnoty a konstanty (ČSÚ/ČNB)
├── store/               Stav průvodce (reducer) + ukládání do localStorage s validací
└── types/               Sdílené TypeScript typy

tests/                   Vitest testy jádra (engine) a úložiště (store)
.github/workflows/       CI/CD — nasazení na GitHub Pages
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

Výpočetní jádro je pokryté unit testy (Vitest) — **96 testů v 9 souborech** pokrývá cash flow, hypotéku, úspory, scénáře, souhrn, náklady na dítě, rozpad zbytných výdajů i validaci uloženého stavu.

```bash
npm run test
```

---

## Nasazení

Projekt se **automaticky nasazuje na GitHub Pages** při každém pushi do větve `main` (workflow `.github/workflows/deploy.yml`).

**Jednorázové zapnutí** (stačí jednou): v repozitáři **Settings → Pages → Build and deployment → Source → „GitHub Actions"**. Poté je aplikace na `https://<uživatel>.github.io/<repo>/` (zde https://miroslavreznik.github.io/mamnato/).

> V `vite.config.ts` je pro produkční build nastaven `base: '/mamnato/'`, aby se assety načítaly ze správného podadresáře. Vývojový server běží na kořeni `/`.

**Alternativy** (stačí propojit repozitář, jde o statickou SPA — v repu je `vercel.json` s SPA rewrites):
- **Vercel** / **Netlify** — build command `npm run build`, output directory `dist`.

---

## Upozornění

MámNaTo? je **orientační nástroj**, ne finanční, právní ani daňové poradenství. Výsledky jsou modelové odhady (sazby, výnosy ani inflaci nelze předpovědět). Před reálným rozhodnutím se poraďte s bankou nebo nezávislým finančním poradcem.
