import { useEffect, useMemo, useState } from "react";
import { fetchGuardianAlerts, fetchProfile, fetchWatchlistTokens, getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import { openOracleLogin } from "../lib/openOracleLogin";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
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
import { OracleSupremeChat } from "./OracleSupremeChat";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

import { SYNEXUS_PLAN_CHANGED } from "../hooks/useSynexusPlan";

const PLAN_STORAGE_KEY = "hivemind_paid_plan";

function normalizePlan(raw: string | null | undefined): "FREE" | "PRO" {
  return raw === "PRO" ? "PRO" : "FREE";
}

export function OracleSupremePresence() {
  const { linked } = useOperatorAuth();
  const [bootReady, setBootReady] = useState(isSynexusBootComplete());
  const [expanded, setExpanded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [operatorName, setOperatorName] = useState("there");
  const [alertCount, setAlertCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [plan, setPlan] = useState<"FREE" | "PRO">(() =>
    normalizePlan(localStorage.getItem(PLAN_STORAGE_KEY)),
  );
  const { tokens, feedSource } = useOracleMarketFeed(plan === "PRO" ? 8_000 : 10_000);

  useEffect(() => subscribeSynexusBootComplete(() => setBootReady(true)), []);

  useEffect(() => {
    const sync = () =>
      setPlan(normalizePlan(localStorage.getItem(PLAN_STORAGE_KEY)));
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
            const name = resolveOperatorName(profile, user.email);
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
              }
            } catch {
              /* greeting still works without counts */
            }
          }
        }
      } catch {
        /* greeting still works with defaults */
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
      alertCount,
      watchlistCount,
      plan,
      daysSinceLastVisit: readDaysSinceLastVisit(),
      tokens,
      feedSource,
    }),
    [alertCount, feedSource, operatorName, plan, tokens, watchlistCount],
  );

  return (
    <>
      {expanded ? (
        <div className="oracle-presence-panel" role="dialog" aria-label="Talk to Oracle Supreme">
          <OracleSupremeChat
            context={context}
            variant="widget"
            onDismiss={() => setExpanded(false)}
            onSpeakingChange={setSpeaking}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={`oracle-presence-fab${expanded ? " oracle-presence-fab--open" : ""}${speaking ? " oracle-presence-fab--speaking" : ""}`}
        onClick={() => {
          if (!linked) {
            openOracleLogin();
            return;
          }
          setExpanded((open) => !open);
        }}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? "Minimize Oracle Supreme chat"
            : speaking
              ? "Oracle Supreme is speaking"
              : "Talk to Oracle Supreme"
        }
        title="Oracle Supreme"
      >
        <span className="oracle-presence-fab__ring" aria-hidden />
        <span className="oracle-presence-fab__avatar" aria-hidden>
          <SynexusSymbolMark size="fab" />
        </span>
        {!expanded ? (
          <span className="oracle-presence-fab__copy">
            <span className="oracle-presence-fab__label">Oracle</span>
          </span>
        ) : null}
      </button>
    </>
  );
}
