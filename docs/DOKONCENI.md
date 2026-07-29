# Dokončení redesignu: co zbývá a jak to ověřit

Kroky 1 až 9 z `REDESIGN.md` jsou hotové. Tenhle dokument je plán posledního
kroku, tedy kontroly, a soupis toho, co se ještě neudělalo.

Testy: 330 jednotkových, 66 e2e.

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

### ~~B3. Drobnosti odložené z dřívějška~~ (hotovo)

- „Uložit jako scénář" v panelu Co kdyby: **přeskočeno** po dohodě, sdílení
  odkazu dělá totéž.
- **Tónované boxy projité.** Do `Callout` přešlo devět míst: doporučená
  rezerva v průvodci, dvě poznámky u nákladů na dítě, vysvětlení inflace
  u důchodu, tři stavové věty a panel doporučení u vlastních cílů a banner
  cizího přehledu v `App.tsx`.

  `Callout` k tomu dostal prop `pad`. Bez něj to nešlo: `p-4` a `p-3` by
  na prvku byly obě naráz a rozhodovalo by pořadí tříd ve výsledném CSS,
  ne záměr autora. Přesně kvůli tomu se sem dřív box s jiným odsazením
  nedal převést vůbec, což si komentář v souboru poznamenal jako výjimku.

  `CustomGoalPlanner` měl navíc **vlastní `StatusBadge`** stejného jména
  jako sdílená komponenta, ale jiného vzhledu: tónovaná pilulka se slovem,
  zatímco ostatní cíle mají tvar plus slovo bez podkladu. Nahrazeno sdílenou
  komponentou.

  Nepřešly tónované dlaždice s číslem (náklady na dítě, volná rezerva,
  srovnání koupě a nájmu), odznaky a chipy, prázdný stav v `ResultsDashboard`
  a závěrečná věta v `MortgageVsRent`, která se sází základní velikostí
  písma a `Callout` by ji zmenšil. Soupis i důvody jsou v komentáři
  `ui/Callout.tsx`, aby se to nemuselo procházet znovu.
- **Slovníček doplněn** o heslo „Pruh v průvodci a graf rozpočtu". Obojí
  vychází z `expenseCategories`, průvodce jen slučuje do čtyř dílů.
  Při té příležitosti se opravil komentář v `engine/preview.ts`: mluvil
  o osmi kategoriích, jsou jich sedm.

### B4. Klávesnice (hotovo)

Průchod tabulátorem je v `e2e/klavesnice.e2e.ts`. Kontroluje, že každý prvek,
na který se dá dostat tabulátorem, dává fokus najevo, a že se lišta záložek
chová podle vzoru: tabulátorem se do ní vstoupí jednou a mezi záložkami se
jezdí šipkami.

**Našel se jeden skutečný nález.** Úchop události ve stuze měl
`focus:outline-none` bez náhrady. Je to průhledný kroužek v SVG, takže žádný
podklad ani obrys, na kterém by šel fokus poznat, nemá; a je to zároveň
jediné místo v appce, které se myší ovládá tažením, takže bez klávesnice se
s ním nedá dělat nic. Nově má vlastní prstenec (`.ribbon-grip:focus-visible`).

Appka nemá jeden globální fokusový prstenec, každý prvek si ho nese sám
(`focus:ring-2` nebo výchozí obrys prohlížeče). Právě proto se dá zapomenout
a právě proto na to je test.

**Pořadí prvků se neověřuje.** Nikde není kladný `tabindex`, takže pořadí
plyne z pořadí v DOM; to je kontrola pro prohlížeč, ne pro test.

Jeden falešný nález stojí za zápis: tlačítko „Další" má `transition-all`,
takže se mu prstenec roztahuje z nuly a hned po stisku tabulátoru vrací
`outline-width: 0px`. Vypadalo to jako chybějící fokus. Přechody se proto
v testu vypínají, stejně jako v `kontrast.e2e.ts`, kde stejná past chytla
měření barev.

### B5. Persony v tmavém režimu (hotovo)

Čtyři další scénáře v `e2e/persony-tma.e2e.ts`, schválně jiné než ve světlé
sadě, aby při té příležitosti prošly cesty, které zatím nikdo neprošel:
rekonstrukce, samostatné vlastní cíle, všechny čtyři cíle naráz (i na mobilu)
a koupě, na kterou rozpočet nestačí.

Tmavý režim sám o sobě obstál. Zato se našlo pět věcí, které s ním nesouvisí
a které by ve světlém režimu vypadaly stejně špatně:

1. **Zářezy schodku stuhu nepruhovaly, ale mazaly.** Vzorek měl třídu
   `ribbon-draw`, která nastavuje `stroke-dasharray: 3000` v CSS. To přebilo
   atribut `stroke-dasharray="2 6"` na prvku, protože CSS je silnější než
   prezentační atribut, takže se zářezy slily v jeden souvislý tah barvou
   plochy. U plánu, který je v mínusu celých deset let, z celé stuhy zbyla
   skoro prázdná plocha, tedy přesně v situaci, kvůli které stuha vznikla.
   Nově má vzorek vlastní třídu `.ribbon-hatch`; hlídá to test.
