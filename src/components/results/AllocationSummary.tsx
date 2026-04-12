import type { GoalAllocations } from '../../engine/allocation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  disposable: number;
  allocations: GoalAllocations;
  activeGoals: string[];
  onChangeAllocation: (goal: string, index: number | null, value: number) => void;
}

export default function AllocationSummary({ disposable, allocations, activeGoals, onChangeAllocation }: Props) {
  const items: Array<{ key: string; label: string; amount: number; color: string; goalKey: string; index: number | null }> = [];

  if (activeGoals.includes('property')) {
    items.push({ key: 'mortgage', label: 'Hypotéka', amount: allocations.mortgage, color: '#3b82f6', goalKey: 'mortgage', index: null });
  }
  if (activeGoals.includes('retirement')) {
    items.push({ key: 'retirement', label: 'Spoření na důchod', amount: allocations.retirement, color: '#10b981', goalKey: 'retirement', index: null });
  }
  if (activeGoals.includes('child')) {
    items.push({ key: 'child', label: 'Dítě (rezerva)', amount: allocations.child, color: '#f59e0b', goalKey: 'child', index: null });
  }
  if (activeGoals.includes('other')) {
    allocations.custom.forEach((amount, i) => {
      items.push({ key: `custom_${i}`, label: `Vlastní cíl ${i + 1}`, amount, color: '#8b5cf6', goalKey: 'custom', index: i });
    });
  }

  const totalAllocated = items.reduce((sum, i) => sum + i.amount, 0);
  const reserve = disposable - totalAllocated;
  const isDeficit = reserve < 0;

  // Pie chart data
  const pieData = [
    ...items.map((i) => ({ name: i.label, value: Math.max(0, i.amount), color: i.color })),
    ...(reserve > 0 ? [{ name: 'Rezerva', value: reserve, color: '#d1d5db' }] : []),
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rozložení disponibilní částky</h3>

      {isDeficit && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Vaše cíle vyžadují {totalAllocated.toLocaleString('cs-CZ')} Kč/měs, ale vaše disponibilní částka je pouze {disposable.toLocaleString('cs-CZ')} Kč/měs.
            Chybí vám {Math.abs(reserve).toLocaleString('cs-CZ')} Kč/měs.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Zkuste snížit částku pro některý cíl, prodloužit horizont, nebo zvýšit příjem.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Table */}
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400">Cíl</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">Kč/měs</th>
                  <th className="text-right py-2 text-gray-500 dark:text-gray-400">%</th>
                  <th className="text-center py-2 text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const pct = disposable > 0 ? (item.amount / disposable * 100).toFixed(0) : '0';
                  return (
                    <tr key={item.key} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2 text-gray-900 dark:text-white">
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </td>
                      <td className="text-right py-2">
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => onChangeAllocation(item.goalKey, item.index, Math.max(0, Number(e.target.value)))}
                          className="w-20 text-right px-1 py-0.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-sm"
                          step={1000}
                        />
                      </td>
                      <td className="text-right py-2 text-gray-600 dark:text-gray-300">{pct} %</td>
                      <td className="text-center py-2">
                        {item.amount > 0 ? <span className="text-green-500">✅</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                  <td className="py-2 text-gray-600 dark:text-gray-400">Disponibilní</td>
                  <td className="text-right py-2 font-semibold text-gray-900 dark:text-white">{disposable.toLocaleString('cs-CZ')}</td>
                  <td className="text-right py-2 text-gray-600 dark:text-gray-300">100 %</td>
                  <td />
                </tr>
                <tr>
                  <td className="py-2 text-gray-600 dark:text-gray-400">Alokováno</td>
                  <td className="text-right py-2 font-semibold text-gray-900 dark:text-white">−{totalAllocated.toLocaleString('cs-CZ')}</td>
                  <td className="text-right py-2 text-gray-600 dark:text-gray-300">
                    {disposable > 0 ? (totalAllocated / disposable * 100).toFixed(0) : '0'} %
                  </td>
                  <td />
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td className="py-2 font-semibold text-gray-900 dark:text-white">Zbývající rezerva</td>
                  <td className={`text-right py-2 font-bold ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                    {reserve.toLocaleString('cs-CZ')}
                  </td>
                  <td className={`text-right py-2 font-semibold ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                    {disposable > 0 ? `${(reserve / disposable * 100).toFixed(0)} %` : '0 %'}
                  </td>
                  <td className="text-center py-2">
                    {isDeficit ? <span className="text-red-500">🔴</span> : <span className="text-green-500">✅</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString('cs-CZ')} Kč/měs`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
