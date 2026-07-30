# Dokončení redesignu: co zbývá a jak to ověřit

Kroky 1 až 9 z `REDESIGN.md` jsou hotové. Tenhle dokument je plán posledního
kroku, tedy kontroly, a soupis toho, co se ještě neudělalo.

Testy: 367 jednotkových, 64 e2e (plus 10 otisků person za `PERSONY=1`).

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

### B8. Odkládání cílů v Co kdyby (hotovo)

Přepínače na všechny cíle, ne jen na vlastní: akontace, důchod, dítě
i jednotlivé vlastní cíle. Odškrtnutí platí pro celý přehled, takže se
překreslí i verdikt.

**Odložení cíle se ale neprojeví tam, kde by to člověk čekal.** Odložit
důchod křivkou jmění nehne ani o pixel: spoření na cíl zůstává jměním, jen
leží jinde. Změní se jen volné peníze v rozpočtu. Panel to musel začít říkat
nahlas, protože jinak vypadá, že klik nic neudělal:

- **Dlaždice ukazuje volné peníze, ne disponibilní částku.** Disponibilní
  částka cíle nezná, takže po odložení důchodu hlásily všechny tři dlaždice
  „beze změny", i když se uvolnilo 11 250 Kč měsíčně.
- **Duch se kreslí, jen když se tvar opravdu změní.** Jinak leží přesně pod
  živou stuhou a legenda slibuje přerušovaný obrys, který nikde není.
  U odložení bydlení se tvar změní (zmizí koupě) a duch má co ukázat.
- **Věta, když se tvar nezměnil:** že je to tak správně a kde se změna
  projeví.
- **Nadpis mluví o tom, co uživatel udělal.** Po odložení cíle stálo
  „Zkoušíte: bydlení za 6 000 000 Kč", ačkoli s cenou nikdo nehnul.

Při tom se opravily další dvě věci:

- **Proti čemu se to měří.** `baseline` byl scénář už profiltrovaný
  o odložené cíle, takže odložení nebylo změnou proti ničemu: duch se
  nevykreslil, dlaždice hlásily „beze změny" a tlačítko „Vrátit původní
  scénář" zůstalo zakázané. Nově je `baseline` scénář tak, jak ho uživatel
  zadal.
- **„Odpověď se změnila z máte na to na máte na to."** Porovnával se jen
  `headline`, jenže „Máte na to" a „Máte na to, ale bude to napjaté" ho mají
  stejný. Slouží k tomu nová `answerText()`, která složí celou odpověď
  i s doplňkem za čárkou.

Hlídají to tři testy v `cokdyby.e2e.ts`.

### B9. Vizuální revize polí a tvarů (hotovo)

Průchod všemi obrazovkami průvodce a výsledků na desktopu i mobilu, se
zaměřením na to, jestli pole a bloky vypadají jako jeden systém.

**Chyby, které bylo vidět:**

- **Oddělovací čáry braly barvu textu.** Osm míst mělo `border-t` bez
  barevného tokenu, a Tailwind 4 má výchozí barvu ohraničení `currentColor`.
  Nad součty tak seděla tlustá tmavá čára místo vlasové v `--line`.
- **V průvodci se ořízla částka.** Tři pole cíle vedle sebe s krokovacími
  tlačítky nechala na číslo tak málo místa, že se z „300 000" zobrazilo
  „300 00". Název je nově přes celou šířku a částka s dobou pod ním.
- **Karta cílů se roztáhla přes celou šířku výsledků.** Pole na název cíle
  bylo přes tisíc pixelů široké; formulář má strop.
- **Panel se třemi čísly měl i na mobilu tři sloupce**, takže se lámalo
  i „50 000 Kč/měs.".

**Nekonzistence, které nebyly chybou, jen dvěma jazyky:**

- **Fokusový prstenec měl čtyři pole z třiadvaceti.** Zbytek spoléhal na
  výchozí obrys prohlížeče, takže vedle sebe stála dvě pole a každé při
  fokusu vypadalo jinak (v Safari ještě jinak než v Chromu). Prstenec je
  nově součástí `FIELD`, ne volitelný doplněk.
