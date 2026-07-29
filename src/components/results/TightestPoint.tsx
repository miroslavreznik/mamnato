import type { TightestPoint as TightestPointData } from '../../engine/journey';

/**
 * Nejtěsnější místo plánu.
 *
 * Jediná karta v celém přehledu, která je v plné barvě. Je to schválně: ze
 * všech čísel na obrazovce je tohle to jedno, které říká, kde přesně to
 * skřípe, a bez zvýraznění se ztratí mezi ostatními.
 *
 * Text i nadpis staví engine (`journey.ts`), ne tahle komponenta. Formulace
 * verdiktů patří do enginu, kde k nim jdou napsat testy.
 *
 * Když plán drží po celou dobu, karta nezmizí: „kde je plán nejblíž hraně"
 * je užitečná informace i pro toho, komu vychází. Mění se jen tón věty.
 */
export default function TightestPoint({ data, onOpen }: {
  data: TightestPointData;
  /** Přechod tam, kde se s tím dá něco udělat. */
  onOpen?: () => void;
}) {
  return (
    // V tisku se plocha zahodí a text zčerná. Prohlížeče ve výchozím nastavení
    // pozadí netisknou, takže by ze světlého textu na tmavé ploše zbyl bílý
    // text na bílém papíře, tedy prázdné místo. Rámeček nahradí plochu, aby
    // karta i na papíře zůstala tím nejdůraznějším sdělením.
    <div className="rounded-2xl bg-ink text-page p-5 print:bg-transparent print:text-ink print:border-2 print:border-ink">
      <p className="type-label opacity-70 print:opacity-100">Nejtěsnější místo</p>
      <p className="type-hero mt-1.5">{data.title}</p>
      <p className="mt-2 text-sm leading-relaxed opacity-90 print:opacity-100">{data.explanation}</p>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="no-print mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-sm font-semibold bg-page/15 hover:bg-page/25 transition-colors"
        >
          Ukázat, jak to spravit
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
