import { useWizard } from '../../../store/wizardStore';
import { totalMonthlyIncome, totalMonthlyExpenses, necessaryMonthlyExpenses, discretionaryMonthlyExpenses } from '../../../engine/cashflow';
import NumberInput from '../../ui/NumberInput';
import Alert from '../../ui/Alert';
import StepNavigation from '../StepNavigation';

const categories: { field: string; label: string; tooltip: string; step: number; familyOnly?: boolean }[] = [
  { field: 'rent', label: 'Nájem (bez energií a poplatků)', tooltip: 'Zadejte čistou výši nájmu, tedy částku, kterou platíte pronajímateli za byt. Energie a zálohy zadejte do pole níže.', step: 1000 },
  { field: 'utilities', label: 'Energie, voda a poplatky za bydlení', tooltip: 'Zálohy na elektřinu, plyn, vodu, internet a případné zálohy do SVJ nebo správci domu.', step: 500 },
  { field: 'existingLoans', label: 'Stávající splátky úvěrů', tooltip: 'Splátky spotřebitelských úvěrů, leasingů, kreditních karet.', step: 500 },
  { field: 'insurance', label: 'Pojistky', tooltip: 'Životní pojištění, havarijní pojištění, cestovní pojištění.', step: 500 },
  { field: 'food', label: 'Jídlo a potraviny', tooltip: 'Nákupy potravin, obědy v práci, restaurace.', step: 500 },
  { field: 'transport', label: 'Doprava', tooltip: 'Pohonné hmoty, MHD, údržba auta, pojistka vozidla.', step: 500 },
  { field: 'children', label: 'Výdaje na děti', tooltip: 'Školka, kroužky, oblečení, kapesné, jídlo pro děti.', step: 500, familyOnly: true },
  { field: 'other', label: 'Zbytné výdaje (zábava, dovolená, koníčky, předplatné)', tooltip: 'Výdaje, které lze při výpadku příjmů omezit: zábava, sport, dovolená, restaurace nad rámec běžné stravy, předplatné služeb. Slouží k výpočtu doporučené rezervy a odolnosti rozpočtu.', step: 500 },
];

export default function Step3Expenses() {
  const { state, dispatch } = useWizard();
  const isFamily = state.mode === 'family';
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);
  const necessary = necessaryMonthlyExpenses(state);
  const discretionary = discretionaryMonthlyExpenses(state);
  const ratio = income > 0 ? expenses / income : 0;

  const visibleCategories = categories.filter((c) => !c.familyOnly || isFamily);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vaše výdaje</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Zadejte měsíční výdaje po kategoriích. Hodnoty jsou předvyplněny průměrem ČR.</p>

      {visibleCategories.map((cat) => (
        <NumberInput
          key={cat.field}
          label={cat.label}
          value={state.expenses[cat.field as keyof typeof state.expenses]}
          onChange={(v) => dispatch({ type: 'UPDATE_EXPENSES', field: cat.field, value: v })}
          tooltip={cat.tooltip}
          step={cat.step}
        />
      ))}

      <NumberInput
        label="Zůstatek stávajících úvěrů (nepovinné)"
        value={state.existingDebtPrincipal ?? 0}
        onChange={(v) => dispatch({ type: 'UPDATE_DEBT_PRINCIPAL', value: v })}
        tooltip="Zbývající jistina k doplacení u stávajících úvěrů (spotřebitelské úvěry, leasingy). Nezadávejte splátku, ale celkový zůstatek dluhu. Slouží k výpočtu ukazatele DTI dle ČNB, který se počítá z celkového dluhu."
        step={50000}
      />

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>Celkem výdaje:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{fmt(expenses)} Kč/měsíc</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>z toho nezbytné</span>
          <span>{fmt(necessary)} Kč</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>z toho zbytné</span>
          <span>{fmt(discretionary)} Kč</span>
        </div>
      </div>

      {ratio > 1 && (
        <div className="mt-3">
          <Alert type="error">Vaše výdaje převyšují příjmy. Doporučujeme nejdříve zkontrolovat rozpočet.</Alert>
        </div>
      )}

      {ratio > 0.9 && ratio <= 1 && (
        <div className="mt-3">
          <Alert type="warning">Vaše výdaje tvoří více než 90 % příjmů. Zbývá velmi málo na spoření.</Alert>
        </div>
      )}

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
      />
    </div>
  );
}
