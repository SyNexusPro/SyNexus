import type { Token } from "../data/tokens";

const JOURNAL_KEY = "synexus_trade_journal_v2";
const LEGACY_KEY = "synexus_trade_journal";

export const JOURNAL_UPDATED_EVENT = "synexus-journal-updated";

export type TradeRecord = {
  id: string;
  symbol: string;
  name: string;
  tokenId?: string;
  mintAddress?: string;
  status: "open" | "closed";
  entryPriceUsd: number;
  entryTimestamp: number;
  entryUsd: number;
  entryRiskScore: number;
  entryGuardianRisk: Token["guardianRisk"];
  exitPriceUsd?: number;
  exitTimestamp?: number;
  exitUsd?: number;
  profitLossUsd?: number;
  profitLossPct?: number;
  notes: string;
};

export type JournalSummary = {
  total: number;
  open: number;
  closed: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalProfitLossUsd: number;
  avgRiskScore: number;
};

type LegacyEntry = {
  id: string;
  symbol: string;
  name: string;
  side: "buy" | "sell";
  usdEstimate: number;
  riskScore: number;
  guardianRisk: Token["guardianRisk"];
  timestamp: number;
  outcomePct?: number;
};

function notifyUpdated() {
  window.dispatchEvent(new CustomEvent(JOURNAL_UPDATED_EVENT));
}

function readRecords(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (raw) return JSON.parse(raw) as TradeRecord[];
    return migrateLegacyJournal();
  } catch {
    return [];
  }
}

function writeRecords(records: TradeRecord[]) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(records.slice(-200)));
  notifyUpdated();
}

function migrateLegacyJournal(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const legacy = JSON.parse(raw) as LegacyEntry[];
    const records: TradeRecord[] = [];
    const openBySymbol = new Map<string, TradeRecord>();

    for (const entry of legacy) {
      if (entry.side === "buy") {
        const record: TradeRecord = {
          id: entry.id,
          symbol: entry.symbol,
          name: entry.name,
          status: "open",
          entryPriceUsd: 0,
          entryTimestamp: entry.timestamp,
          entryUsd: entry.usdEstimate,
          entryRiskScore: entry.riskScore,
          entryGuardianRisk: entry.guardianRisk,
          notes: "",
        };
        records.push(record);
        openBySymbol.set(entry.symbol.toUpperCase(), record);
      } else {
        const open = openBySymbol.get(entry.symbol.toUpperCase());
        if (open) {
          open.status = "closed";
          open.exitTimestamp = entry.timestamp;
          open.exitUsd = entry.usdEstimate;
          open.exitPriceUsd = 0;
          const pct = entry.outcomePct ?? 0;
          open.profitLossPct = pct;
          open.profitLossUsd = Math.round(open.entryUsd * (pct / 100) * 100) / 100;
          openBySymbol.delete(entry.symbol.toUpperCase());
        }
      }
    }

    if (records.length) writeRecords(records);
    return records;
  } catch {
    return [];
  }
}

function tradeKey(token: Token) {
  return (token.mintAddress ?? token.symbol).toUpperCase();
}

function findOpenTrade(records: TradeRecord[], token: Token): TradeRecord | undefined {
  const key = tradeKey(token);
  return records.find(
    (r) =>
      r.status === "open" &&
      (r.mintAddress?.toUpperCase() === key ||
        r.symbol.toUpperCase() === token.symbol.toUpperCase()),
  );
}

function computePnl(entryUsd: number, entryPrice: number, exitPrice: number, exitUsd: number) {
  if (entryPrice <= 0 || exitPrice <= 0) {
    return { profitLossPct: 0, profitLossUsd: 0 };
  }
  const profitLossPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  const basis = exitUsd > 0 ? exitUsd : entryUsd;
  const profitLossUsd = Math.round(basis * (profitLossPct / 100) * 100) / 100;
  return {
    profitLossPct: Math.round(profitLossPct * 10) / 10,
    profitLossUsd,
  };
}

