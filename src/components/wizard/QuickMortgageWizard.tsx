import { useEffect, useRef } from 'react';
import { monthlyDisposable, totalMonthlyIncome } from '../../engine/cashflow';
import { czk, czkMonthly, formatYears, percentCompact } from '../../engine/format';
import { fixationYears, liquidSavings, loanTermYears, mortgageRate } from '../../engine/mortgage';
import { maxAffordableProperty } from '../../engine/purchasePlan';
import { wizardReducer } from '../../store/wizardStore';
import type { MortgageFlow, UserMode, WizardState } from '../../types';
import Disclosure from '../ui/Disclosure';
import NumberInput from '../ui/NumberInput';
import PurchaseFields, { MortgageTermsFields, MonthlySurplusField, type PurchaseSetting } from './PurchaseFields';
import StepIndicator from './StepIndicator';
import RenovationSection from './steps/RenovationSection';

const steps = [
  { step: 1, label: 'Příjmy a úspory' },
  { step: 2, label: 'Výdaje' },
  { step: 3, label: 'Bydlení' },
];

const householdChoices: { value: UserMode; label: string }[] = [
  { value: 'individual', label: 'Sám / sama' },
  { value: 'couple', label: 'Ve dvou' },
  { value: 'family', label: 'Rodina s dětmi' },
];

const expenseFields = [
  ['essentials', 'Běžné nezbytné výdaje bez bydlení a splátek', 'Jídlo, doprava, pojištění, výdaje na děti a další pravidelné výdaje.'],
  ['rent', 'Nájem, který po stěhování přestanete platit', 'Pouze nájemné. Zálohy a služby patří do dalšího pole.'],
  ['utilities', 'Dnešní energie a služby', 'Měsíční zálohy na elektřinu, vodu, teplo a služby. Pokud znáte zálohy v novém bytě, můžete je zadat v dalším kroku.'],
  ['existingLoans', 'Měsíční splátky ostatních úvěrů', 'Splátky půjček nebo leasingu, které budete platit i po koupi.'],
  ['other', 'Volitelné výdaje za měsíc', 'Například zábava, koníčky a dovolená. Zapíšou se do běžného rozpočtu a při výpočtu nouzové rezervy je lze omezit.'],
] as const;

interface Props {
  flow: MortgageFlow;
  initialState: WizardState;
  onStateChange: (state: WizardState) => void;
  onComplete: (state: WizardState) => void;
  onBackToResults?: () => void;
}

