import type { Token } from "../data/tokens";
import { tokenRiskLabel } from "../data/tokens";
import { heraDataAsOfLine } from "./hera/formatLiveStamp";
import { resolveOracleTokenQuery } from "./oracleCryptoBrain";
import type { OracleConversationContext } from "./oracleSupremeConversation";

/** True only for a live ticker snapshot — everything else should think via the LLM. */
export function isInstantCryptoPath(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^\$?[A-Za-z]{2,12}$/.test(trimmed)) return true;
  if (/^(what('?s| is)|price (of|for)|how much is)\s+\$?[A-Za-z]{2,12}\??$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function formatUsd(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function instantPriceRead(token: Token): string {
  return `${token.symbol}: ${formatUsd(token.priceUsd)} · 24h ${formatPct(token.change24hPct)}${
    token.priceMove1hPct != null ? ` · 1h ${formatPct(token.priceMove1hPct)}` : ""
  } · liq ${formatUsd(token.liquidityUsd)} · ${tokenRiskLabel(token)}`;
}

/**
 * Live ticker snapshot only. Conversational questions go to Hera so she can think
 * and vary her wording instead of recycling a canned brief.
 */
export function tryInstantCryptoAnswer(text: string, ctx: OracleConversationContext): string | null {
  const trimmed = text.trim();
  if (!trimmed || !isInstantCryptoPath(trimmed)) return null;

  const token = resolveOracleTokenQuery(trimmed, ctx.tokens);
  if (!token?.mintAddress) return null;
  const sameMint = ctx.tokens.filter(
    (item) => item.symbol.toUpperCase() === token.symbol.toUpperCase() && item.mintAddress,
  );
  if (sameMint.length !== 1) return null;
  return `${instantPriceRead(token)}\n${heraDataAsOfLine(Date.now(), "live pool")}`;
}