- **Pole pod 16 px zoomují na iOS.** Čtyři pole měla `text-sm`, což je
  proti pravidlu v CLAUDE.md.
- **Emoji vedle obrysových ikon.** Redesign nahradil emoji ikonami v kroku
  Cíle, ale první krok průvodce si je nechal a rozpis zbytných výdajů také.
  Dvě obrazovky za sebou tak mluvily jiným vizuálním jazykem. Ikony skupin
  navíc seděly v `engine/discretionary.ts`, kam vzhled nepatří.
- **Ikony „pár" a „rodina" byly k nerozeznání**, obojí dvě stejně velké
  postavy. Rodina má nově menší postavu vpředu.
- **Tentýž cíl se zadával dvakrát jinak.** V průvodci „Co chci (název)"
  bez krokovacích tlačítek, na výsledcích „Název cíle" s nimi. Sjednoceno
  na podobu z výsledků.

### B10. Persony 8 a 9: mladý žadatel a člověk před důchodem (hotovo)

Dvě cesty, které dosud žádný průchod nepotkal: pár do 36 let (banka půjčí
90 % ceny, takže z vlastního stačí desetina) a jednotlivec sedm let před
důchodem s dvěma miliony naspořenými.

**Dvě logické chyby, obě vážné, obě měnily verdikt.**

1. **Projekce důchodu ignorovala, co už je naspořeno.** `retirementProjection`
   začínala od nuly, takže člověku s 2 200 000 Kč a sedmi lety do důchodu
   tvrdila, že bude mít portfolio za 745 193 Kč. Renta z toho vyšla tak
   nízko, že se i verdikt překlápěl na „zatím spíš doplněk", ačkoli samotné
   dnešní úspory dají přes sedm tisíc měsíčně.

   Projekce nově začíná od `retirementStartingCapital(state)`, což jsou
   úspory po odečtení akontace (ty peníze skončí v nemovitosti) a tříměsíční
   nouzové rezervy (ta musí zůstat po ruce). Bez toho odečtení by se tytéž
   peníze počítaly dvakrát. V kartě je to editovatelné pole, protože kolik
   z dnešních peněz je opravdu na důchod, ví jen uživatel.

   Oprava odhalila navazující chybu: sloupec „Složené úroky" počítal hodnotu
   minus vklady, takže u řádku „Hotovost (pod polštářem)" při nulovém výnosu
   hlásil dva miliony úroků. Odečítají se nově všechny vlastní peníze.

2. **Verdikt „napjaté" vysvětloval vždycky totéž.** Status `tight` má tři
   příčiny (tenká rezerva, málo zbývá po výdajích, cíl na hraně), ale
   zdůvodnění znělo pokaždé „bez velkého polštáře, nečekaný výdaj by rozpočet
   rozhodil". U člověka před důchodem to stálo hned vedle dlaždice „rezerva
   vydrží 78,6 měsíce". Každá příčina má nově vlastní větu a `buildVerdict`
   dostává `TightReason`.

**Vizuálně zbyla dvě místa, která redesign minul.** Emoji 👶 v hlavičce
nákladů na dítě, a tři tlačítka `ⓘ` v barvě značky (inflace, pravidlo 4 %,
náklady na dítě), zatímco zbytek appky má nápovědu jako `?` v kroužku.
Vzhled tlačítka je nově sdílený (`HELP_BUTTON` v `ui/Tooltip.tsx`); rozbalují
dál celý odstavec, ale vypadají jako nápověda, kterou uživatel v appce zná.

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
| `persony.e2e.ts` | pět scénářů, otisky k posouzení okem (jen s `PERSONY=1`) |
| `persony-tma.e2e.ts` | další čtyři v tmavém režimu, včetně mobilu (`PERSONY=1`) |
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

**Otisky person.** Devět scénářů ve světlém i tmavém režimu:

```bash
PERSONY=1 … npx playwright test --project=chromium persony
```

Bez proměnné se přeskočí, stejně jako pixelové porovnání. Nic netvrdí a nic
nemůže selhat, jen fotí celou stránku v plné výšce; ve společném běhu se
zbytkem sady se jedna z nich zasekla na půl druhé minuty a spadla na limit,
přestože samotné projití všech deseti trvá 37 sekund.

