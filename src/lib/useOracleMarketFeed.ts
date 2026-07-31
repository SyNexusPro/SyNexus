import { useEffect, useState } from "react";
import type { Token } from "../data/tokens";
import { fetchMvpTokenFeed } from "../services/marketDataService";

type OracleMarketFeed = {
  tokens: Token[];
  feedSource: "live" | "mock";
  loading: boolean;
};

type Options = {
  /** When false, no polling (avoids duplicate feeds while Titan is closed). */
  enabled?: boolean;
  intervalMs?: number;
};

export function useOracleMarketFeed(options: Options | number = 10_000): OracleMarketFeed {
  const enabled = typeof options === "number" ? true : (options.enabled ?? true);
  const intervalMs = typeof options === "number" ? options : (options.intervalMs ?? 10_000);

  const [tokens, setTokens] = useState<Token[]>([]);
  const [feedSource, setFeedSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function pull() {
      try {
        const feed = await fetchMvpTokenFeed();
        if (!cancelled) {
          setTokens(feed.all);
          setFeedSource(feed.source);
        }
      } catch {
        /* keep last good read */
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
  }, [enabled, intervalMs]);

  return { tokens, feedSource, loading };
}
