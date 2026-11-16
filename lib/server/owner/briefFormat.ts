export type OwnerBriefFacts = {
  asOf: string;
  databaseReachable: boolean;
  swapsConfirmed: number | null;
  swapsFailed: number | null;
  swapsPending: number | null;
  signups: number | null;
  accounts: number | null;
  newAccounts: number | null;
  members: number | null;
  activeSubscriptions: number | null;
  /** Null when the payment ledger could not be read. Zero is a real empty ledger. */
  recordedRevenueUsd: number | null;
  securityEvents: number | null;
  criticalSecurityEvents: number | null;
  /** Rows of type DAILY_BRIEF in the last 24 hours. */
  dailyDigestRows: number | null;
};

export type OwnerBrief = {
  spoken: string;
  detail: string;
  prompt: string;
};

const UNAVAILABLE = "Data unavailable";

function countLine(label: string, value: number | null): string {
  return `${label}: ${value === null ? UNAVAILABLE : String(value)}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Turn verified counts into speech. Missing sources stay unavailable. */
export function composeOwnerBrief(facts: OwnerBriefFacts): OwnerBrief {
  const lines = [
    `Owner briefing as of ${facts.asOf}.`,
    facts.databaseReachable
      ? "Database: reachable."
      : "Database: Data unavailable. The report could not read SyNexus records.",
    countLine("Confirmed swaps, last 24 hours", facts.swapsConfirmed),
    countLine("Failed swaps, last 24 hours", facts.swapsFailed),
    countLine("Pending swaps, last 24 hours", facts.swapsPending),
    "SyNexus fee dollars: Data unavailable. Swap records do not store a fee amount.",
    "Network fees: Data unavailable. They are not stored on the server.",
    "Trading profit: Data unavailable. Profit is not stored on the server.",
    facts.recordedRevenueUsd === null
      ? "Recorded payment ledger: Data unavailable."
      : `Recorded payment ledger, last 24 hours: ${money(facts.recordedRevenueUsd)}.`,
    "App store subscription charges: Data unavailable. RevenueCat is not connected to this report.",
    countLine("New signups recorded in site analytics, last 24 hours", facts.signups),
    countLine("Accounts", facts.accounts),
    countLine("New accounts, last 24 hours", facts.newAccounts),
    countLine("Profile rows", facts.members),
    countLine("Profiles marked subscription active", facts.activeSubscriptions),
    countLine("Security events, last 24 hours", facts.securityEvents),
    countLine("Critical security events, last 24 hours", facts.criticalSecurityEvents),
    facts.dailyDigestRows === null
      ? "Hera daily digest row: Data unavailable."
      : facts.dailyDigestRows > 0
        ? "Hera daily digest: a digest row was written in the last 24 hours."
        : "Hera daily digest: no digest row was written in the last 24 hours.",
  ];

  const detail = lines.join("\n");
  const spoken = lines.join(" ");
  const prompt = [
    "OWNER BRIEFING FACTS. These are the only verified business figures for this turn.",
    "If a line says Data unavailable, say Data unavailable. Do not estimate, round from memory, or fill a zero unless the line itself gives a number.",
    "Do not mention wallets, emails, or payment identifiers.",
    detail,
  ].join("\n");

  return { spoken, detail, prompt };
}
