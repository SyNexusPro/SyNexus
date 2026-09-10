import { useEffect, useMemo, useState } from "react";
import { fetchGuardianAlerts, fetchProfile, fetchWatchlistTokens, getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import { useTitanShell } from "../context/TitanShellContext";
import { consumeHeraWakeLaunch, type HeraWakeLaunch } from "../lib/hera/wakeWord";
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
import { useSolanaMoversBoard } from "../lib/useSolanaMoversBoard";
import { isSynexusBootComplete, subscribeSynexusBootComplete } from "../lib/synexusBootComplete";
import { isNativeAndroid } from "../lib/bootExperience";
import { SYNEXUS_PLAN_CHANGED } from "../hooks/useSynexusPlan";
import { HeraScreen } from "./hera/HeraScreen";
import { warmTitanBrain } from "../lib/titanConversation";
import { QuickOperatorLogin } from "./QuickOperatorLogin";
import { SynexusSymbolMark } from "./SynexusSymbolMark";

const PLAN_STORAGE_KEY = "synexus_paid_plan";

function normalizePlan(raw: string | null | undefined): "FREE" | "PRO" {
  return raw === "PRO" ? "PRO" : "FREE";
}

export function TitanSheet() {
  const { sheetOpen, sheetMode, closeSheet } = useTitanShell();
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
  const titanChatActive = sheetOpen && sheetMode === "chat";
  const [wakeLaunch, setWakeLaunch] = useState<HeraWakeLaunch | null>(null);

  const { tokens, feedSource } = useOracleMarketFeed({
    enabled: titanChatActive,
    intervalMs: plan === "PRO" ? 15_000 : 20_000,
  });
  const { board: moversBoard } = useSolanaMoversBoard({
    enabled: titanChatActive,
    intervalMs: 300_000,
  });

  useEffect(() => {
    if (sheetOpen) warmTitanBrain();
  }, [sheetOpen]);

  useEffect(() => {
    if (sheetOpen && sheetMode === "chat") {
      setWakeLaunch(consumeHeraWakeLaunch());
    } else {
      setWakeLaunch(null);
    }
  }, [sheetOpen, sheetMode]);

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
    // Android: no boot network/greeting — only when the sheet is actually opened.
    if (isNativeAndroid() && !sheetOpen) return;
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
  }, [bootReady, sheetOpen]);

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
      moversBoard,
    }),
    [alertCount, feedSource, operatorName, plan, commanderLabel, tokens, watchlistCount, watchlistSymbols, moversBoard],
  );

  const fromWake = Boolean(wakeLaunch);
  const seed = wakeLaunch?.remainder?.trim() ?? "";
  const autoListen = fromWake && seed.length < 6;

  return (
    <>
      {sheetOpen && sheetMode === "chat" ? (
        <HeraScreen
          context={context}
          onClose={closeSheet}
          autoListen={autoListen}
          seedUtterance={fromWake && seed.length >= 6 ? seed : null}
          wakePulse={fromWake}
        />
      ) : null}

      {sheetOpen && sheetMode === "login" ? (
        <>
          <button
            type="button"
            className="titan-sheet-backdrop"
            aria-label="Close panel"
            onClick={closeSheet}
          />
          <div
            className="titan-sheet titan-sheet--login"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
          >
            <header className="titan-sheet__head">
              <div className="titan-sheet__brand">
                <SynexusSymbolMark size="chat" />
                <div>
                  <p className="titan-sheet__title">Sign in</p>
                  <p className="titan-sheet__subtitle">Access watchlists, alerts, and Pro.</p>
                </div>
              </div>
              <div className="titan-sheet__actions">
                <button type="button" className="titan-sheet__close" onClick={closeSheet} aria-label="Close">
                  ×
                </button>
              </div>
            </header>
            <div className="titan-sheet__body">
              <QuickOperatorLogin onSuccess={closeSheet} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
