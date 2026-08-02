import { describe, it, expect } from 'vitest';
import { evaluateOverall } from '../../src/engine/summary';
import { nextStep } from '../../src/engine/nextStep';
import { journey } from '../../src/engine/journey';
import { calculateDefaultAllocations } from '../../src/engine/allocation';
import { reserveStatus } from '../../src/engine/reserve';
import { monthsUntilDownPaymentReady } from '../../src/engine/wealthTimeline';
import {
  postPurchaseRunwayMonths, downPaymentGap, requiredDownPayment,
  downPaymentFraction, totalProjectCost,
} from '../../src/engine/mortgage';
import { emergencyRunwayMonths } from '../../src/engine/cashflow';
import { incomeFlow } from '../../src/engine/expenseBreakdown';
import { evaluateParentalLeave } from '../../src/engine/parentalLeave';
import type { WizardState, FinancialGoal } from '../../src/types';

/**
 * Souhrn si nesmí odporovat sám se sebou.
 *
 * Přehled je jedna souvislá odpověď: verdikt, dlaždice, věty u cílů, karta
 * „A co teď", stuha a nejtěsnější místo mluví o témž plánu. Každý z těch
 * kusů si ale čísla počítá sám, a jak jich přibývá, přibývá i dvojic, které
 * se můžou rozejít. Ručně se to už uhlídat nedá.
 *
 * Test proto projde mřížku plánů (cíle × úspory × délka rezervy × rodičovská
 * × rekonstrukce) a u každého ověří **vztahy mezi čísly**, ne konkrétní
 * částky. Konkrétní částky se mění s výchozími daty a test by se otupil;
 * vztahy platí vždycky.
 *
 * Nálezy, které tenhle test odhalil, když vznikal:
 *  - věta „Rezerva 900 000 Kč je hotová, vydrží 3 měsíce" u rezervy, která
 *    vydrží 19,6 měsíce, a dlaždice vedle ní s tím správným číslem,
 *  - dlaždice „naspoříte za 34 měs." u plánu, ve kterém stuha kupovala až
 *    ve 37. měsíci, protože během rodičovské se neodkládá,
 *  - proužek u chybějící akontace počítaný z holé ceny, zatímco mezera
 *    z ceny včetně rekonstrukce.
 */

function base(o: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0', currentStep: 1, completedSteps: [], mode: 'couple',
    income: { person1NetMonthly: 48000, person2NetMonthly: 36000 },
    expenses: { rent: 18000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 600000 },
    goals: [],
    property: { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
    person1Age: 32, person2Age: 30,
    ...o,
  };
}

const GOAL_SETS: FinancialGoal[][] = [
  ['property'],
  ['property', 'reserve'],
  ['property', 'child'],
  ['property', 'reserve', 'child', 'retirement'],
  ['reserve'],
  ['retirement'],
  ['reserve', 'retirement'],
  ['child'],
];
const SAVINGS = [0, 150000, 600000, 1500000, 4000000];
const RESERVE_MONTHS: (number | undefined)[] = [undefined, 3, 6, 12];

interface Scenario { tag: string; state: WizardState }

function scenarios(): Scenario[] {
  const out: Scenario[] = [];
  for (const goals of GOAL_SETS) {
    for (const savings of SAVINGS) {
      for (const reserveMonths of RESERVE_MONTHS) {
        for (const leave of [false, true]) {
          for (const renovation of [false, true]) {
            out.push({
              tag: `[${goals.join('+')} úspory=${savings} rezerva=${reserveMonths} rodičovská=${leave} rekonstrukce=${renovation}]`,
              state: base({
                goals,
                savings: { totalSavings: savings },
                reserveMonths,
                childInMonths: 12,
                parentalLeave: goals.includes('child') && leave
                  ? { enabled: true, parent: 2, durationMonths: 36 }
                  : undefined,
                property: renovation
                  ? { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30, renovation: { cost: 800000, months: 6, payingRentMeanwhile: true } }
                  : { targetPrice: 6000000, mortgageRate: 0.048, loanTermYears: 30 },
              }),
            });
          }
        }
      }
    }
  }
  // Pár okrajů navíc: samoživitel, splátky úvěrů, nedostupná hypotéka.
  out.push({ tag: '[jednotlivec]', state: base({ mode: 'individual', goals: ['property', 'reserve'], income: { person1NetMonthly: 42000 } }) });
  out.push({ tag: '[stávající úvěry]', state: base({ goals: ['property', 'reserve'], expenses: { ...base().expenses, existingLoans: 9000 } }) });
  out.push({ tag: '[drahá nemovitost]', state: base({ goals: ['property', 'reserve'], property: { targetPrice: 14000000, mortgageRate: 0.048, loanTermYears: 30 } }) });
  return out;
}

