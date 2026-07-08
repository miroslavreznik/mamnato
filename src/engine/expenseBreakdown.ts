import type { WizardState } from '../types';
import { DEFAULTS } from './defaults';
import { totalMonthlyIncome } from './cashflow';
import { monthlyMortgagePayment, effectiveDownPayment } from './mortgage';

export interface ExpenseCategory {
  key: string;
  label: string;
  amount: number;
  necessary: boolean;
}

// Rozpad měsíčních výdajů po kategoriích pro dva stavy bydlení:
//  - afterPurchase=false: bydlení = nájem + energie
//  - afterPurchase=true:  bydlení = splátka hypotéky + náklady na vlastnictví
// Klasifikace nezbytné/zbytné je konzistentní s cashflow.ts (jen „other" je zbytné).
export function expenseCategories(
  state: WizardState,
  afterPurchase: boolean
): ExpenseCategory[] {
  const e = state.expenses;

  let housing: number;
  let housingLabel: string;
  if (afterPurchase) {
    const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
    const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
    const loan = Math.max(0, state.property.targetPrice - effectiveDownPayment(state));
    const mortgage = monthlyMortgagePayment(loan, rate, term);
    const ownership = state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts;
    housing = Math.round(mortgage) + ownership;
    housingLabel = 'Hypotéka + vlastnictví';
  } else {
    housing = e.rent + e.utilities;
    housingLabel = 'Bydlení (nájem + energie)';
  }

  const cats: ExpenseCategory[] = [
    { key: 'housing', label: housingLabel, amount: housing, necessary: true },
    { key: 'food', label: 'Jídlo a potraviny', amount: e.food, necessary: true },
    { key: 'transport', label: 'Doprava', amount: e.transport, necessary: true },
    { key: 'insurance', label: 'Pojistky', amount: e.insurance, necessary: true },
    { key: 'existingLoans', label: 'Splátky úvěrů', amount: e.existingLoans, necessary: true },
    { key: 'children', label: 'Výdaje na děti', amount: e.children, necessary: true },
    { key: 'other', label: 'Zbytné (zábava, dovolená…)', amount: e.other, necessary: false },
  ];

  return cats.filter((c) => c.amount > 0);
}

// Přebytek příjmu po odečtení zapnutých kategorií (odškrtnuté klíče se ignorují).
export function breakdownSurplus(
  state: WizardState,
  categories: ExpenseCategory[],
  excludedKeys: Set<string>
): number {
  const income = totalMonthlyIncome(state);
  const spent = categories
    .filter((c) => !excludedKeys.has(c.key))
    .reduce((sum, c) => sum + c.amount, 0);
  return income - spent;
}
