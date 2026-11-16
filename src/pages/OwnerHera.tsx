import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { HeraHologramPortrait } from "../components/hera/HeraHologramPortrait";
import { HeraScreen } from "../components/hera/HeraScreen";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import { useTitanBotName } from "../hooks/useTitanBotName";
import { heraLiveVoice } from "../services/heraVoice";
import {
  readDaysSinceLastVisit,
  resolveOperatorName,
  type OracleConversationContext,
} from "../lib/oracleSupremeConversation";
import {
  enableOwnerHeraPush,
  pullOwnerHeraThread,
  requestHeraHomeShortcut,
  verifyOwnerHera,
} from "../lib/ownerHera";
import { resolveTitanBotName } from "../lib/titanBotName";
import { useOracleMarketFeed } from "../lib/useOracleMarketFeed";
import { useSolanaMoversBoard } from "../lib/useSolanaMoversBoard";
import { warmTitanBrain } from "../lib/titanConversation";

/**
 * Owner-only full-screen Hera. The face, voice, and conversation are the existing ones.
 * The microphone starts after the server confirms the owner, and stops when this view closes.
 */
export function OwnerHera() {
  const navigate = useNavigate();
  const { name: titanBotName } = useTitanBotName();
  const [status, setStatus] = useState<"checking" | "ready" | "denied">("checking");
  const ready = status === "ready";
  const { tokens, feedSource } = useOracleMarketFeed({ enabled: ready, intervalMs: 20_000 });
  const { board: moversBoard } = useSolanaMoversBoard({ enabled: ready, intervalMs: 300_000 });

  useEffect(() => {
    let alive = true;
    const stopMic = () => heraLiveVoice.disconnect();
    const onHide = () => {
      if (document.hidden) stopMic();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stopMic);

    void (async () => {
      const allowed = await verifyOwnerHera();
      if (!alive) return;
      if (!allowed.ok) {
        setStatus("denied");
        return;
      }
      await pullOwnerHeraThread();
      if (!alive) return;
      setStatus("ready");
      warmTitanBrain();
      void enableOwnerHeraPush(allowed.vapidPublicKey);
      void requestHeraHomeShortcut();
    })();

    return () => {
      alive = false;
      stopMic();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stopMic);
    };
  }, []);

  const context = useMemo<OracleConversationContext>(
    () => ({
      operatorName: resolveOperatorName(null),
      titanBotName: titanBotName || resolveTitanBotName() || DEFAULT_TITAN_BOT_NAME,
      alertCount: 0,
      watchlistCount: 0,
      plan: "PRO",
      daysSinceLastVisit: readDaysSinceLastVisit(),
      tokens,
      feedSource,
      moversBoard,
    }),
    [feedSource, moversBoard, titanBotName, tokens],
  );

  if (status === "denied") return <Navigate to="/god" replace />;

  if (!ready) {
    return (
      <div className="hera-screen" role="dialog" aria-modal="true" aria-label="Hera">
        <div className="hera-screen__stage">
          <HeraHologramPortrait state="idle" isActive={false} emotion="neutral" audioLevel={0} viseme="sil" />
        </div>
      </div>
    );
  }

  return (
    <HeraScreen
      context={context}
      voiceActivation
      autoListen
      onClose={() => {
        heraLiveVoice.disconnect();
        navigate("/");
      }}
    />
  );
}
