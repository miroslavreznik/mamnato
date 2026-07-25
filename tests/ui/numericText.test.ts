import { describe, it, expect } from 'vitest';
import {
  GROUP_SEPARATOR as SEP,
  groupThousands,
  stripGroupSeparators,
  digitsBefore,
  caretAfterDigits,
  reformatWithCaret,
} from '../../src/components/ui/numericText';

describe('groupThousands', () => {
  it('seskupuje celou část po třech', () => {
    expect(groupThousands('12000000')).toBe(`12${SEP}000${SEP}000`);
    expect(groupThousands('1000')).toBe(`1${SEP}000`);
    expect(groupThousands('999')).toBe('999');
    expect(groupThousands('')).toBe('');
  });

  it('přeskupí i text, který už oddělovače má', () => {
    expect(groupThousands(`1${SEP}200${SEP}000`)).toBe(`1${SEP}200${SEP}000`);
    // Po smazání číslice uprostřed musí oddělovače naskočit znovu jinam.
    expect(groupThousands(`1${SEP}20${SEP}000`)).toBe(`120${SEP}000`);
  });

  it('nechá desetinnou část být, včetně rozepsané čárky', () => {
    expect(groupThousands('7,5')).toBe('7,5');
    expect(groupThousands('7,')).toBe('7,');
    expect(groupThousands('12000,25')).toBe(`12${SEP}000,25`);
    expect(groupThousands('7.5')).toBe('7.5');
  });

  it('zahodí znaky, které do čísla nepatří', () => {
    expect(groupThousands('12a000')).toBe(`12${SEP}000`);
    expect(groupThousands('7,5,5')).toBe('7,55');
  });

  it('zachová znaménko', () => {
    expect(groupThousands('-12000')).toBe(`-12${SEP}000`);
  });
});

describe('stripGroupSeparators', () => {
  it('umí oba druhy nezlomitelné mezery i obyčejnou', () => {
    expect(stripGroupSeparators('12 000')).toBe('12000');
    expect(stripGroupSeparators('12 000')).toBe('12000');
    expect(stripGroupSeparators('12 000')).toBe('12000');
  });
});

describe('kotvení kurzoru', () => {
  it('počítá číslice před kurzorem, ne znaky', () => {
    expect(digitsBefore(`12${SEP}000`, 0)).toBe(0);
    expect(digitsBefore(`12${SEP}000`, 2)).toBe(2);
    expect(digitsBefore(`12${SEP}000`, 3)).toBe(2); // hned za oddělovačem
    expect(digitsBefore(`12${SEP}000`, 6)).toBe(5);
  });

  it('bez číslic před kurzorem míří na začátek pole, ne na konec', () => {
    // Tohle je jádro chyby, kvůli které kurzor odskakoval za poslední nulu.
    expect(caretAfterDigits(`12${SEP}000${SEP}000`, 0)).toBe(0);
  });

  it('staví kurzor těsně za n-tou číslici', () => {
    expect(caretAfterDigits(`12${SEP}000`, 1)).toBe(1);
    expect(caretAfterDigits(`12${SEP}000`, 2)).toBe(2);
    expect(caretAfterDigits(`12${SEP}000`, 3)).toBe(4); // přeskočí oddělovač
    expect(caretAfterDigits(`12${SEP}000`, 99)).toBe(6); // víc, než kolik je
  });
});

describe('reformatWithCaret', () => {
  it('drží kurzor na místě při mazání první číslice', () => {
    // „12 000 000", kurzor za „12", uživatel smaže „2" → chce „1 000 000"
    // a kurzor hned za jedničkou, aby mohl napsat nulu.
    const typed = `1${SEP}000${SEP}000`;
    const { text, caret } = reformatWithCaret(typed, 1);
    expect(text).toBe(`1${SEP}000${SEP}000`);
    expect(caret).toBe(1);
  });

  it('drží kurzor na začátku, když uživatel smaže obě první číslice', () => {
    const { text, caret } = reformatWithCaret(`${SEP}000${SEP}000`, 0);
    expect(text).toBe(`000${SEP}000`);
    expect(caret).toBe(0);
  });

  it('posune kurzor přes nově vložený oddělovač', () => {
    // Z „100 000" se napsáním nuly stane „1 000 000"; kurzor byl za sedmi
    // číslicemi, takže má skončit na konci.
    const { text, caret } = reformatWithCaret(`1000${SEP}000`, 4);
    expect(text).toBe(`1${SEP}000${SEP}000`);
    expect(caret).toBe(5);
  });

  it('psaní uprostřed nechá kurzor za napsanou číslicí', () => {
    // „12 000" → uživatel napsal „5" za jedničku: „152 000"
    const { text, caret } = reformatWithCaret(`152${SEP}000`, 2);
    expect(text).toBe(`152${SEP}000`);
    expect(caret).toBe(2);
  });
});
