import { useMemo, useState } from 'react';
import type { WizardState } from '../../types';
import { monthlyDisposable } from '../../engine/cashflow';
import { retirementProjection, retirementStartingCapital, fourPercentTarget, yearOfReachingTarget, yearsUntilRetirement, retirementAge } from '../../engine/savings';
import { DEFAULTS } from '../../engine/defaults';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
// `Tooltip` je v tomhle souboru Recharts. Vlastní nápověda se proto podle
// zvyklosti repozitáře importuje jako `HelpTip`.
import HelpTip, { HELP_BUTTON } from '../ui/Tooltip';
import NumField from '../ui/NumField';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import { fieldClass } from '../ui/fieldClass';
import { czkPerMonth, formatYears } from '../../engine/format';

const INFLATION = DEFAULTS.averageCzInflation;

const instrumentDefs = [
  { key: 'sp500', label: 'SP500 / globální akcie', rate: 7, colorRole: 'primary' as const },
  { key: 'bonds', label: 'Státní dluhopisy ČR', rate: 4, colorRole: 'positive' as const },
  { key: 'savings', label: 'Spořicí účet', rate: 4.5, colorRole: 'accent' as const },
  { key: 'gold', label: 'Zlato', rate: 3, colorRole: 'accent2' as const },
  { key: 'cash', label: 'Hotovost (pod polštářem)', rate: 0, colorRole: 'negative' as const },
];

interface Props {
  state: WizardState;
  // Kolik na důchod plánujete měsíčně dávat, sdílené s rozpočtem, takže změna
  // se projeví i v grafu rozpočtu a ve verdiktu (a naopak).
  monthlyContribution: number;
  onChangeContribution: (value: number) => void;
  /** Zápis výnosu nástroje do plánu (desetinné číslo, 0,07 = 7 %). */
  onChangeRate: (key: string, rate: number) => void;
}

