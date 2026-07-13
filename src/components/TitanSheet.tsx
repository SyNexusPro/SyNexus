import { useEffect, useMemo, useState } from "react";
import { fetchGuardianAlerts, fetchProfile, fetchWatchlistTokens, getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import { useOpenTitanChat } from "../hooks/useOpenTitanChat";
import { useTitanShell } from "../context/TitanShellContext";
import { useTitanBotName } from "../hooks/useTitanBotName";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { resolveTitanBotName } from "../lib/titanBotName";
import {
  hasGreetedThisSession,
  markGreetedThisSession,
  readDaysSinceLastVisit,
  resolveOperatorName,
  saveIntroOperatorName,
  touchLastVisit,
  type OracleConversationContext,
} from "../lib/oracleSupremeConversation";
import { useOracleMarketFeed } from "../lib/useOracleMarketFeed";
import { isSynexusBootComplete, subscribeSynexusBootComplete } from "../lib/synexusBootComplete";
import { SYNEXUS_PLAN_CHANGED } from "../hooks/useSynexusPlan";
import { OracleSupremeChat } from "./OracleSupremeChat";
import { QuickOperatorLogin } from "./QuickOperatorLogin";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

const PLAN_STORAGE_KEY = "hivemind_paid_plan";

function normalizePlan(raw: string | null | undefined): "FREE" | "PRO" {
  return raw === "PRO" ? "PRO" : "FREE";
}

export function TitanSheet() {
  const { sheetOpen, sheetMode, closeSheet } = useTitanShell();
  const openTitanChat = useOpenTitanChat();
  const { name: titanBotName } = useTitanBotName();
  const commanderLabel = titanBotName || resolveTitanBotName() || DEFAULT_TITAN_BOT_NAME;
  const [bootReady, setBootReady] = useState(isSynexusBootComplete());
  const [operatorName, setOperatorName] = useState("there");
  const [alertCount, setAlertCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [plan, setPlan] = useState<"FREE" | "PRO">(() =>
    normalizePlan(localStorage.getItem(PLAN_STORAGE_KEY)),
  );
  const { tokens, feedSource } = useOracleMarketFeed(plan === "PRO" ? 8_000 : 10_000);

  useEffect(() => subscribeSynexusBootComplete(() => setBootReady(true)), []);

  useEffect(() => {
    const sync = () => setPlan(normalizePlan(localStorage.getItem(PLAN_STORAGE_KEY)));
    window.addEventListener(SYNEXUS_PLAN_CHANGED, sync);
    window.addEventListener("synexus-pro-demo-changed", sync);
    return () => {
      window.removeEventListener(SYNEXUS_PLAN_CHANGED, sync);
      window.removeEventListener("synexus-pro-demo-changed", sync);
    };
  }, []);

  useEffect(() => {
    if (!bootReady || hasGreetedThisSession()) return;

    let cancelled = false;

    async function prepareGreeting() {
      try {
        const user = await getCurrentUser();
        if (user) {
          const profile = await fetchProfile(user.id);
          if (!cancelled) {
            const name = resolveOperatorName(profile);
            setOperatorName(name);
            saveIntroOperatorName(name);
            setPlan(normalizePlan(profile?.paid_plan ?? localStorage.getItem(PLAN_STORAGE_KEY)));
          }
          if (hasSupabaseEnv) {
            try {
              const [alertRows, watchlistRows] = await Promise.all([
                fetchGuardianAlerts(),
                fetchWatchlistTokens(user.id),
              ]);
              if (!cancelled) {
                setAlertCount(alertRows.length);
                setWatchlistCount(watchlistRows.length);
                setWatchlistSymbols(
                  watchlistRows.map((row) => row.token_symbol?.trim().toUpperCase()).filter(Boolean),
                );
              }
            } catch {
              /* optional counts */
            }
          }
        }
      } catch {
        /* defaults ok */
      }

      if (cancelled) return;
      touchLastVisit();
      markGreetedThisSession();
    }

    void prepareGreeting();
    return () => {
      cancelled = true;
    };
  }, [bootReady]);

  const context = useMemo<OracleConversationContext>(
    () => ({
      operatorName,
      titanBotName: commanderLabel,
      alertCount,
      watchlistCount,
      watchlistSymbols,
      plan,
      daysSinceLastVisit: readDaysSinceLastVisit(),
      tokens,
      feedSource,
    }),
    [alertCount, feedSource, operatorName, plan, commanderLabel, tokens, watchlistCount, watchlistSymbols],
  );

  function handleFabToggle() {
    openTitanChat();
  }

  return (
    <>
      {sheetOpen ? (
        <>
          <button
            type="button"
            className="titan-sheet-backdrop"
            aria-label="Close panel"
            onClick={closeSheet}
          />
          <div
            className={`titan-sheet titan-sheet--${sheetMode}`}
            role="dialog"
            aria-modal="true"
            aria-label={sheetMode === "login" ? "Sign in" : `Talk to ${commanderLabel}`}
          >
            <header className="titan-sheet__head">
              <div className="titan-sheet__brand">
                <SynexusSymbolMark size="chat" />
                <div>
                  <p className="titan-sheet__title">
                    {sheetMode === "login" ? "Sign in" : commanderLabel}
                  </p>
                  {sheetMode === "login" ? (
                    <p className="titan-sheet__subtitle">Access watchlists, alerts, and Pro.</p>
                  ) : null}
                </div>
              </div>
              <button type="button" className="titan-sheet__close" onClick={closeSheet} aria-label="Close">
                ×
              </button>
            </header>

            <div className="titan-sheet__body">
              {sheetMode === "login" ? (
                <QuickOperatorLogin onSuccess={closeSheet} />
              ) : (
                <OracleSupremeChat context={context} variant="overlay" minimal />
              )}
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={`oracle-presence-fab${sheetOpen && sheetMode === "chat" ? " oracle-presence-fab--open" : ""}`}
        onClick={handleFabToggle}
        aria-expanded={sheetOpen && sheetMode === "chat"}
        aria-label={
          sheetOpen && sheetMode === "chat"
            ? `Minimize ${commanderLabel} chat`
            : `Talk to ${commanderLabel}`
        }
        title={commanderLabel}
      >
        <span className="oracle-presence-fab__ring" aria-hidden />
        <span className="oracle-presence-fab__avatar" aria-hidden>
          <SynexusSymbolMark size="fab" />
        </span>
        {!sheetOpen || sheetMode !== "chat" ? (
          <span className="oracle-presence-fab__copy">
            <span className="oracle-presence-fab__label">{commanderLabel}</span>
          </span>
        ) : null}
      </button>
    </>
  );
}
