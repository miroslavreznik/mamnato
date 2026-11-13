import { createInitialState } from './wizardStore';
import type { MortgageFlow, WizardState } from '../types';

export function createQuickMortgageState(flow: MortgageFlow): WizardState {
  const base = createInitialState();
  return {
    ...base,
    mortgageFlow: flow,
    income: { person1NetMonthly: 0 },
    expenses: {
      rent: 0,
      existingLoans: 0,
      insurance: 0,
      food: 0,
      transport: 0,
      children: 0,
      utilities: 0,
      other: 0,
      essentials: 0,
    },
    goals: ['property'],
    property: { ...base.property, targetPrice: 0 },
  };
}
