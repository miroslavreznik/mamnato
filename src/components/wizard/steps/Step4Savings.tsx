import { useState } from 'react';
import { useWizard } from '../../../store/wizardStore';
import { totalMonthlyExpenses } from '../../../engine/cashflow';
import NumberInput from '../../ui/NumberInput';
import StepNavigation from '../StepNavigation';

export default function Step4Savings() {
  const { state, dispatch } = useWizard();
  const recommendedReserve = totalMonthlyExpenses(state) * 3;

  const breakdown = state.savings.breakdown;
  const [showBreakdown, setShowBreakdown] = useState(!!breakdown);

  const current = breakdown?.current ?? 0;
  const savingsAccount = breakdown?.savingsAccount ?? 0;
  const investments = breakdown?.investments ?? 0;
  const breakdownTotal = current + savingsAccount + investments;

  // Upozornění: velká část úspor leží na běžném účtu (bez zhodnocení).
  const idleCashWarning =
    breakdownTotal > 0 &&
    current / breakdownTotal > 0.5 &&
    current >= 100000;

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
        disabled={showBreakdown}
      />

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showBreakdown ? '− Skrýt rozdělení úspor' : '+ Rozdělit úspory (volitelné)'}
        </button>
      </div>

      {showBreakdown && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Rozdělením úspor zjistíte, kolik peněz zbytečně leží bez zhodnocení. Celkové úspory se dopočítají automaticky.
          </p>

          <NumberInput
            label="Běžný účet"
            value={current}
            onChange={(v) => dispatch({ type: 'UPDATE_SAVINGS_BREAKDOWN', field: 'current', value: v })}
            tooltip="Peníze na běžném účtu. Typicky bez úroku nebo s minimálním úrokem, takže ztrácejí tempo s inflací."
            step={10000}
          />
          <NumberInput
            label="Spořicí účet / termínovaný vklad"
            value={savingsAccount}
            onChange={(v) => dispatch({ type: 'UPDATE_SAVINGS_BREAKDOWN', field: 'savingsAccount', value: v })}
            tooltip="Peníze na spořicím účtu nebo termínovaném vkladu, které nesou úrok."
            step={10000}
          />
          <NumberInput
            label="Investice (fondy, ETF, akcie)"
            value={investments}
            onChange={(v) => dispatch({ type: 'UPDATE_SAVINGS_BREAKDOWN', field: 'investments', value: v })}
            tooltip="Hodnota investičního portfolia — podílové fondy, ETF, akcie a podobně."
            step={10000}
          />

          <div className="flex justify-between text-sm pt-2 border-t dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-400">Celkem</span>
            <span className="font-semibold text-gray-900 dark:text-white">{breakdownTotal.toLocaleString('cs-CZ')} Kč</span>
          </div>

          {idleCashWarning && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Více než polovina úspor leží na běžném účtu ({current.toLocaleString('cs-CZ')} Kč), kde je inflace postupně znehodnocuje.
              Zvažte přesun částky, kterou nepotřebujete okamžitě, na spořicí účet nebo do investic.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-sm text-blue-700">
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
