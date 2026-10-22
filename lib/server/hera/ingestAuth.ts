import crypto from "node:crypto";
import { bearerFromAuthorization, bearerMatchesKey, type HeraIntelEnv } from "./partnerAuth.js";

/** Alexus -> Hera report ingest. Uses its own secret, never SYNEXUS_TITAN_API_KEY. */
export const HERA_INGEST_MIN_TOKEN_LENGTH = 32;

const DUMMY_BEARER = "synexus-hera-ingest-dummy-bearer";

export type HeraIngestBearerAuth =
  | { ok: true; keyId: string }
  | { ok: false; status: 401 | 503; error: "unauthorized" | "ingest_auth_unconfigured" };

function configuredToken(env: HeraIntelEnv): string {
  const raw = env.HERA_INGEST_TOKEN;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Step 1, before the body is read: Bearer must equal HERA_INGEST_TOKEN. Fails closed when unset or short. */
export function authorizeHeraIngestBearer(
  header: string | string[] | undefined,
  env: HeraIntelEnv,
): HeraIngestBearerAuth {
  const expected = configuredToken(env);
  if (expected.length < HERA_INGEST_MIN_TOKEN_LENGTH) {
    return { ok: false, status: 503, error: "ingest_auth_unconfigured" };
  }
  const presented = bearerFromAuthorization(header);
  if (presented == null) {
    bearerMatchesKey(DUMMY_BEARER, expected);
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (!bearerMatchesKey(presented, expected)) return { ok: false, status: 401, error: "unauthorized" };
  const keyId = crypto.createHash("sha256").update(`ingest:${presented}`, "utf8").digest("hex").slice(0, 16);
  return { ok: true, keyId };
}

/** Header value `sha256=<64 hex>` or null. */
export function signatureFromHeader(header: string | string[] | undefined): Buffer | null {
  if (typeof header !== "string" || header.length > 100) return null;
  const match = /^sha256=([0-9a-fA-F]{64})$/.exec(header.trim());
  return match?.[1] ? Buffer.from(match[1], "hex") : null;
}

/** Step 2, after the body is read: HMAC-SHA256(token, rawBody) must match x-alexus-signature (constant time). */
export function verifyHeraIngestSignature(
  header: string | string[] | undefined,
  rawBody: string,
  env: HeraIntelEnv,
): boolean {
  const token = configuredToken(env);
  if (token.length < HERA_INGEST_MIN_TOKEN_LENGTH) return false;
  const expected = crypto.createHmac("sha256", token).update(rawBody, "utf8").digest();
  const presented = signatureFromHeader(header);
  if (!presented) {
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}
