import { useWhatIf } from '../../store/whatIfStore';
import { compareScenarios } from '../../engine/whatIf';
import { journey } from '../../engine/journey';
import { mortgagePayment, postPurchaseRunwayMonths } from '../../engine/mortgage';
import { monthlyDisposable } from '../../engine/cashflow';
import { czk, formatNumber as fmt, formatMonths } from '../../engine/format';
import JourneyRibbon from './JourneyRibbon';
import WhatIfPanel from './WhatIfPanel';
import Callout from '../ui/Callout';

/**
 * Záložka „Co kdyby": samostatný prostor na hraní si s plánem.
 *
 * Dřív se dalo hrát jen v grafu rozpočtu, a to jen vypínáním položek. Chybělo
 * u toho to hlavní: proti čemu se ta změna měří. Tahle záložka drží původní
 * scénář stranou a všechno ukazuje jako rozdíl proti němu, včetně ducha
 * původní cesty pod tou živou.
 *
 * Čísla i formulace staví engine. Tahle komponenta jen skládá rozdíly.
 */

/** Jedna dlaždice rozdílu: hodnota teď a o kolik se hnula. */
function Delta({ label, value, unit, diff, betterWhenLower }: {
  label: string;
  value: string;
  unit?: string;
  /** Rozdíl proti původnímu scénáři. Nula = beze změny. */
  diff: number;
  /** U splátky je nižší lepší, u rezervy vyšší. */
  betterWhenLower: boolean;
}) {
  const better = betterWhenLower ? diff < 0 : diff > 0;
  const changed = Math.abs(diff) >= 0.05;
  return (
    <div className="p-3 rounded-xl bg-card border border-line">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="type-hero text-ink mt-0.5">
        {value}
        {unit && <span className="text-sm font-normal font-sans text-ink-muted"> {unit}</span>}
      </p>
      <p className={`mt-1 text-xs font-semibold ${changed ? (better ? 'text-good' : 'text-danger') : 'text-ink-muted'}`}>
        {changed ? `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}` : 'beze změny'}
      </p>
    </div>
  );
}

export default function WhatIfTab() {
  const { baseline, baselineAllocations, current, currentAllocations, touched } = useWhatIf();

  const comparison = compareScenarios(baseline, baselineAllocations, current, currentAllocations);
  const currentJourney = journey(current, { allocations: currentAllocations });
  const baselineJourney = journey(baseline, { allocations: baselineAllocations });

  const hasProperty = baseline.goals.includes('property');

  const paymentNow = hasProperty ? mortgagePayment(current) : 0;
  const paymentBefore = hasProperty ? mortgagePayment(baseline) : 0;
  const disposableNow = monthlyDisposable(current);
  const disposableBefore = monthlyDisposable(baseline);
  const runwayNow = hasProperty ? postPurchaseRunwayMonths(current) : 0;
  const runwayBefore = hasProperty ? postPurchaseRunwayMonths(baseline) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="min-w-0 space-y-5">
        <div>
          <h2 className="type-verdict text-ink max-w-[54ch]">
            {touched
              ? hasProperty
                ? `Zkoušíte: bydlení za ${czk(current.property.targetPrice)}.`
                : 'Zkoušíte upravený scénář.'
              : 'Zkuste s plánem pohnout.'}
          </h2>
          <p className="mt-3 text-[15px] text-ink-body max-w-[62ch] leading-relaxed">
            {touched ? (
              comparison.improved ? (
                <>Pomohlo to. Odpověď se změnila z <strong>{comparison.baseline.headline.toLowerCase()}</strong> na <strong>{comparison.now.headline.toLowerCase()}</strong>.</>
              ) : comparison.worsened ? (
                <>Tímhle směrem ne. Odpověď se změnila z <strong>{comparison.baseline.headline.toLowerCase()}</strong> na <strong>{comparison.now.headline.toLowerCase()}</strong>.</>
              ) : (
                <>Odpověď zůstává <strong>{comparison.now.headline.toLowerCase()}</strong>. {comparison.hint}</>
              )
            ) : (
              'Posuvníky vpravo mění cenu, sazbu a délku rodičovské. Cesta se překreslí hned a původní scénář zůstane vidět jako přerušovaný obrys, takže je poznat, jestli jste si pomohli.'
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-sunken p-5 sm:p-6">
          {touched && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--line-strong)" strokeWidth="3" strokeDasharray="4 4" /></svg>
                původní scénář
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--good)" strokeWidth="3" /></svg>
                co kdyby
              </span>
            </div>
          )}
          {/* Animace tady ne: stuha se překresluje při každém pohybu posuvníku
              a rozjíždět ji od začátku by z toho udělalo blikání. */}
          <JourneyRibbon
            data={currentJourney}
            animate={false}
            ghost={touched ? baselineJourney : undefined}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {hasProperty && (
            <Delta
              label="Měsíční splátka"
              value={fmt(paymentNow)}
              unit="Kč"
              diff={paymentNow - paymentBefore}
              betterWhenLower
            />
          )}
          <Delta
            label="Zbývá měsíčně"
            value={fmt(disposableNow)}
            unit="Kč"
            diff={disposableNow - disposableBefore}
            betterWhenLower={false}
          />
          {hasProperty && (
            <Delta
              label="Rezerva po koupi"
              value={runwayNow === Infinity ? '∞' : runwayNow.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}
              unit="měs."
              diff={runwayNow === Infinity || runwayBefore === Infinity ? 0 : runwayNow - runwayBefore}
              betterWhenLower={false}
            />
          )}
        </div>

        {touched && currentJourney.tightest && (
          <Callout tone={comparison.improved ? 'good' : 'neutral'}>
            <strong>Nejtěsnější místo teď:</strong> {currentJourney.tightest.title}.{' '}
            {currentJourney.tightest.explanation}
            {baselineJourney.tightest && baselineJourney.tightest.month !== currentJourney.tightest.month && (
              <> Původně to bylo za {formatMonths(baselineJourney.tightest.month)}.</>
            )}
          </Callout>
        )}
      </div>

      <div className="min-w-0 lg:sticky lg:top-20">
        <WhatIfPanel />
      </div>
    </div>
  );
}
