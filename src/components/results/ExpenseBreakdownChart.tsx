import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { WizardState } from '../../types';
import type { GoalAllocations } from '../../engine/allocation';
import { incomeFlow, withExcludedExpenses, withExcludedGoals } from '../../engine/expenseBreakdown';
import { evaluateOverall } from '../../engine/summary';
import { evaluateScenario } from '../../engine/scenarios';
import { downPaymentGap, monthsToSaveDownPayment, dsti } from '../../engine/mortgage';
import { formatMonths } from '../../engine/format';
import type { ExpenseCategory } from '../../engine/expenseBreakdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors, gridProps, axisProps, fmtKcShort, fmtKc } from './chartTheme';
import HelpTip from '../ui/Tooltip';

interface Props {
  state: WizardState;
  allocations: GoalAllocations;
  // Vypnuté výdaje i cíle drží dashboard, aby přepočet platil pro celou stránku.
  excluded: Set<string>;
  setExcluded: Dispatch<SetStateAction<Set<string>>>;
  excludedGoals: Set<string>;
  setExcludedGoals: Dispatch<SetStateAction<Set<string>>>;
}

interface Row {
  name: string;
  free: number;
  [key: string]: number | string;
}

interface GoalSegment {
  key: string;
  label: string;
  amount: number;
  color: string;
}

