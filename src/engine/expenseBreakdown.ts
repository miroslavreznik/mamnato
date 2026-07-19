import type { WizardState } from '../types';
import { DEFAULTS } from './defaults';
import { totalMonthlyIncome } from './cashflow';
import { monthlyMortgagePayment, effectiveDownPayment } from './mortgage';
import type { GoalAllocations } from './allocation';

export interface ExpenseCategory {
  key: string;
  label: string;
  amount: number;
  necessary: boolean;
}

export interface GoalFlow {
  key: string;
  label: string;
  amount: number;
}

export interface IncomeFlow {
  income: number;
  expenses: ExpenseCategory[];
  goals: GoalFlow[];
  free: number; // volná rezerva (může být záporná při schodku)
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

// Vrátí stav s vynulovanými odškrtnutými výdajovými kategoriemi. Slouží k tomu,
// aby odškrtnutí položky v grafu rozpočtu přepočítalo CELOU výsledkovou stránku
// (verdikt, cash flow, rezervu…), ne jen samotný graf.
export function withExcludedExpenses(state: WizardState, excluded: Set<string>): WizardState {
  if (excluded.size === 0) return state;
  const e = { ...state.expenses };
  if (excluded.has('housing')) { e.rent = 0; e.utilities = 0; }
  if (excluded.has('food')) e.food = 0;
  if (excluded.has('transport')) e.transport = 0;
  if (excluded.has('insurance')) e.insurance = 0;
  if (excluded.has('existingLoans')) e.existingLoans = 0;
  if (excluded.has('children')) e.children = 0;
  if (excluded.has('other')) { e.other = 0; e.discretionaryBreakdown = undefined; }
  return { ...state, expenses: e };
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

// Spoření na cíle (měsíční toky). Nezahrnuje hypotéku — ta je výdajem v „Po koupi".
function goalFlows(state: WizardState, allocations: GoalAllocations): GoalFlow[] {
  const flows: GoalFlow[] = [];
  if (state.goals.includes('retirement') && allocations.retirement > 0) {
    flows.push({ key: 'retirement', label: 'Spoření na důchod', amount: allocations.retirement });
  }
  if (state.goals.includes('child') && allocations.child > 0) {
    flows.push({ key: 'child', label: 'Rezerva na dítě', amount: allocations.child });
  }
  if (state.goals.includes('other')) {
    const total = allocations.custom.reduce((s, v) => s + v, 0);
    if (total > 0) flows.push({ key: 'custom', label: 'Vlastní cíle', amount: total });
  }
  return flows;
}

// Kompletní rozpad příjmu: výdaje + spoření na cíle + volná rezerva.
// excludedKeys jsou vypnuté výdajové kategorie (odškrtnuté v grafu).
export function incomeFlow(
  state: WizardState,
  allocations: GoalAllocations,
  afterPurchase: boolean,
  excludedKeys: Set<string> = new Set()
): IncomeFlow {
  const income = totalMonthlyIncome(state);
  const expenses = expenseCategories(state, afterPurchase);
  const goals = goalFlows(state, allocations);

  const spentExpenses = expenses
    .filter((c) => !excludedKeys.has(c.key))
    .reduce((sum, c) => sum + c.amount, 0);
  const spentGoals = goals.reduce((sum, g) => sum + g.amount, 0);
  const free = income - spentExpenses - spentGoals;

  return { income, expenses, goals, free };
}
