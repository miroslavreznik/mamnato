import type { WizardState } from '../types';
import { monthlyDisposable } from './cashflow';
import { downPaymentGap } from './mortgage';
import { CHILD_COSTS_CZ } from './defaults';

/**
 * Kolik měsíčně jde na jednotlivé cíle.
 *
 * Splátka hypotéky tu **není a být nemá**. Není to cíl, na který se odkládá,
 * ale výdaj na bydlení, který nahradí nájem; patří tedy mezi výdaje.
 * U nemovitosti je cílem naspořit akontaci, a to je položka jako každá jiná.
 *
 * Dřív tu splátka byla a odečítala se od disponibilní částky, ve které už byl
 * odečtený nájem. Domácnost tak platila bydlení dvakrát: u výchozích hodnot
 * zbylo z 10 500 Kč po odečtení splátky 23 085 Kč nula, takže appka tvrdila
 * „na důchod nespoříte nic" komukoli, kdo si zvolil hypotéku.
 */
export interface GoalAllocations {
  /** Měsíční odkládání na chybějící akontaci. */
  downPayment: number;
  retirement: number;
  child: number;
  custom: number[];
}

// Nejdelší doba, přes kterou se rozkládá spoření na akontaci. Delší horizont
// už neodpovídá tomu, jak lidé o koupi přemýšlejí.
const MAX_DOWN_PAYMENT_YEARS = 5;

export function calculateDefaultAllocations(state: WizardState): GoalAllocations {
  const disposable = monthlyDisposable(state);
  const allocs: GoalAllocations = { downPayment: 0, retirement: 0, child: 0, custom: [] };

  // Dítě: vážený průměr měsíčních nákladů za prvních 18 let.
  if (state.goals.includes('child')) {
    let totalMonths = 0;
    let totalCost = 0;
    for (const range of CHILD_COSTS_CZ) {
      if (range.to > 18) continue;
      const months = (range.to - range.from) * 12;
      totalCost += range.monthlyCost * months;
      totalMonths += months;
    }
    allocs.child = totalMonths > 0 ? Math.round(totalCost / totalMonths) : 0;
  }

  // Akontace má přednost před dlouhodobými cíli, protože bez ní koupě není.
  // Rozkládá se nejvýš na pět let a nikdy si nevezme víc, než co zbývá.
  if (state.goals.includes('property')) {
    const gap = downPaymentGap(state);
    if (gap > 0) {
      const afterChild = Math.max(0, disposable - allocs.child);
      const overMaxHorizon = gap / (MAX_DOWN_PAYMENT_YEARS * 12);
      allocs.downPayment = Math.round(Math.min(afterChild, overMaxHorizon));
    }
  }

  // Důchod: zbytek, nejvýš 30 % disponibilní částky.
  if (state.goals.includes('retirement')) {
    const remaining = disposable - allocs.child - allocs.downPayment;
    allocs.retirement = Math.max(0, Math.min(Math.round(remaining), Math.round(disposable * 0.3)));
  }

  // Vlastní cíle: prosté rozdělení toho, co ještě zbylo.
  if (state.goals.includes('other') && state.customGoals && state.customGoals.length > 0) {
    const used = allocs.downPayment + allocs.retirement + allocs.child;
    const remaining = Math.max(0, disposable - used);
    const perGoal = Math.round(remaining / state.customGoals.length);
    allocs.custom = state.customGoals.map(() => perGoal);
  }

  return allocs;
}

/**
 * Jak dlouho potrvá naspoření akontace při zvoleném měsíčním odkládání.
 *
 * Nulové odkládání znamená nekonečno, ne „spadni na celou disponibilní
 * částku". Ta odpovídá jen tomu, kdo nespoří na nic jiného, a jako slíbený
 * termín by lhala; kdo ji chce jako teoretickou hranici, ať si zavolá
 * `monthsToSaveDownPayment()`.
 */
export function monthsToSaveAtAllocation(state: WizardState, monthly: number): number {
  const gap = downPaymentGap(state);
  if (gap <= 0) return 0;
  if (monthly <= 0) return Infinity;
  return Math.ceil(gap / monthly);
}
