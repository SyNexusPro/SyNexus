import crypto from "node:crypto";

export const HERA_INTEL_MIN_KEY_LENGTH = 20;

const DUMMY_BEARER = "synexus-hera-intel-dummy-bearer";

export type HeraIntelEnv = Record<string, string | undefined>;

export type HeraIntelAuth =
  | { ok: true; keyId: string }
  | { ok: false; status: 401 | 503; error: "unauthorized" | "intel_auth_unconfigured" };

function configuredKey(env: HeraIntelEnv): string {
  const raw = env.SYNEXUS_TITAN_API_KEY;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

/** SHA-256 both sides so unequal lengths still compare in constant time. */
export function bearerMatchesKey(presented: string, expected: string): boolean {
  const left = crypto.createHash("sha256").update(presented, "utf8").digest();
  const right = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(left, right);
}

export function bearerFromAuthorization(header: string | string[] | undefined): string | null {
  if (typeof header !== "string" || header.length > 300) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token || token.length > 256) return null;
  return token;
}

/**
 * Partner auth for POST /api/hera/intel.
 * Reads only SYNEXUS_TITAN_API_KEY. A missing or short key fails closed.
 */
export function authorizeHeraIntel(
  header: string | string[] | undefined,
  env: HeraIntelEnv,
): HeraIntelAuth {
  const expected = configuredKey(env);
  if (expected.length < HERA_INTEL_MIN_KEY_LENGTH) {
    return { ok: false, status: 503, error: "intel_auth_unconfigured" };
  }

  const presented = bearerFromAuthorization(header);
  if (presented == null) {
    bearerMatchesKey(DUMMY_BEARER, expected);
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (!bearerMatchesKey(presented, expected)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const keyId = crypto.createHash("sha256").update(presented, "utf8").digest("hex").slice(0, 16);
  return { ok: true, keyId };
}
