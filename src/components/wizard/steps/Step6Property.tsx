import { useWizard } from '../../../store/wizardStore';
import { DEFAULTS, DEFAULTS_DATE } from '../../../engine/defaults';
import { requiredDownPayment, monthlyMortgagePayment, downPaymentFraction, youngestApplicantAge, oldestApplicantAge } from '../../../engine/mortgage';
import { totalMonthlyExpenses } from '../../../engine/cashflow';
import NumberInput from '../../ui/NumberInput';
import StepNavigation from '../StepNavigation';

export default function Step6Property() {
  const { state, dispatch } = useWizard();
  const price = state.property.targetPrice;
  const rate = state.property.mortgageRate ?? DEFAULTS.property.mortgageRate;
  const term = state.property.loanTermYears ?? DEFAULTS.property.loanTermYears;
  const dpFraction = downPaymentFraction(state);
  const reqDpPct = Math.round(dpFraction * 100);
  const reqDp = requiredDownPayment(price, dpFraction);
  const totalSavings = state.savings.totalSavings;

  // Default down payment: required fraction of price or all savings (whichever is less)
  const dpValue = state.savings.downPaymentFromSavings ?? Math.min(totalSavings, reqDp);
  const reserve = totalSavings - dpValue;
  const loanAmount = Math.max(0, price - dpValue);
  const payment = monthlyMortgagePayment(loanAmount, rate, term);
  const dpPercent = price > 0 ? ((dpValue / price) * 100).toFixed(1) : '0';
  const recommendedReserve = totalMonthlyExpenses(state) * 3;
  const lowReserve = reserve < recommendedReserve && reserve < totalSavings;

  const hasOther = state.goals.includes('other');
  const youngest = youngestApplicantAge(state);
  const oldest = oldestApplicantAge(state);
  // Splatnost hypotéky nad obvyklou hranici (banka chce doplacení do ~70 let)
  const ageAtPayoff = oldest !== undefined ? oldest + term : undefined;
  const termTooLongForAge = ageAtPayoff !== undefined && ageAtPayoff > DEFAULTS.mortgageMaxAge;

  const setDownPayment = (v: number) => {
    const clamped = Math.max(0, Math.min(v, totalSavings));
    dispatch({ type: 'UPDATE_SAVINGS', field: 'downPaymentFromSavings', value: clamped });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Cílová nemovitost</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Zadejte parametry nemovitosti, kterou chcete koupit.</p>

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nemovitost a úspory</h3>
      <NumberInput
        label="Cílová cena nemovitosti"
        value={price}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'targetPrice', value: v })}
        tooltip="Cena včetně DPH, bez nákladů na rekonstrukci."
        min={500000}
        step={50000}
        error={price > 0 && price < 500000 ? 'Zkontrolujte zadanou cenu (min. 500 000 Kč)' : undefined}
      />

      {/* Akontace dle věku (ČNB: žadatelé do 36 let → LTV až 90 %) */}
      {youngest !== undefined ? (
        <div className="mb-6 text-xs text-gray-500 dark:text-gray-400">
          {youngest < 36
            ? `Nejmladšímu žadateli je ${youngest} let — díky vyššímu LTV (do 36 let) stačí akontace ${reqDpPct} % místo 20 %.`
            : `Nejmladšímu žadateli je ${youngest} let — povinná akontace je ${reqDpPct} % (LTV 80 %).`}
        </div>
      ) : (
        <div className="mb-6 text-xs text-gray-500 dark:text-gray-400">
          Tip: zadejte věk v kroku <span className="font-medium">Příjmy</span> — žadatelům do 36 let stačí díky vyššímu LTV akontace jen 10 %.
        </div>
      )}

      {/* Down payment allocation section */}
      {totalSavings > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Jak rozdělíte své úspory?</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Máte celkem {totalSavings.toLocaleString('cs-CZ')} Kč
          </p>

          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
            Akontace: <span className="font-semibold">{dpValue.toLocaleString('cs-CZ')} Kč</span>
            {' '}
            <span className={`text-xs ${Number(dpPercent) >= reqDpPct ? 'text-green-600' : 'text-amber-600'}`}>
              ({dpPercent} % z ceny nemovitosti)
            </span>
          </label>

          <input
            type="range"
            min={0}
            max={totalSavings}
            step={10000}
            value={dpValue}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          <div className="flex justify-between text-xs text-gray-400 mt-1 mb-3">
            <span>0 Kč</span>
            <span>{totalSavings.toLocaleString('cs-CZ')} Kč</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Zbývající rezerva:</span>
            <span className="font-semibold text-gray-900 dark:text-white">{reserve.toLocaleString('cs-CZ')} Kč</span>
          </div>

          {lowReserve && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Rezerva je nízká. Doporučujeme mít stranou aspoň {recommendedReserve.toLocaleString('cs-CZ')} Kč (3 měsíce výdajů) pro nečekané situace.
            </p>
          )}
        </div>
      )}

      <NumberInput
        label="Odhadované náklady na bydlení při vlastnictví"
        value={state.property.ownershipCosts ?? DEFAULTS.property.ownershipCosts}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'ownershipCosts', value: v })}
        tooltip="Při vlastnictví platíte energie stejně jako v nájmu, ale přibude fond oprav (pro byt v SVJ typicky 1 000–3 000 Kč/měsíc) a pojistka nemovitosti (cca 500–1 500 Kč/měsíc)."
        step={500}
      />

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">Parametry hypotéky</h3>
      <NumberInput
        label="Úroková sazba hypotéky"
        value={Math.round(rate * 1000) / 10}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'mortgageRate', value: v / 100 })}
        tooltip={`Průměrná sazba dle ČNB (${DEFAULTS_DATE}). Můžete upravit dle vaší nabídky.`}
        suffix="%"
        min={0.1}
        max={20}
        step={0.1}
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Délka hypotéky</label>
        <select
          value={term}
          onChange={(e) => dispatch({ type: 'UPDATE_PROPERTY', field: 'loanTermYears', value: parseInt(e.target.value) })}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[15, 20, 25, 30].map((y) => (
            <option key={y} value={y}>{y} let</option>
          ))}
        </select>
        {termTooLongForAge && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            Při délce {term} let by hypotéka byla doplacena ve věku {ageAtPayoff} let. Banky obvykle chtějí splacení do {DEFAULTS.mortgageMaxAge} let — počítejte s kratší dobou splácení (a vyšší splátkou), nebo mladším spolužadatelem.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doba fixace úrokové sazby</label>
        <select
          value={state.property.fixationYears ?? DEFAULTS.property.fixationYears}
          onChange={(e) => dispatch({ type: 'UPDATE_PROPERTY', field: 'fixationYears', value: parseInt(e.target.value) })}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[1, 3, 5, 7, 10].map((y) => (
            <option key={y} value={y}>{y} {y === 1 ? 'rok' : y < 5 ? 'roky' : 'let'}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">Po dobu fixace máte garantovanou úrokovou sazbu. Po jejím konci se sazba přepočítá dle aktuálních podmínek.</p>
      </div>

      <div className="mt-4 space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-300">Doporučená akontace ({reqDpPct} %):</span>
          <span className="font-semibold text-gray-900 dark:text-white">{reqDp.toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-300">Odhadovaná měsíční splátka:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{Math.round(payment).toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'GO_TO_STEP', step: hasOther ? 7 : 8 })}
        nextLabel={hasOther ? 'Další' : 'Zobrazit výsledky'}
        nextDisabled={price < 500000}
      />
    </div>
  );
}
