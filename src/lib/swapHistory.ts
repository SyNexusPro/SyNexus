import { hasSupabaseEnv, supabase } from "./supabaseClient";

export type SwapHistoryStatus = "pending" | "confirmed" | "failed";

export type SwapHistoryRecord = {
  id: string;
  walletAddress: string;
  signature: string | null;
  inputMint: string;
  outputMint: string;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  outputAmountEst: string;
  status: SwapHistoryStatus;
  priceImpactPct: number | null;
  timestamp: number;
};

const STORAGE_KEY = "synexus_swap_history_v1";
const MAX_LOCAL = 40;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `swap_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function readLocal(): SwapHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SwapHistoryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: SwapHistoryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_LOCAL)));
  } catch {
    /* ignore quota */
  }
}

export function listLocalSwapHistory(walletAddress?: string): SwapHistoryRecord[] {
  const rows = readLocal();
  if (!walletAddress) return rows;
  return rows.filter((row) => row.walletAddress === walletAddress);
}

export async function recordSwapHistory(
  input: Omit<SwapHistoryRecord, "id" | "timestamp"> & { id?: string; timestamp?: number },
): Promise<SwapHistoryRecord> {
  const record: SwapHistoryRecord = {
    id: input.id ?? newId(),
    walletAddress: input.walletAddress,
    signature: input.signature,
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    inputSymbol: input.inputSymbol,
    outputSymbol: input.outputSymbol,
    inputAmount: input.inputAmount,
    outputAmountEst: input.outputAmountEst,
    status: input.status,
    priceImpactPct: input.priceImpactPct,
    timestamp: input.timestamp ?? Date.now(),
  };

  const next = [record, ...readLocal().filter((row) => row.id !== record.id && row.signature !== record.signature)];
  writeLocal(next);

  if (hasSupabaseEnv && supabase) {
    try {
      await supabase.from("swap_history").insert({
        id: record.id,
        wallet_address: record.walletAddress,
        tx_signature: record.signature,
        input_mint: record.inputMint,
        output_mint: record.outputMint,
        input_symbol: record.inputSymbol,
        output_symbol: record.outputSymbol,
        input_amount: record.inputAmount,
        output_amount_est: record.outputAmountEst,
        status: record.status,
        price_impact_pct: record.priceImpactPct,
        created_at: new Date(record.timestamp).toISOString(),
      });
    } catch {
      /* table may not exist yet — local copy is enough */
    }
  }

  return record;
}

export async function loadSwapHistory(walletAddress: string): Promise<SwapHistoryRecord[]> {
  const local = listLocalSwapHistory(walletAddress);
  if (!hasSupabaseEnv || !supabase) return local;

  try {
    const { data, error } = await supabase
      .from("swap_history")
      .select(
        "id, wallet_address, tx_signature, input_mint, output_mint, input_symbol, output_symbol, input_amount, output_amount_est, status, price_impact_pct, created_at",
      )
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error || !data) return local;

    const remote: SwapHistoryRecord[] = data.map((row) => ({
      id: String(row.id),
      walletAddress: String(row.wallet_address),
      signature: row.tx_signature ? String(row.tx_signature) : null,
      inputMint: String(row.input_mint),
      outputMint: String(row.output_mint),
      inputSymbol: String(row.input_symbol ?? ""),
      outputSymbol: String(row.output_symbol ?? ""),
      inputAmount: String(row.input_amount ?? ""),
      outputAmountEst: String(row.output_amount_est ?? ""),
      status: (row.status as SwapHistoryStatus) || "pending",
      priceImpactPct: row.price_impact_pct == null ? null : Number(row.price_impact_pct),
      timestamp: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
    }));

    const merged = new Map<string, SwapHistoryRecord>();
    for (const row of [...remote, ...local]) {
      merged.set(row.signature ?? row.id, row);
    }
    return [...merged.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL);
  } catch {
    return local;
  }
}
