import type { ReactNode } from 'react';
import { useState, useMemo, useCallback } from 'react';
import type { WizardState } from '../../types';
import ResultsOverview from './ResultsOverview';
import ExpenseBreakdownChart from './ExpenseBreakdownChart';
import WealthTimelineChart from './WealthTimelineChart';
import DiscretionaryBreakdownChart from './DiscretionaryBreakdownChart';
import SavingsChart from './SavingsChart';
import PropertyAffordability from './PropertyAffordability';
import DtiDstiIndicator from './DtiDstiIndicator';
import MortgageVsRent from './MortgageVsRent';
import CashFlowAfterChart from './CashFlowAfterChart';
import InvestmentComparisonChart from './InvestmentComparisonChart';
import RetirementPlanner from './RetirementPlanner';
import CustomGoalPlanner from './CustomGoalPlanner';
import ChildCostPlanner from './ChildCostPlanner';
import ParentalLeavePlanner from './ParentalLeavePlanner';
import TaxReliefCard from './TaxReliefCard';
import EducationalGlossary from './EducationalGlossary';
import ResultsSection from './ResultsSection';
import ResultsHeader, { ModeChip } from './ResultsHeader';
import AppBar from '../ui/AppBar';
import WhatIfTab from './WhatIfTab';
import { WhatIfProvider } from './WhatIfProvider';
import ResultsTabs, { type TabDef } from './ResultsTabs';
import { calculateDefaultAllocations } from '../../engine/allocation';
import type { GoalAllocations } from '../../engine/allocation';
import { hasDiscretionaryBreakdown } from '../../engine/discretionary';
import { withExcludedExpenses, withExcludedGoals, isGoalActive } from '../../engine/expenseBreakdown';
import { parentalLeaveApplicable } from '../../engine/parentalLeave';
import type { CustomGoal, ParentalLeave } from '../../types';
import { saveState } from '../../store/localStorage';
import { buildShareUrl } from '../../store/shareLink';
import Disclaimer from '../ui/Disclaimer';
import AssumptionsCard from './AssumptionsCard';

interface ResultsDashboardProps {
  state: WizardState;
  onEdit: () => void;
  onReset: () => void;
  onHome: () => void;
  /** Upozornění na cizí přehled. Kreslí ho App, ale patří dovnitř sloupce. */
  banner?: ReactNode;
}

