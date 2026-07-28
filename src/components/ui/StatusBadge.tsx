export type Status = 'good' | 'caution' | 'danger' | 'neutral';

/**
 * Stav cíle: tvar, slovo a barva.
 *
 * Všechny tři naráz, ne jedno z nich. Samotná barva neprojde tiskem ani
 * barvoslepostí, samotné slovo se v mřížce špatně hledá očima. Tvar je proto
 * u každého stavu jiný a nese informaci i černobíle: plné kolečko, čtvereček,
 * čárka, prázdné kolečko.
 *
 * Odznak nemá vlastní podklad. Dřív to byla tónovaná pilulka, jenže se ukázalo,
 * že vedle sebe v mřížce vypadaly čtyři pilulky jako čtyři tlačítka. Návrh je
 * proto sází jako text na kartě.
 */

const SHAPE: Record<Status, { d: string; fill: boolean }> = {
  // Plné kolečko: zvládnuté.
  good: { d: 'M4 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', fill: true },
  // Čtvereček: pozor. Rohy jemně zaoblené, ať vedle kolečka nekřičí.
  caution: { d: 'M2 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z', fill: true },
  // Vodorovná čárka: nevychází. Znaménko minus, ne křížek: křížek čte
  // část lidí jako „zavřít".
  danger: { d: 'M0 3h9v2H0z', fill: true },
  // Kolečko obrysem: podmíněně. Prázdné uvnitř, protože odpověď zatím
  // nemá čím se vyplnit.
  neutral: { d: 'M4 0.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5z', fill: false },
};

const TONE: Record<Status, string> = {
  good: 'text-good',
  caution: 'text-caution',
  danger: 'text-danger',
  neutral: 'text-neutral',
};

export default function StatusBadge({ status, label, className = '' }: {
  status: Status;
  label: string;
  className?: string;
}) {
  const shape = SHAPE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${TONE[status]} ${className}`.trimEnd()}>
      <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden="true" className="shrink-0 overflow-visible">
        <path
          d={shape.d}
          fill={shape.fill ? 'currentColor' : 'none'}
          stroke={shape.fill ? 'none' : 'currentColor'}
          strokeWidth={shape.fill ? undefined : 1.5}
        />
      </svg>
      {label}
    </span>
  );
}
