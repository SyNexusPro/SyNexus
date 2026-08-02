import { useEffect, useState } from "react";
import { useAppIsActive } from "../hooks/useAppIsActive";
import { nativePollIntervalMs } from "../lib/nativePerformance";
import {
  fetchSolanaMoversBoard,
  type SolanaMoversBoard,
} from "../services/marketDataService";

type Options = {
  /** Only fetch when Titan chat is open — avoids Birdeye storms on every page. */
  enabled?: boolean;
  intervalMs?: number;
};

export function useSolanaMoversBoard(options: Options = {}) {
  const { enabled = false, intervalMs: baseIntervalMs = 300_000 } = options;
  const intervalMs = nativePollIntervalMs(baseIntervalMs);
  const appActive = useAppIsActive();
  const [board, setBoard] = useState<SolanaMoversBoard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !appActive) return;

    let cancelled = false;

    async function pull() {
      try {
        setLoading(true);
        const next = await fetchSolanaMoversBoard();
        if (!cancelled) setBoard(next);
      } catch {
        /* keep last good board */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void pull();
    const id = window.setInterval(() => void pull(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [appActive, enabled, intervalMs]);

  return { board, loading };
}
