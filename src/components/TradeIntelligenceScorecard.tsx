import { useMemo } from "react";
import type { Token } from "../data/tokens";
import {
  buildTradeScorecard,
  rugTone,
  scorecardTone,
  type TradeScorecard,
} from "../lib/tradeScorecard";

type Props = {
  token: Token;
  compact?: boolean;
};

function Metric({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number | string;
  tone: "good" | "mid" | "bad";
  suffix?: string;
}) {
  return (
    <div className={`trade-scorecard__metric trade-scorecard__metric--${tone}`}>
      <span className="trade-scorecard__metric-label">{label}</span>
      <strong className="trade-scorecard__metric-value">
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
    </div>
  );
}

function ScorecardGrid({ card }: { card: TradeScorecard }) {
  const rugLabel =
    card.rugPullWarning === "clear"
      ? "Clear"
      : card.rugPullWarning === "watch"
        ? "Watch"
        : "Elevated";

  return (
    <div className="trade-scorecard__grid">
      <Metric label="Risk" value={card.riskScore} tone={scorecardTone(100 - card.riskScore)} />
      <Metric
        label="Whales"
        value={card.whaleActivity}
        tone={scorecardTone(100 - card.whaleActivity)}
      />
      <Metric label="Momentum" value={card.momentumScore} tone={scorecardTone(card.momentumScore)} />
      <Metric label="Liquidity" value={card.liquidityHealth} tone={scorecardTone(card.liquidityHealth)} />
      <Metric label="Rug pull" value={rugLabel} tone={rugTone(card.rugPullWarning)} />
    </div>
  );
}

export function TradeIntelligenceScorecard({ token, compact = false }: Props) {
  const card = useMemo(() => buildTradeScorecard(token), [token]);

  if (compact) {
    return (
      <div className="trade-scorecard trade-scorecard--compact" aria-label="Trade intelligence">
        <span className={`trade-scorecard__grade trade-scorecard__grade--${card.overallGrade.toLowerCase()}`}>
          {card.overallGrade}
        </span>
        <span className="trade-scorecard__compact-risk">Risk {card.riskScore}</span>
        <span className="trade-scorecard__compact-rug">{card.rugPullLabel}</span>
      </div>
    );
  }

  return (
    <section className="trade-scorecard" aria-label="Trade intelligence scorecard">
      <div className="trade-scorecard__head">
        <div>
          <p className="trade-scorecard__eyebrow">Before you trade</p>
          <h2 className="trade-scorecard__title">Trade intelligence</h2>
        </div>
        <span
          className={`trade-scorecard__grade trade-scorecard__grade--${card.overallGrade.toLowerCase()}`}
          title="Overall Sentinel grade"
        >
          {card.overallGrade}
        </span>
      </div>
      <ScorecardGrid card={card} />
      <p className="trade-scorecard__note">{card.rugPullLabel}</p>
    </section>
  );
}
