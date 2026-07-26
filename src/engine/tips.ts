import type { WizardState } from '../types';
import { MIN_RESERVE_MONTHS_AFTER_PURCHASE, type GoalReadiness } from './readiness';
import type { BudgetView } from './budget';
import type { LeaveImpact } from './parentalLeave';
import type { OverallStatusKey } from './verdict';
import { evaluateScenario } from './scenarios';
import { postPurchaseRunwayMonths } from './mortgage';
import { czk } from './format';

/**
 * Rady „co můžete udělat" pod verdiktem.
 *
 * Skládají se ve stejném pořadí, v jakém uživatel čte odpověď: nejdřív to,
 * co blokuje verdikt, pak konkrétní rada k bydlení a nakonec cíle, které
 * nevycházejí. Dřív se tipy skládaly a hned nato je u každého, kdo měl
 * nemovitost mezi cíli, přepsal scénář nemovitosti. Domácnost tak dostala
 * verdikt „po koupi vám na cíle nezbyde" a pod ním radu „mějte stranou
 * nouzový fond", tedy odpověď na úplně jinou otázku, a cíl „na důchod
 * nespoříte nic" nedostal radu vůbec žádnou.
 */

// Kolik rad má smysl ukázat. Víc už nikdo nečte a ty důležité v tom zapadnou.
const MAX_TIPS = 4;

const BUDGET_TIPS = [
  'Projděte výdaje po kategoriích a hledejte, kde se dá ubrat. Nejčastěji předplatná, pojistky, doprava.',
  'Zvažte možnosti navýšení příjmu (změna práce, vedlejší příjem, návrat z rodičovské).',
];

// Rada k cíli, který nevychází. Klíč je `GoalReadiness.key`.
function goalTip(goal: GoalReadiness): string | null {
  if (goal.status === 'good') return null;
  switch (goal.key) {
    case 'retirement':
      return goal.status === 'warning'
        ? 'Na důchod zatím nejde nic. Nastavte si částku v sekci Ostatní cíle, u dlouhého horizontu udělá i tisícovka měsíčně velký rozdíl.'
        : 'Renta z důchodového spoření zatím vyjde spíš na přilepšení. Pomůže navýšit měsíční částku, každá tisícovka se za desítky let znásobí.';
    case 'child':
      return 'Na náklady spojené s dítětem zatím neodkládáte nic. Částku nastavíte v sekci Ostatní cíle.';
    case 'other':
      return 'U vlastních cílů se nestíhají všechny termíny. Upravte částku nebo termín u toho, který nevychází.';
    default:
      return null;
  }
}

export function buildTips(
  state: WizardState,
  status: OverallStatusKey,
  goals: GoalReadiness[],
  budget: BudgetView | null,
  budgetAfter: BudgetView | null,
  leave: LeaveImpact | null
): string[] {
  // Záporný rozpočet přebíjí všechno ostatní: dokud nejsou příjmy nad výdaji,
  // nemá smysl radit s cíli.
  if (status === 'fix_budget') return BUDGET_TIPS;

  const tips: string[] = [];

  // 1. Co blokuje verdikt.
  if (budget && !budget.fits) {
    tips.push('Cíle se nevejdou do toho, co vám měsíčně zbývá. Upravte částky u cílů níže, nebo prodlužte jejich horizont.');
  } else if (budgetAfter && !budgetAfter.fits) {
    tips.push(`Po koupi by rozpočet nevyšel, chybělo by ${czk(Math.abs(budgetAfter.surplus))} měsíčně. Pomůže levnější nemovitost, vyšší akontace nebo delší splatnost.`);
  }

  // 2. Konkrétní rady k bydlení ze scénáře. Berou se jen tehdy, když bydlení
  //    opravdu drhne; komu vychází, tomu by radily k neexistujícímu problému.
  //    Nejvýš dvě, jinak bydlení zabere celý seznam a na ostatní cíle
  //    nezbyde místo, i když nevycházejí.
  const property = goals.find((g) => g.key === 'property');
  if (property && property.status !== 'good') {
    tips.push(...evaluateScenario(state).tips.slice(0, 2));
  }

  // 3. Rezerva po zaplacení akontace. Výchozí nastavení dává do akontace
  //    všechny úspory, takže domácnosti po koupi nezbyde nic na nečekané
  //    výdaje. Appka to dřív říkala jen šedým číslem v dlaždici.
  if (property && postPurchaseRunwayMonths(state) < MIN_RESERVE_MONTHS_AFTER_PURCHASE) {
    tips.push(`Po zaplacení akontace by vám nezbyla rezerva na nečekané výdaje. Nechte si stranou ${MIN_RESERVE_MONTHS_AFTER_PURCHASE} až 6 měsíců výdajů a dejte do akontace míň, posuvníkem v sekci Bydlení.`);
  }

  // 4. Cíle, které nevycházejí. Bez tohohle kroku zůstal cíl bez rady.
  for (const goal of goals) {
    const tip = goalTip(goal);
    if (tip) tips.push(tip);
  }

  // 5. Když nic nedrhne, radí se, co s volným prostorem.
  if (tips.length === 0) {
    tips.push(
      status === 'good'
        ? 'Máte prostor: zvažte navýšení spoření nebo investování volné rezervy pro rychlejší růst.'
        : 'Vytvořte si nouzový fond na 3–6 měsíců výdajů, dodá rozpočtu odolnost.',
      'Držte si nouzový fond 3–6 měsíců výdajů pro nečekané situace.'
    );
  }

  // Rodičovská: rada se liší podle toho, jestli na schodek máte z čeho brát.
  // Radit „počítejte s rezervou" někomu, komu rezerva schodek pokryje třikrát,
  // vypadá, že jsme si vlastní čísla nepřečetli.
  //
  // Drží si vlastní místo na konci seznamu. Kdyby se ořezávala spolu s ostatními,
  // vypadla by komukoli s nemovitostí, protože scénář bydlení přidá tři rady.
  const leaveTips: string[] = [];
  if (leave && leave.shortfallPerMonth > 0) {
    leaveTips.push(
      leave.coversWholeLeave
        ? `Během rodičovské budete rozpočet dotovat z úspor, celkem asi ${czk(leave.shortfallTotal)}. Počítejte s tím, že o tuhle částku se rezerva ztenčí, a nespoléhejte na ni zároveň jako na nouzový fond.`
        : 'Během rodičovské klesne příjem a rozpočet by se v tomto období dostal do mínusu, na který rezerva nestačí. Počítejte s došetřením, levnější nemovitostí nebo kratší rodičovskou.'
    );
  }

  return [...tips.slice(0, MAX_TIPS - leaveTips.length), ...leaveTips];
}
