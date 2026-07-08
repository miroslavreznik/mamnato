import { useState } from 'react';
import type { WizardState } from '../../types';
import ResultsOverview from './ResultsOverview';
import ExpenseBreakdownChart from './ExpenseBreakdownChart';
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
import Disclaimer from '../ui/Disclaimer';

interface ResultsDashboardProps {
  state: WizardState;
  onEdit: () => void;
  onReset: () => void;
}

export default function ResultsDashboard({ state, onEdit, onReset }: ResultsDashboardProps) {
  const modeLabels = { individual: 'Jednotlivec', couple: 'Pár', family: 'Rodina' };

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Váš finanční přehled</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Režim: {modeLabels[state.mode]}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 min-h-[44px]"
          >
            Upravit údaje
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 min-h-[44px]"
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
          <CustomGoalPlanner state={state} />
        )}

        {/* Educational glossary — always shown */}
        <EducationalGlossary />
      </div>

      <Disclaimer />
    </div>
  );
}
