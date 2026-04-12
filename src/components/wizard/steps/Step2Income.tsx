import { useWizard } from '../../../store/wizardStore';
import NumberInput from '../../ui/NumberInput';
import StepNavigation from '../StepNavigation';

export default function Step2Income() {
  const { state, dispatch } = useWizard();
  const isCouple = state.mode === 'couple' || state.mode === 'family';
  const isFamily = state.mode === 'family';

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vaše příjmy</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Zadejte čisté měsíční příjmy domácnosti.</p>

      <NumberInput
        label={isCouple ? 'Čistý měsíční příjem: osoba 1' : 'Můj čistý měsíční příjem'}
        value={state.income.person1NetMonthly}
        onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'person1NetMonthly', value: v })}
        tooltip="Zadejte čistou mzdu po zdanění a odvodech, tedy částku, která vám přijde na účet."
        step={1000}
      />

      {isCouple && (
        <NumberInput
          label="Čistý měsíční příjem: osoba 2"
          value={state.income.person2NetMonthly ?? 0}
          onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'person2NetMonthly', value: v })}
          tooltip="Zadejte čistou mzdu druhé osoby po zdanění a odvodech."
          step={1000}
        />
      )}

      {isFamily && (
        <NumberInput
          label="Rodičovský příspěvek / ostatní příjmy"
          value={state.income.parentalAllowance ?? 0}
          onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'parentalAllowance', value: v })}
          tooltip="Zahrnuje rodičovský příspěvek, přídavky na děti a jiné pravidelné příjmy."
          step={1000}
        />
      )}

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm text-gray-600">
        Celkový příjem domácnosti:{' '}
        <span className="font-semibold text-gray-900 dark:text-white">
          {(
            (state.income.person1NetMonthly ?? 0) +
            (state.income.person2NetMonthly ?? 0) +
            (state.income.parentalAllowance ?? 0)
          ).toLocaleString('cs-CZ')}{' '}
          Kč/měsíc
        </span>
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
      />
    </div>
  );
}
