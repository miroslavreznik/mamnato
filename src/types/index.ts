export type UserMode = 'individual' | 'couple' | 'family';

export type FinancialGoal = 'property' | 'child' | 'retirement' | 'other';

export interface WizardState {
  version: string;
  currentStep: number;
  completedSteps: number[];

  // Step 1 — Mode
  mode: UserMode;
  numberOfChildren?: number;

  // Step 2 — Income
  income: {
    person1NetMonthly: number;
    person2NetMonthly?: number;
    parentalAllowance?: number;
  };

  // Step 3 — Expenses
  expenses: {
    rent: number;
    existingLoans: number;
    insurance: number;
    food: number;
    transport: number;
    children: number;
    utilities: number;
    other: number;
  };

  // Step 4 — Savings
  savings: {
    totalSavings: number;
    downPaymentFromSavings?: number;
  };

  // Step 5 — Goals
  goals: FinancialGoal[];

  // Step 6 — Property
  property: {
    targetPrice: number;
    ownershipCosts?: number;
    mortgageRate?: number;
    fixationYears?: number;
    loanTermYears?: number;
  };

  // Custom goals (for 'other')
  customGoals?: CustomGoal[];
}

export interface CustomGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetMonths: number;
}
