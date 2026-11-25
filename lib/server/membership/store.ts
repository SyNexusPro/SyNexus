import postgres from "postgres";
import { COMPLIMENTARY_TRIAL_DAYS, productTier, profilePlanForTier } from "./policy.js";

type Env = Record<string, string | undefined>;

const SCHEMA = `
create table if not exists public.membership_accounts (
  user_id uuid primary key,
  trial_started_at timestamptz,
  trial_used boolean not null default false,
  store_product_id text,
  store_status text,
  store_expires_at timestamptz,
  paddle_customer_id text,
  paddle_subscription_id text,
  updated_at timestamptz not null default now()
);
create table if not exists public.membership_webhook_events (
  event_id text primary key,
  user_id uuid,
  event_type text,
  received_at timestamptz not null default now()
);
alter table public.membership_accounts add column if not exists paddle_customer_id text;
alter table public.membership_accounts add column if not exists paddle_subscription_id text;
alter table public.membership_accounts enable row level security;
alter table public.membership_webhook_events enable row level security;
`;

export type MembershipRecord = {
  trialStartedAt: string | null;
  trialUsed: boolean;
  storeProductId: string | null;
  storeStatus: string | null;
  storeExpiresAt: string | null;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
};

export type ApplyWebhookInput = {
  eventId: string;
  userId: string;
  eventType: string;
  productId: string | null;
  status: string;
  expiresAt: string | null;
  /** When true, permanently consume the one-shot free-trial eligibility for this account. */
  markTrialUsed?: boolean;
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
  provider?: "paddle" | "revenuecat" | "store";
};

export type ApplyWebhookResult = "applied" | "duplicate" | "unavailable" | "failed";

function connect(env: Env): postgres.Sql | null {
  const url = (env.SUPABASE_DB_URL || env.POSTGRES_URL || env.DATABASE_URL || "").trim();
  if (!url) return null;
  return postgres(url, { max: 1, idle_timeout: 1, connect_timeout: 8, onnotice: () => undefined });
}

async function ready(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(SCHEMA);
}

function mapRow(row: Record<string, unknown> | undefined): MembershipRecord {
  return {
    trialStartedAt: row?.trial_started_at ? new Date(String(row.trial_started_at)).toISOString() : null,
    trialUsed: Boolean(row?.trial_used),
    storeProductId: row?.store_product_id ? String(row.store_product_id) : null,
    storeStatus: row?.store_status ? String(row.store_status) : null,
    storeExpiresAt: row?.store_expires_at ? new Date(String(row.store_expires_at)).toISOString() : null,
    paddleCustomerId: row?.paddle_customer_id ? String(row.paddle_customer_id) : null,
    paddleSubscriptionId: row?.paddle_subscription_id ? String(row.paddle_subscription_id) : null,
  };
}

/** Store statuses that still grant membership access (including past_due during dunning). */
export function storeStatusGrantsAccess(status: string | null | undefined, expiresAt: string | null | undefined, now: number): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized || normalized === "expired" || normalized === "canceled" || normalized === "cancelled") return false;
  if (normalized === "active" || normalized === "billing_issue" || normalized === "trialing") {
    if (!expiresAt) return true;
    const expires = Date.parse(expiresAt);
    return !Number.isFinite(expires) || expires > now;
  }
  return false;
}

function profileValues(status: string, productId: string | null): { plan: "FREE" | "BASIC" | "PRO"; tier: "free" | "next_level" | "pantheon" } {
  if (status === "expired") return { plan: "FREE", tier: "free" };
  const mapped = productId ? productTier(productId) : null;
  if (!mapped) return { plan: "FREE", tier: "free" };
  const plan = profilePlanForTier(mapped, false);
  const tier = plan === "PRO" ? "pantheon" : plan === "BASIC" ? "next_level" : "free";
  return { plan, tier };
}

