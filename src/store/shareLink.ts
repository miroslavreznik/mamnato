import type { WizardState } from '../types';
import { normalizeState, saveState, loadState, setPersistenceEnabled } from './localStorage';

// Sdílení přehledu odkazem: stav se zakóduje do fragmentu URL (#s=…).
// Nic se neposílá na server, data „jedou" v adrese. Příjemce si otevře
// stejný scénář a může si ho dál upravovat ve svém prohlížeči.

const HASH_PREFIX = '#s=';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Čisté funkce (bez window), snadno testovatelné.
export function encodeStatePayload(state: WizardState): string {
  return toBase64Url(JSON.stringify(state));
}

export function decodeStatePayload(payload: string): WizardState | null {
  try {
    return normalizeState(JSON.parse(fromBase64Url(payload)));
  } catch {
    return null;
  }
}

export function buildShareUrl(state: WizardState): string {
  return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${encodeStatePayload(state)}`;
}

// Přečte sdílený stav z URL, pokud tam je a je platný.
export function readSharedState(): WizardState | null {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeStatePayload(hash.slice(HASH_PREFIX.length));
}

// Odstraní fragment z adresy bez reloadu (aby se po obnovení stránky
// nenačítal znovu a URL zůstala čistá).
export function clearShareHash(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/**
 * Jednorázový bootstrap při startu (mimo React render, takže se pod StrictMode
 * nespouští dvakrát).
 *
 * Sdílený přehled se **neukládá automaticky**. Dřív se ukládal, takže kdokoli
 * si otevřel cizí odkaz, nenávratně přišel o svůj vlastní rozpracovaný plán,
 * aniž by se ho kdokoli zeptal. Stačilo na to jedno kliknutí na odkaz.
 *
 * Teď platí: když příjemce nic uloženého nemá, není co ztratit a scénář se
 * převezme rovnou. Když něco uloženého má, sdílený přehled se jen zobrazí,
 * zápis se do potvrzení zamkne a jeho data zůstanou nedotčená.
 */
let sharedState: WizardState | null = null;
let replacesExisting = false;

export function bootstrapSharedState(): void {
  const shared = readSharedState();
  if (!shared) return;

  clearShareHash();
  sharedState = shared;

  if (loadState() === null) {
    saveState(shared);
    return;
  }

  replacesExisting = true;
  setPersistenceEnabled(false);
}

export function loadedFromShare(): boolean {
  return sharedState !== null;
}

// Sdílený přehled k zobrazení. Přednost má před uloženým stavem, dokud
// se uživatel nerozhodne.
export function sharedStateToShow(): WizardState | null {
  return sharedState;
}

// Zobrazujeme cizí přehled a uživatel má vlastní data, o která by přišel?
export function sharedReplacesExisting(): boolean {
  return replacesExisting;
}

// Uživatel sdílený přehled přijal: odemknout zápis a uložit.
export function acceptSharedState(state: WizardState): void {
  setPersistenceEnabled(true);
  saveState(state);
  replacesExisting = false;
}

// Uživatel se vrací ke svému přehledu: sdílený zahodit, zápis odemknout.
export function discardSharedState(): void {
  setPersistenceEnabled(true);
  sharedState = null;
  replacesExisting = false;
}
