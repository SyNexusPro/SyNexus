#!/usr/bin/env node
/**
 * Unban / confirm the owner command email in Supabase Auth.
 *   npm run owner:enable
 *
 * Uses SYNEXUS_OWNER_EMAIL + SYNEXUS_OWNER_PASSWORD from .env
 * and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  return key.startsWith("eyJ") || key.startsWith("sb_secret_") || key.startsWith("sb_publishable_");
}

const env = {
  ...readEnvFile(join(root, ".env")),
  ...readEnvFile(join(root, ".env.vercel.prod")),
  ...readEnvFile(join(root, ".env.vercel")),
  ...process.env,
};

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const serviceKey =
  [env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SECRET_KEY].find(looksLikeApiKey) || "";
const email = (env.SYNEXUS_OWNER_EMAIL || "").trim().toLowerCase();
const password = env.SYNEXUS_OWNER_PASSWORD || "";

if (!url) {
  console.error("Missing VITE_SUPABASE_URL / SUPABASE_URL");
  process.exit(1);
}
if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY (admin JWT or sb_secret_).");
  process.exit(1);
}
if (!email || !password) {
  console.error("Missing SYNEXUS_OWNER_EMAIL / SYNEXUS_OWNER_PASSWORD in .env");
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

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\nEnable owner Auth user");
  console.log(`Email: ${email}`);

  let user = await findUserByEmail(admin, email);
  const payload = {
    password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      ...(user?.user_metadata || {}),
      owner: true,
    },
  };

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { owner: true },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created ${user.id} (confirmed, not banned)`);
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, payload);
    if (error) throw error;
    user = data.user;
    const banned = user.banned_until && new Date(user.banned_until).getTime() > Date.now();
    console.log(`Updated ${user.id}`);
    console.log(`Banned: ${banned ? user.banned_until : "no"}`);
    console.log(`Confirmed: ${user.email_confirmed_at ? "yes" : "no"}`);
  }

  console.log("Owner Auth user is enabled. God mode still works via /api/owner-unlock even if Auth is down.\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
