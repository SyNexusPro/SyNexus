import { TRUST_INDICATORS } from "../config/site";

type Props = {
  compact?: boolean;
  className?: string;
};

export function TrustIndicators({ compact = false, className = "" }: Props) {
  return (
    <ul
      className={`trust-indicators${compact ? " trust-indicators--compact" : ""} ${className}`.trim()}
      aria-label="Trust indicators"
    >
      {TRUST_INDICATORS.map((item) => (
        <li key={item.id} className="trust-indicators__item">
          <span className="trust-indicators__badge" aria-hidden>
            ✓
          </span>
          <div>
            <p className="trust-indicators__label">{item.label}</p>
            {!compact ? <p className="trust-indicators__detail">{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