### C3. Ruční, na závěr

1. ~~**Persony**~~: hotovo, tři ve světlém režimu (B1) a čtyři v tmavém (B5).
2. **Tisk do PDF** ze skutečného prohlížeče, ne jen z Playwrightu.
3. ~~**Klávesnice**~~: hotovo, viz B4.
4. **Mobil**: skutečné zařízení, ne jen zúžené okno. Kontroluje se zoom polí
   na iOS a dosah palcem na spodní lištu.

### C4. Co se neověřuje a proč

- Výpočty. Ty hlídá 318 jednotkových testů a redesign se jich nedotkl.
- Rychlost. Appka počítá desítky čísel nad polem několika stovek měsíců;
  není co měřit.
- Prohlížeče starší než dva roky. `@theme inline`, `clamp()` a
  `ResizeObserver` jsou podmínka, ne volba.

---

## B11. Horizont Cesty: deset let končilo dřív než plán

Cesta i graf jmění počítaly pevných 120 měsíců. Na otázku „mám na bydlení"
to stačilo, jenže hypotéka se bere na 15 až 30 let a důchod je ještě dál,
takže se osa uzavírala dřív, než se stalo cokoli, na co si člověk spoří.
Graf „koupě vs. nájem" přitom počítal třicet let a důchodová projekce do 65:
appka si sama se sebou odporovala v tom, jak daleko dohlédne.

Horizont teď dává `planHorizonMonths()`: k odchodu do důchodu, nejméně deset
let (aby měl plán co ukázat i těsně před ním) a nejvíc čtyřicet (proti
nesmyslně zadanému věku). U páru rozhoduje mladší, protože s ním končí příjem
domácnosti. Dál by osa musela umět rentu místo mzdy, což je jiná úloha.

Prodloužení odhalilo dvě věci:

1. **Časová osa nevěděla, že hypotéka jednou skončí.** U patnáctileté splácela
   domácnost celých třicet let stejnou splátku, tedy i patnáct let poté, co
   měla doplaceno, a osa zamlčela největší skok v rozpočtu za celý plán.
   Do desetiletého okna se to nevešlo, protože nejkratší volitelná hypotéka
   je patnáctiletá. Doplacení je nově i pojmenovaná událost na stuze.
2. **Popisek „nejníž" odletěl na opačný konec grafu.** Vybíral se podle
   největší svislé mezery od stuhy, a když se všechny události nakupí
   v prvních letech, je nejprázdnější místo grafu o půl osy dál; od popisku
   pak vedla tečkovaná čára přes celou šířku. Nekolidovat je nově podmínka
   (šest jednotek mezery) a být u svého bodu cíl, ne naopak.

