import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { line, area, curveMonotoneX } from 'd3-shape';
import type { Journey, Tension } from '../../engine/journey';
import { czk, formatMonths } from '../../engine/format';

/**
 * Cesta: deset let života jako jedna stuha.
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

const W = 700;
const H = 250;
const PAD = { top: 34, right: 16, bottom: 30, left: 16 };

const TENSION_VAR: Record<Tension, string> = {
  calm: 'var(--ribbon-calm)',
  tense: 'var(--ribbon-tense)',
  deficit: 'var(--ribbon-deficit)',
};

interface Props {
  data: Journey;
  /** Vypne vstupní animaci. Používá se v tisku a při druhém zobrazení. */
  animate?: boolean;
  /**
   * Posun události v čase. Dostane ho jen událost, která je opravdu volný
   * parametr; ostatní se z něčeho odvozují a táhnout jimi by lhalo.
   *
   * Koupě nastane, jakmile je naspořeno na akontaci, takže se s ní hýbe
   * cenou nebo akontací, ne přímo. Konec rodičovské plyne z délky volna,
   * což je skutečný zadaný údaj, ne úvaha nad grafem.
   */
  onMoveChild?: (month: number) => void;
  /** Mez posunu dítěte v měsících. */
  childRange?: { min: number; max: number };
  /**
   * Původní scénář jako přerušovaný obrys pod živou stuhou.
   *
   * Bez něj nejde poznat, jestli si uživatel posuvníkem pomohl. Sám o sobě
   * vypadá každý scénář rozumně; teprve proti čemu se rozdíl ukáže.
   */
  ghost?: Journey;
}

