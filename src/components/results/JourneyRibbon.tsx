import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { line, area, curveMonotoneX } from 'd3-shape';
import type { Journey, Tension } from '../../engine/journey';
import { czk, formatMonths } from '../../engine/format';

/**
 * Časová osa: život až do důchodu jako jedna stuha.
 *
 * Nahrazuje graf v roli hrdiny výsledků. Proti čárovému grafu úspor umí dvě
 * věci navíc, kvůli kterým vznikla:
 *
 * 1. **Barví se podle napětí rozpočtu, ne podle výše úspor.** Rok se schodkem
 *    vypadá na křivce zůstatku stejně jako rok bez něj, dokud je z čeho brát.
 *    Právě to je věc, kterou má člověk vidět dřív, než mu dojdou peníze.
 * 2. **Události jsou na ní pojmenované**, ne schované v legendě.
 *
 * Kreslí se ručně v SVG s `d3-shape`, ne v Rechartu. Recharts neumí přechod
 * barvy podle hodnoty (jen podle osy), a stuha ho potřebuje po úsecích.
 *
 * Souřadnice jsou v pevném `viewBox`, takže se stuha škáluje s šířkou a nemusí
 * se přeměřovat po každé změně okna. Šířka se tím nemění, jen se přepočte
 * poměr stran; text uvnitř SVG proto má velikosti odvozené od `viewBox`,
 * ne od rem.
 */

/**
 * Rozměry `viewBox` se řídí skutečnou šířkou, takže **jedna jednotka je vždy
 * jeden pixel**.
 *
 * Dřív tu stálo pevných 700×250 a SVG se škálovalo na šířku rodiče. Na
 * desktopu vyšla jednotka na 1,26 px, na mobilu na 0,5 px, takže text psaný
 * na 11 jednotek se vykreslil jednou jako 14 px a podruhé jako 5 px. Popisky
 * událostí i částky byly na telefonu nečitelné a graf sám jen 125 px vysoký.
 *
 * Škálovat text zpětně (`fontSize / scale`) by šlo, ale musely by se tak
 * ošetřit i tloušťky čar, poloměry puntíků, výšky pilulek a všechny odsazení,
 * tedy skoro každé číslo v souboru. Přepočítat viewBox je jednodušší i
 * poctivější: velikosti pak znamenají to, co je v nich napsané.
 */
const MIN_W = 300;
const MAX_W = 900;
/** Poměr stran. Na mobilu by z něj byl proužek, proto spodní mez výšky. */
const RATIO = 0.36;
const MIN_H = 200;
const MAX_H = 260;

const PAD = { top: 34, right: 16, bottom: 30, left: 16 };

/**
 * Barva podle spojité míry napětí (`journey.severity`), ne podle tří stavů.
 *
 * Dřív měla stuha tři ploché barvy a mezi nimi skoro ostrou hranu: dva roky
 * stejná zelená, pak zlom a jantarová. Rozpočet se ale takhle nechová.
 * Zajímavé na časové ose je právě to, kde se to začíná zhoršovat a kde se to
 * zase zvedá, a to jde vidět jen na plynulém přechodu.
 *
 * Míchá `color-mix` v prostoru oklab, ne ručně počítané RGB: barvy jsou
 * v CSS proměnných a mají jinou hodnotu ve světlém a tmavém režimu, takže
 * jakýkoli výpočet v JS by si je musel číst z `getComputedStyle` a znovu
 * přepočítávat při přepnutí motivu. V oklab proto, že přechod přes žlutou
 * nezešediví jako v sRGB.
 *
 * Kotvy jsou tytéž prahy, podle kterých se počítá `tension`: 0 klid,
 * 0,5 začátek napětí, 1 hluboký schodek. Zelená se navíc drží déle
 * (kvadratické náběhy), aby se plán, který má rezervu, nebarvil doržava
 * jen proto, že se blíží k prahu.
 */
