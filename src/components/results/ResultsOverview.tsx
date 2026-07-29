import { useState } from 'react';
import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { evaluateOverall } from '../../engine/summary';
import type { GoalStatus } from '../../engine/summary';
import { journey } from '../../engine/journey';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from '../../engine/cashflow';
import { postPurchaseRunwayMonths, mortgagePayment, downPaymentGap, dsti, requiredDownPayment, downPaymentFraction } from '../../engine/mortgage';
import { monthsToSaveAtAllocation } from '../../engine/allocation';
import { DEFAULTS } from '../../engine/defaults';
import { formatMonths, formatNumber as fmt } from '../../engine/format';
import Tooltip from '../ui/Tooltip';
import BudgetSummary from './BudgetSummary';
import Card from '../ui/Card';
import JourneyRibbon from './JourneyRibbon';
import TightestPoint from './TightestPoint';
import HeroNumber from '../ui/HeroNumber';
import MonthsMeter from '../ui/MonthsMeter';
import StatusBadge, { type Status } from '../ui/StatusBadge';

interface Props {
  state: WizardState;
  allocations: GoalAllocations;
  // Přepnutí na záložku, kde se dá rada rovnou provést. Bez toho musel
  // uživatel místo, na které rada odkazuje, najít sám.
  onOpenSection?: (id: string) => void;
}

type Tone = 'good' | 'caution' | 'danger' | 'plain';

interface Kpi {
  label: string;
  tooltip: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: Tone;
  // Naplnění 0..1 pro proužek pod číslem. Ukazuje, jak daleko je hodnota
  // od svého cíle, takže stav jde poznat bez čtení.
  meter?: number;
  // Rezerva v měsících. Když je zadaná, kreslí se místo proužku měřič
  // po měsících, protože ty jdou spočítat a proužek je slévá dohromady.
  months?: number;
}

// Stav cíle slovem a tvarem, ne jen barvou. Samotná tečka nešla bez legendy
// pochopit a legenda pro tři stavy nemá cenu; tvar ji nepotřebuje.
const goalBadge: Record<GoalStatus, { label: string; status: Status }> = {
  good: { label: 'V pořádku', status: 'good' },
  caution: { label: 'Pozor', status: 'caution' },
  warning: { label: 'Nevychází', status: 'danger' },
};

// Odpověď, která platí jen za předpokladu, jenž zatím neplatí. Barvu stavu si
// nezaslouží: zelené „v pořádku" hned pod červeným „nevychází" vypadá, jako
// by si appka odporovala, i když každá odpověď mluví o něčem jiném.
const conditionalBadge = { label: 'Podmíněně', status: 'neutral' as const };

