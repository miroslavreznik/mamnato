import type { ReactNode } from 'react';

/**
 * Tónovaný box se sdělením: zvládnuté, pozor, nevychází, poznámka.
 *
 * Podklady stavů byly rozepsané po komponentách jako čtveřice tříd (světlá
 * a tmavá výplň, světlý a tmavý text), v každé o kus jinak. Odstíny stavů
 * teď drží jedno místo a tmavý režim řeší proměnná, ne druhá sada tříd.
 *
 * Vnější rozestupy zůstávají na volajícím (`className`), vnitřní geometrie
 * má vlastní prop `pad`. Přes `className` by nešla: `p-4` a `p-3` by na
 * prvku byly obě naráz a rozhodovalo by pořadí tříd ve výsledném CSS, ne
 * záměr autora. Kvůli tomu se sem dřív box s jiným odsazením nedal převést
 * vůbec.
 *
 * Obrys je od nového vzhledu ve všech tónech neutrální. Návrh chce jednu
 * úroveň ohraničení: vnitřní bloky se odlišují výplní, nikdy obrysem.
 * Proto `border` u tónů nic nerozlišuje a při dalším kroku redesignu
 * nejspíš zmizí úplně i s propem.
 *
 * Schválně sem nepřešly:
 * - vybrané dlaždice v kroku režimu, cílů a u rodičovské. To není sdělení,
 *   ale stav výběru.
 * - prázdný stav „vyberte si cíle" v `ResultsDashboard`, který je na střed
 *   a chová se jako karta, ne jako poznámka v ní.
 * - verdikt v `ResultsOverview`, který má čtyři tóny odpovědi.
 * - tónované dlaždice s číslem (náklady na dítě, volná rezerva, srovnání
 *   koupě a nájmu). Výplň v nich nenese stav, jen odděluje sloupec.
 * - závěrečná věta v `MortgageVsRent`. Je to tónovaný box se sdělením, ale
 *   sází se základní velikostí písma, ne `text-sm`, a projít sem by ji
 *   zmenšilo.
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

export default function Callout({ tone, border = false, alert = false, pad = 'p-3 rounded-lg', className = '', children }: {
  tone: CalloutTone;
  /** Obrys v tónu boxu. */
  border?: boolean;
  /** Vnitřní odsazení a zaoblení. Do `className` nepatří, viz komentář výše. */
  pad?: string;
  /**
   * Ohlásit obsah čtečce hned, jak se objeví. Pro sdělení, které vzniklo
   * reakcí na to, co uživatel právě zadal (výdaje přerostly příjem), ne pro
   * text, který na stránce je od začátku.
   */
  alert?: boolean;
  /** Vnější rozestupy a cokoli dalšího, co se s `pad` nepere. */
  className?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      role={alert ? 'alert' : undefined}
      className={`${pad} text-sm ${t.fill} ${border ? `border ${t.edge}` : ''} ${className}`.replace(/\s+/g, ' ').trim()}
    >
      {children}
    </div>
  );
}
