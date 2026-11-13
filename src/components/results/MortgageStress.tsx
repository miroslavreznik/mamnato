import { useState } from 'react';
import type { WizardState } from '../../types';
import type { Journey } from '../../engine/journey';
import { mortgageStress, type MortgageStressResult } from '../../engine/mortgageStress';
import { fixationYears } from '../../engine/mortgage';
import { czk, czkMonthly, formatMonths, formatYears } from '../../engine/format';
import NumField from '../ui/NumField';
import { fieldClass } from '../ui/fieldClass';
import Card from '../ui/Card';

function StressResult({ title, result }: { title: string; result: MortgageStressResult }) {
  return (
    <li className="rounded-xl border border-line px-3 py-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className={result.monthlySurplus < 0 ? 'text-sm text-danger' : 'text-sm text-good'}>
        {result.monthlySurplus < 0 ? 'Měsíční schodek až' : 'Měsíčně zbývá nejméně'}{' '}
        <strong>{czk(Math.abs(result.monthlySurplus))}</strong>
      </p>
      <p className="text-sm text-ink-muted">
        Nejnižší hotovost za {formatMonths(result.months)}{' '}
        <strong className={result.lowestCash < 0 ? 'text-danger' : 'text-ink'}>{czk(result.lowestCash)}</strong>
      </p>
    </li>
  );
}

export default function MortgageStress({ state, plan }: { state: WizardState; plan: Journey }) {
  const income1 = state.income.person1NetMonthly;
  const income2 = state.income.person2NetMonthly ?? 0;
  const [person, setPerson] = useState(income2 > 0 ? 2 : 1);
  const [lossOverride, setLoss] = useState<number>();
  const [months, setMonths] = useState(6);
  const activePerson = income2 > 0 ? person : 1;
  const salary = activePerson === 2 ? income2 : income1;
  const loss = Math.min(salary, lossOverride ?? Math.round(salary / 2));
  const result = plan.purchaseMonth == null || plan.purchaseCashAfterClosing == null
    ? null
    : mortgageStress(
        state, { month: plan.purchaseMonth, cash: plan.purchaseCashAfterClosing },
        plan.points, loss, months,
      );

  return (
    <Card title="Co když klesne příjem nebo stoupne sazba?">
      {result == null ? (
        <p className="text-sm text-ink-body">
          Zkoušku rozpočtu zobrazíme, až v tomto scénáři vyjde termín koupě.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-body">
            Porovnejte pokles čistého příjmu od koupě a zvýšení sazby po {formatYears(fixationYears(state))} fixace.
          </p>
          <div className="no-print mt-4 grid gap-3 sm:grid-cols-3">
            {income2 > 0 && (
              <label className="text-sm font-medium text-ink-label">
                Komu klesne příjem
                <select
                  className={fieldClass('mt-1 w-full px-3 py-2')}
                  value={activePerson}
                  onChange={(e) => { setPerson(Number(e.target.value)); setLoss(undefined); }}
                >
                  <option value={1}>Osobě 1</option>
                  <option value={2}>Osobě 2</option>
                </select>
              </label>
            )}
            <label className="text-sm font-medium text-ink-label">
              Pokles příjmu za měsíc
              <NumField
                ariaLabel="Pokles příjmu za měsíc"
                className={fieldClass('mt-1 w-full px-3 py-2 pr-9')}
                suffix="Kč"
                value={loss}
                onChange={setLoss}
                max={salary}
              />
            </label>
            <label className="text-sm font-medium text-ink-label">
              Počet měsíců s nižším příjmem
              <NumField
                ariaLabel="Počet měsíců s nižším příjmem"
                className={fieldClass('mt-1 w-full px-3 py-2')}
                value={months}
                onChange={(v) => setMonths(Math.round(v))}
                min={1}
                max={60}
              />
            </label>
          </div>
          {result.refixedPayment != null && (
            <p className="mt-3 text-sm text-ink-body">
              Sazba vyšší o 2 procentní body znamená splátku <strong>{czkMonthly(result.refixedPayment)}</strong> od konce fixace.
            </p>
          )}
          <p className="mt-2 text-sm text-ink-muted">
            Počítáme s poklesem o {czkMonthly(loss)} po dobu {formatMonths(months)}.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3" aria-live="polite">
            {result.income && <StressResult title="Nižší příjem po koupi" result={result.income} />}
            {result.refix && <StressResult title="První rok s vyšší sazbou" result={result.refix} />}
            {result.combined && <StressResult title="Vyšší sazba a nižší příjem najednou" result={result.combined} />}
          </ul>
          {result.refixedPayment != null && !result.refix && (
            <p className="mt-2 text-sm text-ink-muted">Konec fixace je za horizontem časové osy.</p>
          )}
        </>
      )}
    </Card>
  );
}
