import { useState } from 'react';
import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { evaluateOverall } from '../../engine/summary';
import type { GoalStatus } from '../../engine/summary';
import { journey } from '../../engine/journey';
import { monthlyDisposable, savingsRate, emergencyRunwayMonths } from '../../engine/cashflow';
import { mortgagePayment, dti, dsti, necessaryExpensesAfterPurchase, isUnder36 } from '../../engine/mortgage';
import { targetMonthlySurplus, type AffordableProperty } from '../../engine/purchasePlan';
import { DEFAULTS } from '../../engine/defaults';
import { plannedChildren } from '../../engine/childCost';
import { czk, czkMonthly, decimal, formatMonths, formatNumber as fmt } from '../../engine/format';
import Tooltip from '../ui/Tooltip';
import BudgetSummary from './BudgetSummary';
import Card from '../ui/Card';
import JourneyRibbon from './JourneyRibbon';
import NextStepCard from './NextStepCard';
import JourneyRange, { JourneyRangeNote, DEFAULT_VIEW_MONTHS } from './JourneyRange';
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
  /** Posun puntíku „Dítě" po ose. Zapisuje se do stavu, viz `childInMonths`. */
  onChangeChildTiming?: (months: number) => void;
  affordableProperty?: AffordableProperty;
  onExpandPlan?: () => void;
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

