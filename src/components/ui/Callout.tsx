import type { ReactNode } from 'react';

/**
 * Tónovaný box se sdělením: zvládnuté, pozor, nevychází, poznámka.
 *
 * Podklady stavů byly rozepsané po komponentách jako čtveřice tříd
 * („bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"),
 * v každé o kus jinak. Odstíny stavů teď drží jedno místo.
 *
 * Rozestupy zůstávají na volajícím (`className`), protože se případ od případu
 * liší a sjednocovat je má smysl až s novým vzhledem, ne teď.
 *
 * Pozor: `ui/Alert.tsx` dělá totéž, ale s vlastní, o kousek jinou paletou
 * (žlutá místo jantarové, tmavší modrý text) a s emoji. Při redesignu je
 * potřeba je sloučit; teď by to znamenalo měnit vzhled, ne ho jen uklidit.
 *
 * Schválně sem zatím nepřešly:
 * - vybrané dlaždice (`border-blue-500 bg-blue-50 dark:bg-blue-900/30`) v kroku
 *   režimu, cílů a u rodičovské. To není sdělení, ale stav výběru, a má i jinou
 *   průhlednost v tmavém režimu.
 * - prázdný stav „vyberte si cíle" v `ResultsDashboard`, který je `rounded-xl`,
 *   `p-6` a na střed. Přepsat odsazení přes `className` by znamenalo spoléhat
 *   na pořadí tříd ve výsledném CSS, což není zaručené.
 * - verdikt v `ResultsOverview`, který má čtyři tóny odpovědi včetně oranžové.
 */
export type CalloutTone = 'brand' | 'good' | 'caution' | 'danger' | 'neutral';

const TONES: Record<CalloutTone, { fill: string; edge: string }> = {
  brand: {
    fill: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    edge: 'border-blue-200 dark:border-blue-800',
  },
  good: {
    fill: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300',
    edge: 'border-emerald-200 dark:border-emerald-800',
  },
  caution: {
    fill: 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
    edge: 'border-amber-200 dark:border-amber-700',
  },
  danger: {
    fill: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    edge: 'border-red-200 dark:border-red-800',
  },
  neutral: {
    fill: 'bg-sunken text-ink-body',
    edge: 'border-line',
  },
};

export default function Callout({ tone, border = false, className = '', children }: {
  tone: CalloutTone;
  /** Obrys v tónu boxu. */
  border?: boolean;
  /** Rozestupy a odsazení. Výchozí je `p-3 rounded-lg text-sm`. */
  className?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className={`p-3 rounded-lg text-sm ${t.fill} ${border ? `border ${t.edge}` : ''} ${className}`.replace(/\s+/g, ' ').trim()}>
      {children}
    </div>
  );
}
