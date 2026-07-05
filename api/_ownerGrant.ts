import crypto from "node:crypto";

type OwnerEnv = {
  SYNEXUS_OWNER_EMAIL?: string;
  SYNEXUS_OWNER_PASSWORD?: string;
  SYNEXUS_OWNER_SIGNING_KEY?: string;
};

function signingKey(env: OwnerEnv): string {
  return env.SYNEXUS_OWNER_SIGNING_KEY?.trim() || env.SYNEXUS_OWNER_PASSWORD?.trim() || "";
}

export function verifyOwnerGrant(grant: string | undefined, env: OwnerEnv): boolean {
  const key = signingKey(env);
  const token = grant?.trim();
  if (!key || !token) return false;
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      e?: string;
      exp?: number;
      sig?: string;
    };
    if (!parsed.e || !parsed.exp || !parsed.sig) return false;
    if (Date.now() > parsed.exp) return false;
    const expected = crypto.createHmac("sha256", key).update(`${parsed.e}:${parsed.exp}`).digest("hex");
    const aa = Buffer.from(parsed.sig);
    const bb = Buffer.from(expected);
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}
