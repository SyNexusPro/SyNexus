import { formatRiskRating, type RiskBand, type RiskRating } from "../../../src/lib/token/riskBand.js";
import type { MarketReading, SecurityReading } from "./intelSources.js";

const THIN_LIQUIDITY_USD = 15_000;
const LOW_LIQUIDITY_USD = 25_000;
const BOOST_THIN_LIQUIDITY_USD = 40_000;
const VOLUME_PRESSURE_RATIO = 4;
const FAST_MOVE_AGE_HOURS = 6;
const FAST_MOVE_ABS_PCT = 40;
const BOOST_ACTIVE_MIN = 50;

const WEIGHT = {
  thin_liquidity: 62,
  low_liquidity: 34,
  volume_to_liquidity_pressure: 30,
  new_pair_fast_move: 30,
  mint_authority_active: 60,
  freeze_authority_active: 60,
  mint_account_not_found: 70,
  account_is_not_spl_mint: 70,
  uninitialized_mint: 70,
  symbol_mismatch: 30,
  boost_on_thin_book: 30,
} as const;

const ALWAYS_UNMEASURED = [
  "holder concentration",
  "honeypot or sell simulation",
  "liquidity lock",
  "insider wallet graph",
  "contract source audit",
] as const;

export type IntelWarning = {
  code: keyof typeof WEIGHT;
  severity: "elevated" | "high";
  detail: string;
  evidence: Record<string, string | number | boolean | null>;
};

export type HeraIntelReport = {
  ok: true;
  advisoryOnly: true;
  executesTrades: false;
  walletSigning: false;
  safetyClearance: false;
  scamVerdict: null;
  note: string;
  chain: "solana";
  mint: string;
  capturedAt: string;
  symbol: {
    requested: string | null;
    observed: string | null;
    matches: boolean | null;
  };
  market: MarketReading & { tokenAgeHours: number | null; fieldsNotProvided: string[] };
  security: SecurityReading;
  warnings: IntelWarning[];
  risk: {
    band: RiskBand;
    score: number | null;
    partial: boolean;
    derivedFrom: string[];
    unmeasured: string[];
    summary: string;
  };
  checksNotPerformed: string[];
};

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Same cutoffs as rateRiskBand. Score stays null when nothing was measured. */
function bandForScore(score: number | null): RiskBand {
  if (score == null) return "INSUFFICIENT_DATA";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "ELEVATED";
  return "LOW";
}

