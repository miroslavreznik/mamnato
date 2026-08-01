import { useId, useState, type ReactNode } from 'react';

/**
 * Vysvětlení, které je po ruce, ale nezabírá místo.
 *
 * Appka vysvětluje hodně a je to tak správně: kdo se rozhoduje o hypotéce,
 * potřebuje vědět, co znamená LTV a proč banka může dům ocenit níž. Na
 * telefonu se ale z těch vysvětlivek stala hlavní náplň stránky. Záložka
 * Bydlení měřila 5 703 px, tedy sedm obrazovek, a čísla, kvůli kterým tam
 * člověk jde, byla mezi odstavci schovaná.
 *
 * Pravidlo, podle kterého se to dělí: **na stránce zůstává číslo a závěr,
 * pod klapku jde odůvodnění.** „Splátka 25 971 Kč" a „vlastnictví odčerpá
 * o 9 071 Kč víc než nájem" jsou odpovědi. „Banka půjčuje podle ceny, kterou
 * nemovitosti přiřkne její odhadce" je důvod, a ten se hledá, až když je
 * potřeba.
 *
 * Není to `<details>`. Nativní prvek by byl lacinější, jenže obsah v něm
 * prohlížeč schová tak, že ho nejde vytáhnout ani do tisku, a report má být
 * kompletní: na papíře se klapky rozbalují samy (`.print-open` v `index.css`).
 */
export default function Disclosure({ summary, children, className = '' }: {
  /** Co je uvnitř, ne „Zobrazit více". Kdo neví, co pod tím je, neklikne. */
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="no-print inline-flex items-center gap-1.5 min-h-[44px] text-sm text-ink-body hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink rounded-lg"
      >
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {summary}
      </button>
      {/* Skrývá se inline stylem, ne atributem `hidden`. Tailwind má
          v preflightu `[hidden] { display: none !important }` uvnitř vrstvy,
          a u `!important` deklarací vyhrávají vrstvené styly nad nevrstvenými,
          takže tiskové pravidlo by ho nepřebilo, i když má `!important` taky. */}
      <div id={id} className="print-open" style={open ? undefined : { display: 'none' }}>
        {children}
      </div>
    </div>
  );
}
