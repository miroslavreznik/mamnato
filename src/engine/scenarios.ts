import type { WizardState } from '../types';
import { monthlyDisposable, totalMonthlyExpenses } from './cashflow';
import { dsti, dti, downPaymentGap, monthsToSaveDownPayment } from './mortgage';

export type ScenarioId =
  | 'cannot_afford_cashflow'
  | 'cannot_afford_dsti'
  | 'no_savings'
  | 'tight_but_possible'
  | 'ready_in_1_2_years'
  | 'ready_now'
  | 'very_comfortable';

export interface Scenario {
  id: ScenarioId;
  icon: string;
  title: string;
  description: string;
  tips: string[];
}

function buildScenarios(state: WizardState): Record<ScenarioId, Scenario> {
  const emergencyFund = Math.round(totalMonthlyExpenses(state) * 4).toLocaleString('cs-CZ');

  return {
    cannot_afford_cashflow: {
      id: 'cannot_afford_cashflow',
      icon: '\u26A0\uFE0F',
      title: 'Nejdříve je potřeba stabilizovat rozpočet',
      description:
        'Vaše aktuální výdaje jsou vyšší než příjmy, takže v tuto chvíli není prostor pro spoření ani splácení hypotéky. Koupě nemovitosti by situaci ještě zhoršila. Dobrá zpráva je, že jakmile rozpočet vyrovnáte, otevřou se nové možnosti.',
      tips: [
        'Projděte si výdaje po kategoriích a hledejte, kde lze ušetřit. Často pomůže snížit náklady na předplatná, pojistky nebo dopravu.',
        'Pokud je příčinou nízký příjem, zvažte možnosti jeho navýšení, třeba brigádu, změnu zaměstnání nebo vyjednání přidání.',
        'Vraťte se do průvodce a zkuste upravit výdaje. Výsledky se okamžitě přepočítají.',
      ],
    },
    cannot_afford_dsti: {
      id: 'cannot_afford_dsti',
      icon: '\uD83C\uDFE6',
      title: 'Banka by hypotéku pravděpodobně neschválila',
      description:
        'Splátka hypotéky by tvořila více než 45 % vašeho příjmu (ukazatel DSTI). Závazný horní limit DSTI sice ČNB od roku 2023 nevyžaduje, ale většina bank tuto hranici i tak posuzuje a žádost by zamítla nebo nabídla výrazně horší podmínky.',
      tips: [
        'Zkuste v průvodci snížit cenu nemovitosti. I rozdíl 500 000 Kč může DSTI dostat pod limit.',
        'Prodloužení doby splácení (např. z 25 na 30 let) sníží měsíční splátku a tím i DSTI.',
        'Pokud plánujete vyšší příjem v blízké budoucnosti (povýšení, návrat z rodičovské), může dávat smysl počkat 1–2 roky.',
      ],
    },
    no_savings: {
      id: 'no_savings',
      icon: '\uD83D\uDC22',
      title: 'Na akontaci budete spořit více než 5 let',
      description:
        'Při aktuálním tempu spoření by trvalo více než 5 let, než naspoříte potřebnou akontaci. To není konec světa, ale je to signál, že je potřeba buď zrychlit spoření, nebo přehodnotit cílovou nemovitost.',
      tips: [
        'Zkuste v průvodci snížit cenu cílové nemovitosti. Menší nebo vzdálenější nemovitost může být rozumným mezikrokem.',
        'Každý měsíc navíc odkládaný stranou zkrátí čekání. Zvyšte měsíční úspory o 2 000–5 000 Kč a sledujte, jak se horizont mění.',
        'Zjistěte, zda máte nárok na státní podporu, například Dlouhodobý investiční produkt (DIP) nabízí daňové zvýhodnění při spoření na vlastní bydlení.',
      ],
    },
    tight_but_possible: {
      id: 'tight_but_possible',
      icon: '\u2696\uFE0F',
      title: 'Dosažitelné, ale s malou rezervou',
      description:
        'Čísla vycházejí: na hypotéku dosáhnete a úspory na akontaci naspoříte v rozumném horizontu. Zároveň ale nebude mnoho prostoru pro neočekávané výdaje. Je důležité mít před koupí vytvořenou finanční rezervu.',
      tips: [
        `Před podpisem smlouvy mějte stranou nouzový fond, ideálně 3–6 měsíců výdajů (pro vás to je cca ${emergencyFund} Kč). Tuto částku nezapočítávejte do akontace.`,
        'Zvažte fixaci úrokové sazby na delší období (7–10 let). Ochráníte se před růstem sazeb v době, kdy bude váš rozpočet napnutý.',
        'Při schvalování hypotéky banky hodnotí i pracovní stabilitu. Smlouva na dobu neurčitou výrazně pomůže.',
      ],
    },
    ready_in_1_2_years: {
      id: 'ready_in_1_2_years',
      icon: '\uD83C\uDFAF',
      title: 'Jste blízko: ještě 1 až 2 roky spoření',
      description:
        'Na akontaci vám chybí už jen kousek a při aktuálním tempu tam do 2 let dotáhnete. Teď je ideální čas připravit se na celý proces koupě dopředu, abyste byli připraveni jednat rychle.',
      tips: [
        'Začněte sledovat realitní trh ve vámi preferované lokalitě, třeba na Sreality.cz nebo Bezrealitky.cz. Pochopíte reálné ceny dříve, než budete kupovat.',
        'Nechte si udělat předschválení hypotéky (nezávazné). Zjistíte, na jakou částku dosáhnete, a při koupi budete mít navrch.',
        'Zvažte, zda část úspor není výhodné uložit do spořicího účtu nebo krátkodobého termínovaného vkladu místo běžného účtu.',
      ],
    },
    ready_now: {
      id: 'ready_now',
      icon: '\u2705',
      title: 'Jste finančně připraveni na koupi',
      description:
        'Máte dostatek úspor na akontaci, splátka hypotéky je v bezpečném poměru k vašemu příjmu a vejdete se do běžných bankovních limitů. Pokud jste si jisti s výběrem nemovitosti, finanční stránka vám nemusí bránit.',
      tips: [
        'Před podpisem nechte nemovitost zkontrolovat. Právní čistota (výpis z katastru, věcná břemena) a technický stav (vlhkost, elektrika, střecha) mohou výrazně ovlivnit skutečné náklady.',
        'Porovnejte nabídky alespoň 3 bank nebo využijte hypotečního poradce. Rozdíl 0,3 % na sazbě znamená na 30 letech desítky tisíc korun.',
        'Nezapomeňte si ponechat rezervu po zaplacení akontace, ideálně 200–300 tisíc Kč na stěhování, drobné opravy a nečekané výdaje.',
      ],
    },
    very_comfortable: {
      id: 'very_comfortable',
      icon: '\uD83D\uDE80',
      title: 'Jste ve velmi silné finanční pozici',
      description:
        'Vaše čísla výrazně překračují standardní požadavky bank i doporučení ČNB. Splátka hypotéky by tvořila jen malou část vašeho příjmu a máte dostatek úspor s rezervou. Máte prostor vybírat a vyjednávat.',
      tips: [
        'S takovou bonitou si můžete dovolit vyjednávat o sazbě. Banky o dobré klienty soutěží, tak zkuste oslovit více bank najednou nebo použijte makléře.',
        'Zvažte, zda dává smysl vložit jako akontaci více než 20 %. Každé procento navíc snižuje úrok a měsíční splátku.',
        'Pokud máte volné prostředky nad rámec akontace, poraďte se o jejich zhodnocení, například ETF indexové fondy nebo dluhopisy mohou pracovat za vás.',
      ],
    },
  };
}

export function evaluateScenario(state: WizardState): Scenario {
  const disposable = monthlyDisposable(state);
  const dstiValue = dsti(state);
  const dtiValue = dti(state);
  const gap = downPaymentGap(state);
  const months = monthsToSaveDownPayment(state);

  const scenarios = buildScenarios(state);

  if (disposable <= 0) return scenarios.cannot_afford_cashflow;
  if (dstiValue > 0.45) return scenarios.cannot_afford_dsti;
  if (months > 60) return scenarios.no_savings;
  // Splátka je na hraně limitu ČNB → napjaté bez ohledu na úspory.
  if (dstiValue > 0.35) return scenarios.tight_but_possible;
  // DSTI je v pohodě; rozhoduje, jak daleko je akontace.
  if (gap > 0 && months <= 24) return scenarios.ready_in_1_2_years;
  if (gap > 0) return scenarios.tight_but_possible; // 24 < months <= 60
  if (dstiValue < 0.25 && dtiValue < 5) return scenarios.very_comfortable;
  return scenarios.ready_now;
}
