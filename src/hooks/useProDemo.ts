import { useCallback, useEffect, useState } from "react";
import { SYNEXUS_PLAN_CHANGED } from "./useSynexusPlan";
import { useOperatorAuth } from "./useOperatorAuth";
import {
  PRO_DEMO_CHANGED,
  clearExpiredProDemo,
  formatProDemoRemaining,
  getProDemoRemainingMs,
  isProDemoActive,
  startProDemo,
} from "../lib/proDemo";

export function useProDemo() {
  const { userId, linked } = useOperatorAuth();
  const [active, setActive] = useState(() => isProDemoActive());
  const [remainingMs, setRemainingMs] = useState(() => getProDemoRemainingMs());

  const sync = useCallback(() => {
    clearExpiredProDemo();
    setActive(isProDemoActive());
    setRemainingMs(getProDemoRemainingMs());
  }, []);

  useEffect(() => {
    sync();
    const id = window.setInterval(sync, 1000);
    window.addEventListener(PRO_DEMO_CHANGED, sync);
    window.addEventListener(SYNEXUS_PLAN_CHANGED, sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(PRO_DEMO_CHANGED, sync);
      window.removeEventListener(SYNEXUS_PLAN_CHANGED, sync);
    };
  }, [sync]);

  const beginDemo = useCallback(() => {
    if (!userId || !linked) return;
    startProDemo(userId);
    sync();
  }, [linked, sync, userId]);

  return {
    active,
    remainingMs,
    remainingLabel: formatProDemoRemaining(remainingMs),
    beginDemo,
  };
}
