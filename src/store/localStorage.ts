import type { WizardState, FinancialGoal, UserMode } from '../types';
import { createInitialState } from './wizardStore';

const STORAGE_KEY = 'mamnato_wizard_v1';
const CURRENT_VERSION = '1.0';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeNumberMap(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = num(v, 0);
    if (n) out[k] = n;
  }
  return out;
}

const VALID_GOALS: FinancialGoal[] = ['property', 'child', 'retirement', 'other'];

/**
 * Načtený stav z prohlížeče zkontroluje a doplní na aktuální tvar.
 *
 * localStorage může obsahovat starší verzi (bez nových polí) nebo poškozená
 * data. Místo aby se rozbité hodnoty dostaly do výpočtů, tady je zahodíme
 * nebo nahradíme výchozími. Vrací null, když data vůbec nevypadají jako náš stav.
 */
export function normalizeState(raw: unknown): WizardState | null {
  if (!isRecord(raw) || !isRecord(raw.income) || !isRecord(raw.expenses) || !Array.isArray(raw.goals)) {
    return null;
  }

  const base = createInitialState();
  const rIncome = raw.income as Record<string, unknown>;
  const rExpenses = raw.expenses as Record<string, unknown>;
  const rSavings = isRecord(raw.savings) ? raw.savings : {};
  const rProperty = isRecord(raw.property) ? raw.property : {};
  const rBreakdown = isRecord(rSavings.breakdown) ? rSavings.breakdown : null;

  const mode: UserMode = raw.mode === 'couple' || raw.mode === 'family' ? raw.mode : 'individual';

  return {
    version: CURRENT_VERSION,
    currentStep: num(raw.currentStep, base.currentStep),
    completedSteps: Array.isArray(raw.completedSteps)
      ? raw.completedSteps.filter((s): s is number => typeof s === 'number')
      : [],
    mode,
    numberOfChildren: typeof raw.numberOfChildren === 'number' ? raw.numberOfChildren : base.numberOfChildren,
    applicantUnder36: typeof raw.applicantUnder36 === 'boolean' ? raw.applicantUnder36 : undefined,
    person1Age: typeof raw.person1Age === 'number' ? raw.person1Age : undefined,
    person2Age: typeof raw.person2Age === 'number' ? raw.person2Age : undefined,
    income: {
      person1NetMonthly: num(rIncome.person1NetMonthly, base.income.person1NetMonthly),
      person2NetMonthly: rIncome.person2NetMonthly != null ? num(rIncome.person2NetMonthly, 0) : undefined,
      parentalAllowance: rIncome.parentalAllowance != null ? num(rIncome.parentalAllowance, 0) : undefined,
    },
    expenses: {
      rent: num(rExpenses.rent, base.expenses.rent),
      existingLoans: num(rExpenses.existingLoans, base.expenses.existingLoans),
      insurance: num(rExpenses.insurance, base.expenses.insurance),
      food: num(rExpenses.food, base.expenses.food),
      transport: num(rExpenses.transport, base.expenses.transport),
      children: num(rExpenses.children, base.expenses.children),
      utilities: num(rExpenses.utilities, base.expenses.utilities),
      other: num(rExpenses.other, base.expenses.other),
      discretionaryBreakdown: isRecord(rExpenses.discretionaryBreakdown)
        ? sanitizeNumberMap(rExpenses.discretionaryBreakdown)
        : undefined,
    },
    existingDebtPrincipal: raw.existingDebtPrincipal != null ? num(raw.existingDebtPrincipal, 0) : undefined,
    savings: {
      totalSavings: num(rSavings.totalSavings, base.savings.totalSavings),
      downPaymentFromSavings: rSavings.downPaymentFromSavings != null ? num(rSavings.downPaymentFromSavings, 0) : undefined,
      breakdown: rBreakdown
        ? {
            current: num(rBreakdown.current, 0),
            savingsAccount: num(rBreakdown.savingsAccount, 0),
            investments: num(rBreakdown.investments, 0),
          }
        : undefined,
    },
    goals: raw.goals.filter((g): g is FinancialGoal => VALID_GOALS.includes(g as FinancialGoal)),
    property: {
      targetPrice: num(rProperty.targetPrice, base.property.targetPrice),
      ownershipCosts: rProperty.ownershipCosts != null ? num(rProperty.ownershipCosts, base.property.ownershipCosts!) : base.property.ownershipCosts,
      mortgageRate: rProperty.mortgageRate != null ? num(rProperty.mortgageRate, base.property.mortgageRate!) : base.property.mortgageRate,
      fixationYears: rProperty.fixationYears != null ? num(rProperty.fixationYears, base.property.fixationYears!) : base.property.fixationYears,
      loanTermYears: rProperty.loanTermYears != null ? num(rProperty.loanTermYears, base.property.loanTermYears!) : base.property.loanTermYears,
    },
    customGoals: Array.isArray(raw.customGoals)
      ? raw.customGoals.filter(isRecord).map((g) => ({
          id: typeof g.id === 'string' && g.id ? g.id : `goal-${Math.random().toString(36).slice(2)}`,
          name: typeof g.name === 'string' ? g.name : '',
          targetAmount: num(g.targetAmount, 0),
          targetMonths: Math.max(1, num(g.targetMonths, 1)),
        }))
      : undefined,
    parentalLeave: isRecord(raw.parentalLeave)
      ? {
          enabled: raw.parentalLeave.enabled === true,
          parent: raw.parentalLeave.parent === 2 ? 2 : 1,
          durationMonths: Math.max(1, num(raw.parentalLeave.durationMonths, 36)),
          monthlyBenefit: Math.max(0, num(raw.parentalLeave.monthlyBenefit, 0)),
        }
      : undefined,
  };
}

export function saveState(state: WizardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadState(): WizardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}
