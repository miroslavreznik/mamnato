import { useState } from 'react';
import { useWizard } from '../../../store/wizardStore';
import { totalMonthlyIncome, totalMonthlyExpenses, necessaryMonthlyExpenses, discretionaryMonthlyExpenses } from '../../../engine/cashflow';
import { DISCRETIONARY_GROUPS, discretionaryGroupTotals, hasDiscretionaryBreakdown, itemKey } from '../../../engine/discretionary';
import NumberInput from '../../ui/NumberInput';
import NumField from '../../ui/NumField';
import Alert from '../../ui/Alert';
import StepNavigation from '../StepNavigation';
import { formatNumber as fmt } from '../../../engine/format';
import { fieldClass } from '../../ui/fieldClass';

const categories: { field: string; label: string; tooltip: string; step: number; familyOnly?: boolean }[] = [
  { field: 'rent', label: 'Nájem (bez energií a poplatků)', tooltip: 'Zadejte čistou výši nájmu, tedy částku, kterou platíte pronajímateli za byt. Energie a zálohy zadejte do pole níže.', step: 1000 },
  { field: 'utilities', label: 'Energie, voda a poplatky za bydlení', tooltip: 'Zálohy na elektřinu, plyn, vodu, internet a případné zálohy do SVJ nebo správci domu.', step: 500 },
  { field: 'existingLoans', label: 'Stávající splátky úvěrů', tooltip: 'Splátky spotřebitelských úvěrů, leasingů, kreditních karet.', step: 500 },
  { field: 'insurance', label: 'Pojistky', tooltip: 'Životní pojištění, havarijní pojištění, cestovní pojištění.', step: 500 },
  { field: 'food', label: 'Jídlo a potraviny', tooltip: 'Nákupy potravin, obědy v práci, restaurace.', step: 500 },
  { field: 'transport', label: 'Doprava', tooltip: 'Pohonné hmoty, MHD, údržba auta, pojistka vozidla.', step: 500 },
  { field: 'children', label: 'Výdaje na děti', tooltip: 'Školka, kroužky, oblečení, kapesné, jídlo pro děti.', step: 500, familyOnly: true },
];

// Kompaktní řádek pro jednu položku rozpisu (název + částka v Kč).
function ItemInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <label className="text-sm text-ink-body">{label}</label>
      <div className="relative shrink-0">
        <NumField
          value={value}
          onChange={onChange}
          ariaLabel={label}
          className={fieldClass('w-24 text-right pr-7 pl-2 py-1 text-sm')}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint text-xs pointer-events-none">Kč</span>
      </div>
    </div>
  );
}

