import { describe, it, expect } from 'vitest';
import { wealthTimeline, planHorizonMonths, MIN_HORIZON_MONTHS, MAX_HORIZON_MONTHS } from '../../src/engine/wealthTimeline';
import { monthlyMortgagePayment, loanAmount, mortgageRate, loanTermYears, ownershipCosts } from '../../src/engine/mortgage';
import { calculateDefaultAllocations, monthsToSaveAtAllocation } from '../../src/engine/allocation';
import type { WizardState } from '../../src/types';

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    version: '1.0',
    currentStep: 1,
    completedSteps: [],
    mode: 'couple',
    income: { person1NetMonthly: 45000, person2NetMonthly: 30000 },
    expenses: { rent: 15000, existingLoans: 0, insurance: 1500, food: 8000, transport: 3000, children: 0, utilities: 3500, other: 3000 },
    savings: { totalSavings: 800000 },
    goals: [],
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 30 },
    ...overrides,
  };
}

describe('wealthTimeline', () => {
  it('grows linearly by disposable when there are no events', () => {
    const state = makeState(); // income 75000, expenses 34000 → +41000/měs
    const tl = wealthTimeline(state, { months: 12 });
    expect(tl.points[0].cash).toBe(800000);
    expect(tl.points[12].cash).toBe(800000 + 41000 * 12);
    expect(tl.purchaseMonth).toBeNull();
    expect(tl.childMonth).toBeNull();
    expect(tl.firstNegativeMonth).toBeNull();
  });

  it('kupuje se z peněz vyhrazených na akontaci, ne z celého jmění', () => {
    // Chybí 200 000 Kč akontace. Volných je 41 000 Kč měsíčně, ale na
    // akontaci z nich jde jen část (výchozí rozdělení dává půlku, tedy
    // 20 500 Kč), zbytek zůstává volný. Koupě proto nastane po deseti
    // měsících, ne po pěti.
    //
    // Dřív se kupovalo, jakmile na akontaci stačilo *celé* jmění, tedy
    // i peníze odložené na důchod nebo na dítě. Na výsledcích pak stálo
    // „naspoříte za 4 roky a 4 měsíce" a stuha hned pod tím kreslila koupi
    // za rok a dva měsíce.
    const state = makeState({ goals: ['property'] }); // akontace 20 % z 5M = 1M > 800k
    const tl = wealthTimeline(state, { months: 60 });
    expect(tl.purchaseMonth).toBe(10);

    // Termín sedí s tím, co appka slibuje u chybějící akontace.
    const alloc = calculateDefaultAllocations(state);
    expect(tl.purchaseMonth).toBe(monthsToSaveAtAllocation(state, alloc.downPayment));

    // Po koupi je cash menší než před ní, akontace se odečetla.
    const m = tl.purchaseMonth!;
    expect(tl.points[m + 1].cash).toBeLessThan(tl.points[m].cash);
  });

  it('vyšší odkládání na akontaci koupi přiblíží', () => {
    const state = makeState({ goals: ['property'] });
    const slow = wealthTimeline(state, { months: 60, allocations: { downPayment: 5000, reserve: 0, retirement: 0, child: 0, custom: [] } });
    const fast = wealthTimeline(state, { months: 60, allocations: { downPayment: 40000, reserve: 0, retirement: 0, child: 0, custom: [] } });
    expect(slow.purchaseMonth).toBe(40);
    expect(fast.purchaseMonth).toBe(5);
  });

  it('flow po cílech odečítá to, co na cíle jde, a po koupi už ne akontaci', () => {
    // Jmění může růst, a přesto na cíle nezbývat. Bez tohohle rozdílu
    // barvila stuha klidnou zelenou i tam, kde verdikt hlásil, že po koupi
    // na cíle chybí.
    const state = makeState({ goals: ['property', 'retirement'] });
    const a = { downPayment: 10000, reserve: 0, retirement: 8000, child: 0, custom: [] };
    const tl = wealthTimeline(state, { months: 60, allocations: a });
    const before = tl.points[1];
    expect(before.flowAfterGoals).toBe(before.flow - 18000);

    const after = tl.points[tl.purchaseMonth! + 2];
    // Akontace je zaplacená, odkládat se na ni přestává.
    expect(after.flowAfterGoals).toBe(after.flow - 8000);
  });

  it('child costs and parental leave push cash down and can go negative', () => {
    const state = makeState({
      goals: ['property', 'child'],
      savings: { totalSavings: 1000000 }, // DP hned
      parentalLeave: { enabled: true, parent: 1, durationMonths: 36, monthlyBenefit: 9722 },
    });
    const withLeave = wealthTimeline(state, { months: 60, childOffsetMonths: 6 });
    const noLeave = wealthTimeline({ ...state, parentalLeave: undefined }, { months: 60, childOffsetMonths: 6 });
    expect(withLeave.purchaseMonth).toBe(0);
    expect(withLeave.childMonth).toBe(6);
    expect(withLeave.leaveEndMonth).toBe(42);
    // výpadek příjmu během volna → nižší jmění než bez rodičovské
    expect(withLeave.points[42].cash).toBeLessThan(noLeave.points[42].cash);
  });

  it('never buys when the down payment is unreachable in the horizon', () => {
    const state = makeState({
      goals: ['property'],
      income: { person1NetMonthly: 34500 }, // disposable 500/měs
      savings: { totalSavings: 100000 },
    });
    const tl = wealthTimeline(state, { months: 120 });
    expect(tl.purchaseMonth).toBeNull();
  });
});

