import type { WizardState } from '../../types';
import {
  requiredDownPayment,
  downPaymentGap,
  downPaymentFraction,
  monthlyMortgagePayment,
  monthsToSaveDownPayment,
  effectiveDownPayment,
  totalLoanInterest,
  mortgageRate,
  loanTermYears,
  loanAmount as loanAmountOf,
  mortgagePayment,
  ownershipCosts as ownershipCostsOf,
  fixationYears as fixationYearsOf,
} from '../../engine/mortgage';
import { necessaryMonthlyExpenses } from '../../engine/cashflow';
import { formatMonths, formatYears } from '../../engine/format';
import { ltvRateAdvice, paymentAtRate } from '../../engine/rateGuidance';
import { purchaseOneOffCosts } from '../../engine/purchaseCosts';
import Tooltip from '../ui/Tooltip';

// Orientační dlouhodobý výnos akcií pro srovnání alternativy k akontaci.
const STOCK_RETURN = 0.07;
// Rozsah posuvníku sazby, pokrývá historické minimum i vyšší scénáře.
const RATE_MIN = 0.02;
const RATE_MAX = 0.09;

interface Props {
  state: WizardState;
  // Když je předáno, jde akontací hýbat přímo tady, změna se přes sdílený
  // stav promítne do celé stránky (splátka, DTI/DSTI, rezerva, časová osa…).
  onChangeDownPayment?: (value: number) => void;
  // Totéž pro úrokovou sazbu, druhá páka, která nejvíc hýbe splátkou.
  onChangeRate?: (value: number) => void;
}