Inflace a výnosy se nepřidávaly schválně. Mzdy i výdaje rostou zhruba stejně,
takže se v poměru vykrátí a všechno je v dnešních cenách; naspořená částka se
neúročí, což je konzervativní. Stojí to v předpokladech („Horizont plánu")
i pod grafem jmění. Alternativa by vyrobila čísla, která vypadají přesně
a stojí na odhadu inflace na třicet let dopředu.

---

## B12. Výřez z cesty

Prodloužený horizont něco získal a něco ztratil. Průchod obojím ukázal, kde
je hranice.

**Získalo se to hlavní na Co kdyby.** Rozdíl proti původnímu scénáři se
v prvních letech skoro nepozná; obě křivky leží na sobě a přerušovaný obrys
je k ničemu. Teprve na dvaceti a víc letech se rozevřou tak, že je vidět,
co změna ceny nebo odložení cíle udělá.

**Ztratily se nejbližší roky.** U třicátníka je koupě, narození dítěte
i konec rodičovské v prvních čtyřech letech z pětatřiceti, tedy v prvních
deseti procentech šířky. Puntíky splynou v jeden shluk u levého okraje,
bublinky se odsouvají daleko od nich a k popisku „nejníž" vede tečkovaná
čára přes půl grafu. Přitom právě těch pár let je jediná část plánu, se
kterou se dá něco udělat.

Řešením je výřez: přepínač „10 let / 20 let / Celý plán" nad stuhou, potichu
vpravo nahoře. Ukáže se, jen když je co přepínat; komu je do důchodu sedm
let, ten má horizont na minimu a přepínač nevidí. Výchozí je celek.

Klíčové je, že **výřez je způsob dívání, ne jiný výpočet**. Cesta se počítá
pořád celá, jen se kreslí její začátek, takže verdikt a karta nejtěsnějšího
místa dál mluví o celém plánu a nemůžou si s obrázkem odporovat. Aby ani
zkrácená stuha nemlčela o tom, co ořízla, doplňuje ji `beyondView()` jednou
větou: „Za zobrazeným úsekem plán ještě něco čeká: Po koupi 2042…". Napjaté
místo má přednost před událostmi, protože je to jiná zpráva.

Záložky mají výřez každá vlastní. Na Cestě se čte verdikt a hodí se nejbližší
roky, v Co kdyby se porovnávají dva scénáře a hodí se celek.

### Co se u toho našlo a neopravilo

V Co kdyby hlásí dlaždice „Volných měsíčně" **beze změny** i po zlevnění
nemovitosti o 1,4 milionu, přestože splátka klesla o 6 611 Kč. Není to chyba
výřezu: `budgetNow` je rozpočet **dneška**, kdy se ještě platí nájem, ne
splátka. Vedle dlaždice „Měsíční splátka −6 611" to ale čte jako rozpor.
Je to tentýž rozdíl mezi snímkem a časovou osou, který je popsaný v B7;
srovnat ho znamená dát do rozpočtové karty čas, což je její opak.

---

## B13. Přepočet enginu a pravdivost výroků

Nezávislý přepočet šesti scénářů (pár, levnější byt, starší žadatelé,
rodičovská, jednotlivec před důchodem, napjatý rozpočet) mimo engine,
jinými vzorci, proti dumpu z enginu.

**Aritmetika sedí.** Bez neshody prošly: příjmy a výdaje, nezbytné výdaje,
disponibilní částka, míra úspor, rezerva v měsících, cena včetně
rekonstrukce, podíl a výše akontace, výše úvěru, anuitní splátka (počítaná
druhým tvarem vzorce), náklady na vlastnictví, výdaje po koupi, DSTI, DTI,
celkové úroky, rezerva po koupi, základ důchodového portfolia, počet let
do důchodu, projekce portfolia, horizont plánu a tok v prvním měsíci časové
osy. Ověřeno i zvlášť: úroky prvního roku (265 978,82 Kč amortizací měsíc
po měsíci, engine dává totéž), odpočet úroků (strop 150 000 Kč × 15 %),
srovnání koupě vs. nájem (rok 1 nezávisle 891 337 vlastník / 800 845
nájemník, engine shodně) a průměrné náklady na dítě (2 448 000 Kč za 18 let,
tedy 11 333 Kč měsíčně).

**Pět výroků ale neplatilo.**

1. **„Rodičovská 2042" u domácnosti, která žádnou rodičovskou nezadala.**
   Nejtěsnější místo pojmenovávalo poslední proběhlou událost bez ohledu
   na to, jak dávno byla, takže schodek z nákladů na patnáctiletého potomka
   zdědil jméno po narození dítěte o patnáct let dřív. Rodičovská se teď
   pozná podle toho, že v tu chvíli opravdu běží, a „Po koupi" platí jen
   dva roky po koupi.
2. **„Úspory to pokryjí, ale klesnou na 200 000 Kč"** u domácnosti, jejíž
   úspory nikdy neklesly: 200 000 Kč byla částka, se kterou začínala.
   Globální minimum bývá na startu, takže se hloubka propadu měří až od
   schodku dál. Táž chyba byla u napjatého místa už dřív ošetřená, u schodku
   ne.
3. **Renta v korunách roku 2060.** `retirementReadiness` počítala nominálně
   (7 % bez inflace) a psala „v důchodu to vyjde zhruba na 95 962 Kč
   měsíčně", zatímco Cesta vedle je celá v dnešních cenách. Dvojí měřítko
   v jednom přehledu, a hranice „pod 8 000 Kč je to spíš doplněk" se
   porovnávala s číslem, které dnešními penězi znamenalo necelé tři tisíce.
   Projekce teď jede reálným výnosem a věta říká „v dnešních cenách"; z
   95 962 Kč je 46 579 Kč.
4. **„Během volna vám měsíčně zbyde 13 790 Kč"** platilo 6,4 měsíce z 36.
   Byl to průměr vážený délkou fází, který krátká vysoká mateřská vytáhla
   nahoru; po ní zbývalo 9 548 Kč. `parentalLeave.ts` si přitom v komentáři
   sám zakazuje mluvit o volnu průměrem. Nově se uvádí nejhorší měsíc.
5. **„Podrobnosti najdete u cíl níže."** `goalWord()` je psaný pro čtvrtý
   pád („na cíl X") a byl použitý po předložce „u", která žádá druhý.

Doplněno ještě k srovnání koupě vs. nájem: graf je nominální (3 % zhodnocení,
7 % výnos, 3 % růst nájmu), takže rozdíl „o 4 809 556 Kč líp" jsou koruny za
třicet let. Na to, která čára je výš, to nemá vliv, obě jsou počítané stejně,
ale bez poznámky to vedle dnešních cen jinde v appce mate. Poznámka doplněna.

### Co zůstává nesrovnané

Verdikt u rodičovské říká „cíle se do rozpočtu vejdou", zatímco karta
nejtěsnějšího místa hlásí, že na cíle bude v roce 2027 chybět 13 362 Kč.
Obojí je vlastním způsobem správně: verdikt staví na `budgetNow` a
`budgetAfterPurchase`, což jsou snímky, které o rodičovské nevědí. Je to
tentýž rozdíl mezi snímkem a časovou osou jako v B7 a B12 a srovnat ho
znamená dát do rozpočtové karty čas. Informace uživateli nechybí: karta
nejtěsnějšího místa i řádek cíle „Rodičovská" ji říkají obě.

---

## B14. Přidání cíle na grafu, popisky a animace

### Přidání cíle se počítá správně

Ověřeno porovnáním časové osy se stejným zadáním a různými cíli.

**Dítě** je namodelované přesně. Rozdíl koncových úspor mezi „bez dítěte"
a „s dítětem" je 2 448 000 Kč, což je na korunu součet tabulky ČSÚ do
osmnácti let ((3×8 000 + 3×10 000 + 9×12 000 + 3×14 000) × 12). Náklad se
láme přesně na hranicích věkových pásem (8 000 → 10 000 → 12 000 → 14 000 →
0 po osmnáctinách) a posun narození posune celý náklad, ne jen popisek: kdo
má dítě hned, má za pět let míň, ale na konci horizontu vyjde totéž. Na
stuze přibude událost, v grafu úspor svislice.

**Ostatní cíle** křivkou nehnou vůbec, a je to tak správně: odložené peníze
jsou pořád vaše, jen leží jinde. Projeví se na `flowAfterGoals`, tedy na
barvě stuhy, a v rozpočtu. Zamlčené to není, „Co kdyby" to říká vlastní
větou. Uzamčeno testy.

### Křivka se jmenovala jinak, než co ukazuje

Karta se jmenovala **„Vývoj jmění v čase"**, jenže řada žádné jmění není:
akontace z ní při koupi odejde a hodnota nemovitosti se zpátky nepřičte.
U páru s bytem za 6,2 milionu tak vedle sebe stálo 14,4 milionu („jmění"
= jen úspory) a 16,6 milionu (skutečné čisté jmění z grafu koupě vs. nájem)
o téže domácnosti. Přejmenováno na „Vývoj úspor v čase" a v poznámce pod
grafem je napsané, že hodnota nemovitosti v křivce není a kde ji hledat.

### Popisky ukazovaly vedle

Bublina má minimální šířku, kterou si nese od doby desetiletého horizontu:
84 jednotek i pro slovo „Dítě". Na horizontu do důchodu se události mačkají
v prvních letech a každá zbytečná jednotka šířky odstrčí bublinu dál od
jejího puntíku, takže „Dítě" viselo dvě stě jednotek vpravo od události,
kterou popisuje. Minimum sníženo na skutečnou šířku textu.

Vodicí čára byla jedna dlouhá úhlopříčka od puntíku k bublině, která
neukazovala na nic. Teď je to loket: svislý úsek vyrůstá přímo z puntíku
a teprve pod bublinou se odbočí. Rameno nikdy neleží nad puntíkem, aby
u události na vrcholu křivky čára nejdřív neklesala.

### Animace se zadrhávala

`.ribbon-draw` měla `stroke-dasharray: 3000`, ale dráha stuhy měří kolem
700 (naměřeno 704,25). Stuha byla proto dokreslená po zhruba devadesáti
milisekundách z jedné a půl vteřiny; zbytek animace byla prodleva, po které
teprve naskákaly popisky. Vypadalo to jako zadrhnutí, ne jako kreslení.

Délka se nově normalizuje atributem `pathLength="1"` na prvku, takže
`stroke-dasharray: 1` znamená „celá stuha", ať měří cokoli. Kreslení trvá
1,1 s a opravdu celou dobu kreslí; popisky nabíhají od 1,0 s po 0,08 s.

### Co zůstává k rozvaze

Řada `cash` počítá i peníze odložené na důchod, a z ní se odvozuje „rezerva
vydrží X měsíců" i barva stuhy. U někoho, kdo dvacet let odkládá na
důchodové portfolio, je pak polovina „rezervy" ve skutečnosti v akciích na
třicet let. Prakticky to skoro nevadí, protože nejtěsnější místo bývá brzy,
kdy je portfolio ještě malé, ale rozlišit likvidní rezervu od investic by
znamenalo vést v časové ose dva hrnce místo jednoho. Není to oprava textu,
je to změna modelu.

---

## B15. Úklid podle zpětné vazby

Šest věcí najednou, většina z nich důsledek toho, že Cesta mezitím vyrostla.

**„Volno" místo rodičovské.** „Po dobu volna vám bude chybět" znělo jako
dovolená. Uživatelské texty mluví o rodičovské, ne o volnu; přejmenováno
v enginu (verdikt, připravenost, předpoklady) i v kartě rodičovské.

**Odečet pod kurzorem se schovával za bubliny.** Seděl na pevném řádku
nahoře, což je přesně řádek bublin s událostmi: u „Dítě" nebyla částka
vidět. Teď se drží u svého bodu na stuze, má pod sebou pilulku a kreslí se
jako poslední, takže leží nad vším ostatním. Nad bod jde jen tehdy, když
se tam vejde pod řádek bublin, jinak pod něj.

**Lišta záložek dolů pod hlavičku.** V hlavičce se mačkala mezi značkou
a ikonami. Vlastní pruh přes celou šířku má místa dost a lepí se pod
hlavičku, takže zůstává po ruce. Obal se drží obsahu (`w-fit`) a začíná na
stejné svislici jako značka nad ním a nadpis pod ním: dokud lišta seděla
uprostřed hlavičky, dávalo vystředění smysl, ve vlastním pruhu z toho byl
proužek plovoucí uprostřed, zatímco všechno ostatní bylo u levého okraje.

**Záložka se jmenuje podle cílů**, ne „Ostatní cíle". Jeden cíl dá „Důchod",
dva „Dítě a důchod", vlastní cíl své jméno; u tří a víc, nebo když by se
dlouhý název nevešel, „Vaše cíle". Jména cílů jsou nově na jednom místě
(`engine/goalNames.ts`), dřív byla rozepsaná ve třech.

**„Co kdyby" jsou přepínače cílů a pod nimi jejich parametry.** Dřív stály
posuvníky nahoře a odkládání cílů pod nimi jako zaškrtávátka, takže nešlo
poznat, že „Cena nemovitosti" patří k bydlení. Přepínač bydlení přitom nikdy
nebyl jen o spoření: odloží celý cíl, koupě se nekoná a dál se platí nájem.
Jmenoval se ale „Spoření na akontaci", což slibovalo mnohem míň, než co dělá.
Vypnutý cíl své parametry schová, protože sazba u nemovitosti, kterou
nekupujete, je otázka bez smyslu.

S tím se musely srovnat i dlaždice pod grafem. Zrušení koupě sundalo splátku
o 29 276 Kč, a hned vedle stálo „Volných měsíčně: beze změny" (protože
`budgetNow` je rozpočet dneška, kdy se ještě platí nájem) a „Rezerva po
koupi: 0 měsíců" (rezerva po koupi, která se nekoná). Obojí se teď počítá
pro stav, kdy plán běží: když se kupuje, tak po koupi, jinak podle dneška,
a popisek dlaždice to říká.

### Dva grafy pryč

**„Vývoj úspor v čase" v Rozpočtu** kreslil tutéž řadu jako Cesta, jen jinou
barvou a bez barvení podle napětí. Před smazáním jsem prošel, co uměl navíc:
pole „Dítě čekáme za" (Cesta má tažný puntík i ovládání šipkami), svislice
událostí (Cesta má bubliny), hlášku o nejnižším bodu (karta nejtěsnějšího
místa říká víc), varování o nedosažitelné akontaci (stojí i pod stuhou)
a odečet po najetí (Cesta má taky). Jediné, co nikde jinde nebylo, je
poznámka o modelu; ta se přesunula pod stuhu.

**„Výhled: vývoj úspor s koupí vs. bez" v Bydlení** je přesně to, co dnes
dělá přepínač bydlení v „Co kdyby": živá cesta proti přerušovanému obrysu
původního scénáře, navíc přes celý horizont místo deseti let. Varování
o trvalém poklesu úspor po koupi nese barva stuhy a karta nejtěsnějšího
místa.

S nimi šla `cashFlowAfterPurchase()` z enginu a její testy; nic jiného ji
nepoužívalo.

---

## B16. Navigace, kroky průvodce a výdaje k přepsání

**Záložky jsou sloupec vlevo.** Vodorovná lišta pod hlavičkou sice měla
místa dost, ale využila z něj třetinu a zbytek byl prázdný pruh nad obsahem.
Ve sloupci má každá záložka svůj řádek a čte se jako obsah. Na úzkém okně
sloupec nedává smysl, tam zůstává řádek nahoře přilepený pod hlavičkou; je
to jedna komponenta ve dvou podobách, ne dvě, protože `id` záložek drží
`aria-controls` i kotvy testů a dvakrát vykreslené by se rozešly. Šipky
fungují v obou osách.

**Kroky průvodce mají zase jména.** Zbyl z nich holý proužek s počítadlem,
což bylo úsporné, ale ztratilo se tím, co který dílek je: kdo se z výsledků
vrátil tlačítkem „Upravit", uviděl „Krok 5 z 6" a pruh beze jmen a neměl
podle čeho kliknout, když se chtěl přesunout na výdaje. Jména jsou zpátky
jako popisek dílku, ne jako druhá řada koleček. Na úzkém okně se zalomí do
dvou řádků; uříznutí nešlo, „Vlastní bydlení" i „Vlastní cíle" končily jako
„Vlastní…".

**Výdaje jdou přepsat rovnou v Rozpočtu.** Průvodce je nasbírá jednou a pak
se k nim uživatel dostal jen tlačítkem „Upravit", které ho vyhodí do
formuláře a připraví o kontext. Přitom „kolik by se změnilo, kdybych utrácel
o dva tisíce míň za jídlo" je otázka nad výsledky, ne nad formulářem. Nová
karta píše do **zadaného** stavu, ne do toho po „co kdyby": jsou to skutečné
údaje, takže se ukládají a přepočítá se z nich celý přehled včetně odpovědi
nahoře. Součet je hned pod poli, aby se po každé úpravě nemuselo scrollovat
nahoru.

Zbytné výdaje jsou jedním polem, dokud si je uživatel nerozepsal; s rozpisem
je pole součtem a upravují se položky, jinak by se dvě čísla o téže věci
přetlačovala. Definice kategorií (popisky, nápovědy, kroky) jsou nově
v `engine/expenseFields.ts` a berou si je průvodce i výsledky; dva opisy by
se dřív nebo později rozešly.

**Odložené bydlení dál platí nájem** (ověřeno testem). Přepínač odloží celý
cíl, takže se koupě nekoná, nájem i energie zůstávají mezi výdaji a měsíční
tok je 49 700 Kč místo 38 724 Kč po koupi. Rozdíl 34 476 Kč je splátka
29 276 Kč plus 5 200 Kč nákladů na vlastnictví minus nájem 23 500 Kč.
