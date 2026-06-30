import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const STATE_PATH = join(REPO_ROOT, "marketing-ai", "output", "treasury", "pot-state.json");
const POLICY_PATH = join(REPO_ROOT, "marketing-ai", "treasuryPolicy.json");

const DEFAULT_STATE = {
  version: 1,
  startedAt: null,
  reinvestUntil: null,
  totalLoggedUsd: 0,
  entries: [],
  milestones: {},
};

export function treasuryPaths() {
  return { STATE_PATH, POLICY_PATH, REPO_ROOT };
}

export async function loadPolicy() {
  const raw = await readFile(POLICY_PATH, "utf8");
  return JSON.parse(raw);
}

export function allocateRevenue(amountUsd, allocation) {
  return allocation.map((row) => ({
    id: row.id,
    label: row.label,
    pct: row.pct,
    amountUsd: (amountUsd * row.pct) / 100,
  }));
}

function supabaseConfigFromEnv(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return { url: url.trim(), key: key.trim() };
}

async function supabaseFetch(config, path, options = {}) {
  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

export async function fetchSupabaseEntries(env = process.env) {
  const config = supabaseConfigFromEnv(env);
  if (!config) return [];

  const res = await supabaseFetch(
    config,
    "treasury_revenue?select=id,source,amount_usd,note,allocated,stripe_event_id,stripe_invoice_id,stripe_customer_id,created_at&order=created_at.asc",
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase treasury fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const rows = await res.json();
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    amountUsd: Number(row.amount_usd),
    note: row.note || "",
    allocated: row.allocated || [],
    stripeEventId: row.stripe_event_id,
    stripeInvoiceId: row.stripe_invoice_id,
    stripeCustomerId: row.stripe_customer_id,
    at: row.created_at,
    origin: "supabase",
  }));
}

async function insertSupabaseEntry(entry, env = process.env) {
  const config = supabaseConfigFromEnv(env);
  if (!config) return { inserted: false, reason: "no_supabase" };

  const res = await supabaseFetch(config, "treasury_revenue", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: entry.id,
      source: entry.source,
      amount_usd: entry.amountUsd,
      note: entry.note,
      allocated: entry.allocated,
      stripe_event_id: entry.stripeEventId || null,
      stripe_invoice_id: entry.stripeInvoiceId || null,
      stripe_customer_id: entry.stripeCustomerId || null,
    }),
  });

  if (res.status === 409) {
    return { inserted: false, reason: "duplicate" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase treasury insert failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { inserted: true };
}

export async function readLocalPotState() {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function writeLocalPotState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function entryKey(entry) {
  return entry.stripeInvoiceId || entry.stripeEventId || entry.id;
}

export async function readPotState(env = process.env) {
  const local = await readLocalPotState();
  let remote = [];
  try {
    remote = await fetchSupabaseEntries(env);
  } catch {
    remote = [];
  }

  const merged = new Map();
  for (const e of local.entries || []) {
    merged.set(entryKey(e), { ...e, origin: e.origin || "local" });
  }
  for (const e of remote) {
    merged.set(entryKey(e), e);
  }

  const entries = [...merged.values()].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const totalLoggedUsd = entries.reduce((sum, e) => sum + (Number(e.amountUsd) || 0), 0);

  return { ...local, entries, totalLoggedUsd };
}

export async function ensureGrowthPhase(env = process.env) {
  const policy = await loadPolicy();
  const state = await readLocalPotState();
  if (!state.startedAt) {
    const now = new Date();
    const until = new Date(now);
    until.setMonth(until.getMonth() + policy.reinvestMonths);
    state.startedAt = now.toISOString();
    state.reinvestUntil = until.toISOString();
    await writeLocalPotState(state);
  }
  return { policy, state };
}

/**
 * Log revenue — idempotent on stripeInvoiceId / stripeEventId.
 * Writes Supabase (production) + local JSON (VPS / dev).
 */
export async function logRevenue({
  source,
  amountUsd,
  note = "",
  stripeEventId = null,
  stripeInvoiceId = null,
  stripeCustomerId = null,
  env = process.env,
}) {
  const { policy, state } = await ensureGrowthPhase(env);
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error("amountUsd must be a positive number");
  }

  const full = await readPotState(env);
  const exists = (full.entries || []).some(
    (e) =>
      (stripeInvoiceId && e.stripeInvoiceId === stripeInvoiceId) ||
      (stripeEventId && e.stripeEventId === stripeEventId),
  );
  if (exists) {
    return { skipped: true, reason: "duplicate", state: full, policy };
  }

  const entry = {
    id: randomUUID(),
    source,
    amountUsd: amt,
    note,
    allocated: allocateRevenue(amt, policy.allocation),
    stripeEventId,
    stripeInvoiceId,
    stripeCustomerId,
    at: new Date().toISOString(),
    origin: "local",
  };

  await insertSupabaseEntry(entry, env);

  state.entries.push(entry);
  state.totalLoggedUsd = (state.totalLoggedUsd || 0) + amt;
  await writeLocalPotState(state);

  return { skipped: false, entry, state, policy };
}

export async function aggregateBuckets(state, policy) {
  const byBucket = {};
  for (const row of policy.allocation) {
    byBucket[row.id] = { label: row.label, pct: row.pct, totalUsd: 0 };
  }
  for (const entry of state.entries || []) {
    for (const slice of entry.allocated || []) {
      const id = slice.id;
      if (byBucket[id]) byBucket[id].totalUsd += Number(slice.amountUsd) || 0;
    }
  }
  return byBucket;
}
