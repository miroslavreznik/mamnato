import type { WizardState } from '../types';
import { totalMonthlyIncome, monthlyDisposable } from './cashflow';
import { expenseCategories } from './expenseBreakdown';

/**
 * Podklad pro průběžný náhled v průvodci: kam zatím teče příjem.
 *
 * Rozdělení je hrubé schválně. Osm kategorií, které zná graf rozpočtu, je
 * v průběžném náhledu k ničemu: uživatel právě vyplňuje formulář a potřebuje
 * vidět jednu věc, jestli mu něco zbývá. Podrobnosti si prohlédne na
 * výsledcích.
 *
 * Bydlení stojí zvlášť od ostatních nezbytných výdajů, protože je to skoro
 * vždycky největší položka a zároveň ta, kterou plán nejvíc řeší.
 */

export type PreviewSegmentKey = 'housing' | 'necessary' | 'discretionary' | 'free';

export interface PreviewSegment {
  key: PreviewSegmentKey;
  label: string;
  amount: number;
}

export interface PreviewData {
  income: number;
  /** Příjem minus výdaje. Záporná hodnota znamená schodek. */
  disposable: number;
  segments: PreviewSegment[];
  /**
   * Základ pro poměry v pruhu. Když výdaje přerostou příjem, je součet
   * segmentů větší než příjem a poměr vůči příjmu by přetekl přes sto
   * procent; proto se v tom případě normalizuje na součet.
   */
  total: number;
}

export function previewData(state: WizardState): PreviewData {
  const income = totalMonthlyIncome(state);
  const disposable = monthlyDisposable(state);
  const cats = expenseCategories(state, false);

  const housing = cats
    .filter((c) => c.key === 'housing')
    .reduce((sum, c) => sum + c.amount, 0);
  const necessary = cats
    .filter((c) => c.necessary && c.key !== 'housing')
    .reduce((sum, c) => sum + c.amount, 0);
  const discretionary = cats
    .filter((c) => !c.necessary)
    .reduce((sum, c) => sum + c.amount, 0);

  return {
    income,
    disposable,
    segments: [
      { key: 'housing', label: 'Bydlení a provoz', amount: housing },
      { key: 'necessary', label: 'Ostatní nezbytné', amount: necessary },
      { key: 'discretionary', label: 'Zbytné', amount: discretionary },
      { key: 'free', label: 'Zbývá', amount: Math.max(0, disposable) },
    ],
    total: Math.max(income, housing + necessary + discretionary),
  };
}

/** Barvy pruhu. Stavové, ne kategoriální: jde o poměr, ne o rozeznání položek. */
export const PREVIEW_COLORS: Record<PreviewSegmentKey, string> = {
  housing: 'bg-ink',
  necessary: 'bg-ink-body',
  discretionary: 'bg-ribbon-tense',
  free: 'bg-ribbon-calm',
};
