# Sekce „Podpořte projekt" — podklad k implementaci

Návrh dobrovolného příspěvku pro MámNaTo?. Záměrně **bez reklamy a bez affiliate**:
appka staví na tom, že data neopouštějí prohlížeč, a reklamní skripty třetích stran
by tenhle argument zabily (plus cookie lišta podle GDPR).

> ⚠️ **Právní poznámka.** Dokud jde o dobrovolný dar, žádná regulace se neuplatní.
> Jakmile by se přidal odkaz na konkrétní hypoteční produkt s provizí, hrozí, že se
> to posoudí jako **zprostředkování spotřebitelského úvěru** podle zákona
> č. 257/2016 Sb. (oprávnění ČNB, pokuty od 50 000 Kč). Hranice: tipař smí předat
> kontakt, ale nesmí doporučovat konkrétní produkt — a tahle appka doporučuje.
> Viz `docs/` poznámky nebo konzultace před jakoukoli provizí.

---

## 1. Kde to umístit

**Primárně:** na konci výsledkové stránky, **za** `<Disclaimer />` v `ResultsDashboard.tsx`.

Proč tam: uživatel v tu chvíli právě dostal hodnotu (verdikt, splátku, timeline).
To je jediný moment, kdy má smysl o příspěvek říct. Nikdy ne před výsledky ani
v průvodci — to působí jako paywall.

**Sekundárně (volitelně):** decentní řádek v patičce, jen textový odkaz.

**Nikdy:** modal, pop-up, sticky lišta, cokoli co překryje obsah.

---

## 2. Texty (čeština, hotové k použití)

### Varianta A — hlavní, doporučená

> ### Pomohlo vám to?
>
> MámNaTo? je koníčkový projekt, který dělám po večerech. Je zdarma, bez reklam
> a bez sledování — vaše čísla nikdy neopustí váš prohlížeč a nikam se neposílají.
>
> Zatím je za tím **{POCET_HODIN}+ hodin práce**, {POCET_TESTU} automatických testů
> a spousta hrabání se v pravidlech ČNB, aby čísla odpovídala české realitě.
> Provoz i doména něco stojí.
>
> Jestli vám přehled pomohl se rozhodnout — nebo vás jen ušetřil hodiny v Excelu —
> můžete mi hodit na kávu. Dobrovolně a jednorázově, nic se tím neodemyká.
>
> [☕ Kup mi kávu]  [Zobrazit QR platbu]
>
> *Díky i za sdílení — pomůže víc než peníze.*

### Varianta B — kratší, do patičky

> MámNaTo? je zdarma a bez reklam. Jestli vám to pomohlo, [můžete mě podpořit](#) ☕

### Varianta C — nejsilnější claim (pro odvážnější)

> ### Ušetřilo vám to čas?
>
> Tenhle přehled by vám u hypotečního poradce zabral schůzku a pár dní čekání.
> Tady ho máte za pět minut, zdarma, a vaše čísla zůstala u vás v prohlížeči.
>
> Stálo mě to {POCET_HODIN}+ hodin večerů. Když to stálo za to, hoďte mi na kávu.

**Doporučení:** začni **variantou A**. Je upřímná, konkrétní a netlačí. Varianta C
je marketingově silnější, ale u finančního nástroje může působit prodejně, což jde
proti důvěryhodnosti, na které appka stojí.

### Ověřená čísla k doplnění (stav 7/2026)

Tvrzení v textu ať jsou pravdivá — tohle jsou reálné údaje z repa:

| Údaj | Hodnota | Kde ověřit |
|---|---|---|
| Vývoj běží od | 04/2026 | `git log --reverse` |
| Commitů | 36 | `git rev-list --count HEAD` |
| Řádků kódu (bez testů) | ~6 800 | `find src -name '*.ts*' \| xargs wc -l` |
| Řádků testů | ~1 600 | `find tests e2e -name '*.ts' \| xargs wc -l` |
| Automatických testů | 139 unit + 12 e2e | `npx vitest run`, `npx playwright test` |
| Výpočetních modulů | 13 | `ls src/engine/*.ts` |

**Nevymýšlej si počet hodin.** Buď ho odhadni poctivě, nebo použij formulaci, kterou
umíš doložit: *„přes 30 večerů"*, *„139 automatických testů, aby čísla seděla"*.
U appky o penězích je důvěryhodnost to jediné, co máš.

---

## 3. Platební kanály

### QR platba (priorita č. 1 pro české publikum)

Čech pošle 100 Kč přes QR kód v bankovní appce během deseti vteřin. Zahraniční
platforma s kartou a registrací je proti tomu obrovská překážka.

Formát je **SPAYD** (Short Payment Descriptor, česká norma pro QR platbu):

```
SPD*1.0*ACC:CZ0000000000000000000000*AM:100.00*CC:CZK*MSG:MAMNATO KAVA
```

- `ACC` — IBAN účtu
- `AM` — částka (volitelná; bez ní si uživatel zvolí sám)
- `CC` — měna
- `MSG` — zpráva pro příjemce

QR se dá vygenerovat čistě v prohlížeči (např. drobná knihovna typu `qrcode`),
takže **nepřibývá žádný backend ani žádné volání třetí strany**. To je důležité —
zachová se tvrzení, že appka nikam nic neposílá.

Nabídni tři přednastavené částky (**50 / 100 / 250 Kč**) a možnost zadat vlastní.
Kotvení částek výrazně zvyšuje průměrný příspěvek oproti prázdnému poli.

### Ko-fi / Buy Me a Coffee (pro zahraniční a kartové platby)

- Jednorázová platba bez registrace dárce
- Ko-fi si u jednorázových darů nebere provizi (jen poplatek platební brány)
- Vhodné jako doplněk, ne jako jediná varianta

### Co nepoužívat

- **Patreon** — je na opakované předplatné, tady nedává smysl
- **Přímé číslo účtu jako text** — nikdo to nepřepisuje ručně

---

## 4. Technická poznámka k implementaci

- Sekci schovat při tisku (třída `no-print` — appka ji už používá).
- Odkazy ven: `target="_blank" rel="noopener noreferrer"`.
- QR generovat až po kliknutí (lazy) — ať se kvůli tomu nenafukuje první načtení.
- Dodržet dotykové cíle min. 44 px, appka je na to už sjednocená.
- Světlý i tmavý režim.
- Doplnit e2e test: sekce je vidět na výsledcích a QR se po kliknutí zobrazí.

---

## 5. Realistické očekávání

Konverze na dobrovolné příspěvky se u nástrojů tohohle typu běžně pohybuje
**hluboko pod 1 %** návštěvníků. Při stovkách návštěv měsíčně to znamená spíš
občasný příspěvek než pravidelný příjem.

Ber to tak, že cílem je **zaplatit doménu (~250 Kč/rok)** a občas kávu. Když to
vyjde na víc, je to bonus. Když ne, appka tě stejně stojí jen tu doménu — hosting
na GitHub Pages je zdarma.

---

## 6. Daňová poznámka

Dobrovolné dary nejsou „neviditelný" příjem. Při zanedbatelných částkách to řeší
osvobození pro bezúplatné příjmy, u vyšších částek nebo pravidelného toku už
je potřeba to řešit v přiznání. Až se to rozjede, ověř si aktuální limity —
tenhle dokument není daňové poradenství.
