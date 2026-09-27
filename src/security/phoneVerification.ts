import { supabase } from "../lib/supabaseClient";
import { recordSecurityEvent } from "./securityEvents";

export const PHONE_RESEND_SECONDS = 60;
const challengeRequests = new Map<string, Promise<string>>();
const AUTH_REQUEST_TIMEOUT_MS = 15_000;

async function withAuthTimeout<T>(request: PromiseLike<T>): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error("Supabase did not respond. Check your connection and try again.")),
          AUTH_REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export type PhoneMfaFactor = {
  id: string;
  friendlyName: string;
  status: string;
  phone: string | null;
};

export function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return null;
  return compact;
}

export function maskPhoneNumber(phone: string | null | undefined): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  const last = digits.slice(-4);
  return last ? `••• ••• ${last}` : "your phone";
}

function phoneError(message: string, fallback: string): Error {
  if (/rate|limit|too many/i.test(message)) {
    return new Error("Too many SMS requests. Please wait before trying again.");
  }
  if (/expired/i.test(message)) return new Error("That code expired. Send a new code and try again.");
  if (/invalid|incorrect|code/i.test(message)) return new Error("That verification code is invalid.");
  return new Error(message || fallback);
}

export async function listPhoneMfaFactors(verifiedOnly = true): Promise<PhoneMfaFactor[]> {
  if (!supabase) return [];
  const { data, error } = await withAuthTimeout(supabase.auth.mfa.listFactors());
  if (error || !data) return [];
  return (data.phone ?? [])
    .filter((factor) => !verifiedOnly || factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name || "SyNexus Phone",
      status: factor.status,
      phone: ("phone" in factor && typeof factor.phone === "string" ? factor.phone : null),
    }));
}

export async function enrollPhoneMfa(value: string): Promise<{ factorId: string; phone: string }> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const phone = normalizePhoneNumber(value);
  if (!phone) throw new Error("Enter a valid mobile number including country code, such as +1 555 123 4567.");

  const { data, error } = await withAuthTimeout(
    supabase.auth.mfa.enroll({
      factorType: "phone",
      phone,
      friendlyName: "SyNexus Phone",
    }),
  );
  if (error || !data?.id) {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw phoneError(error?.message ?? "", "Could not add that phone number.");
  }
  return { factorId: data.id, phone };
}

export async function challengePhoneMfa(factorId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const pending = challengeRequests.get(factorId);
  if (pending) return pending;
  const request = (async () => {
    const { data, error } = await withAuthTimeout(supabase.auth.mfa.challenge({ factorId }));
    if (error || !data?.id) {
      void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
      throw phoneError(error?.message ?? "", "Could not send the verification code.");
    }
    void recordSecurityEvent({ eventType: "phone_verification_sent", success: true });
    return data.id;
  })();
  challengeRequests.set(factorId, request);
  window.setTimeout(() => challengeRequests.delete(factorId), 1500);
  return request;
}

export async function verifyPhoneMfa(factorId: string, challengeId: string, code: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) throw new Error("Enter the complete 6-digit verification code.");

  const { error } = await withAuthTimeout(
    supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: digits,
    }),
  );
  if (error) {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw phoneError(error.message, "Verification failed. Send a new code and try again.");
  }

  await supabase.auth.refreshSession();
  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw new Error("Verification finished, but the secure session was not upgraded. Please try again.");
  }
  void recordSecurityEvent({ eventType: "phone_verification_success", success: true });
}

export async function unenrollPhoneFactor(factorId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw phoneError(error.message, "Could not remove that phone factor.");
}
