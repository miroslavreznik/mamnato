# Dokončení redesignu: co zbývá a jak to ověřit

Kroky 1 až 9 z `REDESIGN.md` jsou hotové. Tenhle dokument je plán posledního
kroku, tedy kontroly, a soupis toho, co se ještě neudělalo.

Stav ke commitu `29eecb0`. Testy: 313 jednotkových, 44 e2e.

---

## A. Otevřené nálezy

### A1. Paleta stuhy neprošla validátorem

Barvy stuhy (`--ribbon-*`) jsou zatím přesně podle handoffu a **jako jediné
z celého redesignu neprošly** validátorem palety.

Naměřeno proti ploše grafu (`--sunken`, `#f3f2ea`):

| Stav | Hex | Kontrast vůči ploše | Práh |
|---|---|---|---|
| klid | `#8fc9a6` | **1,69:1** | 3:1 |
| napětí | `#e2a15b` | **1,97:1** | 3:1 |
| schodek | `#e2725b` | **2,75:1** | 3:1 |

A rozlišitelnost napětí od schodku je ΔE 11,3 při běžném vidění, tedy pod
prahem 15, kde se dvě barvy pletou i bez poruchy barvocitu.

**Pozor na to, jak se to čte.** Validátor je určený pro *kategoriální* palety,
což sám v závěru píše. Stuha kategoriální není: je to uspořádaná škála
(klid → napětí → schodek), jejíž úseky se nikdy neobjeví vedle sebe jako dvě
značky k porovnání, ale za sebou v čase. Kritérium „poznám dvě sousední série
od sebe" na ni tedy plně nesedí. Co na ni sedí:

1. **Kontrast vůči ploše.** Tady je nález skutečný a platí bez výhrad.
2. **Monotónní světlost**, aby pořadí stavů šlo přečíst i bez barvy, tedy
   v tisku a při barvosleposti. Návrh ji nemá; klid je světlejší než napětí,
   ale napětí a schodek mají skoro stejnou.

**Rozhodnutí:** ztmavit všechny tři tak, aby každá přelezla 3:1 vůči ploše,
a seřadit je do monotónně klesající světlosti. Odstíny zůstanou z návrhu.
Pokusné hodnoty (`#4b9b6b`, `#b8810a`, `#c0432c`) projdou vším kromě
rozlišitelnosti napětí a schodku, kde vychází ΔE 14,7 proti prahu 15;
právě proto potřebuje stuha i sekundární kódování, viz A2.

**Ověření:** validátor palety na světlou i tmavou sadu, plus snímek stuhy
v obou režimech a v tisku.

### A2. Stuha nese stav jen barvou

Pravidlo, které si repozitář drží a návrh ho opakuje: stav se nikdy nenese
jen barvou. Odznaky stavů to splňují (tvar + slovo + barva), stuha ne.

**Rozhodnutí:** úsek se schodkem dostane vzorek (šrafování nebo přerušení),
takže je poznat i černobíle a při jakékoli poruše barvocitu. Klid a napětí
zůstanou plné, protože rozlišit „dobré od nejhoršího" stačí.

**Ověření:** snímek v odstínech šedi, e2e test na přítomnost vzorku
u schodkového úseku.

### A3. Tisk se od redesignu neprošel

Výsledky mají nově dva sloupce, stuhu a šest záložek. Tisk se od té doby
neověřoval, přitom se ho dotkla každá z těch změn.

Rizika, která se dají čekat:
- boční sloupec vedle hlavního zabere na A4 šířku, kterou nemá;
- stuha se musí vykreslit celá (řeší `@media print`, ale je to netestované
  na skutečném PDF);
- `position: sticky` u lišty a bočního sloupce se v tisku chová jinak;
- šest záložek se musí vytisknout všech, ne jen aktivní.

**Ověření:** PDF přes Playwright, vizuální kontrola stránkování, a test, že
se v PDF objeví obsah všech záložek.

---

## B. Co se ještě neudělalo

### B1. Tři persony

