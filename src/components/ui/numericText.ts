/**
 * Formátování čísel v rozepsaném poli a kotvení kurzoru.
 *
 * Obojí musí být na jednom místě, protože obě číselná pole (`NumberInput`
 * v průvodci i drobnější `NumField`) se musí chovat stejně. Uživateli je jedno,
 * která komponenta je zrovna pod polem, a rozdílné chování dvou vizuálně
 * shodných polí působí jako chyba.
 */

// Nezlomitelná mezera, stejně jako dosud formátoval `NumberInput`. Konkrétní
// druh mezery se mezi verzemi ICU liší (`toLocaleString` vrací podle prostředí
// U+00A0 nebo U+202F), proto si oddělovač při psaní držíme vlastní a při čtení
// akceptujeme obojí.
export const GROUP_SEPARATOR = '\u00A0';

// Mezery všeho druhu, které se v poli mohou objevit: vlastní oddělovač,
// nezlomitelná mezera z dřívějšího formátování i obyčejná mezera od uživatele.
export function stripGroupSeparators(s: string): string {
  return s.replace(/[\s\u00A0\u202F]/g, '');
}

/**
 * Seskupí celou část po třech.
 *
 * Desetinná část zůstává tak, jak ji uživatel píše, včetně rozepsaného „7,"
 * bez číslice za čárkou. Bez toho by nešlo napsat desetinné číslo: čárka by
 * se při každém úhozu zahodila.
 */
export function groupThousands(text: string): string {
  const cleaned = stripGroupSeparators(text);
  const sign = cleaned.startsWith('-') ? '-' : '';
  const body = sign ? cleaned.slice(1) : cleaned;

  const sepIndex = body.search(/[.,]/);
  const intDigits = (sepIndex === -1 ? body : body.slice(0, sepIndex)).replace(/\D/g, '');
  // Za oddělovačem necháme jen číslice, aby druhá čárka text nerozbila.
  const fraction = sepIndex === -1 ? '' : body[sepIndex] + body.slice(sepIndex + 1).replace(/\D/g, '');

  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  return sign + grouped + fraction;
}

// Kolik číslic stojí v textu před kurzorem. To je jediná spolehlivá kotva:
// pozice ve znacích se přeformátováním posune, počet číslic ne.
export function digitsBefore(text: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < caret && i < text.length; i++) {
    if (text[i] >= '0' && text[i] <= '9') count++;
  }
  return count;
}

/**
 * Kam patří kurzor v naformátovaném textu, aby stál těsně za n-tou číslicí.
 *
 * Nula znamená úplný začátek pole. Právě tahle větev dřív chyběla: když
 * uživatel smazal první číslici (z „12 000 000" chtěl udělat „10 000 000"),
 * nezbyla před kurzorem žádná číslice, cyklus nikdy nic netrefil a kurzor
 * odskočil na konec, tedy až za všechny nuly.
 */
export function caretAfterDigits(text: string, digits: number): number {
  if (digits <= 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] >= '0' && text[i] <= '9') {
      count++;
      if (count === digits) return i + 1;
    }
  }
  return text.length;
}

/**
 * Kompletní krok „uživatel něco napsal": vrátí text k zobrazení a pozici,
 * kam patří kurzor.
 */
export function reformatWithCaret(
  typed: string,
  caret: number
): { text: string; caret: number } {
  const anchor = digitsBefore(typed, caret);
  const text = groupThousands(typed);
  return { text, caret: caretAfterDigits(text, anchor) };
}
