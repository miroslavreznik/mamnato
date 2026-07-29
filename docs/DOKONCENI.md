# Dokončení redesignu: co zbývá a jak to ověřit

Kroky 1 až 9 z `REDESIGN.md` jsou hotové. Tenhle dokument je plán posledního
kroku, tedy kontroly, a soupis toho, co se ještě neudělalo.

Stav ke commitu `29eecb0`. Testy: 318 jednotkových, 54 e2e.

---

## A. Otevřené nálezy

### ~~A1. Paleta stuhy neprošla validátorem~~ (hotovo)

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

**Hotovo.** Světlá sada je nově `#37995e`, `#aa5b05`, `#ad2105`: kontrast
3,18, 4,44 a 6,24 ku jedné a **klesající světlost** (0,244 → 0,160 → 0,100),
takže pořadí stavů jde přečíst i bez barev. Odstíny jsou z návrhu, ubrala se
světlost a přidala sytost, aby ztmavená pastelová barva nevypadala jako bláto.

Tmavá sada zůstala z návrhu beze změny: na tmavé ploše dává 9,6, 8,4 a 6,1
ku jedné a její světlost klesá také.

Rozlišitelnost napětí od schodku zůstává pod prahem (ΔE 10,7). Jantarová
a červená jsou si blízké ze své podstaty a žádná varianta v mezích návrhu
to nespraví; proto A2.

### ~~A2. Stuha nese stav jen barvou~~ (hotovo)

Pravidlo, které si repozitář drží a návrh ho opakuje: stav se nikdy nenese
jen barvou. Odznaky stavů to splňují (tvar + slovo + barva), stuha ne.

**Hotovo.** Schodkový úsek dostal zářezy: přes stuhu se v jeho rozsahu
překreslí přerušovaná kopie barvou plochy, takže vznikne pruhovaný úsek.
Klid a napětí zůstaly plné, rozlišit „dobré od nejhoršího" stačí.

Hlídají to dva testy v `ribbon.e2e.ts`: že vzorek je tam, kde schodek je,
a že tam není, kde schodek není.

### ~~A3. Tisk se od redesignu neprošel~~ (hotovo)

Výsledky mají nově dva sloupce, stuhu a šest záložek. Tisk se od té doby
neověřoval, přitom se ho dotkla každá z těch změn.

Rizika, která se dají čekat:
- boční sloupec vedle hlavního zabere na A4 šířku, kterou nemá;
- stuha se musí vykreslit celá (řeší `@media print`, ale je to netestované
  na skutečném PDF);
- `position: sticky` u lišty a bočního sloupce se v tisku chová jinak;
- šest záložek se musí vytisknout všech, ne jen aktivní.

**Hotovo,** a našly se dvě chyby.

Karta „Nejtěsnější místo" měla světlý text na tmavé ploše. Prohlížeče ale
ve výchozím nastavení pozadí netisknou, takže by z ní na papíře zbylo prázdné
místo. V tisku teď plochu nahradí rámeček a text zčerná. Je to stejná chyba
jako u nápovědy, jen se projeví jinde.

Panel „Co kdyby" jsou samé ovládací prvky. Na papíře nemají co dělat
a zakázané tlačítko se tisklo tak vybledlé, že nešlo přečíst.

Test v `tisk.e2e.ts` proto neměří kontrast proti vlastní ploše, ale **proti
bílému papíru**: co je vidět jen díky vytištěnému pozadí, se počítá za
neviditelné. Ostatní tři testy hlídají, že se vytisknou všechny záložky,
že se do tisku nedostanou ovládací prvky a že stránka nepřeteče na šířku.

Obsah vychází zhruba na 10,5 stránky A4.

---

## B. Co se ještě neudělalo

### ~~B1. Tři persony~~ (hotovo)

Redesign změnil obrazovky, ne výpočty, ale změnil i to, **co je vidět první**
a co je schované. To se ověřuje průchodem, ne testem.

