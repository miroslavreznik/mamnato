import { useState } from 'react';
import type { WizardState } from '../../types';
import { investmentComparison } from '../../engine/savings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
import NumField from '../ui/NumField';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';

interface Props {
  state: WizardState;
}

export default function InvestmentComparisonChart({ state }: Props) {
  const colors = useChartColors();
  const [propertyRate, setPropertyRate] = useState(3);
  const [sp500Rate, setSp500Rate] = useState(7);
  const [rentGrowth, setRentGrowth] = useState(3);

  const data = investmentComparison(
    state,
    propertyRate / 100,
    sp500Rate / 100,
    rentGrowth / 100,
    30
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Koupě vs. nájem: vývoj čistého jmění</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Všechny tři čáry ukazují <span className="text-gray-600 dark:text-gray-300">čisté jmění</span>, tedy co byste měli, kdybyste
        všechno prodali a doplatili dluhy. Startují na stejné částce: vlastník ji dá do akontace, nájemník ji investuje.
      </p>

      {/* Bez tohohle vysvětlení nešlo poznat, co která čára znamená. */}
      <ul className="mb-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <li><span className="font-medium text-gray-700 dark:text-gray-300">Koupě nemovitosti:</span> hodnota bytu minus zbytek hypotéky. Když vyjde vlastnictví levněji než nájem, rozdíl se investuje.</li>
        <li><span className="font-medium text-gray-700 dark:text-gray-300">Nájem a investování rozdílu:</span> nájemník investuje akontaci i to, oč měsíčně platí míň než vlastník.</li>
        <li><span className="font-medium text-gray-700 dark:text-gray-300">Nájem bez investování:</span> ušetřený rozdíl se utratí, takže jmění neroste. Nejčastější varianta v praxi.</li>
      </ul>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <CartesianGrid {...gridProps(colors)} />
          <XAxis dataKey="year" {...axisProps(colors)} label={{ value: 'Roky', position: 'insideBottom', offset: -3, fill: colors.tick, fontSize: 12 }} />
          <YAxis tickFormatter={fmtKcShort} {...axisProps(colors)} />
          <Tooltip
            content={
              <SortedTooltip
                labelFormatter={(label) => `Rok ${label}`}
                nameFormatter={(name) => {
                  const labels: Record<string, string> = {
                    propertyNetWorth: 'Koupě nemovitosti',
                    rentInvestNetWorth: 'Nájem a investování rozdílu',
                    rentNoInvestNetWorth: 'Nájem bez investování',
                  };
                  return labels[name] ?? name;
                }}
              />
            }
          />
          <Legend
            formatter={(value) => {
              const labels: Record<string, string> = {
                propertyNetWorth: 'Koupě nemovitosti',
                rentInvestNetWorth: 'Nájem a investování rozdílu',
                rentNoInvestNetWorth: 'Nájem bez investování',
              };
              return labels[value] ?? value;
            }}
          />
          <Line type="monotone" dataKey="propertyNetWorth" stroke={colors.positive} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rentInvestNetWorth" stroke={colors.primary} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rentNoInvestNetWorth" stroke={colors.negative} strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Zhodnocení nemovitosti (% ročně)</label>
          <NumField
            value={propertyRate}
            onChange={setPropertyRate}
            min={0} max={15}
            ariaLabel="Zhodnocení nemovitosti (% ročně)"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Výnos SP500 (% ročně)</label>
          <NumField
            value={sp500Rate}
            onChange={setSp500Rate}
            min={0} max={20}
            ariaLabel="Výnos SP500 (% ročně)"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Růst nájmu (% ročně)</label>
          <NumField
            value={rentGrowth}
            onChange={setRentGrowth}
            min={0} max={15}
            ariaLabel="Růst nájmu (% ročně)"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Předpokládané výnosy jsou historické průměry a nezaručují budoucí výsledky.
      </p>
    </div>
  );
}
