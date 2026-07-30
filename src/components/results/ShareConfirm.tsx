import type { WizardState } from '../../types';
import { GOAL_LABELS, customGoalName } from '../../engine/goalNames';
import Callout from '../ui/Callout';

/**
 * Co bude v odkazu, než se zkopíruje.
 *
 * Sdílení je jediná akce v celé appce, která pošle data ven z prohlížeče,
 * a dělalo se jedním kliknutím bez varování. Kdo odkaz pošle, pošle s ním
 * svůj příjem, výdaje i úspory; to se nedá vzít zpět, protože adresa může
 * zůstat v historii, v chatu nebo v mailu příjemce.
 *
 * Proto se nejdřív vypíše, co odkaz obsahuje, a teprve pak se kopíruje.
 * Není to varování před nebezpečím: nikam se nic neposílá a odkaz nikdo
 * jiný nevidí, dokud ho uživatel sám nepošle. Je to informace, kterou
 * potřebuje mít **před** kliknutím, ne po něm.
 */
export default function ShareConfirm({ state, onCopy, onCancel }: {
  state: WizardState;
  onCopy: () => void;
  onCancel: () => void;
}) {
  const goals = [
    ...(state.goals.includes('property') ? [GOAL_LABELS.property] : []),
    ...(state.goals.includes('child') ? [GOAL_LABELS.child] : []),
    ...(state.goals.includes('retirement') ? [GOAL_LABELS.retirement] : []),
    ...(state.goals.includes('other')
      ? (state.customGoals ?? []).map((_, i) => customGoalName(state, i))
      : []),
  ];

  const items = [
    'čisté příjmy domácnosti',
    'měsíční výdaje po kategoriích',
    'kolik máte naspořeno',
    ...(goals.length > 0 ? [`vaše cíle: ${goals.join(', ').toLowerCase()}`] : []),
    ...(state.goals.includes('property') ? ['cenu nemovitosti, akontaci a parametry hypotéky'] : []),
    ...(state.parentalLeave?.enabled ? ['nastavení rodičovské'] : []),
  ];

  return (
    <Callout tone="neutral" border pad="p-4 rounded-xl" className="no-print mb-5">
      <p className="text-sm font-semibold text-ink">Odkaz ponese vaše údaje</p>
      <p className="mt-1 text-sm text-ink-body">
        Kdo odkaz otevře, uvidí:
      </p>
      <ul className="mt-2 space-y-0.5 text-sm text-ink-body list-disc pl-5">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <p className="mt-2 text-sm text-ink-muted">
        Data jsou zakódovaná přímo v adrese, na server se nic neposílá. Zároveň to
        znamená, že odkaz nejde zneplatnit: komu ho jednou pošlete, tomu zůstane.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg bg-ink text-page hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ink"
        >
          Zkopírovat odkaz
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg border border-line-strong text-ink hover:bg-card focus:outline-none focus:ring-2 focus:ring-ink"
        >
          Zrušit
        </button>
      </div>
    </Callout>
  );
}
