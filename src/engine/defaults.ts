// Zdroj: ČSÚ, ČNB — datum platnosti níže
export const DEFAULTS_DATE = '2025-01';

// Stav regulace ČNB (borrower-based measures):
//  - Závazný je jen limit LTV: max 80 %, u žadatelů do 36 let 90 %
//    → povinná akontace 20 %, resp. 10 %.
//  - Horní limit DSTI ČNB deaktivovala (od 7/2023), DTI (od 1/2024) — banky
//    je ale i tak běžně posuzují jako interní obezřetnostní vodítko.
// Hodnoty DTI/DSTI níže proto berte jako orientační bankovní vodítko, ne
// jako závazný limit ČNB.

export const DEFAULTS = {
  income: {
    person1NetMonthly: 36000,
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
    targetPrice: 5500000,
    mortgageRate: 0.052,
    fixationYears: 5,
    loanTermYears: 30,
    ownershipCosts: 5500,
  },
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
// Zdroj: ČSÚ, odhad 2024
export const CHILD_COSTS_CZ = [
  { from: 0, to: 3, monthlyCost: 8000, label: '0–3 roky' },
  { from: 3, to: 6, monthlyCost: 10000, label: '3–6 let' },
  { from: 6, to: 15, monthlyCost: 12000, label: '6–15 let' },
  { from: 15, to: 18, monthlyCost: 14000, label: '15–18 let' },
  { from: 18, to: 26, monthlyCost: 10000, label: '18–26 let (VŠ)' },
] as const;
