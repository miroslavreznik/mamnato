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
export function WhatIfProvider({ state, allocations, children }: {
  /** Scénář, jak ho uživatel zadal, včetně vypnutých položek. */
  state: WizardState;
  allocations: GoalAllocations;
  children: ReactNode;
}) {
  const [overrides, setOverrides] = useState<Overrides>({});

  const value = useMemo<WhatIfValue>(() => ({
    baseline: state,
    baselineAllocations: allocations,
    current: applyOverrides(state, overrides),
    // Posuvníky nemění, kolik se odkládá na cíle, jen parametry bydlení
    // a volna. Alokace proto zůstávají stejné pro oba scénáře.
    currentAllocations: allocations,
    overrides,
    setOverride: (key, v) => setOverrides((prev) => ({ ...prev, [key]: v })),
    touched: Object.values(overrides).some((v) => v != null),
    reset: () => setOverrides({}),
  }), [state, allocations, overrides]);

  return <WhatIfContext.Provider value={value}>{children}</WhatIfContext.Provider>;
}
