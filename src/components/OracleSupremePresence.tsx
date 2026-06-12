import { useEffect, useMemo, useState } from "react";
import { fetchGuardianAlerts, fetchProfile, fetchWatchlistTokens, getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import {
  hasGreetedThisSession,
  loadConversationHistory,
  markGreetedThisSession,
  readDaysSinceLastVisit,
  resolveOperatorName,
  touchLastVisit,
  type OracleConversationContext,
} from "../lib/oracleSupremeConversation";
import { isSynexusBootComplete, subscribeSynexusBootComplete } from "../lib/synexusBootComplete";
import { OracleSupremeChat } from "./OracleSupremeChat";

const PLAN_STORAGE_KEY = "hivemind_paid_plan";

function normalizePlan(raw: string | null | undefined): "FREE" | "PRO" {
  return raw === "PRO" ? "PRO" : "FREE";
}

export function OracleSupremePresence() {
  const [bootReady, setBootReady] = useState(isSynexusBootComplete());
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [operatorName, setOperatorName] = useState("there");
  const [alertCount, setAlertCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [plan, setPlan] = useState<"FREE" | "PRO">(() =>
    normalizePlan(localStorage.getItem(PLAN_STORAGE_KEY)),
  );

  useEffect(() => subscribeSynexusBootComplete(() => setBootReady(true)), []);

  useEffect(() => {
    if (!bootReady || hasGreetedThisSession()) return;

    let cancelled = false;

    async function prepareGreeting() {
      try {
        const user = await getCurrentUser();
        if (user) {
          const profile = await fetchProfile(user.id);
          if (!cancelled) {
            setOperatorName(resolveOperatorName(profile, user.email));
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

      const history = loadConversationHistory();
      const last = history.at(-1);
      const recentChat = last && Date.now() - last.at < 4 * 60 * 60 * 1000;
      if (recentChat) return;

      window.setTimeout(() => {
        if (!cancelled) {
          setOpen(true);
          setMinimized(false);
        }
      }, 900);
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
    }),
    [alertCount, operatorName, plan, watchlistCount],
  );

  if (!open) return null;

  if (minimized) {
    return (
      <button
        type="button"
        className="oracle-presence-fab"
        onClick={() => setMinimized(false)}
        aria-label="Open conversation with Oracle Supreme"
      >
        <span className="oracle-presence-fab__dot" aria-hidden />
        Oracle Supreme
      </button>
    );
  }

  return (
    <div className="oracle-presence-overlay" role="dialog" aria-label="Oracle Supreme greeting">
      <OracleSupremeChat
        context={context}
        variant="overlay"
        autoSpeak
        showOpeningPrompt
        onDismiss={() => setMinimized(true)}
      />
    </div>
  );
}
