import { useWizard } from '../../../store/wizardStore';
import { totalMonthlyExpenses } from '../../../engine/cashflow';
import NumberInput from '../../ui/NumberInput';
import StepNavigation from '../StepNavigation';

export default function Step4Savings() {
  const { state, dispatch } = useWizard();
  const recommendedReserve = totalMonthlyExpenses(state) * 3;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vaše úspory</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Zadejte celkovou částku, kterou máte odloženou na spořicím účtu, termínovaném vkladu nebo v hotovosti.
        Nemusí to být vše, co máte, jen to, s čím můžete pracovat.
      </p>

      <NumberInput
        label="Celkové úspory"
        value={state.savings.totalSavings}
        onChange={(v) => dispatch({ type: 'UPDATE_SAVINGS', field: 'totalSavings', value: v })}
        tooltip="Kolik máte celkem naspořeno a jste ochotni použít na své finanční cíle."
        step={50000}
      />

      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-sm text-blue-700">
        Doporučená finanční rezerva (3 měsíce výdajů):{' '}
        <span className="font-semibold">{recommendedReserve.toLocaleString('cs-CZ')} Kč</span>
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
      />
    </div>
  );
}
