export type UserMode = 'individual' | 'couple' | 'family';

export type FinancialGoal = 'property' | 'child' | 'retirement' | 'other';

export interface WizardState {
  version: string;
  currentStep: number;
  completedSteps: number[];

  // Step 1: Mode
  mode: UserMode;
  numberOfChildren?: number;

  // Nejmladšímu žadateli je méně než 36 let → dle ČNB vyšší limit LTV (90 %),
  // tedy nižší povinná akontace (10 % místo 20 %).
  applicantUnder36?: boolean;

  // Step 2: Income
  income: {
    person1NetMonthly: number;
    person2NetMonthly?: number;
    parentalAllowance?: number;
  };

  // Věk žadatelů, ovlivňuje limit LTV (do 36 let), horizont spoření na důchod
  // a splatnost hypotéky. Nepovinné (0 / undefined = nezadáno).
  person1Age?: number;
  person2Age?: number;

  // Step 3: Expenses
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

  // Zůstatek jistiny stávajících úvěrů, pro výpočet DTI dle ČNB (nezahrnuje novou hypotéku)
  existingDebtPrincipal?: number;

  // Step 4: Savings
  savings: {
    totalSavings: number;
    downPaymentFromSavings?: number;
    breakdown?: SavingsBreakdown;
  };

  // Step 5: Goals
  goals: FinancialGoal[];

  // Step 6: Property
  property: {
    targetPrice: number;
    ownershipCosts?: number;
    mortgageRate?: number;
    fixationYears?: number;
    loanTermYears?: number;
    // Nepovinné: rekonstrukce po koupi. Když chybí, appka se chová jako dřív
    // a na nic navíc se neptá.
    renovation?: {
      cost: number;
      // Jak dlouho potrvá. Po tu dobu se obvykle bydlí dál v nájmu.
      months: number;
      // Bydlíte během rekonstrukce jinde a platíte dosavadní nájem?
      payingRentMeanwhile: boolean;
    };
  };

  // Custom goals (for 'other')
  customGoals?: CustomGoal[];

  /**
   * Za jak dlouho čekáte dítě, v měsících od dneška. Výchozí je rok.
   *
   * Je to **zadaný údaj, ne úvaha nad grafem**, i když se zadává tažením
   * puntíku po časové ose. Rozhoduje totiž o víc než o poloze značky: jestli
   * rodičovská padne před koupi (platí se nájem) nebo po ní (splátka)
   * a kolik do té doby stihne domácnost naspořit, tedy z čeho se výpadek
   * příjmu pokryje. Dokud si termín držela jen obrazovka, věta u cíle
   * „Během rodičovské vám bude chybět…" se posunem puntíku vůbec nezměnila,
   * protože ji počítal engine, který o něm nevěděl.
   */
  childInMonths?: number;

  // Rodičovská / výpadek příjmu (pro cíl „dítě" u páru/rodiny)
  parentalLeave?: ParentalLeave;
}

export interface ParentalLeave {
  enabled: boolean;
  parent: 1 | 2; // který rodič zůstane doma
  durationMonths: number; // délka volna (mateřská + rodičovská)
  // Ručně zadaná měsíční dávka. Když chybí, odhadne se z příjmu pečujícího
  // rodiče: mateřská prvních 28 týdnů, pak rodičovský příspěvek (leavePhases).
  monthlyBenefit?: number;
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
