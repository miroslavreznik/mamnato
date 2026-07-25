import type { WizardState } from '../types';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { effectiveDownPayment, expensesAfterPurchase } from './mortgage';

// Rodičovský příspěvek na jedno dítě (od 2024), celkový balík na celou dobu.
export const RODICOVSKA_POOL = 350000;

// Mateřská (peněžitá pomoc v mateřství) se vyplácí 28 týdnů, tedy zhruba
// 6,5 měsíce. U vícerčat 37 týdnů, s tím tady nepočítáme.
export const PPM_WEEKS = 28;
export const PPM_MONTHS = Math.round((PPM_WEEKS * 7 / 30.4) * 10) / 10;

// Redukční hranice denního vyměřovacího základu pro nemocenské dávky, 2026.
// Zdroj: ČSSZ, hodnoty platné od 1. 1. 2026.
const REDUCTION_BANDS = [
  { limit: 1633, share: 1.0 },
  { limit: 2449, share: 0.6 },
  { limit: 4897, share: 0.3 },
] as const;

// PPM je 70 % redukovaného denního vyměřovacího základu za kalendářní den.
const PPM_RATE = 0.7;

// Appka zná čistou mzdu, PPM se ale počítá z hrubé. Přepočet vychází ze
// stejného poměru jako výchozí hodnoty v defaults.ts (hrubá 50 282 → čistá
// ~39 800, tedy zhruba 79 %). Je to odhad, ne mzdová kalkulačka.
const NET_TO_GROSS = 1 / 0.79;

/**
 * Odhad měsíční mateřské z čisté mzdy pečujícího rodiče.
 *
 * Postup je stejný jako u ČSSZ: z hrubé mzdy se spočítá denní vyměřovací
 * základ, ten se zredukuje podle tří hranic a z výsledku se bere 70 % za
 * každý kalendářní den. PPM se nedaní ani z ní neodcházejí odvody, takže je
 * srovnatelná přímo s čistou mzdou.
 */
export function ppmMonthly(netMonthlySalary: number): number {
  if (netMonthlySalary <= 0) return 0;
  const grossMonthly = netMonthlySalary * NET_TO_GROSS;
  const dailyBase = (grossMonthly * 12) / 365;

  let reduced = 0;
  let previousLimit = 0;
  for (const band of REDUCTION_BANDS) {
    if (dailyBase <= previousLimit) break;
    reduced += (Math.min(dailyBase, band.limit) - previousLimit) * band.share;
    previousLimit = band.limit;
  }

  return Math.round(reduced * PPM_RATE * 30.4);
}

// Rodičovský příspěvek po skončení mateřské: zbytek balíku rozložený na
// zbývající měsíce volna. Čerpat se dá rychleji i pomaleji, tady se drží
// zvolené délky volna.
export function rodicovskaMonthly(durationMonths: number, ppmMonths: number): number {
  const remaining = Math.max(1, durationMonths - ppmMonths);
  return Math.round(RODICOVSKA_POOL / remaining);
}

// Fáze volna. Mateřská na začátku je výrazně vyšší než rodičovský příspěvek,
// takže rovnoměrné rozpočítání balíku přes celé volno dělalo první půlrok
// zbytečně dramatickým.
export interface LeavePhase {
  key: 'ppm' | 'rodicovska';
  label: string;
  months: number;
  monthlyBenefit: number;
}

export function leavePhases(state: WizardState): LeavePhase[] {
  const pl = state.parentalLeave;
  if (!pl) return [];
  const duration = Math.max(1, pl.durationMonths);

  // Ručně zadaná dávka vypne odhad: uživatel ví víc než my.
  if (pl.monthlyBenefit != null) {
    return [{ key: 'rodicovska', label: 'Dávky během volna', months: duration, monthlyBenefit: pl.monthlyBenefit }];
  }

  const ppmMonths = Math.min(PPM_MONTHS, duration);
  const ppm = ppmMonthly(parentSalary(state, pl.parent));
  const phases: LeavePhase[] = [
    { key: 'ppm', label: `Mateřská (prvních ${PPM_WEEKS} týdnů)`, months: ppmMonths, monthlyBenefit: ppm },
  ];
  if (duration > ppmMonths) {
    phases.push({
      key: 'rodicovska',
      label: 'Rodičovský příspěvek',
      months: duration - ppmMonths,
      monthlyBenefit: rodicovskaMonthly(duration, ppmMonths),
    });
  }
  return phases;
}

// Výchozí měsíční příjem během volna = rodičovský příspěvek rozložený na dobu čerpání.
export function defaultMonthlyBenefit(durationMonths: number): number {
  return Math.round(RODICOVSKA_POOL / Math.max(1, durationMonths));
}

export function parentSalary(state: WizardState, parent: 1 | 2): number {
  return parent === 1
    ? state.income.person1NetMonthly ?? 0
    : state.income.person2NetMonthly ?? 0;
}

// Rozumný výchozí pečující rodič = ten s nižším příjmem (menší výpadek).
export function defaultCaringParent(state: WizardState): 1 | 2 {
  const p1 = state.income.person1NetMonthly ?? 0;
  const p2 = state.income.person2NetMonthly ?? 0;
  return p2 > 0 && p2 < p1 ? 2 : 1;
}