describe('cíle, které v čase končí', () => {
  it('rezerva na dítě se po narození nepočítá znovu, dítě je pak výdaj', () => {
    // Do narození je rezerva na dítě odkládání stranou. Od narození se dítě
    // platí doopravdy a jeho náklad je mezi výdaji; kdyby se počítalo obojí,
    // platila by domácnost za dítě dvakrát a stuha by hlásila napjatý
    // rozpočet i tam, kde ve skutečnosti vychází.
    const state = makeState({ goals: ['child'], savings: { totalSavings: 300000 } });
    const a = { downPayment: 0, reserve: 0, retirement: 0, child: 9000, custom: [] };
    const tl = wealthTimeline(state, { months: 36, childOffsetMonths: 12, allocations: a });

    const before = tl.points[6];
    expect(before.flowAfterGoals).toBe(before.flow - 9000);

    // Po narození už se rezerva neodečítá: náklad na dítě je v `flow`.
    const after = tl.points[20];
    expect(after.flowAfterGoals).toBe(after.flow);
    // A ten náklad se v toku opravdu projevil.
    expect(after.flow).toBeLessThan(before.flow);
  });

  it('odkládání na akontaci končí koupí', () => {
    const state = makeState({ goals: ['property'], savings: { totalSavings: 1000000 } });
    const a = { downPayment: 12000, reserve: 0, retirement: 4000, child: 0, custom: [] };
    const tl = wealthTimeline(state, { months: 36, allocations: a });
    expect(tl.purchaseMonth).toBe(0);
    const after = tl.points[3];
    expect(after.flowAfterGoals).toBe(after.flow - 4000);
  });
});

describe('horizont plánu', () => {
  it('sahá k odchodu do důchodu, ne na pevných deset let', () => {
    // Třicátník má do pětašedesáti pětatřicet let. Do desetiletého okna
    // se nevešlo nic z toho, na co si spoří: doplacení hypotéky ani
    // odrostlé dítě, ani konec výdělku.
    expect(planHorizonMonths(makeState({ person1Age: 30 }))).toBe(35 * 12);
    // U páru rozhoduje **starší**. Osa počítá se mzdou po celý horizont
    // a rentu neumí, takže dál než k prvnímu odchodu do důchodu nedohlédne.
    // S mladším by u páru 50 a 40 let slibovala pětadvacet let dvou platů,
    // z toho patnáct po tom, co jeden z nich přestane chodit do práce.
    expect(planHorizonMonths(makeState({ person1Age: 50, person2Age: 40 }))).toBe(15 * 12);
    // Pořadí osob na tom nic nemění.
    expect(planHorizonMonths(makeState({ person1Age: 40, person2Age: 50 }))).toBe(15 * 12);
  });

  it('drží se mezi deseti a čtyřiceti lety', () => {
    // Kdo je pár let před důchodem, ať přesto vidí, jak plán dopadne.
    expect(planHorizonMonths(makeState({ person1Age: 62 }))).toBe(MIN_HORIZON_MONTHS);
    // A nesmyslně zadaný věk nemá natáhnout osu do nekonečna.
    expect(planHorizonMonths(makeState({ person1Age: 1 }))).toBe(MAX_HORIZON_MONTHS);
  });

  it('bez zadaného věku počítá třicet let', () => {
    expect(planHorizonMonths(makeState())).toBe(30 * 12);
  });
});

