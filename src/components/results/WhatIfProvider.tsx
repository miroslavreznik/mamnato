import { useMemo, useState, type ReactNode } from 'react';
import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { WhatIfContext, applyOverrides, type Overrides, type WhatIfValue } from '../../store/whatIfStore';

/**
 * Drží posuvníky režimu „co kdyby". Co v nich je a proč zrovna ony, je
 * popsané u kontextu v `store/whatIfStore.ts`.
 *
 * Kontext a provider jsou schválně ve dvou souborech: kdyby byly v jednom,
 * přestane fungovat Fast Refresh a vývojový server při každé úpravě shodí
 * stav celé stránky.
 */
export function WhatIfProvider({
  state, allocations, allGoals, allGoalAllocations, excludedGoals, onToggleGoal, onResetGoals, children,
}: {
  /** Scénář, jak ho uživatel zadal, včetně vypnutých položek. */
  state: WizardState;
  allocations: GoalAllocations;
  /** Týž scénář, ale se všemi cíli. Z něj se staví seznam přepínačů. */
  allGoals: WizardState;
  allGoalAllocations: GoalAllocations;
  /** Odložené cíle. Drží je dashboard, sem se jen podávají dál. */
  excludedGoals: Set<string>;
  onToggleGoal: (key: string) => void;
  /** Vrátí odložené cíle zpátky. Volá se spolu s vynulováním posuvníků. */
  onResetGoals: () => void;
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState<Overrides>({});

  const value = useMemo<WhatIfValue>(() => ({
    // Proti čemu se měří: scénář, jak ho uživatel zadal. Ne ten, ze kterého
    // už jsou odložené cíle vyhozené, jinak by odložení nebylo vidět jako
    // změna a duch původní cesty by se nevykreslil.
    baseline: allGoals,
    baselineAllocations: allGoalAllocations,
    current: applyOverrides(state, overrides),
    // Posuvníky nemění, kolik se odkládá na cíle, jen parametry bydlení
    // a volna. Odložení cíle je naopak přímo v `allocations`.
    currentAllocations: allocations,
    overrides,
    setOverride: (key, v) => setOverrides((prev) => ({ ...prev, [key]: v })),
    excludedGoals,
    toggleGoal: onToggleGoal,
    allGoals,
    allGoalAllocations,
    // Odložený cíl se počítá stejně jako posuvník: obojí je „co kdyby",
    // obojí panel ovládá a obojí vrací tlačítko zpět. Vypnuté výdaje se
    // zapínají v Rozpočtu, tam kde se vypnuly.
    touched: Object.values(overrides).some((v) => v != null) || excludedGoals.size > 0,
    reset: () => { setOverrides({}); onResetGoals(); },
  }), [state, allocations, overrides, excludedGoals, onToggleGoal, onResetGoals, allGoals, allGoalAllocations]);

  return <WhatIfContext.Provider value={value}>{children}</WhatIfContext.Provider>;
}
