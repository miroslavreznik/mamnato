import type { WizardState } from '../types';
import { plannedChildren } from './childCost';

/**
 * Jak se cíle jmenují směrem k uživateli.
 *
 * Bylo to rozepsané na třech místech (readiness, přepínače v „Co kdyby",
 * záložka), pokaždé trochu jinak. Sem patří jedno znění a odsud si ho berou
 * všechna tři.
 */
export const GOAL_LABELS: Record<string, string> = {
  property: 'Vlastní bydlení',
  reserve: 'Nouzová rezerva',
  retirement: 'Důchod',
  child: 'Dítě',
};

/**
 * Jak se cíl „dítě" jmenuje podle počtu dětí v plánu.
 *
 * Kdo si v kartě nastaví dvě děti, platí dvojnásobné náklady, ale všude
 * kolem četl „Dítě" v jednotném čísle: v záložce, v přepínači v Co kdyby
 * i na časové ose. Číslo se propsalo, slovo ne.
 */
export function childGoalLabel(state: WizardState): string {
  return plannedChildren(state) > 1 ? 'Děti' : GOAL_LABELS.child;
}

/** Jméno vlastního cíle, nebo náhrada, když ho uživatel nepojmenoval. */
export function customGoalName(state: WizardState, index: number): string {
  const goal = state.customGoals?.[index];
  const name = goal?.name.trim();
  return name || `Vlastní cíl ${index + 1}`;
}

/** Nejvýš takhle dlouhý smí být popisek záložky, jinak se vejde na řádek sám. */
const MAX_TAB_LABEL = 22;

/**
 * Popisek záložky s plánovači cílů.
 *
 * Dřív se jmenovala „Ostatní cíle", což je kategorie, ne obsah: uživatel
 * z ní nepoznal, jestli tam najde důchod, dítě, nebo obojí. Když jsou cíle
 * jeden nebo dva, jmenuje se záložka rovnou po nich; u tří a víc, nebo když
 * by se dlouhý název vlastního cíle nevešel, se sáhne po obecném názvu.
 * Bydlení mezi ně nepatří, to má vlastní záložku.
 */
export function goalsTabLabel(state: WizardState): string {
  const names: string[] = [];
  if (state.goals.includes('reserve')) names.push(GOAL_LABELS.reserve);
  if (state.goals.includes('child')) names.push(childGoalLabel(state));
  if (state.goals.includes('retirement')) names.push(GOAL_LABELS.retirement);
  if (state.goals.includes('other')) {
    (state.customGoals ?? []).forEach((_, i) => names.push(customGoalName(state, i)));
  }

  if (names.length === 0) return 'Cíle';
  const label = names.length === 1
    ? names[0]
    : names.length === 2
      // Druhý v řadě už není začátek věty, takže malé písmeno.
      ? `${names[0]} a ${names[1].charAt(0).toLowerCase()}${names[1].slice(1)}`
      : '';
  return label && label.length <= MAX_TAB_LABEL ? label : 'Vaše cíle';
}