export default function PropertyAffordability({ state, onChangeDownPayment, onChangeRate }: Props) {
  const price = state.property.targetPrice;
  const rate = mortgageRate(state);
  const term = loanTermYears(state);
  const fixationYears = fixationYearsOf(state);
  const dpFraction = downPaymentFraction(state);
  const dpPct = Math.round(dpFraction * 100);
  const dp = requiredDownPayment(price, dpFraction);
  const gap = downPaymentGap(state);
  const dpValue = effectiveDownPayment(state);
  const loanAmount = loanAmountOf(state);
  const payment = mortgagePayment(state);
  const months = monthsToSaveDownPayment(state);
  const totalSavings = state.savings.totalSavings;
  const reserve = totalSavings - dpValue;
  const dpOfPrice = price > 0 ? (dpValue / price) * 100 : 0;

  // (1) Co udělá +100 000 Kč akontace navíc: nižší splátka a ušetřené úroky.
  const STEP = 100000;
  const paymentDelta = loanAmount > STEP
    ? payment - monthlyMortgagePayment(loanAmount - STEP, rate, term)
    : payment;
  const interestDelta = totalLoanInterest(loanAmount, rate, term)
    - totalLoanInterest(Math.max(0, loanAmount - STEP), rate, term);

  // (2) Bezpečné maximum akontace: po koupi musí zbýt rezerva na 6 měsíců
  // nezbytných výdajů (s hypotékou místo nájmu).
  const ownershipCosts = ownershipCostsOf(state);
  const monthlyNeedAfter = Math.max(
    1,
    necessaryMonthlyExpenses(state) - state.expenses.rent - state.expenses.utilities + payment + ownershipCosts
  );
  const safeMax = Math.max(0, Math.min(totalSavings, totalSavings - 6 * monthlyNeedAfter));
  const safePct = totalSavings > 0 ? Math.round((safeMax / totalSavings) * 100) : 0;
  const reserveMonths = reserve / monthlyNeedAfter;

  // (3) Alternativa: co by zbylé peníze (mimo akontaci) mohly vydělat v akciích
  // vs. jistá úspora na úrocích, kdyby šly do akontace.
  const stockValue = reserve > 0 ? reserve * Math.pow(1 + STOCK_RETURN, term) : 0;
  const interestSavedByReserve = reserve > 0
    ? totalLoanInterest(loanAmount, rate, term) - totalLoanInterest(Math.max(0, loanAmount - reserve), rate, term)
    : 0;

  // (4) Sazba podle LTV: banky ji odstupňovávají, přechod pod 80 % LTV se vyplatí.
  const advice = ltvRateAdvice(state);
  const ltvPct = advice ? Math.round(advice.ltv * 100) : 0;
  // Riziko refixace: o kolik povyskočí splátka, když sazba stoupne o 1 p. b.
  const paymentPlus1pp = paymentAtRate(state, rate + 0.01) - payment;
  // Konec fixace uprostřed rodičovské je nejhorší možné načasování: splátka
  // povyskočí zrovna ve chvíli, kdy je rozpočet nejtenčí.
  const leaveMonths = state.parentalLeave?.enabled ? state.parentalLeave.durationMonths : 0;
  const fixationEndsDuringLeave = leaveMonths > 0 && fixationYears * 12 <= leaveMonths;

  // Jednorázové náklady koupě, které odejdou z rezervy hned na začátku.
  const oneOff = purchaseOneOffCosts(state);

  const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
  // Sazba česky s desetinnou čárkou (5,2 místo 5.2).
  const fmtRate = (r: number) =>
    (r * 100).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kalkulačka nemovitosti</h3>

      <div className="space-y-3 text-sm">
        <Row label="Cena nemovitosti" value={`${fmt(price)} Kč`} />
        <Row
          label={`Potřebná akontace (${dpPct} %)`}
          value={`${fmt(dp)} Kč`}
          tooltip={
            dpPct === 10
              ? 'Žadateli do 36 let banka půjčí až 90 % ceny (LTV), takže z vlastního stačí 10 %.'
              : 'Kolik banka požaduje zaplatit z vlastních peněz. Obvykle 20 % ceny nemovitosti (LTV 80 %), zbytek pokryje hypotéka.'
          }
        />
        <Row
          label="Pokryto z vlastních úspor"
          value={`${fmt(dpValue)} Kč`}
          tooltip="Kolik z vašich naspořených peněz vložíte do akontace. Můžete upravit posuvníkem níže. Vše se hned přepočítá."
        />
        <Row
          label="Chybějící akontace"
          value={`${fmt(gap)} Kč`}
          highlight={gap > 0 ? 'red' : 'green'}
          tooltip="Rozdíl mezi potřebnou akontací a tím, co pokryjete z úspor. Tuto částku je potřeba ještě naspořit, než se dá o hypotéku požádat."
        />

        {/* Posuvník akontace: hýbe celou stránkou přes sdílený stav */}
        {onChangeDownPayment && totalSavings > 0 && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kolik dát z úspor na akontaci</span>
              <span className={`text-xs ${dpOfPrice >= dpPct ? 'text-green-600' : 'text-amber-600'}`}>
                {dpOfPrice.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % z ceny
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StepButton
                onClick={() => onChangeDownPayment(Math.max(0, dpValue - 10000))}
                disabled={dpValue <= 0}
                label="Snížit akontaci"
              >
                −
              </StepButton>
              <input
                type="range"
                min={0}
                max={totalSavings}
                step={10000}
                value={dpValue}
                onChange={(e) => onChangeDownPayment(Number(e.target.value))}
                aria-label="Akontace z úspor"
                className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                style={{
                  background: `linear-gradient(to right, rgba(16,185,129,0.45) 0%, rgba(16,185,129,0.45) ${safePct}%, rgba(245,158,11,0.5) ${safePct}%, rgba(245,158,11,0.5) 100%)`,
                }}
              />
              <StepButton
                onClick={() => onChangeDownPayment(Math.min(totalSavings, dpValue + 10000))}
                disabled={dpValue >= totalSavings}
                label="Zvýšit akontaci"
              >
                +
              </StepButton>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 Kč</span>
              <span>{fmt(totalSavings)} Kč</span>
            </div>

            <div className="flex flex-wrap justify-between gap-x-2 text-sm mt-1.5">
              <span className="text-gray-600 dark:text-gray-400">Zbývající rezerva po akontaci:</span>
              <span className={`font-semibold ${reserve <= 0 ? 'text-red-600' : reserveMonths < 6 ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                {fmt(reserve)} Kč{reserve > 0 && isFinite(reserveMonths) ? ` (~${reserveMonths.toFixed(1)} měs. výdajů)` : ''}
              </span>
            </div>

            {/* (2) Bezpečná zóna: kolik maximálně dát, aby zbyla rezerva na 6 měsíců */}
            {safeMax > 0 ? (
              <p className={`mt-1.5 text-xs ${dpValue > safeMax ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {dpValue > safeMax
                  ? `Jste za bezpečnou hranicí. Nad ${fmt(safeMax)} Kč akontace zbyde rezerva na méně než 6 měsíců výdajů.`
                  : `Bezpečné maximum: ${fmt(safeMax)} Kč (zelená zóna), víc by nechalo rezervu pod 6 měsíců výdajů po koupi.`}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                Úspory zatím nestačí na akontaci a zároveň 6měsíční rezervu. Jakákoli akontace rezervu ukrojí.
              </p>
            )}

            <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-600 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              {/* (1) Cena/přínos každých +100 000 Kč */}
              <p>
                <span className="font-medium text-gray-700 dark:text-gray-300">Každých +100 000 Kč akontace:</span>{' '}
                splátka −{fmt(paymentDelta)} Kč/měs a na úrocích za {term} let ušetříte ~{fmt(interestDelta)} Kč, jistý efekt ve výši úrokové sazby ({fmtRate(rate)} %).
              </p>
              {/* (3) Alternativa: investovat zbytek místo vyšší akontace */}
              {reserve > 0 && loanAmount > 0 && (
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Alternativa:</span>{' '}
                  zbylých {fmt(reserve)} Kč mimo akontaci by v akciích (~{Math.round(STOCK_RETURN * 100)} % ročně) mohlo za {term} let vyrůst na ~{fmt(stockValue)} Kč (bez záruky). Stejná částka v akontaci by ušetřila jistých ~{fmt(interestSavedByReserve)} Kč na úrocích.
                </p>
              )}
              <p className="text-gray-400 dark:text-gray-500">
                Vyšší akontace = nižší splátka a DSTI, ale menší rezerva. Vše níže i v Souhrnu se přepočítává živě.
              </p>
            </div>
          </div>
        )}

        {/* Posuvník úrokové sazby: druhá hlavní páka splátky */}
        {onChangeRate && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                Úroková sazba
                <Tooltip text="Sazbu si nasmlouváte s bankou. Banky ji odstupňovávají podle LTV (jakou část ceny si půjčujete), čím víc dáte z vlastního, tím nižší sazbu obvykle dostanete. Posuňte a uvidíte, jak se změní splátka i celé výsledky." />
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtRate(rate)} % ročně</span>
            </div>
            <div className="flex items-center gap-2">
              <StepButton
                onClick={() => onChangeRate(Number(Math.max(RATE_MIN, rate - 0.001).toFixed(4)))}
                disabled={rate <= RATE_MIN}
                label="Snížit úrokovou sazbu"
              >
                −
              </StepButton>
              <input
                type="range"
                min={RATE_MIN * 100}
                max={RATE_MAX * 100}
                step={0.1}
                value={Number((rate * 100).toFixed(2))}
                onChange={(e) => onChangeRate(Number((Number(e.target.value) / 100).toFixed(4)))}
                aria-label="Úroková sazba"
                className="flex-1 min-w-0 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-gradient-to-r from-green-400/50 to-red-400/50"
              />
              <StepButton
                onClick={() => onChangeRate(Number(Math.min(RATE_MAX, rate + 0.001).toFixed(4)))}
                disabled={rate >= RATE_MAX}
                label="Zvýšit úrokovou sazbu"
              >
                +
              </StepButton>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{fmtRate(RATE_MIN)} %</span>
              <span>{fmtRate(RATE_MAX)} %</span>
            </div>

            {advice && (
              <div className="mt-2 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Vaše LTV je {ltvPct} %</span>{' '}
                 , pásmo {advice.band.label}.{' '}
                  {advice.band.key === 'best' && 'To je nejlepší pásmo, banky tu nabízejí nejnižší sazby.'}
                  {advice.band.key === 'standard' && 'Standardní pásmo: pod 80 % LTV už banky nepřidávají rizikovou přirážku.'}
                  {advice.band.key === 'high' && 'Nad 80 % LTV si banky obvykle připlácejí rizikovou přirážku k sazbě.'}
                </p>

                {!advice.band.available && (
                  <p className="text-red-600 dark:text-red-400">
                    Nad 90 % LTV hypotéku nedostanete (limit ČNB). Je potřeba vyšší akontace.
                  </p>
                )}

                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Pozor na odhad banky:</span>{' '}
                  LTV počítáme z ceny, kterou jste zadali. Banka ho ale počítá ze svého odhadu, a ten
                  bývá spíš konzervativní. Když odhadce dům ocení níž, spadnete do horšího pásma a
                  rozdíl musíte doplatit z vlastních peněz. Vyplatí se nechat si odhad udělat u víc bank.
                </p>

                {advice.nextBand && advice.extraDownPayment > 0 && advice.rateDrop > 0 && (
                  <p className={advice.affordable ? 'text-green-700 dark:text-green-400' : ''}>
                    <span className="font-medium">Tip:</span>{' '}
                    kdybyste do akontace dali o {fmt(advice.extraDownPayment)} Kč víc, dostanete se pod{' '}
                    {Math.round(advice.nextBand.maxLtv * 100)} % LTV. Tam banky dávají sazbu zhruba o{' '}
                    {(advice.rateDrop * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} p. b. nižší,
                    splátka by klesla přibližně o {fmt(advice.monthlySaving)} Kč/měs.
                    {!advice.affordable && ' Na to by ale vaše úspory zatím nestačily.'}
                  </p>
                )}

                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Riziko refixace:</span>{' '}
                  kdyby sazba za {formatYears(fixationYears)} stoupla o 1 p. b.,
                  splátka povyskočí o ~{fmt(paymentPlus1pp)} Kč/měs.
                  {fixationEndsDuringLeave && (
                    <>
                      {' '}<span className="text-amber-600 dark:text-amber-400">
                        Fixace vám navíc skončí ve chvíli, kdy podle svého plánu můžete být na rodičovské
                        (volno máte nastavené na {formatMonths(leaveMonths)}). Skokové zvýšení splátky by
                        tak padlo do nejtenčího období rozpočtu. Delší fixace tomu předejde, i za cenu
                        o něco vyšší sazby.
                      </span>
                    </>
                  )}
                </p>
                <p className="text-gray-400 dark:text-gray-500">
                  Přirážky podle LTV jsou orientační tržní zvyklost. Konkrétní sazbu vždy potvrdí až banka.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="border-t dark:border-gray-600 pt-3" />

        <Row label="Výše hypotéky" value={`${fmt(loanAmount)} Kč`} />
        <Row
          label="Odhadovaná měsíční splátka"
          value={`${fmt(payment)} Kč/měs.`}
          bold
        />
        {!onChangeRate && <Row label="Úroková sazba" value={`${fmtRate(rate)} % ročně`} />}
        <Row label="Délka hypotéky" value={`${term} let`} />
        <Row label="Fixace sazby" value={formatYears(fixationYears)} />

        {gap > 0 && months !== Infinity && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <Row
              label="Čas na naspoření chybějící akontace"
              value={formatMonths(months)}
            />
          </>
        )}
        {months === Infinity && gap > 0 && (
          <>
            <div className="border-t dark:border-gray-600 pt-3" />
            <p className="text-red-600 text-sm">Při současných příjmech a výdajích akontaci nelze naspořit.</p>
          </>
        )}
      </div>

      {oneOff && (
        <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Kromě akontace počítejte s jednorázovými náklady
            <Tooltip text="Poplatky a služby, které koupi na hypotéku doprovázejí. Daň z nabytí nemovitosti byla zrušena v roce 2020, takže tu není. Ceny služeb se liší podle poskytovatele, proto jsou uvedená rozpětí. Stěhování a vybavení sem nepočítáme, ta se u každého liší příliš." />
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Dohromady zhruba <span className="font-semibold text-gray-900 dark:text-white">{fmt(oneOff.min)} až {fmt(oneOff.max)} Kč</span>.
            O tuhle částku se rezerva sníží hned při koupi, ještě než začnete splácet.
          </p>
          <div className="space-y-1">
            {oneOff.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-3 text-xs">
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{fmt(item.min)} až {fmt(item.max)} Kč</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <span className="font-semibold">Nezapomeňte na refixaci.</span>{' '}
        Za {formatYears(fixationYears)} vám končí fixace úrokové sazby.
        Zhruba rok předem začněte porovnávat nabídky refinancování u jiných bank. Po skončení fixace lze hypotéku bez sankce přenést jinam.
      </div>
    </div>
  );
}

// Krokovací tlačítko k posuvníku, na mobilu se posuvníkem těžko trefuje
// přesná hodnota, tlačítka dávají spolehlivý krok.
function StepButton({ onClick, disabled, label, children }: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function Row({ label, value, highlight, bold, tooltip }: {
  label: string;
  value: string;
  highlight?: 'red' | 'green';
  bold?: boolean;
  tooltip?: string;
}) {
  const valueColor = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-600' : 'text-gray-900 dark:text-white';
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-gray-600 dark:text-gray-300 flex items-center min-w-0">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      {/* Částka se nikdy nesmí zalomit doprostřed: na mobilu by se rozpadla přes dva řádky. */}
      <span className={`shrink-0 whitespace-nowrap ${bold ? 'text-base sm:text-lg font-bold' : 'font-semibold'} ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}
