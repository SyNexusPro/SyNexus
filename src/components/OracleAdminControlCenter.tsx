import { useState } from "react";
import type { OracleSupremeDailyReport, SyntheticSentinel } from "../data/syntheticWatchers";
import type { SynexusPlan } from "../lib/tradingFees";
import type { OracleConversationContext } from "../lib/oracleSupremeConversation";
import type { SentinelLaneId, SentinelLiveIntel } from "../lib/sentinelIntel";
import { sentinelLaneIdFromSentinel } from "../lib/sentinelIntel";
import {
  pulseFormatSentinelNamesInText,
  pulseSentinelDisplayName,
} from "../lib/pulseFormatting";
import { oracleSupremeMoodLabel } from "../data/syntheticWatchers";
import { OracleSupremeChat } from "./OracleSupremeChat";
import { OracleSupremeVoiceBar } from "./OracleSupremeVoiceBar";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

type Props = {
  plan: SynexusPlan;
  briefing: string;
  dailyReport: OracleSupremeDailyReport;
  conversationContext: OracleConversationContext;
  syntheticSentinels: SyntheticSentinel[];
  sentinelLiveIntel: Record<SentinelLaneId, SentinelLiveIntel>;
  marketTokenCount: number;
  alertCount: number;
  checkoutBusy: boolean;
  onRefreshReport: () => void;
  onUpgrade: () => void;
  onSpeakingChange: (speaking: boolean) => void;
  speaking: boolean;
  compact?: boolean;
};

export function OracleAdminControlCenter({
  plan,
  briefing,
  dailyReport,
  conversationContext,
  syntheticSentinels,
  sentinelLiveIntel,
  marketTokenCount,
  alertCount,
  checkoutBusy,
  onRefreshReport,
  onUpgrade,
  onSpeakingChange,
  speaking,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const lanes = syntheticSentinels.filter((s) => !s.isOracleSupreme);
  const briefingLine = pulseFormatSentinelNamesInText(briefing);

  return (
    <section
      className={`oracle-admin${open ? " oracle-admin--open" : " oracle-admin--collapsed"}${compact ? " oracle-admin--compact" : ""}${speaking ? " oracle-admin--speaking" : ""}`}
      id="oracle-admin"
      aria-labelledby="oracle-admin-title"
    >
      <div className="oracle-admin__dock">
        <SynexusSymbolMark className="oracle-admin__dock-logo" size="chat" />
        <div className="oracle-admin__dock-copy">
          <p className="oracle-admin__dock-title" id="oracle-admin-title">
            Oracle Admin
          </p>
          <p className="oracle-admin__dock-meta">
            {alertCount} alert{alertCount === 1 ? "" : "s"} · {marketTokenCount} pairs ·{" "}
            {plan === "PRO" ? "Pro" : "Free"}
          </p>
        </div>
        <button
          type="button"
          className="oracle-admin__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="oracle-admin-panel"
        >
          {open ? "Close" : "Open Oracle"}
        </button>
      </div>

      {open ? (
        <div className="oracle-admin__panel" id="oracle-admin-panel">
          <div className="oracle-admin__head">
            <SynexusSymbolMark className="oracle-admin__logo" size="panel" />
            <div>
              <p className="oracle-admin__eyebrow">Command center</p>
              <h2 className="oracle-admin__title">Oracle Supreme</h2>
              <p className="oracle-admin__lede">
                Aegis, Pulse, Titan, and Cipher — your private operator console.
              </p>
            </div>
          </div>

          <div className="oracle-admin__metrics" aria-label="Oracle system status">
            <span>{marketTokenCount} pairs tracked</span>
            <span>{alertCount} active alerts</span>
            <span>{plan === "PRO" ? "Pro · online" : "Pro · standby"}</span>
          </div>

          <div className="oracle-admin__lanes" aria-label="Sentinel lanes">
            {lanes.map((sentinel) => {
              const laneId = sentinelLaneIdFromSentinel(sentinel.id);
              const intel = laneId ? sentinelLiveIntel[laneId] : null;
              return (
                <article
                  key={sentinel.id}
                  className={`oracle-admin__lane oracle-admin__lane--${sentinel.accent}${intel?.hits ? " is-active" : ""}`}
                >
                  <p className="oracle-admin__lane-name">{pulseSentinelDisplayName(sentinel.name)}</p>
                  <p className="oracle-admin__lane-status">{intel?.liveStatus ?? sentinel.status}</p>
                  {intel?.focusSymbol ? (
                    <p className="oracle-admin__lane-focus">Focus: {intel.focusSymbol}</p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <OracleSupremeChat
            context={conversationContext}
            variant="inline"
            onSpeakingChange={onSpeakingChange}
          />

          <OracleSupremeVoiceBar
            plan={plan}
            briefing={briefingLine}
            report={plan === "PRO" ? dailyReport : undefined}
            onSpeakingChange={onSpeakingChange}
          />

          {plan === "PRO" ? (
            <div className="oracle-admin__report">
              <p className="oracle-admin__report-label">Private briefing</p>
              <div className="oracle-admin__report-metrics">
                <span>Stress: {oracleSupremeMoodLabel(dailyReport.mood)}</span>
                <span>Team: {dailyReport.systemHealth}%</span>
                <span>Grade: {dailyReport.oversightGrade}</span>
              </div>
              <h3>{dailyReport.headline}</h3>
              <p>{dailyReport.daySummary}</p>
              {!compact ? (
                <>
                  <p className="oracle-admin__priorities-label">Oracle priorities</p>
                  <ul>
                    {dailyReport.priorities.map((priority) => (
                      <li key={priority}>{pulseFormatSentinelNamesInText(priority)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <button type="button" className="oracle-admin__refresh" onClick={onRefreshReport}>
                Refresh briefing
              </button>
            </div>
          ) : (
            <div className="oracle-admin__unlock">
              <p>Unlock Oracle Admin briefings with Synexus Pro — $19.99/month.</p>
              <button type="button" disabled={checkoutBusy} onClick={onUpgrade}>
                {checkoutBusy ? "Opening checkout…" : "Subscribe · unlock Oracle"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
