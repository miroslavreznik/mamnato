/**
 * Hodnota, kterou appka umí odhadnout, ale uživatel ji může přepsat.
 *
 * Tenhle vzorec se v aplikaci opakuje u úrokové sazby (odhad podle fixace),
 * nákladů na vlastnictví (odhad podle ceny) i dávek na rodičovské (odhad
 * podle příjmu). Vždycky platí totéž: dokud uživatel nic nezadal, řídí se to
 * odhadem a mění se s ostatními vstupy; jakmile zadá svoje číslo, má přednost
 * a odhad ustoupí.
 *
 * Bez pojmenování se ten koncept psal pokaždé znovu a lišil se v detailech,
 * takže se lišilo i to, co appka uživateli o původu čísla řekla.
 */
export interface Estimate<T> {
  /** Hodnota, se kterou se počítá: ruční zadání, jinak odhad. */
  value: T;
  /** Co by appka odhadla, i když je zadáno ručně (pro srovnání v UI). */
  suggested: T;
  /** Zadal to uživatel ručně? */
  overridden: boolean;
}

export function estimate<T>(manual: T | null | undefined, suggested: T): Estimate<T> {
  return {
    value: manual ?? suggested,
    suggested,
    overridden: manual != null,
  };
}
