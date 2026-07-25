// Formátování časových údajů s českým skloňováním. Bez toho vznikají tvary
// jako „1 let" nebo „1 měsíců", které v textu okamžitě bijí do očí.

// 1 rok, 2–4 roky, 5+ let
export function yearWord(years: number): string {
  if (years === 1) return 'rok';
  if (years >= 2 && years <= 4) return 'roky';
  return 'let';
}

// 1 měsíc, 2–4 měsíce, 5+ měsíců
export function monthWord(months: number): string {
  if (months === 1) return 'měsíc';
  if (months >= 2 && months <= 4) return 'měsíce';
  return 'měsíců';
}

// Počet měsíců jako lidsky čitelný údaj, např. „8 měsíců" nebo „1 rok a 4 měsíce".
// Zkrácená varianta používá „měs." a hodí se do dlaždic, kde není místo.
export function formatMonths(months: number, short = false): string {
  if (!isFinite(months)) return 'více než 10 let';
  const total = Math.round(months);
  if (total <= 0) return 'ihned';

  const m = total % 12;
  const y = Math.floor(total / 12);
  const mPart = short ? `${m} měs.` : `${m} ${monthWord(m)}`;

  if (y === 0) return mPart;
  const yPart = `${y} ${yearWord(y)}`;
  return m > 0 ? `${yPart} a ${mPart}` : yPart;
}
