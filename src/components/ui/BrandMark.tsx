interface Props {
  className?: string;
}

/**
 * Značka aplikace: otazník v zeleném čtverci.
 *
 * Otazník je vysazený cestou, ne textem. Textová varianta by při prvním
 * načtení blikla systémovým fontem, než dorazí Bricolage Grotesque, a značka
 * je to první, co je na stránce vidět. Cesta je glyf „?" z téhož řezu (váha
 * 700), takže vypadá stejně jako nadpisy, jen se nemusí čekat na font.
 *
 * Stejná kresba je i v `public/favicon.svg`. Když se mění jedno, patří změnit
 * i druhé.
 *
 * Domeček s rostoucí šipkou z původní značky se ruší: v modrém gradientu
 * působil bankovně a otazník sedí na to, co appka dělá, tedy na otázku
 * „mám na to?".
 */
export default function BrandMark({ className = 'w-8 h-8' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="MámNaTo?">
      <rect width="64" height="64" rx="21" className="fill-ink" />
      <path d="M 26.51 38.35 Q 26.26 35.84 26.74 34.21 Q 27.23 32.57 28.15 31.48 Q 29.07 30.39 30.17 29.62 Q 31.28 28.84 32.29 28.13 Q 33.30 27.42 33.94 26.51 Q 34.59 25.59 34.59 24.24 Q 34.59 22.39 33.41 21.51 Q 32.22 20.62 30.35 20.62 Q 29.20 20.62 27.88 20.94 Q 26.55 21.26 25.24 21.84 Q 23.93 22.42 22.73 23.23 L 22.34 16.69 Q 23.73 15.84 25.19 15.31 Q 26.65 14.78 28.18 14.51 Q 29.72 14.24 31.20 14.24 Q 33.30 14.24 35.20 14.76 Q 37.11 15.28 38.59 16.39 Q 40.08 17.49 40.95 19.20 Q 41.81 20.91 41.81 23.33 Q 41.81 25.56 41.10 27.04 Q 40.40 28.52 39.29 29.56 Q 38.18 30.59 36.95 31.43 Q 35.73 32.27 34.66 33.17 Q 33.59 34.07 32.97 35.30 Q 32.36 36.53 32.48 38.35 Z M 29.85 49.65 Q 27.45 49.65 26.26 48.62 Q 25.07 47.59 25.07 45.44 Q 25.07 43.23 26.26 42.20 Q 27.45 41.18 29.85 41.18 Q 32.30 41.18 33.51 42.20 Q 34.72 43.23 34.72 45.44 Q 34.72 49.65 29.85 49.65 Z" className="fill-page" />
    </svg>
  );
}