function severityColor(severity: number): string {
  const s = Math.min(1, Math.max(0, severity));
  if (s <= 0.5) {
    const u = Math.round(Math.pow(s / 0.5, 2) * 100);
    return u <= 0
      ? 'var(--ribbon-calm)'
      : `color-mix(in oklab, var(--ribbon-tense) ${u}%, var(--ribbon-calm))`;
  }
  const u = Math.round(Math.pow((s - 0.5) / 0.5, 0.8) * 100);
  return u <= 0
    ? 'var(--ribbon-tense)'
    : `color-mix(in oklab, var(--ribbon-deficit) ${u}%, var(--ribbon-tense))`;
}

interface Props {
  data: Journey;
  /** Vypne vstupní animaci. Používá se v tisku a při druhém zobrazení. */
  animate?: boolean;
  /**
   * Posun události v čase. Dostane ho jen událost, která je opravdu volný
   * parametr; ostatní se z něčeho odvozují a táhnout jimi by lhalo.
   *
   * Koupě a dítě jsou obojí otázka „kdy", takže obojí jde chytit. Konec
   * rodičovské plyne z délky volna, což je zadaný údaj, ne úvaha nad grafem,
   * a doplacení hypotéky je koupě plus splatnost.
   */
  onMoveChild?: (month: number) => void;
  /** Mez posunu dítěte v měsících. */
  childRange?: { min: number; max: number };
  /**
   * Posun koupě. Doleva jen k měsíci, kdy je na akontaci naspořeno: dřív
   * koupit nejde, protože není z čeho.
   */
  onMovePurchase?: (month: number) => void;
  purchaseRange?: { min: number; max: number };
  /**
   * Původní scénář jako přerušovaný obrys pod živou stuhou.
   *
   * Bez něj nejde poznat, jestli si uživatel posuvníkem pomohl. Sám o sobě
   * vypadá každý scénář rozumně; teprve proti čemu se rozdíl ukáže.
   */
  ghost?: Journey;
  /**
   * Kolik měsíců z cesty ukázat. Bez něj celý horizont.
   *
   * Je to **výřez, ne jiný výpočet**. Osa se počítá pořád celá, jen se
   * kreslí její začátek; verdikt i karta nejtěsnějšího místa proto dál mluví
   * o celém plánu a nemůžou si s obrázkem odporovat. Když nejnižší bod padne
   * mimo výřez, jeho popisek se prostě nekreslí, protože by ukazoval mimo
   * plochu.
   */
  viewMonths?: number;
}

