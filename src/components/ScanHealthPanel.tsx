import { useMemo } from "react";
import type { Token } from "../data/tokens";
import { synexusRiskBandLabel } from "../data/tokens";
import {
  buildTradeScorecard,
  rugTone,
  scorecardTone,
  type RugPullLevel,
} from "../lib/tradeScorecard";

type Props = {
  token: Token;
  compact?: boolean;
};

function formatUsd(n: number | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) {
    return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function liquidityLabel(score: number): string {
  if (score >= 70) return "Strong pool depth";
  if (score >= 45) return "Moderate depth";
  return "Thin — exits may slip";
}

function HealthBar({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "good" | "mid" | "bad";
  hint?: string;
}) {
  return (
    <div className="scan-health__bar">
      <div className="scan-health__bar-head">
        <span className="scan-health__bar-label">{label}</span>
        <strong className={`scan-health__bar-score scan-health__bar-score--${tone}`}>{value}/100</strong>
      </div>
      <div className="scan-health__bar-track" aria-hidden>
        <div
          className={`scan-health__bar-fill scan-health__bar-fill--${tone}`}
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
      {hint ? <p className="scan-health__bar-hint">{hint}</p> : null}
    </div>
  );
}

function PerformanceScale({ change24hPct }: { change24hPct: number }) {
  const width = Math.min(48, Math.abs(change24hPct) * 2.8);
  const up = change24hPct >= 0;

  return (
    <div className="scan-health__perf">
      <div className="scan-health__bar-head">
        <span className="scan-health__bar-label">24h performance</span>
        <strong className={`scan-health__perf-pct${up ? " is-up" : " is-down"}`}>
          {formatPct(change24hPct)}
        </strong>
      </div>
      <div className="scan-health__perf-track" aria-hidden>
        <span className="scan-health__perf-mid" />
        <span
          className={`scan-health__perf-fill${up ? " scan-health__perf-fill--up" : " scan-health__perf-fill--down"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="scan-health__perf-axis" aria-hidden>
        <span>-50%</span>
        <span>0</span>
        <span>+50%</span>
      </div>
    </div>
  );
}

function RugBadge({ level, label }: { level: RugPullLevel; label: string }) {
  const tone = rugTone(level);
  return (
    <p className={`scan-health__rug scan-health__rug--${tone}`}>
      Rug signals · <strong>{label}</strong>
    </p>
  );
}

export function ScanHealthPanel({ token, compact = false }: Props) {
  const card = useMemo(() => buildTradeScorecard(token), [token]);
  const up = token.change24hPct >= 0;

  if (compact) {
    return (
      <div className="scan-health scan-health--compact" aria-label="Token health snapshot">
        <PerformanceScale change24hPct={token.change24hPct} />
        <HealthBar
          label="Liquidity health"
          value={card.liquidityHealth}
          tone={scorecardTone(card.liquidityHealth)}
          hint={liquidityLabel(card.liquidityHealth)}
        />
        <div className="scan-health__compact-meta">
          <span>Liq {formatUsd(token.liquidityUsd)}</span>
          <span>Vol {formatUsd(token.volume24hUsd)}</span>
          <span className={up ? "is-up" : "is-down"}>{formatPct(token.change24hPct)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-health" aria-label="Token scan health">
      <div className="scan-health__stats">
        <div className="scan-health__stat">
          <span className="scan-health__stat-label">Price</span>
          <strong>{formatUsd(token.priceUsd)}</strong>
        </div>
        <div className="scan-health__stat">
          <span className="scan-health__stat-label">24h</span>
          <strong className={up ? "is-up" : "is-down"}>{formatPct(token.change24hPct)}</strong>
        </div>
        <div className="scan-health__stat">
          <span className="scan-health__stat-label">Liquidity</span>
          <strong>{formatUsd(token.liquidityUsd)}</strong>
        </div>
        <div className="scan-health__stat">
          <span className="scan-health__stat-label">Sentinel</span>
          <strong className={`scan-health__sentinel scan-health__sentinel--${token.guardianRisk.toLowerCase()}`}>
            {synexusRiskBandLabel(token.guardianRisk)}
          </strong>
        </div>
      </div>

      <PerformanceScale change24hPct={token.change24hPct} />

      <div className="scan-health__bars">
        <HealthBar
          label="Liquidity health"
          value={card.liquidityHealth}
          tone={scorecardTone(card.liquidityHealth)}
          hint={liquidityLabel(card.liquidityHealth)}
        />
        <HealthBar
          label="Momentum"
          value={card.momentumScore}
          tone={scorecardTone(card.momentumScore)}
        />
        <HealthBar
          label="Risk exposure"
          value={card.riskScore}
          tone={scorecardTone(100 - card.riskScore)}
        />
        <HealthBar
          label="Whale concentration"
          value={card.whaleActivity}
          tone={scorecardTone(100 - card.whaleActivity)}
        />
      </div>

      <div className="scan-health__footer">
        <span className={`scan-health__grade scan-health__grade--${card.overallGrade.toLowerCase()}`}>
          Grade {card.overallGrade}
        </span>
        <RugBadge level={card.rugPullWarning} label={card.rugPullLabel} />
      </div>
    </div>
  );
}
