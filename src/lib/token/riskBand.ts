/** Risk bands Hera may state. Never a binary scam verdict. */

export type RiskBand = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL" | "INSUFFICIENT_DATA";

export type RiskEvidenceInput = {
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  topWalletPct?: number | null;
  tokenAgeHours?: number | null;
  riskyMintOrFreezeAuthorityActive?: boolean | null;
  riskScore?: number | null;
  riskReasons?: string[] | null;
};

export type RiskRating = {
  band: RiskBand;
  reasons: string[];
  unmeasured: string[];
  score: number | null;
};

export function rateRiskBand(input: RiskEvidenceInput): RiskRating {
  const unmeasured: string[] = [];
  if (input.liquidityUsd == null) unmeasured.push("liquidity");
  if (input.volume24hUsd == null) unmeasured.push("volume");
  if (input.topWalletPct == null) unmeasured.push("holder concentration");
  if (input.tokenAgeHours == null) unmeasured.push("token age");
  if (input.riskyMintOrFreezeAuthorityActive == null) unmeasured.push("mint and freeze authority");

  const reasons = (input.riskReasons ?? []).filter((reason) => reason.trim().length > 0);
  const hasMarket = input.liquidityUsd != null || input.volume24hUsd != null;
  const hasOnchainHint =
    input.topWalletPct != null || input.tokenAgeHours != null || input.riskyMintOrFreezeAuthorityActive != null;

  if (!hasMarket && !hasOnchainHint) {
    return { band: "INSUFFICIENT_DATA", reasons: [], unmeasured, score: null };
  }

  const score = input.riskScore;
  if (score == null || !Number.isFinite(score)) {
    return { band: "INSUFFICIENT_DATA", reasons, unmeasured, score: null };
  }

  let band: RiskBand = "LOW";
  if (score >= 80) band = "CRITICAL";
  else if (score >= 60) band = "HIGH";
  else if (score >= 30) band = "ELEVATED";

  return { band, reasons, unmeasured, score };
}

export function formatRiskBand(band: RiskBand): string {
  switch (band) {
    case "LOW":
      return "Low risk";
    case "ELEVATED":
      return "Elevated risk";
    case "HIGH":
      return "High risk";
    case "CRITICAL":
      return "Critical risk";
    case "INSUFFICIENT_DATA":
      return "Insufficient data";
  }
}

export function formatRiskRating(rating: RiskRating): string {
  const missing = rating.unmeasured.length ? ` Not measured: ${rating.unmeasured.join(", ")}.` : "";
  if (rating.band === "INSUFFICIENT_DATA") {
    return `INSUFFICIENT DATA.${missing || " Not enough measured signals to rate this token."}`;
  }
  const count = rating.reasons.length;
  const why = rating.reasons.slice(0, 4).join("; ");
  return `${rating.band} — ${count} warning${count === 1 ? "" : "s"}.${why ? ` ${why}` : ""}${missing}`;
}