export interface LeaveImpact {
  parent: 1 | 2;
  durationMonths: number;
  // Průměrná dávka za celé volno. Skutečný průběh je ve `phases`, průměr
  // slouží jen tam, kde se musí ukázat jedno číslo.
  monthlyBenefit: number;
  phases: LeavePhase[];
  lostSalary: number;
  incomeNow: number;
  incomeDuringLeave: number;
  disposableNow: number;
  disposableDuringLeave: number;
  // Disponibilní částka během volna už po koupi (splátka místo nájmu), jen když je cíl nemovitost
  disposableDuringLeaveAfterPurchase: number | null;
  savingsLostTotal: number; // o kolik méně naspoříte za celé volno
  // Krytí schodku z rezervy: kolik úspor zbyde (po akontaci, když se kupuje),
  // měsíční schodek během volna a kolik měsíců volna rezerva pokryje.
  reserveAfter: number;
  shortfallPerMonth: number; // 0 = během volna žádný schodek
  shortfallTotal: number;
  monthsCovered: number | null; // null = žádný schodek; jinak počet pokrytých měsíců
  // Rezerva pokryje celé volno. Dočasný schodek krytý úsporami je něco jiného
  // než schodek, na který nemáte, a verdikt to musí umět rozlišit.
  coversWholeLeave: boolean;
  reserveLeftAfterLeave: number; // co z rezervy zbyde, až volno skončí
  runwayMonthsAfterLeave: number; // a na kolik měsíců výdajů to potom vystačí
}

// Mimo React testovatelné vyhodnocení dopadu rodičovské. Vrací null, když
// scénář není zapnutý.
export function evaluateParentalLeave(state: WizardState): LeaveImpact | null {
  const pl = state.parentalLeave;
  if (!pl || !pl.enabled) return null;

  const lostSalary = parentSalary(state, pl.parent);
  const incomeNow = totalMonthlyIncome(state);
  const phases = leavePhases(state);
  // Průměr vážený délkou fází. Mateřská je vyšší a kratší, rodičovská nižší
  // a delší, prostý průměr obou by realitu posunul.
  const totalMonths = phases.reduce((s, p) => s + p.months, 0) || 1;
  const avgBenefit = phases.reduce((s, p) => s + p.monthlyBenefit * p.months, 0) / totalMonths;
  const incomeDuringLeave = incomeNow - lostSalary + avgBenefit;
  const expenses = totalMonthlyExpenses(state);

  const disposableNow = incomeNow - expenses;
  const disposableDuringLeave = incomeDuringLeave - expenses;

  // Výdaje, se kterými se během volna reálně počítá: po koupi mizí nájem
  // a energie, přibývá splátka a náklady na vlastnictví.
  const isBuying = state.goals.includes('property');
  const relevantExpenses = isBuying ? expensesAfterPurchase(state) : expenses;

  let disposableDuringLeaveAfterPurchase: number | null = null;
  if (isBuying) {
    disposableDuringLeaveAfterPurchase = incomeDuringLeave - relevantExpenses;
  }

  const savingsLostTotal = Math.max(0, disposableNow - disposableDuringLeave) * pl.durationMonths;

  // Rezerva, ze které se dá schodek během volna krýt. Když se kupuje nemovitost,
  // většina úspor padne na akontaci, počítáme s tím, co zbyde po ní.
  const reserveAfter = Math.max(0, state.savings.totalSavings - (isBuying ? effectiveDownPayment(state) : 0));

  // Schodek se počítá po fázích, protože během mateřské bývá výrazně menší
  // než potom. Součet přes fáze je jediné poctivé číslo; `shortfallPerMonth`
  // je nejhorší měsíc, aby se dalo říct „až tolik".
  let shortfallTotal = 0;
  let shortfallPerMonth = 0;
  let monthsUntilReserveGone = 0;
  let reserveLeft = reserveAfter;
  let reserveRanOut = false;
  for (const phase of phases) {
    const disposable = incomeNow - lostSalary + phase.monthlyBenefit - relevantExpenses;
    const monthly = Math.max(0, -disposable);
    shortfallTotal += monthly * phase.months;
    shortfallPerMonth = Math.max(shortfallPerMonth, monthly);

    if (reserveRanOut) continue;
    if (monthly === 0) {
      monthsUntilReserveGone += phase.months;
      continue;
    }
    const affordable = reserveLeft / monthly;
    if (affordable >= phase.months) {
      monthsUntilReserveGone += phase.months;
      reserveLeft -= monthly * phase.months;
    } else {
      monthsUntilReserveGone += Math.floor(affordable);
      reserveLeft = 0;
      reserveRanOut = true;
    }
  }

  const monthsCovered = shortfallTotal > 0 ? monthsUntilReserveGone : null;
  const coversWholeLeave = shortfallTotal === 0 || reserveAfter >= shortfallTotal;
  const reserveLeftAfterLeave = Math.max(0, reserveAfter - shortfallTotal);
  const runwayMonthsAfterLeave = relevantExpenses > 0
    ? reserveLeftAfterLeave / relevantExpenses
    : Infinity;

  return {
    parent: pl.parent,
    durationMonths: pl.durationMonths,
    monthlyBenefit: Math.round(avgBenefit),
    phases,
    lostSalary,
    incomeNow,
    incomeDuringLeave,
    disposableNow,
    disposableDuringLeave,
    disposableDuringLeaveAfterPurchase,
    savingsLostTotal,
    reserveAfter,
    shortfallPerMonth,
    shortfallTotal,
    monthsCovered,
    coversWholeLeave,
    reserveLeftAfterLeave,
    runwayMonthsAfterLeave,
  };
}

// Je scénář rodičovské relevantní (cíl dítě + pár/rodina se dvěma příjmy)?
export function parentalLeaveApplicable(state: WizardState): boolean {
  const twoIncomes = (state.income.person2NetMonthly ?? 0) > 0;
  return state.goals.includes('child') && (state.mode === 'couple' || state.mode === 'family') && twoIncomes;
}
