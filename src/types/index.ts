export type UserMode = 'individual' | 'couple' | 'family';

export type FinancialGoal = 'property' | 'child' | 'retirement' | 'other';

export interface WizardState {
  version: string;
  currentStep: number;
  completedSteps: number[];

  // Step 1 — Mode
  mode: UserMode;
  numberOfChildren?: number;

  // Nejmladšímu žadateli je méně než 36 let → dle ČNB vyšší limit LTV (90 %),
  // tedy nižší povinná akontace (10 % místo 20 %).
  applicantUnder36?: boolean;

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
    // Nepovinný podrobný rozpis zbytných výdajů (klíč „skupina.položka" → částka).
    // Když je vyplněn, `other` se drží jako jeho součet.
    discretionaryBreakdown?: Record<string, number>;
  };

  // Zůstatek jistiny stávajících úvěrů — pro výpočet DTI dle ČNB (nezahrnuje novou hypotéku)
  existingDebtPrincipal?: number;

  // Step 4 — Savings
  savings: {
    totalSavings: number;
    downPaymentFromSavings?: number;
    breakdown?: SavingsBreakdown;
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

export interface SavingsBreakdown {
  current: number; // běžný účet
  savingsAccount: number; // spořicí účet
  investments: number; // investice (fondy, ETF, akcie)
}
