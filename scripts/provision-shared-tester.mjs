#!/usr/bin/env node
/**
 * Create / update the shared 30-day tester login (all testers use one account).
 *
 *   set SHARED_TESTER_PASSWORD=...
 *   node scripts/provision-shared-tester.mjs
 *
 * Default email: tester@synexus.pro
 * Pro until: 2026-09-15 (30 days from 2026-08-16)
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_EMAIL = "tester@synexus.pro";
const DEFAULT_USERNAME = "shared_tester";
const PRO_UNTIL = "2026-09-15T23:59:59.000Z";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function looksLikeApiKey(key) {
  if (!key || key.length < 20) return false;
  if (key.startsWith("eyJ")) return true;
  if (key.startsWith("sb_secret_") || key.startsWith("sb_publishable_")) return true;
  return false;
}

const fileEnv = {
  ...readEnvFile(join(root, ".env")),
  ...readEnvFile(join(root, ".env.vercel.prod")),
  ...readEnvFile(join(root, ".env.vercel")),
};
const env = { ...fileEnv, ...process.env };

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const serviceKey =
  [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SECRET_KEY].find(looksLikeApiKey) || "";
const publishable =
  [env.VITE_SUPABASE_ANON_KEY, env.SUPABASE_ANON_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY].find(
    looksLikeApiKey,
  ) || "";

const email = (env.SHARED_TESTER_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
const password = env.SHARED_TESTER_PASSWORD || "";

if (!url) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_URL");
  process.exit(1);
}
if (!password || password.length < 10) {
  console.error("Set SHARED_TESTER_PASSWORD (min 10 chars).");
  process.exit(1);
}

async function findUserByEmail(admin, target) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = (data?.users ?? []).find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (!data?.users?.length || data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function upsertProfile(client, userId) {
  const payloads = [
    {
      id: userId,
      username: DEFAULT_USERNAME,
      display_name: "SyNexus Tester",
      paid_plan: "PRO",
      subscription_status: "active",
    },
    {
      id: userId,
      username: DEFAULT_USERNAME,
      display_name: "SyNexus Tester",
      paid_plan: "PRO",
    },
    {
      id: userId,
      username: DEFAULT_USERNAME,
      display_name: "SyNexus Tester",
    },
  ];
  for (const row of payloads) {
    const { error } = await client.from("profiles").upsert(row);
    if (!error) {
      console.log("Profile upserted:", Object.keys(row).join(", "));
      return;
    }
    const msg = error.message || "";
    if (/paid_plan|subscription_status|schema cache/i.test(msg)) continue;
    if (/row-level security|rls/i.test(msg)) {
      console.log("Profile upsert blocked by RLS — client grant still applies on sign-in.");
      return;
    }
    throw error;
  }
}

async function provisionViaAdmin() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user = await findUserByEmail(admin, email);
  const meta = {
    username: DEFAULT_USERNAME,
    shared_tester: true,
    tester_pro_until: PRO_UNTIL,
  };

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user ${user.id}`);
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), ...meta },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Updated auth user ${user.id}`);
  }

  await upsertProfile(admin, user.id);
}

async function provisionViaPublicAuth() {
  if (!publishable) throw new Error("No publishable/anon key for signup fallback");
  const client = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId = null;
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (!signIn.error && signIn.data.user) {
    userId = signIn.data.user.id;
    console.log(`Signed in existing user ${userId}`);
  } else {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: DEFAULT_USERNAME,
          shared_tester: true,
          tester_pro_until: PRO_UNTIL,
        },
      },
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
    if (!userId) throw new Error("Signup returned no user id");
    console.log(`Created auth user ${userId} (public signup)`);
    if (!data.session) {
      console.log("Confirm email in Supabase Auth, then re-run.");
      return;
    }
  }

  await upsertProfile(client, userId);
  const verify = await client.auth.signInWithPassword({ email, password });
  if (verify.error) throw verify.error;
  console.log("Password sign-in verified");
}

async function main() {
  console.log("\nShared tester provision");
  console.log(`Email: ${email}`);
  console.log(`Pro until: ${PRO_UNTIL}`);

  if (serviceKey) {
    try {
      await provisionViaAdmin();
      console.log("Done.\n");
      return;
    } catch (err) {
      console.warn(`Admin API failed (${err.message || err}); trying public signup…`);
    }
  } else {
    console.warn("No service role key; using public signup fallback…");
  }

  await provisionViaPublicAuth();
  console.log("Done.\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
