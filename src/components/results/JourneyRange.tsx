/**
 * Výřez z cesty: nejbližší roky, nebo celý plán.
 *
 * Cesta teď sahá k důchodu, což je u třicátníka pětatřicet let. Odpovídá to
 * na otázku „vyjde to celé", ale platí za to tím, že se první roky srazí
 * do prvních pár procent šířky: koupě a narození dítěte splynou v jeden
 * shluk u levého okraje a jejich bublinky se odsouvají daleko od svých
 * puntíků. Přitom právě těch pár let je jediná část plánu, se kterou se dá
 * něco udělat.
 *
 * Přepínač je proto výřez, ne jiný scénář. Ať je zvolený kterýkoli, verdikt,
 * karta nejtěsnějšího místa i čísla mluví dál o celém plánu; mění se jen to,
 * kam se člověk dívá.
 *
 * Když je co přepínat, ukáže se; u někoho pár let před důchodem je horizont
 * deset let a nabízet u něj „10 let" nebo „celý plán" by byla tatáž věc
 * dvakrát, takže se nekreslí nic.
 */

import { beyondView, type Journey } from '../../engine/journey';

interface Props {
  /** Celý horizont plánu v měsících. */
  horizonMonths: number;
  value: number;
  onChange: (months: number) => void;
}

/** Nabídnuté výřezy. Delší než horizont se zahodí, celek se přidá vždy. */
function rangeOptions(horizonMonths: number): { months: number; label: string }[] {
  const shorter = [120, 240]
    // Nejmíň dva roky rozdílu, jinak by vedle sebe stálo „20 let" a „celý
    // plán" u dvaadvacetiletého horizontu a vypadalo by to jako totéž.
    .filter((m) => m <= horizonMonths - 24)
    .map((m) => ({ months: m, label: `${m / 12} let` }));
  return [...shorter, { months: horizonMonths, label: 'Celý plán' }];
}

export default function JourneyRange({ horizonMonths, value, onChange }: Props) {
  const options = rangeOptions(horizonMonths);
  if (options.length < 2) return null;

  return (
    <div className="flex items-center justify-end gap-1 mb-2 no-print">
      {/* Popisek skupiny jde přes `aria-label`, ne přes schovaný text.
          Zbytek appky to dělá stejně a kontrastní test schovaný text
          nepozná: ořízlý `sr-only` span vyhodnotí jako 1,29:1. */}
      <div role="group" aria-label="Jak dlouhý úsek cesty ukázat" className="inline-flex gap-1">
        {options.map((o) => {
          const active = o.months === value;
          return (
            <button
              key={o.months}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.months)}
              className={
                'px-2.5 py-1 rounded-full text-xs transition-colors '
                + 'focus:outline-none focus:ring-2 focus:ring-ink '
                // `bg-raised`, ne `bg-card`: v tmavém režimu mají `card`,
                // `sunken` i `shell` tutéž hodnotu, takže by pilulka na
                // podkladu grafu zmizela. Stejný token drží i aktivní
                // záložka nahoře, takže se to čte jako táž věc.
                + (active
                  ? 'bg-raised text-ink font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink-body')
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Jednou větou to, co zkrácený výřez ořízl.
 *
 * Patří pod stuhu, ne k tlačítkům: je to důsledek volby, ne její součást.
 * Text staví engine, tady se jen vykresluje.
 */
export function JourneyRangeNote({ data, viewMonths }: { data: Journey; viewMonths: number }) {
  const note = beyondView(data, viewMonths);
  if (!note) return null;
  return <p className="mt-3 text-sm text-ink-muted">{note}</p>;
}
