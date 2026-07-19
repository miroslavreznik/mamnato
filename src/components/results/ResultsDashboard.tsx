import { useState } from 'react';
import type { WizardState } from '../../types';
import ResultsOverview from './ResultsOverview';
import ExpenseBreakdownChart from './ExpenseBreakdownChart';
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
import EducationalGlossary from './EducationalGlossary';
import { calculateDefaultAllocations } from '../../engine/allocation';
import type { GoalAllocations } from '../../engine/allocation';
import { hasDiscretionaryBreakdown } from '../../engine/discretionary';
import type { CustomGoal } from '../../types';
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

  // Tisk / uložení do PDF — dark mód se pro tisk dočasně vypne kvůli čitelnosti.
  const handlePrint = () => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) {
      root.classList.remove('dark');
      const restore = () => {
        root.classList.add('dark');
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
    }
    window.print();
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

      <div className="space-y-6">
        {/* 1) Souhrn / verdikt na základě cílů */}
        <ResultsOverview state={state} allocations={allocations} />

        {/* 2) Souhrnný graf: kam jde příjem (výdaje + cíle + volné) + ovládání cílů */}
        <ExpenseBreakdownChart
          state={state}
          allocations={allocations}
          onChangeAllocation={handleChangeAllocation}
        />

        {/* 2b) Rozpad zbytných výdajů — jen když je vyplněn podrobný rozpis */}
        {hasDiscretionaryBreakdown(state.expenses.discretionaryBreakdown) && (
          <DiscretionaryBreakdownChart state={state} />
        )}

        {/* 3) Detailní cash flow */}
        <CashFlowSummary state={state} />

        {hasNoGoals && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 text-center">
            <p className="text-amber-800 dark:text-amber-300">Vraťte se a vyberte své finanční cíle pro podrobnější analýzu.</p>
          </div>
        )}

        {/* Property goal sections */}
        {hasProperty && (
          <>
            <SavingsChart state={state} />
            <PropertyAffordability state={state} />
            <DtiDstiIndicator state={state} />
            <MortgageVsRent state={state} />
            <CashFlowAfterChart state={state} />
            <InvestmentComparisonChart state={state} />
          </>
        )}

        {/* Retirement goal section */}
        {hasRetirement && (
          <RetirementPlanner state={state} />
        )}

        {/* Child goal — cost planner */}
        {hasChild && (
          <ChildCostPlanner state={state} />
        )}

        {/* Custom goals section */}
        {hasOther && (
          <CustomGoalPlanner state={state} onChangeGoals={handleChangeCustomGoals} />
        )}

        {/* Educational glossary — always shown */}
        <EducationalGlossary />
      </div>

      <Disclaimer />
    </div>
  );
}