export default function JourneyRibbon({
  data,
  animate = true,
  onMoveChild,
  childRange = { min: 0, max: 96 },
  ghost,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const { points, tension, events, horizonMonths } = data;
  const svgRef = useRef<SVGSVGElement>(null);

  // Poměr mezi jednotkami `viewBox` a skutečnými pixely. Potřebuje ho dotyková
  // plocha úchopu: pevný poloměr je na desktopu jiný počet pixelů než na
  // mobilu, kde je SVG užší, takže by pravidlo o 44px cíli splnil jen na jedné
  // šířce okna.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(w / W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 23, ne 22: přesný průměr 44 se zaokrouhlením rozměru elementu srazí těsně
  // pod hranici (naměřeno 43,996 px). Pár desetin navíc to drží nad ní.
  const hitRadius = 23 / scale;

  // Bod, na který uživatel ukazuje. Kreslí se u něj vodicí linka a částka.
  const [hover, setHover] = useState<number | null>(null);

  /** Měsíc pod kurzorem. Počítá se z pozice v SVG, ne z pozice v okně. */
  const monthAt = useCallback((clientX: number) => {
    const el = svgRef.current;
    if (!el) return 0;
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    const t = (x - PAD.left) / (W - PAD.left - PAD.right);
    return Math.round(Math.min(1, Math.max(0, t)) * horizonMonths);
  }, [horizonMonths]);

  const clampChild = useCallback(
    (m: number) => Math.min(childRange.max, Math.max(childRange.min, m)),
    [childRange.max, childRange.min]
  );

  // Tažení běží na `pointer` událostech, takže myš i dotyk jdou jednou cestou.
  // `setPointerCapture` drží tažení i když kurzor sjede mimo puntík; bez toho
  // se táhnutí přeruší, jakmile se ujede o pár pixelů.
  const startDrag = (e: React.PointerEvent) => {
    if (!onMoveChild) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const drag = (e: React.PointerEvent) => {
    if (!onMoveChild || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    onMoveChild(clampChild(monthAt(e.clientX)));
  };

  const geom = useMemo(() => {
    const xs = (m: number) => PAD.left + (m / horizonMonths) * (W - PAD.left - PAD.right);

    // Osa Y se vztahuje k rozsahu dat, ale nula je vždy uvnitř: bez ní by
    // propad pod nulu vypadal jako mírný pokles.
    const values = ghost
      ? [...points.map((p) => p.cash), ...ghost.points.map((p) => p.cash)]
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

    // Zastávky gradientu.
    //
    // Napětí se rozdělí na úseky a každý úsek dostane dvě zastávky, na svém
    // začátku a na svém konci. Bez toho by SVG plynule prolnulo první barvu
    // do poslední přes celou šířku a stuha by byla červená už roky předtím,
    // než se schodek objeví. Přechod mezi úseky se změkčí úzkým oknem,
    // aby hrana nebyla ostrá jako řez, ale pořád bylo poznat, kdy se to zlomí.
    const BLEND = 0.015;
    const runs: { from: number; to: number; tension: Tension }[] = [];
    tension.forEach((t, i) => {
      const at = points[i].month / horizonMonths;
      const last = runs.at(-1);
      if (last && last.tension === t) last.to = at;
      else runs.push({ from: at, to: at, tension: t });
    });

    const stops: { offset: number; tension: Tension }[] = [];
    runs.forEach((r, i) => {
      const from = i === 0 ? 0 : r.from + BLEND;
      const to = i === runs.length - 1 ? 1 : r.to - BLEND;
      stops.push({ offset: from, tension: r.tension });
      if (to > from) stops.push({ offset: to, tension: r.tension });
    });

    // Duch se kreslí ve stejné ose jako živá stuha. Vlastní měřítko by rozdíl
    // schovalo: obě křivky by vyplnily plochu stejně a vypadaly by shodně.
    const ghostPath = ghost
      ? line<{ month: number; cash: number }>()
        .x((p) => xs(p.month))
        .y((p) => ys(p.cash))
        .curve(curveMonotoneX)(ghost.points) ?? ''
      : null;

    // Úseky se schodkem. Kreslí se do nich vzorek, aby se stav nenesl jen
    // barvou: jantarová a červená se od sebe těžko poznají i bez poruchy
    // barvocitu (ΔE 10,7), natož v tisku.
    const deficitRanges = runs
      .filter((r) => r.tension === 'deficit')
      .map((r) => ({ from: xs(r.from * horizonMonths), to: xs(r.to * horizonMonths) }));

    return { xs, ys, path, fill, stops, lo, ghostPath, deficitRanges };
  }, [points, tension, horizonMonths, ghost]);

  // Roky na ose. U desetiletého horizontu po dvou letech, ať se popisky nelepí.
  const yearStep = horizonMonths > 60 ? 24 : 12;
  const thisYear = new Date().getFullYear();
  const ticks = [];
  for (let m = 0; m <= horizonMonths; m += yearStep) ticks.push(m);

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
    const half = (label: string) => Math.max(42, label.length * 3.2 + 10);
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
  }, [named, geom]);

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
    const best = spots
      .flatMap((t) => [below, above].map((ty) => ({ tx: t, ty, gap: gapTo(t, ty) })))
      .sort((a, b) => b.gap - a.gap || Math.abs(a.tx - x) - Math.abs(b.tx - x))[0];

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
  }, [lowest, geom, data.minCash, named, points, horizonMonths]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block touch-pan-y"
      role="img"
      aria-label={
        `Vývoj úspor na ${Math.round(horizonMonths / 12)} let. `
        + named.map((e) => `${e.label} za ${Math.round(e.month / 12)} let`).join(', ')
        + `. Nejníže ${czk(Math.max(0, data.minCash))}.`
      }
    >
      <defs>
        <linearGradient id={`ribbon-${uid}`} x1="0" y1="0" x2="1" y2="0">
          {geom.stops.map((s, i) => (
            <stop key={i} offset={`${s.offset * 100}%`} stopColor={TENSION_VAR[s.tension]} />
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

      {/* Vodicí linka a částka pod kurzorem. */}
      {hover !== null && points[hover] && (
        <g pointerEvents="none" className="no-print">
          <line
            x1={geom.xs(hover)} x2={geom.xs(hover)}
            y1={PAD.top - 6} y2={H - PAD.bottom + 8}
            stroke="var(--line-strong)" strokeWidth="1"
          />
          <circle cx={geom.xs(hover)} cy={geom.ys(points[hover].cash)} r="4" fill="var(--ink)" />
          <text
            x={Math.min(Math.max(geom.xs(hover), PAD.left + 50), W - PAD.right - 50)}
            y={PAD.top - 12}
            textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)"
          >
            {czk(points[hover].cash)} · {formatMonths(hover)}
          </text>
        </g>
      )}

      {/* Události: puntík na stuze, vodicí linka nahoru a bublina s názvem.
          Bubliny jsou v jednom řádku a u blízkých událostí se rozestrkají
          do stran. */}
      {named.map((e, i) => {
        const x = geom.xs(e.month);
        const { x: bx, half: bw } = bubbles[i];
        const y = geom.ys(points[Math.min(e.month, points.length - 1)].cash);
        const labelY = 14;
        const movable = e.key === 'child' && !!onMoveChild;
        return (
          <g key={e.key} className={animate ? 'ribbon-event' : undefined} style={{ animationDelay: `${1.2 + i * 0.12}s` }}>
            <line x1={x} x2={bx} y1={labelY + 8} y2={y - 9} stroke="var(--line-strong)" strokeWidth="1" />
            <rect
              x={bx - bw} y={labelY - 9} width={bw * 2} height="19" rx="9"
              fill="var(--card)" stroke="var(--line)"
            />
            <text x={bx} y={labelY + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
              {e.label}
            </text>
            {movable && (
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
                    SVG, aby cíl měl 44 px i na mobilu, kde je stuha užší. */}
                <circle
                  cx={x} cy={y} r={hitRadius}
                  fill="transparent"
                  className="ribbon-grip no-print cursor-ew-resize touch-none"
                  role="slider"
                  tabIndex={0}
                  aria-label="Za jak dlouho čekáte dítě"
                  aria-valuemin={childRange.min}
                  aria-valuemax={childRange.max}
                  aria-valuenow={e.month}
                  aria-valuetext={`za ${formatMonths(e.month)}`}
                  onPointerDown={startDrag}
                  onPointerMove={drag}
                  onKeyDown={(ev) => {
                    if (!onMoveChild) return;
                    const step = ev.key === 'PageUp' || ev.key === 'PageDown' ? 12 : 1;
                    const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'PageUp' ? 1
                      : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' || ev.key === 'PageDown' ? -1 : 0;
                    if (dir === 0) return;
                    ev.preventDefault();
                    onMoveChild(clampChild(e.month + dir * step));
                  }}
                />
              </>
            )}
            <circle
              cx={x} cy={y} r="7"
              fill="var(--card)"
              stroke={TENSION_VAR[data.tension[e.month] ?? 'calm']}
              strokeWidth="3"
              pointerEvents="none"
            />
          </g>
        );
      })}

      {/* Nejnižší bod: menší puntík a popisek pod stuhou, aby nesoupeřil
          s událostmi. Je to údaj, ne událost. */}
      {lowest && lowestLabel && (
        <g className={animate ? 'ribbon-event' : undefined} style={{ animationDelay: `${1.2 + named.length * 0.12}s` }}>
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
    </svg>
  );
}
