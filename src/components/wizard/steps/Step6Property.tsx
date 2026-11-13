import { useWizard } from '../../../store/wizardStore';
import { DEFAULTS, DEFAULTS_DATE } from '../../../engine/defaults';
import { clampDownPayment, effectiveDownPayment, liquidSavings, minimumDownPayment, mortgagePayment, loanAmount, monthlyMortgagePayment, downPaymentFraction, youngestApplicantAge, oldestApplicantAge, mortgageRate, loanTermYears, fixationYears, suggestedRateForFixation, ownershipCostsEstimate, mortgageRateEstimate, totalProjectCost } from '../../../engine/mortgage';
import { formatYears, czk, czkMonthly, percentCompact } from '../../../engine/format';
import { purchaseCashPlan } from '../../../engine/purchasePlan';
import NumberInput from '../../ui/NumberInput';
import EstimateNote from '../../ui/EstimateNote';
import Disclosure from '../../ui/Disclosure';
import StepNavigation from '../StepNavigation';
import PurchaseFields from '../PurchaseFields';
import RenovationSection from './RenovationSection';
import { fieldClass } from '../../ui/fieldClass';

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
  const dpFraction = downPaymentFraction(state);
  const reqDpPct = Math.round(dpFraction * 100);
  const projectCost = totalProjectCost(state);
  const reqDp = minimumDownPayment(state);
  const totalSavings = liquidSavings(state);
  const maxDownPayment = clampDownPayment(state, totalSavings);
  const dpValue = effectiveDownPayment(state);
  const cashPlan = purchaseCashPlan(state);
  const payment = mortgagePayment(state);
  const paymentAtFiveYearFix = monthlyMortgagePayment(loanAmount(state), suggestedRateForFixation(5), term);
  const dpPercent = projectCost > 0 ? ((dpValue / projectCost) * 100).toFixed(1) : '0';

  const hasOther = state.goals.includes('other');
  const youngest = youngestApplicantAge(state);
  const oldest = oldestApplicantAge(state);
  // Splatnost hypotéky nad obvyklou hranici (banka chce doplacení do ~70 let)
  const ageAtPayoff = oldest !== undefined ? oldest + term : undefined;
  const termTooLongForAge = ageAtPayoff !== undefined && ageAtPayoff > DEFAULTS.mortgageMaxAge;

  const setDownPayment = (v: number) => {
    dispatch({ type: 'UPDATE_SAVINGS', field: 'downPaymentFromSavings', value: clampDownPayment(state, v) });
  };

  return (
    <div>
      <h2 className="type-section text-ink mb-2">Vlastní bydlení</h2>
      <p className="text-ink-muted mb-6">Zadejte parametry nemovitosti, kterou chcete koupit, a hypotéky na ni.</p>

      <h3 className="text-sm font-semibold text-ink-label mb-3">Nemovitost a úspory</h3>
      <NumberInput
        label="Cílová cena nemovitosti"
        value={price}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'targetPrice', value: v })}
        tooltip="Cena včetně DPH, bez nákladů na rekonstrukci."
        step={50000}
      />

      {/* Akontace dle věku (ČNB: žadatelé mladší 36 let → LTV až 90 %) */}
      {youngest !== undefined ? (
        <div className="mb-6 text-xs text-ink-muted">
          {youngest < 36
            ? `Nejmladšímu žadateli je ${youngest} let. Model počítá s úvěrem do 90 % hodnoty zástavy.`
            : `Nejmladšímu žadateli je ${youngest} let. Model počítá s úvěrem do 80 % hodnoty zástavy.`}
          {youngest < 36 && ' Rozhoduje věk při poskytnutí úvěru. Pokud je jen jednomu ze společných žadatelů méně než 36 let, ověřte podmínky u banky.'}
        </div>
      ) : (
        <div className="mb-6 text-xs text-ink-muted">
          Tip: zadejte věk v kroku <span className="font-medium">Příjmy</span>. Žadatelům mladším 36 let stačí díky vyššímu LTV akontace jen 10 %.
        </div>
      )}

      {/* Down payment allocation section */}
      {maxDownPayment > 0 && (
        <div className="mb-6 p-4 bg-sunken rounded-xl">
          <h3 className="text-sm font-semibold text-ink-label mb-1">Jak rozdělíte své úspory?</h3>
          <p className="text-xs text-ink-muted mb-3">
            Máte celkem {totalSavings.toLocaleString('cs-CZ')} Kč
          </p>

          <label className="block text-sm text-ink-label mb-2">
            Akontace: <span className="font-semibold">{dpValue.toLocaleString('cs-CZ')} Kč</span>
            {' '}
            <span className={`text-xs ${dpValue >= reqDp ? 'text-good' : 'text-caution'}`}>
              ({dpPercent} % z celkové investice)
            </span>
          </label>

          <input
            type="range"
            min={0}
            max={maxDownPayment}
            step={10000}
            value={dpValue}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            aria-label="Akontace z úspor"
            className="w-full h-2 bg-shell rounded-lg appearance-none cursor-pointer accent-brand"
          />

          <div className="flex justify-between text-xs text-ink-faint mt-1 mb-3">
            <span>0 Kč</span>
            <span>{czk(maxDownPayment)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-ink-body">Hotovost po zaplacení akontace a poplatků</span>
            <span className="font-semibold text-ink">{czk(Math.max(0, cashPlan.cashAfterClosing))}</span>
          </div>

          {cashPlan.cashGap > 0 && (
            <p className="mt-2 text-xs text-caution">
              Ke koupi s nastavenou rezervou chybí {czk(cashPlan.cashGap)}.
            </p>
          )}
        </div>
      )}

      <NumberInput
        label="Odhadované náklady na bydlení při vlastnictví"
        value={ownershipEstimate.value}
        onChange={(v) => dispatch({ type: 'UPDATE_PROPERTY', field: 'ownershipCosts', value: v })}
        tooltip={`Fond oprav, opravy a údržba, pojištění nemovitosti a daň z nemovitých věcí. Energie a zálohy se zadávají zvlášť. Odhadujeme ${ownershipPct()} % z ceny nemovitosti ročně, skutečnost závisí hlavně na stavu domu a výši fondu oprav.`}
        step={500}
      />

      <EstimateNote
        overridden={ownershipEstimate.overridden}
        className="-mt-2 mb-6 text-xs text-ink-muted"
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

      <RenovationSection state={state} onChange={(value) => dispatch({ type: 'SET_RENOVATION', value })} />

      <Disclosure summary="Upřesnit hodnotu bytu, výdaje a rezervu">
        <PurchaseFields state={state} onChange={(field, value) => {
          if (field === 'reserveMonths') dispatch({ type: 'SET_RESERVE_MONTHS', value });
          else dispatch({ type: 'UPDATE_PROPERTY', field, value });
        }} />
      </Disclosure>

      <h3 className="text-sm font-semibold text-ink-label mb-3 mt-6 pt-6 border-t border-line">Parametry hypotéky</h3>
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
        className="-mt-2 mb-4 text-xs text-ink-muted"
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
        <label htmlFor="loan-term" className="block text-sm font-medium text-ink-label mb-1">Délka hypotéky</label>
        <select
          id="loan-term"
          aria-label="Délka hypotéky"
          value={term}
          onChange={(e) => dispatch({ type: 'UPDATE_PROPERTY', field: 'loanTermYears', value: parseInt(e.target.value) })}
          className={fieldClass('w-full px-3 py-2.5 text-base')}
        >
          {[15, 20, 25, 30].map((y) => (
            <option key={y} value={y}>{y} let</option>
          ))}
        </select>
        {termTooLongForAge && (
          <p className="mt-1.5 text-xs text-caution">
            Při délce {term} let by hypotéka byla doplacena ve věku {ageAtPayoff} let. Banky obvykle chtějí splacení do {DEFAULTS.mortgageMaxAge} let, počítejte s kratší dobou splácení (a vyšší splátkou), nebo mladším spolužadatelem.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="fixation-years" className="block text-sm font-medium text-ink-label mb-1">Doba fixace úrokové sazby</label>
        <select
          id="fixation-years"
          aria-label="Doba fixace úrokové sazby"
          value={fixation}
          onChange={(e) => dispatch({ type: 'UPDATE_PROPERTY', field: 'fixationYears', value: parseInt(e.target.value) })}
          className={fieldClass('w-full px-3 py-2.5 text-base')}
        >
          {/* U každé fixace je rovnou vidět, na jakou sazbu vede. Bez toho
              vypadá volba jako kosmetika, přitom mění splátku. */}
          {FIXATION_CHOICES.map((y) => (
            <option key={y} value={y}>
              {formatYears(y)}{rateEstimate.overridden ? '' : ` (odhad ${pct(suggestedRateForFixation(y))} %)`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-faint">
          Po dobu fixace máte garantovanou úrokovou sazbu. Po jejím konci se sazba přepočítá dle aktuálních podmínek.
          Delší fixace znamená jistotu, kterou si banka nechá zaplatit vyšší sazbou, kratší je levnější, ale dřív vás
          vystaví tomu, jaké budou sazby potom.
        </p>
        {!rateEstimate.overridden && fixationDiff !== 0 && (
          <p className="mt-1.5 text-xs text-ink-muted">
            Oproti nejběžnější pětileté fixaci je to o {pct(Math.abs(fixationDiff))} p. b.{' '}
            {fixationDiff > 0 ? 'dráž' : 'levněji'}, splátka je {fixationDiff > 0 ? 'vyšší' : 'nižší'} zhruba
            o {Math.abs(Math.round(payment - paymentAtFiveYearFix)).toLocaleString('cs-CZ')} Kč měsíčně.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2 p-4 bg-sunken rounded-lg text-sm">
        <div className="flex justify-between">
          <span className="text-ink-body">{state.property.bankAppraisal == null && !state.property.renovation ? `Doporučená akontace (${reqDpPct} %):` : 'Minimální akontace podle hodnoty zástavy'}</span>
          <span className="font-semibold text-ink">{reqDp.toLocaleString('cs-CZ')} Kč</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-body">Měsíční splátka při plánované koupi</span>
          <span className="font-semibold text-ink">{Math.round(payment).toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'GO_TO_STEP', step: hasOther ? 7 : 8 })}
        nextLabel={hasOther ? 'Další' : 'Zobrazit výsledky'}
        nextDisabled={price <= 0}
      />
    </div>
  );
}