export async function readMembershipRecord(env: Env, userId: string): Promise<MembershipRecord | null> {
  const sql = connect(env);
  if (!sql) return null;
  try {
    await ready(sql);
    const rows = await sql<Record<string, unknown>[]>`
      select trial_started_at, trial_used, store_product_id, store_status, store_expires_at,
             paddle_customer_id, paddle_subscription_id
      from public.membership_accounts
      where user_id = ${userId}
      limit 1
    `;
    return mapRow(rows[0]);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function startComplimentaryTrial(env: Env, userId: string, now = new Date()): Promise<"started" | "used" | "unavailable"> {
  const sql = connect(env);
  if (!sql) return "unavailable";
  try {
    await ready(sql);
    const existing = await sql<{ trial_used: boolean; store_status: string | null; store_expires_at: Date | null }[]>`
      select trial_used, store_status, store_expires_at
      from public.membership_accounts
      where user_id = ${userId}
      limit 1
    `;
    const row = existing[0];
    if (row?.trial_used) return "used";
    const expires = row?.store_expires_at ? Date.parse(String(row.store_expires_at)) : NaN;
    const storeStillCovers =
      Boolean(row?.store_status) &&
      row?.store_status !== "expired" &&
      Number.isFinite(expires) &&
      expires > now.getTime();
    if (storeStillCovers) return "used";

    const inserted = await sql.begin(async (tx) => {
      const claimed = await tx<{ user_id: string }[]>`
        insert into public.membership_accounts (user_id, trial_started_at, trial_used, updated_at)
        values (${userId}, ${now.toISOString()}, true, now())
        on conflict (user_id) do update
          set trial_started_at = excluded.trial_started_at,
              trial_used = true,
              updated_at = now()
          where public.membership_accounts.trial_used = false
        returning user_id
      `;
      if (!claimed.length) return [] as { user_id: string }[];
      await tx`
        update public.profiles
        set paid_plan = 'BASIC'
        where id = ${userId} and paid_plan is distinct from 'BASIC'
      `;
      return claimed;
    });
    if (!inserted.length) return "used";
    await syncProfilePlan(env, userId, "BASIC");
    return "started";
  } catch (error) {
    console.error("[membership] complimentary grant failed", error);
    return "unavailable";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

/**
 * Atomically claim a webhook event and commit membership + profile updates together.
 * The event id is only persisted if the required writes succeed, so RevenueCat retries
 * remain safe after a mid-flight database failure.
 */
export async function applyWebhookEvent(env: Env, input: ApplyWebhookInput): Promise<ApplyWebhookResult> {
  const sql = connect(env);
  if (!sql) return "unavailable";
  try {
    await ready(sql);
    const { plan } = profileValues(input.status, input.productId);
    const markTrial = Boolean(input.markTrialUsed);
    const paddleCustomerId = input.paddleCustomerId?.trim() || null;
    const paddleSubscriptionId = input.paddleSubscriptionId?.trim() || null;
    const result = await sql.begin(async (tx) => {
      const claimed = await tx<{ event_id: string }[]>`
        insert into public.membership_webhook_events (event_id, user_id, event_type)
        values (${input.eventId}, ${input.userId}, ${input.eventType})
        on conflict (event_id) do nothing
        returning event_id
      `;
      if (!claimed.length) return "duplicate" as const;

      await tx`
        insert into public.membership_accounts (
          user_id, store_product_id, store_status, store_expires_at,
          trial_used, trial_started_at, paddle_customer_id, paddle_subscription_id, updated_at
        )
        values (
          ${input.userId}, ${input.productId}, ${input.status}, ${input.expiresAt},
          ${markTrial}, ${markTrial ? new Date().toISOString() : null},
          ${paddleCustomerId}, ${paddleSubscriptionId}, now()
        )
        on conflict (user_id) do update
          set store_product_id = excluded.store_product_id,
              store_status = excluded.store_status,
              store_expires_at = excluded.store_expires_at,
              paddle_customer_id = coalesce(excluded.paddle_customer_id, public.membership_accounts.paddle_customer_id),
              paddle_subscription_id = coalesce(excluded.paddle_subscription_id, public.membership_accounts.paddle_subscription_id),
              trial_used = public.membership_accounts.trial_used or excluded.trial_used,
              trial_started_at = coalesce(public.membership_accounts.trial_started_at, excluded.trial_started_at),
              updated_at = now()
      `;

      await tx`
        update public.profiles
        set paid_plan = ${plan}
        where id = ${input.userId} and paid_plan is distinct from ${plan}
      `;
      return "applied" as const;
    });
    if (result === "applied") {
      await syncProfilePlan(env, input.userId, plan);
    }
    return result;
  } catch (error) {
    console.error("[membership] webhook apply failed", error);
    return "failed";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export async function syncProfilePlan(
  env: Env,
  userId: string,
  plan: "FREE" | "BASIC" | "PRO",
): Promise<void> {
  const sql = connect(env);
  if (!sql) return;
  const tier = plan === "PRO" ? "pantheon" : plan === "BASIC" ? "next_level" : "free";
  try {
    await sql`
      update public.profiles
      set paid_plan = ${plan}
      where id = ${userId} and paid_plan is distinct from ${plan}
    `;
    try {
      await sql`
        update public.profiles
        set membership_tier = ${tier}
        where id = ${userId} and membership_tier is distinct from ${tier}
      `;
    } catch {
      /* The tier column is added by the membership migration. */
    }
  } catch {
    /* A profile write must not block a membership read. */
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

export function trialEndsAt(startedAt: string | null): string | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + COMPLIMENTARY_TRIAL_DAYS * 86_400_000).toISOString();
}

/** In-memory webhook ledger for integration tests without a live database. */
export function createMemoryWebhookLedger() {
  const events = new Set<string>();
  const accounts = new Map<string, MembershipRecord>();
  let failNextWrite = false;

  return {
    failNextWrite() {
      failNextWrite = true;
    },
    getAccount(userId: string) {
      return accounts.get(userId) ?? null;
    },
    async apply(input: ApplyWebhookInput): Promise<ApplyWebhookResult> {
      if (events.has(input.eventId)) return "duplicate";
      if (failNextWrite) {
        failNextWrite = false;
        return "failed";
      }
      events.add(input.eventId);
      const prior = accounts.get(input.userId);
      accounts.set(input.userId, {
        trialStartedAt: prior?.trialStartedAt ?? (input.markTrialUsed ? new Date().toISOString() : null),
        trialUsed: Boolean(prior?.trialUsed || input.markTrialUsed),
        storeProductId: input.productId,
        storeStatus: input.status,
        storeExpiresAt: input.expiresAt,
        paddleCustomerId: input.paddleCustomerId ?? prior?.paddleCustomerId ?? null,
        paddleSubscriptionId: input.paddleSubscriptionId ?? prior?.paddleSubscriptionId ?? null,
      });
      return "applied";
    },
  };
}
