import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { IncomingMessage } from "node:http";

export type TitanAuthPlan = {
  userId: string | null;
  email: string | null;
  plan: "FREE" | "PRO";
  authenticated: boolean;
};

type Env = Record<string, string | undefined>;

function adminClient(env: Env): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(env: Env): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerFromRequest(req: IncomingMessage): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * Resolve plan from Supabase session. Never trust client-claimed PRO.
 * Unauthenticated users stay FREE (Titan still works).
 */
export async function resolveTitanAuthPlan(
  req: IncomingMessage,
  env: Env,
): Promise<TitanAuthPlan> {
  const token = bearerFromRequest(req);
  if (!token) {
    return { userId: null, email: null, plan: "FREE", authenticated: false };
  }

  const anon = anonClient(env);
  if (!anon) {
    return { userId: null, email: null, plan: "FREE", authenticated: false };
  }

  let user: User | null = null;
  try {
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) {
      return { userId: null, email: null, plan: "FREE", authenticated: false };
    }
    user = data.user;
  } catch {
    return { userId: null, email: null, plan: "FREE", authenticated: false };
  }

  const admin = adminClient(env);
  if (!admin) {
    return {
      userId: user.id,
      email: user.email ?? null,
      plan: "FREE",
      authenticated: true,
    };
  }

  try {
    const { data } = await admin
      .from("profiles")
      .select("paid_plan, subscription_status, invite_reward_until")
      .eq("id", user.id)
      .maybeSingle();

    let plan: "FREE" | "PRO" =
      data?.paid_plan === "PRO" || data?.subscription_status === "active" ? "PRO" : "FREE";

    const inviteUntil = data?.invite_reward_until
      ? Date.parse(String(data.invite_reward_until))
      : NaN;
    if (Number.isFinite(inviteUntil) && Date.now() < inviteUntil) {
      plan = "PRO";
    }

    // Shared tester login — honor metadata expiry (30-day window)
    const email = (user.email || "").trim().toLowerCase();
    const metaUntil = user.user_metadata?.tester_pro_until;
    const untilMs =
      typeof metaUntil === "string"
        ? Date.parse(metaUntil)
        : typeof metaUntil === "number"
          ? metaUntil
          : NaN;
    if (email === "tester@synexus.pro") {
      plan = Number.isFinite(untilMs) && Date.now() < untilMs ? "PRO" : "FREE";
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      plan,
      authenticated: true,
    };
  } catch {
    return {
      userId: user.id,
      email: user.email ?? null,
      plan: "FREE",
      authenticated: true,
    };
  }
}

export function supabaseAdminFromEnv(env: Env): SupabaseClient | null {
  return adminClient(env);
}
