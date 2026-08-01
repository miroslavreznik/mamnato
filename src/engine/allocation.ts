import type { WizardState } from '../types';
import { monthlyDisposable } from './cashflow';
import { downPaymentGap } from './mortgage';
import { CHILD_COSTS_CZ } from './defaults';
import { monthlyChildCost } from './childCost';

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

// Kolik z volných peněz jde ve výchozím stavu na akontaci. Půlka je rozumný
// kompromis: koupě se posouvá, a zároveň zbývá na ostatní cíle.
const DOWN_PAYMENT_SHARE = 0.5;

// Doba, do které by měla být akontace naspořená. Není to cíl, ale strop:
// když by půlka volných peněz nestačila stihnout to za pět let, odkládá se
// víc. Dřív se tenhle strop používal jako cíl, takže komu chybělo 40 000 Kč,
// tomu appka nabídla 667 Kč měsíčně a termín „za 5 let".
const MAX_DOWN_PAYMENT_YEARS = 5;

export function calculateDefaultAllocations(state: WizardState): GoalAllocations {
  const disposable = monthlyDisposable(state);
  const allocs: GoalAllocations = { downPayment: 0, retirement: 0, child: 0, custom: [] };

  // Dítě: vážený průměr měsíčních nákladů po celou dobu, po kterou se dítě
  // živí. Bere se z plánu, takže se s ním hýbe i karta „Náklady na dítě"
  // (počet dětí, částky podle věku, vysoká škola).
  if (state.goals.includes('child')) {
    const maxAge = state.childCosts?.includeUniversity ? 26 : 18;
    let totalMonths = 0;
    let totalCost = 0;
    for (const range of CHILD_COSTS_CZ) {
      if (range.to > maxAge) continue;
      const months = (range.to - range.from) * 12;
      totalCost += monthlyChildCost(state, range.from) * months;
      totalMonths += months;
    }
    allocs.child = totalMonths > 0 ? Math.round(totalCost / totalMonths) : 0;
  }

  // Akontace má přednost před dlouhodobými cíli, protože bez ní koupě není.
  // Odkládá se půlka volných peněz, a když by to trvalo přes pět let, tak víc.
  // Nikdy si ale nevezme víc, než co zbývá.
  if (state.goals.includes('property')) {
    const gap = downPaymentGap(state);
    if (gap > 0) {
      const afterChild = Math.max(0, disposable - allocs.child);
      const share = afterChild * DOWN_PAYMENT_SHARE;
      const overMaxHorizon = gap / (MAX_DOWN_PAYMENT_YEARS * 12);
      allocs.downPayment = Math.round(Math.min(afterChild, Math.max(share, overMaxHorizon)));
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
    // Zaokrouhlený podíl by po vynásobení počtem cílů přestřelil: ze 44 000
    // na tři cíle vyjde 14 667 na každý, dohromady 44 001, a v přehledu pak
    // stálo „volných zbývá −1 Kč". Zbytek po dělení dostane první cíl.
    const n = state.customGoals.length;
    const perGoal = Math.floor(remaining / n);
    allocs.custom = state.customGoals.map((_, i) => (i === 0 ? remaining - perGoal * (n - 1) : perGoal));
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