describe('doplacení hypotéky', () => {
  const buyer = () => makeState({
    goals: ['property'],
    person1Age: 30,
    savings: { totalSavings: 1500000 },
    property: { targetPrice: 5000000, mortgageRate: 0.052, loanTermYears: 15 },
  });

  it('poslední splátka padne patnáct let po koupi, ne patnáct let od dneška', () => {
    const tl = wealthTimeline(buyer(), { months: 360 });
    expect(tl.purchaseMonth).not.toBeNull();
    expect(tl.mortgagePaidOffMonth).toBe(tl.purchaseMonth! + 15 * 12);
  });

  it('po doplacení zůstane v rozpočtu splátka navíc', () => {
    // Tohle byla na dlouhém horizontu tichá chyba: osa splácela dál
    // a zamlčela největší skok v rozpočtu za celý plán. V desetiletém
    // okně se neprojevila, protože nejkratší hypotéka je patnáctiletá.
    const state = buyer();
    const tl = wealthTimeline(state, { months: 360 });
    const payoff = tl.mortgagePaidOffMonth!;
    const at = (m: number) => tl.points.find((p) => p.month === m)!;
    const splatka = monthlyMortgagePayment(
      loanAmount(state), mortgageRate(state), loanTermYears(state)
    );
    expect(at(payoff + 1).flow - at(payoff - 1).flow).toBeCloseTo(splatka, 0);
    // Náklady na vlastnictví běží dál, ty koncem hypotéky nemizí: proti
    // nájemníkovi zbyde nájem minus tyhle náklady, ne celý nájem.
    // 75 000 příjem, 34 000 výdajů, z toho 18 500 za nájem a energie.
    const bezBydleni = 75000 - (34000 - 18500);
    expect(at(payoff + 1).flow).toBe(Math.round(bezBydleni - ownershipCosts(state)));
  });

  it('mimo horizont se nedoplácí, takže se událost nekreslí', () => {
    const tl = wealthTimeline(buyer(), { months: 120 });
    expect(tl.mortgagePaidOffMonth).toBeNull();
  });
});

describe('přidání cíle se na křivce projeví tak, jak má', () => {
  const rodina = (goals: WizardState['goals']) => makeState({
    goals,
    person1Age: 31,
    person2Age: 29,
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 1100000 },
    property: { targetPrice: 6200000, loanTermYears: 30 },
  });

  it('dítě ubere z úspor přesně tolik, kolik stojí do osmnácti', () => {
    // Nejsilnější křížová kontrola, jakou na tenhle model jde udělat: rozdíl
    // koncových úspor musí sednout na součet nákladů z tabulky ČSÚ.
    const bez = wealthTimeline(rodina(['property']), { months: 432, childOffsetMonths: 12 });
    const s = wealthTimeline(rodina(['property', 'child']), { months: 432, childOffsetMonths: 12 });
    const rozdil = bez.points.at(-1)!.cash - s.points.at(-1)!.cash;
    const doOsmnacti = (3 * 8000 + 3 * 10000 + 9 * 12000 + 3 * 14000) * 12;
    expect(doOsmnacti).toBe(2448000);
    expect(rozdil).toBe(doOsmnacti);
  });

  it('náklad na dítě se láme přesně na hranicích věkových pásem', () => {
    const tl = wealthTimeline(rodina(['property', 'child']), { months: 432, childOffsetMonths: 12 });
    const flow = (m: number) => tl.points.find((p) => p.month === m)!.flow;
    const bezDitete = flow(12); // ještě před narozením
    expect(bezDitete - flow(13)).toBe(8000); // 0–3 roky
    expect(bezDitete - flow(60)).toBe(10000); // 3–6 let
    expect(bezDitete - flow(120)).toBe(12000); // 6–15 let
    expect(bezDitete - flow(200)).toBe(14000); // 15–18 let
    expect(bezDitete - flow(360)).toBe(0); // odrostlé
  });

  it('posun narození posune celý náklad, ne jen popisek', () => {
    const brzy = wealthTimeline(rodina(['property', 'child']), { months: 432, childOffsetMonths: 0 });
    const pozdeji = wealthTimeline(rodina(['property', 'child']), { months: 432, childOffsetMonths: 60 });
    expect(brzy.childMonth).toBe(0);
    expect(pozdeji.childMonth).toBe(60);
    // Do osmnácti to stojí stejně, jen o pět let později, takže na konci
    // horizontu (kdy je dítě v obou případech odrostlé) vyjde totéž.
    expect(brzy.points.at(-1)!.cash).toBe(pozdeji.points.at(-1)!.cash);
    // V průběhu se ale liší: kdo má dítě hned, má za pět let míň.
    const at = (tl: typeof brzy, m: number) => tl.points.find((p) => p.month === m)!.cash;
    expect(at(brzy, 60)).toBeLessThan(at(pozdeji, 60));
  });

  it('důchod křivkou úspor nehne, ubere jen z toho, co zbývá na cíle', () => {
    // Odložené peníze jsou pořád vaše, jen leží jinde. Vidět je to na
    // `flowAfterGoals`, ne na `cash`; kdyby se odečítaly od `cash`, tvrdila
    // by osa, že spořením chudnete.
    const bez = wealthTimeline(rodina(['property']), { months: 432 });
    const s = wealthTimeline(rodina(['property', 'retirement']), { months: 432 });
    expect(s.points.at(-1)!.cash).toBe(bez.points.at(-1)!.cash);
    expect(s.points.at(-1)!.flow).toBe(bez.points.at(-1)!.flow);
    expect(bez.points.at(-1)!.flowAfterGoals - s.points.at(-1)!.flowAfterGoals).toBe(14910);
  });
});

