import { useEffect, useState } from "react";
import type { Token } from "../data/tokens";
import { fetchMvpTokenFeed } from "../services/marketDataService";

type OracleMarketFeed = {
  tokens: Token[];
  feedSource: "live" | "mock";
  loading: boolean;
};

export function useOracleMarketFeed(intervalMs = 10_000): OracleMarketFeed {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [feedSource, setFeedSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [intervalMs]);

  return { tokens, feedSource, loading };
}
