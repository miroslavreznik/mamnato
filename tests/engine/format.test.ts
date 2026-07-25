import { describe, it, expect } from 'vitest';
import { formatMonths, yearWord, monthWord } from '../../src/engine/format';

describe('skloňování', () => {
  it('roky podle českého vzoru', () => {
    expect(yearWord(1)).toBe('rok');
    expect(yearWord(2)).toBe('roky');
    expect(yearWord(4)).toBe('roky');
    expect(yearWord(5)).toBe('let');
    expect(yearWord(11)).toBe('let');
  });

  it('měsíce podle českého vzoru', () => {
    expect(monthWord(1)).toBe('měsíc');
    expect(monthWord(3)).toBe('měsíce');
    expect(monthWord(5)).toBe('měsíců');
  });
});

describe('formatMonths', () => {
  it('nikdy nevyrobí tvar „1 let" ani „1 měsíců"', () => {
    expect(formatMonths(16)).toBe('1 rok a 4 měsíce');
    expect(formatMonths(12)).toBe('1 rok');
    expect(formatMonths(1)).toBe('1 měsíc');
    expect(formatMonths(13)).toBe('1 rok a 1 měsíc');
  });

  it('zvládne běžné rozsahy', () => {
    expect(formatMonths(8)).toBe('8 měsíců');
    expect(formatMonths(24)).toBe('2 roky');
    expect(formatMonths(30)).toBe('2 roky a 6 měsíců');
    expect(formatMonths(60)).toBe('5 let');
  });

  it('zkrácená varianta používá „měs." do dlaždic', () => {
    expect(formatMonths(16, true)).toBe('1 rok a 4 měs.');
    expect(formatMonths(8, true)).toBe('8 měs.');
  });

  it('ošetří nulu i nekonečno', () => {
    expect(formatMonths(0)).toBe('ihned');
    expect(formatMonths(-5)).toBe('ihned');
    expect(formatMonths(Infinity)).toBe('více než 10 let');
  });
});
