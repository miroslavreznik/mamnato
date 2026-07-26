import { useWizard } from '../../../store/wizardStore';
import { DEFAULTS, DEFAULTS_DATE } from '../../../engine/defaults';
import { requiredDownPayment, monthlyMortgagePayment, downPaymentFraction, youngestApplicantAge, oldestApplicantAge, mortgageRate, loanTermYears, fixationYears, suggestedRateForFixation, ownershipCostsEstimate, mortgageRateEstimate, totalProjectCost } from '../../../engine/mortgage';
import { formatYears, formatMonths, czk, czkMonthly, percentCompact } from '../../../engine/format';
import { evaluateRenovation, renovationWithOverrun } from '../../../engine/renovation';
import { totalMonthlyExpenses } from '../../../engine/cashflow';
import NumberInput from '../../ui/NumberInput';
import EstimateNote from '../../ui/EstimateNote';
import StepNavigation from '../StepNavigation';

// Fixace, které banky běžně nabízejí.
const FIXATION_CHOICES = [1, 3, 5, 7, 10];

// Sazba se zadává v procentech na jedno desetinné místo.
const pct = (rate: number) => (Math.round(rate * 1000) / 10).toLocaleString('cs-CZ');

// Podíl z ceny nemovitosti, ze kterého se odhadují náklady na vlastnictví.
// Schválně funkce, ne konstanta na úrovni modulu: ta by se vyhodnotila už při
// importu, tedy dřív, než se stihne vykreslit ErrorBoundary, a případná výjimka
// ve formátování by shodila celou stránku do bílé.
const ownershipPct = () => (DEFAULTS.ownershipCostRate * 100).toLocaleString('cs-CZ');

