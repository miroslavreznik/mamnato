import { useState } from 'react';
import { useWhatIf } from '../../store/whatIfStore';
import { compareScenarios } from '../../engine/whatIf';
import { answerText } from '../../engine/verdict';
import { journey } from '../../engine/journey';
import { GOAL_LABELS, customGoalName } from '../../engine/goalNames';
import { mortgagePayment, postPurchaseRunwayMonths } from '../../engine/mortgage';
import { emergencyRunwayMonths } from '../../engine/cashflow';
import { budgetNow, budgetAfterPurchase } from '../../engine/budget';
import { czk, formatNumber as fmt, formatMonths } from '../../engine/format';
import JourneyRibbon from './JourneyRibbon';
import JourneyRange, { JourneyRangeNote } from './JourneyRange';
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
  const {
    baseline, baselineAllocations, current, currentAllocations, touched, excludedGoals,
  } = useWhatIf();

  const comparison = compareScenarios(baseline, baselineAllocations, current, currentAllocations);
  const currentJourney = journey(current, { allocations: currentAllocations });
  const baselineJourney = journey(baseline, { allocations: baselineAllocations });

  // Vlastní výřez, ne sdílený se záložkou Cesta. Tady se člověk dívá na
  // rozdíl proti původnímu scénáři, a ten se v prvních letech skoro nepozná,
  // takže se hodí jiný úsek než při čtení verdiktu.
  const [viewMonths, setViewMonths] = useState(currentJourney.horizonMonths);
  const view = Math.min(viewMonths, currentJourney.horizonMonths);

  // Dlaždice se řídí zadaným scénářem, aby po odložení bydlení nezmizely
  // a bylo vidět, co odložení udělalo. Samotné číslo ale musí jít na nulu:
  // `mortgagePayment` počítá z ceny nemovitosti bez ohledu na to, jestli je
  // bydlení mezi cíli, takže by po odložení dál hlásilo splátku.
  const hasProperty = baseline.goals.includes('property');
  const buysNow = current.goals.includes('property');

  const paymentNow = buysNow ? mortgagePayment(current) : 0;
  const paymentBefore = hasProperty ? mortgagePayment(baseline) : 0;

  // Rezerva i volné peníze se počítají pro **stav, kdy plán běží**: když se
  // kupuje, tak po koupi, jinak podle dneška.
  //
  // Bez toho si dlaždice odporovaly, jakmile šla nemovitost vypnout jedním
  // tlačítkem. Zrušení koupě sundalo splátku o 29 276 Kč, a hned vedle stálo
  // u volných peněz „beze změny" (protože `budgetNow` je rozpočet dneška,
  // kdy se ještě platí nájem) a u rezervy „0 měsíců" (protože rezerva po
  // koupi, která se nekoná, je nesmysl). Takhle měří obě varianty totéž
  // a rozdíl mezi nimi je právě to, co uživatel právě udělal.
  const runwayNow = buysNow ? postPurchaseRunwayMonths(current) : emergencyRunwayMonths(current);
  const runwayBefore = hasProperty ? postPurchaseRunwayMonths(baseline) : emergencyRunwayMonths(baseline);

  // Volné peníze, ne disponibilní částka.
  //
  // Disponibilní částka cíle nezná, takže odložením cíle nehne ani o korunu
  // a všechny tři dlaždice hlásily „beze změny" i po odložení důchodu.
  // Přitom právě uvolněné peníze jsou to, co odložení dělá.
  const freeNow = (buysNow ? budgetAfterPurchase : budgetNow)(current, currentAllocations).surplus;
  const freeBefore = (hasProperty ? budgetAfterPurchase : budgetNow)(baseline, baselineAllocations).surplus;

  // Odložení cíle křivkou jmění nehne: spoření na cíl je pořád jmění, jen
  // leží jinde. Duch původní cesty by pak byl přesně pod živou stuhou
  // a legenda by slibovala přerušovaný obrys, který nikde není.
  const shapeChanged = currentJourney.points.some(
    (p, i) => p.cash !== baselineJourney.points[i]?.cash
  );

  // Odpověď se porovnává celá, i s doplňkem za čárkou. Bez něj vycházelo
  // „odpověď se změnila z máte na to na máte na to", protože „Máte na to"
  // a „Máte na to, ale bude to napjaté" mají headline stejný.
  const answerBefore = answerText(comparison.baseline);
  const answerNow = answerText(comparison.now);
  const answerChanged = answerBefore !== answerNow;

  // Co je zrovna odložené, pojmenované tak, jak to stojí v přepínačích.
  // Jména jsou z `goalNames`, aby se věta a přepínač nerozešly.
  const postponed = [
    ...['property', 'child', 'retirement']
      .filter((k) => excludedGoals.has(k))
      .map((k) => GOAL_LABELS[k].toLowerCase()),
    ...(baseline.customGoals ?? [])
      .map((g, i) => ({ g, name: customGoalName(baseline, i) }))
      .filter(({ g }) => excludedGoals.has(`other:${g.id}`) || excludedGoals.has('other'))
      .map(({ name }) => name.toLowerCase()),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="min-w-0 space-y-5">
        <div>
          <h2 className="type-verdict text-ink max-w-[54ch]">
            {!touched
              ? 'Zkuste s plánem pohnout.'
              : postponed.length > 0
                // Nadpis má říct, co uživatel právě udělal. Když odložil cíl,
                // je „Zkoušíte: bydlení za 6 000 000 Kč" matoucí: s cenou
                // nehnul a přesto o ní nadpis mluví.
                ? `Zkoušíte to bez toho, co jste odložili: ${postponed.join(', ')}.`
                : hasProperty
                  ? `Zkoušíte: bydlení za ${czk(current.property.targetPrice)}.`
                  : 'Zkoušíte upravený scénář.'}
          </h2>
          <p className="mt-3 text-[15px] text-ink-body max-w-[62ch] leading-relaxed">
            {touched ? (
              comparison.improved && answerChanged ? (
                <>Pomohlo to. Odpověď byla <strong>{answerBefore.toLowerCase()}</strong>, teď je <strong>{answerNow.toLowerCase()}</strong>.</>
              ) : comparison.worsened && answerChanged ? (
                <>Tímhle směrem ne. Odpověď byla <strong>{answerBefore.toLowerCase()}</strong>, teď je <strong>{answerNow.toLowerCase()}</strong>.</>
              ) : (
                <>Odpověď zůstává <strong>{answerNow.toLowerCase()}</strong>. {comparison.hint}</>
              )
            ) : (
              'Posuvníky vpravo mění cenu, sazbu a délku rodičovské. Časová osa se překreslí hned a původní scénář zůstane vidět jako přerušovaný obrys, takže je poznat, jestli jste si pomohli.'
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-sunken p-5 sm:p-6">
          {touched && shapeChanged && (
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
          <JourneyRange
            horizonMonths={currentJourney.horizonMonths}
            value={view}
            onChange={setViewMonths}
          />
          <JourneyRibbon
            data={currentJourney}
            animate={false}
            viewMonths={view}
            ghost={touched && shapeChanged ? baselineJourney : undefined}
          />
          <JourneyRangeNote data={currentJourney} viewMonths={view} />
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
            label={buysNow ? 'Volných po koupi' : 'Volných měsíčně'}
            value={fmt(freeNow)}
            unit="Kč"
            diff={freeNow - freeBefore}
            betterWhenLower={false}
          />
          {hasProperty && (
            <Delta
              label={buysNow ? 'Rezerva po koupi' : 'Rezerva vydrží'}
              value={runwayNow === Infinity ? '∞' : runwayNow.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}
              unit="měs."
              diff={runwayNow === Infinity || runwayBefore === Infinity ? 0 : runwayNow - runwayBefore}
              betterWhenLower={false}
            />
          )}
        </div>

        {touched && postponed.length > 0 && !shapeChanged && (
          <Callout tone="neutral">
            Na časové ose to nevypadá jinak, a je to tak správně: spoření na cíl
            zůstává vaším jměním, jen leží jinde. Odložením se uvolní peníze
            v rozpočtu, a teprve když je dáte někam jinam, změní se i ona.
          </Callout>
        )}

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
