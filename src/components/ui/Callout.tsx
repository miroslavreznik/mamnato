import type { ReactNode } from 'react';

/**
 * Tónovaný box se sdělením: zvládnuté, pozor, nevychází, poznámka.
 *
 * Podklady stavů byly rozepsané po komponentách jako čtveřice tříd (světlá
 * a tmavá výplň, světlý a tmavý text), v každé o kus jinak. Odstíny stavů
 * teď drží jedno místo a tmavý režim řeší proměnná, ne druhá sada tříd.
 *
 * Rozestupy zůstávají na volajícím (`className`), protože se případ od případu
 * liší a sjednocovat je má smysl až s novým vzhledem, ne teď.
 *
 * Obrys je od nového vzhledu ve všech tónech neutrální. Návrh chce jednu
 * úroveň ohraničení: vnitřní bloky se odlišují výplní, nikdy obrysem.
 * Proto `border` u tónů nic nerozlišuje a při dalším kroku redesignu
 * nejspíš zmizí úplně i s propem.
 *
 * Pozor: `ui/Alert.tsx` dělá totéž, ale s emoji a vlastní sadou tónů.
 * Sloučit je patří k překreslení sdílených prvků, ne sem.
 *
 * Schválně sem zatím nepřešly:
 * - vybrané dlaždice v kroku režimu, cílů a u rodičovské. To není sdělení,
 *   ale stav výběru.
 * - prázdný stav „vyberte si cíle" v `ResultsDashboard`, který má jinou
 *   geometrii (větší rádius, větší odsazení, na střed). Přepsat ji přes
 *   `className` by spoléhalo na pořadí tříd ve výsledném CSS.
 * - verdikt v `ResultsOverview`, který má čtyři tóny odpovědi.
 */
export type CalloutTone = 'brand' | 'good' | 'caution' | 'danger' | 'neutral';

const TONES: Record<CalloutTone, { fill: string; edge: string }> = {
  brand: {
    fill: 'bg-tint-brand text-brand',
    edge: 'border-line',
  },
  good: {
    fill: 'bg-tint-good text-good',
    edge: 'border-line',
  },
  caution: {
    fill: 'bg-tint-caution text-caution',
    edge: 'border-line',
  },
  danger: {
    fill: 'bg-tint-danger text-danger',
    edge: 'border-line',
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