function toggle(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

export default function ExpenseBreakdownChart({ state, allocations, excluded, setExcluded, excludedGoals, setExcludedGoals }: Props) {
  const colors = useChartColors();
  const [showTable, setShowTable] = useState(false);

  const hasProperty = state.goals.includes('property');

  const flowNow = useMemo(() => incomeFlow(state, allocations, false, excluded), [state, allocations, excluded]);
  const flowAfter = useMemo(
    () => (hasProperty ? incomeFlow(state, allocations, true, excluded) : null),
    [state, allocations, hasProperty, excluded]
  );

  const income = flowNow.income;

  // Sjednocené pořadí výdajových kategorií (dle výše v „Nyní", od největší) + popisky.
  const { orderedKeys, labelMap, necessaryMap } = useMemo(() => {
    const labels: Record<string, string> = {};
    const necessary: Record<string, boolean> = {};
    const amountForSort: Record<string, number> = {};
    const merge = (cats: ExpenseCategory[]) => {
      cats.forEach((c) => {
        if (!(c.key in labels)) labels[c.key] = c.key === 'housing' ? 'Bydlení' : c.label;
        necessary[c.key] = c.necessary;
        amountForSort[c.key] = Math.max(amountForSort[c.key] ?? 0, c.amount);
      });
    };
    merge(flowNow.expenses);
    if (flowAfter) merge(flowAfter.expenses);
    const keys = Object.keys(labels).sort((a, b) => amountForSort[b] - amountForSort[a]);
    return { orderedKeys: keys, labelMap: labels, necessaryMap: necessary };
  }, [flowNow, flowAfter]);

  // Jednotlivé cíle jako samostatné segmenty grafu (místo jedné souhrnné „cíle").
  // Součet částek odpovídá spoření na cíle z incomeFlow, takže sloupce sedí na příjem.
  const goalSegments = useMemo<GoalSegment[]>(() => {
    const palette = colors.goalColors;
    const segs: GoalSegment[] = [];
    const nextColor = () => palette[segs.length % palette.length];
    if (state.goals.includes('retirement') && allocations.retirement > 0) {
      segs.push({ key: 'retirement', label: 'Spoření na důchod', amount: excludedGoals.has('retirement') ? 0 : allocations.retirement, color: nextColor() });
    }
    if (state.goals.includes('child') && allocations.child > 0) {
      segs.push({ key: 'child', label: 'Rezerva na dítě', amount: excludedGoals.has('child') ? 0 : allocations.child, color: nextColor() });
    }
    if (state.goals.includes('other')) {
      const total = allocations.custom.reduce((sum, v) => sum + v, 0);
      if (total > 0) segs.push({ key: 'other', label: 'Vlastní cíle', amount: excludedGoals.has('other') ? 0 : total, color: nextColor() });
    }
    return segs;
  }, [state.goals, allocations, excludedGoals, colors.goalColors]);

  const goalLabelByKey = useMemo(
    () => Object.fromEntries(goalSegments.map((s) => [s.key, s.label])),
    [goalSegments]
  );

  const buildRow = (name: string, expenses: ExpenseCategory[], free: number): Row => {
    const row: Row = { name, free: Math.max(0, free) };
    for (const c of expenses) {
      row[c.key] = excluded.has(c.key) ? 0 : c.amount;
    }
    for (const s of goalSegments) {
      row[s.key] = s.amount;
    }
    return row;
  };

  const data: Row[] = [buildRow('Nyní', flowNow.expenses, flowNow.free)];
  if (flowAfter) {
    data.push(buildRow('Po koupi', flowAfter.expenses, flowAfter.free));
  }

  const freeColor = (v: number) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');

  // Jádro téhle sekce: co udělá vypnutí položky s odpovědí „Mám na to?".
  // Porovnáváme verdikt beze změn s verdiktem po vypnutí.
  const anythingOff = excluded.size > 0 || excludedGoals.size > 0;
  const whatIf = useMemo(() => {
    if (!anythingOff) return null;
    const baseline = evaluateOverall(state, allocations);
    const adjusted = withExcludedGoals(withExcludedExpenses(state, excluded), excludedGoals);
    const adjustedAllocations = {
      mortgage: excludedGoals.has('property') ? 0 : allocations.mortgage,
      retirement: excludedGoals.has('retirement') ? 0 : allocations.retirement,
      child: excludedGoals.has('child') ? 0 : allocations.child,
      custom: excludedGoals.has('other') ? allocations.custom.map(() => 0) : allocations.custom,
    };
    const now = evaluateOverall(adjusted, adjustedAllocations);
    const rank = { no: 0, no_but: 1, yes_but: 2, yes: 3 } as const;
    const improved = rank[now.verdict.answer] > rank[baseline.verdict.answer];
    const worsened = rank[now.verdict.answer] < rank[baseline.verdict.answer];

    // Když se verdikt nehnul, je potřeba říct proč. Některé překážky
    // (hlavně vysoká splátka vůči příjmu) se škrtáním výdajů spravit nedají
    // a uživatel by jinak zbytečně vypínal další a další položky.
    let hint = 'Na celkovou odpověď to zatím nestačí. Zkuste vypnout i něco dalšího.';
    if (!improved && adjusted.goals.includes('property')) {
      const scenario = evaluateScenario(adjusted);
      const dstiPct = Math.round(dsti(adjusted) * 100);
      const gap = downPaymentGap(adjusted);
      if (scenario.id === 'cannot_afford_dsti') {
        hint = `Splátka by zabrala ${dstiPct} % čistého příjmu, což je nad tím, co banky obvykle schválí. Tohle škrtáním výdajů nespravíte: pomohla by levnější nemovitost, vyšší akontace, delší splatnost nebo vyšší příjem.`;
      } else if (gap > 0) {
        const before = monthsToSaveDownPayment(state);
        const after = monthsToSaveDownPayment(adjusted);
        hint = after < before
          ? `Verdikt se zatím nezměnil, ale chybějící akontaci díky tomu naspoříte za ${formatMonths(after, true)} místo ${formatMonths(before, true)}.`
          : 'Zbývá naspořit akontaci. Na celkovou odpověď to zatím nestačí.';
      }
    }

    return { baseline: baseline.verdict, now: now.verdict, improved, worsened, hint };
  }, [anythingOff, state, allocations, excluded, excludedGoals]);


  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Co kdyby: kam jde váš příjem</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Celý měsíční příjem ({fmtKc(income)}) rozdělený na výdaje, cíle a volnou rezervu.{' '}
        <span className="text-gray-600 dark:text-gray-300">Klepnutím na položku ji vypnete</span> a hned uvidíte, jestli by vám pak na zbytek vyšlo. Zkuste třeba vypnout dovolenou nebo dítě.
      </p>

      {/* Výsledek pokusu: změnila se odpověď „Mám na to?" */}
      {whatIf && (
        <div className={`mb-4 p-3 rounded-lg border text-sm ${
          whatIf.improved
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : whatIf.worsened
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
        }`}>
          <p className="text-gray-800 dark:text-gray-100">
            <span className="font-semibold">Bez vypnutých položek: {whatIf.now.headline}
              {whatIf.now.qualifier ? `, ${whatIf.now.qualifier}` : ''}.</span>
          </p>
          {whatIf.improved && (
            <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
              Pomohlo to. Původně: {whatIf.baseline.headline.toLowerCase()}
              {whatIf.baseline.qualifier ? `, ${whatIf.baseline.qualifier}` : ''}.
            </p>
          )}
          {!whatIf.improved && (
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">{whatIf.hint}</p>
          )}
        </div>
      )}

      {/* Stat tiles: volná rezerva */}
      {/* Na mobilu dlaždice pod sebe: vedle sebe se částka i s „/měs" nevejde. */}
      <div className={`grid gap-3 mb-5 ${flowAfter ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
            Volná rezerva nyní
            <HelpTip text="Co z příjmu zbyde po zaplacení výdajů a spoření na cíle (příjem − výdaje − spoření). Volné peníze na nečekané situace." />
          </span>
          <p className={`text-xl sm:text-2xl font-bold whitespace-nowrap ${freeColor(flowNow.free)}`}>
            {flowNow.free >= 0 ? '' : '−'}{fmtKc(Math.abs(flowNow.free))}<span className="text-sm font-normal text-gray-400">/měs</span>
          </p>
        </div>
        {flowAfter && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center">
              Volná rezerva po koupi
              <HelpTip text="Totéž po koupi nemovitosti: místo nájmu a energií platíte splátku hypotéky a náklady vlastnictví. Záporné číslo = rozpočet po koupi nevyjde." />
            </span>
            <p className={`text-xl sm:text-2xl font-bold whitespace-nowrap ${freeColor(flowAfter.free)}`}>
              {flowAfter.free >= 0 ? '' : '−'}{fmtKc(Math.abs(flowAfter.free))}<span className="text-sm font-normal text-gray-400">/měs</span>
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={data.length > 1 ? 160 : 110}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid {...gridProps(colors)} horizontal={false} />
          <XAxis type="number" tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <YAxis type="category" dataKey="name" width={70} {...axisProps(colors)} />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.3 }}
            contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 8, fontSize: 13 }}
            formatter={(value, name) => {
              const n = String(name);
              const label = n === 'free' ? 'Volná rezerva' : goalLabelByKey[n] ?? labelMap[n] ?? n;
              return [fmtKc(Number(value)), label];
            }}
          />
          {orderedKeys.map((key) => (
            <Bar key={key} dataKey={key} stackId="a" fill={colors.categorical[key] ?? colors.primary} stroke={colors.surface} strokeWidth={2} radius={2} />
          ))}
          {goalSegments.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} stroke={colors.surface} strokeWidth={2} radius={2} />
          ))}
          <Bar dataKey="free" stackId="a" fill={colors.categorical.surplus} stroke={colors.surface} strokeWidth={2} radius={[2, 4, 4, 2]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Toggle chips výdajů + legenda skupin */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {orderedKeys.map((key) => {
            const off = excluded.has(key);
            const color = colors.categorical[key] ?? colors.primary;
            return (
              <button
                key={key}
                onClick={() => setExcluded((prev) => toggle(prev, key))}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs border transition-colors ${
                  off
                    ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}
                title={necessaryMap[key] ? 'Nezbytný výdaj' : 'Zbytný výdaj'}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: off ? 'transparent' : color, border: off ? `1px solid ${color}` : 'none' }}
                />
                {labelMap[key]}
                {!necessaryMap[key] && <span className="text-[10px] text-amber-600 dark:text-amber-400">zbytné</span>}
              </button>
            );
          })}
          {goalSegments.map((seg) => {
            const off = excludedGoals.has(seg.key);
            return (
              <button
                key={seg.key}
                onClick={() => setExcludedGoals((prev) => toggle(prev, seg.key))}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs border transition-colors ${
                  off
                    ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}
                title="Cíl, zkuste ho vypnout a uvidíte, co to udělá s verdiktem"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: off ? 'transparent' : seg.color, border: off ? `1px solid ${seg.color}` : 'none' }}
                />
                {seg.label}
                <span className="text-[10px] text-blue-600 dark:text-blue-400">cíl</span>
              </button>
            );
          })}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.categorical.surplus }} />
            Volná rezerva
          </span>
        </div>
        {hasProperty && (
          <div className="mt-2">
            <button
              onClick={() => setExcludedGoals((prev) => toggle(prev, 'property'))}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs border transition-colors ${
                excludedGoals.has('property')
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
              }`}
            >
              Koupě nemovitosti
              <span className="text-[10px] text-blue-600 dark:text-blue-400">cíl</span>
            </button>
          </div>
        )}
        {(excluded.size > 0 || excludedGoals.size > 0) && (
          <button
            onClick={() => { setExcluded(new Set()); setExcludedGoals(new Set()); }}
            className="mt-2 inline-block py-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Vrátit vše zpět
          </button>
        )}
      </div>

      {/* Stejná čísla jako tabulka pro ty, kdo chtějí přesné částky pod sebou */}
      <div className="mt-3">
        <button
          onClick={() => setShowTable((v) => !v)}
          className="inline-block py-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showTable ? 'Skrýt tabulku' : 'Zobrazit čísla v tabulce'}
        </button>
        {showTable && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-left py-1.5 font-normal">Položka</th>
                  <th className="text-right py-1.5 font-normal">Nyní</th>
                  {flowAfter && <th className="text-right py-1.5 font-normal">Po koupi</th>}
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                <tr className="border-b border-gray-100 dark:border-gray-700/50 font-medium text-gray-900 dark:text-white">
                  <td className="py-1.5">Příjem</td>
                  <td className="text-right py-1.5">{fmtKc(income)}</td>
                  {flowAfter && <td className="text-right py-1.5">{fmtKc(flowAfter.income)}</td>}
                </tr>
                {orderedKeys.map((key) => {
                  const now = excluded.has(key) ? 0 : flowNow.expenses.find((c) => c.key === key)?.amount ?? 0;
                  const after = flowAfter ? (excluded.has(key) ? 0 : flowAfter.expenses.find((c) => c.key === key)?.amount ?? 0) : null;
                  return (
                    <tr key={key} className={`border-b border-gray-100 dark:border-gray-700/50 ${excluded.has(key) ? 'opacity-50 line-through' : ''}`}>
                      <td className="py-1.5">−&nbsp;{labelMap[key]}{!necessaryMap[key] && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 no-underline">zbytné</span>}</td>
                      <td className="text-right py-1.5">{fmtKc(now)}</td>
                      {after !== null && <td className="text-right py-1.5">{fmtKc(after)}</td>}
                    </tr>
                  );
                })}
                {goalSegments.map((s) => (
                  <tr key={s.key} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-1.5">−&nbsp;{s.label} <span className="text-[10px] text-gray-400">(spoření)</span></td>
                    <td className="text-right py-1.5">{fmtKc(s.amount)}</td>
                    {flowAfter && <td className="text-right py-1.5">{fmtKc(s.amount)}</td>}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 text-gray-900 dark:text-white">= Volná rezerva</td>
                  <td className={`text-right py-1.5 ${freeColor(flowNow.free)}`}>{fmtKc(flowNow.free)}</td>
                  {flowAfter && <td className={`text-right py-1.5 ${freeColor(flowAfter.free)}`}>{fmtKc(flowAfter.free)}</td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
