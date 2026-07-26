import type { WizardState } from '../types';
import { DEFAULTS } from './defaults';
import { estimate, type Estimate } from './estimate';
import { totalMonthlyIncome, monthlyDisposable, necessaryMonthlyExpenses, totalMonthlyExpenses } from './cashflow';

export function monthlyMortgagePayment(
  loanAmount: number,
  annualRate: number,
  termYears: number
): number {
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Rozpočet na rekonstrukci, 0 když se nerekonstruuje.
export function renovationCost(state: WizardState): number {
  return state.property.renovation?.cost ?? 0;
}

/**
 * Celková investice do bydlení: kupní cena plus rekonstrukce.
 *
 * Banka půjčuje proti hodnotě nemovitosti PO rekonstrukci, takže i akontace
 * i LTV se počítají z téhle částky, ne jen z kupní ceny. Bez toho by
 * rekonstrukce vypadala jako peníze, které se objeví odnikud.
 */
export function totalProjectCost(state: WizardState): number {
  return state.property.targetPrice + renovationCost(state);
}

export function effectiveDownPayment(state: WizardState): number {
  if (state.savings.downPaymentFromSavings != null) return state.savings.downPaymentFromSavings;
  // Výchozí: povinné minimum dle LTV (zbytek úspor zůstává jako rezerva),
  // omezené tím, co skutečně máte naspořeno.
  return Math.min(
    state.savings.totalSavings,
    requiredDownPayment(totalProjectCost(state), downPaymentFraction(state))
  );
}

export function fixationYears(state: WizardState): number {
  return state.property.fixationYears ?? DEFAULTS.property.fixationYears;
}

// Rozdíl sazby oproti pětileté fixaci. Neznámou délku fixace bereme jako
// pětiletou, ať se nikdy nepřičte náhodná přirážka.
export function fixationPremium(years: number): number {
  return DEFAULTS.fixationRatePremium[years] ?? 0;
}

// Odhad sazby, kterou banka nabídne pro danou délku fixace. Zaokrouhluje se,
// aby se z desetinných přirážek nestala čísla typu 4,7999999 %.
export function suggestedRateForFixation(years: number): number {
  return Math.round((DEFAULTS.property.mortgageRate + fixationPremium(years)) * 1e5) / 1e5;
}

export function suggestedRate(state: WizardState): number {
  return suggestedRateForFixation(fixationYears(state));
}

/**
 * Úroková sazba jako odhad, který jde přepsat.
 *
 * Dokud uživatel nic nezadá, řídí se délkou fixace. Jeho vlastní číslo má
 * přednost, protože nejspíš vychází z konkrétní nabídky banky.
 */
export function mortgageRateEstimate(state: WizardState): Estimate<number> {
  return estimate(state.property.mortgageRate, suggestedRate(state));
}

// Sdílené parametry hypotéky se zálohou na výchozí hodnoty, jediný zdroj pravdy
// pro všechny výpočty (splátka, DSTI, cash flow po koupi, časová osa jmění…).
export function mortgageRate(state: WizardState): number {
  return mortgageRateEstimate(state).value;
}

export function isRateOverridden(state: WizardState): boolean {
  return mortgageRateEstimate(state).overridden;
}

export function loanTermYears(state: WizardState): number {
  return state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
}

// Odhad měsíčních nákladů na vlastnictví z ceny nemovitosti (1 % ročně).
// Zaokrouhluje se na stokoruny, protože přesnost na koruny by u odhadu
// předstírala jistotu, kterou nemá.
export function suggestedOwnershipCosts(price: number): number {
  return Math.round((price * DEFAULTS.ownershipCostRate) / 12 / 100) * 100;
}

// Náklady na vlastnictví: stejný vzorec jako u sazby, jen se odhad odvozuje
// od ceny nemovitosti místo od fixace.
export function ownershipCostsEstimate(state: WizardState): Estimate<number> {
  return estimate(state.property.ownershipCosts, suggestedOwnershipCosts(totalProjectCost(state)));
}

export function ownershipCosts(state: WizardState): number {
  return ownershipCostsEstimate(state).value;
}

export function isOwnershipCostsOverridden(state: WizardState): boolean {
  return ownershipCostsEstimate(state).overridden;
}

// Výše hypotéky = cena nemovitosti minus akontace (nikdy záporná).
export function loanAmount(state: WizardState): number {
  return Math.max(0, totalProjectCost(state) - effectiveDownPayment(state));
}

// Odhadovaná měsíční splátka hypotéky pro zvolenou akontaci a parametry úvěru.
export function mortgagePayment(state: WizardState): number {
  return monthlyMortgagePayment(loanAmount(state), mortgageRate(state), loanTermYears(state));
}

// Měsíční výdaje PO koupi: místo nájmu + energií se platí splátka hypotéky
// a náklady na vlastnictví.
export function expensesAfterPurchase(state: WizardState): number {
  return totalMonthlyExpenses(state)
    - state.expenses.rent - state.expenses.utilities
    + mortgagePayment(state) + ownershipCosts(state);
}

// Věk žadatelů (kladné hodnoty), seřazeno není potřeba.
function applicantAges(state: WizardState): number[] {
  return [state.person1Age, state.person2Age].filter(
    (a): a is number => typeof a === 'number' && a > 0
  );
}

export function youngestApplicantAge(state: WizardState): number | undefined {
  const ages = applicantAges(state);
  return ages.length ? Math.min(...ages) : undefined;
}

export function oldestApplicantAge(state: WizardState): number | undefined {
  const ages = applicantAges(state);
  return ages.length ? Math.max(...ages) : undefined;
}

// Splňuje žadatel podmínku „do 36 let" pro vyšší LTV? Rozhoduje nejmladší
// žadatel; když věk není zadán, použije se starší přepínač (zpětná kompatibilita).
export function isUnder36(state: WizardState): boolean {
  const youngest = youngestApplicantAge(state);
  if (youngest !== undefined) return youngest < 36;
  return !!state.applicantUnder36;
}

// Povinná akontace jako podíl ceny: 20 %, u žadatelů do 36 let jen 10 %
// (ČNB umožňuje LTV až 90 %).
export function downPaymentFraction(state: WizardState): number {
  return isUnder36(state) ? DEFAULTS.ltvRequiredUnder36 : DEFAULTS.ltvRequired;
}

export function requiredDownPayment(
  propertyPrice: number,
  fraction: number = DEFAULTS.ltvRequired
): number {
  return propertyPrice * fraction;
}

export function downPaymentGap(state: WizardState): number {
  const required = requiredDownPayment(totalProjectCost(state), downPaymentFraction(state));
  return Math.max(0, required - effectiveDownPayment(state));
}

export function monthsToSaveDownPayment(state: WizardState): number {
  const gap = downPaymentGap(state);
  if (gap === 0) return 0;
  const disposable = monthlyDisposable(state);
  if (disposable <= 0) return Infinity;
  return Math.ceil(gap / disposable);
}

// Celkové zaplacené úroky za dobu splácení (anuita): splátky − jistina.
export function totalLoanInterest(loanAmount: number, annualRate: number, termYears: number): number {
  if (loanAmount <= 0) return 0;
  return monthlyMortgagePayment(loanAmount, annualRate, termYears) * termYears * 12 - loanAmount;
}

// Kolik měsíců vydrží rezerva PO koupi: po zaplacení akontace zbyde méně úspor
// a místo nájmu se platí (obvykle vyšší) hypotéka + náklady na vlastnictví.
export function postPurchaseRunwayMonths(state: WizardState): number {
  const reserveAfter = Math.max(0, state.savings.totalSavings - effectiveDownPayment(state));
  const necessaryAfter =
    necessaryMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities
    + mortgagePayment(state) + ownershipCosts(state);
  if (necessaryAfter <= 0) return Infinity;
  return reserveAfter / necessaryAfter;
}

export function dti(state: WizardState): number {
  const newLoan = totalProjectCost(state) - effectiveDownPayment(state);
  // Limit ČNB se vztahuje na celkový dluh, tedy vč. zůstatku stávajících úvěrů.
  const totalDebt = newLoan + (state.existingDebtPrincipal ?? 0);
  const annualIncome = totalMonthlyIncome(state) * 12;
  return annualIncome > 0 ? totalDebt / annualIncome : Infinity;
}

export function dsti(state: WizardState): number {
  const totalPayments = mortgagePayment(state) + state.expenses.existingLoans;
  const income = totalMonthlyIncome(state);
  return income > 0 ? totalPayments / income : Infinity;
}
