import postgres from "postgres";
import { composeOwnerBrief, type OwnerBrief, type OwnerBriefFacts } from "./briefFormat.js";

type Env = Record<string, string | undefined>;

const CACHE_MS = 5 * 60 * 1000;

let cache: { at: number; brief: OwnerBrief } | null = null;

function databaseUrl(env: Env): string {
  return (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
}

function emptyFacts(asOf: string, databaseReachable: boolean): OwnerBriefFacts {
  return {
    asOf,
    databaseReachable,
    swapsConfirmed: null,
    swapsFailed: null,
    swapsPending: null,
    signups: null,
    accounts: null,
    newAccounts: null,
    members: null,
    activeSubscriptions: null,
    recordedRevenueUsd: null,
    securityEvents: null,
    criticalSecurityEvents: null,
    dailyDigestRows: null,
  };
}

async function scalar(query: PromiseLike<{ n?: unknown }[]>): Promise<number | null> {
  try {
    const rows = await query;
    const value = Number(rows[0]?.n);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Read aggregate counts only. Wallet addresses, emails, and payment ids are never selected. */
export async function collectOwnerBrief(env: Env, now = new Date()): Promise<OwnerBrief> {
  if (cache && now.getTime() - cache.at < CACHE_MS) return cache.brief;

  const asOf = now.toISOString();
  const url = databaseUrl(env);
  if (!url) return composeOwnerBrief(emptyFacts(asOf, false));

  const sql = postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8 });
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  try {
    await sql`select 1 as n`;
    const facts = emptyFacts(asOf, true);
    const [confirmed, failed, pending, signups, accounts, newAccounts, members, active, revenue, security, critical, digest] =
      await Promise.all([
        scalar(
          sql`select count(*)::int as n from public.swap_history where created_at > ${since}::timestamptz and status = 'confirmed'`,
        ),
        scalar(
          sql`select count(*)::int as n from public.swap_history where created_at > ${since}::timestamptz and status = 'failed'`,
        ),
        scalar(
          sql`select count(*)::int as n from public.swap_history where created_at > ${since}::timestamptz and status = 'pending'`,
        ),
        scalar(
          sql`select count(*)::int as n from public.site_analytics_events where event_type = 'sign_up' and created_at > ${since}::timestamptz`,
        ),
        scalar(sql`select count(*)::int as n from auth.users`),
        scalar(sql`select count(*)::int as n from auth.users where created_at > ${since}::timestamptz`),
        scalar(sql`select count(*)::int as n from public.profiles`),
        scalar(sql`select count(*)::int as n from public.profiles where subscription_status = 'active'`),
        scalar(
          sql`select coalesce(sum(amount_usd), 0)::float as n from public.treasury_revenue where created_at > ${since}::timestamptz`,
        ),
        scalar(sql`select count(*)::int as n from public.security_events where created_at > ${since}::timestamptz`),
        scalar(
          sql`select count(*)::int as n from public.security_events where severity = 'critical' and created_at > ${since}::timestamptz`,
        ),
        scalar(
          sql`select count(*)::int as n from public.titan_events where type = 'DAILY_BRIEF' and created_at > ${since}::timestamptz`,
        ),
      ]);

    facts.swapsConfirmed = confirmed;
    facts.swapsFailed = failed;
    facts.swapsPending = pending;
    facts.signups = signups;
    facts.accounts = accounts;
    facts.newAccounts = newAccounts;
    facts.members = members;
    facts.activeSubscriptions = active;
    facts.recordedRevenueUsd = revenue;
    facts.securityEvents = security;
    facts.criticalSecurityEvents = critical;
    facts.dailyDigestRows = digest;

    const brief = composeOwnerBrief(facts);
    cache = { at: now.getTime(), brief };
    return brief;
  } catch {
    return composeOwnerBrief(emptyFacts(asOf, false));
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function clearOwnerBriefCache(): void {
  cache = null;
}
