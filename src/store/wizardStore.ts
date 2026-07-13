import { createContext, useContext } from 'react';
import type { WizardState, UserMode, FinancialGoal, SavingsBreakdown } from '../types';
import { DEFAULTS } from '../engine/defaults';

export function createInitialState(): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'individual',
    income: {
      person1NetMonthly: DEFAULTS.income.person1NetMonthly,
    },
    expenses: {
      rent: DEFAULTS.expenses.rent,
      existingLoans: DEFAULTS.expenses.existingLoans,
      insurance: DEFAULTS.expenses.insurance,
      food: DEFAULTS.expenses.food,
      transport: DEFAULTS.expenses.transport,
      children: 0,
      utilities: DEFAULTS.expenses.utilities,
      other: DEFAULTS.expenses.other,
    },
    savings: {
      totalSavings: 0,
    },
    goals: [],
    property: {
      targetPrice: DEFAULTS.property.targetPrice,
      ownershipCosts: DEFAULTS.property.ownershipCosts,
      mortgageRate: DEFAULTS.property.mortgageRate,
      fixationYears: DEFAULTS.property.fixationYears,
      loanTermYears: DEFAULTS.property.loanTermYears,
    },
  };
}

export type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'SET_MODE'; mode: UserMode; numberOfChildren?: number }
  | { type: 'UPDATE_INCOME'; field: string; value: number }
  | { type: 'UPDATE_EXPENSES'; field: string; value: number }
  | { type: 'UPDATE_DISCRETIONARY_ITEM'; key: string; value: number }
  | { type: 'CLEAR_DISCRETIONARY_BREAKDOWN' }
  | { type: 'UPDATE_SAVINGS'; field: string; value: number }
  | { type: 'UPDATE_SAVINGS_BREAKDOWN'; field: keyof SavingsBreakdown; value: number }
  | { type: 'UPDATE_DEBT_PRINCIPAL'; value: number }
  | { type: 'SET_GOALS'; goals: FinancialGoal[] }
  | { type: 'UPDATE_PROPERTY'; field: string; value: number }
  | { type: 'SET_NUMBER_OF_CHILDREN'; count: number }
  | { type: 'SET_PERSON_AGE'; person: 1 | 2; value: number }
  | { type: 'UPDATE_CUSTOM_GOALS'; goals: WizardState['customGoals'] }
  | { type: 'LOAD_STATE'; state: WizardState }
  | { type: 'RESET' };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP': {
      const completedSteps = state.completedSteps.includes(state.currentStep)
        ? state.completedSteps
        : [...state.completedSteps, state.currentStep];
      return { ...state, currentStep: state.currentStep + 1, completedSteps };
    }
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) };
    case 'GO_TO_STEP': {
      const completedSteps = state.completedSteps.includes(state.currentStep)
        ? state.completedSteps
        : [...state.completedSteps, state.currentStep];
      return { ...state, currentStep: action.step, completedSteps };
    }
    case 'SET_MODE': {
      const updates: Partial<WizardState> = { mode: action.mode };
      if (action.mode === 'individual') {
        updates.income = { person1NetMonthly: state.income.person1NetMonthly };
        updates.expenses = { ...state.expenses, children: 0 };
        updates.numberOfChildren = undefined;
        updates.person2Age = undefined; // druhá osoba u jednotlivce nedává smysl
      } else if (action.mode === 'couple') {
        updates.income = {
          person1NetMonthly: state.income.person1NetMonthly,
          person2NetMonthly: state.income.person2NetMonthly ?? DEFAULTS.income.person1NetMonthly,
        };
        updates.expenses = { ...state.expenses, children: 0 };
        updates.numberOfChildren = undefined;
      } else {
        updates.income = {
          person1NetMonthly: state.income.person1NetMonthly,
          person2NetMonthly: state.income.person2NetMonthly ?? DEFAULTS.income.person1NetMonthly,
          parentalAllowance: state.income.parentalAllowance ?? 0,
        };
        updates.expenses = {
          ...state.expenses,
          children: state.expenses.children || DEFAULTS.expenses.children,
        };
        updates.numberOfChildren = action.numberOfChildren ?? state.numberOfChildren ?? 1;
      }
      return { ...state, ...updates };
    }
    case 'SET_NUMBER_OF_CHILDREN':
      return { ...state, numberOfChildren: action.count };
    case 'SET_PERSON_AGE':
      return action.person === 1
        ? { ...state, person1Age: action.value }
        : { ...state, person2Age: action.value };
    case 'UPDATE_INCOME':
      return { ...state, income: { ...state.income, [action.field]: action.value } };
    case 'UPDATE_EXPENSES':
      return { ...state, expenses: { ...state.expenses, [action.field]: action.value } };
    case 'UPDATE_DISCRETIONARY_ITEM': {
      const prev = state.expenses.discretionaryBreakdown ?? {};
      const discretionaryBreakdown = { ...prev, [action.key]: action.value };
      // Když je rozpis vyplněn, „other" (zbytné výdaje) se drží jako jeho součet.
      const other = Object.values(discretionaryBreakdown).reduce((s, v) => s + v, 0);
      return { ...state, expenses: { ...state.expenses, discretionaryBreakdown, other } };
    }
    case 'CLEAR_DISCRETIONARY_BREAKDOWN': {
      const { discretionaryBreakdown: _drop, ...expenses } = state.expenses;
      void _drop;
      return { ...state, expenses };
    }
    case 'UPDATE_SAVINGS':
      return { ...state, savings: { ...state.savings, [action.field]: action.value } };
    case 'UPDATE_SAVINGS_BREAKDOWN': {
      const prev: SavingsBreakdown = state.savings.breakdown
        ?? { current: 0, savingsAccount: 0, investments: 0 };
      const breakdown: SavingsBreakdown = { ...prev, [action.field]: action.value };
      // Když je rozpad vyplněn, celkové úspory se drží jako jeho součet.
      const totalSavings = breakdown.current + breakdown.savingsAccount + breakdown.investments;
      return { ...state, savings: { ...state.savings, breakdown, totalSavings } };
    }
    case 'UPDATE_DEBT_PRINCIPAL':
      return { ...state, existingDebtPrincipal: action.value };
    case 'SET_GOALS':
      return { ...state, goals: action.goals };
    case 'UPDATE_PROPERTY':
      return { ...state, property: { ...state.property, [action.field]: action.value } };
    case 'UPDATE_CUSTOM_GOALS':
      return { ...state, customGoals: action.goals };
    case 'LOAD_STATE':
      return action.state;
    case 'RESET':
      return createInitialState();
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) throw new Error('useWizard must be used within WizardProvider');
  return context;
}
