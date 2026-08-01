import type { WizardState } from '../types';
import { totalMonthlyIncome, totalMonthlyExpenses } from './cashflow';
import { czk, czkMonthly } from './format';

/**
 * Kontrola reálnosti zadaných výdajů.
 *
 * Appka doteď nikde neřekla „tohle je hodně nízko". Kdo zadal jídlo za
 * 3 000 Kč pro dva nebo nechal zbytné výdaje na nule, dostal zelený verdikt
 * postavený na rozpočtu, který v životě nevydrží. Je to nejčastější způsob,
 * jak si plán rozbít, a přitom se pozná ze zadaných čísel.
 *
 * **Nic to nezakazuje a nic to nemění.** Nepřepisuje to zadané hodnoty,
 * neblokuje průchod průvodcem a nesahá to na verdikt. Je to upozornění, které
 * jde odklepnout: hraničních případů je spousta (bydlení u rodičů, auto od
 * zaměstnavatele, obědy v ceně práce, život na vesnici) a appka o nich neví.
 * Kdo řekne „u nás to tak je", má mít pokoj; proto se odklepnutá poznámka
 * ukládá do `state.dismissedChecks` a víckrát se neukáže.
 *
 * Prahy jsou schválně **nízko**, ne na průměru. Cílem není hodnotit životní
 * styl, ale chytit chybějící položku a překlep v řádu.
 */

export interface PlausibilityNote {
  /** Stabilní klíč, podle kterého se poznámka odklepává. */
  key: string;
  /** Krátký nadpis, jedna věc. */
  title: string;
  /** Proč se to ptáme a co s tím. */
  detail: string;
  /**
   * `caution` = nejspíš chybí položka nebo je překlep v řádu.
   * `info` = může to tak být, jen ať se s tím počítá.
   */
  tone: 'caution' | 'info';
  /** Pole ve výdajích, kterého se to týká. Kvůli odskoku na správné místo. */
  field?: string;
}

/**
 * Kolik dospělých v domácnosti. Jídlo se poměřuje na dospělého, ne na hlavu:
 * děti mají vlastní položku „Výdaje na děti", takže by se počítaly dvakrát.
 */
function adults(state: WizardState): number {
  return state.mode === 'individual' ? 1 : 2;
}

// Prahy, pod kterými se ptáme. Nejsou to průměry, ale dolní mez toho, co
// v ČR ještě dává smysl (ČSÚ, statistika rodinných účtů, 2024/2025;
// zaokrouhleno dolů, ať se neptáme zbytečně).
//
// Kdo je chce posouvat: platí, že falešné upozornění je dražší než
// zameškané. Uživatel, kterému appka bezdůvodně nedůvěřuje, přestane
// důvěřovat jí.
const MIN_FOOD_PER_ADULT = 2500;
const MIN_UTILITIES = 800;
const MIN_TRANSPORT = 300;
// Rozpočet, ve kterém výdaje nedosáhnou ani dvou pětin příjmu, obvykle
// neznamená spořivost, ale zapomenutou položku.
const MIN_EXPENSE_RATIO = 0.4;

