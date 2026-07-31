import { useEffect, useState } from "react";
import {
  fetchSolanaMoversBoard,
  type SolanaMoversBoard,
} from "../services/marketDataService";

export function useSolanaMoversBoard(intervalMs = 90_000) {
  const [board, setBoard] = useState<SolanaMoversBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
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
  }, [intervalMs]);

  return { board, loading };
}