export function logTradeFromToken(
  token: Token,
  side: "buy" | "sell",
  usdEstimate = 100,
): TradeRecord {
  const records = readRecords();
  const now = Date.now();
  const price = token.priceUsd > 0 ? token.priceUsd : 0;

  if (side === "buy") {
    const record: TradeRecord = {
      id: `trade-${now}-${token.symbol}`,
      symbol: token.symbol,
      name: token.name,
      tokenId: token.id,
      mintAddress: token.mintAddress,
      status: "open",
      entryPriceUsd: price,
      entryTimestamp: now,
      entryUsd: usdEstimate,
      entryRiskScore: token.riskScore ?? 50,
      entryGuardianRisk: token.guardianRisk,
      notes: "",
    };
    writeRecords([...records, record]);
    return record;
  }

  const open = findOpenTrade(records, token);
  if (open) {
    const { profitLossPct, profitLossUsd } = computePnl(
      open.entryUsd,
      open.entryPriceUsd,
      price,
      usdEstimate,
    );
    open.status = "closed";
    open.exitPriceUsd = price;
    open.exitTimestamp = now;
    open.exitUsd = usdEstimate;
    open.profitLossPct = profitLossPct;
    open.profitLossUsd = profitLossUsd;
    writeRecords(records);
    return open;
  }

  const orphan: TradeRecord = {
    id: `trade-${now}-${token.symbol}-exit`,
    symbol: token.symbol,
    name: token.name,
    tokenId: token.id,
    mintAddress: token.mintAddress,
    status: "closed",
    entryPriceUsd: price,
    entryTimestamp: now,
    entryUsd: usdEstimate,
    entryRiskScore: token.riskScore ?? 50,
    entryGuardianRisk: token.guardianRisk,
    exitPriceUsd: price,
    exitTimestamp: now,
    exitUsd: usdEstimate,
    profitLossPct: 0,
    profitLossUsd: 0,
    notes: "Auto-logged exit — no matching entry on this device.",
  };
  writeRecords([...records, orphan]);
  return orphan;
}

export function getTradeJournal(): TradeRecord[] {
  return readRecords().sort((a, b) => b.entryTimestamp - a.entryTimestamp);
}

export function getOpenTrades(): TradeRecord[] {
  return getTradeJournal().filter((r) => r.status === "open");
}

export function getClosedTrades(): TradeRecord[] {
  return getTradeJournal().filter((r) => r.status === "closed");
}

export function updateTradeNotes(id: string, notes: string) {
  const records = readRecords();
  const record = records.find((r) => r.id === id);
  if (!record) return;
  record.notes = notes.trim();
  writeRecords(records);
}

export function deleteTradeRecord(id: string) {
  writeRecords(readRecords().filter((r) => r.id !== id));
}

export function buildJournalSummary(): JournalSummary {
  const records = readRecords();
  const closed = records.filter((r) => r.status === "closed");
  const wins = closed.filter((r) => (r.profitLossPct ?? 0) > 0);
  const losses = closed.filter((r) => (r.profitLossPct ?? 0) <= 0);
  const totalProfitLossUsd = closed.reduce((s, r) => s + (r.profitLossUsd ?? 0), 0);
  const avgRiskScore =
    records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.entryRiskScore, 0) / records.length)
      : 0;

  return {
    total: records.length,
    open: records.filter((r) => r.status === "open").length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct:
      wins.length + losses.length > 0
        ? Math.round((wins.length / (wins.length + losses.length)) * 100)
        : 0,
    totalProfitLossUsd: Math.round(totalProfitLossUsd * 100) / 100,
    avgRiskScore,
  };
}

export function formatJournalDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatJournalUsd(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: abs >= 1 ? 2 : 4,
    maximumFractionDigits: abs >= 1 ? 2 : 6,
  });
  return n < 0 ? `-${formatted}` : formatted;
}

export function formatJournalPrice(n: number): string {
  if (n <= 0) return "—";
  return formatJournalUsd(n);
}

export function formatJournalPct(n: number | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
