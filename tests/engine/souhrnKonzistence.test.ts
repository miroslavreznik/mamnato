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
import { evaluateParentalLeave, leavePhases, benefitEstimate } from '../../src/engine/parentalLeave';
import { downPaymentTradeoff, reserveMonthsForTradeoff } from '../../src/engine/downPayment';
import { evaluateTaxRelief } from '../../src/engine/taxRelief';
import { buildAssumptions } from '../../src/engine/assumptions';
import { paymentAtRate } from '../../src/engine/rateGuidance';
import { wealthTimeline, downPaymentTarget } from '../../src/engine/wealthTimeline';
import { goalProgress } from '../../src/engine/savings';
import { discretionaryBreakdownTotal } from '../../src/engine/discretionary';
import { plannedChildren } from '../../src/engine/childCost';
import { mortgagePayment, mortgageRate, effectiveDownPayment, loanAmount, ownershipCosts } from '../../src/engine/mortgage';
import { czk, monthYearIn } from '../../src/engine/format';
import { retirementProjection, retirementStartingCapital, yearsUntilRetirement, retirementAge, retirementReturn, SAFE_WITHDRAWAL_RATE } from '../../src/engine/savings';
import { DEFAULTS, CHILD_COSTS_CZ } from '../../src/engine/defaults';
import { calculateChildCosts } from '../../src/engine/childCost';
import { ltv } from '../../src/engine/rateGuidance';
import { previewData } from '../../src/engine/preview';
import { totalMonthlyIncome } from '../../src/engine/cashflow';

/** Jen číslice: český formát používá úzkou nezlomitelnou mezeru. */
const reserveDigits = (t: string) => t.replace(/\D/g, '');
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

/**
 * Seznam všech kontrol. Slouží dvěma věcem naráz: je to dokumentace toho,
 * co se hlídá, a zároveň pojistka, že žádná kontrola neběží naprázdno.
 */
const EXPECTED_RULES = [
  'rezerva: dlaždice vs. cíl',
  'rezerva: hotová vs. verdikt',
  'rezerva: věta vs. výpočet',
  'rezerva: krok vs. cíl',
  'akontace: dlaždice vs. stuha',
  'akontace: krok vs. dlaždice',
  'akontace: základ proužku',
  'graf spoření vs. dlaždice',
  'posuvník akontace: rezerva',
  'posuvník akontace: práh',
  'splátka: posuvník sazby',
  'předpoklady: akontace',
  'předpoklady: výše hypotéky',
  'předpoklady: vlastnictví',
  'daně: počet dětí',
  'rozpočet: cíle vs. toky',
  'rozpočet: zbytné vs. rozpis',
  'rodičovská: řádek a výpočet',
  'rodičovská: fáze vs. průměr',
  'vlastní cíle: počet',
  'nejnižší bod: karta vs. stuha',
  'kalendář: nadpis vs. termín',
  'dítě: rozpočet vs. karta',
  'důchod: renta ve větě',
  'LTV: základ',
  'náhled: příjem a zbytek',
];

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
  ['other'],
  ['property', 'other'],
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
  // Vlastní cíle a podrobný rozpis zbytných výdajů, aby i kontroly kolem
  // nich měly na čem běžet.
  for (const { tag, state } of [...out]) {
    if (!state.goals.includes('other')) continue;
    out.push({
      tag: `${tag}+cíle`,
      state: {
        ...state,
        customGoals: [
          { id: 'a', name: 'Auto', targetAmount: 400000, targetMonths: 36 },
          { id: 'b', name: 'Svatba', targetAmount: 250000, targetMonths: 18 },
        ],
      },
    });
  }
  out.push({
    tag: '[rozpis zbytných výdajů]',
    state: base({
      goals: ['property', 'reserve'],
      expenses: {
        ...base().expenses,
        other: 4200,
        discretionaryBreakdown: { 'travel.abroad': 2000, 'fun.eating': 1500, 'subs.streaming': 700 },
      },
    }),
  });
  // Pár okrajů navíc: samoživitel, splátky úvěrů, nedostupná hypotéka.
  out.push({ tag: '[jednotlivec]', state: base({ mode: 'individual', goals: ['property', 'reserve'], income: { person1NetMonthly: 42000 } }) });
  out.push({ tag: '[stávající úvěry]', state: base({ goals: ['property', 'reserve'], expenses: { ...base().expenses, existingLoans: 9000 } }) });
  out.push({ tag: '[drahá nemovitost]', state: base({ goals: ['property', 'reserve'], property: { targetPrice: 14000000, mortgageRate: 0.048, loanTermYears: 30 } }) });
  return out;
}

/**
 * Kolikrát která kontrola opravdu proběhla.
 *
 * Bez toho je test k ničemu: kontrola schovaná za podmínkou, kterou žádný
 * scénář nesplní, mlčky prochází. Přesně to se stalo u předpokladů, kde se
 * hledal řádek „Odhadovaná splátka", který v kartě nikdy nebyl.
 */