export default function Step6Property() {
  const { state, dispatch } = useWizard();
  const price = state.property.targetPrice;
  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const fixation = fixationYears(state);
  const rateEstimate = mortgageRateEstimate(state);
  const ownershipEstimate = ownershipCostsEstimate(state);
  const fixationDiff = rateEstimate.suggested - suggestedRateForFixation(5);
  const renovation = state.property.renovation;
  const renovationPhase = evaluateRenovation(state);
  const dpFraction = downPaymentFraction(state);
  const reqDpPct = Math.round(dpFraction * 100);
  // Akontace i úvěr se počítají z celé investice (cena + rekonstrukce),
  // protože banka půjčuje proti hodnotě nemovitosti po rekonstrukci.
  const projectCost = totalProjectCost(state);
  const reqDp = requiredDownPayment(projectCost, dpFraction);
  const totalSavings = state.savings.totalSavings;

  // Default down payment: required fraction of price or all savings (whichever is less)
  const dpValue = state.savings.downPaymentFromSavings ?? Math.min(totalSavings, reqDp);
  const reserve = totalSavings - dpValue;
  const loanAmount = Math.max(0, projectCost - dpValue);
  const payment = monthlyMortgagePayment(loanAmount, rate, term);
  const paymentAtFiveYearFix = monthlyMortgagePayment(loanAmount, suggestedRateForFixation(5), term);
  const dpPercent = projectCost > 0 ? ((dpValue / projectCost) * 100).toFixed(1) : '0';
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
            ? `Nejmladšímu žadateli je ${youngest} let, díky vyššímu LTV (do 36 let) stačí akontace ${reqDpPct} % místo 20 %.`
            : `Nejmladšímu žadateli je ${youngest} let, povinná akontace je ${reqDpPct} % (LTV 80 %).`}
        </div>
      ) : (
        <div className="mb-6 text-xs text-gray-500 dark:text-gray-400">
          Tip: zadejte věk v kroku <span className="font-medium">Příjmy</span>. Žadatelům do 36 let stačí díky vyššímu LTV akontace jen 10 %.
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
              ({dpPercent} % z celkové investice)
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
        value={ownershipEstimate.value}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'ownershipCosts', value: v })}
        tooltip={`Fond oprav, opravy a údržba, pojištění nemovitosti a daň z nemovitých věcí. Energie sem nepatří, ty platíte stejně jako v nájmu a máte je zadané v kroku Výdaje. Odhadujeme ${ownershipPct()} % z ceny nemovitosti ročně, což je běžné pravidlo pro údržbu a opravy. Skutečnost závisí hlavně na stáří domu a výši fondu oprav, klidně částku přepište.`}
        step={500}
      />

      <EstimateNote
        overridden={ownershipEstimate.overridden}
        className="-mt-2 mb-6 text-xs text-gray-500 dark:text-gray-400"
        explanation={
          <>
            Odhad: {ownershipPct()} % z ceny {czk(projectCost)} za rok, tedy{' '}
            {czkMonthly(ownershipEstimate.value)}. Zahrnuje fond oprav, údržbu, pojištění a daň
            z nemovitých věcí, ne energie.
          </>
        }
        suggestion={
          <>
            Částku máte zadanou ručně, s cenou nemovitosti se proto nemění. Odhad by pro tuhle cenu
            vycházel na {czk(ownershipEstimate.suggested)}.
          </>
        }
        revertLabel="Vrátit odhad podle ceny"
        onRevert={() => dispatch({ type: 'CLEAR_PROPERTY_ESTIMATE', field: 'ownershipCosts' })}
      />

      {/* Rekonstrukce je nepovinná. Dokud se nezapne, průvodce vypadá stejně
          jako dřív a nikdo se nemusí prokousávat poli, která ho netrápí. */}
      <div className="mb-6">
        {!renovation ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_RENOVATION', value: { cost: 0, months: 6, payingRentMeanwhile: true } })}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]"
          >
            + Budu rekonstruovat
          </button>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rekonstrukce po koupi</h3>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_RENOVATION', value: undefined })}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
              >
                Zrušit
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Rozpočet na rekonstrukci se přičítá k ceně, protože banka půjčuje proti hodnotě
              nemovitosti po rekonstrukci. Zvyšuje se tím i potřebná akontace.
            </p>

            <NumberInput
              label="Rozpočet na rekonstrukci"
              value={renovation.cost}
              onChange={(v) => dispatch({ type: 'SET_RENOVATION', value: { ...renovation, cost: v } })}
              tooltip="Materiál i práce. Stavební práce se běžně prodraží o 15 až 20 %, počítejte s tím i v rezervě."
              step={50000}
            />
            <NumberInput
              label="Jak dlouho potrvá"
              value={renovation.months}
              onChange={(v) => dispatch({ type: 'SET_RENOVATION', value: { ...renovation, months: Math.max(1, v) } })}
              tooltip="Po tuhle dobu se do nemovitosti nedá nastěhovat. Hypotéka se zatím čerpá postupně, takže se platí jen úrok z vyčerpané části."
              suffix="měs."
              min={1}
              max={48}
              step={1}
            />

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={renovation.payingRentMeanwhile}
                onChange={(e) => dispatch({ type: 'SET_RENOVATION', value: { ...renovation, payingRentMeanwhile: e.target.checked } })}
                className="mt-1 w-5 h-5 accent-blue-600 shrink-0"
              />
              <span>
                Během rekonstrukce budu dál platit současné bydlení
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Nájem i energie ({(state.expenses.rent + state.expenses.utilities).toLocaleString('cs-CZ')} Kč/měs.) poběží
                  souběžně s hypotékou. Odškrtněte, pokud budete bydlet zadarmo, třeba u rodiny.
                </span>
              </span>
            </label>

            {renovationPhase && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Během rekonstrukce zaplatíte bance míň.</span>{' '}
                  Hypotéka se čerpá postupně a z nevyčerpané části se neplatí nic, takže místo plné splátky{' '}
                  {Math.round(renovationPhase.fullPayment).toLocaleString('cs-CZ')} Kč jde jen o úrok:
                  na začátku {Math.round(renovationPhase.interestOnlyStart).toLocaleString('cs-CZ')} Kč,
                  na konci {Math.round(renovationPhase.interestOnlyEnd).toLocaleString('cs-CZ')} Kč měsíčně.
                </p>
                {renovation.payingRentMeanwhile && (
                  <p>
                    Se současným bydlením to dělá zhruba{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {Math.round(renovationPhase.housingDuringRenovation).toLocaleString('cs-CZ')} Kč měsíčně
                    </span>{' '}
                    po dobu {formatMonths(renovation.months)}. Volných vám při současných příjmech zbyde{' '}
                    {Math.round(renovationPhase.disposableDuringRenovation).toLocaleString('cs-CZ')} Kč.
                  </p>
                )}
                <p className="text-amber-600 dark:text-amber-400">
                  Počítejte s rezervou na prodražení. Při obvyklých 20 % navíc by rekonstrukce vyšla na{' '}
                  {renovationWithOverrun(state).toLocaleString('cs-CZ')} Kč a rozdíl se doplácí z vlastních peněz.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">Parametry hypotéky</h3>
      <NumberInput
        label="Úroková sazba hypotéky"
        value={Math.round(rate * 1000) / 10}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'mortgageRate', value: v / 100 })}
        tooltip={`Výchozí hodnota vychází z průměrné sazby nových hypoték dle ČBA (${DEFAULTS_DATE}) a upravuje se podle zvolené fixace. Vaše nabídka se může lišit podle banky i LTV, klidně ji přepište.`}
        suffix="%"
        min={0.1}
        max={20}
        step={0.1}
      />

      <EstimateNote
        overridden={rateEstimate.overridden}
        className="-mt-2 mb-4 text-xs text-gray-500 dark:text-gray-400"
        explanation="Sazba se odvozuje od zvolené fixace. Jakmile ji přepíšete, zůstane vaše hodnota."
        suggestion={
          <>
            Sazbu máte zadanou ručně, délka fixace s ní proto nehýbe. Pro fixaci na{' '}
            {formatYears(fixation)} by orientačně vycházela {percentCompact(rateEstimate.suggested)}.
          </>
        }
        revertLabel="Vrátit odhad podle fixace"
        onRevert={() => dispatch({ type: 'CLEAR_PROPERTY_ESTIMATE', field: 'mortgageRate' })}
      />

      <div className="mb-4">
        <label htmlFor="loan-term" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Délka hypotéky</label>
        <select
          id="loan-term"
          aria-label="Délka hypotéky"
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
            Při délce {term} let by hypotéka byla doplacena ve věku {ageAtPayoff} let. Banky obvykle chtějí splacení do {DEFAULTS.mortgageMaxAge} let, počítejte s kratší dobou splácení (a vyšší splátkou), nebo mladším spolužadatelem.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="fixation-years" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Doba fixace úrokové sazby</label>
        <select
          id="fixation-years"
          aria-label="Doba fixace úrokové sazby"
          value={fixation}
          onChange={(e) => dispatch({ type: 'UPDATE_PROPERTY', field: 'fixationYears', value: parseInt(e.target.value) })}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {/* U každé fixace je rovnou vidět, na jakou sazbu vede. Bez toho
              vypadá volba jako kosmetika, přitom mění splátku. */}
          {FIXATION_CHOICES.map((y) => (
            <option key={y} value={y}>
              {formatYears(y)}{rateEstimate.overridden ? '' : ` (odhad ${pct(suggestedRateForFixation(y))} %)`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Po dobu fixace máte garantovanou úrokovou sazbu. Po jejím konci se sazba přepočítá dle aktuálních podmínek.
          Delší fixace znamená jistotu, kterou si banka nechá zaplatit vyšší sazbou, kratší je levnější, ale dřív vás
          vystaví tomu, jaké budou sazby potom.
        </p>
        {!rateEstimate.overridden && fixationDiff !== 0 && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            Oproti nejběžnější pětileté fixaci je to o {pct(Math.abs(fixationDiff))} p. b.{' '}
            {fixationDiff > 0 ? 'dráž' : 'levněji'}, splátka je {fixationDiff > 0 ? 'vyšší' : 'nižší'} zhruba
            o {Math.abs(Math.round(payment - paymentAtFiveYearFix)).toLocaleString('cs-CZ')} Kč měsíčně.
          </p>
        )}
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
