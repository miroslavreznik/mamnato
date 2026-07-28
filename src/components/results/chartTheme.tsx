import { useSyncExternalStore } from 'react';

/**
 * Sdílený vizuální základ pro všechny grafy.
 *
 * Barvy vychází z validované dataviz palety (CVD-safe, ověřeno pro light i dark
 * povrch). Dark mód je *vybraný*, vlastní odstíny pro tmavý povrch, ne pouhé
 * převrácení. Osy/mřížka/popisky se přepínají podle aktuálního motivu.
 */

// --- Detekce tmavého motivu (třída `.dark` na <html>, viz ThemeToggle) ---
function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark');
}
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export interface ChartColors {
  primary: string; // modrá, hlavní / „aktuální stav"
  positive: string; // aqua, „po koupi / růst / dobré"
  negative: string; // červená, „cíl / nájem / schodek"
  accent: string; // žlutá, doplňková série
  accent2: string; // fialová, další doplňková série
  neutral: string; // šedá, rezerva / přebytek
  grid: string; // mřížka
  axis: string; // osy a čáry baseline
  tick: string; // popisky os
  surface: string; // pozadí karty (pro mezery mezi segmenty)
  // Kategoriální paleta pro rozpad výdajů (pevné pořadí slotů).
  //
  // Osm odstínů v pevném pořadí: modrá, oranžová, akvamarín, žlutá, purpurová,
  // fialová, červená, zelená. Sloty se přiřazují podle pořadí ve stohu, nikdy
  // se necyklují. Ověřeno validátorem palety pro světlý i tmavý režim (sousední
  // dvojice, CVD i kontrast); jediné dvě varování v pásmu 6–8 kryje sekundární
  // kódování: 2px mezery mezi segmenty, popisky v legendě a tabulka s čísly.
  //
  // Dřív měly „jídlo" a „zbytné" dvě různé zelené, které při daltonismu
  // splývaly (ΔE 3,2 protan proti dopravě), a zelená zároveň v celé appce
  // znamená „v pořádku". Zelená teď patří jen skupině cílů, kam významem sedí.
  categorical: Record<string, string>;
  // Paleta pro skupiny zbytných výdajů (rozpad „za co utrácíte")
  discretionaryColors: string[];
}

const LIGHT: ChartColors = {
  primary: '#2a78d6',
  positive: '#1baf7a',
  negative: '#e34948',
  accent: '#eda100',
  accent2: '#4a3aa7',
  neutral: '#c9c8c2',
  grid: '#e6e4d8',      // line
  axis: '#d9d7ca',      // line-strong
  tick: '#6e6c63',      // ink-muted
  surface: '#fbfaf7',   // paper
  categorical: {
    housing: '#2a78d6',      // 1 modrá
    food: '#eb6834',         // 2 oranžová
    transport: '#1baf7a',    // 3 akvamarín
    insurance: '#eda100',    // 4 žlutá
    utilities: '#eda100',    // (v grafu splývá s bydlením, drženo kvůli typu)
    children: '#e87ba4',     // 5 purpurová
    other: '#4a3aa7',        // 6 fialová
    existingLoans: '#e34948',// 7 červená
    goals: '#008300',        // 8 zelená, celá skupina cílů
    surplus: '#c9c8c2',
  },
  discretionaryColors: ['#e0651b', '#7c3aed', '#0ea5b7', '#db2777'],
};

const DARK: ChartColors = {
  primary: '#3987e5',
  positive: '#199e70',
  negative: '#e66767',
  accent: '#c98500',
  accent2: '#9085e9',
  neutral: '#6b7280',
  grid: '#1f322e',      // line
  axis: '#2b4640',      // line-strong
  tick: '#93a49e',      // ink-muted
  surface: '#132320',   // card
  categorical: {
    housing: '#3987e5',
    food: '#d95926',
    transport: '#199e70',
    insurance: '#c98500',
    utilities: '#c98500',
    children: '#d55181',
    other: '#9085e9',
    existingLoans: '#e66767',
    goals: '#008300',
    surplus: '#6b7280',
  },
  discretionaryColors: ['#f97316', '#a78bfa', '#22d3ee', '#f472b6'],
};

export function useChartColors(): ChartColors {
  return useIsDark() ? DARK : LIGHT;
}

// Krátký formát Kč pro osy: 1,2 M / 300 tis / 850
export function fmtKcShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} tis`;
  return `${Math.round(n)}`;
}

export function fmtKc(n: number): string {
  return `${Math.round(n).toLocaleString('cs-CZ')} Kč`;
}

// Sdílené props pro osy a mřížku (dark-aware)
export function gridProps(c: ChartColors) {
  return { strokeDasharray: '3 3', stroke: c.grid } as const;
}
export function axisProps(c: ChartColors) {
  return {
    stroke: c.axis,
    tick: { fill: c.tick, fontSize: 12 },
    tickLine: { stroke: c.axis },
  } as const;
}
