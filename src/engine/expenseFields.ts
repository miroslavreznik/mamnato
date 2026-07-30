/**
 * Výdajové kategorie: jedno znění pro průvodce i pro výsledky.
 *
 * Dokud se výdaje daly zadat jen v průvodci, stačil seznam přímo v kroku.
 * Teď jdou upravovat i v Rozpočtu, a dva opisy téhož seznamu by se dřív nebo
 * později rozešly v popisku nebo v kroku šipek.
 */
export interface ExpenseField {
  field: string;
  label: string;
  /** Kratší popisek do hutných seznamů, kde se dlouhý název nevejde. */
  short: string;
  tooltip: string;
  step: number;
  /** Ukázat jen u rodiny s dětmi. */
  familyOnly?: boolean;
}

export const NECESSARY_EXPENSE_FIELDS: ExpenseField[] = [
  {
    field: 'rent',
    label: 'Nájem (bez energií a poplatků)',
    short: 'Nájem',
    tooltip: 'Zadejte čistou výši nájmu, tedy částku, kterou platíte pronajímateli za byt. Energie a zálohy zadejte do pole níže.',
    step: 1000,
  },
  {
    field: 'utilities',
    label: 'Energie, voda a poplatky za bydlení',
    short: 'Energie a poplatky',
    tooltip: 'Zálohy na elektřinu, plyn, vodu, internet a případné zálohy do SVJ nebo správci domu.',
    step: 500,
  },
  {
    field: 'existingLoans',
    label: 'Stávající splátky úvěrů',
    short: 'Splátky úvěrů',
    tooltip: 'Splátky spotřebitelských úvěrů, leasingů, kreditních karet.',
    step: 500,
  },
  {
    field: 'insurance',
    label: 'Pojistky',
    short: 'Pojistky',
    tooltip: 'Životní pojištění, havarijní pojištění, cestovní pojištění.',
    step: 500,
  },
  {
    field: 'food',
    label: 'Jídlo a potraviny',
    short: 'Jídlo a potraviny',
    tooltip: 'Nákupy potravin, obědy v práci, restaurace.',
    step: 500,
  },
  {
    field: 'transport',
    label: 'Doprava',
    short: 'Doprava',
    tooltip: 'Pohonné hmoty, MHD, údržba auta, pojistka vozidla.',
    step: 500,
  },
  {
    field: 'children',
    label: 'Výdaje na děti',
    short: 'Výdaje na děti',
    tooltip: 'Školka, kroužky, oblečení, kapesné, jídlo pro děti.',
    step: 500,
    familyOnly: true,
  },
];

export const DISCRETIONARY_EXPENSE_FIELD: ExpenseField = {
  field: 'other',
  label: 'Zbytné výdaje (zábava, dovolená, koníčky, předplatné)',
  short: 'Zbytné výdaje',
  tooltip: 'Výdaje, které lze při výpadku příjmů omezit: zábava, sport, dovolená, restaurace nad rámec běžné stravy, předplatné služeb. Slouží k výpočtu doporučené rezervy a odolnosti rozpočtu.',
  step: 500,
};