2. **Rekonstrukce byla v kalkulačce neviditelná.** Akontace i hypotéka se
   z ní počítají (banka půjčuje proti hodnotě po rekonstrukci), ale řádky to
   neříkaly: pod „cena 7 500 000 Kč" stálo „potřebná akontace (20 %)
   1 680 000 Kč", což je pětina osmi a půl milionu. Přibyly řádky
   „Rekonstrukce" a „Celková investice".
3. **Popisek nejnižšího bodu ležel na stuze.** Potřetí, pokaždé jinde. Místo
   další záplaty tam je teď malý řešitel: projde několik poloh a u každé
   změří vzdálenost od stuhy po celé šířce textu.
4. **Vlastní cíle jako jediná obrazovka tykaly.** „Tvoje cíle", „Seřaď",
   „dosáhneš", a v jedné větě dokonce obojí naráz („Snižte cílovou částku:
   při tvém rozpočtu dosáhneš"). Repozitář má vykání jako pravidlo.
5. **Jeden falešný nález**, který stojí za zápis: grafy v Rechartu se kreslí
   1,5 s animovaně a otisk hned po přepnutí záložky je zachytí useknuté
   v půlce. Vypadá to jako chybný výpočet a poslalo mě to hledat chybu
   v projekci cíle, která žádná nebyla. Otisky teď na dokreslení počkají.

**Rozhodnuto a opraveno (viz B6):** karta vlastních cílů měla dvě pojetí
naráz. Pole „Kolik na tento cíl měsíčně dávám" hlásilo jedno číslo, a hned
pod ním stálo druhé, protože stav počítal `allocateGoals(cíle, disponibilní
částka)`, což pole ignorovalo a rozdělovalo peníze podle pořadí cílů.

**Neopraveno, spíš námět:** období rekonstrukce (`engine/renovation.ts`)
umí spočítat, že se souběžně platí nájem i úroky, ale na výsledcích se
neukazuje nikde, jen v průvodci. Na stuze taky žádná událost není.

### B6. Vlastní cíle: cíl je měsíční částka (hotovo)

Ze dvou pojetí platí to, které uživatel skutečně ovládá. **Cíl je měsíční
částka z volných peněz, jako každý jiný výdaj**, a otázka zní jediná: vyjde
s ní zadaný termín?

Co se změnilo:

- `allocateGoals` je pryč. Nahradil ho `goalProgress(cíl, částka)`, který
  posuzuje jeden cíl podle jeho vlastní částky a nezávisí na ostatních.
  `customReadiness` počítá stejně, takže verdikt nahoře a karta už si
  nemůžou odporovat; dřív každý rozděloval jiný balík.
- Částka se zadává posuvníkem, jehož **strop je vlastní částka plus to, co
  je zrovna volné**. Rozdat víc než volné peníze nejde. Kdyby to šlo,
  rozpočet by tiše spadl do mínusu a appka by přitom tvrdila, že cíl vychází.
- Karta odpovídá na „mám na to" i za všechny cíle najednou: kolik dohromady
  potřebují a kolik je k dispozici.
- **Odložit cíl se dělá v Co kdyby**, ne v kartě. Dřív to byl místní stav
  karty, takže odložení nezměnilo ani verdikt, ani rozpočet; jen zešedla
  karta. Teď je to vypnutá položka jako každá jiná (`other:<id>`) a platí
  pro celý přehled.
- **Priority zmizely.** Šipky a čísla „#1, #2" existovaly jen kvůli
  rozdělování podle pořadí. Pořadí teď na nic nemá vliv a ovládací prvek,
  který nic nedělá, je horší než žádný.

Při té příležitosti se našly tři drobnosti:

- Výchozí rozdělení přestřelovalo. Ze 44 000 Kč na tři cíle vycházelo
  3 × 14 667 = 44 001 a v přehledu stálo „volných zbývá −1 Kč".
- Textové pole s názvem cíle nemělo přístupné jméno: popisek nad ním nemá
  `htmlFor`, takže ho čtečka i test našly jen podle placeholderu.
- „…dosáhnete za 3 roky místo 1 rok" nešlo ohnout do genitivu, protože
  `formatMonths` vrací nominativ. Věta je přeformulovaná, ne ohnutá.

Hlídá to `e2e/cile.e2e.ts` (částka platí, strop drží, cíle si peníze
nepřehazují, odložení přepočítá celý přehled) a unit testy `goalProgress`
a `customReadiness`.

### B7. Revize soudržnosti: sedí čísla napříč obrazovkami? (hotovo)

Průchod celou appkou nad jedním scénářem (rodina, 84 000 Kč čistého, byt za
6 milionů, cíle bydlení + důchod + dítě) s porovnáním každého čísla proti
tomu, co ukazuje vedlejší karta.

