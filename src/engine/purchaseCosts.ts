import type { WizardState } from '../types';

/**
 * Jednorázové náklady kolem koupě, které nejsou součástí ceny ani akontace.
 *
 * Nejsou velké proti ceně nemovitosti, ale odcházejí z rezervy hned na
 * začátku, tedy z peněz, o které se opírá verdikt. Uživatel se na ně
 * neptá, jsou to standardní položky každé koupě na hypotéku.
 *
 * Ceny služeb se liší podle poskytovatele, proto se uvádí rozpětí a
 * počítá se se středem. Daň z nabytí nemovitosti byla zrušena v roce 2020,
 * takže tu nefiguruje.
 */

export interface PurchaseCostItem {
  key: string;
  label: string;
  min: number;
  max: number;
  note: string;
}

// Sazby správních poplatků ČÚZK a běžné tržní ceny služeb (2026).
export const PURCHASE_COST_ITEMS: PurchaseCostItem[] = [
  {
    key: 'katastr',
    label: 'Vklad do katastru nemovitostí',
    min: 1600,
    max: 2000,
    note: 'Správní poplatek. Elektronicky 1 600 Kč, listinně 2 000 Kč. Za každý návrh zvlášť.',
  },
  {
    key: 'odhad',
    label: 'Odhad nemovitosti pro banku',
    min: 3000,
    max: 8000,
    note: 'Banka odhad vyžaduje. Některé banky ho u vlastního odhadce proplácejí nebo odpouštějí.',
  },
  {
    key: 'uschova',
    label: 'Advokátní nebo notářská úschova',
    min: 5000,
    max: 15000,
    note: 'Kupní cena leží na účtu třetí strany, dokud se převod nezapíše do katastru. Chrání obě strany.',
  },
  {
    key: 'pojisteni',
    label: 'Pojištění nemovitosti (první platba)',
    min: 2000,
    max: 6000,
    note: 'Banka ho k hypotéce vyžaduje. V dalších letech už je součástí nákladů na vlastnictví.',
  },
];

export interface PurchaseCosts {
  items: PurchaseCostItem[];
  min: number;
  max: number;
  typical: number;
}

export function purchaseOneOffCosts(state: WizardState): PurchaseCosts | null {
  if (!state.goals.includes('property')) return null;
  const items = PURCHASE_COST_ITEMS;
  const min = items.reduce((s, i) => s + i.min, 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  return { items, min, max, typical: Math.round((min + max) / 2) };
}
