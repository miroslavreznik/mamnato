import { useWizard } from '../../../store/wizardStore';
import type { UserMode } from '../../../types';
import StepNavigation from '../StepNavigation';

const modes: { value: UserMode; label: string; description: string; icon: string }[] = [
  { value: 'individual', label: 'Jsem sám/sama', description: 'Plánuji sám/sama jako jednotlivec', icon: '👤' },
  { value: 'couple', label: 'Jsme pár', description: 'Plánujeme společně jako pár bez dětí', icon: '👫' },
  { value: 'family', label: 'Jsme rodina s dětmi', description: 'Plánujeme jako rodina s jedním nebo více dětmi', icon: '👨‍👩‍👧' },
];

export default function Step1Mode() {
  const { state, dispatch } = useWizard();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Kdo plánuje?</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Vyberte, zda plánujete sám/sama, jako pár, nebo jako rodina.</p>

      <div className="grid gap-3">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => dispatch({ type: 'SET_MODE', mode: m.value })}
            className={`flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-colors min-h-[44px] ${
              state.mode === m.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 bg-white dark:bg-gray-700'
            }`}
          >
            <span className="text-2xl">{m.icon}</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{m.label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{m.description}</div>
            </div>
          </button>
        ))}
      </div>

      {state.mode === 'family' && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Počet dětí</label>
          <select
            value={state.numberOfChildren ?? 1}
            onChange={(e) => dispatch({ type: 'SET_NUMBER_OF_CHILDREN', count: parseInt(e.target.value) })}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}

      <StepNavigation
        showBack={false}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
        nextDisabled={!state.mode}
      />
    </div>
  );
}