export default function JourneyRibbon({
  data,
  animate = true,
  onMoveChild,
  childRange = { min: 0, max: 96 },
  onMovePurchase,
  purchaseRange = { min: 0, max: 120 },
  ghost,
  viewMonths,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const horizonMonths = Math.max(12, Math.min(viewMonths ?? data.horizonMonths, data.horizonMonths));
  const full = horizonMonths === data.horizonMonths;
  const inView = useMemo(() => {
    const pts = data.points.filter((p) => p.month <= horizonMonths);
    return {
      points: pts,
      tension: data.tension.slice(0, pts.length),
      severity: data.severity.slice(0, pts.length),
      events: data.events.filter((e) => e.month <= horizonMonths),
      ghostPoints: ghost?.points.filter((p) => p.month <= horizonMonths) ?? null,
    };
  }, [data, horizonMonths, ghost]);
  const { points, tension, severity, events } = inView;
  const svgRef = useRef<SVGSVGElement>(null);

  // Skutečná šířka v pixelech. Z ní je `viewBox`, takže se nic nepřeškáluje
  // a rozměry uvnitř znamenají pixely.
  const [W, setW] = useState(700);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setW(Math.round(Math.min(MAX_W, Math.max(MIN_W, w))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(MAX_H, Math.max(MIN_H, W * RATIO)));
  // 23, ne 22: přesný průměr 44 se zaokrouhlením rozměru elementu srazí těsně
  // pod hranici (naměřeno 43,996 px). Pár desetin navíc to drží nad ní.
  const hitRadius = 23;

  // Bod, na který uživatel ukazuje. Kreslí se u něj vodicí linka a částka.
  const [hover, setHover] = useState<number | null>(null);

  /**
   * Vstupní animace patří k prvnímu zobrazení, ne ke každé změně.
   *
   * Události se kreslí v pořadí podle měsíce. Když se koupě posune za dítě,
   * React uzly přeskládá, a přesun uzlu v DOM spustí CSS animaci znovu:
   * popisek na celou vteřinu zmizí, protože `backwards` drží počáteční stav
   * po dobu zpoždění. Uprostřed tažení to vypadá, že událost zmizela.
   *
   * Po odeznění úvodu se proto animace vypne inline (stejně, jako to dělá
   * pravidlo pro vypnutý pohyb a pro tisk), a hned při prvním doteku úchopu:
   * kdo už s grafem pracuje, nemá co dodívat.
   */
  const [intro, setIntro] = useState(animate);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 2500);
    return () => clearTimeout(t);
  }, [intro]);
  const eventStyle = (delay: number) =>
    intro ? { animationDelay: `${delay}s` } : { animation: 'none' };

  /** Měsíc pod kurzorem. Počítá se z pozice v SVG, ne z pozice v okně. */
  const monthAt = useCallback((clientX: number) => {
    const el = svgRef.current;
    if (!el) return 0;
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    const t = (x - PAD.left) / (W - PAD.left - PAD.right);
    return Math.round(Math.min(1, Math.max(0, t)) * horizonMonths);
  }, [horizonMonths, W]);

  /**
   * Co se dá s kterou událostí dělat. Dřív to bylo natvrdo dítě; jakmile
   * přibyla druhá pohyblivá událost, musí si posun, mez i popisek nést
   * každá sama, jinak by tažení za koupi posouvalo dítě.
   */
  const movers = useMemo(() => {
    const m: Partial<Record<string, {
      move: (month: number) => void;
      range: { min: number; max: number };
      label: string;
      text: (month: number) => string;
    }>> = {};
    if (onMoveChild) {
      m.child = {
        move: onMoveChild,
        range: childRange,
        label: 'Za jak dlouho čekáte dítě',
        text: (month) => `za ${formatMonths(month)}`,
      };
    }
    if (onMovePurchase) {
      m.purchase = {
        move: onMovePurchase,
        range: purchaseRange,
        label: 'Za jak dlouho chcete koupit',
        // Nula je „hned teď", ne „za 0 měsíců": u koupě je to ta
        // nejčastější odpověď a zní jinak než všechny ostatní.
        text: (month) => (month <= 0 ? 'hned teď' : `za ${formatMonths(month)}`),
      };
    }
    return m;
  }, [onMoveChild, childRange, onMovePurchase, purchaseRange]);

  const clampTo = (m: number, range: { min: number; max: number }) =>
    Math.min(range.max, Math.max(range.min, m));

  const geom = useMemo(() => {
    const xs = (m: number) => PAD.left + (m / horizonMonths) * (W - PAD.left - PAD.right);

    // Osa Y se vztahuje k rozsahu dat, ale nula je vždy uvnitř: bez ní by
    // propad pod nulu vypadal jako mírný pokles.
    const values = inView.ghostPoints
      ? [...points.map((p) => p.cash), ...inView.ghostPoints.map((p) => p.cash)]
      : points.map((p) => p.cash);
    const hi = Math.max(...values, 0);
    const lo = Math.min(...values, 0);
    const span = hi - lo || 1;
    const ys = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

    const path = line<{ month: number; cash: number }>()
      .x((p) => xs(p.month))
      .y((p) => ys(p.cash))
      .curve(curveMonotoneX)(points) ?? '';

    const fill = area<{ month: number; cash: number }>()
      .x((p) => xs(p.month))
      .y0(ys(lo))
      .y1((p) => ys(p.cash))
      .curve(curveMonotoneX)(points) ?? '';

    // Zastávky gradientu: jedna na každý navzorkovaný bod, obarvená podle
    // toho, jak moc to v tu chvíli skřípe. SVG mezi nimi dopočítá zbytek,
    // takže přechod je plynulý a přitom se drží dat.
    //
    // Nevzorkuje se každý měsíc: na horizontu do důchodu je to přes čtyři
    // sta zastávek, které na osmi stech pixelech stejně nikdo nerozliší.
    // Zlomy (koupě, narození, schodek) se ale ztratit nesmí, takže se do
    // vzorku vždycky přidá i bod, kde se stav mění.
    const MAX_STOPS = 64;
    const step = Math.max(1, Math.ceil(points.length / MAX_STOPS));
    const sampled = new Set<number>([0, points.length - 1]);
    for (let i = 0; i < points.length; i += step) sampled.add(i);
    for (let i = 1; i < tension.length; i++) {
      if (tension[i] !== tension[i - 1]) { sampled.add(i - 1); sampled.add(i); }
    }
    const stops = [...sampled]
      .sort((a, b) => a - b)
      .map((i) => ({
        offset: points[i].month / horizonMonths,
        color: severityColor(severity[i] ?? 0),
      }));

    // Úseky napětí. Slouží už jen k vyznačení schodku vzorkem.
    const runs: { from: number; to: number; tension: Tension }[] = [];
    tension.forEach((t, i) => {
      const at = points[i].month / horizonMonths;
      const last = runs.at(-1);
      if (last && last.tension === t) last.to = at;
      else runs.push({ from: at, to: at, tension: t });
    });

    // Duch se kreslí ve stejné ose jako živá stuha. Vlastní měřítko by rozdíl
    // schovalo: obě křivky by vyplnily plochu stejně a vypadaly by shodně.
    const ghostPath = inView.ghostPoints
      ? line<{ month: number; cash: number }>()
        .x((p) => xs(p.month))
        .y((p) => ys(p.cash))
        .curve(curveMonotoneX)(inView.ghostPoints) ?? ''
      : null;

    // Úseky se schodkem. Kreslí se do nich vzorek, aby se stav nenesl jen
    // barvou: jantarová a červená se od sebe těžko poznají i bez poruchy
    // barvocitu (ΔE 10,7), natož v tisku.
    const deficitRanges = runs
      .filter((r) => r.tension === 'deficit')
      .map((r) => ({ from: xs(r.from * horizonMonths), to: xs(r.to * horizonMonths) }));

    return { xs, ys, path, fill, stops, lo, ghostPath, deficitRanges };
  }, [points, tension, severity, horizonMonths, inView.ghostPoints, W, H]);

  // Roky na ose. Krok se řídí tím, kolik se jich na danou šířku vejde, ne jen
  // délkou horizontu: letopočet potřebuje kolem osmatřiceti pixelů i s mezerou
  // a na telefonu je plochy třetina proti desktopu. Dokud se počítalo jen
  // z horizontu, mačkalo se osm letopočtů do tří set pixelů.
  const thisYear = new Date().getFullYear();
  const ticks = useMemo(() => {
    const usable = W - PAD.left - PAD.right;
    const fits = Math.max(2, Math.floor(usable / 38));
    const step = [12, 24, 60, 120].find((s) => horizonMonths / s + 1 <= fits) ?? 120;
    const out: number[] = [];
    for (let m = 0; m <= horizonMonths; m += step) out.push(m);
    return out;
  }, [horizonMonths, W]);

  const named = useMemo(() => events.filter((e) => e.key !== 'lowest'), [events]);

  // Vodorovné rozestrkání bublin.
  //
  // Původně se bubliny při shluku posouvaly do druhého řádku pod sebe. Nešlo
  // to: bublina je 19 vysoká, řádky se posouvaly o 18, takže u páru, který
  // kupuje a rok nato čeká dítě, na sebe pořád dosedly. Zvětšit rozestup taky
  // nejde, třetí řádek by už ležel na stuze.
  //
  // Nad stuhou je přitom místa dost do šířky. Bubliny proto zůstávají v jednom
  // řádku a odsouvají se stranou tak, aby se jejich okraje nepotkaly. Že je
  // bublina jinde než puntík, je vidět z vodicí čárky, která je spojuje.
  //
  // Šířka se odhaduje z délky textu, ne pevně: „Konec rodičovské" se do
  // osmdesáti jednotek nevejde a text z pilulky vytekl na obě strany.
  const bubbles = useMemo(() => {
    // Odhad šířky písmene v `viewBox` jednotkách při fontSize 11 a tučném řezu.
    //
    // Spodní mez byla 42, tedy pilulka 84 široká i pro slovo „Dítě". Na
    // desetiletém horizontu to nevadilo, na horizontu do důchodu ano: události
    // se mačkají v prvních letech a každá zbytečná jednotka šířky odstrčí
    // bublinu dál od jejího puntíku. Dvacet je čtyřznakové slovo s okraji.
    const half = (label: string) => Math.max(20, label.length * 3.2 + 10);
    const min = PAD.left;
    const max = W - PAD.right;
    const hs = named.map((e) => half(e.label));
    const xs = named.map((e, i) => Math.min(Math.max(geom.xs(e.month), min + hs[i]), max - hs[i]));
    // Zleva doprava odsuň každou bublinu za okraj té předchozí…
    for (let i = 1; i < xs.length; i++) {
      xs[i] = Math.max(xs[i], xs[i - 1] + hs[i - 1] + hs[i] + 6);
    }
    // …a když poslední vyjede z plochy, vrať je stejnou cestou zpět.
    for (let i = xs.length - 1; i >= 0; i--) {
      const limit = i === xs.length - 1
        ? max - hs[i]
        : xs[i + 1] - hs[i + 1] - hs[i] - 6;
      xs[i] = Math.max(min + hs[i], Math.min(xs[i], limit));
    }
    return xs.map((x, i) => ({ x, half: hs[i] }));
  }, [named, geom, W]);

  const lowest = events.find((e) => e.key === 'lowest');

  /**
   * Kam s popiskem nejnižšího bodu.
   *
   * Vypadá to jako detail, ale je to jediný text, který se kreslí doprostřed
   * plochy, takže se má o co otřít: o stuhu, o puntíky událostí, o popisky
   * roků i o okraj. Postupné záplaty („uhni od nejbližšího puntíku", „dej to
   * pod bod, když je nad ním stuha") vždycky spravily jeden scénář a rozbily
   * jiný, protože každá koukala jen na jedno místo křivky.
   *
   * Tohle prochází několik poloh a u každé změří, jak daleko je text od stuhy
   * **po celé své šířce**. Vybere se poloha s největší mezerou, při shodě ta
   * blíž k bodu. Vodicí čárka pak řekne, ke kterému bodu popisek patří.
   */
  const lowestLabel = useMemo(() => {
    if (!lowest) return null;
    const x = geom.xs(lowest.month);
    const y = geom.ys(data.minCash);
    const halfText = lowest.label.length * 2.7 + 6;
    const min = PAD.left + halfText;
    const max = W - PAD.right - halfText;
    const home = Math.min(Math.max(x, min), max);

    // Zakázané polohy středu textu: jedna kolem každého puntíku události.
    // Uhnout jen od nejbližšího nestačilo, popisek pak přistál na dalším.
    const blocked = named.map((e) => {
      const ex = geom.xs(e.month);
      return [ex - 18 - halfText, ex + 18 + halfText] as const;
    });
    const free = (t: number) => t >= min && t <= max && !blocked.some(([a, b]) => t > a && t < b);
    const spots = [home, ...blocked.flat()].filter(free);
    if (spots.length === 0) spots.push(home);

    // Nejmenší svislá mezera mezi textem a stuhou přes celou šířku textu.
    // Jeden vzorek uprostřed nestačí: u strmého úseku se stuha přes šířku
    // popisku posune o desítky jednotek a mezera změřená ve středu lže.
    const gapTo = (t: number, ty: number) => {
      let worst = Infinity;
      for (let px = t - halfText; px <= t + halfText; px += 6) {
        const m = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * horizonMonths);
        const ry = geom.ys(points[Math.min(Math.max(m, 0), points.length - 1)].cash);
        // Text sedí zhruba v ty-8 až ty+2, stuha je 9 široká, tedy ry±4,5.
        worst = Math.min(worst, ty > ry ? (ty - 8) - (ry + 4.5) : (ry - 4.5) - (ty + 2));
      }
      return worst;
    };

    const below = Math.min(y + 20, H - PAD.bottom + 2);
    const above = Math.max(y - 14, PAD.top + 4);
    const candidates = spots
      .flatMap((t) => [below, above].map((ty) => ({ tx: t, ty, gap: gapTo(t, ty) })));

    // Nekolidovat je podmínka, být u svého bodu je cíl. Dokud se vybíralo
    // podle největší mezery, vyhrálo prostě nejprázdnější místo grafu:
    // na horizontu do důchodu se všechny události mačkají v prvních letech,
    // takže jediná volná poloha vyšla o půl grafu dál a od popisku vedla
    // tečkovaná čára přes celou šířku. Šest jednotek je mezera, ve které
    // se text stuhy nedotkne; z těch, co ji mají, vyhrává nejbližší.
    const roomy = candidates.filter((c) => c.gap >= 6);
    const best = (roomy.length ? roomy : candidates)
      .sort((a, b) => (
        roomy.length
          ? Math.abs(a.tx - x) - Math.abs(b.tx - x) || b.gap - a.gap
          : b.gap - a.gap || Math.abs(a.tx - x) - Math.abs(b.tx - x)
      ))[0];

    return {
      x,
      y,
      tx: best.tx,
      ty: best.ty,
      // Konec vodicí čárky u bližší hrany textu, ne uprostřed něj: jinak
      // čárka končí pod písmeny a vypadá jako přeškrtnutí.
      edge: best.tx > x ? best.tx - halfText : best.tx + halfText,
      shifted: Math.abs(best.tx - x) > 2,
    };
  }, [lowest, geom, data.minCash, named, points, horizonMonths, W, H]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block touch-pan-y"
      role="img"
      aria-label={
        `Vývoj úspor na ${Math.round(horizonMonths / 12)} let`
        + (full ? '. ' : ` z celkových ${Math.round(data.horizonMonths / 12)}. `)
        + named.map((e) => `${e.label} za ${Math.round(e.month / 12)} let`).join(', ')
        + `. Nejníže ${czk(Math.max(0, data.minCash))}.`
      }
    >
      <defs>
        <linearGradient id={`ribbon-${uid}`} x1="0" y1="0" x2="1" y2="0">
          {geom.stops.map((s, i) => (
            <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
          ))}
        </linearGradient>
        {/* Ořez na schodkové úseky. Přes ně se překreslí stuha přerušovaně,
            takže v nich vzniknou zářezy. Vzorek nese informaci sám o sobě,
            i černobíle. */}
        <clipPath id={`deficit-${uid}`}>
          {geom.deficitRanges.map((r, i) => (
            <rect key={i} x={r.from} y={0} width={Math.max(0, r.to - r.from)} height={H} />
          ))}
        </clipPath>
        <linearGradient id={`under-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Osa času */}
      <line
        x1={PAD.left} x2={W - PAD.right}
        y1={H - PAD.bottom + 8} y2={H - PAD.bottom + 8}
        stroke="var(--line-strong)" strokeWidth="1"
      />
      {ticks.map((m) => (
        <text
          key={m}
          x={geom.xs(m)} y={H - PAD.bottom + 24}
          textAnchor="middle" fontSize="11" fill="var(--ink-muted)"
          pointerEvents="none"
        >
          {thisYear + m / 12}
        </text>
      ))}

      <path d={geom.fill} fill={`url(#under-${uid})`} />

      {/* Duch původního scénáře. Kreslí se pod živou stuhou a bez barvy stavu:
          je to referenční tvar, ne druhé sdělení. */}
      {geom.ghostPath && (
        <path
          d={geom.ghostPath}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="8 8"
        />
      )}

      {/* Nula jen tehdy, když se pod ni opravdu klesá. Jinak je to čára,
          která nic neříká, a jen přidává hluk. */}
      {geom.lo < 0 && (
        <line
          x1={PAD.left} x2={W - PAD.right}
          y1={geom.ys(0)} y2={geom.ys(0)}
          stroke="var(--danger)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
        />
      )}

      <path
        d={geom.path}
        fill="none"
        stroke={`url(#ribbon-${uid})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        /* Normalizovaná délka dráhy: `stroke-dasharray: 1` v CSS pak znamená
           „celá stuha", ať měří cokoli. Bez toho byla v CSS pevná trojtisícovka
           proti dráze dlouhé sedm set, takže se stuha dokreslila za desetinu
           doby animace a zbytek se čekalo. */
        pathLength={1}
        className={animate ? 'ribbon-draw' : undefined}
      />

      {/* Zářezy ve schodkovém úseku. Kreslí se barvou plochy, takže do stuhy
          „ukusují" a vzniká pruhovaný úsek.

          Vlastní třída, ne `ribbon-draw`: ta nastavuje `stroke-dasharray`
          v CSS a přebila by vzorek. Vysvětlení je u `.ribbon-hatch`. */}
      {geom.deficitRanges.length > 0 && (
        <path
          d={geom.path}
          fill="none"
          stroke="var(--sunken)"
          strokeWidth="9"
          strokeDasharray="2 6"
          clipPath={`url(#deficit-${uid})`}
          className={animate ? 'ribbon-hatch' : undefined}
        />
      )}

      {/* Průhledná plocha, která chytá pohyb kurzoru. Kdyby se poslouchalo
          přímo na stuze, musel by uživatel trefit devět pixelů široký pruh. */}
      <rect
        x={PAD.left} y={PAD.top - 10}
        width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom + 20}
        fill="transparent"
        className="no-print"
        onPointerMove={(e) => setHover(monthAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
      />

      {/* Události: puntík na stuze, vodicí linka nahoru a bublina s názvem.
          Bubliny jsou v jednom řádku a u blízkých událostí se rozestrkají
          do stran. */}
      {named.map((e, i) => {
        const x = geom.xs(e.month);
        const { x: bx, half: bw } = bubbles[i];
        const y = geom.ys(points[Math.min(e.month, points.length - 1)].cash);
        const labelY = 14;
        const mover = movers[e.key];
        return (
          <g key={e.key} className={animate ? 'ribbon-event' : undefined} style={eventStyle(1.0 + i * 0.08)}>
            {/* Vodicí čára jako loket, ne jedna dlouhá úhlopříčka.
                Svislý úsek vyrůstá přímo z puntíku, takže je vidět, ke které
                události popisek patří; teprve nad ním se odbočí k bublině.
                Samotná úhlopříčka od puntíku u levého okraje k bublině o dvě
                stě jednotek dál neukazovala na nic. */}
            {/* Bublina, čára i text jsou popisek. Kdyby braly pointer
                události, přebily by úchop sousední události, který pod nimi
                leží; `<text>` je na to nejhorší, chytá celou svou šířku. */}
            <g pointerEvents="none">
              <path
                /* Rameno leží pod bublinou, ale nikdy nad puntíkem: u události
                   na samém vrcholu křivky by čára jinak nejdřív klesla a pak
                   se vrátila nahoru. */
                d={`M ${x} ${y - 9} L ${x} ${Math.min(labelY + 20, y - 9)} L ${bx} ${labelY + 9}`}
                fill="none"
                stroke="var(--line-strong)"
                strokeWidth="1"
              />
              <rect
                x={bx - bw} y={labelY - 9} width={bw * 2} height="19" rx="9"
                fill="var(--card)" stroke="var(--line)"
              />
              <text x={bx} y={labelY + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
                {e.label}
              </text>
            </g>
            {mover && (
              <>
                {/* Přerušovaný kroužek je jediný signál „dá se s tím hýbat".
                    Dostane ho jen událost, kterou opravdu jde posunout. */}
                <circle
                  cx={x} cy={y} r="15"
                  fill="none" stroke="var(--ink-muted)" strokeWidth="1"
                  strokeDasharray="3 3" strokeOpacity="0.35"
                  className="no-print"
                />
                {/* Dotyková plocha. Poloměr se přepočítá podle skutečné šířky
                    SVG, aby cíl měl 44 px i na mobilu, kde je stuha užší.

                    Tažení běží na `pointer` událostech, takže myš i dotyk
                    jdou jednou cestou. `setPointerCapture` drží tažení i když
                    kurzor sjede mimo puntík; bez toho se přeruší, jakmile se
                    ujede o pár pixelů. */}
                <circle
                  cx={x} cy={y} r={hitRadius}
                  fill="transparent"
                  className="ribbon-grip no-print cursor-ew-resize touch-none"
                  role="slider"
                  tabIndex={0}
                  aria-label={mover.label}
                  aria-valuemin={mover.range.min}
                  aria-valuemax={mover.range.max}
                  aria-valuenow={e.month}
                  aria-valuetext={mover.text(e.month)}
                  onPointerDown={(ev) => {
                    ev.preventDefault();
                    setIntro(false);
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                  }}
                  onPointerMove={(ev) => {
                    if (!ev.currentTarget.hasPointerCapture(ev.pointerId)) return;
                    mover.move(clampTo(monthAt(ev.clientX), mover.range));
                  }}
                  onKeyDown={(ev) => {
                    const step = ev.key === 'PageUp' || ev.key === 'PageDown' ? 12 : 1;
                    const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'PageUp' ? 1
                      : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' || ev.key === 'PageDown' ? -1 : 0;
                    if (dir === 0) return;
                    ev.preventDefault();
                    setIntro(false);
                    mover.move(clampTo(e.month + dir * step, mover.range));
                  }}
                />
              </>
            )}
            {/* Obrys puntíku má tutéž barvu jako stuha pod ním. Se třemi
                plochými barvami tu vycházel jantarový kroužek nad zeleným
                úsekem, protože se stav zlomil o měsíc dřív. */}
            <circle
              cx={x} cy={y} r="7"
              fill="var(--card)"
              stroke={severityColor(data.severity[e.month] ?? 0)}
              strokeWidth="3"
              pointerEvents="none"
            />
          </g>
        );
      })}

      {/* Nejnižší bod: menší puntík a popisek pod stuhou, aby nesoupeřil
          s událostmi. Je to údaj, ne událost. */}
      {/* `pointerEvents="none"`: je to popisek, ne ovládací prvek. Bez toho
          text „nejníž 525 024 Kč" ležel přes úchop dítěte a bral mu kliknutí,
          takže se s puntíkem nedalo hýbat. Chytal ho `<text>`, který je
          neviditelně široký přes celou svou délku. */}
      {lowest && lowestLabel && (
        <g pointerEvents="none" className={animate ? 'ribbon-event' : undefined} style={eventStyle(1.0 + named.length * 0.08)}>
          {/* Když popisek uhnul stranou, spojí ho s bodem čárka. Bez ní by
              vypadal jako údaj k jinému místu na stuze. */}
          {lowestLabel.shifted && (
            <line
              x1={lowestLabel.x} x2={lowestLabel.edge}
              y1={lowestLabel.y} y2={lowestLabel.ty - 4}
              stroke="var(--danger)" strokeWidth="1" strokeOpacity="0.4"
            />
          )}
          <circle
            cx={lowestLabel.x}
            cy={lowestLabel.y}
            r="5"
            fill="var(--card)" stroke="var(--danger)" strokeWidth="2.5"
          />
          <text
            x={lowestLabel.tx} y={lowestLabel.ty}
            textAnchor="middle" fontSize="11" fill="var(--danger)"
          >
            {lowest.label}
          </text>
        </g>
      )}

      {/* Odečet pod kurzorem. Kreslí se **jako poslední**, takže leží nad
          bublinami událostí, a drží se u svého bodu na stuze místo pevného
          řádku nahoře. Dřív seděl na y = 22, což je přesně řádek bublin:
          u události se schoval za popisek „Dítě" a částka nebyla vidět.
          Pilulka pod textem ho oddělí i od stuhy a od výplně pod ní. */}
      {hover !== null && points[hover] && (() => {
        const hx = geom.xs(hover);
        const hy = geom.ys(points[hover].cash);
        const text = `${czk(points[hover].cash)} · ${formatMonths(hover)}`;
        const half = text.length * 2.9 + 9;
        const tx = Math.min(Math.max(hx, PAD.left + half), W - PAD.right - half);
        // Nad bodem, pokud se tam vejde pod řádek bublin; jinak pod něj.
        const above = hy - 18;
        const ty = above > PAD.top + 4 ? above : Math.min(hy + 26, H - PAD.bottom + 2);
        return (
          <g pointerEvents="none" className="no-print">
            <line
              x1={hx} x2={hx}
              y1={PAD.top - 6} y2={H - PAD.bottom + 8}
              stroke="var(--line-strong)" strokeWidth="1"
            />
            <circle cx={hx} cy={hy} r="4" fill="var(--ink)" />
            <rect
              x={tx - half} y={ty - 10} width={half * 2} height="15" rx="7.5"
              fill="var(--card)" stroke="var(--line)"
            />
            <text
              x={tx} y={ty + 1}
              textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)"
            >
              {text}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
