# Dokončení redesignu: nálezy, opravy a co se schválně nechává být

Kroky 1 až 9 z `REDESIGN.md` jsou hotové. Tenhle dokument začal jako plán
poslední kontroly a je z něj **průběžný zápisník**: co se při procházení
appky našlo, co se opravilo a hlavně co se opravit nemá a proč. Poslední
patří sem, ne do commit message, kterou nikdo znovu nenajde.

Aktuální popis toho, co appka umí, je v `README.md`; pravidla pro práci
s kódem v `CLAUDE.md`.

Testy: 385 jednotkových, 70 e2e (plus 10 otisků person za `PERSONY=1`).

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

---

## B17. Přehled místo Cesty, a tři věci z uživatelského průchodu

**Záložka „Cesta" se jmenuje „Přehled".** S ní se přejmenovala i prose:
kde stálo „Cesta vlevo se překreslí", stojí „Časová osa vlevo", protože
slovo „cesta" bylo ukotvené názvem záložky a bez něj zůstalo viset ve
vzduchu. `id` sekce zůstává `souhrn`, je ve sdílených odkazech i v kotvách
testů.

**Není poznat, že se do přehledu dá sáhnout.** Editovatelná je skoro celá
stránka (akontace, sazba, výdaje, částky u cílů, délka rodičovské, termín
dítěte na stuze), ale vypadá jako report, takže se uživatel vracel do
průvodce i tam, kde stačilo přepsat pole před sebou. Nahoře je proto
nápověda, která to říká; zavírá se křížkem a zavření si pamatuje
`localStorage` pod vlastním klíčem (je to předvolba zobrazení, ne zadaný
údaj, takže do sdíleného odkazu nepatří).

**Sdílení řekne, co v odkazu bude, než ho zkopíruje.** Je to jediná akce
v appce, která pustí data z prohlížeče ven, a dělala se jedním kliknutím.
Odkaz navíc nejde zneplatnit: komu se jednou pošle, tomu zůstane. Seznam
(příjmy, výdaje, úspory, cíle, parametry hypotéky, rodičovská) se proto
vypisuje **před** zkopírováním, ne po něm.

**Z průvodce se jde vrátit na přehled.** Kdo klikl na „Upravit", opravil
jedno pole a chtěl zpátky, musel se proklikat zbytkem kroků. Tlačítko
dostane jen ten, kdo z výsledků přišel; kdo průvodce teprve vyplňuje, žádný
přehled ještě nemá. Stav se ukládá po každé změně, takže přehled je po
návratu aktuální.

---

## B18. Grafy na mobilu a „a co teď"

**Stuha byla na telefonu nečitelná.** `viewBox` měl pevných 700×250 a SVG se
škálovalo na šířku rodiče: na desktopu vyšla jednotka na 1,26 px, na mobilu
na 0,5 px. Text psaný na 11 jednotek se tak vykreslil jednou jako 14 px
a podruhé jako 5 px, popisky událostí i částky byly na telefonu k nepřečtení
a graf sám jen 125 px vysoký.

Škálovat text zpětně (`fontSize / scale`) by šlo, ale musely by se tak ošetřit
i tloušťky čar, poloměry puntíků, výšky pilulek a všechna odsazení, tedy skoro
každé číslo v souboru. `viewBox` se proto řídí naměřenou šířkou a **jedna
jednotka je vždy jeden pixel**; výška má spodní mez 200, aby z grafu na mobilu
nebyl proužek. Popisky roků navíc nově řídí šířka, ne jen délka horizontu:
letopočet potřebuje kolem 38 px, takže se na telefonu kreslí po deseti letech
místo po pěti.

Vyplavalo u toho, že **popisky braly pointer události**. Text „nejníž
525 024 Kč" ležel přes úchop dítěte a chytal ho celou svou šířkou, takže se
s puntíkem nedalo hýbat. Bublina, vodicí čára, popisek nejnižšího bodu i roky
na ose jsou teď `pointer-events: none`; interaktivní je jen úchop.

**Karta „A co teď"** je jeden krok s částkou a termínem, hned pod odpovědí.
Schválně to není seznam: rady „co můžete udělat" v pravém sloupci zůstávají,
ale seznam možností není úkol, a kdo si má vybrat, odejde bez rozhodnutí.
Pořadí je dané tím, v jakém se ty věci musí řešit: nevyrovnaný rozpočet →
splátka, na kterou banka nepůjčí → akontace → nouzová rezerva → důchod →
peníze ležící ladem. Splátka je před akontací proto, že spořit na akontaci
k ceně, na kterou banka nepůjčí, je práce nazmar; akontace je před rezervou
proto, že je to aktivní spořicí cíl, a rezerva po koupi se k ní připočte ve
vysvětlení, ať se na ni nezapomene.

