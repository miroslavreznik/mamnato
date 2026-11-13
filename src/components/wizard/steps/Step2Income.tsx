import { useWizard } from '../../../store/wizardStore';
import NumberInput from '../../ui/NumberInput';
import NumField from '../../ui/NumField';
import Tooltip from '../../ui/Tooltip';
import StepNavigation from '../StepNavigation';
import { fieldClass } from '../../ui/fieldClass';
import { totalMonthlyIncome } from '../../../engine/cashflow';

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
        className={fieldClass('w-full px-3 py-2.5 pr-10 text-base')}
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
      <h2 className="type-section text-ink mb-2">Vaše příjmy</h2>
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
        tooltip="Věk ovlivňuje výši akontace (žadatelé mladší 36 let mají díky vyššímu LTV akontaci jen 10 %), horizont spoření na důchod (do 65 let) a splatnost hypotéky. Nepovinné."
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

      {(isFamily || !!state.income.otherNetMonthly || !!state.income.parentalAllowance) && (
        <>
          <NumberInput
            label="Další pravidelné příjmy"
            value={state.income.otherNetMonthly ?? 0}
            onChange={(v) => dispatch({ type: 'UPDATE_INCOME', field: 'otherNetMonthly', value: v })}
          />
          <NumberInput
            label="Rodičovský příspěvek, který už pobíráte"
            value={state.income.parentalAllowance ?? 0}
            onChange={(v) => {
              if (v > 0 && !state.income.parentalAllowance && state.income.parentalAllowanceRemainingMonths == null) {
                dispatch({ type: 'UPDATE_INCOME', field: 'parentalAllowanceRemainingMonths', value: 12 });
              }
              dispatch({ type: 'UPDATE_INCOME', field: 'parentalAllowance', value: v });
            }}
          />
          {!!state.income.parentalAllowance && (
            <>
              <NumberInput
                label="Za kolik měsíců rodičovský příspěvek skončí"
                value={state.income.parentalAllowanceRemainingMonths ?? 0}
                onChange={(v) => dispatch({
                  type: 'UPDATE_INCOME',
                  field: 'parentalAllowanceRemainingMonths',
                  value: Math.round(Math.max(0, Math.min(1200, v))),
                })}
                tooltip="Nula znamená, že příspěvek skončil. Pokud po rodičovské čekáte jiný příjem, můžete ho porovnat v části Co kdyby."
                suffix="měsíců"
                step={1}
                max={1200}
              />
              {state.income.parentalAllowanceRemainingMonths == null && (
                <p className="mb-4 text-sm text-caution">
                  Starší plán počítá s touto částkou bez konce. Doplňte zbývající měsíce nebo částku přesuňte mezi pravidelné příjmy.
                </p>
              )}
            </>
          )}
        </>
      )}

      <div className="mt-4 p-3 bg-sunken rounded-lg text-sm text-ink-body">
        Celkový příjem domácnosti:{' '}
        <span className="font-semibold text-ink">
          {totalMonthlyIncome(state).toLocaleString('cs-CZ')}{' '}
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