export default function Step3Expenses() {
  const { state, dispatch } = useWizard();
  const isFamily = state.mode === 'family';
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);
  const necessary = necessaryMonthlyExpenses(state);
  const discretionary = discretionaryMonthlyExpenses(state);
  const ratio = income > 0 ? expenses / income : 0;

  const breakdown = state.expenses.discretionaryBreakdown;
  const [showBreakdown, setShowBreakdown] = useState(hasDiscretionaryBreakdown(breakdown));
  const groups = discretionaryGroupTotals(breakdown);

  const visibleCategories = categories.filter((c) => !c.familyOnly || isFamily);


  return (
    <div>
      <h2 className="text-xl font-semibold text-ink mb-2">Vaše výdaje</h2>
      <p className="text-ink-muted mb-6">Zadejte měsíční výdaje po kategoriích. Hodnoty jsou předvyplněny průměrem ČR.</p>

      <h3 className="text-sm font-semibold text-ink-label mb-3">Nezbytné výdaje</h3>
      {visibleCategories.map((cat) => (
        <NumberInput
          key={cat.field}
          label={cat.label}
          value={state.expenses[cat.field as keyof typeof state.expenses] as number}
          onChange={(v) => dispatch({ type: 'UPDATE_EXPENSES', field: cat.field, value: v })}
          tooltip={cat.tooltip}
          step={cat.step}
        />
      ))}

      {/* Zbytné výdaje, buď jedním polem, nebo podrobným rozpisem do skupin */}
      <h3 className="text-sm font-semibold text-ink-label mb-3 mt-6 pt-6 border-t border-line">Zbytné výdaje</h3>
      <NumberInput
        label="Zbytné výdaje (zábava, dovolená, koníčky, předplatné)"
        value={state.expenses.other}
        onChange={(v) => dispatch({ type: 'UPDATE_EXPENSES', field: 'other', value: v })}
        tooltip="Výdaje, které lze při výpadku příjmů omezit: zábava, sport, dovolená, restaurace nad rámec běžné stravy, předplatné služeb. Slouží k výpočtu doporučené rezervy a odolnosti rozpočtu."
        step={500}
        disabled={showBreakdown}
      />

      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            if (showBreakdown) dispatch({ type: 'CLEAR_DISCRETIONARY_BREAKDOWN' });
            setShowBreakdown((v) => !v);
          }}
          className="text-sm text-brand hover:underline"
        >
          {showBreakdown ? '− Skrýt podrobný rozpis' : '+ Rozepsat zbytné výdaje (volitelné)'}
        </button>
      </div>

      {showBreakdown && (
        <div className="mt-3 p-4 bg-sunken rounded-xl space-y-4">
          <p className="text-xs text-ink-muted">
            Rozepsáním po skupinách si líp uvědomíte, za co vlastně platíte. Zbytné výdaje se dopočítají jako součet.
          </p>

          {DISCRETIONARY_GROUPS.map((g) => {
            const groupTotal = groups.find((x) => x.key === g.key)!;
            return (
              <div key={g.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-ink-label">
                    <span className="mr-1.5">{g.icon}</span>{g.label}
                  </span>
                  <span className="text-xs text-ink-muted">{fmt(groupTotal.amount)} Kč</span>
                </div>
                <div className="pl-1 divide-y divide-line">
                  {g.items.map((it) => {
                    const key = itemKey(g.key, it.key);
                    return (
                      <ItemInput
                        key={key}
                        label={it.label}
                        value={breakdown?.[key] ?? 0}
                        onChange={(v) => dispatch({ type: 'UPDATE_DISCRETIONARY_ITEM', key, value: v })}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-between pt-2 border-t text-sm">
            <span className="text-ink-body font-medium">Zbytné výdaje celkem</span>
            <span className="font-semibold text-ink">{fmt(state.expenses.other)} Kč/měs.</span>
          </div>
        </div>
      )}

      {/* Zbývající dluhy, zůstatek (ne měsíční výdaj), pro výpočet DTI */}
      <div className="mt-6 pt-6 border-t border-line">
        <h3 className="text-sm font-semibold text-ink-label mb-1">Zbývající dluhy (nepovinné)</h3>
        <p className="text-xs text-ink-muted mb-3">
          Tohle není měsíční splátka, ale celkový <span className="font-medium">zůstatek</span> k doplacení. Slouží k výpočtu ukazatele DTI (poměr dluhu k příjmu).
        </p>
        <NumberInput
          label="Kolik ještě zbývá doplatit na úvěrech"
          value={state.existingDebtPrincipal ?? 0}
          onChange={(v) => dispatch({ type: 'UPDATE_DEBT_PRINCIPAL', value: v })}
          tooltip="Zbývající jistina u stávajících úvěrů (spotřebitelské úvěry, leasingy). Zadejte celkový zůstatek dluhu, ne splátku. Nová hypotéka se přičítá zvlášť."
          step={50000}
        />
      </div>

      <div className="mt-4 p-3 bg-sunken rounded-lg text-sm text-ink-body space-y-1">
        <div className="flex justify-between">
          <span>Celkem výdaje:</span>
          <span className="font-semibold text-ink">{fmt(expenses)} Kč/měs.</span>
        </div>
        <div className="flex justify-between text-xs text-ink-muted">
          <span>z toho nezbytné</span>
          <span>{fmt(necessary)} Kč</span>
        </div>
        <div className="flex justify-between text-xs text-ink-muted">
          <span>z toho zbytné</span>
          <span>{fmt(discretionary)} Kč</span>
        </div>
      </div>

      {ratio > 1 && (
        <div className="mt-3">
          <Alert type="error">Vaše výdaje převyšují příjmy. Doporučujeme nejdříve zkontrolovat rozpočet.</Alert>
        </div>
      )}

      {ratio > 0.9 && ratio <= 1 && (
        <div className="mt-3">
          <Alert type="warning">Vaše výdaje tvoří více než 90 % příjmů. Zbývá velmi málo na spoření.</Alert>
        </div>
      )}

      <StepNavigation
        showBack={true}
        onBack={() => dispatch({ type: 'PREV_STEP' })}
        onNext={() => dispatch({ type: 'NEXT_STEP' })}
      />
    </div>
  );
}
