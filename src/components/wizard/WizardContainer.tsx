import { useReducer, useEffect, useState } from 'react';
import { WizardContext, wizardReducer, createInitialState } from '../../store/wizardStore';
import { saveState, loadState } from '../../store/localStorage';
import StepIndicator from './StepIndicator';
import type { StepItem } from './StepIndicator';
import Step1Mode from './steps/Step1Mode';
import Step2Income from './steps/Step2Income';
import Step3Expenses from './steps/Step3Expenses';
import Step4Savings from './steps/Step4Savings';
import Step5Goals from './steps/Step5Goals';
import Step6Property from './steps/Step6Property';
import Step7CustomGoals from './steps/Step7CustomGoals';

const BASE_STEPS: StepItem[] = [
  { step: 1, label: 'Režim' },
  { step: 2, label: 'Příjmy' },
  { step: 3, label: 'Výdaje' },
  { step: 4, label: 'Úspory' },
  { step: 5, label: 'Cíle' },
];

interface WizardContainerProps {
  onComplete: () => void;
  returnToStep?: number | null;
  resumeSavedState?: boolean;
}

export default function WizardContainer({ onComplete, returnToStep, resumeSavedState }: WizardContainerProps) {
  const [state, dispatch] = useReducer(wizardReducer, createInitialState());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      if (returnToStep) {
        dispatch({ type: 'LOAD_STATE', state: { ...saved, currentStep: returnToStep } });
      } else if (resumeSavedState) {
        dispatch({ type: 'LOAD_STATE', state: saved });
      }
    }
    setInitialized(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialized) {
      saveState(state);
    }
  }, [state, initialized]);

  useEffect(() => {
    if (state.currentStep > 7) {
      onComplete();
    }
  }, [state.currentStep, onComplete]);

  if (!initialized) return null;

  const steps: Record<number, React.ReactNode> = {
    1: <Step1Mode />,
    2: <Step2Income />,
    3: <Step3Expenses />,
    4: <Step4Savings />,
    5: <Step5Goals />,
    6: <Step6Property />,
    7: <Step7CustomGoals />,
  };

  const hasProperty = state.goals.includes('property');
  const hasOther = state.goals.includes('other');
  const stepItems: StepItem[] = [
    ...BASE_STEPS,
    ...(hasProperty ? [{ step: 6, label: 'Nemovitost' }] : []),
    ...(hasOther ? [{ step: 7, label: 'Jiné cíle' }] : []),
  ];

  const handleStepClick = (step: number) => {
    if (state.completedSteps.includes(step) || step === state.currentStep) {
      dispatch({ type: 'GO_TO_STEP', step });
    }
  };

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 border border-transparent p-6 sm:p-8">
        <StepIndicator
          currentStep={state.currentStep}
          steps={stepItems}
          completedSteps={state.completedSteps}
          onStepClick={handleStepClick}
        />
        {steps[state.currentStep] ?? null}
      </div>
    </WizardContext.Provider>
  );
}