export function tokenAgeHours(pairCreatedAtMs: number | null, nowMs: number): number | null {
  if (pairCreatedAtMs == null || !Number.isFinite(pairCreatedAtMs)) return null;
  if (pairCreatedAtMs < 1_000_000_000_000 || pairCreatedAtMs > nowMs) return null;
  return (nowMs - pairCreatedAtMs) / 3_600_000;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildHeraIntelReport(input: {
  mint: string;
  requestedSymbol: string | null;
  capturedAtMs: number;
  market: MarketReading;
  security: SecurityReading;
}): HeraIntelReport {
  const capturedAt = new Date(input.capturedAtMs).toISOString();
  const age = tokenAgeHours(input.market.pairCreatedAtMs, input.capturedAtMs);
  const observed = input.market.symbol;
  const requested = input.requestedSymbol;
  const matches = requested && observed ? requested.toUpperCase() === observed.toUpperCase() : null;
  const warnings: IntelWarning[] = [];
  const derivedFrom: string[] = [];

  const liquidity = input.market.liquidityUsd;
  const volume = input.market.volume24hUsd;
  const change24 = input.market.priceChange24hPct;

  if (liquidity != null) derivedFrom.push("liquidityUsd");
  if (liquidity != null && liquidity < THIN_LIQUIDITY_USD) {
    warnings.push({
      code: "thin_liquidity",
      severity: "high",
      detail: "Reported liquidity is under $15,000. Thin books are easier to move. This is not a scam verdict.",
      evidence: { liquidityUsd: liquidity },
    });
  } else if (liquidity != null && liquidity < LOW_LIQUIDITY_USD) {
    warnings.push({
      code: "low_liquidity",
      severity: "elevated",
      detail: "Reported liquidity is under $25,000. This is not a scam verdict.",
      evidence: { liquidityUsd: liquidity },
    });
  }

  if (liquidity != null && liquidity > 0 && volume != null) {
    derivedFrom.push("volume24hUsd");
    const ratio = volume / liquidity;
    if (ratio >= VOLUME_PRESSURE_RATIO) {
      warnings.push({
        code: "volume_to_liquidity_pressure",
        severity: "elevated",
        detail: "24h volume is at least 4x reported liquidity. This is a pressure proxy, not a holder count or a scam verdict.",
        evidence: { liquidityUsd: liquidity, volume24hUsd: volume, volumeToLiquidity: round(ratio) },
      });
    }
  }

  if (age != null) derivedFrom.push("tokenAgeHours");
  if (change24 != null) derivedFrom.push("priceChange24hPct");
  if (age != null && change24 != null && age < FAST_MOVE_AGE_HOURS && Math.abs(change24) >= FAST_MOVE_ABS_PCT) {
    warnings.push({
      code: "new_pair_fast_move",
      severity: "elevated",
      detail: "Pair age is under 6 hours and the absolute 24h price change is at least 40%. This is not a scam verdict.",
      evidence: { tokenAgeHours: round(age), priceChange24hPct: change24 },
    });
  }

  if (input.market.boostActive != null && liquidity != null) {
    derivedFrom.push("boostActive");
    if (input.market.boostActive >= BOOST_ACTIVE_MIN && liquidity < BOOST_THIN_LIQUIDITY_USD) {
      warnings.push({
        code: "boost_on_thin_book",
        severity: "elevated",
        detail: "DexScreener reports an active boost of 50 or more while liquidity is under $40,000. Treat the boost as marketing, not quality.",
        evidence: { boostActive: input.market.boostActive, liquidityUsd: liquidity },
      });
    }
  }

  if (matches === false && requested && observed) {
    derivedFrom.push("symbol");
    warnings.push({
      code: "symbol_mismatch",
      severity: "elevated",
      detail: "The requested symbol does not match the symbol on the indexed pair.",
      evidence: { requested, observed },
    });
  }

  const mintAuthority = input.security.mintAuthorityActive;
  const freezeAuthority = input.security.freezeAuthorityActive;
  if (mintAuthority != null) derivedFrom.push("mintAuthorityActive");
  if (freezeAuthority != null) derivedFrom.push("freezeAuthorityActive");
  if (mintAuthority === true) {
    warnings.push({
      code: "mint_authority_active",
      severity: "high",
      detail: "SPL mint authority is still set, so more supply can be minted. This is not a scam verdict.",
      evidence: { mintAuthorityActive: true },
    });
  }
  if (freezeAuthority === true) {
    warnings.push({
      code: "freeze_authority_active",
      severity: "high",
      detail: "SPL freeze authority is still set, so that authority can freeze token accounts. This is not a scam verdict.",
      evidence: { freezeAuthorityActive: true },
    });
  }

  if (
    input.security.status === "not_found" ||
    input.security.status === "not_a_mint" ||
    input.security.status === "uninitialized"
  ) {
    derivedFrom.push("mintAccountStatus");
  }
  if (input.security.status === "not_found") {
    warnings.push({
      code: "mint_account_not_found",
      severity: "high",
      detail: "The configured Solana RPC returned no account for this address. This is not a search of other clusters and is not a scam verdict.",
      evidence: { mintAccountFound: false },
    });
  } else if (input.security.status === "not_a_mint") {
    warnings.push({
      code: "account_is_not_spl_mint",
      severity: "high",
      detail: "An account exists at this address, but it is not an SPL Token or Token-2022 mint.",
      evidence: { mintAccountFound: true },
    });
  } else if (input.security.status === "uninitialized") {
    warnings.push({
      code: "uninitialized_mint",
      severity: "high",
      detail: "The mint account exists and is not initialized.",
      evidence: { isInitialized: false },
    });
  }

  const checksNotPerformed = [
    ...ALWAYS_UNMEASURED,
    ...(liquidity == null ? ["liquidity"] : []),
    ...(volume == null ? ["volume"] : []),
    ...(age == null ? ["token age"] : []),
    ...(change24 == null ? ["24h price change"] : []),
    ...(mintAuthority == null ? ["mint authority"] : []),
    ...(freezeAuthority == null ? ["freeze authority"] : []),
    ...(input.market.socialLinkCount == null ? ["dex social links"] : []),
    ...(input.market.boostActive == null ? ["dex boosts"] : []),
    ...(input.security.status === "not_configured" || input.security.status === "unavailable"
      ? ["mint account"]
      : []),
  ];

  const score = derivedFrom.length ? clamp(warnings.reduce((sum, warning) => sum + WEIGHT[warning.code], 0)) : null;
  const band = bandForScore(score);
  const rating: RiskRating = {
    band,
    score,
    reasons: warnings.map((warning) => warning.detail),
    unmeasured: checksNotPerformed,
  };
  const fieldsNotProvided = marketFieldsNotProvided(input.market, age);

  return {
    ok: true,
    advisoryOnly: true,
    executesTrades: false,
    walletSigning: false,
    safetyClearance: false,
    scamVerdict: null,
    note: "Advisory readings from the sources that answered. Missing checks were not performed. This is not a trade instruction.",
    chain: "solana",
    mint: input.mint,
    capturedAt,
    symbol: { requested, observed, matches },
    market: { ...input.market, tokenAgeHours: age == null ? null : round(age), fieldsNotProvided },
    security: input.security,
    warnings,
    risk: {
      band,
      score,
      partial: checksNotPerformed.length > 0,
      derivedFrom,
      unmeasured: checksNotPerformed,
      summary: formatRiskRating(rating),
    },
    checksNotPerformed,
  };
}

function marketFieldsNotProvided(market: MarketReading, age: number | null): string[] {
  const fields: Array<[string, unknown]> = [
    ["symbol", market.symbol],
    ["name", market.name],
    ["priceUsd", market.priceUsd],
    ["liquidityUsd", market.liquidityUsd],
    ["volume24hUsd", market.volume24hUsd],
    ["marketCapUsd", market.marketCapUsd],
    ["fdvUsd", market.fdvUsd],
    ["priceChange5mPct", market.priceChange5mPct],
    ["priceChange1hPct", market.priceChange1hPct],
    ["priceChange24hPct", market.priceChange24hPct],
    ["buys24h", market.buys24h],
    ["sells24h", market.sells24h],
    ["pairUrl", market.pairUrl],
    ["dexId", market.dexId],
    ["tokenAgeHours", age],
    ["boostActive", market.boostActive],
    ["socialLinkCount", market.socialLinkCount],
  ];
  return fields.filter(([, value]) => value == null).map(([name]) => name);
}
