interface Props {
  className?: string;
}

// Značka aplikace — domeček s rostoucí šipkou (shodná s faviconem).
export default function BrandMark({ className = 'w-8 h-8' }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="MámNaTo?">
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#brand-bg)" />
      <path
        d="M32 14 L51 31.5 a1.6 1.6 0 0 1-2.15 2.35L48 33.1V47.2a2.4 2.4 0 0 1-2.4 2.4H18.4a2.4 2.4 0 0 1-2.4-2.4V33.1l-0.85 0.75A1.6 1.6 0 0 1 13 31.5Z"
        fill="#fff"
      />
      <rect x="28.4" y="38" width="7.2" height="11.6" rx="1.4" fill="url(#brand-bg)" />
      <path d="M22.5 31 L28 26.5 L32 29 L40 22" fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 22 H40 V26" fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
