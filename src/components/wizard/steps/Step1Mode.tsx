import { useWizard } from '../../../store/wizardStore';
import type { UserMode } from '../../../types';
import StepNavigation from '../StepNavigation';
import { fieldClass } from '../../ui/fieldClass';

// Popisky mluví o tom, jak žijete dnes, ne o tom, co plánujete. Rozdíl je
// podstatný: kdo teprve dítě zvažuje, vybírá „Jsme pár" a dítě si o pár kroků
// dál přidá jako cíl. Dřív z popisků plynulo, že si má rovnou zvolit rodinu,
// a výdaje na dítě se mu tak započítaly, jako by ho měl už teď.
const modes: { value: UserMode; label: string; description: string; icon: string }[] = [
  { value: 'individual', label: 'Jsem sám/sama', description: 'Teď žiji sám/sama, příjmy i výdaje jsou jen moje', icon: '👤' },
  { value: 'couple', label: 'Jsme pár', description: 'Teď žijeme ve dvou a děti zatím nemáme (i když je plánujeme)', icon: '👫' },
  { value: 'family', label: 'Jsme rodina s dětmi', description: 'Už teď s námi žije jedno nebo víc dětí', icon: '👨‍👩‍👧' },
];

export default function Step1Mode() {
  const { state, dispatch } = useWizard();

  return (
    <div>
      <h2 className="type-section text-ink mb-2">Kdo plánuje?</h2>
      <p className="text-ink-muted mb-2">
        Vyberte, jak žijete <span className="font-medium">teď</span>, ne co plánujete.
      </p>
      <p className="text-sm text-ink-faint mb-6">
        Dítě, které teprve plánujete, si přidáte jako cíl v kroku <span className="font-medium">Cíle</span>.
        Tady jde o vaši dnešní situaci, aby výpočet vycházel z toho, co skutečně platíte.
      </p>

      <div className="grid gap-3">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => dispatch({ type: 'SET_MODE', mode: m.value })}
            aria-pressed={state.mode === m.value}
            data-testid={`mode-${m.value}`}
            className={`flex items-center gap-4 p-4 border-2 rounded-xl text-left transition-colors min-h-[44px] ${
              state.mode === m.value
                ? 'border-ink bg-tint-brand'
                : 'border-line hover:border-line-strong bg-card'
            }`}
          >
            <span className="text-2xl">{m.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-ink">
                {m.label}
                {/* Značka, ne jen barva: v tisku se pozadí běžně nevytiskne
                    a z reportu pak nejde poznat, co bylo vybrané. */}
                {state.mode === m.value && <span className="ml-2 text-brand">✓ vybráno</span>}
              </div>
              <div className="text-sm text-ink-muted">{m.description}</div>
            </div>
          </button>
        ))}
      </div>

      {state.mode === 'family' && (
        <div className="mt-4">
          <label htmlFor="children-count" className="block text-sm font-medium text-ink-label mb-1">Počet dětí</label>
          <select
            id="children-count"
            aria-label="Počet dětí"
            value={state.numberOfChildren ?? 1}
            onChange={(e) => dispatch({ type: 'SET_NUMBER_OF_CHILDREN', count: parseInt(e.target.value) })}
            className={fieldClass('w-full px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ink bg-card')}
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
