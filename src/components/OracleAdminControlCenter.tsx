import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { OracleSupremeDailyReport, SyntheticSentinel } from "../data/syntheticWatchers";
import type { SynexusPlan } from "../lib/tradingFees";
import type { SentinelLaneId, SentinelLiveIntel } from "../lib/sentinelIntel";
import { sentinelLaneIdFromSentinel } from "../lib/sentinelIntel";
import {
  pulseFormatSentinelNamesInText,
  pulseSentinelDisplayName,
} from "../lib/pulseFormatting";
import { oracleSupremeMoodLabel } from "../data/syntheticWatchers";
import { SYNEXUS_PRO_PRICE_LABEL } from "../config/proPricing";
import { SYNEXUS_PRO_TRIAL_DAYS } from "../config/proTrial";
import {
  ORACLE_OPEN_LOGIN_EVENT,
  consumeTitanGateOpenIntent,
  hasTitanGateOpenIntent,
  scrollTitanGateIntoView,
} from "../lib/openOracleLogin";
import { OracleSupremeVoiceBar } from "./OracleSupremeVoiceBar";
import { ProDemoButton } from "./ProDemoButton";
import { SynexusSymbolMark } from "./SynexusSymbolMark";
import { TitanBotRename } from "./TitanBotRename";
import { useTitanBotName } from "../hooks/useTitanBotName";

type Props = {
  plan: SynexusPlan;
  briefing: string;
  dailyReport: OracleSupremeDailyReport;
  syntheticSentinels: SyntheticSentinel[];
  sentinelLiveIntel: Record<SentinelLaneId, SentinelLiveIntel>;
  marketTokenCount: number;
  alertCount: number;
  checkoutBusy: boolean;
  loggedIn: boolean;
  authPanel?: ReactNode;
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
  syntheticSentinels,
  sentinelLiveIntel,
  marketTokenCount,
  alertCount,
  checkoutBusy,
  loggedIn,
  authPanel,
  onRefreshReport,
  onUpgrade,
  onSpeakingChange,
  speaking,
  compact = false,
}: Props) {
  const location = useLocation();
  const { name: titanBotName } = useTitanBotName();
  const [open, setOpen] = useState(
    () => window.location.hash === "#oracle-admin" || hasTitanGateOpenIntent(),
  );
  const lanes = syntheticSentinels.filter((s) => !s.isOracleSupreme);
  const briefingLine = pulseFormatSentinelNamesInText(briefing);

  useEffect(() => {
    if (location.hash === "#oracle-admin") {
      setOpen(true);
      scrollTitanGateIntoView();
      return;
    }
    if (consumeTitanGateOpenIntent()) {
      setOpen(true);
      window.location.hash = "#oracle-admin";
      scrollTitanGateIntoView();
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    function openFromEvent() {
      setOpen(true);
      window.location.hash = "#oracle-admin";
      scrollTitanGateIntoView();
    }
    window.addEventListener(ORACLE_OPEN_LOGIN_EVENT, openFromEvent);
    return () => window.removeEventListener(ORACLE_OPEN_LOGIN_EVENT, openFromEvent);
  }, []);

  useEffect(() => {
    function onHashChange() {
      if (window.location.hash === "#oracle-admin") {
        setOpen(true);
        scrollTitanGateIntoView();
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const toggleLabel = !loggedIn ? `Enter ${titanBotName}` : open ? "Close" : `Open ${titanBotName}`;
  const dockMeta = !loggedIn
    ? `${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial after sign-up · no card required`
    : `${alertCount} alert${alertCount === 1 ? "" : "s"} · ${marketTokenCount} pairs · Tap the orb to talk to ${titanBotName}`;

  return (
    <section
      className={`oracle-admin${open ? " oracle-admin--open" : " oracle-admin--collapsed"}${compact ? " oracle-admin--compact" : ""}${speaking ? " oracle-admin--speaking" : ""}${!loggedIn ? " oracle-admin--gate" : ""}`}
      id="oracle-admin"
      aria-labelledby="oracle-admin-title"
    >
      <div className="oracle-admin__dock">
        <SynexusSymbolMark className="oracle-admin__dock-logo oracle-admin__dock-logo--pulse" size="chat" />
        <div className="oracle-admin__dock-copy">
          <p className="oracle-admin__dock-title" id="oracle-admin-title">
            {loggedIn ? titanBotName : titanBotName}
          </p>
          <p className="oracle-admin__dock-meta">{dockMeta}</p>
        </div>
        <button
          type="button"
          className={`oracle-admin__toggle${!loggedIn ? " oracle-admin__toggle--gate" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="oracle-admin-panel"
        >
          {toggleLabel}
        </button>
      </div>

      {open ? (
        <div className="oracle-admin__panel" id="oracle-admin-panel">
          {!loggedIn ? (
            <div className="oracle-admin__gate">
              <div className="oracle-admin__gate-aura" aria-hidden />
              <header className="oracle-admin__gate-head">
                <SynexusSymbolMark className="oracle-admin__gate-logo" size="panel" />
                <div>
                  <p className="oracle-admin__eyebrow">Access gate · {titanBotName}</p>
                  <h2 className="oracle-admin__title">Link your operator ID</h2>
                  <p className="oracle-admin__lede">
                    Sign up free to enter the command center. You&apos;ll get a{" "}
                    <strong>{SYNEXUS_PRO_TRIAL_DAYS}-day full Pro trial</strong> — no credit card, cancel
                    anytime before {SYNEXUS_PRO_PRICE_LABEL}.
                  </p>
                </div>
              </header>
              {authPanel}
            </div>
          ) : (
            <>
              <div className="oracle-admin__head">
                <SynexusSymbolMark className="oracle-admin__logo" size="panel" />
                <div>
                  <p className="oracle-admin__eyebrow">Command center</p>
                  <h2 className="oracle-admin__title">{titanBotName}</h2>
                  <p className="oracle-admin__lede">
                    Aegis, Pulse, Leviathan, and Cipher — your private operator console.
                  </p>
                </div>
              </div>
              <TitanBotRename compact />

              <div className="oracle-admin__metrics" aria-label="Commander system status">
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

              <OracleSupremeVoiceBar
                plan={plan}
                briefing={briefingLine}
                report={plan === "PRO" ? dailyReport : undefined}
                titanBotName={titanBotName}
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
                      <p className="oracle-admin__priorities-label">{titanBotName} priorities</p>
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
                  <p>
                    Unlock {titanBotName} briefings with Synexus Pro — {SYNEXUS_PRO_PRICE_LABEL}. Your{" "}
                    {SYNEXUS_PRO_TRIAL_DAYS}-day trial starts when you sign up — no card required.
                  </p>
                  <ProDemoButton
                    className="oracle-admin__demo pulse-demo-button"
                    label={`Start ${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial`}
                  />
                  <button type="button" disabled={checkoutBusy} onClick={onUpgrade}>
                    {checkoutBusy ? "Opening checkout…" : `Subscribe · ${SYNEXUS_PRO_PRICE_LABEL}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
