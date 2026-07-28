import { createContext, useContext } from 'react';
import type { WizardState } from '../types';
import type { GoalAllocations } from '../engine/allocation';

/**
 * Stav režimu „co kdyby".
 *
 * Rozdělení odpovědnosti je schválně nesymetrické:
 *
 * - **Vypnuté položky** (výdaje a cíle) drží `ResultsDashboard` a platí pro
 *   celý přehled. Je to odpověď na otázku „co když tenhle výdaj mít nebudu",
 *   která má měnit i verdikt nahoře. Tak to funguje odjakživa.
 * - **Posuvníky** (cena, sazba, délka rodičovské) drží tenhle kontext a platí
 *   jen uvnitř záložky „Co kdyby". Je to pískoviště: uživatel zkouší, co by
 *   bylo kdyby, ne že by to tak měl. Kdyby posuvníky měnily i Cestu, přestal
 *   by být poznat rozdíl mezi „takhle to mám" a „takhle bych to chtěl".
 *
 * **Výchozí scénář se nikdy nepřepisuje.** Drží se jako `baseline`, aby šlo
 * vykreslit „ducha" původní cesty a vrátit se k němu. Bez toho uživatel
 * nepozná, jestli si posuvníkem pomohl, nebo uškodil.
 *
 * Nic z toho se neukládá. Je to úvaha nad grafem, ne zadané údaje; uložený
 * scénář by se příště tvářil jako skutečná situace.
 */

export interface Overrides {
  /** Cena nemovitosti. `undefined` = platí zadaná hodnota. */
  propertyPrice?: number;
  mortgageRate?: number;
  parentalLeaveMonths?: number;
}

export interface WhatIfValue {
  /** Scénář, jak ho uživatel zadal (i s vypnutými položkami). */
  baseline: WizardState;
  baselineAllocations: GoalAllocations;
  /** Scénář po posuvnících. Z něj počítá záložka „Co kdyby". */
  current: WizardState;
  currentAllocations: GoalAllocations;

  overrides: Overrides;
  setOverride: <K extends keyof Overrides>(key: K, value: Overrides[K]) => void;

  /** Sáhl uživatel na posuvníky? */
  touched: boolean;
  reset: () => void;
}

export const WhatIfContext = createContext<WhatIfValue | null>(null);

/** Dosadí posuvníky do stavu. Nezadaná hodnota nechává původní. */
export function applyOverrides(state: WizardState, o: Overrides): WizardState {
  const next: WizardState = { ...state, property: { ...state.property } };
  if (o.propertyPrice != null) next.property.targetPrice = o.propertyPrice;
  if (o.mortgageRate != null) next.property.mortgageRate = o.mortgageRate;
  if (o.parentalLeaveMonths != null && state.parentalLeave) {
    next.parentalLeave = { ...state.parentalLeave, durationMonths: o.parentalLeaveMonths };
  }
  return next;
}

export function useWhatIf(): WhatIfValue {
  const ctx = useContext(WhatIfContext);
  if (!ctx) throw new Error('useWhatIf musí být uvnitř WhatIfProvider');
  return ctx;
}
