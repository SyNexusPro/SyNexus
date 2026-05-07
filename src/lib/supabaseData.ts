import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

function flattenErrorDiagnostics(err: unknown): string {
  const parts: string[] = [];
  const visit = (e: unknown): void => {
    if (e == null || typeof e === "boolean") return;
    if (typeof e === "string") {
      parts.push(e);
      return;
    }
    if (typeof e !== "object") return;
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.details === "string") parts.push(o.details);
    if (typeof o.hint === "string") parts.push(o.hint);
    if (typeof o.code === "string" || typeof o.code === "number") parts.push(String(o.code));
    if ("cause" in o && o.cause !== e) visit(o.cause);
  };
  visit(err);
  return parts.join(" ");
}

/**
 * Missing tables/functions (often `… does not exist`, PGRST schema cache) sometimes bubble up via auth
 * triggers or hooks; map to a concrete fix instead of a raw Postgres string.
 */
function throwIfStructuralDbFailure(err: unknown): never {
  const blob = flattenErrorDiagnostics(err).toLowerCase();
  const plainAuth =
    blob.includes("invalid login credentials") ||
    blob.includes("invalid_grant") ||
    blob.includes("invalid email") ||
    blob.includes("email not confirmed") ||
    blob.includes("email address not authorized") ||
    blob.includes("user already registered");

  const structural =
    blob.includes("does not exist") ||
    blob.includes("undefined_table") ||
    blob.includes("undefined function") ||
    blob.includes("42p01") || // undefined_table
    blob.includes("42883") || // undefined_function
    blob.includes("could not find the table") ||
    blob.includes("schema cache") ||
    blob.includes("pgrst205");

  if (!plainAuth && structural) {
    throw new Error(
      "Supabase is missing HiveMind tables or a database object (often guardian_alerts, profiles, or a trigger target). Run supabase/hivemind-complete-schema.sql in the Supabase SQL Editor for this project, then try again.",
    );
  }

  throw err instanceof Error ? err : new Error(flattenErrorDiagnostics(err) || "Unexpected error");
}

type AppProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  paid_plan?: "FREE" | "BASIC" | "PRO" | null;
};

export type WatchlistRecord = {
  id: string;
  name: string;
  token_symbol: string;
  token_name: string;
};

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throwIfStructuralDbFailure(error);
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throwIfStructuralDbFailure(error);
  let session: Session | null = data.session;
  let user: User | null = data.user;
  if (user && !session) {
    const { data: refreshed } = await supabase.auth.getSession();
    session = refreshed.session;
    user = refreshed.session?.user ?? user;
  }
  return { ...data, session, user };
}

export async function signOut() {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user ?? null;
}

export async function upsertProfile(userId: string, displayName: string, username: string) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: displayName,
    username,
  });
  if (error) throw error;
}

export async function updatePaidPlan(userId: string, paidPlan: "FREE" | "BASIC" | "PRO") {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    paid_plan: paidPlan,
  });
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<AppProfile | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, paid_plan")
      .eq("id", userId)
      .maybeSingle();
    if (!error) return data;

    const fallback = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!fallback.error) return fallback.data as AppProfile | null;
  } catch {
    /* empty profile / missing table / RLS — do not break auth */
  }
  return null;
}

export async function createWatchlist(userId: string, name: string) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { data, error } = await supabase
    .from("watchlists")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function addWatchlistToken(
  watchlistId: string,
  tokenSymbol: string,
  tokenName: string,
  tokenAddress?: string,
) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.from("watchlist_tokens").insert({
    watchlist_id: watchlistId,
    token_symbol: tokenSymbol,
    token_name: tokenName,
    token_address: tokenAddress ?? null,
  });
  if (error) throw error;
}

export async function fetchWatchlistTokens(userId: string): Promise<WatchlistRecord[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("watchlists")
      .select("id, name, watchlist_tokens(token_symbol, token_name)")
      .eq("user_id", userId);
    if (error) return [];

    return (data ?? []).flatMap((item) =>
      (item.watchlist_tokens ?? []).map((token) => ({
        id: item.id,
        name: item.name,
        token_symbol: token.token_symbol,
        token_name: token.token_name,
      })),
    );
  } catch {
    return [];
  }
}

export async function submitTokenReport(
  userId: string,
  tokenSymbol: string,
  tokenName: string,
  reason: string,
  tokenAddress?: string,
  details?: string,
) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.from("token_reports").insert({
    user_id: userId,
    token_symbol: tokenSymbol,
    token_name: tokenName,
    token_address: tokenAddress ?? null,
    reason,
    details: details ?? null,
  });
  if (error) throw error;
}

export async function fetchGuardianAlerts() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("guardian_alerts")
      .select("id, token_symbol, severity, title, message, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function upsertTrackedToken(input: {
  tokenSymbol: string;
  tokenName: string;
  tokenAddress?: string;
  chain?: string;
  price?: number;
  volume24h?: number;
  liquidity?: number;
  marketCap?: number;
  guardianScore?: number;
  guardianStatus?: "SAFE" | "WARNING" | "DANGER";
}) {
  if (!supabase) throw new Error("Supabase env vars are missing.");
  const { error } = await supabase.from("tracked_tokens").upsert({
    token_symbol: input.tokenSymbol,
    token_name: input.tokenName,
    token_address: input.tokenAddress ?? null,
    chain: input.chain ?? "solana",
    price: input.price ?? null,
    volume_24h: input.volume24h ?? null,
    liquidity: input.liquidity ?? null,
    market_cap: input.marketCap ?? null,
    guardian_score: input.guardianScore ?? null,
    guardian_status: input.guardianStatus ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchTrackedTokens() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("tracked_tokens")
      .select(
        "id, token_symbol, token_name, chain, price, volume_24h, liquidity, market_cap, guardian_score, guardian_status, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