export default function ResultsOverview({ state, allocations, onOpenSection, onChangeChildTiming, affordableProperty, onExpandPlan }: Props) {
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);
  const hasProperty = state.goals.includes('property') && state.property.targetPrice > 0;
  const [purchaseAt, setPurchaseAt] = useState(0);
  const journeyData = journey(state, { purchaseNotBeforeMonth: purchaseAt, allocations });
  const summary = evaluateOverall(state, allocations, journeyData.timeline);
  const closing = summary.purchase;
  const purchaseMonth = closing?.purchaseMonth ?? null;
  const postBudget = summary.budgetAfter;
  const remaining = closing?.projectedClosingCash ?? null;
  const essential = hasProperty ? necessaryExpensesAfterPurchase(state) : 0;
  const runway = hasProperty
    ? (essential <= 0 ? Infinity : Math.max(0, remaining ?? closing?.cashAfterClosing ?? 0) / essential)
    : emergencyRunwayMonths(state);

  // Desetinné místo dává smysl u „8,5 měs.", u nuly vypadá jako chyba měření.
  const runwayLabel = runway === Infinity
    ? '∞'
    : runway < 0.05
      ? '0'
      : decimal(runway);
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
            tone: !isFinite(dstiPct) || dstiPct > DEFAULTS.dstiCaution ? 'danger' : dstiPct > DEFAULTS.dstiCaution * 0.85 ? 'caution' : 'plain',
            // Proužek vůči obvyklému bankovnímu stropu DSTI.
            meter: isFinite(dstiPct) ? dstiPct / DEFAULTS.dstiCaution : 1,
          };
        })(),
        (() => {
          const gap = closing?.cashGap ?? 0;
          const required = closing?.cashRequired ?? 0;
          return {
            label: 'Kolik dnes chybí na koupi',
            tooltip: 'Částka, která chybí na vlastní vklad, jednorázové náklady a nastavenou rezervu.',
            value: gap > 0 ? fmt(gap) : '0',
            unit: 'Kč',
            sub: gap > 0
              ? (purchaseMonth != null ? `koupě za ${formatMonths(purchaseMonth, true)}` : 'termín koupě zatím nevychází')
              : 'potřebnou hotovost máte',
            tone: gap > 0 ? (purchaseMonth != null ? 'caution' : 'danger') : 'good',
            meter: required > 0 ? (required - gap) / required : 1,
          };
        })(),
        {
          label: 'Rezerva po koupi vydrží',
          tooltip: 'Počet měsíců nezbytných výdajů, které pokryje hotovost po zaplacení vlastního vkladu a jednorázových nákladů.',
          value: runwayLabel,
          unit: 'měs.',
          sub: purchaseMonth == null ? 'podle dnešních úspor' : undefined,
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
          value: decimal(rate * 100),
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

  const bankCaution = hasProperty && (dti(state) > DEFAULTS.dtiCaution || dsti(state) > DEFAULTS.dstiCaution);
  const affordabilityLimit = affordableProperty?.limiting === 'cash'
    ? 'Cenu omezují úspory po odečtení nákladů a rezervy.'
    : affordableProperty?.limiting === 'monthly'
      ? 'Cenu omezuje částka, kterou můžete měsíčně dát za bydlení.'
      : 'Cenu omezuje kombinace úspor a měsíčního rozpočtu.';
  const shortfall = closing?.monthlyShortfall ?? 0;
  const purchaseHeadline = purchaseMonth === 0
    ? 'Podle rozpočtu můžete koupit už teď.'
    : purchaseMonth != null
      ? `Koupě vychází za ${formatMonths(purchaseMonth)}.`
      : 'Koupě v tomto plánu zatím nevychází.';
  const propertyDecisionRows: { label: string; status: GoalStatus; answer: string }[] = closing && postBudget ? [
    {
      label: 'Peníze při koupi',
      status: closing.cashGap > 0 ? 'caution' : 'good',
      answer: closing.cashGap > 0
        ? `Potřebujete ${czk(closing.cashRequired)} včetně nákladů a rezervy. Dnes chybí ${czk(closing.cashGap)}.`
        : `Potřebných ${czk(closing.cashRequired)} včetně nákladů a rezervy máte.`,
    },
    {
      label: 'Rozpočet po nastěhování',
      status: postBudget.surplus < 0 ? 'warning' : shortfall > 0 ? 'caution' : 'good',
      answer: postBudget.surplus < 0
        ? `Po výdajích a odkládání na cíle by chybělo ${czkMonthly(-postBudget.surplus)}.`
        : `Po výdajích a odkládání na cíle by zbývalo ${czkMonthly(postBudget.surplus)}.`
          + (shortfall > 0 ? ` Chcete si nechat ${czkMonthly(targetMonthlySurplus(state))}.` : ''),
    },
    {
      label: 'Rezerva po koupi',
      status: remaining == null ? 'caution' : runway >= closing.reserveMonths - 0.001 ? 'good' : 'warning',
      answer: remaining == null
        ? 'Zůstatek ukážeme, až v plánu vyjde termín koupě.'
        : `Po zaplacení vkladu a nákladů zbude ${czk(remaining)}${runway === Infinity ? '.' : `, přibližně na ${decimal(runway)} měs. nezbytných výdajů.`}`,
    },
  ] : [];

  // Doleva jen k měsíci, kdy je na akontaci naspořeno: dřív koupit nejde.
  // Doprava deset let, ale ne až k důchodu; za obzorem plánu už odklad
  // není rozhodnutí, ale jiný plán.
  const earliest = journeyData.earliestPurchaseMonth;
  const purchaseRange = earliest === null ? null : {
    min: earliest,
    max: Math.max(earliest, Math.min(earliest + 120, journeyData.horizonMonths - 12)),
  };

  // Výřez z cesty. Drží se v obrazovce, ne v uloženém stavu: je to způsob
  // dívání, ne údaj o plánu.
  //
  // **Výchozí je deset let**, ne celý plán. Na celém horizontu se první roky
  // srazí do pár procent šířky: koupě a dítě splynou v jeden shluk u levého
  // okraje a zbytek je dlouhá rovná čára do důchodu. Přitom právě těch pár
  // let je jediná část plánu, se kterou se dá něco udělat, a jsou v ní
  // všechny události, kterými jde hýbat. Co zůstane za výřezem, řekne věta
  // pod stuhou (`beyondView`), takže se nic neztratí.
  const [viewMonths, setViewMonths] = useState(() => {
    const defaultView = Math.min(DEFAULT_VIEW_MONTHS, journeyData.horizonMonths);
    return journeyData.tightest && journeyData.tightest.month > defaultView
      ? journeyData.horizonMonths
      : defaultView;
  });
  const view = Math.min(viewMonths, journeyData.horizonMonths);

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
            {affordableProperty
              ? affordableProperty.price > 0
                ? `Hledejte byt do ${czk(affordableProperty.price)}.`
                : 'V tomto rozpočtu zatím cena bytu nevychází.'
              : hasProperty
                ? purchaseHeadline
                : <>
                    {summary.verdict.headline}
                    {summary.verdict.qualifier && <>, {summary.verdict.qualifier}</>}
                    {summary.verdict.answer === 'yes' || summary.verdict.answer === 'no' ? '.' : '…'}
                  </>}
          </h2>
          {(affordableProperty || !hasProperty || state.goals.some((goal) => goal !== 'property')) && (
            <p className="mt-3 text-[15px] text-ink-body max-w-[62ch] leading-relaxed">
              {affordableProperty ? affordabilityLimit : summary.verdict.reason}
            </p>
          )}

        {/* U vlastního bydlení jsou otázky ve skutečnosti dvě: jestli na něj
            dosáhnete a jestli po něm zbyde na zbytek. Jedna nálepka je slučuje
            a uživatel pak nepozná, která z nich ho brzdí. */}
        {propertyDecisionRows.length > 0 && (
          <div className="mt-4 space-y-2 max-w-[70ch]">
            {propertyDecisionRows.map((row) => {
              const badge = goalBadge[row.status];
              return (
                <div key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
                  <StatusBadge status={badge.status} label={badge.label} className="shrink-0 mt-0.5" />
                  <p className="text-sm min-w-0 text-ink-label">
                    <span className="font-semibold">{row.label}:</span>{' '}
                    <span className="text-ink-body">{row.answer}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {hasProperty && (
          <p className={`mt-3 text-sm ${bankCaution ? 'text-caution' : 'text-ink-muted'}`}>
            {bankCaution
              ? 'Splátky nebo celkové zadlužení jsou v pásmu zvýšené bankovní obezřetnosti. Výši úvěru si ověřte u banky.'
              : 'Dostupnou výši úvěru potvrdí banka podle vašich údajů a hodnoty bytu.'}
          </p>
        )}
        {hasProperty && isUnder36(state) && (
          <p className="mt-2 text-sm text-ink-muted">
            Model používá až 90 % hodnoty zástavy podle dnešního věku. Banka ověří podmínky při poskytnutí úvěru
            {state.mode === 'individual' ? '.' : ', včetně podmínek pro společné žadatele.'}
          </p>
        )}
        {onExpandPlan && (
          <button type="button" onClick={onExpandPlan} className="no-print mt-3 min-h-[44px] font-semibold text-brand hover:underline">
            Přidat další finanční cíle
          </button>
        )}
      </div>

      {/* „A co teď": jeden krok s částkou a termínem, hned pod odpovědí.
          Druhá otázka po „mám na to" je „tak co mám udělat", a na tu přehled
          dosud odpovídal jen seznamem možností v pravém sloupci. */}
      {(!affordableProperty || hasProperty) && <NextStepCard state={state} allocations={allocations} onOpenSection={onOpenSection} />}

      {/* Časová osa: život až do důchodu jako jedna stuha. Hrdina obrazovky. */}
      <div className="rounded-2xl bg-sunken p-5 sm:p-6">
        <div className="mb-3">
          <h3 className="type-section text-ink">Likvidní úspory a měsíční prostor</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Peníze, které máte k dispozici v čase. Nejde o čisté jmění.
          </p>
        </div>
        {/* Animace se hlídat nemusí. Panely záložek zůstávají připojené
            (`hidden`, ne odpojení), takže se stuha vykreslí jednou při vstupu
            na výsledky a přepínání záložek ji nerozjede znovu. Přepočet při
            tažení posuvníku mění jen atribut `d`, ne uzel, takže taky ne. */}
        <JourneyRange
          horizonMonths={journeyData.horizonMonths}
          value={view}
          onChange={setViewMonths}
        />
        <JourneyRibbon
          data={journeyData}
          viewMonths={view}
          onMoveChild={state.goals.includes('child') ? onChangeChildTiming : undefined}
          childLabel={plannedChildren(state) > 1 ? 'děti' : 'dítě'}
          onMovePurchase={purchaseRange ? setPurchaseAt : undefined}
          purchaseRange={purchaseRange ?? undefined}
        />
        <JourneyRangeNote data={journeyData} viewMonths={view} />
        {/* Z čeho je stuha složená.
            Stálo to pod grafem „Vývoj úspor v čase" na záložce Rozpočet;
            ten graf kreslil tutéž řadu podruhé, jen v jiné barvě, a při jeho
            zrušení by se ta poznámka ztratila. Patří k řadě, ne ke kartě. */}
        <div className="mt-4 rounded-xl border border-line bg-card/70 p-3 text-sm text-ink-body">
          Časová osa ukazuje dostupné peníze. Při koupi z nich odečte vlastní vklad a jednorázové náklady.
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Částky jsou v dnešních cenách. Osa zahrnuje zadané změny příjmů a výdajů.
        </p>
        {/* Bez tohohle vypadá cesta u někoho, kdo na akontaci zatím nedosáhne,
            jako klidná zelená čára, zatímco verdikt nad ní říká „zatím na to
            nemáte". Ta čára je správně, jen kreslí život bez koupě; musí se
            u ní říct proč. */}
        {hasProperty && !journeyData.events.some((e) => e.key === 'purchase') && (
          <p className="mt-3 text-sm text-caution">
            V zadaném horizontu nevychází koupě s potřebnou hotovostí a udržitelným měsíčním rozpočtem.
          </p>
        )}
      </div>

      {/* Stav jednotlivých cílů */}
      {readinessGoals.length > 0 && (
        <div>
          <h3 className="type-label text-ink-muted mb-2">Jak jste na tom s cíli</h3>
          <div data-testid="cile-prehled" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
      {summary.budget && <BudgetSummary now={summary.budget} after={postBudget ?? null} />}
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
            testId={`kpi-${k.label}`}
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
