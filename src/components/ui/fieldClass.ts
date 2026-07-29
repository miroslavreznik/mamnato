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
 * **Fokusový prstenec je součástí chrome, ne volitelný doplněk.** Dřív si ho
 * nesla čtyři pole z třiadvaceti a ostatní spoléhaly na výchozí obrys
 * prohlížeče, takže vedle sebe stála dvě pole a každé při fokusu vypadalo
 * jinak. V Safari se navíc výchozí obrys liší od Chromu.
 *
 * Sem nepatří hlavní pole průvodce v `NumberInput.tsx`: barvu rámečku si
 * přepíná podle chyby (`border-danger`), takže napevno zadaný
 * `border-line-strong` by mu chybový stav sebral. Prstenec má ale stejný.
 */
export const FIELD =
  'border border-line-strong bg-card text-ink rounded-lg '
  + 'focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink';

export const fieldClass = (...extra: (string | false | undefined)[]) =>
  [FIELD, ...extra.filter(Boolean)].join(' ');
