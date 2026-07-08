import { useSyncExternalStore } from 'react';

/**
 * Sdílený vizuální základ pro všechny grafy.
 *
 * Barvy vychází z validované dataviz palety (CVD-safe, ověřeno pro light i dark
 * povrch). Dark mód je *vybraný* — vlastní odstíny pro tmavý povrch, ne pouhé
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
  primary: string; // modrá — hlavní / „aktuální stav"
  positive: string; // aqua — „po koupi / růst / dobré"
  negative: string; // červená — „cíl / nájem / schodek"
  accent: string; // žlutá — doplňková série
  accent2: string; // fialová — další doplňková série
  neutral: string; // šedá — rezerva / přebytek
  grid: string; // mřížka
  axis: string; // osy a čáry baseline
  tick: string; // popisky os
  surface: string; // pozadí karty (pro mezery mezi segmenty)
  // Kategoriální paleta pro rozpad výdajů (pevné pořadí slotů)
  categorical: Record<string, string>;
  // Paleta pro jednotlivé cíle (důchod, dítě, vlastní…) — odlišná od výdajů
  goalColors: string[];
}

const LIGHT: ChartColors = {
  primary: '#2a78d6',
  positive: '#1baf7a',
  negative: '#e34948',
  accent: '#eda100',
  accent2: '#4a3aa7',
  neutral: '#c9c8c2',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  tick: '#898781',
  surface: '#ffffff',
  categorical: {
    housing: '#2a78d6',
    utilities: '#eda100',
    food: '#1baf7a',
    transport: '#eb6834',
    insurance: '#4a3aa7',
    existingLoans: '#e34948',
    children: '#e87ba4',
    other: '#008300',
    goals: '#4f46e5',
    surplus: '#c9c8c2',
  },
  goalColors: ['#4f46e5', '#0891b2', '#c026d3', '#0d9488', '#7c3aed'],
};

const DARK: ChartColors = {
  primary: '#3987e5',
  positive: '#199e70',
  negative: '#e66767',
  accent: '#c98500',
  accent2: '#9085e9',
  neutral: '#6b7280',
  grid: '#2c2c2a',
  axis: '#383835',
  tick: '#a3a29c',
  surface: '#1f2937', // tailwind gray-800 (pozadí karty v dark)
  categorical: {
    housing: '#3987e5',
    utilities: '#c98500',
    food: '#199e70',
    transport: '#d95926',
    insurance: '#9085e9',
    existingLoans: '#e66767',
    children: '#d55181',
    other: '#008300',
    goals: '#818cf8',
    surplus: '#6b7280',
  },
  goalColors: ['#818cf8', '#22d3ee', '#e879f9', '#2dd4bf', '#a78bfa'],
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
