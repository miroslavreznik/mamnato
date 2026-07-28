import { useState } from 'react';
import type { WizardState } from '../../types';
import { investmentComparison } from '../../engine/savings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SortedTooltip from '../ui/SortedTooltip';
import NumField from '../ui/NumField';
// Recharts má vlastní Tooltip, proto se ten náš importuje jako HelpTip.
import HelpTip from '../ui/Tooltip';
import { useChartColors, gridProps, axisProps, fmtKcShort } from './chartTheme';
import { czk } from '../../engine/format';

interface Props {
  state: WizardState;
}

// Horizont srovnání. Delší nemá smysl, odhady výnosů jsou už tak hodně hrubé.
const HORIZON = 30;

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
    HORIZON
  );

  // Závěr slovy. Bez něj se uživatel dívá na tři čáry a musí si ho udělat sám,
  // což je přesně to, co na grafu nešlo pochopit.
  const last = data[data.length - 1];
  const buying = last.propertyNetWorth;
  const renting = last.rentInvestNetWorth;
  const gap = Math.abs(buying - renting);
  const closeCall = gap < Math.max(buying, renting) * 0.1;
  const takeaway = closeCall
    ? `koupě i nájem s investováním vycházejí zhruba nastejno (rozdíl ${czk(gap)}). Při takhle malém rozdílu rozhodují spíš jiné věci než čísla: jak dlouho chcete zůstat a jestli chcete mít jistotu vlastního bydlení.`
    : buying > renting
      ? `koupě vychází o ${czk(gap)} líp než nájem s investováním rozdílu.`
      : `nájem s investováním rozdílu vychází o ${czk(gap)} líp než koupě. Platí to ale jen tehdy, když ten rozdíl opravdu investujete.`;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-line p-6">
      <h3 className="text-lg font-semibold text-ink mb-1">Koupě vs. nájem: vývoj čistého jmění</h3>
      <p className="text-sm text-ink-muted mb-4">
        Všechny tři čáry ukazují <span className="text-ink-body">čisté jmění</span>, tedy co byste měli, kdybyste
        všechno prodali a doplatili dluhy. Startují na stejné částce: vlastník ji dá do akontace, nájemník ji investuje.
      </p>

      {/* Bez tohohle vysvětlení nešlo poznat, co která čára znamená. */}
      <ul className="mb-4 space-y-1 text-xs text-ink-muted">
        <li><span className="font-medium text-ink-label">Koupě nemovitosti:</span> hodnota nemovitosti minus zbytek hypotéky. Když vyjde vlastnictví levněji než nájem, rozdíl se investuje.</li>
        <li><span className="font-medium text-ink-label">Nájem a investování rozdílu:</span> nájemník investuje akontaci i to, oč měsíčně platí míň než vlastník.</li>
        <li><span className="font-medium text-ink-label">Nájem bez investování:</span> ušetřený rozdíl se utratí, takže jmění neroste. Nejčastější varianta v praxi.</li>
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
          <label className="block text-xs text-ink-muted mb-1">
            O kolik ročně zdraží nemovitost
            <HelpTip text="O kolik procent ročně poroste cena vaší nemovitosti. Dlouhodobě se ceny bydlení v Česku pohybovaly kolem inflace, tedy zhruba 3 % ročně, ale po delší období se to výrazně lišilo. Zkuste si dosadit i nižší číslo a uvidíte, jak citlivý výsledek je." />
          </label>
          <NumField
            value={propertyRate}
            onChange={setPropertyRate}
            min={0} max={15}
            ariaLabel="O kolik ročně zdraží nemovitost"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">
            Výnos investic
            <HelpTip text="Kolik ročně vynese investovaná částka. Sedm procent je dlouhodobý průměr širokého akciového indexu (například S&P 500) po odečtení inflace. Jednotlivé roky jsou přitom klidně −30 % i +30 %, průměr platí až na desítkách let." />
          </label>
          <NumField
            value={sp500Rate}
            onChange={setSp500Rate}
            min={0} max={20}
            ariaLabel="Výnos investic"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">
            O kolik ročně poroste nájem
            <HelpTip text="Nájem se obvykle zvyšuje o inflaci, tedy zhruba 3 % ročně. Stejným tempem tu rostou i náklady na vlastnictví (fond oprav, pojištění, daň), aby srovnání nenadržovalo jedné straně." />
          </label>
          <NumField
            value={rentGrowth}
            onChange={setRentGrowth}
            min={0} max={15}
            ariaLabel="O kolik ročně poroste nájem"
            step={0.5}
            suffix="%"
            className="w-full px-3 py-2.5 pr-8 border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg text-base"
          />
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-sunken">
        <p className="text-sm text-ink-label">
          <span className="font-semibold">Za {HORIZON} let:</span> {takeaway}
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Rozdíl mezi čarami je citlivý na tři čísla nahoře. Zkuste si je změnit, pořadí se často otočí.
          Výnosy jsou dlouhodobé průměry, ne záruka.
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Do srovnání nevstupuje jistota vlastního bydlení (nájem se dá vypovědět, hypotéka ne),
        jednorázové náklady koupě ani odpočet úroků z daní. Počítá se s tím, že nájemník rozdíl
        opravdu každý měsíc investuje a nesáhne na něj, což se v praxi povede málokomu.
      </p>
    </div>
  );
}