Věta neopakuje částku, kterou karta sází velkým písmem, a termín je datum
(„v březnu 2027"), ne počet měsíců: „za 41 měsíců" si nikdo nepřevede, datum
si zapíše do kalendáře.

### Co se u toho našlo

Test tažení puntíkem začal padat, ale ne kvůli `viewBox`. `boundingBox()`
vrací souřadnice v dokumentu, kdežto myš se hýbe v okně, a přidáním karty
„A co teď" se stuha posunula pod ohyb. Klik dopadl jinam. Test se nově
odscrolluje; appka byla v pořádku.

---

## B19. Průchod jedním scénářem: pár, dítě a vlastní byt

Kontrola čísel i výroků na jednom konkrétním zadání. Pár 30 a 30 let, čisté
příjmy 45 000 a 38 000 Kč, výdaje 38 000 Kč (z toho 17 000 nájem a 4 000
energie), naspořeno 900 000 Kč, byt za 5 500 000 Kč na 30 let, dítě za rok
a tříletá rodičovská na osobu 2.

**Aritmetika sedí do koruny.** Ověřeno nezávislým přepočtem: akontace 10 %
(oběma je pod 36) = 550 000 Kč, úvěr 4 950 000 Kč, splátka 25 970,94 Kč,
náklady na vlastnictví 4 600 Kč, DSTI 31,3 %, DTI 4,97, úroky za celou dobu
4 399 538 Kč, rezerva po koupi 8,03 měsíce, horizont 420 měsíců (35 let do
důchodu). Na časové ose sedí i každý zlom: koupě v měsíci 0, narození ve 12,
konec rodičovské ve 48, doplacení ve 360, a toky mezi nimi odpovídají
pásmům nákladů na dítě (8 000 → 10 000 → 12 000 → 14 000 → 0) i fázím dávek
(mateřská 33 652 Kč po 6,4 měsíce, pak rodičovský příspěvek 11 824 Kč).

**Dva výroky ale neplatily.**

### Karta rodičovské počítala rodičovskou bez dítěte

Stálo tam „Během rodičovské vám měsíčně zbyde nejméně 9 253 Kč", zatímco
časová osa hned vedle počítala pro tutéž dobu 1 253 Kč. Rozdíl je přesně
8 000 Kč, tedy náklad na dítě do tří let podle tabulky ČSÚ:
`evaluateParentalLeave` počítala výdaje po koupi, ale dítě do nich nezahrnula.
Rodičovská je přitom z definice doba, kdy je doma miminko.

Náklad se teď bere ze stejné funkce jako na časové ose
(`monthlyChildCostAtAge`, přesunutá z `wealthTimeline` do `childCost`), a to
po fázích, aby u volna delšího než tři roky zachytila přechod do dražšího
pásma. Obě čísla teď musí sedět, hlídá to test.

Následek je správný a dost velký: `leaveReadiness` u téhle rodiny padne
z „v pořádku" na „pozor" (1 253 < 3 000) a verdikt se z „Máte na to" změní
na **„Máte na to, ale bude to napjaté, na hraně je Rodičovská"**. Což je
přesně to, co ta rodina potřebuje vědět.

### „A co teď" doporučovalo částku, kterou nejde udržet

Karta radila „Rozhodněte, kam půjde volná rezerva, 33 667 Kč měsíčně". Jenže
33 667 Kč je rozpočet **dneška**, kdy se ještě platí nájem, a tenhle pár
kupuje hned: po splátce jim zbyde 24 096 Kč. A během rodičovské, tedy tři
z následujících čtyř let, jen 1 253 Kč.

`spare()` bere nově tu nižší ze dvou: rozpočet po koupi, když se kupuje hned,
a nejhorší měsíc rodičovské, když je v plánu. Krok zní „nastavte si trvalý
příkaz", takže to musí být částka, kterou domácnost udrží; a `why` dodá, že
po skončení rodičovské jí bude výrazně víc.

### Co se ověřilo a je v pořádku

Daňové zvýhodnění na dítě se sice počítá dřív, než se dítě narodí, ale karta
u toho výslovně říká „Zvýhodnění na dítě až po jeho narození". Jednorázové
náklady při koupi (11 600 až 31 000 Kč), rozvaha nad akontací (bezpečné
maximum 638 574 Kč při vložených 550 000 Kč) i odpočet úroků (v prvním roce
235 949 Kč, odečíst jde 150 000, úspora 22 500 Kč) sedí.

### Co se nechávalo být, a proč už ne

Stuha byla po celý horizont klidná, i když tři roky rodičovské jela rodina na
1 253 Kč měsíčně. Napsalo se sem, že to není ohrožení. Není, ale „plán drží
po celou dobu" u rozpočtu, kde zbývá tisícovka, je věta, kterou by nikdo
nenapsal, kdyby to číslo viděl. Opraveno v B20.

## B20. Výroky, které si odporovaly s čísly pod sebou

Pokračování B19. Zadání znělo „oprav ty výroky, ať to funguje správně",
takže padlo i to, co se v B19 nechávalo být, a při té příležitosti se našly
další tři případy téhož: věta a číslo vedle ní o téže věci, jen jinak
spočítané.

### Tenký, i když kladný tok

Model napětí uměl schodek, chybějící rezervu a nefinancované cíle. Neuměl
„vyjde to, ale o vlásek". Přibyl proto čtvrtý důvod k napětí: **kladný tok
pod 5 % čistého příjmu** (nejméně 1 000 Kč, aby to dávalo smysl i u nízkých
příjmů). Práh se schválně měří na `flow`, ne na `flowAfterGoals`: kdo
dobrovolně posílá všechno na cíle, si napětí nezpůsobil, kdežto během
rodičovské klesne sám příjem.

U páru z B19 se tím stuha od 20. měsíce do konce rodičovské zbarví a karta
místo „Nejníže 2026, plán drží po celou dobu" říká **„Rodičovská 2027:
Rozpočet vyjde, ale zbyde jen 2 753 Kč měsíčně. Odkládat se v tu dobu skoro
nedá a nečekaný výdaj musí z úspor."** Verdikt nad tím mluví o téže
rodičovské, takže si obrázek, nadpis i karta konečně říkají totéž.

Pojmenování období (`Rodičovská` / `Po koupi` / jinak) se vytáhlo ze schodkové
větve do `whatHappensAt()`, aby obě větve popisovaly tutéž chvíli stejně.

### Rezerva měřená výdaji, které v tu dobu neplatí

V přehledu stálo u nejnižšího bodu „Úspory klesnou na 151 312 Kč, což je
5 měsíců nezbytných výdajů" a o dva centimetry vedle „rezerva po koupi
vydrží 2,8 měsíce". Obojí o týchž penězích. Časová osa dělila **dnešními**
nezbytnými výdaji, dlaždice těmi **po koupi**, a rozdíl mezi nájmem
a splátkou je skoro dvojnásobek.

Vzorec byl navíc rozepsaný na třech místech (`mortgage`, `downPayment`,
`nextStep`). Je teď jednou v `necessaryExpensesAfterPurchase()` a časová osa
si podle měsíce vybírá, který z obou dělitelů platí.

Zbývá rozdíl jednoho měsíce přebytku: dlaždice mluví o okamžiku po zaplacení
akontace, osa o konci toho měsíce, kdy už přiteklo. Obojí je pravda o jiné
chvíli a obojí je tak i popsané; sjednotit by šlo jen tak, že by minimum osy
přestalo odpovídat nakreslené křivce.

### „Chybí 5 855 Kč, tedy 3 měsíce nezbytných výdajů"

Ne. Tři měsíce byla ta cílová částka, ne to, co do ní scházelo. Věta teď zní
„To jsou 3 měsíce nezbytných výdajů, chybí do nich 8 063 Kč", a kdo nemá
stranou nic, čte „a chybí celá" místo téhož čísla dvakrát pod sebou.

Ke stejné rodině: cíl rezervy se u kupujícího počítá z výdajů po koupi.
Dřív se počet měsíců po koupi násobil dnešními výdaji, což **rozhodlo
správně** (poměr vyjde stejně), ale ukazovalo částku o čtvrtinu nižší, než
na jakou se ve skutečnosti spoří.

### Nouzový fond ve dvou různých částkách

Rada „mějte stranou nouzový fond, ideálně 3–6 měsíců výdajů (pro vás cca
136 000 Kč)" počítala se všemi dnešními výdaji, zatímco slovníček i karta
„A co teď" mluví o nezbytných výdajích po koupi. Na jedné obrazovce tak
stály dvě různé částky pro tutéž věc. Rada teď uvádí celý rozsah ze stejného
základu (128 063 až 256 125 Kč), jehož spodní hranice je přesně to, co
požaduje karta.

## B21. Termín koupě jde posunout po ose

Dítě šlo na stuze chytit a posunout, koupě ne: nastávala, jakmile byla
naspořená akontace, a v komentáři u komponenty stálo, že se s ní hýbe cenou
nebo akontací, ne přímo. Jenže „koupit hned, nebo počkat rok?" je vlastní
otázka, kterou nejde položit ani cenou, ani akontací.

Koupě proto dostala stejný úchop jako dítě, s dvěma mezemi:

- **doleva jen k měsíci, kdy je na akontaci naspořeno.** Dřív koupit nejde,
  není z čeho. Ten měsíc vrací `wealthTimeline` jako `earliestPurchaseMonth`
  a počítá se nezávisle na odkladu, jinak by mez utíkala doprava spolu
  s úchopem a zpátky by se už nedalo.
- **doprava deset let**, ne až k důchodu. Za obzorem plánu už odklad není
  rozhodnutí, ale jiný plán.

**Odklad nemění akontaci ani splátku, jen termín.** Co se mezitím naspoří,
zůstane v hotovosti jako rezerva. Vypadá to jako promarněná příležitost
(vyšší akontace by snížila splátku), ale je to jediná varianta, která
neroztrhne přehled: splátka, DSTI i verdikt počítají z akontace zadané
v Bydlení, a kdyby si osa počítala vlastní, začala by si s nimi odporovat.
Kdo chce vidět nižší splátku, hýbe akontací; tímhle se hýbe termínem.

### Popisek při posunu mizel na vteřinu

Našlo se u toho: události se kreslí v pořadí podle měsíce, takže když koupě
přeskočí dítě, React uzly v DOM přeskládá. **Přesun uzlu spustí CSS animaci
znovu**, a protože má `backwards` fill a vteřinové zpoždění, popisek uprostřed
tažení na celou vteřinu zmizel. Platilo to i pro dítě, jen se to skoro nedalo
vyvolat: muselo by se přetáhnout přes koupi.

Vstupní animace se proto po odeznění vypne inline (stejně, jako to dělá
pravidlo pro vypnutý pohyb a pro tisk), a hned při prvním doteku úchopu. Kdo
už s grafem pracuje, nemá co dodívat.

### Co se nechává být

Na úzkém mobilu se úchopy koupě a dítěte překrývají, když jsou obě události
v prvních letech: na 320 px je celý horizont k důchodu široký jako palec.
Chytí se ten, který se kreslí později. Odpověď na to je výřez („10 let"),
ne menší dotykové cíle; zmenšit je na polovinu odstupu by u dvou událostí
dva roky od sebe znamenalo cíl pod deset pixelů, tedy nechytitelný obojí.
Klávesnicí jsou dosažitelné vždy, každý úchop je vlastní `slider`.

## B22. Revize funkcí, výpočtů a vzhledu

Systematický průchod: nejdřív engine modul po modulu proti nezávislému
přepočtu, pak appka na obrazovce (světlý i tmavý režim, 1280 a 390 px,
průvodce i všech šest záložek). Nález následuje čtrnáct.

### Co bylo špatně ve výpočtech a výrocích

**Důchodová projekce porovnávala nominální jablka s dnešními hruškami.**
Cíl renty („chci 30 000 Kč měsíčně") zadává uživatel v dnešních penězích,
graf i tabulka ale ve výchozím stavu ukazovaly nominální hodnotu, takže
u SP500 stálo „cíle dosáhnete za 19 let" o částce, která za 19 let koupí
zhruba půlku toho, co dnes. Ve skutečnosti je to 26 let. Zbytek appky
(časová osa, věta o rentě v Přehledu) přitom počítá v dnešních cenách,
takže tahle karta byla jediné místo s druhým měřítkem. Výchozí je teď
dnešní kupní síla a přepínač volí měřítko, ne „ukázat navíc": graf kreslil
obě sady čar naráz, deset čar a legendu na tři řádky.

**Dvě definice „do důchodu".** Horizont časové osy se řídil mladším
z dvojice, projekce renty `person1Age`. U páru 34 a 31 let stálo na jedné
obrazovce „plán na 34 let" a „do důchodu 31 let". Nově je to jedno místo
(`retirementAge`) a rozhoduje **starší**: model počítá se mzdou po celý
horizont a rentu neumí, takže dál než k prvnímu odchodu do důchodu
nedohlédne. U páru 55 a 30 sliboval mladší věk pětatřicet let dvou platů,
z toho pětadvacet po tom, co jeden z nich přestane chodit do práce.

**Rodičovská byla vypnutá, dokud ji uživatel nenašel.** Kdo si zvolil cíl
„dítě", dostal plán, ve kterém se dítě narodí, ale příjem domácnosti se
nezmění; zapínala se tlačítkem „Spočítat dopad rodičovské" na podzáložce
Dítě a důchod. Je to nejdražší položka celého plánu (u modelového páru
1 029 971 Kč za tři roky) a verdikt bez ní vycházel růžově. Zapíná se teď
s volbou cíle a dá se skrýt.

**Důchodový kapitál počítal s menší rezervou, než appka jinde požaduje.**
`retirementStartingCapital` odečítala tři měsíce dnešních nezbytných výdajů
i tomu, kdo kupuje; po koupi je ale měsíc skoro dvakrát dražší. Táž chyba
jako v B20, jen o jedno místo dál.

**Zaokrouhlení.** Do pole „Už mám naspořeno" se dostávaly haléře
(„526 787,195 Kč"), protože se od úspor odečítala trojnásobná splátka.

### Co bylo špatně na obrazovce

**V tmavém režimu nebyla vidět čísla v polích průvodce.** `NumberInput` měl
`bg-card`, ale žádnou barvu textu, takže input zdědil černou z prohlížeče:
kontrast 1,29:1, tedy prakticky prázdné pole. Týkalo se to **všech čísel,
která uživatel v průvodci zadá**. Totéž v tabulce nákladů na dítě (1,4:1)
a u výnosů v tabulce důchodu, kde navíc chyběl fokusový prstenec, protože
obě tabulky obcházely `fieldClass`.

Test kontrastu to nemohl chytit: procházel textové uzly a hodnota pole není
textový uzel. Nově se dívá i na `input`, s výjimkou posuvníků
a zaškrtávátek, kde `value` („on", „4.8") nikdo nevidí. A do procházky
přibyl cíl „dítě", jinak se karta s tabulkou vůbec nevykreslila.

**Přepínač inflace nešel ovládat klávesnicí.** Byl to `div` s `onClick`:
myší fungoval, tabulátor ho přeskočil. Je to jediný ovladač, který v té
kartě rozhoduje, co čísla znamenají. Teď je to `button` s `role="switch"`.
Puntík na něm navíc vyjížděl osmnáct pixelů za pilulku a překryl první
písmeno popisku, takže tam stálo „očítat v dnešních cenách": absolutně
umístěný prvek bez `left` se řídí statickou pozicí, a ta uvnitř `span`
vychází jinam než uvnitř `div`.

**Desetinná tečka místo čárky.** „26.6 %" (míra úspor), „4.9×" (DTI),
„30.9 %" (DSTI), „~15.8 měs." (rezerva po akontaci), „2.4 mil. Kč"
(náklady na dítě) a osy grafů „16.0 M". Všechno `toFixed()`, který českou
čárku neumí. Nově přes `decimal()` ve `format.ts`. Táž rezerva přitom
o kus vedle stála správně jako „15,8 měs.", takže si dvě dlaždice
odporovaly i v tom, jak se píše číslo.

**Skloňování.** „Daňové zvýhodnění na 5 děti" (nově `childWord()`)
a „cíle dosáhnete za 0 roky" v tabulce důchodu, kde se plurál skládal
ručně místo `formatYears()`.

**Trojí „Co kdyby" na jedné obrazovce.** Nadpis záložky, nadpis vlevo
a nadpis panelu vpravo, a k tomu dvakrát skoro doslova tatáž věta
o přerušovaném obrysu. Panel se teď jmenuje „Cíle a parametry" podle toho,
co v něm je, a věta zůstala jednou. Karta na Rozpočtu se navíc jmenovala
„Co kdyby: kam jde váš příjem", tedy stejně jako záložka vedle, se kterou
nesouvisí. Text vlevo přitom sliboval „posuvníky mění cenu, sazbu a délku
rodičovské", i když panel ukazuje jen ovladače k cílům, které uživatel má.

### Co se nechává být

- **Odhad rezervy v Bydlení a „A co teď" berou 3 měsíce, rada ve scénáři
  3 až 6.** Rozsah je záměr (doporučení), spodní hranice je práh appky.
- **Dvě odstíny zelené** v grafu rozpočtu (doprava vs. cíle). Kategorie
  rozlišují popisky a chipsy nad grafem, ne jen barva.
- **Asi čtyřicet míst skládá částku jako `toLocaleString() + ' Kč'`** místo
  `czk()`. Výsledek je až na zaokrouhlení stejný; sjednotit to má smysl,
  ale ne v jednom commitu s opravami chování.
- **Rodina s dětmi a plánovaným dalším dítětem** dostane daňové zvýhodnění
  jen za ty stávající. Karta říká „na tohle nezapomeňte" a stávající slevu
  má uživatel už v čisté mzdě, takže by se přičtením zdvojila.

## B23. Slib na uvítanou, míň textu na mobilu, posun událostí v Co kdyby

Tři věci ze zpětné vazby.

### Co se nestane, hned na uvítací obrazovce

Odznáček „Zdarma · Bez registrace" neodpovídal na to, čeho se u finanční
kalkulačky lidé doopravdy bojí: jestli za tím nestojí banka a jestli jim za
týden nezačne někdo volat s nabídkou hypotéky. Přibyl proto výčet pěti
odškrtnutých vět: zdarma a bez registrace, nejsme banka ani zprostředkovatel,
nechceme jméno ani kontakt, nikdo vás nebude obvolávat, čísla zůstávají
v prohlížeči.

**Na jednom místě, ne na třech.** Napoprvé to stálo pod tlačítkem a vedle
toho o tomtéž mluvil odznáček nad nadpisem („Zdarma · Bez registrace"),
dlaždice „Data zůstávají u vás" a ještě patička. Čtyři obměny téhož na jedné
obrazovce působí jako přemlouvání, ne jako slib. Výčet je teď v kartě pod
dlaždicemi, odznáček říká jen „Hotovo za 3 minuty" a dlaždice mluví o tisku
a sdílení.

Každá je ověřitelná: appka nemá backend, produkční CSP má
`connect-src 'none'`, nikde se neptá na kontakt a nemá analytiku. **Kdyby se
cokoli z toho změnilo, musí se ten výčet změnit taky.** Třetí dlaždice se
proto přejmenovala z „Data zůstávají u vás" (to teď říká výčet) na
„Odnesete si to", tedy tisk a sdílený odkaz.

### Klapky místo odstavců

Na telefonu měla záložka Bydlení 5 703 px, tedy skoro sedm obrazovek, a
čísla se v ní ztrácela mezi vysvětlivkami. Přibyla komponenta `Disclosure`
a s ní pravidlo: **na stránce zůstává číslo a závěr, pod klapku jde
odůvodnění.** Schované jsou: rozpis jednorázových nákladů (součet zůstal),
„Pozor na odhad banky", limity ČNB u DTI/DSTI, popis čar v grafu koupě vs.
nájem i jeho výhrady, výpočet daňových úlev, tabulka nákladů na dítě podle
věku a druhá půlka nápovědy „čísla nejsou jen k prohlížení".

Měřeno na 390 px: Bydlení 5 703 → 5 127 px, Dítě a důchod 5 097 → 4 721,
Přehled 3 858 → 3 742, Rozpočet 2 836 → 2 720. Zbytek délky jsou grafy
a čísla, a ta se schovávat nemají.

Klapka **není `<details>`**: obsah v něm prohlížeč schová tak, že ho nejde
vytáhnout do tisku, a report se neproklikává. Schovává se inline stylem,
protože Tailwind má v preflightu `[hidden] { display: none !important }`
uvnitř vrstvy a u `!important` deklarací vyhrávají vrstvené styly nad
nevrstvenými, takže tiskové pravidlo by ho nepřebilo. Hlídá to test.

### Posun událostí i v Co kdyby

Puntíky koupě a dítěte jdou chytit i na stuze v Co kdyby, kde jsou to
posuvníky jako cena nebo sazba: počítají se do „změněno" a mizí s „Vrátit
původní scénář". Původní scénář si přitom drží termíny zadané, takže je
rozdíl vidět jako přerušovaný obrys pod stuhou. Nadpis je pojmenuje
(„Zkoušíte koupi za 3 roky a dítě za 3 roky."), protože „Zkoušíte: bydlení
za 5 500 000 Kč" u někoho, kdo hnul jen termínem, mluví o čísle, se kterým
nehnul.

## B24. Výřez na deset let, tmavý režim, plynulé barvy, termín dítěte

Pět věcí ze zpětné vazby, tři z nich mění výchozí stav appky.

### Výchozí výřez je deset let, ne celý plán

Na horizontu k důchodu se první roky srazí do pár procent šířky: koupě
a dítě splynou v jeden shluk u levého okraje a zbytek je dlouhá rovná čára.
Přitom právě těch pár let je jediná část plánu, se kterou se dá něco udělat,
a jsou v nich všechny události, kterými jde na stuze hýbat. Co zůstane za
výřezem, řekne věta pod ním (`beyondView`), takže se nic neztratí.

### Výchozí je tmavý režim

Systémová předvolba se tím na první návštěvě obchází. Vědomě: appka je
z velké části graf a na tmavém podkladu je barevná škála stuhy čitelnější.
Uložená volba má dál přednost, takže kdo přepne na světlý, ten ho má.
Testy, které si na motivu zakládají (kontrast, tooltip, otisky), si ho teď
musí nastavit uloženou předvolbou; samotné `emulateMedia` už nestačí.

### Barva stuhy se mění plynule

Tři stavy stačí na větu, ale ne na obrázek: stuha měnila barvu skokem, dva
roky stejná zelená a pak hrana. Přibyla proto spojitá míra `severity`
(0 pohodlně, 1 hluboký schodek), ukotvená ve **stejných prazích** jako
`tension`, aby si barva a věta nemohly odporovat:

- `< 0,5` klid (a čím větší polštář, tím sytější zelená),
- `0,5 až 0,75` napětí, tedy tatáž tři pravidla co dřív,
- `> 0,75` schodek, tím tmavší, čím hlubší.

Barvy míchá `color-mix` v oklab přímo v CSS, ne JavaScript: tokeny mají
jinou hodnotu ve světlém a tmavém režimu, takže jakýkoli výpočet v JS by si
je musel číst z `getComputedStyle` a přepočítávat při přepnutí motivu.
Gradient má nejvýš 64 zastávek (na čtyřech stech měsících je víc stejně
k nerozeznání), ale zlomy stavu se do vzorku přidávají vždy.

### „Z čeho přehled počítá" vypadalo jako nadpis

Bylo to `<details>` s `list-none`, tedy bez trojúhelníčku, bez šipky a bez
jakékoli změny při najetí myší. Teď je to celé tlačítko se šipkou, která se
otočí, a se slovem, co se stane („Zobrazit rozpis" / „Skrýt rozpis").

### Termín dítěte je zadaný údaj, ne úvaha nad grafem

Věta u cíle („Během rodičovské vám bude chybět 51 048 Kč měsíčně…") se
posunem puntíku vůbec neměnila. Nešlo o formulaci: `evaluateParentalLeave`
o termínu nevěděla, protože ho držela obrazovka. Počítala vždycky, jako by
volno začínalo dnes a domácnost už bydlela ve svém.

Termín se proto přesunul do stavu (`childInMonths`) a rodičovská z něj
odvozuje dvě věci:

- **jestli se do té doby stihne koupit.** Kdo čeká dítě dřív, než dospoří
  akontaci, platí během volna nájem, ne splátku.
- **kolik bude v tu chvíli rezervy.** Skládá se stejně jako na časové ose:
  měsíc po měsíci přiteče disponibilní částka, při koupi odejde akontace
  a od té chvíle platí rozpočet po koupi.

Na modelovém páru: dítě za rok znamená „během rodičovské vám měsíčně zbyde
10 532 Kč" (ještě v nájmu), dítě za šest let „nejméně 6 966 Kč" (už se
splátkou). Tři starší testy počítaly s volnem začínajícím dnes; mají teď
`childInMonths: 0`, aby říkaly to, co říkat chtěly.

## B25. Aby na výsledcích všechno ovlivňovalo všechno

Zadání znělo: ať po každé změně neříká appka jinde nesmysly. Nejdřív mapa,
co všechno jde na výsledcích přepsat a kam to teče, pak čtyři kusy práce.

Společná příčina všech nálezů: **hodnota spočítaná jednou při otevření
výsledků** (`useState(odhad)`), nebo **tatáž věc držená na dvou místech**.
Záložky výsledků zůstávají připojené, takže se počáteční hodnota už nikdy
nepřepočítá, i když se pod ní změní celý plán.

### 1. Rozdělení peněz na cíle

`allocations` byl `useState(calculateDefaultAllocations(state))`. Kdo si
v Rozpočtu snížil výdaje, viděl vyšší disponibilní částku, ale na akontaci
se dál odkládalo staré číslo: „naspoříte za 4 roky" zůstalo stát a osa
kupovala pořád ve stejný měsíc.

Nově se odvozuje z plánu, dokud uživatel nesáhne na konkrétní cíl; od té
chvíle platí jeho číslo. Týž vzorec jako u sazby a nákladů na vlastnictví
(`engine/estimate.ts`), jen pro cíle.

### 2. Náklady na dítě

Počet dětí, částky podle věku i vysoká škola byly lokální v kartě. Ukazovala
tedy náklady na dvě děti, zatímco osa, rodičovská i rozpočet počítaly jedno
dítě z tabulky ČSÚ. Přesunuto do `state.childCosts`, čte to
`monthlyChildCost()`, přes kterou jde nově celý engine.

Horizont v kartě zůstal lokální schválně: je to výřez pro graf vedle něj,
ne údaj o plánu.

### 3. Výnos investic

Tabulka v důchodu má u každého nástroje přepsatelný výnos, ale věta o rentě
měla natvrdo 7 % a graf koupě vs. nájem si držel vlastní pole „Výnos
investic". Tři místa, jeden předpoklad. Nově `state.retirementRates`
a věta říká, z čeho vychází („při výnosu 7 % ročně…").

### 4. Vlastní cíle a konstanty

Karta vlastních cílů dostávala seznam z `activeState` (kde odložený cíl
chybí) a částky z plného pole, takže se po odložení prostředního cíle
rozešly indexy a každý další ukazoval částku souseda. Částky se teď
adresují `id`.

Sjednotily se i dvě konstanty, které existovaly dvakrát: hranice tří měsíců
rezervy (`readiness` a `nextStep`) a míra bezpečného výběru 4 %
(`fourPercentTarget` a odhad renty).

### Pojistka

`e2e/reaktivita.e2e.ts` sáhne na vstup a porovná odečty před a po. Nekontroluje
konkrétní částky, ty se mění s výchozími daty, ale to, **že se pohnuly**:
výdaje → rozpočet, měsíc koupě, dlaždice, věty u cílů; sazba → splátka,
rezerva, DSTI; počet dětí → rodičovská i osa; výnos → renta i graf koupě
vs. nájem. A naopak: ručně zadaná částka u cíle po změně výdajů **zůstane**.

### Co zůstává lokální schválně

Výřez časové osy a termín koupě (způsob dívání, ne údaj o plánu), horizont
v kartě dítěte, růst cen nemovitostí a nájmu v grafu koupě vs. nájem
(předpoklady jen toho jednoho srovnání) a požadovaná renta v důchodu.
Ta poslední je hraniční: kdyby se z ní počítalo „kolik vám do ní chybí",
patřila by do plánu.

## Nouzová rezerva jako sledovaný cíl

Rezerva byla ve slovníčku popsaná jako „první věc, kterou má smysl mít
hotovou, dřív než cokoli jiného" a karta „A co teď" ji uměla doporučit
(„postavte 128 063 Kč"). Nešla ale zapnout jako cíl, takže se neobjevila
nikde vedle důchodu a dítěte: ani v rozpočtu, ani na časové ose, ani mezi
přepínači v Co kdyby. Doporučení bez místa v plánu se čte jako poznámka
pod čarou.

**Nový modul `engine/reserve.ts`** je jediné místo, kde se rezerva počítá.
Ten vzorec dosud bydlel uvnitř `nextStep` a nešel použít jinde, aniž by se
opsal; `nextStep` z něj teď čte taky. Drží se dvě věci, na kterých u rezervy
záleží:

- kdo kupuje, poměřuje se **výdaji po koupi** (splátka bývá skoro dvojnásobek
  nájmu, takže tatáž rezerva vydrží kratší dobu),
- „co mám stranou" je u kupujícího to, co po zaplacení akontace **zbyde**,
  ne celé úspory.

**Cíl je opt-in.** Ve výchozím stavu zapnutý není, takže se nikomu nezmění
plán, který si už uložil. Kdo si ho zapne, dostane v Cílech kartu s cílovou
částkou (výchozí tři měsíce, jde zvednout až na dvanáct), stavem, termínem
a měsíční částkou.

**V rozdělení peněz má přednost před akontací**, ale jen do 40 % volných
peněz. Kupovat s prázdnou rezervou znamená řešit první rozbitou pračku
drahou půjčkou, což je horší než koupit o pár měsíců později; cíl, který
zastaví všechno ostatní, si ale uživatel vypne a nebude ho mít vůbec.
Výchozí tempo je „plná do dvou let".

**Na časové ose vede vlastní fond**, stejně jako akontace. Rezerva je
hotovost, takže z `cash` nikam neodchází a bez fondu by nebyla vidět;
napíná ale tok na cíle (`flowAfterGoals`), a tím i barvu stuhy. Oba fondy
si berou z toho, co ten měsíc doopravdy přiteklo, a berou si **postupně**:
kdyby si každý sáhl na `min(alloc, flow)` zvlášť, rozdělily by v hubeném
měsíci tytéž peníze dvakrát a osa by kupovala dřív, než na co domácnost má.
Naplněním se cíl uvolní; je to cíl s koncem, ne trvalý výdaj.

### Co se schválně nezměnilo

**Dlaždice „Rezerva vydrží" v Přehledu dál kreslí šest měsíců**, i když si
uživatel nastaví tři nebo dvanáct. Odpovídá totiž na jinou otázku než cíl:
jak dlouho by úspory vydržely proti obecnému doporučení 3–6 měsíců, kdežto
cíl měří „jsem na svém čísle". Kdyby dlaždice následovala volbu, nešlo by
z ní poznat, jestli je uživatelovo číslo vysoké nebo nízké.

**`MIN_RESERVE_MONTHS_AFTER_PURCHASE` zůstává na třech měsících** i pro toho,
kdo si cíl zvedne na půl roku. Je to hranice bezpečí, ne uživatelova ambice:
kdo míří výš, nemá tím zčervenat u cíle bydlení.

**Pořadí v „A co teď" se nemění.** Akontace zůstává před rezervou, protože
je to aktivní spořicí cíl s termínem; rezerva se k ní připočte ve vysvětlení.
Zapnutý cíl mění jen to, odkud se bere měsíční částka (uživatelova místo
odhadu) a kam vede tlačítko (do Cílů místo do Rozpočtu).

## Kontrola reálnosti vstupů

Appka nikde neřekla „tohle je hodně nízko". Kdo zadal jídlo za 3 000 Kč pro
dva nebo nechal zbytné výdaje na nule, dostal zelený verdikt postavený na
rozpočtu, který v životě nevydrží. Je to nejčastější způsob, jak si plán
rozbít, a přitom se pozná ze zadaných čísel.

`engine/plausibility.ts` je čistá funkce nad stavem: vrátí seznam poznámek
(klíč, nadpis, vysvětlení, tón, dotčené pole). Ukazuje se na třech místech:
v průvodci pod poli s výdaji (tam je oprava nejlevnější), ve výsledcích pod
editorem výdajů a v Přehledu jedním řádkem nad odpovědí, s odkazem do
Rozpočtu.

### Nic to nenutí

To je celé zadání, ne kompromis. Neblokuje to „Další", nepřepisuje zadané
hodnoty a **nesahá na verdikt**. Hraničních případů je spousta a appka
o nich neví: obědy v ceně práce, auto od zaměstnavatele, bydlení u rodičů,
energie v ceně nájmu, život na vesnici bez auta. Kdo řekne „u nás to tak
je", má mít pokoj natrvalo, proto se odklepnutí ukládá do
`state.dismissedChecks`. Upozornění, které se po překreslení vrátí, se lidé
naučí odklikávat bez čtení a kontrola tím ztratí smysl.

Ze stejného důvodu je to vizuálně poznámka, ne poplach: neutrální podklad,
ne červená.

### Prahy

Schválně **nízko**, ne na průměru. Cílem není hodnotit životní styl, ale
chytit chybějící položku a překlep v řádu. Platí, že falešné upozornění je
dražší než zameškané: uživatel, kterému appka bezdůvodně nedůvěřuje,
přestane důvěřovat jí.

Jídlo se poměřuje **na dospělého**, ne na hlavu: děti mají vlastní položku
„Výdaje na děti", takže by se jinak počítaly dvakrát a každá rodina by
dostala upozornění hned nad předvyplněnými hodnotami. Test hlídá, že
vlastní výchozí data appky neprotestují v žádném režimu.

Souhrnná kontrola („výdaje nedosáhnou ani dvou pětin příjmu") je až
poslední a jen tehdy, když se nenašlo nic konkrétního. Vedle tří jmenovitých
poznámek by čtvrtá, obecnější, byla jen šum.

### Co se schválně nekontroluje

**Příjem.** Nízký příjem není chyba zadání a upozornění na něj by bylo
hodnocení člověka, ne dat.

**Cena nemovitosti.** Rozptyl mezi Prahou a okresním městem je tak velký,
že by práh musel znát lokalitu; appka se na ni neptá a ptát nebude.

**Úspory.** Nula je platná odpověď a přesně ta, se kterou se sem chodí.

## Počet dětí platil jen pro náklady

Kdo si v kartě „Náklady na dítě" nastavil dvě děti, dostal dvojnásobné výdaje,
ale zbytek appky dál počítal jedno. Číslo se propsalo, nic dalšího ne.

Jeden zdroj pravdy je teď `plannedChildren(state)` v `engine/childCost.ts`
a berou si ho:

- **Dávky během volna.** Model počítá, že plánované děti přijdou naráz
  (karta to říká nahlas), takže dávky musely jít za týmž předpokladem:
  u dvou a více dětí narozených současně je mateřská 37 týdnů místo 28
  a rodičovský příspěvek 525 000 Kč místo 350 000. Do té doby platil plán
  se dvěma dětmi dvojnásobné náklady a příspěvek dostával na jedno, což
  je rozdíl 175 000 Kč, o které se appka mýlila proti sobě samé.
- **Daňové zvýhodnění.** Bylo natvrdo na jedno dítě (`plannedChild ? 1 : …`).
  Zvýhodnění se přitom stupňuje podle pořadí, takže druhé dítě není totéž
  co první. U rodiny se plánované děti přičtou k těm, které už doma jsou,
  a poznámka pod kartou rozlišuje, která část je novinka.
- **Popisky.** Záložka, přepínač v Co kdyby, sdílený seznam cílů, věta u cíle,
  puntík na časové ose i popisek jeho úchopu pro čtečku. Jednotné číslo
  u plánu se dvěma dětmi vypadalo jako chyba zadání.

### Pole „Kolik měsíčně odkládám na dítě" zmizelo

Bylo to druhé místo, kde se nastavovalo totéž. Kolik dítě stojí, se zadává
v tabulce podle věku; kolik během volna přiteče, plyne z jeho délky. Ruční
částka nad tím byla třetí, nezávislé číslo, které se s oběma mohlo rozejít.
Do rozpočtu jde vážený průměr z tabulky a karta ho ukazuje jako výsledek,
ne jako pole.

Věta u cíle se proto přeformulovala. Stálo v ní „Odkládáte X na náklady
spojené s dítětem", jenže tu částku uživatel nezadával, takže se tvářila
jako jeho rozhodnutí. Teď říká, co ta částka je, a hodnotí to, co se
hodnotit dá: jestli se vedle ostatních cílů do rozpočtu vejde.

## Sdílení: výzva mimo obrazovku

Tlačítko „Sdílet přehled" je v přilepené hlavičce, ale výzva „odkaz ponese
vaše údaje" se kreslí nad obsahem sloupce. Kdo klikl ze spodku dlouhé
stránky, viděl jen to, že se tlačítko přepnulo. U jediné akce, která pustí
data z prohlížeče ven, je to to poslední, co si má uživatel domýšlet, takže
otevření výzvy teď stránku odroluje nahoru.
