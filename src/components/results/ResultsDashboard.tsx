import { useState, useMemo } from 'react';
import type { WizardState } from '../../types';
import ResultsOverview from './ResultsOverview';
import ExpenseBreakdownChart from './ExpenseBreakdownChart';
import WealthTimelineChart from './WealthTimelineChart';
import DiscretionaryBreakdownChart from './DiscretionaryBreakdownChart';
import CashFlowSummary from './CashFlowSummary';
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
import EducationalGlossary from './EducationalGlossary';
import ResultsSection from './ResultsSection';
import { calculateDefaultAllocations } from '../../engine/allocation';
import type { GoalAllocations } from '../../engine/allocation';
import { hasDiscretionaryBreakdown } from '../../engine/discretionary';
import { withExcludedExpenses } from '../../engine/expenseBreakdown';
import { parentalLeaveApplicable } from '../../engine/parentalLeave';
import type { CustomGoal, ParentalLeave } from '../../types';
import { saveState } from '../../store/localStorage';
import { buildShareUrl } from '../../store/shareLink';
import Disclaimer from '../ui/Disclaimer';

interface ResultsDashboardProps {
  state: WizardState;
  onEdit: () => void;
  onReset: () => void;
}

export default function ResultsDashboard({ state: initialState, onEdit, onReset }: ResultsDashboardProps) {
  const modeLabels = { individual: 'Jednotlivec', couple: 'Pár', family: 'Rodina' };

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

  // Tematické sekce výsledků — jen ty, které dávají smysl podle cílů.
  const sectionDefs = [
    { id: 'souhrn', label: 'Souhrn' },
    ...(hasProperty ? [{ id: 'bydleni', label: 'Bydlení' }] : []),
    ...(hasGoalPlanners ? [{ id: 'cile', label: 'Cíle' }] : []),
    { id: 'rozpocet', label: 'Rozpočet' },
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

  // Odškrtnuté výdajové kategorie z grafu rozpočtu — platí pro celou stránku.
  const [excludedExpenses, setExcludedExpenses] = useState<Set<string>>(() => new Set());
  // „Živý" stav, ze kterého počítají všechny karty (kromě grafu rozpočtu, který
  // potřebuje původní výdaje, aby šlo kategorie zase zapnout).
  const activeState = useMemo(
    () => withExcludedExpenses(state, excludedExpenses),
    [state, excludedExpenses]
  );

  const [allocations, setAllocations] = useState<GoalAllocations>(() =>
    calculateDefaultAllocations(state)
  );

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

  // Sdílení přehledu odkazem — stav se zakóduje do URL, nic se neposílá na server.
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

  // Tisk / uložení do PDF — rozbalí všechny sekce (aby se vykreslily i grafy),
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
        <h1 className="text-lg font-bold text-gray-900">MámNaTo? — finanční přehled</h1>
        <p className="text-xs text-gray-500">Vytištěno {new Date().toLocaleDateString('cs-CZ')} · orientační přehled, data zůstávají ve vašem prohlížeči.</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Váš finanční přehled</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Režim: {modeLabels[state.mode]}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors min-h-[44px]"
            title="Zkopíruje odkaz, který obsahuje vaše zadaná data (v adrese). Nic se neukládá na server."
          >
            {shareCopied ? (
              <>
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Odkaz zkopírován
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                Sdílet přehled
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
            Vytisknout / PDF
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
            Upravit údaje
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/70 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]"
          >
            Začít znovu
          </button>
        </div>
      </div>

      {/* Rychlá navigace mezi sekcemi */}
      {sectionDefs.length > 2 && (
        <nav className="no-print sticky top-16 z-30 mb-5 -mx-4 sm:mx-0 px-4 sm:px-3 py-2 bg-white/85 dark:bg-gray-900/85 backdrop-blur border-y sm:border sm:rounded-xl border-gray-200/80 dark:border-gray-800/80 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 self-center mr-1 hidden sm:inline">Přejít na:</span>
          {sectionDefs.map((s) => (
            <button
              key={s.id}
              onClick={() => openAndScroll(s.id)}
              className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

      <div className="space-y-4">
        {/* Souhrn — hlavní odpověď „vyjde mi to?" */}
        <ResultsSection id="souhrn" title="Souhrn" subtitle="Verdikt, rozpočet a připravenost cílů" open={isOpen('souhrn')} onToggle={() => toggleSection('souhrn')}>
          <ResultsOverview state={activeState} allocations={allocations} />
          <ExpenseBreakdownChart
            state={state}
            allocations={allocations}
            onChangeAllocation={handleChangeAllocation}
            excluded={excludedExpenses}
            setExcluded={setExcludedExpenses}
          />
          <WealthTimelineChart state={activeState} />
          {hasNoGoals && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 text-center">
              <p className="text-amber-800 dark:text-amber-300">Vraťte se a vyberte své finanční cíle pro podrobnější analýzu.</p>
            </div>
          )}
        </ResultsSection>

        {/* Bydlení a hypotéka */}
        {hasProperty && (
          <ResultsSection id="bydleni" title="Bydlení a hypotéka" subtitle="Akontace, splátka, limity a srovnání s nájmem" open={isOpen('bydleni')} onToggle={() => toggleSection('bydleni')}>
            <SavingsChart state={activeState} />
            <PropertyAffordability state={activeState} />
            <DtiDstiIndicator state={activeState} />
            <MortgageVsRent state={activeState} />
            <CashFlowAfterChart state={activeState} />
            <InvestmentComparisonChart state={activeState} />
          </ResultsSection>
        )}

        {/* Cíle */}
        {hasGoalPlanners && (
          <ResultsSection id="cile" title="Cíle" subtitle="Důchod, dítě, rodičovská a vlastní cíle" open={isOpen('cile')} onToggle={() => toggleSection('cile')}>
            {hasRetirement && (
              <RetirementPlanner
                state={activeState}
                monthlyContribution={allocations.retirement}
                onChangeContribution={(v) => handleChangeAllocation('retirement', null, v)}
              />
            )}
            {hasChild && <ChildCostPlanner state={activeState} />}
            {hasLeave && <ParentalLeavePlanner state={activeState} onChange={handleChangeParentalLeave} />}
            {hasOther && <CustomGoalPlanner state={activeState} onChangeGoals={handleChangeCustomGoals} />}
          </ResultsSection>
        )}

        {/* Podrobný rozpočet */}
        <ResultsSection id="rozpocet" title="Podrobný rozpočet" subtitle="Příjmy, výdaje a disponibilní částka" open={isOpen('rozpocet')} onToggle={() => toggleSection('rozpocet')}>
          <CashFlowSummary state={activeState} />
          {hasDiscretionaryBreakdown(activeState.expenses.discretionaryBreakdown) && (
            <DiscretionaryBreakdownChart state={activeState} />
          )}
        </ResultsSection>

        {/* Slovníček */}
        <ResultsSection id="slovnicek" title="Slovníček pojmů" subtitle="Finanční pojmy jednoduše" open={isOpen('slovnicek')} onToggle={() => toggleSection('slovnicek')}>
          <EducationalGlossary />
        </ResultsSection>
      </div>

      <Disclaimer />
    </div>
  );
}
