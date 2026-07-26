import type { BudgetView } from '../../engine/summary';
import { czkPerMonth } from '../../engine/format';
import Tooltip from '../ui/Tooltip';

/**
 * Rozpočtová věta: kolik měsíčně zbývá a kolik z toho ukusují cíle.
 *
 * Když je mezi cíli nemovitost, jsou období dvě. Koupě rozpočet přepne:
 * nájem vystřídá splátka s náklady na vlastnictví a odkládání na akontaci
 * skončí, protože je zaplacená. Jedno číslo tyhle dvě situace popsat neumí
 * a uživatel pak nevidí, co s ním koupě udělá.
 */
export default function BudgetSummary({ now, after }: {
  now: BudgetView;
  after: BudgetView | null;
}) {
  if (!after) return <Line budget={now} />;

  return (
    <div className="mb-5 space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
        Měsíční rozpočet
        <Tooltip text="Co vám zbyde po výdajích a kolik z toho spolknou cíle. Koupě rozpočet mění: skončí nájem i odkládání na akontaci a začne splátka s náklady na vlastnictví, proto jsou období dvě." />
      </h4>
      <Line budget={now} period="Dnes" />
      <Line budget={after} period="Po koupi" afterPurchase />
    </div>
  );
}

function Line({ budget, period, afterPurchase }: {
  budget: BudgetView;
  period?: string;
  afterPurchase?: boolean;
}) {
  const box = budget.fits
    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';

  return (
    <div className={`p-3 rounded-lg text-sm ${box} ${period ? '' : 'mb-5'}`}>
      {period && <span className="block text-xs font-semibold uppercase tracking-wide opacity-70 mb-0.5">{period}</span>}
      {budget.fits ? (
        <>
          Zbývá vám <strong>{czkPerMonth(budget.disposable)}</strong>
          {afterPurchase ? ' po splátce a nákladech na bydlení' : ' po všech výdajích'}, cíle z toho
          vyžadují <strong>{czkPerMonth(budget.allocated)}</strong> a volných zůstává{' '}
          <strong>{czkPerMonth(budget.surplus)}</strong>.
          {afterPurchase && ' Na akontaci už se neodkládá, je zaplacená.'}
        </>
      ) : (
        <>
          {afterPurchase
            ? <>Po splátce a nákladech na bydlení by vám zbylo <strong>{czkPerMonth(budget.disposable)}</strong></>
            : <>Po všech výdajích vám zbývá <strong>{czkPerMonth(budget.disposable)}</strong></>}
          , ale cíle vyžadují <strong>{czkPerMonth(budget.allocated)}</strong>. Chybí{' '}
          <strong>{czkPerMonth(Math.abs(budget.surplus))}</strong>.
          {afterPurchase
            ? ' Pomohla by levnější nemovitost, vyšší akontace nebo delší splatnost.'
            : ' Upravte částky u cílů níže.'}
        </>
      )}
    </div>
  );
}
