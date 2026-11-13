import { useState, useCallback, useEffect } from 'react';
import type { WizardState } from './types';
import WizardContainer from './components/wizard/WizardContainer';
import QuickMortgageWizard from './components/wizard/QuickMortgageWizard';
import ResultsDashboard from './components/results/ResultsDashboard';
import WelcomeScreen from './components/WelcomeScreen';
import AppBar from './components/ui/AppBar';
import Callout from './components/ui/Callout';
import { targetMonthlySurplus } from './engine/purchasePlan';
import { loadState, clearState, saveState } from './store/localStorage';
import { createInitialState } from './store/wizardStore';
import { createQuickMortgageState } from './store/quickMortgageState';
import { bootstrapSharedState, loadedFromShare, sharedStateToShow, sharedReplacesExisting, acceptSharedState, discardSharedState } from './store/shareLink';

type View = 'welcome' | 'wizard' | 'results';
type Flow = 'full' | NonNullable<WizardState['mortgageFlow']>;

const resultStep = (state: WizardState) => state.mortgageFlow ? 4 : 8;

function App() {
  // Sdílený přehled z odkazu (viz main.tsx) → rovnou výsledky.
  const [view, setView] = useState<View>(() => (loadedFromShare() ? 'results' : 'welcome'));
  const [state, setState] = useState(() => sharedStateToShow() ?? loadState());
  const [editing, setEditing] = useState(false);
  const [sharedConflict, setSharedConflict] = useState(sharedReplacesExisting);
  const [planRevision, setPlanRevision] = useState(0);

  useEffect(() => {
    const openSharedLink = () => {
      if (!bootstrapSharedState()) return;
      setState(sharedStateToShow());
      setSharedConflict(sharedReplacesExisting());
      setEditing(false);
      setPlanRevision((revision) => revision + 1);
      setView('results');
    };
    window.addEventListener('hashchange', openSharedLink);
    return () => window.removeEventListener('hashchange', openSharedLink);
  }, []);

  // Jeden rozpracovaný plán pro přehled i průvodce. Zámek v úložišti
  // brání zápisu, dokud příjemce sdílený plán výslovně nepřevezme.
  const handleStateChange = useCallback((next: WizardState) => {
    setState(next);
    saveState(next);
  }, []);

  const keepShared = () => {
    if (!state) return;
    acceptSharedState(state);
    setSharedConflict(false);
  };

  const keepOwn = () => {
    discardSharedState();
    const own = loadState();
    setState(own);
    setSharedConflict(false);
    setEditing(false);
    setPlanRevision((revision) => revision + 1);
    setView(own ? own.currentStep >= resultStep(own) ? 'results' : 'wizard' : 'welcome');
  };

  const handleComplete = useCallback((next: WizardState) => {
    handleStateChange({ ...next, currentStep: resultStep(next) });
    setEditing(false);
    setView('results');
  }, [handleStateChange]);

  const clearPlan = () => {
    if (state && !window.confirm('Opravdu chcete začít znovu? Všechna zadaná data budou smazána.')) {
      return false;
    }
    discardSharedState();
    setSharedConflict(false);
    clearState();
    setState(null);
    setEditing(false);
    return true;
  };

  const handleStart = (flow: Flow) => {
    if (!clearPlan()) return;
    handleStateChange(flow === 'full' ? createInitialState() : createQuickMortgageState(flow));
    setView('wizard');
  };

  const handleResume = () => {
    if (state) setView(state.currentStep >= resultStep(state) ? 'results' : 'wizard');
  };

  const handleEdit = () => {
    if (!state) return;
    const step = state.mortgageFlow ? 3 : state.goals.includes('property') ? 6 : state.goals.includes('other') ? 7 : 5;
    setState({ ...state, currentStep: step });
    setEditing(true);
    setView('wizard');
  };

  const handleExpandPlan = () => {
    if (!state?.mortgageFlow) return;
    handleStateChange({
      ...state,
      property: { ...state.property, targetMonthlySurplus: targetMonthlySurplus(state) },
      mortgageFlow: undefined,
      currentStep: 5,
      completedSteps: [1, 2, 3, 4],
    });
    setEditing(false);
    setView('wizard');
  };

  const handleReset = () => {
    if (clearPlan()) setView('welcome');
  };

  const goBackToResults = editing && state ? () => handleComplete(state) : undefined;

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
          key={planRevision}
          state={state}
          onStateChange={handleStateChange}
          onEdit={handleEdit}
          onExpandPlan={state.mortgageFlow ? handleExpandPlan : undefined}
          onReset={handleReset}
          onHome={() => setView('welcome')}
          banner={conflictBanner}
        />
      ) : (
        <>
          <AppBar onHome={() => setView('welcome')} />
          {/* Průvodce je širší než úvod: vedle formuláře stojí průběžný náhled.
              Samotný formulář zůstává úzký, čte se po řádcích. */}
          <main className={`mx-auto px-4 py-8 sm:py-10 ${view === 'wizard' ? 'max-w-app' : 'max-w-4xl'}`}>
            {conflictBanner}
            {view === 'wizard' && state ? (
              state.mortgageFlow ? (
                <QuickMortgageWizard
                  key={planRevision}
                  flow={state.mortgageFlow}
                  initialState={state}
                  onStateChange={handleStateChange}
                  onComplete={handleComplete}
                  onBackToResults={goBackToResults}
                />
              ) : (
                <WizardContainer
                  key={planRevision}
                  initialState={state}
                  onStateChange={handleStateChange}
                  onComplete={handleComplete}
                  onBackToResults={goBackToResults}
                />
              )
            ) : (
              <WelcomeScreen onStart={handleStart} onResume={handleResume} hasSavedData={!!state} />
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
