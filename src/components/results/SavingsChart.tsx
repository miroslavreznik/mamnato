import type { WizardState } from '../../types';
import { wealthTimeline } from '../../engine/wealthTimeline';
import { purchaseCashPlan } from '../../engine/purchasePlan';
import type { GoalAllocations } from '../../engine/allocation';
import { monthlyDisposable } from '../../engine/cashflow';
import { formatMonths, czkPerMonth } from '../../engine/format';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';
import Card from '../ui/Card';
import Callout from '../ui/Callout';

/** Deset let, tolik graf kreslí. Delší pohled patří stuze v Přehledu. */
const HORIZON_MONTHS = 120;

interface Props {
  state: WizardState;
  /**
   * Rozdělení peněz na cíle. Graf potřebuje **celé**, ne jen částku na
   * akontaci: během rodičovské se o tok dělí i rezerva a ostatní cíle,
   * a přesně o to jde. Ze stejného rozdělení počítá dlaždice v souhrnu
   * i stuha; kdyby si graf počítal vlastní, hlásila by jedna stránka
   * tři různé termíny.
   */
  allocations: GoalAllocations;
}

export default function SavingsChart({ state, allocations }: Props) {
  const monthlySaving = allocations.downPayment;
  const colors = useChartColors();
  const purchase = purchaseCashPlan(state);

  if (purchase.cashGap <= 0) return null;

  const disposable = monthlyDisposable(state);

  if (disposable <= 0) {
    return (
      <Card title="Vývoj úspor v čase">        <Callout tone="caution" border alert>Při záporné disponibilní částce nelze zobrazit projekci úspor.</Callout>
      </Card>
    );
  }

  // Řada je z téže simulace, ze které kreslí stuha v Přehledu. Dřív to byla
  // přímka `akontace + částka × měsíc`, která neví o rodičovské, takže graf
  // sliboval dosažení akontace o měsíce dřív než osa o obrazovku výš.
  const timeline = wealthTimeline(state, { months: HORIZON_MONTHS, allocations });
  const ready = timeline.earliestCashReadyMonth;
  const endMonth = timeline.purchaseMonth ?? HORIZON_MONTHS;
  const chartData = timeline.points.slice(0, endMonth + 1)
    .filter((p) => p.month % 12 === 0 || p.month === ready || p.month === endMonth)
    .map((p) => ({
      month: p.month,
      savings: p.purchaseFund ?? p.availableCash ?? p.cash,
    }));

  return (
    <Card>
      <h3 className="type-section text-ink mb-1">Vývoj úspor v čase</h3>
      {ready != null && ready > 0 && (
        <p className="text-sm text-good mb-4">
          Při odkládání {czkPerMonth(monthlySaving)} byste hotovost potřebnou ke koupi měli za {formatMonths(ready)}.
          {timeline.purchaseMonth == null && ' Po nastěhování ale zatím nevychází měsíční rozpočet.'}
        </p>
      )}
      {ready == null && (
        <p className="text-sm text-caution mb-4">
          {monthlySaving > 0
            ? `Při odkládání ${czkPerMonth(monthlySaving)} potřebnou hotovost nenaspoříte do 10 let. Částku můžete upravit v kalkulačce bydlení.`
            : 'Částku, kterou chcete měsíčně odkládat na koupi, nastavíte v kalkulačce bydlení.'}
        </p>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <defs>
            <linearGradient id="savings-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis dataKey="month" type="number" domain={[0, endMonth]} tickFormatter={(month) => (month / 12).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`, 'Úspory']}
            labelFormatter={(label) => formatMonths(Number(label))}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
          />
          <ReferenceLine
            y={purchaseCashPlan(state, ready ?? 0).cashRequired}
            stroke={colors.negative}
            strokeDasharray="5 5"
            label={{ value: 'Potřebná hotovost', position: 'insideTopRight', fill: colors.negative, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="savings" stroke={colors.primary} strokeWidth={2} fill="url(#savings-grad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