describe('odložené bydlení znamená, že se dál platí nájem', () => {
  const rodina = (goals: WizardState['goals']) => makeState({
    goals,
    person1Age: 31,
    person2Age: 29,
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: 1100000 },
    property: { targetPrice: 6200000, loanTermYears: 30 },
  });

  it('bez koupě zůstane nájem i energie mezi výdaji', () => {
    // Přepínač v „Co kdyby" odloží celý cíl, ne jen spoření na akontaci.
    // Koupě se pak nekoná a domácnost bydlí dál v nájmu, takže se nájem
    // z výdajů nesmí ztratit; kdyby ano, vypnutí bydlení by vypadalo, jako
    // by se bydlelo zadarmo.
    const bez = wealthTimeline(rodina([]), { months: 120 });
    expect(bez.purchaseMonth).toBeNull();
    // 93 000 příjem − 43 300 výdajů (v tom 19 000 nájem a 4 500 energie).
    expect(bez.points[1].flow).toBe(49700);
  });

  it('s koupí nájem vystřídá splátka a náklady na vlastnictví', () => {
    const s = wealthTimeline(rodina(['property']), { months: 120 });
    expect(s.purchaseMonth).toBe(0);
    const bezKoupe = 49700;
    const najemAEnergie = 19000 + 4500;
    const splatkaANaklady = bezKoupe + najemAEnergie - s.points[1].flow;
    // Splátka 29 276 Kč plus 5 200 Kč nákladů na vlastnictví.
    expect(Math.round(splatkaANaklady)).toBe(34476);
  });
});

describe('odklad koupě', () => {
  const kupujici = (savings: number) => makeState({
    goals: ['property'],
    person1Age: 31,
    person2Age: 29,
    income: { person1NetMonthly: 52000, person2NetMonthly: 41000 },
    expenses: { rent: 19000, existingLoans: 0, insurance: 1800, food: 9000, transport: 4000, children: 0, utilities: 4500, other: 5000 },
    savings: { totalSavings: savings },
    property: { targetPrice: 6200000, loanTermYears: 30 },
  });

  it('kdo má naspořeno, může koupit hned, nebo až za rok', () => {
    const hned = wealthTimeline(kupujici(1100000), { months: 120 });
    expect(hned.purchaseMonth).toBe(0);

    const zaRok = wealthTimeline(kupujici(1100000), { months: 120, purchaseNotBeforeMonth: 12 });
    expect(zaRok.purchaseMonth).toBe(12);
    // Nejdřívější možný termín se odkladem nemění, jinak by mez úchopu
    // utíkala doprava spolu s ním a doleva by se už nedalo vrátit.
    expect(zaRok.earliestPurchaseMonth).toBe(0);
  });

  it('během odkladu se platí dál nájem a spoří se', () => {
    const zaRok = wealthTimeline(kupujici(1100000), { months: 120, purchaseNotBeforeMonth: 12 });
    const hned = wealthTimeline(kupujici(1100000), { months: 120 });
    // Nájem a energie místo splátky: měsíční tok je před koupí ten původní.
    expect(zaRok.points[1].flow).toBe(49700);
    expect(zaRok.points[13].flow).toBe(hned.points[1].flow);
    // A do koupě se stihne naspořit o rok víc, takže po ní zbyde větší rezerva.
    expect(zaRok.points[13].cash).toBeGreaterThan(hned.points[1].cash);
  });

  it('dřív, než je na akontaci, se koupit nedá ani na přání', () => {
    // Akontace chybí, koupě proto přijde až s naspořením. Odklad na dřívější
    // měsíc s tím nehne: peníze na ni nejsou.
    const pozdeji = wealthTimeline(kupujici(500000), { months: 240, purchaseNotBeforeMonth: 1 });
    const sam = wealthTimeline(kupujici(500000), { months: 240 });
    expect(sam.purchaseMonth).toBeGreaterThan(1);
    expect(pozdeji.purchaseMonth).toBe(sam.purchaseMonth);
    expect(pozdeji.earliestPurchaseMonth).toBe(sam.purchaseMonth);
  });

  it('odklad nemění akontaci ani splátku, jen termín', () => {
    // Kdyby se odklad tvářil jako vyšší akontace, rozešla by se časová osa
    // se splátkou a DSTI, které počítají z akontace zadané v Bydlení.
    const state = kupujici(1100000);
    const hned = wealthTimeline(state, { months: 120 });
    const pozdeji = wealthTimeline(state, { months: 120, purchaseNotBeforeMonth: 24 });
    const splatkaHned = hned.points[1].flow;
    const splatkaPozdeji = pozdeji.points[25].flow;
    expect(splatkaPozdeji).toBe(splatkaHned);
  });
});