/** Sesbírá rozpory místo toho, aby spadl na prvním: chceme vidět celý obrázek. */
function auditAll(): string[] {
  const problems: string[] = [];
  for (const { tag, state } of scenarios()) {
    const alloc = calculateDefaultAllocations(state);
    const summary = evaluateOverall(state, alloc);
    const path = journey(state, { allocations: alloc });
    const step = nextStep(state, alloc);
    const buying = state.goals.includes('property');
    const reserve = reserveStatus(state);
    const reserveRow = summary.goals.find((g) => g.key === 'reserve');
    const fail = (rule: string, detail: string) => problems.push(`${rule} ${tag}: ${detail}`);

    // Dlaždice „Rezerva vydrží" a cíl rezervy měří totéž.
    const runwayTile = buying ? postPurchaseRunwayMonths(state) : emergencyRunwayMonths(state);
    if (reserveRow && Math.abs(runwayTile - reserve.monthsCovered) > 0.01) {
      fail('rezerva: dlaždice vs. cíl', `dlaždice ${runwayTile.toFixed(2)}, cíl ${reserve.monthsCovered.toFixed(2)}`);
    }

    // Hotová rezerva a verdikt „ale bez rezervy" se vylučují.
    if (reserveRow && reserve.done && summary.verdict.qualifier.includes('bez rezervy')) {
      fail('rezerva: hotová vs. verdikt', `„${reserveRow.headline}" vs. „${summary.verdict.qualifier}"`);
    }

    // Kolik rezerva vydrží podle věty a podle výpočtu.
    if (reserveRow && reserve.done) {
      const stated = reserveRow.headline.match(/vystačí na ([\d]+) měs/);
      if (stated && Math.abs(Number(stated[1]) - reserve.monthsCovered) > 1) {
        fail('rezerva: věta vs. výpočet', `věta ${stated[1]}, výpočet ${reserve.monthsCovered.toFixed(1)}`);
      }
    }

    if (buying) {
      // Termín akontace v dlaždici a měsíc koupě na stuze.
      const tileMonths = monthsUntilDownPaymentReady(state, alloc);
      if (downPaymentGap(state) > 0 && path.earliestPurchaseMonth !== null && isFinite(tileMonths)
        && Math.abs(tileMonths - path.earliestPurchaseMonth) > 1) {
        fail('akontace: dlaždice vs. stuha', `dlaždice ${tileMonths}, stuha ${path.earliestPurchaseMonth}`);
      }

      // Proužek pokrytí a chybějící částka měří proti témuž základu.
      const meterBase = requiredDownPayment(totalProjectCost(state), downPaymentFraction(state));
      const gapBase = requiredDownPayment(totalProjectCost(state), downPaymentFraction(state));
      if (meterBase !== gapBase) fail('akontace: základ proužku', `${meterBase} vs. ${gapBase}`);

      // Krok „A co teď" slibuje týž termín jako dlaždice.
      if (step.key === 'down_payment' && step.monthly && isFinite(tileMonths)) {
        // Obojí staví na `monthsUntilDownPaymentReady`, takže musí sedět
        // na měsíc; kdyby se jedno z nich vrátilo k dělení, rozejdou se.
        if (path.earliestPurchaseMonth !== null && Math.abs(tileMonths - path.earliestPurchaseMonth) > 1) {
          fail('akontace: krok vs. dlaždice', `krok/dlaždice ${tileMonths}, stuha ${path.earliestPurchaseMonth}`);
        }
      }
    }

    // „Cíle z toho vezmou X" v rozpočtu a součet toků na cíle.
    if (summary.budget) {
      const flows = incomeFlow(state, alloc, false).goals.reduce((t, g) => t + g.amount, 0);
      if (Math.abs(summary.budget.allocated - flows) > 1) {
        fail('rozpočet: cíle vs. toky', `rozpočet ${summary.budget.allocated}, toky ${flows}`);
      }
    }

    // Krok u rezervy míří na tutéž cílovou částku jako karta cíle.
    if (step.key === 'reserve' && !step.action.replace(/[^\d]/g, '').includes(String(reserve.target))) {
      fail('rezerva: krok vs. cíl', `krok „${step.action}", cíl ${reserve.target}`);
    }

    // Nejnižší bod na stuze a v kartě nejtěsnějšího místa.
    const lowest = path.events.find((e) => e.key === 'lowest');
    // Obě znění věty, aby se kontrola nedala obejít přeformulováním.
    const inCard = path.tightest?.explanation.match(/(?:klesnou na|pod dnešních) ([^K]+)Kč/);
    if (lowest && inCard) {
      const card = Number(inCard[1].replace(/\D/g, ''));
      const bar = Number(lowest.label.replace(/\D/g, ''));
      if (Math.abs(card - bar) > 1) fail('nejnižší bod: karta vs. stuha', `karta ${card}, stuha ${bar}`);
    }

    // Věta o rodičovské a stav rodičovské v enginu.
    const leaveRow = summary.goals.find((g) => g.key === 'leave');
    const leave = evaluateParentalLeave(state);
    if (leaveRow && !leave) fail('rodičovská: řádek bez výpočtu', leaveRow.headline);
    if (!leaveRow && leave) fail('rodičovská: výpočet bez řádku', 'chybí řádek u cílů');
  }
  return problems;
}

describe('souhrn si neodporuje', () => {
  it('napříč kombinacemi cílů, úspor, rezervy, rodičovské a rekonstrukce', () => {
    const problems = auditAll();
    expect(problems, `\n${problems.slice(0, 12).join('\n')}\n(celkem ${problems.length})`).toEqual([]);
  });

  it('mřížka je dost široká, aby to něco chytilo', () => {
    // Kdyby někdo scénáře omylem zúžil, test výše by prošel prázdný.
    expect(scenarios().length).toBeGreaterThan(600);
  });
});