export default function RetirementPlanner({ state, monthlyContribution, onChangeContribution, onChangeRate }: Props) {
  const colors = useChartColors();
  const instruments = instrumentDefs.map((i) => ({ ...i, color: colors[i.colorRole] }));
  const disposable = monthlyDisposable(state);
  const monthlyAmount = monthlyContribution;
  const setMonthlyAmount = onChangeContribution;
  // Odhad appky, dokud uživatel nezadá svoje (viz `engine/estimate.ts`).
  //
  // Nesmí to být `useState(odhad)`: počáteční hodnota se vyhodnotí jednou při
  // prvním vykreslení a záložky výsledků zůstávají připojené, takže po změně
  // úspor nebo věku v Rozpočtu tady dál svítilo staré číslo a projekce
  // počítala z něčeho, co na obrazovce už nikde nestálo.
  const [yearsOverride, setYearsOverride] = useState<number | null>(null);
  const yearsToRetirement = yearsOverride ?? yearsUntilRetirement(retirementAge(state));
  const [capitalOverride, setCapitalOverride] = useState<number | null>(null);
  const startingCapital = capitalOverride ?? retirementStartingCapital(state);
  const [monthlyRent, setMonthlyRent] = useState(30000);
  // Výnosy jsou zadané údaje, ne nastavení karty: z akciové řady počítá
  // i věta o rentě v Přehledu. Dokud si je karta držela sama, ukazovala
  // tabulka portfolio při 4 %, zatímco verdikt vedle mluvil o sedmi.
  const rates = useMemo(
    () => Object.fromEntries(instruments.map((i) => [i.key, (state.retirementRates?.[i.key] ?? i.rate / 100) * 100])),
    [instruments, state.retirementRates]
  );
  const setRate = (key: string, percent: number) => onChangeRate(key, percent / 100);
  /**
   * Výchozí je **dnešní kupní síla**, ne nominální hodnota.
   *
   * Cíl renty („chci 30 000 Kč měsíčně") uživatel zadává v dnešních penězích,
   * takže se proti němu musí porovnávat portfolio v týchž penězích. S
   * nominální řadou tvrdila tabulka „cíle dosáhnete za 19 let" o částce, která
   * za 19 let koupí zhruba půlku toho, co dnes. Zbytek appky (časová osa,
   * věta o rentě v Přehledu) počítá v dnešních cenách taky, takže tahle karta
   * byla jediné místo s druhým měřítkem.
   */
  const [showInflation, setShowInflation] = useState(true);
  const [showInflationInfo, setShowInflationInfo] = useState(false);
  const [showRentInfo, setShowRentInfo] = useState(false);

  const targetPortfolio = fourPercentTarget(monthlyRent);

  const nominalProjections = instruments.map((inst) => ({
    ...inst,
    data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100, undefined, startingCapital),
  }));

  const realProjections = showInflation
    ? instruments.map((inst) => ({
        ...inst,
        data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100, INFLATION, startingCapital),
      }))
    : null;

  // Jedna sada čar, ne dvě.
  //
  // Dokud se kreslily obě, měl graf deset čar a legenda tři řádky, ve kterých
  // se nedalo najít, která čára je která. Přepínač je **volba měřítka**, ne
  // volba „ukázat navíc": buď se čte dnešní kupní síla, nebo nominální
  // hodnota. Co znamená která, vysvětluje nápověda vedle přepínače.
  const shownProjections = realProjections ?? nominalProjections;
  const chartData = Array.from({ length: yearsToRetirement + 1 }, (_, year) => {
    const point: Record<string, number> = { year };
    for (const p of shownProjections) {
      point[p.key] = p.data[year]?.portfolioValue ?? 0;
    }
    return point;
  });

  // Co do portfolia vložíte vlastními penězi: dnešní kapitál plus všechny
  // budoucí vklady. Zbytek je výnos.
  const totalContributions = monthlyAmount * yearsToRetirement * 12;
  const ownMoney = totalContributions + startingCapital;

  const fmt = fmtKcShort;

  // For the table, show real values when inflation is on, nominal otherwise
  const tableProjections = showInflation && realProjections ? realProjections : nominalProjections;

  return (
    <Card title="Plán spoření na důchod">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">
            Měsíční částka k investování
          </label>
          <NumField
            value={monthlyAmount}
            onChange={setMonthlyAmount}
            ariaLabel="Měsíční částka k investování"
            step={500}
            suffix="Kč"
            className={fieldClass('w-full px-3 py-2.5 pr-9 text-base')}
          />
          <p className="mt-1 text-xs text-ink-faint">Disponibilní částka: {czkPerMonth(disposable)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">
            Počet let do důchodu
          </label>
          <NumField
            value={yearsToRetirement}
            onChange={setYearsOverride}
            min={1} max={50}
            ariaLabel="Počet let do důchodu"
            step={1}
            className={fieldClass('w-full px-3 py-2.5 text-base')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1 flex items-center">
            Už mám naspořeno
            <HelpTip text="Kolik z dnešních úspor je určeno na důchod. Appka odhadla to, co zbývá po odečtení akontace a tříměsíční nouzové rezervy; přepište, pokud je to u vás jinak. Bez téhle částky by projekce počítala jen nové vklady a portfolio by vycházelo mnohem níž, než jaké doopravdy bude." />
          </label>
          <NumField
            value={startingCapital}
            onChange={setCapitalOverride}
            ariaLabel="Už mám naspořeno"
            step={50000}
            suffix="Kč"
            className={fieldClass('w-full px-3 py-2.5 pr-9 text-base')}
          />
        </div>
      </div>

      {/* 4% rule / renta target */}
      <div className="mb-4 p-4 bg-tint-good rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-ink-label mb-1 flex items-center">
              Požadovaná měsíční renta
              <button
                onClick={() => setShowRentInfo(!showRentInfo)}
                className={`ml-1 ${HELP_BUTTON}`}
                aria-label="Nápověda k pravidlu 4 %"
              >?</button>
            </label>
            <NumField
              value={monthlyRent}
              onChange={setMonthlyRent}
              ariaLabel="Požadovaná měsíční renta"
              step={1000}
              suffix="Kč"
              className={fieldClass('w-full px-3 py-2.5 pr-9 text-base')}
            />
          </div>
          <div className="flex-1 sm:text-right">
            <p className="text-sm text-ink-muted">Potřebná hodnota portfolia</p>
            <p className="text-xl sm:text-2xl font-bold whitespace-nowrap text-good">
              {targetPortfolio === Infinity ? '–' : `${Math.round(targetPortfolio).toLocaleString('cs-CZ')} Kč`}
            </p>
          </div>
        </div>
        {showRentInfo && (
          <div className="mt-3 text-sm text-good space-y-2">
            <p className="font-semibold">Co je „pravidlo 4 %"?</p>
            <p>
              Podle pravidla 4 % můžete každý rok bezpečně vybrat zhruba 4 % hodnoty svého portfolia, aniž byste ho vyčerpali.
              Pro rentu {monthlyRent.toLocaleString('cs-CZ')} Kč měsíčně (tj. {(monthlyRent * 12).toLocaleString('cs-CZ')} Kč ročně)
              tak potřebujete portfolio o hodnotě přibližně <strong>{targetPortfolio === Infinity ? '–' : `${Math.round(targetPortfolio).toLocaleString('cs-CZ')} Kč`}</strong> (renta × 300).
            </p>
            <p className="text-xs text-good">
              Jde o zjednodušený orientační výpočet. Skutečná bezpečná míra výběru závisí na délce renty, složení portfolia a vývoji trhů.
            </p>
          </div>
        )}
      </div>

      {/* Přepínač inflace.
          Byl to `div` s `onClick`: myší fungoval, tabulátor ho přeskočil
          a mezerník s ním nehnul. Je to jediný ovladač, který v téhle kartě
          rozhoduje o tom, co čísla znamenají, takže musí jít ovládat i bez
          myši. Proto `button` s `role="switch"`, ne obrázek přepínače. */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          role="switch"
          aria-checked={showInflation}
          onClick={() => setShowInflation(!showInflation)}
          className="flex items-center gap-2 min-h-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <span
            aria-hidden="true"
            className={`relative shrink-0 w-10 h-6 rounded-full border border-line-strong transition-colors ${showInflation ? 'bg-ink' : 'bg-shell'}`}
          >
            {/* `left-0.5` musí být, ne jen `translate`. Bez něj se puntík
                umístí podle statické pozice uvnitř `span` a vyjede osmnáct
                pixelů za pilulku: v zapnutém stavu překryl první písmeno
                popisku, takže tam stálo „očítat v dnešních cenách". */}
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${showInflation ? 'translate-x-[16px]' : 'translate-x-0'}`} />
          </span>
          <span className="text-sm font-medium text-ink-label">Počítat v dnešních cenách</span>
        </button>
        <button
          onClick={() => setShowInflationInfo(!showInflationInfo)}
          className={HELP_BUTTON}
          aria-label="Nápověda k inflaci"
        >?</button>
      </div>

      {showInflationInfo && (
        <Callout tone="brand" pad="p-4 rounded-lg" className="mb-4 space-y-2">
          <p className="font-semibold">Co znamená „počítat v dnešních cenách"?</p>
          <p>
            Inflace postupně snižuje kupní sílu peněz. 1 000 000 Kč dnes bude mít za 30 let reálnou hodnotu
            přibližně 412 000 Kč (při průměrné inflaci 3 % ročně).
          </p>
          <p>
            Zapnuto (výchozí stav) graf i tabulka ukazují <strong>dnešní kupní sílu</strong>, tedy kolik si za
            portfolio skutečně koupíte. Rentu si přejete taky v dnešních penězích, takže se obojí dá porovnat.
            Vypnuto uvidíte <strong>nominální</strong> hodnotu, tedy číslo, které bude jednou na výpisu z účtu;
            proti cíli renty ale vypadá lépe, než jaké doopravdy je.
          </p>
          <p>Používáme průměrnou roční inflaci v ČR: <strong>3 %</strong> (dlouhodobý průměr ČNB).</p>
        </Callout>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <CartesianGrid {...gridProps(colors)} />
          {targetPortfolio !== Infinity && targetPortfolio > 0 && (
            <ReferenceLine
              y={targetPortfolio}
              stroke={colors.positive}
              strokeDasharray="6 4"
              label={{ value: 'Cíl renty', position: 'insideTopRight', fill: colors.positive, fontSize: 12 }}
            />
          )}
          <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmt} {...axisProps(colors)} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => instruments.find((i) => i.key === name)?.label ?? name}
              />
            }
          />
          {/* Popisek se sází barvou textu, ne barvou série: odstíny sérií jsou
              ověřené jako značky v grafu (práh 3:1 vůči ploše), ne jako text,
              kde je potřeba 4,5:1. Barvu nese čtvereček vedle popisku. */}
          <Legend
            formatter={(value) => (
              <span className="text-ink-body">
                {instruments.find((i) => i.key === value)?.label ?? value}
              </span>
            )}
          />
          {instruments.map((inst) => (
            <Line
              key={inst.key}
              type="monotone"
              dataKey={inst.key}
              stroke={inst.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-ink-label mb-3">
          Výsledná hodnota portfolia{showInflation ? ' (reálná kupní síla)' : ''}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left py-2 text-ink-muted">Nástroj</th>
                <th className="text-right py-2 text-ink-muted">Výnos % / rok</th>
                <th className="text-right py-2 text-ink-muted">Hodnota</th>
                <th className="text-right py-2 text-ink-muted">
                  {showInflation ? 'Reálný zisk' : 'Složené úroky'}
                </th>
                <th className="text-right py-2 text-ink-muted">Cíl renty</th>
              </tr>
            </thead>
            <tbody>
              {tableProjections.map((p) => {
                const finalValue = p.data[p.data.length - 1]?.portfolioValue ?? 0;
                // Vlastní peníze, ne jen vklady. Bez počátečního kapitálu
                // hlásil řádek „Hotovost (pod polštářem)" při nulovém výnosu
                // dva miliony složených úroků.
                const compoundInterest = finalValue - ownMoney;
                const reachedYear = targetPortfolio !== Infinity
                  ? yearOfReachingTarget(p.data, targetPortfolio)
                  : null;
                return (
                  <tr key={p.key} className="border-b border-line">
                    <td className="py-2 text-ink">
                      <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </td>
                    <td className="text-right py-2 text-ink-body">
                      <NumField
                        value={rates[p.key]}
                        onChange={(v) => setRate(p.key, v)}
                        ariaLabel={`Výnos ${p.label}`}
                        className={fieldClass('w-20 text-right px-2 py-2 text-sm')}
                      />
                      <span className="ml-1">%</span>
                    </td>
                    <td className="text-right py-2 font-semibold text-ink">
                      {finalValue.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className={`text-right py-2 font-semibold ${compoundInterest >= 0 ? 'text-good' : 'text-danger'}`}>
                      {compoundInterest >= 0 ? '+' : ''}{compoundInterest.toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="text-right py-2">
                      {reachedYear !== null ? (
                        <span className="text-good font-medium">za {formatYears(reachedYear)}</span>
                      ) : (
                        <span className="text-ink-faint">nedosaženo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong">
                <td colSpan={2} className="py-2 text-ink-body text-sm">
                  {/* Když se počítá i s dnešním kapitálem, musí být vidět,
                      z čeho se „vlastní peníze" skládají. Jinak nesedí ani
                      sloupec s výnosem. */}
                  Vlastní peníze celkem: {ownMoney.toLocaleString('cs-CZ')} Kč
                  {startingCapital > 0 && (
                    <span className="text-ink-faint">
                      {' '}({startingCapital.toLocaleString('cs-CZ')} Kč dnes
                      {' '}+ {totalContributions.toLocaleString('cs-CZ')} Kč vklady)
                    </span>
                  )}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Výnosy jsou historické průměry. Skutečné výsledky se mohou lišit.
        {showInflation && ` Inflace: ${(INFLATION * 100).toFixed(0)} % ročně (dlouhodobý průměr ČNB).`}
      </p>
    </Card>
  );
}
