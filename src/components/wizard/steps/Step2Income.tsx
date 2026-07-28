import { useWizard } from '../../../store/wizardStore';
import NumberInput from '../../ui/NumberInput';
import NumField from '../../ui/NumField';
import Tooltip from '../../ui/Tooltip';
import StepNavigation from '../StepNavigation';
import { fieldClass } from '../../ui/fieldClass';

// Nepovinné pole pro věk (prázdné = nezadáno). Věk ovlivňuje akontaci,
// horizont spoření na důchod a splatnost hypotéky.
function AgeField({ label, value, onChange, tooltip }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  return (
    <div className="mb-4">
      <label className="flex items-center text-sm font-medium text-ink-label mb-1">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      {/* Jednotka jde přes prop `suffix`, ne vlastním absolutním popiskem:
          ten by ležel přes tlačítko + a sebral mu kliknutí. */}
      <NumField
        value={value}
        onChange={onChange}
        min={0}
        max={100}
        step={1}
        suffix="let"
        placeholder="např. 34"
        ariaLabel={label}
        className={fieldClass('w-full px-3 py-2.5 pr-10 text-base focus:outline-none focus:ring-2 focus:ring-blue-500')}
      />
    </div>
  );
}

export default function Step2Income() {
  const { state, dispatch } = useWizard();
  const isCouple = state.mode === 'couple' || state.mode === 'family';
  const isFamily = state.mode === 'family';

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-2">Vaše příjmy</h2>
      <p className="text-ink-muted mb-6">Zadejte čisté měsíční příjmy domácnosti. Věk je nepovinný, ale zpřesní výpočty.</p>

      <NumberInput
        label={isCouple ? 'Čistý měsíční příjem: osoba 1' : 'Můj čistý měsíční příjem'}
        value={state.income.person1NetMonthly}
        onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'person1NetMonthly', value: v })}
        tooltip="Zadejte čistou mzdu po zdanění a odvodech, tedy částku, která vám přijde na účet."
        step={1000}
      />

      <AgeField
        label={isCouple ? 'Věk: osoba 1' : 'Můj věk'}
        value={state.person1Age ?? 0}
        onChange={(v) => dispatch({ type: 'SET_PERSON_AGE', person: 1, value: v })}
        tooltip="Věk ovlivňuje výši akontace (žadatelé do 36 let mají díky vyššímu LTV akontaci jen 10 %), horizont spoření na důchod (do 65 let) a splatnost hypotéky. Nepovinné."
      />

      {isCouple && (
        <>
          <NumberInput
            label="Čistý měsíční příjem: osoba 2"
            value={state.income.person2NetMonthly ?? 0}
            onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'person2NetMonthly', value: v })}
            tooltip="Zadejte čistou mzdu druhé osoby po zdanění a odvodech."
            step={1000}
          />
          <AgeField
            label="Věk: osoba 2"
            value={state.person2Age ?? 0}
            onChange={(v) => dispatch({ type: 'SET_PERSON_AGE', person: 2, value: v })}
          />
        </>
      )}

      {isFamily && (
        <NumberInput
          label="Rodičovský příspěvek / ostatní příjmy (nyní)"
          value={state.income.parentalAllowance ?? 0}
          onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'parentalAllowance', value: v })}
          tooltip="Jen příjmy, které máte teď: rodičovský příspěvek, přídavky na děti, jiné pravidelné příjmy. Budoucí výpadek příjmu na rodičovské se počítá zvlášť ve výsledcích (karta Rodičovská)."
          step={1000}
        />
      )}

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm text-gray-600">
        Celkový příjem domácnosti:{' '}
        <span className="font-semibold text-ink">
          {(
            (state.income.person1NetMonthly ?? 0) +
            (state.income.person2NetMonthly ?? 0) +
            (state.income.parentalAllowance ?? 0)
          ).toLocaleString('cs-CZ')}{' '}
          Kč/měs.
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
