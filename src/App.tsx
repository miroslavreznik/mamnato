import { useState, useCallback } from 'react';
import type { WizardState } from './types';
import WizardContainer from './components/wizard/WizardContainer';
import ResultsDashboard from './components/results/ResultsDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import ThemeToggle from './components/ui/ThemeToggle';
import BrandMark from './components/ui/BrandMark';
import { loadState, clearState } from './store/localStorage';
import { loadedFromShare, sharedStateToShow, sharedReplacesExisting, acceptSharedState, discardSharedState } from './store/shareLink';

type View = 'welcome' | 'wizard' | 'results';

function App() {
  // Sdílený přehled z odkazu (viz main.tsx) → rovnou výsledky.
  const [view, setView] = useState<View>(() => (loadedFromShare() ? 'results' : 'welcome'));
  const [returnToStep, setReturnToStep] = useState<number | null>(null);
  // Cizí přehled se zobrazuje jen dokud se uživatel nerozhodne; do té doby je
  // zápis do localStorage zamčený, aby o svá data nepřišel ani úpravou hodnot.
  const [shared, setShared] = useState<WizardState | null>(() => sharedStateToShow());
  const [sharedConflict, setSharedConflict] = useState(() => sharedReplacesExisting());

  const keepShared = () => {
    if (!shared) return;
    acceptSharedState(shared);
    setSharedConflict(false);
  };

  const keepOwn = () => {
    discardSharedState();
    setShared(null);
    setSharedConflict(false);
    setView('results');
  };

  const handleComplete = useCallback(() => {
    setReturnToStep(null);
    setView('results');
  }, []);

  const handleStart = () => {
    discardSharedState();
    setShared(null);
    setSharedConflict(false);
    clearState();
    setReturnToStep(null);
    setView('wizard');
  };

  const handleResume = () => {
    setReturnToStep(null);
    setView('wizard');
  };

  const handleEdit = () => {
    // Dokud je cizí přehled otevřený, zobrazuje se on, ne uložená data.
  const state = shared ?? loadState();
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

  // Dokud je cizí přehled otevřený, zobrazuje se on, ne uložená data.
  const state = shared ?? loadState();

  return (
    <div className="min-h-screen bg-page transition-colors">
      <header className="no-print sticky top-0 z-40 backdrop-blur-md bg-card/70 border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => setView('welcome')}
            className="flex items-center gap-2.5 group"
            aria-label="Domů"
          >
            <BrandMark className="w-9 h-9" />
            <span className="text-lg font-bold tracking-tight text-ink">
              MámNaTo<span className="text-brand">?</span>
            </span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        {sharedConflict && (
          <div className="no-print mb-5 p-4 rounded-xl border border-line bg-tint-caution">
            <p className="text-sm font-semibold text-caution">
              Tenhle přehled je z odkazu od někoho jiného.
            </p>
            <p className="mt-1 text-sm text-caution">
              Svůj vlastní uložený přehled máte pořád k dispozici, tenhle se zatím nikam neuložil.
              Dokud se nerozhodnete, žádná změna se neukládá.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={keepShared}
                className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg bg-caution hover:opacity-90 text-page"
              >
                Uložit tenhle a přepsat svůj
              </button>
              <button
                onClick={keepOwn}
                className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg border border-caution text-caution hover:bg-tint-caution"
              >
                Zpět na můj přehled
              </button>
            </div>
          </div>
        )}

        {view === 'results' && state ? (
          <ResultsDashboard state={state} onEdit={handleEdit} onReset={handleReset} />
        ) : view === 'wizard' ? (
          <WizardContainer onComplete={handleComplete} returnToStep={returnToStep} resumeSavedState={!returnToStep} />
        ) : (
          <WelcomeScreen onStart={handleStart} onResume={handleResume} />
        )}
      </main>

      <footer className="no-print max-w-3xl mx-auto px-4 pb-8 pt-4 text-center">
        <p className="text-xs text-ink-faint">
          MámNaTo? Orientační finanční přehled. Data zůstávají ve vašem prohlížeči.
        </p>
      </footer>
    </div>
  );
}

export default App;
