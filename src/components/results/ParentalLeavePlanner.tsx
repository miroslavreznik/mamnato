import type { WizardState, ParentalLeave } from '../../types';
import {
  evaluateParentalLeave,
  defaultMonthlyBenefit,
  defaultCaringParent,
  parentSalary,
} from '../../engine/parentalLeave';
import NumField from '../ui/NumField';

interface Props {
  state: WizardState;
  onChange: (v: ParentalLeave | undefined) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');

export default function ParentalLeavePlanner({ state, onChange }: Props) {
  const pl = state.parentalLeave;
  const enabled = !!pl?.enabled;
  const impact = evaluateParentalLeave(state);

  const enable = () => {
    const durationMonths = 36;
    onChange({
      enabled: true,
      parent: defaultCaringParent(state),
      durationMonths,
      monthlyBenefit: defaultMonthlyBenefit(durationMonths),
    });
  };
  const update = (patch: Partial<ParentalLeave>) => {
    if (pl) onChange({ ...pl, ...patch });
  };

  if (!enabled || !impact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Rodičovská: co udělá s rozpočtem</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Když jeden z vás zůstane doma s dítětem, na čas klesne příjem (mateřská a rodičovská bývají nižší než mzda). Spočítejte si, jestli to rozpočet — a hlavně splátka hypotéky — během volna zvládne.
        </p>
        <button
          onClick={enable}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
        >
          Spočítat dopad rodičovské
        </button>
      </div>
    );
  }

  const hasProperty = state.goals.includes('property');
  const leaveNeg = impact.disposableDuringLeave < 0;
  const afterPurchase = impact.disposableDuringLeaveAfterPurchase;
  const afterNeg = afterPurchase !== null && afterPurchase < 0;

  const tile = (label: string, value: number, opts?: { negativeBad?: boolean }) => {
    const bad = opts?.negativeBad && value < 0;
    return (
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        <p className={`text-xl font-bold ${bad ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
          {value >= 0 ? '' : '−'}{fmt(Math.abs(value))} <span className="text-sm font-normal text-gray-400">Kč/měs</span>
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rodičovská: co udělá s rozpočtem</h3>
        <button onClick={() => onChange(undefined)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
          Skrýt
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Budoucí scénář: po dobu volna nahradí mzdu pečujícího rodiče dávky. Parametry si upravte podle sebe.
      </p>

      {/* Ovládání scénáře */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Doma zůstane</label>
          <div className="flex gap-1">
            {([1, 2] as const).map((p) => (
              <button
                key={p}
                onClick={() => update({ parent: p })}
                className={`flex-1 px-2 py-2 text-sm rounded-lg border ${
                  impact.parent === p
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                Osoba {p}
                <span className="block text-[10px] text-gray-400">{fmt(parentSalary(state, p))} Kč</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Délka volna (měsíce)</label>
          <NumField
            value={impact.durationMonths}
            onChange={(v) => update({ durationMonths: v })}
            min={1}
            max={48}
            ariaLabel="Délka volna v měsících"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Příjem během volna (dávky)</label>
          <NumField
            value={impact.monthlyBenefit}
            onChange={(v) => update({ monthlyBenefit: v })}
            min={0}
            ariaLabel="Měsíční příjem během volna"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
          />
          <p className="mt-1 text-[10px] text-gray-400">≈ rodičovská 350 000 Kč / {impact.durationMonths} měs. Mateřská bývá zpočátku vyšší.</p>
        </div>
      </div>

      {/* Dopad */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {tile('Příjem nyní', impact.incomeNow)}
        {tile('Příjem během volna', impact.incomeDuringLeave)}
        {tile('Volná rezerva nyní', impact.disposableNow, { negativeBad: true })}
        {tile('Volná rezerva během volna', impact.disposableDuringLeave, { negativeBad: true })}
      </div>

      {hasProperty && afterPurchase !== null && (
        <div className={`p-3 rounded-lg mb-3 text-sm ${afterNeg ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'}`}>
          {afterNeg ? (
            <>Po koupi byste během rodičovské byli <strong>−{fmt(Math.abs(afterPurchase))} Kč/měs v mínusu</strong> — splátku hypotéky a nezbytné výdaje byste z běžného příjmu neutáhli. Počítejte s rezervou na toto období, levnější nemovitostí nebo kratším volnem.</>
          ) : (
            <>I po koupi byste během rodičovské měli <strong>+{fmt(afterPurchase)} Kč/měs</strong> po zaplacení splátky a nezbytných výdajů. Rozpočet volno ustojí.</>
          )}
        </div>
      )}

      {leaveNeg && !hasProperty && (
        <div className="p-3 rounded-lg mb-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          Během rodičovské by výdaje převýšily příjem o <strong>{fmt(Math.abs(impact.disposableDuringLeave))} Kč/měs</strong>. Budete potřebovat rezervu na toto období.
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Za celé volno ({impact.durationMonths} měs.) klesne příjem dohromady o{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{fmt(impact.savingsLostTotal)} Kč</span>
        {' '}— o tolik méně naspoříte (nebo tolik budete potřebovat v rezervě).
      </p>
    </div>
  );
}
