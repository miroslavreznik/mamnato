import { useState, useCallback } from 'react';
import WizardContainer from './components/wizard/WizardContainer';
import ResultsDashboard from './components/results/ResultsDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import ThemeToggle from './components/ui/ThemeToggle';
import BrandMark from './components/ui/BrandMark';
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
    const hasOther = state?.goals.includes('other');
    setReturnToStep(hasProperty ? 6 : hasOther ? 7 : 5);
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-gray-50 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 transition-colors">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/70 dark:border-gray-800/80">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setView('welcome')}
            className="flex items-center gap-2.5 group"
            aria-label="Domů"
          >
            <BrandMark className="w-9 h-9" />
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              MámNaTo<span className="text-blue-600 dark:text-blue-400">?</span>
            </span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        {view === 'results' && state ? (
          <ResultsDashboard state={state} onEdit={handleEdit} onReset={handleReset} />
        ) : view === 'wizard' ? (
          <WizardContainer onComplete={handleComplete} returnToStep={returnToStep} resumeSavedState={!returnToStep} />
        ) : (
          <WelcomeScreen onStart={handleStart} onResume={handleResume} />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-8 pt-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-600">
          MámNaTo? — orientační finanční přehled. Data zůstávají ve vašem prohlížeči.
        </p>
      </footer>
    </div>
  );
}

export default App;
