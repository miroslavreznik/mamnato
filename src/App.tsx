import { useState, useCallback } from 'react';
import WizardContainer from './components/wizard/WizardContainer';
import ResultsDashboard from './components/results/ResultsDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import ThemeToggle from './components/ui/ThemeToggle';
import { loadState, clearState } from './store/localStorage';

type View = 'welcome' | 'wizard' | 'results';

function App() {
  const [view, setView] = useState<View>('welcome');
  const [returnToStep, setReturnToStep] = useState<number | null>(null);

  const handleComplete = useCallback(() => {
    setReturnToStep(null);
    setView('results');
  }, []);

  const handleStart = () => {
    clearState();
    setReturnToStep(null);
    setView('wizard');
  };

  const handleResume = () => {
    setReturnToStep(null);
    setView('wizard');
  };

  const handleEdit = () => {
    const state = loadState();
    const hasProperty = state?.goals.includes('property');
    setReturnToStep(hasProperty ? 6 : 5);
    setView('wizard');
  };

  const handleReset = () => {
    if (window.confirm('Opravdu chcete začít znovu? Všechna zadaná data budou smazána.')) {
      clearState();
      setView('welcome');
    }
  };

  const state = loadState();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <main className="max-w-3xl mx-auto px-4 py-8">
        {view === 'results' && state ? (
          <ResultsDashboard state={state} onEdit={handleEdit} onReset={handleReset} />
        ) : view === 'wizard' ? (
          <WizardContainer onComplete={handleComplete} returnToStep={returnToStep} resumeSavedState={!returnToStep} />
        ) : (
          <WelcomeScreen onStart={handleStart} onResume={handleResume} />
        )}
      </main>
    </div>
  );
}

export default App;
