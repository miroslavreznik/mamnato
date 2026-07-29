import { useState } from 'react';
import type { WizardState } from '../../types';
import { monthlyDisposable } from '../../engine/cashflow';
import { retirementProjection, fourPercentTarget, yearOfReachingTarget, yearsUntilRetirement } from '../../engine/savings';
import { DEFAULTS } from '../../engine/defaults';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
import NumField from '../ui/NumField';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import { fieldClass } from '../ui/fieldClass';

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
}

export default function RetirementPlanner({ state, monthlyContribution, onChangeContribution }: Props) {
  const colors = useChartColors();
  const instruments = instrumentDefs.map((i) => ({ ...i, color: colors[i.colorRole] }));
  const disposable = monthlyDisposable(state);
  const monthlyAmount = monthlyContribution;
  const setMonthlyAmount = onChangeContribution;
  const [yearsToRetirement, setYearsToRetirement] = useState(() => yearsUntilRetirement(state.person1Age));
  const [monthlyRent, setMonthlyRent] = useState(30000);
  const [rates, setRates] = useState(() =>
    Object.fromEntries(instruments.map((i) => [i.key, i.rate]))
  );
  const [showInflation, setShowInflation] = useState(false);
  const [showInflationInfo, setShowInflationInfo] = useState(false);
  const [showRentInfo, setShowRentInfo] = useState(false);

  const targetPortfolio = fourPercentTarget(monthlyRent);

  const nominalProjections = instruments.map((inst) => ({
    ...inst,
    data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100),
  }));

  const realProjections = showInflation
    ? instruments.map((inst) => ({
        ...inst,
        data: retirementProjection(monthlyAmount, yearsToRetirement, rates[inst.key] / 100, INFLATION),
      }))
    : null;

  // Merge all projections into a single dataset for the chart
  const chartData = Array.from({ length: yearsToRetirement + 1 }, (_, year) => {
    const point: Record<string, number> = { year };
    for (const p of nominalProjections) {
      if (showInflation) {
        point[`${p.key}_nom`] = p.data[year]?.portfolioValue ?? 0;
      } else {
        point[p.key] = p.data[year]?.portfolioValue ?? 0;
      }
    }
    if (realProjections) {
      for (const p of realProjections) {
        point[p.key] = p.data[year]?.portfolioValue ?? 0;
      }
    }
    return point;
  });

  const totalContributions = monthlyAmount * yearsToRetirement * 12;

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
          <p className="mt-1 text-xs text-ink-faint">Disponibilní příjem: {disposable.toLocaleString('cs-CZ')} Kč/měs.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-label mb-1">
            Počet let do důchodu
          </label>
          <NumField
            value={yearsToRetirement}
            onChange={setYearsToRetirement}
            min={1} max={50}
            ariaLabel="Počet let do důchodu"
            step={1}
            className={fieldClass('w-full px-3 py-2.5 text-base')}
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
                className="ml-1 text-good hover:text-good text-sm"
                aria-label="Informace o 4% pravidle"
              >ⓘ</button>
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

      {/* Inflation toggle */}
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${showInflation ? 'bg-ink' : 'bg-shell'}`}
            onClick={() => setShowInflation(!showInflation)}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${showInflation ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm font-medium text-ink-label">Započítat inflaci</span>
        </label>
        <button
          onClick={() => setShowInflationInfo(!showInflationInfo)}
          className="text-brand hover:text-brand text-sm"
          aria-label="Informace o inflaci"
        >ⓘ</button>
      </div>

      {showInflationInfo && (
        <Callout tone="brand" pad="p-4 rounded-lg" className="mb-4 space-y-2">
          <p className="font-semibold">Co znamená „započítat inflaci"?</p>
          <p>
            Inflace postupně snižuje kupní sílu peněz. 1 000 000 Kč dnes bude mít za 30 let reálnou hodnotu
            přibližně 412 000 Kč (při průměrné inflaci 3 % ročně).
          </p>
          <p>
            Když zapnete tento přepínač, graf ukazuje <strong>reálnou hodnotu</strong> vašich úspor, tedy kolik
            si za ně skutečně koupíte v dnešních cenách. Nominální hodnota je to, co uvidíte na výpisu z účtu.
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
                nameFormatter={(name) => {
                  const isNominal = name.endsWith('_nom');
                  const key = isNominal ? name.replace('_nom', '') : name;
                  const label = instruments.find((i) => i.key === key)?.label ?? key;
                  return isNominal ? `${label} (nominální)` : showInflation ? `${label} (reálná)` : label;
                }}
              />
            }
          />
          {/* Popisek se sází barvou textu, ne barvou série: odstíny sérií jsou
              ověřené jako značky v grafu (práh 3:1 vůči ploše), ne jako text,
              kde je potřeba 4,5:1. Barvu nese čtvereček vedle popisku. */}
          <Legend
            formatter={(value) => {
              const isNominal = value.endsWith('_nom');
              const key = isNominal ? value.replace('_nom', '') : value;
              const label = instruments.find((i) => i.key === key)?.label ?? key;
              const text = isNominal ? `${label} (nom.)` : showInflation ? `${label} (reál.)` : label;
              return <span className="text-ink-body">{text}</span>;
            }}
          />
          {instruments.map((inst) => (
            showInflation ? (
              <Line
                key={`${inst.key}_nom`}
                type="monotone"
                dataKey={`${inst.key}_nom`}
                stroke={inst.color}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                opacity={0.5}
              />
            ) : null
          ))}
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
                const compoundInterest = finalValue - totalContributions;
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
                        onChange={(v) => setRates({ ...rates, [p.key]: v })}
                        ariaLabel={`Výnos ${p.label}`}
                        className="w-20 text-right px-2 py-2 border border-line  rounded text-sm"
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
                        <span className="text-good font-medium">za {reachedYear} {reachedYear === 1 ? 'rok' : reachedYear < 5 ? 'roky' : 'let'}</span>
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
                  Celkové vklady: {totalContributions.toLocaleString('cs-CZ')} Kč
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
