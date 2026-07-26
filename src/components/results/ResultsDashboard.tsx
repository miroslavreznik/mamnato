import { useState, useMemo } from 'react';
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
import ResultsHeader from './ResultsHeader';
import { calculateDefaultAllocations } from '../../engine/allocation';
import type { GoalAllocations } from '../../engine/allocation';
import { hasDiscretionaryBreakdown } from '../../engine/discretionary';
import { withExcludedExpenses, withExcludedGoals } from '../../engine/expenseBreakdown';
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
}

export default function ResultsDashboard({ state: initialState, onEdit, onReset }: ResultsDashboardProps) {
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

  // Tematické sekce výsledků, jen ty, které dávají smysl podle cílů.
  const sectionDefs = [
    { id: 'souhrn', label: 'Souhrn' },
    ...(hasProperty ? [{ id: 'bydleni', label: 'Bydlení' }] : []),
    ...(hasGoalPlanners ? [{ id: 'cile', label: 'Ostatní cíle' }] : []),
    { id: 'slovnicek', label: 'Slovníček' },
  ];
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['souhrn']));
  const isOpen = (id: string) => openSections.has(id);
  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id); else nextSet.add(id);
      return nextSet;
    });
  const openAndScroll = (id: string) => {
    setOpenSections((prev) => new Set(prev).add(id));
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
    custom: excludedGoals.has('other') ? allocations.custom.map(() => 0) : allocations.custom,
  }), [allocations, excludedGoals]);

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
    const prevOpen = openSections;
    setOpenSections(new Set(sectionDefs.map((s) => s.id)));
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');
    const restore = () => {
      if (wasDark) root.classList.add('dark');
      setOpenSections(prevOpen);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    // Dát Rechartu čas na vykreslení po rozbalení sekcí.
    window.setTimeout(() => window.print(), 300);
  };

  return (
    <div>
      <div className="print-only mb-4">
        <h1 className="text-lg font-bold text-gray-900">MámNaTo? Finanční přehled</h1>
        <p className="text-xs text-gray-500">Vytištěno {new Date().toLocaleDateString('cs-CZ')} · orientační přehled, data zůstávají ve vašem prohlížeči.</p>
      </div>
      <ResultsHeader
        mode={state.mode}
        shareCopied={shareCopied}
        onShare={handleShare}
        onPrint={handlePrint}
        onEdit={onEdit}
        onReset={onReset}
      />

      {/* Rychlá navigace mezi sekcemi. Zůstává u horního okraje, protože
          stránka je dlouhá; rozbalená sekce je zvýrazněná, ať je vidět,
          kde se uživatel nachází. Popisek „Přejít na:" zmizel, dělal
          z lišty formulářové pole a pilulky se vysvětlují samy. */}
      {sectionDefs.length > 2 && (
        <nav
          aria-label="Sekce přehledu"
          className="no-print sticky top-16 z-30 mb-5 -mx-4 sm:mx-0 px-2 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-y sm:border sm:rounded-2xl border-gray-200 dark:border-gray-700 flex gap-1 overflow-x-auto"
        >
          {sectionDefs.map((section) => (
            <button
              key={section.id}
              onClick={() => openAndScroll(section.id)}
              aria-current={isOpen(section.id) ? 'true' : undefined}
              className={`shrink-0 px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium rounded-xl transition-colors ${
                isOpen(section.id)
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}

      <div className="space-y-4">
        {/* Souhrn: hlavní odpověď „vyjde mi to?" */}
        <ResultsSection id="souhrn" title="Souhrn" subtitle="Verdikt, rozpočet a připravenost cílů" open={isOpen('souhrn')} onToggle={() => toggleSection('souhrn')}>
          <ResultsOverview state={activeState} allocations={activeAllocations} />
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
          <WealthTimelineChart state={activeState} />
          {hasNoGoals && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 text-center">
              <p className="text-amber-800 dark:text-amber-300">Vraťte se a vyberte své finanční cíle pro podrobnější analýzu.</p>
            </div>
          )}
        </ResultsSection>

        {/* Bydlení a hypotéka */}
        {hasProperty && (
          <ResultsSection id="bydleni" title="Bydlení a hypotéka" subtitle="Největší položka plánu: akontace, splátka, limity a srovnání s nájmem" open={isOpen('bydleni')} onToggle={() => toggleSection('bydleni')}>
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
          <ResultsSection id="cile" title="Ostatní cíle" subtitle="Důchod, dítě, rodičovská a vlastní cíle" open={isOpen('cile')} onToggle={() => toggleSection('cile')}>
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
                allocations={allocations.custom}
                onChangeAllocation={(i, v) => handleChangeAllocation('custom', i, v)}
              />
            )}
          </ResultsSection>
        )}

        {/* Slovníček */}
        <ResultsSection id="slovnicek" title="Slovníček pojmů" subtitle="Finanční pojmy jednoduše" open={isOpen('slovnicek')} onToggle={() => toggleSection('slovnicek')}>
          <EducationalGlossary />
        </ResultsSection>
      </div>

      {/* Předpoklady patří až za rozbor, ale před právní upozornění: čte se to
          jako „takhle jsme k tomu došli", ne jako další kapitola výsledků. */}
      <div className="mt-6">
        <AssumptionsCard state={activeState} />
      </div>

      <Disclaimer />
    </div>
  );
}
