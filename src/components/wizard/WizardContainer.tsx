import { useReducer, useEffect, useState } from 'react';
import { WizardContext, wizardReducer, createInitialState } from '../../store/wizardStore';
import { saveState, loadState } from '../../store/localStorage';
import StepIndicator from './StepIndicator';
import Step1Mode from './steps/Step1Mode';
import Step2Income from './steps/Step2Income';
import Step3Expenses from './steps/Step3Expenses';
import Step4Savings from './steps/Step4Savings';
import Step5Goals from './steps/Step5Goals';
import Step6Property from './steps/Step6Property';

const TOTAL_STEPS = 7; // 6 wizard steps + step 7 = results

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
    if (state.currentStep > 6) {
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
  };

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <StepIndicator
          currentStep={state.currentStep}
          totalSteps={TOTAL_STEPS - 1}
          completedSteps={state.completedSteps}
        />
        {steps[state.currentStep] ?? null}
      </div>
    </WizardContext.Provider>
  );
}
