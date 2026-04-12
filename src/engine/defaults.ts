// Zdroj: ČSÚ, ČNB — datum platnosti níže
export const DEFAULTS_DATE = '2025-01';

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
  ltvRequired: 0.20,
  dtiLimit: 8.5,
  dstiLimit: 0.45,
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
