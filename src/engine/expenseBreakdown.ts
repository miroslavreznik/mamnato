import type { WizardState } from '../types';
import { totalMonthlyIncome } from './cashflow';
import { mortgagePayment, ownershipCosts } from './mortgage';
import type { GoalAllocations } from './allocation';
import { plannedChildren } from './childCost';

/** Jak se v rozpočtu jmenuje odkládání na dítě. Množné číslo podle plánu. */
export function childReserveLabel(state: WizardState): string {
  return plannedChildren(state) > 1 ? 'Rezerva na děti' : 'Rezerva na dítě';
}

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
    housing = Math.round(mortgagePayment(state)) + ownershipCosts(state);
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
    { key: 'other', label: 'Zábava, dovolená, koníčky', amount: e.other, necessary: false },
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

  if (excluded.has('other')) {
    e.other = 0;
    e.discretionaryBreakdown = undefined;
  } else if (e.discretionaryBreakdown) {
    // Klíče s tečkou („travel.abroad") jsou jednotlivé položky podrobného
    // rozpisu zbytných výdajů. Vypnutím jedné se o její částku sníží i celková
    // položka „zbytné", ne aby se odečetla dvakrát.
    const breakdown = { ...e.discretionaryBreakdown };
    let removed = 0;
    for (const key of excluded) {
      if (!key.includes('.')) continue;
      const amount = breakdown[key] ?? 0;
      if (amount > 0) {
        removed += amount;
        delete breakdown[key];
      }
    }
    if (removed > 0) {
      e.other = Math.max(0, e.other - removed);
      e.discretionaryBreakdown = breakdown;
    }
  }

  return { ...state, expenses: e };
}

// Vrátí stav bez vypnutých cílů. Slouží k modelování „co kdyby": vypnutím
// cíle se ukáže, jestli by na zbytek peníze stačily.
export function withExcludedGoals(state: WizardState, excluded: Set<string>): WizardState {
  if (excluded.size === 0) return state;
  const custom = (state.customGoals ?? []).filter((g) => isGoalActive(excluded, g.id));
  // Když se odloží poslední vlastní cíl, nemá smysl držet skupinu „Vlastní
  // cíle" zapnutou: hlásila by „žádný cíl jste nezadali", což není pravda.
  const off = new Set(excluded);
  if ((state.customGoals ?? []).length > 0 && custom.length === 0) off.add('other');
  return {
    ...state,
    goals: state.goals.filter((g) => !off.has(g)),
    customGoals: custom,
  };
}

/**
 * Je vlastní cíl součástí plánu?
 *
 * `other` vypíná celou skupinu, `other:<id>` jeden konkrétní cíl. Odkládání
 * jednotlivého cíle bývalo jen v kartě cílů jako místní stav, takže se nikam
 * nepromítlo: verdikt i rozpočet dál počítaly s cílem, který uživatel právě
 * odložil. Teď je to vypnutá položka jako každá jiná a platí pro celý přehled.
 *
 * Používá se na dvou místech naráz (stav i alokace) a musí tam dát stejnou
 * odpověď, jinak se pole cílů a pole částek rozejdou v indexech.
 */
export function isGoalActive(excluded: Set<string>, id: string): boolean {
  return !excluded.has('other') && !excluded.has(`other:${id}`);
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

// Spoření na cíle (měsíční toky). Nezahrnuje splátku hypotéky, ta je výdajem
// na bydlení ve sloupci „Po koupi".
//
// Odkládání na akontaci je naopak spoření jako každé jiné, ale jen do koupě:
// ve sloupci „Po koupi" už akontace leží v nemovitosti a místo něj se platí
// splátka. Kdyby tam zůstalo obojí, sloupec by ukazoval bydlení dvakrát.
function goalFlows(
  state: WizardState,
  allocations: GoalAllocations,
  afterPurchase: boolean
): GoalFlow[] {
  const flows: GoalFlow[] = [];
  if (!afterPurchase && state.goals.includes('property') && allocations.downPayment > 0) {
    flows.push({ key: 'downPayment', label: 'Spoření na akontaci', amount: allocations.downPayment });
  }
  if (state.goals.includes('reserve') && allocations.reserve > 0) {
    flows.push({ key: 'reserve', label: 'Nouzová rezerva', amount: allocations.reserve });
  }
  if (state.goals.includes('retirement') && allocations.retirement > 0) {
    flows.push({ key: 'retirement', label: 'Spoření na důchod', amount: allocations.retirement });
  }
  if (state.goals.includes('child') && allocations.child > 0) {
    flows.push({ key: 'child', label: childReserveLabel(state), amount: allocations.child });
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
  const goals = goalFlows(state, allocations, afterPurchase);

  const spentExpenses = expenses
    .filter((c) => !excludedKeys.has(c.key))
    .reduce((sum, c) => sum + c.amount, 0);
  const spentGoals = goals.reduce((sum, g) => sum + g.amount, 0);
  const free = income - spentExpenses - spentGoals;

  return { income, expenses, goals, free };
}