export function plausibilityNotes(state: WizardState): PlausibilityNote[] {
  const notes: PlausibilityNote[] = [];
  const e = state.expenses;
  const income = totalMonthlyIncome(state);
  const expenses = totalMonthlyExpenses(state);

  const perAdult = e.food / adults(state);
  if (e.food <= 0) {
    notes.push({
      key: 'food_zero',
      field: 'food',
      tone: 'caution',
      title: 'Jídlo je na nule',
      detail: 'Nejspíš jen nevyplněné. Bez téhle položky vychází rozpočet o celý nákup měsíčně lépe, než jaký doopravdy je.',
    });
  } else if (perAdult < MIN_FOOD_PER_ADULT) {
    notes.push({
      key: 'food_low',
      field: 'food',
      tone: 'caution',
      title: `Jídlo vychází na ${czkMonthly(Math.round(perAdult))} na dospělého`,
      detail: `To je hodně nízko: běžně to bývá od ${czk(MIN_FOOD_PER_ADULT)} výš. Zkontrolujte, jestli tam patří i obědy v práci, drogerie a nákupy, které platí ten druhý.`,
    });
  }

  if (e.utilities <= 0) {
    notes.push({
      key: 'utilities_zero',
      field: 'utilities',
      tone: 'caution',
      title: 'Energie a poplatky jsou na nule',
      detail: 'Elektřina, plyn, voda, odpady a internet něco stojí i v nájmu. Pokud je máte v ceně nájmu, je to v pořádku; po koupi je ale budete platit zvlášť.',
    });
  } else if (e.utilities < MIN_UTILITIES) {
    notes.push({
      key: 'utilities_low',
      field: 'utilities',
      tone: 'info',
      title: 'Energie a poplatky jsou velmi nízké',
      detail: 'Zkontrolujte, jestli je v částce i voda, odpady, internet a případný fond oprav.',
    });
  }

  if (e.transport < MIN_TRANSPORT) {
    notes.push({
      key: 'transport_low',
      field: 'transport',
      tone: 'info',
      title: 'Doprava je skoro na nule',
      detail: 'Pokud chodíte pěšky nebo máte auto od zaměstnavatele, je to v pořádku. Jinak sem patří i pohonné hmoty, servis, povinné ručení a roční kupony na MHD rozpočítané na měsíc.',
    });
  }

  if (e.insurance <= 0) {
    notes.push({
      key: 'insurance_zero',
      field: 'insurance',
      tone: 'info',
      title: 'Pojistky jsou na nule',
      detail: 'Bez životního pojištění se dá plánovat, ale kdo bere hypotéku, obvykle nějaké má. Patří sem i pojištění domácnosti a odpovědnosti.',
    });
  }

  if (e.other <= 0) {
    notes.push({
      key: 'discretionary_zero',
      field: 'other',
      tone: 'caution',
      title: 'Zbytné výdaje jsou na nule',
      detail: 'Rozpočet, ve kterém není ani koruna na kávu, dárek nebo výlet, se dlouhodobě neudrží. Zkuste tam dát i malou částku; uvidíte, jestli plán vydrží i s ní.',
    });
  }

  if (e.rent <= 0) {
    notes.push({
      key: 'rent_zero',
      field: 'rent',
      tone: 'info',
      title: 'Nájem je na nule',
      detail: state.goals.includes('property')
        ? 'Pokud bydlíte u rodiny nebo ve svém, je to v pořádku. Jen počítejte s tím, že po koupi přibude celá splátka najednou, ne jako rozdíl proti nájmu.'
        : 'Pokud bydlíte u rodiny nebo ve svém, je to v pořádku. Jinak tahle položka nejspíš chybí.',
    });
  }

  // Souhrnná kontrola je až poslední a jen tehdy, když se nic konkrétního
  // nenašlo. Vedle tří jmenovitých poznámek by byla čtvrtá, obecnější,
  // jen šum.
  if (notes.length === 0 && income > 0 && expenses / income < MIN_EXPENSE_RATIO) {
    notes.push({
      key: 'total_low',
      tone: 'caution',
      title: 'Výdaje jsou proti příjmu neobvykle nízké',
      detail: `Zadali jste ${czkMonthly(expenses)} při příjmu ${czkMonthly(income)}. Když to sedí, je to skvělá výchozí pozice. Častěji ale nějaká položka chybí, a plán pak stojí na penězích, které se rozpustí jinde.`,
    });
  }

  return notes;
}

/** Poznámky, které uživatel ještě neodklepl. */
export function openPlausibilityNotes(state: WizardState): PlausibilityNote[] {
  const dismissed = new Set(state.dismissedChecks ?? []);
  return plausibilityNotes(state).filter((n) => !dismissed.has(n.key));
}