export const ruleRuns = new Map<string, number>();

/** Sesbírá rozpory místo toho, aby spadl na prvním: chceme vidět celý obrázek. */
function auditAll(): string[] {
  ruleRuns.clear();
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
    /** Kontrola proběhla: `ok` říká, jestli dopadla dobře. */
    const rule = (name: string, ok: boolean, detail: () => string) => {
      ruleRuns.set(name, (ruleRuns.get(name) ?? 0) + 1);
      if (!ok) fail(name, detail());
    };

    // Dlaždice „Rezerva vydrží" a cíl rezervy měří totéž.
    const runwayTile = buying ? postPurchaseRunwayMonths(state) : emergencyRunwayMonths(state);
    if (reserveRow) {
      rule('rezerva: dlaždice vs. cíl', Math.abs(runwayTile - reserve.monthsCovered) <= 0.01,
        () => `dlaždice ${runwayTile.toFixed(2)}, cíl ${reserve.monthsCovered.toFixed(2)}`);
    }

    // Hotová rezerva a verdikt „ale bez rezervy" se vylučují.
    if (reserveRow && reserve.done) {
      rule('rezerva: hotová vs. verdikt', !summary.verdict.qualifier.includes('bez rezervy'),
        () => `„${reserveRow.headline}" vs. „${summary.verdict.qualifier}"`);
    }

    // Kolik rezerva vydrží podle věty a podle výpočtu.
    if (reserveRow && reserve.done) {
      const stated = reserveRow.headline.match(/vystačí na ([\d]+) měs/);
      if (stated) {
        rule('rezerva: věta vs. výpočet', Math.abs(Number(stated[1]) - reserve.monthsCovered) <= 1,
          () => `věta ${stated[1]}, výpočet ${reserve.monthsCovered.toFixed(1)}`);
      }
    }

    if (buying) {
      // Termín akontace v dlaždici a měsíc koupě na stuze.
      const tileMonths = monthsUntilDownPaymentReady(state, alloc);
      if (downPaymentGap(state) > 0 && path.earliestPurchaseMonth !== null && isFinite(tileMonths)) {
        rule('akontace: dlaždice vs. stuha', Math.abs(tileMonths - path.earliestPurchaseMonth) <= 1,
          () => `dlaždice ${tileMonths}, stuha ${path.earliestPurchaseMonth}`);
      }

      // Proužek pokrytí a chybějící částka měří proti témuž základu.
      // Proužek pokrytí i mezera musí měřit proti celé investici. Kdyby se
      // jedno z nich vrátilo k holé ceně, u rekonstrukce se rozejdou.
      const meterBase = requiredDownPayment(totalProjectCost(state), downPaymentFraction(state));
      const gapBase = effectiveDownPayment(state) + downPaymentGap(state);
      rule('akontace: základ proužku', Math.abs(meterBase - gapBase) < 1 || downPaymentGap(state) === 0,
        () => `proužek ${meterBase}, mezera+akontace ${gapBase}`);

      // Krok „A co teď" slibuje týž termín jako dlaždice.
      // Obojí staví na `monthsUntilDownPaymentReady`, takže musí sedět
      // na měsíc; kdyby se jedno z nich vrátilo k dělení, rozejdou se.
      if (step.key === 'down_payment' && step.monthly && isFinite(tileMonths) && path.earliestPurchaseMonth !== null) {
        rule('akontace: krok vs. dlaždice', Math.abs(tileMonths - path.earliestPurchaseMonth) <= 1,
          () => `krok/dlaždice ${tileMonths}, stuha ${path.earliestPurchaseMonth}`);
      }
    }

    // „Cíle z toho vezmou X" v rozpočtu a součet toků na cíle.
    const budget = summary.budget;
    if (budget) {
      const flows = incomeFlow(state, alloc, false).goals.reduce((t, g) => t + g.amount, 0);
      rule('rozpočet: cíle vs. toky', Math.abs(budget.allocated - flows) <= 1,
        () => `rozpočet ${budget.allocated}, toky ${flows}`);
    }

    // Krok u rezervy míří na tutéž cílovou částku jako karta cíle.
    if (step.key === 'reserve') {
      rule('rezerva: krok vs. cíl', step.action.replace(/[^\d]/g, '').includes(String(reserve.target)),
        () => `krok „${step.action}", cíl ${reserve.target}`);
    }

    // Nejnižší bod na stuze a v kartě nejtěsnějšího místa.
    const lowest = path.events.find((e) => e.key === 'lowest');
    // Obě znění věty, aby se kontrola nedala obejít přeformulováním.
    const inCard = path.tightest?.explanation.match(/(?:klesnou na|pod dnešních) ([^K]+)Kč/);
    if (lowest && inCard) {
      const card = Number(inCard[1].replace(/\D/g, ''));
      const bar = Number(lowest.label.replace(/\D/g, ''));
      rule('nejnižší bod: karta vs. stuha', Math.abs(card - bar) <= 1, () => `karta ${card}, stuha ${bar}`);
    }

    // Rok v nadpisu nejtěsnějšího místa a termín počítaný z data.
    // Obojí se v Přehledu potkává: „Nejníže 2028" nad „hotovo v dubnu 2028".
    const titleYear = path.tightest?.title.match(/(20\d\d)/);
    if (titleYear && path.tightest) {
      rule('kalendář: nadpis vs. termín', titleYear[1] === monthYearIn(path.tightest.month).slice(-4),
        () => `nadpis „${path.tightest!.title}", termín ${monthYearIn(path.tightest!.month)}`);
    }

    // Věta o rodičovské a stav rodičovské v enginu.
    const leaveRow = summary.goals.find((g) => g.key === 'leave');
    const leave = evaluateParentalLeave(state);
    rule('rodičovská: řádek a výpočet', !!leaveRow === !!leave,
      () => (leaveRow ? `řádek bez výpočtu: ${leaveRow.headline}` : 'výpočet bez řádku u cílů'));

    // ---- Bydlení -------------------------------------------------------
    if (buying) {
      // Graf „Vývoj úspor v čase" míří na tutéž cílovou částku jako mezera
      // i časová osa. Dřív počítal z holé ceny bez rekonstrukce.
      const chartTarget = downPaymentTarget(state);
      const reachesAt = wealthTimeline(state, { months: 120, allocations: alloc })
        .points.find((pt) => pt.downPaymentFund >= chartTarget)?.month;
      const tileMonths2 = monthsUntilDownPaymentReady(state, alloc);
      if (reachesAt !== undefined && isFinite(tileMonths2)) {
        rule('graf spoření vs. dlaždice', Math.abs(reachesAt - tileMonths2) <= 1,
          () => `graf ${reachesAt}, dlaždice ${tileMonths2}`);
      }

      // Posuvník akontace měří rezervu po koupi stejně jako dlaždice.
      const tradeoff = downPaymentTradeoff(state);
      rule('posuvník akontace: rezerva', Math.abs(tradeoff.reserveMonths - postPurchaseRunwayMonths(state)) <= 0.01,
        () => `${tradeoff.reserveMonths.toFixed(2)} vs. ${postPurchaseRunwayMonths(state).toFixed(2)}`);
      // A hlídá tolik měsíců, kolik si uživatel u cíle rezervy nastavil.
      if (state.goals.includes('reserve')) {
        rule('posuvník akontace: práh', reserveMonthsForTradeoff(state) === reserve.targetMonths,
          () => `${reserveMonthsForTradeoff(state)} vs. cíl ${reserve.targetMonths}`);
      }

      // Splátka je jedna, ať se na ni ptá kdokoli.
      rule('splátka: posuvník sazby', Math.abs(paymentAtRate(state, mortgageRate(state)) - mortgagePayment(state)) <= 0.01,
        () => `${paymentAtRate(state, mortgageRate(state))} vs. ${mortgagePayment(state)}`);

      // Předpoklady citují tytéž částky, ze kterých počítá zbytek.
      const rows = buildAssumptions(state);
      const row = (label: string) => rows.find((r) => r.label === label)?.value ?? '';
      const digits = (t: string) => t.replace(/\D/g, '');
      rule('předpoklady: akontace', digits(row('Akontace z vlastních peněz')).startsWith(digits(czk(effectiveDownPayment(state)))),
        () => `${row('Akontace z vlastních peněz')} vs. ${czk(effectiveDownPayment(state))}`);
      rule('předpoklady: výše hypotéky', digits(row('Výše hypotéky')) === digits(czk(loanAmount(state))),
        () => `${row('Výše hypotéky')} vs. ${czk(loanAmount(state))}`);
      rule('předpoklady: vlastnictví', digits(row('Náklady na vlastnictví')) === digits(czk(ownershipCosts(state))),
        () => `${row('Náklady na vlastnictví')} vs. ${czk(ownershipCosts(state))}`);

      // Daňové zvýhodnění zná tolik dětí, kolik jich plán počítá.
      const relief = evaluateTaxRelief(state);
      const planned = state.goals.includes('child') ? plannedChildren(state) : 0;
      if (relief) {
        rule('daně: počet dětí', relief.plannedChildren === planned,
          () => `${relief.plannedChildren} vs. ${planned}`);
      }
    }

    // ---- Cíle ----------------------------------------------------------
    // Dávky během volna: karta rodičovské a odhad, ze kterého počítá verdikt.
    if (leave) {
      const phases = leavePhases(state);
      const months = phases.reduce((t, ph) => t + ph.months, 0);
      const weighted = Math.round(phases.reduce((t, ph) => t + ph.monthlyBenefit * ph.months, 0) / Math.max(1, months));
      const suggested = benefitEstimate(state)?.value ?? 0;
      rule('rodičovská: fáze vs. průměr', Math.abs(weighted - suggested) <= 1,
        () => `fáze ${weighted}, odhad ${suggested}`);
    }

    // Vlastní cíle: stav v přehledu a postup v kartě z téže funkce.
    const customRow = summary.goals.find((g) => g.key === 'other');
    if (customRow && (state.customGoals ?? []).length > 0) {
      const goals = state.customGoals ?? [];
      const achievable = goals.filter((g, i) => goalProgress(g, alloc.custom[i] ?? 0).achievable).length;
      rule('vlastní cíle: počet', customRow.headline.startsWith(`${achievable} z `),
        () => `„${customRow.headline}", spočteno ${achievable}`);
    }

    // Dítě: co jde do rozpočtu a co ukazuje karta při plném horizontu.
    // Karta si horizont grafu mění sama, ale plný horizont musí dát totéž.
    if (state.goals.includes('child')) {
      const uni = state.childCosts?.includeUniversity ?? false;
      const card = calculateChildCosts(
        plannedChildren(state), uni ? 26 : 18, uni,
        Object.fromEntries(CHILD_COSTS_CZ.map((r) => [r.label, state.childCosts?.byAge?.[r.label] ?? r.monthlyCost]))
      ).monthlyAverage;
      rule('dítě: rozpočet vs. karta', Math.abs(card - alloc.child) <= 1,
        () => `karta ${card}, rozpočet ${alloc.child}`);
    }

    // Důchod: renta ve větě v Přehledu z týchž vstupů jako karta v Cílech.
    const retirementRow = summary.goals.find((g) => g.key === 'retirement');
    if (retirementRow && alloc.retirement > 0) {
      const years = yearsUntilRetirement(retirementAge(state));
      const projection = retirementProjection(
        alloc.retirement, years, retirementReturn(state), DEFAULTS.averageCzInflation,
        retirementStartingCapital(state)
      );
      const rent = (projection[projection.length - 1]?.portfolioValue ?? 0) * SAFE_WITHDRAWAL_RATE / 12;
      rule('důchod: renta ve větě', reserveDigits(retirementRow.headline).includes(reserveDigits(czk(rent))),
        () => `věta „${retirementRow.headline}", spočteno ${czk(rent)}`);
    }

    // LTV se počítá z celé investice, stejně jako výše hypotéky.
    if (buying) {
      rule('LTV: základ', Math.abs(ltv(state) - loanAmount(state) / totalProjectCost(state)) < 1e-9,
        () => `${ltv(state)} vs. ${loanAmount(state) / totalProjectCost(state)}`);
    }

    // Průběžný náhled v průvodci počítá z týchž čísel jako výsledky.
    const preview = previewData(state);
    const budgetDisposable = budget ? budget.disposable : preview.disposable;
    rule('náhled: příjem a zbytek',
      preview.income === totalMonthlyIncome(state) && Math.abs(preview.disposable - budgetDisposable) < 1,
      () => `náhled ${preview.income}/${preview.disposable}, rozpočet ${budgetDisposable}`);

    // ---- Rozpočet ------------------------------------------------------
    // Souhrnná položka zbytných výdajů je součtem podrobného rozpisu.
    const breakdown = state.expenses.discretionaryBreakdown;
    if (breakdown) {
      rule('rozpočet: zbytné vs. rozpis', Math.abs(discretionaryBreakdownTotal(breakdown) - state.expenses.other) <= 1,
        () => `${state.expenses.other} vs. ${discretionaryBreakdownTotal(breakdown)}`);
    }
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

  it('žádná kontrola není mrtvá', () => {
    // Kontrola schovaná za podmínkou, kterou žádný scénář nesplní, mlčky
    // prochází a tváří se jako pokrytí. Stalo se to hned napoprvé:
    // v předpokladech se hledal řádek „Odhadovaná splátka", který tam nikdy
    // nebyl, takže se ta kontrola nikdy nespustila.
    auditAll();
    const dead = EXPECTED_RULES.filter((r) => (ruleRuns.get(r) ?? 0) === 0);
    expect(dead, `mrtvé kontroly: ${dead.join(', ')}`).toEqual([]);
    // A naopak: co běží, musí být v seznamu, ať se nová kontrola nezapomene
    // dopsat do dokumentace v hlavičce souboru.
    const unknown = [...ruleRuns.keys()].filter((r) => !EXPECTED_RULES.includes(r));
    expect(unknown, `kontrola mimo seznam: ${unknown.join(', ')}`).toEqual([]);
  });
});
