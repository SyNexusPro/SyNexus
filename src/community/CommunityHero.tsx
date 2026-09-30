import type { ReactNode } from "react";

const FEATURES: { label: string; icon: ReactNode }[] = [
  {
    label: "Real conversations",
    icon: <path d="M4 5h16v10H9l-5 4V5z" />,
  },
  {
    label: "Latest crypto news",
    icon: <path d="M5 4h11l3 3v13H5V4zm3 5h8M8 13h8M8 17h5" />,
  },
  {
    label: "Learn together",
    icon: <path d="M2 9l10-5 10 5-10 5L2 9zm4 2.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />,
  },
  {
    label: "A global community",
    icon: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zm7 0a2.5 2.5 0 100-5M3 19c0-3 3-5 6-5s6 2 6 5m1-5c2.5 0 5 1.5 5 4.5" />,
  },
];

export function CommunityHero({ children, compact = false }: { children?: ReactNode; compact?: boolean }) {
  return (
    <section className={`cx-hero${compact ? " cx-hero--compact" : ""}`} aria-labelledby="cx-hero-title">
      <h1 id="cx-hero-title" className="cx-hero__title">
        <span className="cx-hero__enter">Enter</span>
        <span className="cx-hero__brand">SyNexus</span>
      </h1>
      <p className="cx-hero__subtitle">The Members-Only Crypto Social Network</p>
      <p className="cx-hero__tagline">Talk crypto. Share news. Learn. Connect.</p>
      <ul className="cx-hero__features">
        {FEATURES.map((f) => (
          <li key={f.label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {f.icon}
            </svg>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
