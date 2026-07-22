import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Token } from "../data/tokens";
import {
  buildSentinelAlertsFromTokens,
  mergeSentinelAlerts,
  type SentinelAlertItem,
} from "../lib/sentinelAlerts";

type ExtraAlert = {
  symbol: string;
  severity: "WARNING" | "DANGER";
  note: string;
};

type Props = {
  tokens: Token[];
  extraAlerts?: ExtraAlert[];
};

function severityClass(severity: SentinelAlertItem["severity"]) {
  if (severity === "DANGER") return "sentinel-alerts__item--danger";
  if (severity === "WARNING") return "sentinel-alerts__item--warning";
  return "sentinel-alerts__item--safe";
}

export function SentinelAlertsHub({ tokens, extraAlerts = [] }: Props) {
  const alerts = useMemo(() => {
    const fromTokens = buildSentinelAlertsFromTokens(tokens);
    return mergeSentinelAlerts(fromTokens, extraAlerts).slice(0, 8);
  }, [tokens, extraAlerts]);

  return (
    <section className="sentinel-alerts" aria-labelledby="sentinel-alerts-title">
      <div className="sentinel-alerts__head">
        <p className="sentinel-alerts__eyebrow">Sentinel command</p>
        <h2 className="sentinel-alerts__title" id="sentinel-alerts-title">
          Sentinel alerts
        </h2>
        <p className="sentinel-alerts__lede">
          The heart of SyNexus — live hits from Aegis, Pulse, Titan, and Cipher before you trade.
        </p>
      </div>

      {alerts.length ? (
        <ul className="sentinel-alerts__list">
          {alerts.map((alert) => (
            <li key={alert.id} className={`sentinel-alerts__item ${severityClass(alert.severity)}`}>
              <div className="sentinel-alerts__item-top">
                <span className="sentinel-alerts__lane">{alert.lane}</span>
                <span className="sentinel-alerts__severity">{alert.severity}</span>
              </div>
              <p className="sentinel-alerts__symbol">
                {alert.symbol}
                <span>{alert.title}</span>
              </p>
              <p className="sentinel-alerts__message">{alert.message}</p>
              {alert.tokenId ? (
                <Link to={`/token/${alert.tokenId}`} className="sentinel-alerts__link">
                  View token →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sentinel-alerts__empty">All quiet. Sentinels are scanning every pair.</p>
      )}
    </section>
  );
}
