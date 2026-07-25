---
name: aktualizace-dat
description: Aktualizuje výchozí ekonomická data v src/engine/defaults.ts (úroková sazba, mzdy, ceny nemovitostí, limity ČNB). Použij při revizi dat, když se zdají zastaralá, nebo když uživatel zmíní, že se změnily sazby či regulace.
---

# Aktualizace výchozích dat

`src/engine/defaults.ts` obsahuje předvyplněné hodnoty, se kterými uživatel začíná.
Aplikace **zobrazuje datum jejich revize** (`DEFAULTS_DATE`) v nápovědě u úrokové sazby,
takže zastaralá data se sama prozradí a poškozují důvěryhodnost. To je u finanční
kalkulačky to jediné, co má.

## Postup

1. **Zjisti aktuální hodnoty z primárních zdrojů**, ne z odhadu:
   - úroková sazba hypoték → ČBA Monitor (průměrná realizovaná sazba nových hypoték;
     data vycházejí s ~dvouměsíčním zpožděním)
   - mzdy → ČSÚ, průměrná hrubá mzda za poslední čtvrtletí; čistou dopočítej
     (sleva na poplatníka, sociální 6,5 %, zdravotní 4,5 %) a v komentáři ukaž výpočet
   - ceny nemovitostí → celorepublikový průměr za m², přepočtený na běžný byt
   - limity ČNB → aktuální doporučení k LTV, DTI a DSTI

2. **Uprav hodnoty a ke každé napiš zdroj a datum do komentáře.** Bez zdroje se
   při příští revizi nedá poznat, odkud se číslo vzalo.

3. **Posuň `DEFAULTS_DATE`** na měsíc revize (`RRRR-MM`).

4. **Ověř regulaci ČNB zvlášť.** Limity LTV/DTI/DSTI se mění nezávisle na sazbách
   a komentář nahoře v souboru je musí popisovat pravdivě. Pozor na rozdíl mezi
   hypotékou na vlastní bydlení a investiční hypotékou, appka počítá tu první.

5. **Nevymýšlej si čísla, která nemáš doložená.** Když pro nějakou hodnotu není
   spolehlivý zdroj, nech ji být a do komentáře napiš, že je zastaralá a odkdy.
   To je poctivější než tichý odhad.

6. **Spusť testy.** Změna výchozích hodnot rozbije e2e testy, které počítají
   s konkrétními částkami (například disponibilní částka u výchozího jednotlivce).
   Očekávané hodnoty **dopočítej znovu**, neotupuj asertace.

7. **Zkontroluj zdroj v UI.** Nápověda u sazby uvádí konkrétní instituci. Když se
   změní zdroj dat, musí se změnit i tam.

## Kde se data projeví

Kromě samotného průvodce ovlivňují výchozí hodnoty i verdikt na výsledcích, protože
z nich vychází disponibilní částka, DSTI i doba na naspoření akontace. Po změně se
proto podívej na výsledkovou stránku, jestli výchozí scénář pořád dává rozumný obrázek.