export default function ResultsDashboard({ state: initialState, onEdit, onReset, onHome, banner }: ResultsDashboardProps) {
  // Výsledková stránka pracuje s vlastní kopií stavu, aby úpravy cílů (např.
  // ve „Vlastní finanční cíle") okamžitě přepočítaly souhrn i grafy a zároveň
  // se uložily do prohlížeče.
  const [state, setState] = useState<WizardState>(initialState);

  const hasProperty = state.goals.includes('property');
  const hasRetirement = state.goals.includes('retirement');
  const hasOther = state.goals.includes('other');
  const hasChild = state.goals.includes('child');
  const hasNoGoals = state.goals.length === 0;
  const hasLeave = parentalLeaveApplicable(state);
  const hasGoalPlanners = hasRetirement || hasChild || hasLeave || hasOther;

  // Části výsledků jako záložky, jen ty, které dávají smysl podle cílů.
  const sectionDefs: TabDef[] = [
    { id: 'souhrn', label: 'Cesta' },
    { id: 'rozpocet', label: 'Rozpočet' },
    ...(hasProperty ? [{ id: 'bydleni', label: 'Bydlení' }] : []),
    ...(hasGoalPlanners ? [{ id: 'cile', label: 'Ostatní cíle' }] : []),
    { id: 'cokdyby', label: 'Co kdyby' },
    { id: 'slovnicek', label: 'Slovníček' },
  ];
  const [activeTab, setActiveTab] = useState('souhrn');

  // Tisk potřebuje všechno naráz, jinak by v PDF zbyla jedna záložka. Není to
  // jen CSS: grafy se musí opravdu vykreslit, a to v `display: none` neumí.
  const [printAll, setPrintAll] = useState(false);
  const isVisible = (id: string) => printAll || activeTab === id;

  const selectTab = (id: string) => {
    setActiveTab(id);
    // Přepnutí záložky nesmí nechat uživatele v půlce předchozího obsahu.
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Vypnuté výdajové kategorie a cíle z rozpočtu („co kdyby"), platí pro
  // celou stránku, takže se přepočítá i verdikt nahoře.
  const [excludedExpenses, setExcludedExpenses] = useState<Set<string>>(() => new Set());
  const [excludedGoals, setExcludedGoals] = useState<Set<string>>(() => new Set());

  // „Živý" stav, ze kterého počítají všechny karty (kromě rozpočtu, který
  // potřebuje původní hodnoty, aby šlo položky zase zapnout).
  const activeState = useMemo(
    () => withExcludedGoals(withExcludedExpenses(state, excludedExpenses), excludedGoals),
    [state, excludedExpenses, excludedGoals]
  );

  const [allocations, setAllocations] = useState<GoalAllocations>(() =>
    calculateDefaultAllocations(state)
  );

  // Vypnutý cíl nesmí dál ukrajovat z rozpočtu.
  const activeAllocations = useMemo<GoalAllocations>(() => ({
    downPayment: excludedGoals.has('property') ? 0 : allocations.downPayment,
    retirement: excludedGoals.has('retirement') ? 0 : allocations.retirement,
    child: excludedGoals.has('child') ? 0 : allocations.child,
    // Odložený vlastní cíl se z pole vyhazuje, ne nuluje: `withExcludedGoals`
    // ho vyhazuje i ze stavu, a kdyby se tady jen nuloval, rozešly by se obě
    // pole v indexech a částky by sedly na cizí cíle.
    custom: allocations.custom.filter((_, i) => {
      const goal = (state.customGoals ?? [])[i];
      return goal ? isGoalActive(excludedGoals, goal.id) : !excludedGoals.has('other');
    }),
  }), [allocations, excludedGoals, state.customGoals]);

  // Odložení cíle v Co kdyby. Platí pro celý přehled, takže se překreslí
  // i verdikt: to je celý smysl, jinak by šlo jen o zešedlou kartu.
  const toggleGoal = useCallback((key: string) => {
    setExcludedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const resetGoals = useCallback(() => setExcludedGoals(new Set()), []);

  const handleChangeAllocation = (goal: string, index: number | null, value: number) => {
    setAllocations((prev) => {
      if (goal === 'custom' && index !== null) {
        const custom = [...prev.custom];
        custom[index] = value;
        return { ...prev, custom };
      }
      return { ...prev, [goal]: value };
    });
  };

  // Úprava vlastních cílů v detailu → uložit a udržet zarovnané alokace.
  const handleChangeCustomGoals = (goals: CustomGoal[]) => {
    const next = { ...state, customGoals: goals };
    setState(next);
    saveState(next);
    setAllocations((prev) => ({ ...prev, custom: goals.map((_, i) => prev.custom[i] ?? 0) }));
  };

  const handleChangeParentalLeave = (value: ParentalLeave | undefined) => {
    const next = { ...state, parentalLeave: value };
    setState(next);
    saveState(next);
  };

  // Akontace jde upravit přímo ve výsledcích, změna se uloží a přepočítá vše.
  const handleChangeDownPayment = (value: number) => {
    const clamped = Math.max(0, Math.min(value, state.savings.totalSavings));
    const next = { ...state, savings: { ...state.savings, downPaymentFromSavings: clamped } };
    setState(next);
    saveState(next);
  };

  // Úroková sazba jde stejně jako akontace ladit přímo ve výsledcích.
  const handleChangeRate = (value: number) => {
    const clamped = Math.max(0.001, Math.min(value, 0.20));
    const next = { ...state, property: { ...state.property, mortgageRate: clamped } };
    setState(next);
    saveState(next);
  };

  // Sdílení přehledu odkazem, stav se zakóduje do URL, nic se neposílá na server.
  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = async () => {
    const url = buildShareUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Kdyby clipboard nebyl dostupný, ukaž odkaz k ručnímu zkopírování.
      window.prompt('Zkopírujte odkaz na přehled:', url);
    }
  };

  // Tisk / uložení do PDF, rozbalí všechny sekce (aby se vykreslily i grafy),
  // vypne dark mód a po tisku vše vrátí zpět.
  const handlePrint = () => {
    setPrintAll(true);
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');
    const restore = () => {
      if (wasDark) root.classList.add('dark');
      setPrintAll(false);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    // Dát Rechartu čas na vykreslení po rozbalení sekcí.
    window.setTimeout(() => window.print(), 300);
  };

  return (
    <>
      <AppBar
        onHome={onHome}
        chip={<ModeChip mode={state.mode} />}
        center={<ResultsTabs tabs={sectionDefs} active={activeTab} onSelect={selectTab} />}
        actions={
          <ResultsHeader
            shareCopied={shareCopied}
            onShare={handleShare}
            onPrint={handlePrint}
            onEdit={onEdit}
            onReset={onReset}
          />
        }
      />

      {/* Název stránky nese `aria-label`, ne nadpis. Nadpis „Váš finanční plán"
          stál v samostatné kartě nad obsahem, kterou lišta nahradila; pro čtečku
          ale stránka pojmenovaná zůstat musí. */}
      <main
        data-testid="results"
        aria-label="Váš finanční plán"
        className="mx-auto max-w-app px-4 py-6 sm:py-8"
      >
        {banner}
        <div className="print-only mb-4">
          <h1 className="type-section text-ink">MámNaTo? Finanční přehled</h1>
          <p className="text-xs text-ink-muted">Vytištěno {new Date().toLocaleDateString('cs-CZ')} · orientační přehled, data zůstávají ve vašem prohlížeči.</p>
        </div>
        {/* Cesta: hlavní odpověď „vyjde mi to?" a plán v čase, až k důchodu.
            Id zůstává `souhrn`: je v uložených odkazech i v kotvách testů
            a přejmenovat ho by rozbilo sdílené adresy kvůli popisku. */}
        <ResultsSection id="souhrn" title="Cesta" subtitle="Odpověď, váš plán v čase a stav vašich cílů" active={isVisible('souhrn')}>
          <ResultsOverview state={activeState} allocations={activeAllocations} onOpenSection={selectTab} />
          {hasNoGoals && (
            <div className="bg-tint-caution border border-line rounded-xl p-6 text-center">
              <p className="text-caution">Vraťte se a vyberte své finanční cíle pro podrobnější analýzu.</p>
            </div>
          )}
        </ResultsSection>

        {/* Rozpočet: kam jde příjem a jak se jmění vyvíjí v čase. Dřív viselo
            pod souhrnem a dělalo z něj pět tisíc pixelů. */}
        <ResultsSection id="rozpocet" title="Rozpočet" subtitle="Kam jde váš příjem, co kdyby a vývoj jmění v čase" active={isVisible('rozpocet')}>
          <ExpenseBreakdownChart
            state={state}
            allocations={allocations}
            excluded={excludedExpenses}
            setExcluded={setExcludedExpenses}
            excludedGoals={excludedGoals}
            setExcludedGoals={setExcludedGoals}
          />
          {hasDiscretionaryBreakdown(activeState.expenses.discretionaryBreakdown) && (
            <DiscretionaryBreakdownChart state={activeState} />
          )}
          <WealthTimelineChart state={activeState} allocations={activeAllocations} />
        </ResultsSection>

        {/* Bydlení a hypotéka */}
        {hasProperty && (
          <ResultsSection id="bydleni" title="Vlastní bydlení" subtitle="Největší položka plánu: akontace, splátka, limity a srovnání s nájmem" active={isVisible('bydleni')}>
            <SavingsChart state={activeState} monthlySaving={activeAllocations.downPayment} />
            <PropertyAffordability
              state={activeState}
              onChangeDownPayment={handleChangeDownPayment}
              onChangeRate={handleChangeRate}
              monthlySaving={allocations.downPayment}
              onChangeMonthlySaving={(v) => handleChangeAllocation('downPayment', null, v)}
            />
            <DtiDstiIndicator state={activeState} />
            <MortgageVsRent state={activeState} />
            <CashFlowAfterChart state={activeState} />
            <InvestmentComparisonChart state={activeState} />
            <TaxReliefCard state={activeState} />
          </ResultsSection>
        )}

        {/* Cíle */}
        {hasGoalPlanners && (
          <ResultsSection id="cile" title="Ostatní cíle" subtitle="Důchod, dítě, rodičovská a vlastní cíle" active={isVisible('cile')}>
            {hasRetirement && (
              <RetirementPlanner
                state={activeState}
                monthlyContribution={allocations.retirement}
                onChangeContribution={(v) => handleChangeAllocation('retirement', null, v)}
              />
            )}
            {hasChild && (
              <ChildCostPlanner
                state={activeState}
                monthlyAllocation={allocations.child}
                onChangeAllocation={(v) => handleChangeAllocation('child', null, v)}
              />
            )}
            {hasLeave && <ParentalLeavePlanner state={activeState} onChange={handleChangeParentalLeave} />}
            {hasOther && (
              <CustomGoalPlanner
                state={activeState}
                onChangeGoals={handleChangeCustomGoals}
                allocations={allocations}
                onChangeAllocation={(i, v) => handleChangeAllocation('custom', i, v)}
              />
            )}
          </ResultsSection>
        )}

        {/* Co kdyby: pískoviště na posuvníky. Vypnuté položky platí pro celý
            přehled a bydlí v tomhle komponentu; posuvníky jen tady. */}
        <ResultsSection
          id="cokdyby"
          title="Co kdyby"
          subtitle="Zkuste s plánem pohnout a uvidíte, jestli to pomůže"
          active={isVisible('cokdyby')}
        >
          <WhatIfProvider
            state={activeState}
            allocations={activeAllocations}
            allGoals={state}
            allGoalAllocations={allocations}
            excludedGoals={excludedGoals}
            onToggleGoal={toggleGoal}
            onResetGoals={resetGoals}
          >
            <WhatIfTab />
          </WhatIfProvider>
        </ResultsSection>

        {/* Slovníček */}
        <ResultsSection id="slovnicek" title="Slovníček pojmů" subtitle="Co která zkratka a číslo v přehledu znamená" active={isVisible('slovnicek')}>
          <EducationalGlossary />
        </ResultsSection>

        {/* Předpoklady patří až za rozbor, ale před právní upozornění: čte se to
            jako „takhle jsme k tomu došli", ne jako další kapitola výsledků. */}
        <div className="mt-6">
          <AssumptionsCard state={activeState} />
        </div>

        <Disclaimer />
      </main>
    </>
  );
}