export default function QuickMortgageWizard({ flow, initialState: state, onStateChange, onComplete, onBackToResults }: Props) {
  const step = Math.min(3, Math.max(1, state.currentStep));
  const heading = useRef<HTMLHeadingElement>(null);
  const income = totalMonthlyIncome(state);
  const valid = income > 0 && (flow === 'price' || state.property.targetPrice > 0);
  const title = step === 1 ? 'Příjmy a úspory domácnosti' : step === 2 ? 'Kolik dnes měsíčně utratíte?' : flow === 'price' ? 'S jakou rezervou chcete kupovat?' : 'Jaký byt chcete koupit?';

  useEffect(() => { heading.current?.focus(); }, [step]);

  const goToStep = (target: number) => onStateChange({ ...state, currentStep: target });
  const setProperty = (field: keyof WizardState['property'], value: number | undefined) => onStateChange(wizardReducer(state, { type: 'UPDATE_PROPERTY', field, value }));
  const setIncome = (field: keyof WizardState['income'], value: number) => {
    onStateChange({ ...state, income: { ...state.income, [field]: Math.min(10000000, Math.max(0, value)) } });
  };
  const setSavings = (value: number) => {
    const breakdown = state.savings.breakdown;
    if (!breakdown) {
      onStateChange(wizardReducer(state, { type: 'UPDATE_SAVINGS', field: 'totalSavings', value }));
      return;
    }
    const current = Math.min(breakdown.current, value);
    const savingsAccount = value - current;
    onStateChange(wizardReducer(wizardReducer(state, { type: 'UPDATE_SAVINGS_BREAKDOWN', field: 'current', value: current }), { type: 'UPDATE_SAVINGS_BREAKDOWN', field: 'savingsAccount', value: savingsAccount }));
  };
  const setPurchaseSetting = (field: PurchaseSetting, value: number | undefined) => {
    if (field === 'reserveMonths') onStateChange({ ...state, reserveMonths: value });
    else setProperty(field, value);
  };
  const finish = () => {
    if (!valid) return;
    const completed = { ...state, currentStep: 4, completedSteps: [1, 2, 3] };
    if (flow === 'price') {
      const affordable = maxAffordableProperty(state);
      completed.property = { ...state.property, targetPrice: affordable.price };
      completed.savings = { ...state.savings, downPaymentFromSavings: affordable.downPayment };
    }
    onComplete(completed);
  };
  const submit = () => {
    if (step === 3) finish();
    else if (step !== 1 || income > 0) {
      const completedSteps = state.completedSteps.includes(step) ? state.completedSteps : [...state.completedSteps, step];
      onStateChange({ ...state, completedSteps, currentStep: step + 1 });
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
      {onBackToResults && valid && (
        <button type="button" onClick={finish} className="mb-2 inline-flex min-h-[44px] items-center font-semibold text-brand hover:underline focus-visible:ring-2 focus-visible:ring-ink">
          Zpět na přehled
        </button>
      )}
      <StepIndicator currentStep={step} steps={steps} completedSteps={state.completedSteps} onStepClick={goToStep} />
      <h1 ref={heading} tabIndex={-1} className="type-section mb-2 text-ink focus:outline-none">{title}</h1>

      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        {step === 1 && (
          <div className="mt-5">
            <fieldset className="mb-5">
              <legend className="mb-2 text-sm font-medium text-ink-label">S kým kupujete?</legend>
              <div className="flex flex-wrap gap-2">
                {householdChoices.map(({ value, label }) => (
                  <label key={value} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-body has-[:checked]:border-brand has-[:checked]:bg-tint-brand">
                    <input type="radio" name="mortgage-household" value={value} checked={state.mode === value} onChange={() => onStateChange({
                      ...state,
                      mode: value,
                      income: { ...state.income, person2NetMonthly: value === 'individual' ? undefined : state.income.person2NetMonthly ?? 0 },
                      person2Age: value === 'individual' ? undefined : state.person2Age,
                    })} className="accent-brand" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-x-5 sm:grid-cols-2">
              <NumberInput label="Váš čistý příjem za měsíc" value={state.income.person1NetMonthly} onChange={(value) => setIncome('person1NetMonthly', value)} showSpinner={false} />
              {state.mode !== 'individual' && <NumberInput label="Čistý příjem druhé osoby za měsíc" value={state.income.person2NetMonthly ?? 0} onChange={(value) => setIncome('person2NetMonthly', value)} showSpinner={false} />}
              <NumberInput
                label="Dostupné úspory na koupi a rezervu"
                value={liquidSavings(state)}
                onChange={setSavings}
                commitOnBlur
                tooltip="Peníze na účtech nebo v hotovosti, které můžete použít. Vynechte investice, které si chcete ponechat."
                showSpinner={false}
              />
            </div>
            <Disclosure summary="Přidat věk žadatelů">
              <p className="mb-3 text-sm text-ink-muted">Věk může ovlivnit potřebnou výši úspor. Rozhoduje věk při poskytnutí úvěru. U společné žádosti ověřte podmínky u banky, pokud je jen jednomu z vás méně než 36 let.</p>
              <div className="grid gap-x-5 sm:grid-cols-2">
                <NumberInput label="Váš věk" value={state.person1Age ?? 0} onChange={(value) => onStateChange({ ...state, person1Age: Math.min(100, Math.round(value)) })} suffix="let" showSpinner={false} />
                {state.mode !== 'individual' && <NumberInput label="Věk druhé osoby" value={state.person2Age ?? 0} onChange={(value) => onStateChange({ ...state, person2Age: Math.min(100, Math.round(value)) })} suffix="let" showSpinner={false} />}
              </div>
            </Disclosure>
            <Disclosure summary="Započítat další příjmy nebo rodičovský příspěvek">
              <div className="grid gap-x-5 sm:grid-cols-2">
                <NumberInput label="Další pravidelné příjmy za měsíc" value={state.income.otherNetMonthly ?? 0} onChange={(value) => setIncome('otherNetMonthly', value)} showSpinner={false} />
                <NumberInput label="Rodičovský příspěvek, který už pobíráte" value={state.income.parentalAllowance ?? 0} onChange={(value) => onStateChange({
                  ...state,
                  income: {
                    ...state.income,
                    parentalAllowance: Math.min(10000000, Math.max(0, value)),
                    parentalAllowanceRemainingMonths: state.income.parentalAllowanceRemainingMonths ?? 12,
                  },
                })} showSpinner={false} />
                {!!state.income.parentalAllowance && (
                  <div>
                    <NumberInput label="Za kolik měsíců rodičovský příspěvek skončí" value={state.income.parentalAllowanceRemainingMonths ?? 12} onChange={(value) => setIncome('parentalAllowanceRemainingMonths', Math.min(1200, Math.round(value)))} suffix="měsíců" showSpinner={false} />
                    <p className="-mt-3 mb-4 text-xs text-ink-muted">Výchozí odhad je 12 měsíců. Upravte ho podle zbývající doby čerpání.</p>
                  </div>
                )}
              </div>
            </Disclosure>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-5 text-sm leading-relaxed text-ink-muted">Zadejte částky za celou domácnost. U ročních výdajů použijte měsíční průměr. Položky, které neplatíte, nechte na nule.</p>
            <div className="grid gap-x-5 sm:grid-cols-2">
              {expenseFields.map(([field, label, tooltip]) => <NumberInput
                key={field}
                label={label}
                value={state.expenses[field] ?? 0}
                onChange={(value) => onStateChange(wizardReducer(state, { type: 'UPDATE_EXPENSES', field, value: Math.min(999000000, Math.max(0, value)) }))}
                tooltip={tooltip}
                showSpinner={false}
              />)}
            </div>
            <p className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink-body">Z dnešního rozpočtu zbývá <strong className="text-ink">{czkMonthly(monthlyDisposable(state))}</strong>.</p>
          </div>
        )}

        {step === 3 && (
          <div className="mt-5">
            {flow === 'property' ? (
              <NumberInput label="Kupní cena bytu" value={state.property.targetPrice} onChange={(value) => setProperty('targetPrice', Math.min(999000000, Math.max(0, value)))} showSpinner={false} />
            ) : (
              <MonthlySurplusField state={state} onChange={setPurchaseSetting} />
            )}
            <p className="rounded-lg bg-sunken px-4 py-3 text-sm leading-relaxed text-ink-body">
              Počítáme se splatností {formatYears(loanTermYears(state))}, fixací na {formatYears(fixationYears(state))} a sazbou {percentCompact(mortgageRate(state))} ročně{state.property.mortgageRate === undefined ? ' (odhad)' : ''}.
            </p>
            <Disclosure className="mt-2" summary="Upravit hypotéku, náklady a rezervu">
              <MortgageTermsFields state={state} onChange={setProperty} />
              <PurchaseFields state={state} onChange={setPurchaseSetting} showSurplus={flow !== 'price'} />
              {flow === 'property' && <RenovationSection state={state} onChange={(value) => onStateChange(wizardReducer(state, { type: 'SET_RENOVATION', value }))} />}
            </Disclosure>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
          {step > 1 ? (
            <button type="button" onClick={() => goToStep(step - 1)} className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-ink-body hover:bg-sunken focus-visible:ring-2 focus-visible:ring-ink">Zpět</button>
          ) : <span />}
          <button
            type="submit"
            disabled={(step === 1 && income <= 0) || (step === 3 && !valid)}
            className="min-h-[44px] rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-page hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
          >
            {step < 3 ? 'Další' : flow === 'price' ? 'Spočítat cenový strop' : 'Prověřit byt'}
          </button>
        </div>
      </form>
      {step === 1 && income > 0 && <p className="mt-3 text-right text-xs text-ink-muted">Čistý příjem domácnosti {czk(income)} měsíčně.</p>}
    </div>
  );
}