export default function ResultsOverview({ state, allocations, onOpenSection }: Props) {
  const summary = evaluateOverall(state, allocations);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);
  // U kupujících je relevantní rezerva PO zaplacení akontace (úspory se z velké
  // části utratí a místo nájmu se platí hypotéka).
  const hasProperty = state.goals.includes('property');
  const runway = hasProperty ? postPurchaseRunwayMonths(state) : emergencyRunwayMonths(state);

  // Desetinné místo dává smysl u „8,5 měs.", u nuly vypadá jako chyba měření.
  const runwayLabel = runway === Infinity
    ? '∞'
    : runway < 0.05
      ? '0'
      : runway.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const runwayTone: Tone = runway >= 6 ? 'good' : runway >= 3 ? 'caution' : 'danger';

  // Dlaždice se liší podle toho, co uživatel řeší. U hypotéky jsou nejdůležitější
  // splátka a akontace (jinak schované ve sbalené sekci Bydlení), ne obecné
  // ukazatele rozpočtu, které stejně vidí hned pod tím v grafu.
  const kpis: Kpi[] = hasProperty
    ? [
        (() => {
          const payment = mortgagePayment(state);
          const dstiPct = dsti(state);
          return {
            label: 'Měsíční splátka',
            tooltip: 'Odhadovaná splátka hypotéky při zadané ceně, akontaci, sazbě a délce splácení. Kolik z příjmu ukrojí, ukazuje řádek pod částkou (DSTI).',
            value: fmt(payment),
            unit: 'Kč/měs.',
            sub: isFinite(dstiPct) ? `${Math.round(dstiPct * 100)} % čistého příjmu` : undefined,
            tone: !isFinite(dstiPct) || dstiPct > DEFAULTS.dstiLimit ? 'danger' : dstiPct > DEFAULTS.dstiLimit * 0.85 ? 'caution' : 'plain',
            // Proužek vůči obvyklému bankovnímu stropu DSTI.
            meter: isFinite(dstiPct) ? dstiPct / DEFAULTS.dstiLimit : 1,
          };
        })(),
        (() => {
          const gap = downPaymentGap(state);
          const months = monthsToSaveAtAllocation(state, allocations.downPayment);
          const required = requiredDownPayment(state.property.targetPrice, downPaymentFraction(state));
          return {
            label: 'Chybějící akontace',
            tooltip: 'Rozdíl mezi akontací, kterou banka požaduje (20 % ceny, u žadatelů do 36 let 10 %), a tím, co pokryjete z úspor. Bez ní vám banka hypotéku neposkytne.',
            value: gap > 0 ? fmt(gap) : '0',
            unit: 'Kč',
            sub: gap > 0
              ? (isFinite(months) ? `naspoříte za ${formatMonths(months, true)}` : 'zatím na ni nic neodkládáte')
              : 'akontaci máte pokrytou',
            tone: gap > 0 ? (isFinite(months) ? 'caution' : 'danger') : 'good',
            // Kolik z požadované akontace je už pokryto.
            meter: required > 0 ? (required - gap) / required : 1,
          };
        })(),
        {
          label: 'Rezerva po koupi vydrží',
          tooltip: 'Kolik měsíců by úspory pokryly nezbytné výdaje při výpadku příjmu, počítáno PO zaplacení akontace a s hypotékou místo nájmu. Ideál je 3–6 měsíců.'
            + (downPaymentGap(state) > 0
              ? ' Počítá se z dnešních úspor, tedy jako byste kupovali hned. Cesta vedle počítá s tím, že do koupě ještě něco naspoříte, proto tam vychází víc.'
              : ''),
          value: runwayLabel,
          unit: 'měs.',
          // Bez akontace se kupovat nedá, takže je to odpověď na „co kdybych
          // koupil dnes". Cesta počítá s koupí až v okamžiku, kdy je na ni
          // naspořeno, a dá jiné číslo. Dvě různá čísla o téže věci vedle sebe
          // vypadají jako chyba, dokud se nenapíše, čeho se každé týká.
          sub: downPaymentGap(state) > 0 ? 'kdybyste kupovali dnes' : undefined,
          tone: runwayTone,
          months: runway === Infinity ? 6 : runway,
        },
      ]
    : [
        {
          label: 'Disponibilní částka',
          tooltip: 'Kolik vám měsíčně zbyde po odečtení všech výdajů od čistých příjmů (příjmy − výdaje). Z této částky spoříte na cíle a tvoříte rezervu.',
          value: `${disposable >= 0 ? '+' : ''}${fmt(disposable)}`,
          unit: 'Kč/měs.',
          tone: disposable >= 0 ? 'plain' : 'danger',
        },
        {
          label: 'Míra úspor',
          tooltip: 'Jaký podíl čistého příjmu vám po výdajích zbývá (disponibilní částka ÷ příjem). Zdravé bývá aspoň 10–20 %.',
          value: (rate * 100).toFixed(1),
          unit: '%',
          tone: rate >= 0.2 ? 'good' : rate >= 0.1 ? 'plain' : 'caution',
          meter: rate / 0.2,
        },
        {
          label: 'Rezerva vydrží',
          tooltip: 'Kolik měsíců by vaše úspory pokryly nezbytné výdaje při výpadku příjmu (úspory ÷ nezbytné výdaje). Ideál je 3–6 měsíců.',
          value: runwayLabel,
          unit: 'měs.',
          tone: runwayTone,
          months: runway === Infinity ? 6 : runway,
        },
      ];

  // Bydlení patří mezi cíle jako každý jiný. Dřív se odsud vyřazovalo,
  // protože ho pokrývají dlaždice nad tím, jenže ty ukazují jen čísla
  // (splátka, akontace, rezerva). Odpověď „vychází ten cíl, nebo ne?"
  // v přehledu chyběla, přestože je to ten největší závazek ze všech.
  const readinessGoals = summary.goals;

  // Kdy čekáte dítě: úvaha nad grafem, ne zadaný údaj. Nemění verdikt,
  // jen posouvá událost po ose, takže si to drží obrazovka, ne uložený stav.
  // Stejnou hodnotu má i graf vývoje úspor v záložce Bydlení; sjednotit je
  // patří ke kroku, kde vznikne sdílený stav pro „co kdyby".
  const [childOffset, setChildOffset] = useState(12);
  const journeyData = journey(state, { childOffsetMonths: childOffset });

  return (
    // Dva sloupce: vlevo odpověď a cíle, vpravo čísla a co s tím. Návrh dává
    // pravému sloupci 340 px; do jednoho sloupce se to vešlo, dokud byla
    // stránka široká 768 px, na 1280 px by řádky textu přerostly únosnou délku.
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="min-w-0 space-y-6">
      {/* Verdikt sedí přímo na papíru: bez karty, bez ikony, bez barevného
          podkladu. Dřív to byl tónovaný box a barva podle stavu, jenže verdikt
          už svůj stav říká slovy, a barevná plocha přes celou šířku z něj
          dělala výstrahu i tam, kde šlo o dobrou zprávu. Stav nese věta
          a rozpad na dílčí otázky pod ní. */}
      <div>
          <h2 className="type-verdict text-ink max-w-[54ch]">
            {summary.verdict.headline}
            {summary.verdict.qualifier && <>, {summary.verdict.qualifier}</>}
            {summary.verdict.answer === 'yes' || summary.verdict.answer === 'no' ? '.' : '…'}
          </h2>
          <p className="mt-3 text-[15px] text-ink-body max-w-[62ch] leading-relaxed">
            {summary.verdict.reason}
          </p>

        {/* U vlastního bydlení jsou otázky ve skutečnosti dvě: jestli na něj
            dosáhnete a jestli po něm zbyde na zbytek. Jedna nálepka je slučuje
            a uživatel pak nepozná, která z nich ho brzdí. */}
        {summary.verdict.questions.length > 0 && (
          <div className="mt-4 space-y-2 max-w-[70ch]">
            {summary.verdict.questions.map((q) => {
              const badge = q.conditional ? conditionalBadge : goalBadge[q.status];
              return (
                <div key={q.question} className="flex items-start gap-2.5">
                  <StatusBadge status={badge.status} label={badge.label} className="shrink-0 mt-0.5" />
                  <p className={`text-sm min-w-0 ${q.conditional ? 'text-ink-muted' : 'text-ink-label'}`}>
                    <span className="font-semibold">{q.question}</span>{' '}
                    <span className="text-ink-body">{q.answer}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cesta: deset let života jako jedna stuha. Hrdina obrazovky. */}
      <div className="rounded-2xl bg-sunken p-5 sm:p-6">
        {/* Animace se hlídat nemusí. Panely záložek zůstávají připojené
            (`hidden`, ne odpojení), takže se stuha vykreslí jednou při vstupu
            na výsledky a přepínání záložek ji nerozjede znovu. Přepočet při
            tažení posuvníku mění jen atribut `d`, ne uzel, takže taky ne. */}
        <JourneyRibbon
          data={journeyData}
          onMoveChild={state.goals.includes('child') ? setChildOffset : undefined}
        />
        {/* Bez tohohle vypadá cesta u někoho, kdo na akontaci zatím nedosáhne,
            jako klidná zelená čára, zatímco verdikt nad ní říká „zatím na to
            nemáte". Ta čára je správně, jen kreslí život bez koupě; musí se
            u ní říct proč. */}
        {hasProperty && !journeyData.events.some((e) => e.key === 'purchase') && (
          <p className="mt-3 text-sm text-caution">
            Koupě na cestě není: na akontaci v horizontu deseti let zatím
            nedosáhnete, takže cesta ukazuje život bez ní.
          </p>
        )}
      </div>

      {/* Stav jednotlivých cílů */}
      {readinessGoals.length > 0 && (
        <div>
          <h3 className="type-label text-ink-muted mb-2">Jak jste na tom s cíli</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {readinessGoals.map((g) => (
              <div key={g.key} className="p-3 rounded-lg border border-line">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{g.label}</span>
                  <StatusBadge
                    status={goalBadge[g.status].status}
                    label={goalBadge[g.status].label}
                    className="shrink-0"
                  />
                </div>
                <p className="mt-1 text-sm text-ink-muted">{g.headline}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rozpočtový souhrn: dnes a po koupi */}
      {summary.budget && <BudgetSummary now={summary.budget} after={summary.budgetAfter} />}
      </div>

      {/* Pravý sloupec: čísla, na kterých verdikt stojí, a co s tím jde dělat.
          Na mobilu se řadí pod levý, ve stejném pořadí jako na desktopu. */}
      <div className="min-w-0 space-y-3 lg:sticky lg:top-20">
        {journeyData.tightest && (
          <TightestPoint
            data={journeyData.tightest}
            onOpen={onOpenSection ? () => onOpenSection('rozpocet') : undefined}
          />
        )}
        {/* Čísla, na kterých verdikt stojí */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
        {kpis.map((k) => (
          <HeroNumber
            key={k.label}
            label={<>{k.label}<Tooltip text={k.tooltip} /></>}
            value={k.value}
            unit={k.unit}
            tone={k.tone}
            note={k.sub}
            meter={k.months === undefined ? k.meter : undefined}
          >
            {/* Rezerva se měří v měsících, a ty jdou spočítat. Dlaždice to
                řeknou přesněji než proužek, který je slévá dohromady. */}
            {k.months !== undefined && (
              <MonthsMeter
                months={k.months}
                tone={k.tone === 'plain' ? 'good' : k.tone === 'caution' ? 'caution' : k.tone}
              />
            )}
          </HeroNumber>
        ))}
      </div>


        {/* Tipy */}
      {summary.tips.length > 0 && (
        <Card>
          <h4 className="text-sm font-semibold text-ink-label mb-2">Co můžete udělat:</h4>
          <ul className="space-y-1.5">
            {summary.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-body">
                <span className="text-brand mt-0.5 flex-shrink-0">&#x2022;</span>
                <span>
                  {tip.text}
                  {tip.section && tip.actionLabel && onOpenSection && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => onOpenSection(tip.section!)}
                        className="no-print inline-flex items-center gap-1 font-medium text-brand hover:underline"
                      >
                        {tip.actionLabel}
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      </div>
    </div>
  );
}
