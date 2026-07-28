/**
 * Chrome vstupního pole: rámeček, podklad, rádius.
 *
 * Tenhle řetězec byl rozepsaný na dvaadvaceti místech, pokaždé slepený
 * s rozměry konkrétního pole, takže se v něm nedalo poznat, co je společné
 * a co je výjimka. Redesign přitom sáhne přesně na tuhle část (rámeček
 * a podklad), ne na šířky a odsazení.
 *
 * Rozměry proto zůstávají u volajícího: liší se případ od případu
 * (celá šířka vs. `w-16` u počtu měsíců, `pr-9` když je v poli jednotka)
 * a sjednocovat je má smysl až s novým vzhledem, ne teď.
 *
 * Pozor na `px-3 pr-9`: obě třídy musí zůstat. `pr-*` v Tailwindu přebíjí
 * `px-*`, takže vypuštění `px-3` by změnilo odsazení vlevo.
 *
 * Zjištěné nesrovnalosti, které se schválně neopravují teď (byla by to změna
 * vzhledu, ne úklid): fokusový prstenec má jen pět polí z třiadvaceti
 * a jedno pole si navíc vynucuje `bg-white`, zbytek podklad dědí.
 *
 * Sem nepatří hlavní pole průvodce v `NumberInput.tsx`: barvu rámečku si
 * přepíná podle chyby (`border-red-400`), takže napevno zadaný
 * `border-line-strong` by mu chybový stav sebral. Při redesignu na něj
 * nezapomeň, je to nejvíc vidět ze všech polí.
 */
export const FIELD = 'border border-line-strong dark:bg-gray-700 dark:text-white rounded-lg';

export const fieldClass = (...extra: (string | false | undefined)[]) =>
  [FIELD, ...extra.filter(Boolean)].join(' ');
