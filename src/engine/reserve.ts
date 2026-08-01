import type { WizardState } from '../types';
import { necessaryMonthlyExpenses } from './cashflow';
import { effectiveDownPayment, necessaryExpensesAfterPurchase } from './mortgage';

/**
 * Nouzová rezerva jako sledovaný cíl.
 *
 * Slovníček appky o ní říká, že je to první věc, kterou má smysl mít hotovou,
 * dřív než cokoli jiného. Přesto to dlouho nebyl cíl: karta „A co teď" ji uměla
 * doporučit („postavte 128 063 Kč"), ale nešlo ji zapnout, vidět na časové ose
 * ani v rozpočtu vedle důchodu a dítěte. Doporučení bez místa v plánu se čte
 * jako poznámka pod čarou.
 *
 * Tenhle modul je jediné místo, kde se rezerva počítá. Dřív ten vzorec bydlel
 * uvnitř `nextStep`, takže se nedal použít nikde jinde, aniž by se opsal;
 * a opsané vzorce se v téhle appce už dvakrát rozešly.
 *
 * Dvě věci, na kterých u rezervy záleží víc, než se zdá:
 *
 *  - **Kdo kupuje, poměřuje se výdaji po koupi.** Splátka bývá skoro dvojnásobek
 *    nájmu, takže tatáž rezerva vydrží kratší dobu. Cíl je proto vyšší, než
 *    kdyby se počítal z dnešních výdajů.
 *  - **Co už je stranou, se nepočítá dvakrát.** U kupujícího je „současná
 *    rezerva" to, co po zaplacení akontace zbyde, ne celé úspory. Akontace
 *    je jiné peníze; hned po koupi leží ve zdech.
 */

/**
 * Kolik měsíců nezbytných výdajů má rezerva pokrýt, když si uživatel nic
 * nezvolí. Tři měsíce jsou obvyklé minimum, ne cíl; kdo má nejistý příjem,
 * má sáhnout výš, a proto to jde v kartě přepsat.
 */
export const DEFAULT_RESERVE_MONTHS = 3;

/** Nad rok už to není nouzová rezerva, ale spořicí cíl sám o sobě. */
export const MAX_RESERVE_MONTHS = 12;

export interface ReserveStatus {
  /** Poměřuje se výdaji po koupi? (Tedy je mezi cíli nemovitost.) */
  afterPurchase: boolean;
  /** Nezbytné výdaje za měsíc, na které má rezerva stačit. */
  monthlyNeed: number;
  /** Na kolik měsíců má rezerva vystačit. */
  targetMonths: number;
  /** Cílová částka. */
  target: number;
  /** Kolik je stranou dnes (u kupujícího: co zbyde po akontaci). */
  current: number;
  /** Kolik do cíle chybí. Nula znamená hotovo. */
  gap: number;
  /** Na kolik měsíců současná rezerva vystačí. */
  monthsCovered: number;
  done: boolean;
}

/** Zvolený počet měsíců, s mezemi, ať uložený nesmysl nerozhodí plán. */
export function reserveTargetMonths(state: WizardState): number {
  const months = state.reserveMonths;
  return typeof months === 'number' && Number.isFinite(months)
    ? Math.min(MAX_RESERVE_MONTHS, Math.max(1, Math.round(months)))
    : DEFAULT_RESERVE_MONTHS;
}

/**
 * Stav nouzové rezervy.
 *
 * Počítá se i tehdy, když cíl zapnutý není: `nextStep` z toho dělá doporučení
 * a připravenost bydlení z toho hlídá, jestli po koupi vůbec něco zbyde.
 */
export function reserveStatus(state: WizardState): ReserveStatus {
  const buying = state.goals.includes('property');
  const monthlyNeed = buying
    ? necessaryExpensesAfterPurchase(state)
    : necessaryMonthlyExpenses(state);
  const targetMonths = reserveTargetMonths(state);
  const target = Math.round(Math.max(0, monthlyNeed) * targetMonths);
  const current = Math.round(Math.max(0, buying
    ? state.savings.totalSavings - effectiveDownPayment(state)
    : state.savings.totalSavings));
  return {
    afterPurchase: buying,
    monthlyNeed,
    targetMonths,
    target,
    current,
    gap: Math.max(0, target - current),
    monthsCovered: monthlyNeed > 0 ? current / monthlyNeed : Infinity,
    done: current >= target,
  };
}

/**
 * Za jak dlouho bude rezerva plná při daném měsíčním odkládání.
 *
 * Nula měsíčně znamená nekonečno, ne „spadni na disponibilní částku": jako
 * slíbený termín by to lhalo úplně stejně jako u akontace.
 */
export function monthsToFillReserve(state: WizardState, monthly: number): number {
  const { gap } = reserveStatus(state);
  if (gap <= 0) return 0;
  if (monthly <= 0) return Infinity;
  return Math.ceil(gap / monthly);
}
