// Formátování čísel, částek a časových údajů podle českých zvyklostí.
//
// Sem patří všechno, co uživatel uvidí jako číslo. Dřív si skoro každá
// komponenta držela vlastní `const fmt = …` (bylo jich devět) a jednotka
// „za měsíc" se psala čtyřmi způsoby najednou, takže se tvary lišily
// stránku od stránky.

// Zaokrouhlené číslo s oddělovači tisíců, např. „1 234 567".
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('cs-CZ');
}

// Částka s měnou: „1 234 567 Kč".
export function czk(value: number): string {
  return `${formatNumber(value)} Kč`;
}

// Kompaktní měsíční částka do dlaždic a tabulek: „12 345 Kč/měs.".
export function czkPerMonth(value: number): string {
  return `${czk(value)}/měs.`;
}

// Měsíční částka do věty: „12 345 Kč měsíčně". Ve větě se zkratka čte hůř.
export function czkMonthly(value: number): string {
  return `${czk(value)} měsíčně`;
}

/**
 * Číslo s daným počtem desetinných míst, česky.
 *
 * Tedy s **desetinnou čárkou**. `toFixed()` ji neumí a vrací tečku, takže se
 * v appce objevovalo „26.6 %", „4.9×", „~15.8 měs." a „2.4 mil. Kč" vedle
 * správně naformátovaných částek. Na české obrazovce je to první věc, která
 * prozradí, že si toho nikdo nevšiml.
 */
export function decimal(value: number, digits = 1): string {
  return value.toLocaleString('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Procento bez vnucených desetinných míst: 0,01 → „1 %", 0,048 → „4,8 %".
export function percentCompact(ratio: number): string {
  const value = Math.round(ratio * 1000) / 10;
  return `${value.toLocaleString('cs-CZ')} %`;
}

// Úroková sazba: vždy aspoň jedno desetinné místo, nejvýš dvě. Sazby se
// běžně uvádějí jako „4,8 %" i „5,25 %", zaokrouhlení na jedno místo by
// druhý tvar znehodnotilo.
export function formatRate(ratio: number): string {
  return (ratio * 100).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

// Formátování časových údajů s českým skloňováním. Bez toho vznikají tvary
// jako „1 let" nebo „1 měsíců", které v textu okamžitě bijí do očí.

// 1 rok, 2–4 roky, 5+ let
export function yearWord(years: number): string {
  if (years === 1) return 'rok';
  if (years >= 2 && years <= 4) return 'roky';
  return 'let';
}

// „1 rok", „3 roky", „5 let". Ruční skládání téhle trojice se v komponentách
// opakovalo a pokaždé se v něm dal udělat překlep.
export function formatYears(years: number): string {
  return `${years} ${yearWord(years)}`;
}

// 1 dítě, 2–4 děti, 5+ dětí. Bez toho vzniklo „zvýhodnění na 5 děti".
export function childWord(children: number): string {
  if (children === 1) return 'dítě';
  if (children >= 2 && children <= 4) return 'děti';
  return 'dětí';
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

/**
 * Ukončí větu tečkou, pokud už tečkou nekončí.
 *
 * České zkratky („měs.", „mil.", „např.") končí tečkou a ta zároveň slouží
 * jako tečka větná; druhá se nepíše. Bez tohohle vznikaly věty typu
 * „naspoříte za 8 let a 9 měs..", což vypadá jako překlep.
 */
export function endSentence(text: string): string {
  return /[.!?…]$/.test(text.trimEnd()) ? text.trimEnd() : `${text.trimEnd()}.`;
}

const MONTHS_CS = [
  'lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu',
  'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci',
] as const;

/**
 * Kdy to bude, ve tvaru do věty: „v květnu 2029".
 *
 * Termín se čte líp než počet měsíců: „za 41 měsíců" si nikdo nepřevede,
 * „v květnu 2029" si zapíše do kalendáře. Šestý pád proto, že se to vždycky
 * používá po předložce „v".
 */
function dateIn(monthsFromNow: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + Math.max(0, Math.round(monthsFromNow)), 1);
}

export function monthYearIn(monthsFromNow: number): string {
  if (!isFinite(monthsFromNow)) return '';
  const target = dateIn(monthsFromNow);
  // Včetně předložky: všechny české měsíce ji mají v šestém pádě „v",
  // žádný nevyžaduje „ve", takže se to nemusí rozlišovat.
  return `v ${MONTHS_CS[target.getMonth()]} ${target.getFullYear()}`;
}

/**
 * Kalendářní rok, do kterého daný měsíc plánu padne.
 *
 * **Musí se počítat z dnešního data, ne z letopočtu plus podílu.** Plán běží
 * od dneška, ne od ledna: v srpnu padne dvacátý měsíc do dubna 2028, ale
 * `letošní rok + floor(20/12)` dá 2027. Podle toho, kolikátý je zrovna
 * měsíc, je takhle mimo víc než polovina pozic, a vždycky o celý rok dolů.
 *
 * Stejným datem počítá `monthYearIn`, takže „Nejníže 2028" na stuze a
 * „hotovo v dubnu 2028" v kartě kroku mluví o téže chvíli.
 */
export function yearIn(monthsFromNow: number): number {
  const now = new Date();
  if (!isFinite(monthsFromNow)) return now.getFullYear();
  return dateIn(monthsFromNow).getFullYear();
}