| Persona | Co ověřit |
|---|---|
| Jednotlivec, nájem, bez cílů | Prázdný stav, verdikt bez bydlení, náhled v průvodci od prvního kroku |
| Pár, bydlení + dítě + rodičovská | Stuha se všemi událostmi, uchopitelný puntík, nejtěsnější místo, Co kdyby |
| Rodina, schodek | Červená stuha, verdikt „nevychází", že rady odkazují na místa, kam se dá kliknout |

Průchody jsou zapsané v `e2e/persony.e2e.ts`, aby se daly zopakovat. Nic
z nich netvrdí, že je obrazovka správně; jen ji projdou a udělají otisk,
posuzuje se okem.

**Prázdný stav je nedosažitelný.** Krok Cíle nepustí dál, dokud není vybraný
aspoň jeden cíl, takže „jednotlivec bez cílů" v appce vzniknout nemůže.
Persona 1 proto míří na nejbližší skutečnou variantu, „bydlení neřeším".

Našlo se šest věcí, všechny opravené:

1. **Dvě rady říkaly totéž.** Rezerva na horší časy měla v `tips.ts` dva
   samostatné tipy; u jednotlivce bez bydlení vyšly hned pod sebou.
2. **Nejtěsnější místo v měsíci nula lhalo.** Text tvrdil, že úspory klesly,
   i když od začátku jen rostly. Nula je zvláštní případ: není to propad,
   ale výchozí stav, a formuluje se jinak.
3. **Dlaždice rezervy si odporovala se svou nápovědou** („0 měs." proti
   „87 815 Kč, což jsou 3 měsíce"). Dlaždice počítá rezervu po zaplacení
   akontace, nápověda před ní; chybělo to říct.
4. **Zmizela poznámka „koupě je za horizontem".** Když se na akontaci
   v deseti letech nedosáhne, cesta ukazuje život bez koupě a neřekne proč.
5. **Bubliny událostí se překrývaly.** Koupě a dítě rok po ní skončily
   na sobě. Řešilo se to střídáním dvou řádků, jenže rozestup řádků byl
   menší než výška bubliny. Nově se bubliny rozestrkají do stran a šířka
   pilulky se odvozuje od délky textu; „Konec rodičovské" se do pevných
   84 jednotek nevešel a text z pilulky vytekl.
6. **Částka nejnižšího bodu ležela na kroužku úchopu.** Uhýbá se stranou,
   a to na tu, kde je místo, s ohledem na všechny puntíky, ne jen nejbližší.

Body 5 a 6 hlídá nový test `popisky na stuze se nepřekrývají` v `ribbon.e2e.ts`.
Šířky se počítají z odhadu šířky písma, takže se to jinak rozejde tiše:
nic nespadne, jen se to překryje.

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
npm run test        # 318 jednotkových testů
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
| `ribbon.e2e.ts` | pohyb, úchop, dotykový cíl 44 px, tisk, vypnutý pohyb, překryv popisků |
| `persony.e2e.ts` | průchod třemi scénáři, otisky k posouzení okem |
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

1. **Tři persony** podle tabulky v B1. Hotovo ve světlém režimu; tmavý zatím
   projitý není, hlídá ho jen `kontrast.e2e.ts`, což je kontrast, ne rozvržení.
2. **Tisk do PDF** ze skutečného prohlížeče, ne jen z Playwrightu.
3. **Klávesnice**: projít celou appku tabulátorem, ověřit pořadí, fokusový
   prstenec a že se dá ovládat stuha i posuvníky.
4. **Mobil**: skutečné zařízení, ne jen zúžené okno. Kontroluje se zoom polí
   na iOS a dosah palcem na spodní lištu.

### C4. Co se neověřuje a proč

- Výpočty. Ty hlídá 318 jednotkových testů a redesign se jich nedotkl.
- Rychlost. Appka počítá desítky čísel nad polem 120 měsíců; není co měřit.
- Prohlížeče starší než dva roky. `@theme inline`, `clamp()` a
  `ResizeObserver` jsou podmínka, ne volba.
