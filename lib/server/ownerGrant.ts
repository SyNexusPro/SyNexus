import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";

type OwnerEnv = Record<string, string | undefined>;

export const OWNER_GRANT_HEADER = "x-synexus-owner-grant";

export function ownerSigningKey(env: OwnerEnv): string {
  return env.SYNEXUS_OWNER_SIGNING_KEY?.trim() || env.SYNEXUS_OWNER_PASSWORD?.trim() || "";
}

function secretEqual(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

export function signOwnerGrant(email: string, expiresAt: number, env: OwnerEnv): string | null {
  const key = ownerSigningKey(env);
  if (!key) return null;
  const sig = crypto.createHmac("sha256", key).update(`${email}:${expiresAt}`).digest("hex");
  return Buffer.from(JSON.stringify({ e: email, exp: expiresAt, sig })).toString("base64url");
}

/** Returns the owner email when the grant was signed by this server and has not expired. */
export function verifyOwnerGrant(grant: string, env: OwnerEnv): string | null {
  const key = ownerSigningKey(env);
  const expectedEmail = env.SYNEXUS_OWNER_EMAIL?.trim().toLowerCase();
  if (!key || !expectedEmail) return null;
  try {
    const parsed = JSON.parse(Buffer.from(grant, "base64url").toString("utf8")) as {
      e?: string;
      exp?: number;
      sig?: string;
    };
    if (!parsed.e || !parsed.exp || !parsed.sig) return null;
    if (Date.now() > parsed.exp) return null;
    if (!secretEqual(parsed.e.toLowerCase(), expectedEmail)) return null;
    const expected = crypto.createHmac("sha256", key).update(`${parsed.e}:${parsed.exp}`).digest("hex");
    return secretEqual(parsed.sig, expected) ? parsed.e : null;
  } catch {
    return null;
  }
}

export function ownerEmailFromRequest(req: IncomingMessage, env: OwnerEnv): string | null {
  const raw = req.headers[OWNER_GRANT_HEADER];
  const grant = Array.isArray(raw) ? raw[0] : raw;
  if (!grant?.trim()) return null;
  return verifyOwnerGrant(grant.trim(), env);
}
