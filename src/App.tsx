import { useState, useCallback } from 'react';
import type { WizardState } from './types';
import WizardContainer from './components/wizard/WizardContainer';
import ResultsDashboard from './components/results/ResultsDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import AppBar from './components/ui/AppBar';
import Callout from './components/ui/Callout';
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

  // Cizí přehled: dokud uživatel nerozhodne, nic se neukládá. Banner je stejný
  // na výsledcích i v průvodci, jen se vkládá do jinak širokého sloupce.
  const conflictBanner = sharedConflict ? (
    <Callout tone="caution" border pad="p-4 rounded-xl" className="no-print mb-5">
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
    </Callout>
  ) : null;

  return (
    <div className="min-h-screen bg-page transition-colors">
      {/* Výsledky si lištu kreslí samy: patří do ní záložky a akce, a jen ony
          vědí, která záložka je vybraná. Průvodci a úvodu stačí značka. */}
      {view === 'results' && state ? (
        <ResultsDashboard
          state={state}
          onEdit={handleEdit}
          onReset={handleReset}
          onHome={() => setView('welcome')}
          banner={conflictBanner}
        />
      ) : (
        <>
          <AppBar onHome={() => setView('welcome')} />
          {/* Průvodce je širší než úvod: vedle formuláře stojí průběžný náhled.
              Samotný formulář zůstává úzký, čte se po řádcích. */}
          <main className={`mx-auto px-4 py-8 sm:py-10 ${view === 'wizard' ? 'max-w-app' : 'max-w-wizard'}`}>
            {conflictBanner}
            {view === 'wizard' ? (
              <WizardContainer onComplete={handleComplete} returnToStep={returnToStep} resumeSavedState={!returnToStep} />
            ) : (
              <WelcomeScreen onStart={handleStart} onResume={handleResume} />
            )}
          </main>
        </>
      )}

      <footer className="no-print mx-auto max-w-app px-4 pb-8 pt-4 text-center">
        <p className="text-xs text-ink-faint">
          MámNaTo? Orientační finanční přehled. Data zůstávají ve vašem prohlížeči.
        </p>
      </footer>
    </div>
  );
}

export default App;
