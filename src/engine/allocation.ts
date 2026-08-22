import type { WizardState } from '../types';
import { monthlyDisposable } from './cashflow';
import { downPaymentGap } from './mortgage';
import { CHILD_COSTS_CZ } from './defaults';
import { monthlyChildCost } from './childCost';
import { reserveStatus } from './reserve';

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
  /** Měsíční odkládání na nouzovou rezervu, dokud není plná. */
  reserve: number;
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

// Do kolika měsíců má být rezerva plná, když ji uživatel nechá na výchozím
// rozdělení. Dva roky jsou kompromis: rezerva vzniká, a přitom neodloží koupi
// o polovinu doby spoření na akontaci.
const RESERVE_FILL_MONTHS = 24;

// Nejvyšší podíl volných peněz, který si rezerva vezme. Má přednost před
// akontací, ale ne takovou, aby spolkla celý rozpočet: cíl, který zastaví
// všechno ostatní, si uživatel vypne a nebude ho mít vůbec.
const RESERVE_MAX_SHARE = 0.4;

export function calculateDefaultAllocations(state: WizardState): GoalAllocations {
  const disposable = monthlyDisposable(state);
  const allocs: GoalAllocations = { downPayment: 0, reserve: 0, retirement: 0, child: 0, custom: [] };

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

  // Rezerva je před akontací schválně. Kdo koupí s prázdnou rezervou, řeší
  // první rozbitou pračku drahou půjčkou, a to je horší než koupit o pár
  // měsíců později; slovníček appky to říká rovnou („první věc, kterou má
  // smysl mít hotovou"). Aby to nebyl jen jiný způsob, jak koupi zabít, bere
  // si rezerva nejvýš `RESERVE_MAX_SHARE` volných peněz.
  if (state.goals.includes('reserve')) {
    const { gap } = reserveStatus(state);
    if (gap > 0) {
      const afterChild = Math.max(0, disposable - allocs.child);
      allocs.reserve = Math.round(Math.min(afterChild * RESERVE_MAX_SHARE, gap / RESERVE_FILL_MONTHS));
    }
  }

  // Akontace má přednost před dlouhodobými cíli, protože bez ní koupě není.
  // Odkládá se půlka volných peněz, a když by to trvalo přes pět let, tak víc.
  // Nikdy si ale nevezme víc, než co zbývá.
  if (state.goals.includes('property')) {
    const gap = downPaymentGap(state);
    if (gap > 0) {
      const afterChild = Math.max(0, disposable - allocs.child - allocs.reserve);
      const share = afterChild * DOWN_PAYMENT_SHARE;
      const overMaxHorizon = gap / (MAX_DOWN_PAYMENT_YEARS * 12);
      allocs.downPayment = Math.round(Math.min(afterChild, Math.max(share, overMaxHorizon)));
    }
  }

  // Důchod: zbytek, nejvýš 30 % disponibilní částky.
  if (state.goals.includes('retirement')) {
    const remaining = disposable - allocs.child - allocs.reserve - allocs.downPayment;
    allocs.retirement = Math.max(0, Math.min(Math.round(remaining), Math.round(disposable * 0.3)));
  }

  // Vlastní cíle: nejdřív přesně tolik, kolik potřebují ke svému termínu.
  //
  // Dřív dostaly automaticky úplně všechno, co zbylo. Cíl 400 000 Kč za dva
  // roky tak mohl dostat 52 000 Kč měsíčně, přestože potřeboval 16 667 Kč,
  // a karta pak bez vysvětlení hlásila dosažení za osm měsíců. Přebytek není
  // povinnost utratit: když na termíny stačí méně, zůstane opravdu volný.
  if (state.goals.includes('other') && state.customGoals && state.customGoals.length > 0) {
    const used = allocs.downPayment + allocs.reserve + allocs.retirement + allocs.child;
    const remaining = Math.max(0, disposable - used);
    const needed = state.customGoals.map((goal) => (
      goal.targetMonths > 0 ? Math.ceil(Math.max(0, goal.targetAmount) / goal.targetMonths) : 0
    ));
    const totalNeeded = needed.reduce((sum, value) => sum + value, 0);

    if (totalNeeded <= remaining) {
      allocs.custom = needed;
    } else if (totalNeeded > 0) {
      // Když na všechny termíny nestačí, rozdělí se zbytek poměrně podle
      // potřeb. Poslední cíl dostane zaokrouhlovací zbytek, takže součet ani
      // o korunu nepřesáhne společný balík.
      let assigned = 0;
      allocs.custom = needed.map((value, index) => {
        const allocation = index === needed.length - 1
          ? remaining - assigned
          : Math.floor(remaining * value / totalNeeded);
        assigned += allocation;
        return allocation;
      });
    } else {
      allocs.custom = needed.map(() => 0);
    }
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
