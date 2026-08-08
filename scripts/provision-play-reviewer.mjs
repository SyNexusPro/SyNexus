#!/usr/bin/env node
/**
 * Create / update the Google Play reviewer account (confirmed email + Pro access).
 *
 *   set GOOGLE_PLAY_REVIEW_PASSWORD=...
 *   npm run play:provision-reviewer
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY (JWT or sb_secret_).
 * Falls back to publishable/anon signup + sign-in when admin API key is invalid.
 *
 * Optional: GOOGLE_PLAY_REVIEW_EMAIL (default google-review@synexus.pro)
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_EMAIL = "google-review@synexus.pro";
const DEFAULT_USERNAME = "google_review";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
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

const email = (env.GOOGLE_PLAY_REVIEW_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
const password = env.GOOGLE_PLAY_REVIEW_PASSWORD || "";

if (!url) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_URL");
  process.exit(1);
}
if (!password || password.length < 10) {
  console.error("Set GOOGLE_PLAY_REVIEW_PASSWORD (min 10 chars) in the environment.");
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
      display_name: "Google Play Reviewer",
      paid_plan: "PRO",
    },
    {
      id: userId,
      username: DEFAULT_USERNAME,
      display_name: "Google Play Reviewer",
    },
  ];
  for (const row of payloads) {
    const { error } = await client.from("profiles").upsert(row);
    if (!error) {
      if (!("paid_plan" in row)) {
        console.log(
          "Profile saved without paid_plan (column missing on remote). Client play_review grant still unlocks Pro.",
        );
      } else {
        console.log("Profile paid_plan = PRO");
      }
      return;
    }
    const msg = error.message || "";
    if (/paid_plan|schema cache/i.test(msg)) continue;
    if (/row-level security|rls/i.test(msg)) {
      console.log(
        "Profile upsert blocked by RLS — OK. App grants Pro via play_review for this email on sign-in.",
      );
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
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: DEFAULT_USERNAME, play_reviewer: true },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user ${user.id} (admin)`);
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        username: DEFAULT_USERNAME,
        play_reviewer: true,
      },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Updated auth user ${user.id} (admin)`);
  }

  await upsertProfile(admin, user.id);
}

async function provisionViaPublicAuth() {
  if (!publishable) {
    throw new Error("No usable publishable/anon key for signup fallback");
  }
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
      options: { data: { username: DEFAULT_USERNAME, play_reviewer: true } },
    });
    if (error) throw error;
    userId = data.user?.id ?? null;
    if (!userId) throw new Error("Signup returned no user id");
    console.log(`Created auth user ${userId} (public signup)`);
    if (!data.session) {
      console.log(
        "No session yet — confirm email in Supabase Auth (or disable confirm for this user), then re-run.",
      );
      return;
    }
  }

  await upsertProfile(client, userId);
  const verify = await client.auth.signInWithPassword({ email, password });
  if (verify.error) throw verify.error;
  console.log("Password sign-in verified");
}

async function main() {
  console.log("\nGoogle Play reviewer provision");
  console.log(`Email: ${email}`);

  if (serviceKey) {
    try {
      await provisionViaAdmin();
      console.log("Done — use this account in Play Console → App access.\n");
      return;
    } catch (err) {
      console.warn(`Admin API failed (${err.message || err}); trying public signup fallback…`);
    }
  } else {
    console.warn("No JWT/sb_secret service key found; using public signup fallback…");
  }

  await provisionViaPublicAuth();
  console.log("Done — use this account in Play Console → App access.\n");
  console.log(
    "Tip: paste the legacy service_role JWT (eyJ…) into SUPABASE_SERVICE_ROLE_KEY for admin confirm + paid_plan upserts.",
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
