import type { WizardState } from '../../types';
import { wealthTimeline, monthsUntilDownPaymentReady, downPaymentTarget } from '../../engine/wealthTimeline';
import { downPaymentGap } from '../../engine/mortgage';
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
  const gap = downPaymentGap(state);

  // Akontaci už máte našetřenou → graf „za jak dlouho na ni dosáhnu" nedává
  // smysl, kartu proto vůbec nezobrazujeme (pokrytí akontace řeší kalkulačka
  // nemovitosti).
  if (gap <= 0) return null;

  const disposable = monthlyDisposable(state);
  // Cíl z celé investice včetně rekonstrukce, stejně jako `downPaymentGap`
  // a časová osa. Z holé ceny by graf hlásil dosažení dřív, než nastane.
  const downPayment = downPaymentTarget(state);

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
  const ready = monthsUntilDownPaymentReady(state, allocations);
  const intersectMonth = isFinite(ready) && ready <= HORIZON_MONTHS ? ready : undefined;

  const chartData = timeline.points
    .filter((_, i) => i % 12 === 0 || i === timeline.points.length - 1)
    .map((p) => ({
      year: Math.round(p.month / 12),
      savings: p.downPaymentFund,
    }));

  return (
    <Card>
      <h3 className="type-section text-ink mb-1">Vývoj úspor v čase</h3>
      {intersectMonth !== undefined && intersectMonth > 0 && (
        <p className="text-sm text-good mb-4">
          Při odkládání {czkPerMonth(monthlySaving)} na akontaci dosáhnete za {formatMonths(intersectMonth)}.
        </p>
      )}
      {intersectMonth === undefined && (
        <p className="text-sm text-caution mb-4">
          {monthlySaving > 0
            ? `Při odkládání ${czkPerMonth(monthlySaving)} na akontaci do 10 let nedosáhnete. Zkuste částku zvýšit posuvníkem v kalkulačce níže.`
            : 'Dokud na akontaci nic měsíčně neodkládáte, nenaspoříte ji. Částku nastavíte posuvníkem v kalkulačce níže.'}
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
          <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč`, 'Úspory']}
            labelFormatter={(label) => `Rok ${label}`}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
          />
          <ReferenceLine
            y={downPayment}
            stroke={colors.negative}
            strokeDasharray="5 5"
            label={{ value: `Akontace: ${Math.round(downPayment).toLocaleString('cs-CZ')} Kč`, position: 'insideTopRight', fill: colors.negative, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="savings" stroke={colors.primary} strokeWidth={2} fill="url(#savings-grad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
