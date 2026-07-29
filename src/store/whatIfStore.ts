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
 *   která má měnit i verdikt nahoře. Tak to funguje odjakživa. Kontext je
 *   sem jen podává dál, aby šly cíle odkládat i odsud; drží je pořád
 *   dashboard, ne tenhle stav.
 *
 * **Proti čemu se to měří.** `baseline` je scénář, jak ho uživatel zadal:
 * se všemi cíli a bez vypnutých položek. Dřív to byl scénář už profiltrovaný,
 * takže odložení cíle sice překreslilo stuhu, ale duch původní cesty se
 * nevykreslil a dlaždice u toho hlásily „beze změny". Změna byla vidět jen
 * tomu, kdo si pamatoval, jak graf vypadal před kliknutím.
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

  /**
   * Odložené cíle. `property`, `retirement`, `child` a `other` vypínají celou
   * skupinu, `other:<id>` jeden vlastní cíl. Na rozdíl od posuvníků platí pro
   * celý přehled, protože „tenhle cíl zatím řešit nebudu" je rozhodnutí,
   * ne úvaha nad grafem.
   */
  excludedGoals: Set<string>;
  toggleGoal: (key: string) => void;
  /**
   * Seznam všech cílů, i odložených, pro přepínače.
   *
   * Je to totéž co `baseline`, jen pojmenované podle toho, k čemu se tam
   * sahá: přepínač odloženého cíle musí zůstat, jinak by nešlo cíl vrátit
   * zpátky jinak než resetem celé stránky.
   */
  allGoals: WizardState;
  allGoalAllocations: GoalAllocations;

  /** Liší se scénář od zadaného? Posuvníkem, odložením cíle nebo výdaje. */
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
