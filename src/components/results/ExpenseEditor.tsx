import type { WizardState } from '../../types';
import { NECESSARY_EXPENSE_FIELDS, DISCRETIONARY_EXPENSE_FIELD } from '../../engine/expenseFields';
import { DISCRETIONARY_GROUPS, discretionaryGroupTotals, hasDiscretionaryBreakdown, itemKey } from '../../engine/discretionary';
import {
  totalMonthlyIncome, totalMonthlyExpenses, monthlyDisposable, savingsRate,
} from '../../engine/cashflow';
import { czk, czkPerMonth, percentCompact } from '../../engine/format';
import NumField from '../ui/NumField';
import Tooltip from '../ui/Tooltip';
import Card from '../ui/Card';
import Callout from '../ui/Callout';
import { fieldClass } from '../ui/fieldClass';

/**
 * Výdaje k přepsání přímo ve výsledcích.
 *
 * Průvodce je nasbírá jednou a pak už se k nim uživatel dostal jen tlačítkem
 * „Upravit", které ho vyhodí zpátky na krok 3 a připraví o kontext. Přitom
 * „kolik by se změnilo, kdybych utrácel o dva tisíce míň za jídlo" je přesně
 * otázka, kterou si člověk klade nad výsledky, ne nad formulářem.
 *
 * Zapisuje se do **zadaného** stavu, ne do toho po „co kdyby": jsou to
 * skutečné údaje, ne úvaha nad grafem. Proto se taky ukládají a přepočítá se
 * z nich celý přehled včetně odpovědi nahoře.
 *
 * Zbytné výdaje jsou jedním polem, dokud si je uživatel nerozepsal
 * v průvodci. Když má rozpis, je pole součtem a upravují se položky, jinak
 * by se dvě čísla o téže věci přetlačovala.
 */

function Row({ label, tooltip, value, step, onChange }: {
  label: string;
  tooltip?: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-body min-w-0">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      {/* Jednotka jde přes `suffix`, ne přes vlastní absolutní popisek:
          ten by se u pole s krokováním potkal s tlačítkem „+" a slil se
          s ním v „+Kč". */}
      <div className="shrink-0">
        <NumField
          value={value}
          onChange={onChange}
          ariaLabel={label}
          step={step}
          suffix="Kč"
          className={fieldClass('w-28 text-right pr-9 pl-2 py-2 text-base')}
        />
      </div>
    </div>
  );
}

interface Props {
  /** Zadaný stav, ne ten po „co kdyby". */
  state: WizardState;
  onChange: (field: string, value: number) => void;
  onChangeDiscretionaryItem: (key: string, value: number) => void;
}

export default function ExpenseEditor({ state, onChange, onChangeDiscretionaryItem }: Props) {
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);
  const disposable = monthlyDisposable(state);
  const rate = savingsRate(state);

  const breakdown = state.expenses.discretionaryBreakdown;
  const detailed = hasDiscretionaryBreakdown(breakdown);
  const groups = discretionaryGroupTotals(breakdown);

  const fields = NECESSARY_EXPENSE_FIELDS.filter((c) => !c.familyOnly || state.mode === 'family');

  return (
    <Card
      title="Vaše výdaje"
      subtitle="Přepište, co sedí jinak. Přehled se přepočítá hned, včetně odpovědi nahoře, a změna se uloží."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
        <div className="divide-y divide-line">
          <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Nezbytné</p>
          {fields.map((c) => (
            <Row
              key={c.field}
              label={c.short}
              tooltip={c.tooltip}
              value={state.expenses[c.field as keyof typeof state.expenses] as number}
              step={c.step}
              onChange={(v) => onChange(c.field, v)}
            />
          ))}
        </div>

        <div className="mt-6 md:mt-0">
          <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Zbytné</p>
          {detailed ? (
            <div className="space-y-3">
              {DISCRETIONARY_GROUPS.map((g) => (
                <div key={g.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-label">{g.label}</span>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {czk(groups.find((x) => x.key === g.key)!.amount)}
                    </span>
                  </div>
                  <div className="divide-y divide-line">
                    {g.items.map((it) => {
                      const key = itemKey(g.key, it.key);
                      return (
                        <Row
                          key={key}
                          label={it.label}
                          value={breakdown?.[key] ?? 0}
                          step={200}
                          onChange={(v) => onChangeDiscretionaryItem(key, v)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-muted">
                Zbytné výdaje jsou součtem rozpisu, proto se nezadávají jedním číslem.
                Rozpis se dá zrušit v průvodci.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              <Row
                label={DISCRETIONARY_EXPENSE_FIELD.short}
                tooltip={DISCRETIONARY_EXPENSE_FIELD.tooltip}
                value={state.expenses.other}
                step={DISCRETIONARY_EXPENSE_FIELD.step}
                onChange={(v) => onChange('other', v)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Součet hned pod poli: bez něj se musí uživatel po každé úpravě
          vracet nahoru, aby zjistil, jestli si pomohl. */}
      <div className="mt-5 pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-ink-muted">Příjmy</p>
          <p className="type-section text-ink">{czkPerMonth(income)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Výdaje</p>
          <p className="type-section text-ink">{czkPerMonth(expenses)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Zbývá</p>
          <p className={`type-section ${disposable >= 0 ? 'text-good' : 'text-danger'}`}>
            {disposable >= 0 ? '+' : ''}{czkPerMonth(disposable)}
          </p>
          <p className="text-xs text-ink-muted">míra úspor {percentCompact(Math.max(0, rate))}</p>
        </div>
      </div>

      {disposable < 0 && (
        <Callout tone="danger" className="mt-3">
          Výdaje převyšují příjmy o {czkPerMonth(Math.abs(disposable))}. Dokud to platí,
          nemá smysl počítat cíle: první je potřeba srovnat rozpočet.
        </Callout>
      )}
    </Card>
  );
}