**Nic se redesignem neztratilo.** Proti stavu před ním engine jen přibyl
(`journey`, `preview`, `goalProgress`, `isGoalActive`) a jediné, co zmizelo,
je `allocateGoals`, které nahradil `goalProgress`. Ze součástí výsledků
nezmizela žádná a všechny se dál renderují; smazaný `ui/Alert.tsx` se slil
do `Callout`.

Zato se našly **tři chyby ve výpočtu**, všechny starší než redesign a všechny
z jednoho kořene: **vrstva Cesty nevěděla o cílech.** `wealthTimeline`
a `journey` dostávaly jen stav, ne rozdělení peněz na cíle, zatímco verdikt,
rozpočet i karty cílů s ním počítaly celou dobu.

1. **Kupovalo se z peněz, které jsou určené jinam.** Časová osa spouštěla
   koupi, jakmile na akontaci stačilo *celé* jmění, tedy i to, co je odložené
   na důchod nebo na dítě. Na jedné obrazovce pak stálo „chybějící akontace
   300 000 Kč, naspoříte za 4 roky a 4 měsíce" a stuha hned vedle kreslila
   koupi za rok a dva měsíce. `allocation.ts` si přitom v komentáři
   u `monthsToSaveAtAllocation` sám zakazuje počítat termín z celé
   disponibilní částky, protože „jako slíbený termín by lhal".
   Časová osa teď vede zvlášť fond na akontaci, který roste jen o vyhrazenou
   částku. Ve zkoušeném scénáři se koupě posunula z měsíce 14 na 52, což je
   přesně to, co slibuje dlaždice vedle.
2. **Stuha barvila podle toku, ve kterém cíle nejsou.** Verdikt hlásil
   „po koupi by na cíle chybělo 924 Kč měsíčně" a stuha pod tím byla celou
   dobu klidná zelená. `WealthPoint` má nově `flowAfterGoals` a napětí se
   řídí jím.
3. **Dítě se počítalo dvakrát.** Od narození brala appka rezervu na dítě
   (11 333 Kč jako cíl) *i* skutečné náklady dítěte podle věku (6 426 Kč
   jako výdaj). Do narození je rezerva odkládání stranou, od narození se
   dítě platí doopravdy; obojí naráz znamenalo, že domácnost za dítě platí
   dvakrát. Stejně jako odkládání na akontaci končí koupí, končí rezerva
   na dítě narozením.

K tomu dvě věci, které z oprav vypadly:

- **Karta „Nejtěsnější místo" a stuha si odporovaly.** Karta hlásila „plán
  drží po celou dobu" a stuha vedle ní byla poslední tři roky jantarová.
  `findTightest` hledal jen schodek a nízkou rezervu, ne „nezbývá na cíle".
  Důvody jsou nově seřazené od nejvážnějšího: schodek → rezerva pod měsíc
  výdajů → nezbývá na cíle → klid.
- **Práh na schodku cílů.** Bez něj obarvila stuha třetinu horizontu kvůli
  sedmnácti korunám a karta u toho hlásila poplach. Práh je 1 % čistého
  příjmu, nejméně 200 Kč, aby dával stejný smysl u příjmu 30 000 i 150 000.

**Co se neopravilo a proč.** `budgetNow` a `budgetAfterPurchase` jsou snímky
(„jak vypadá měsíc dnes", „jak by vypadal po koupi"), ne časová osa, a proto
u nich rezerva na dítě platí pořád. Časová osa místo ní od narození počítá
skutečný náklad podle věku. Obojí je vnitřně správně, jen dá jiné číslo:
verdikt může říct „po koupi chybí 924 Kč" tam, kde na časové ose v tu dobu
nechybí nic. Srovnat to by znamenalo dostat čas do rozpočtové karty, což je
její protiklad.

Ověřeno bez nálezu: anuita, DSTI (splátka + stávající úvěry ku čistému
příjmu), DTI (celkový dluh ku ročnímu příjmu), náklady na vlastnictví (1 %
z ceny ročně), rezerva po koupi, součet kategorií grafu rozpočtu proti
disponibilní částce.

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
| `persony-tma.e2e.ts` | další čtyři scénáře v tmavém režimu, včetně mobilu |
| `cile.e2e.ts` | vlastní cíle: částka platí, strop drží, odložení funguje |
| `klavesnice.e2e.ts` | fokus je vidět, lišta záložek se ovládá šipkami |
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

1. ~~**Persony**~~: hotovo, tři ve světlém režimu (B1) a čtyři v tmavém (B5).
2. **Tisk do PDF** ze skutečného prohlížeče, ne jen z Playwrightu.
3. ~~**Klávesnice**~~: hotovo, viz B4.
4. **Mobil**: skutečné zařízení, ne jen zúžené okno. Kontroluje se zoom polí
   na iOS a dosah palcem na spodní lištu.

### C4. Co se neověřuje a proč

- Výpočty. Ty hlídá 318 jednotkových testů a redesign se jich nedotkl.
- Rychlost. Appka počítá desítky čísel nad polem 120 měsíců; není co měřit.
- Prohlížeče starší než dva roky. `@theme inline`, `clamp()` a
  `ResizeObserver` jsou podmínka, ne volba.