Redesign změnil obrazovky, ne výpočty, ale změnil i to, **co je vidět první**
a co je schované. To se ověřuje průchodem, ne testem.

| Persona | Co ověřit |
|---|---|
| Jednotlivec, nájem, bez cílů | Prázdný stav, verdikt bez bydlení, náhled v průvodci od prvního kroku |
| Pár, bydlení + dítě + rodičovská | Stuha se všemi událostmi, uchopitelný puntík, nejtěsnější místo, Co kdyby |
| Rodina, schodek | Červená stuha, verdikt „nevychází", že rady odkazují na místa, kam se dá kliknout |

### B2. WebKit

V tomhle kontejneru se nedá spustit, ověří ho až CI. Rizikové jsou
`ResizeObserver` ve stuze, `setPointerCapture` u úchopu, `@theme inline`
a `clamp()` v typografii.

### B3. Drobnosti odložené z dřívějška

- „Uložit jako scénář" v panelu Co kdyby: **přeskočeno** po dohodě, sdílení
  odkazu dělá totéž.
- `ui/Alert.tsx` byl sloučen do `Callout`; zbývá projít, jestli někde nezůstal
  tónovaný box, který se dá nahradit.
- Rozdělení příjmu v náhledu průvodce a v grafu rozpočtu používá jiné
  kategorie (hrubé vs. osm). Je to záměr, ale stojí za zápis do slovníčku.

---

## C. Jak to celé otestovat

Pořadí je zvolené tak, aby nejlevnější kontrola padla první.

### C1. Automatické, běží při každé změně

```bash
npx tsc -b          # typy; POZOR: tsc --noEmit nekontroluje nic
npm run lint
npm run test        # 313 jednotkových testů
npm run build       # ověří i CSP hlavičku
```

E2E (plné znění s obejitím proxy je v CLAUDE.md):

```bash
… npx playwright test --project=chromium
```

Co které soubory hlídají:

| Soubor | Co ověřuje |
|---|---|
| `wizard.e2e.ts` | průchod appkou, sdílení, tisk dat, průběžný náhled |
| `ribbon.e2e.ts` | pohyb, úchop, dotykový cíl 44 px, tisk a vypnutý pohyb |
| `cokdyby.e2e.ts` | duch původního scénáře, delta, izolace od Cesty |
| `tooltip.e2e.ts` | nápověda je čitelná, ne jen otevřená |
| `kontrast.e2e.ts` | nikde nesplývá text s pozadím, oba režimy |
| `visual.e2e.ts` | pixelové porovnání, jen s `VISUAL=1` |

### C2. Poloautomatické, spouští se ručně

**Validátor palety.** Nezávislý na repozitáři, bere hexy z příkazové řádky:

```bash
node …/dataviz/scripts/validate_palette.js "<hexy>" --mode light --surface "#f3f2ea"
```

Kontroluje se: kategoriální paleta grafů (osm slotů, obě sady) a stuha
(tři stavy, obě sady).

**Pixelové porovnání.** Po redesignu už neslouží k „nic se nezměnilo", ale
k „změnilo se přesně tohle": otisk před zásahem, otisk po něm, rozdíl.

### C3. Ruční, na závěr

1. **Tři persony** podle tabulky v B1, v obou režimech.
2. **Tisk do PDF** ze skutečného prohlížeče, ne jen z Playwrightu.
3. **Klávesnice**: projít celou appku tabulátorem, ověřit pořadí, fokusový
   prstenec a že se dá ovládat stuha i posuvníky.
4. **Mobil**: skutečné zařízení, ne jen zúžené okno. Kontroluje se zoom polí
   na iOS a dosah palcem na spodní lištu.

### C4. Co se neověřuje a proč

- Výpočty. Ty hlídá 313 jednotkových testů a redesign se jich nedotkl.
- Rychlost. Appka počítá desítky čísel nad polem 120 měsíců; není co měřit.
- Prohlížeče starší než dva roky. `@theme inline`, `clamp()` a
  `ResizeObserver` jsou podmínka, ne volba.
