// Zdroje: ČSÚ, ČNB, ČBA. Datum poslední revize níže.
// Při aktualizaci projděte i komentáře u jednotlivých hodnot a datum posuňte;
// appka datum zobrazuje uživateli (tooltip u úrokové sazby), takže zastaralá
// data se sama prozradí.
export const DEFAULTS_DATE = '2026-07';

// Stav regulace ČNB (borrower-based measures), ověřeno 7/2026:
//  - Závazný je jen limit LTV: max 80 %, u žadatelů do 36 let 90 %
//    → povinná akontace 20 %, resp. 10 %. Pro vlastní bydlení se nemění.
//  - Horní limit DSTI ČNB deaktivovala (od 7/2023), DTI (od 1/2024), banky
//    je ale i tak běžně posuzují jako interní obezřetnostní vodítko.
//  - Od 4/2026 doporučuje ČNB přísnější limity (LTV 70 %, DTI 7) pro
//    INVESTIČNÍ hypotéky (3. a další nemovitost nebo nemovitost na pronájem).
//    Tahle appka počítá bydlení pro sebe, takže se jí to netýká.
// Hodnoty DTI/DSTI níže proto berte jako orientační bankovní vodítko, ne
// jako závazný limit ČNB.

export const DEFAULTS = {
  income: {
    // ČSÚ, 1. čtvrtletí 2026: průměrná hrubá mzda 50 282 Kč → čistá ~39 800 Kč
    // (po slevě na poplatníka, SP 6,5 % a ZP 4,5 %). Zaokrouhleno dolů.
    person1NetMonthly: 39500,
  },
  expenses: {
    rent: 12000,
    food: 6000,
    transport: 3000,
    insurance: 1500,
    existingLoans: 0,
    children: 8000,
    utilities: 3500,
    other: 3000,
  },
  property: {
    // Byt ~70 m² při celorepublikovém průměru (2025: 72 410 Kč/m², v roce 2026
    // dál rostl). V Praze je reálná cena výrazně vyšší, uživatel si ji upraví.
    targetPrice: 5500000,
    // ČBA, průměrná realizovaná sazba nových hypoték 7/2026: 4,79 %.
    // Data ČBA vycházejí s ~dvouměsíčním zpožděním. Hodnota platí pro
    // pětiletou fixaci, ze které se odvozují ostatní (viz fixationRatePremium).
    mortgageRate: 0.048,
    fixationYears: 5,
    loanTermYears: 30,
  },
  // Náklady na vlastnictví se odhadují jako podíl z ceny nemovitosti za rok.
  // Paušální částka nedávala smysl: u bytu za 3 miliony a domu za 12 milionů
  // to nejsou stejné peníze.
  //
  // 1 % ročně je běžné stavařské pravidlo pro údržbu a opravy. V něm je
  // zahrnuto: fond oprav (v SVJ obvykle 15–35 Kč/m² měsíčně), vlastní opravy
  // a údržba, pojištění nemovitosti a daň z nemovitých věcí. Je to odhad,
  // ne výpočet z konkrétního domu, proto jde částka přepsat.
  // Kontrola: byt za 5,5 mil. → 4 583 Kč/měs, dům za 12,5 mil. → 10 417 Kč/měs.
  ownershipCostRate: 0.01,
  // Délka fixace sazbu reálně ovlivňuje, banka si účtuje jinou cenu za různě
  // dlouhou garanci. Hodnoty jsou rozdíl oproti pětileté fixaci, ze které
  // vychází výchozí sazba výše (orientační tržní zvyklost v ČR, 7/2026;
  // konkrétní banka se může lišit o desetiny p. b.):
  //  - roční fixace bývá dražší, banka počítá s tím, že klient brzy odejde,
  //  - tříletá je dnes nejčastěji nejlevnější,
  //  - sedmi a desetiletá si nechávají zaplatit jistotu neměnné splátky.
  fixationRatePremium: {
    1: 0.004,
    3: -0.001,
    5: 0,
    7: 0.002,
    10: 0.005,
  } as Record<number, number>,
  ltvRequired: 0.20, // povinná akontace při LTV 80 %
  ltvRequiredUnder36: 0.10, // do 36 let LTV až 90 % → akontace jen 10 %
  retirementAge: 65, // orientační věk odchodu do důchodu (horizont spoření na stáří)
  mortgageMaxAge: 70, // banka obvykle vyžaduje doplacení hypotéky do ~70 let
  dtiLimit: 8.5, // orientační bankovní vodítko (ČNB závazně nevyžaduje)
  dstiLimit: 0.45, // orientační bankovní vodítko (ČNB závazně nevyžaduje)
  // Průměrná roční inflace ČR (dlouhodobý průměr ČNB)
  averageCzInflation: 0.03,
} as const;

// Průměrné měsíční náklady na 1 dítě dle věku (Kč)
// Zdroj: ČSÚ, odhad 2024, od té doby neaktualizováno, reálné náklady dnes
// budou o inflaci vyšší. Uživatel si částky může v kalkulačce přepsat.
export const CHILD_COSTS_CZ = [
  { from: 0, to: 3, monthlyCost: 8000, label: '0–3 roky' },
  { from: 3, to: 6, monthlyCost: 10000, label: '3–6 let' },
  { from: 6, to: 15, monthlyCost: 12000, label: '6–15 let' },
  { from: 15, to: 18, monthlyCost: 14000, label: '15–18 let' },
  { from: 18, to: 26, monthlyCost: 10000, label: '18–26 let (VŠ)' },
] as const;
