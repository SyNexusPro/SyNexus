import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { recordSecurityEvent } from "./securityEvents";

export const PHONE_RESEND_SECONDS = 60;
const AUTH_REQUEST_TIMEOUT_MS = 18_000;

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

export function isPhoneVerified(user: User | null | undefined): boolean {
  return Boolean(user?.phone?.trim() && user.phone_confirmed_at);
}

let freshUserRequest: Promise<User | null> | null = null;
let freshUserCache: { user: User | null; at: number } | null = null;
const FRESH_USER_TTL_MS = 5_000;

/** Server-confirmed user, deduplicated so auth listeners do not stampede /user. */
export async function getFreshAuthUser(): Promise<User | null> {
  if (!supabase) return null;
  if (freshUserCache && Date.now() - freshUserCache.at < FRESH_USER_TTL_MS) return freshUserCache.user;
  if (freshUserRequest) return freshUserRequest;
  const client = supabase;
  freshUserRequest = (async () => {
    try {
      const { data, error } = await withAuthTimeout(client.auth.getUser());
      const user = error ? null : data.user;
      freshUserCache = { user, at: Date.now() };
      return user;
    } catch {
      return null;
    } finally {
      freshUserRequest = null;
    }
  })();
  return freshUserRequest;
}

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

function phoneError(message: string, fallback: string, kind: "send" | "verify"): Error {
  const text = message.trim();
  if (/rate|limit|too many/i.test(text)) {
    return new Error("Too many SMS requests. Please wait before trying again.");
  }
  if (kind === "verify") {
    if (/expired/i.test(text)) return new Error("That code expired. Send a new code and try again.");
    if (/invalid|incorrect|mismatch|token/i.test(text)) {
      return new Error("That verification code is invalid.");
    }
  }
  return new Error(text || fallback);
}

export async function listPhoneMfaFactors(verifiedOnly = true): Promise<PhoneMfaFactor[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await withAuthTimeout(supabase.auth.mfa.listFactors());
    if (error || !data) return [];
    return (data.phone ?? [])
      .filter((factor) => !verifiedOnly || factor.status === "verified")
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name || "SyNexus Phone",
        status: factor.status,
        phone: "phone" in factor && typeof factor.phone === "string" ? factor.phone : null,
      }));
  } catch {
    return [];
  }
}

/** Sends a 6-digit SMS via Supabase Phone Auth / Twilio Verify. Does not store the OTP. */
export async function sendPhoneVerificationSms(value: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const phone = normalizePhoneNumber(value);
  if (!phone) throw new Error("Enter a valid mobile number including country code, such as +1 555 123 4567.");

  const { error } = await withAuthTimeout(supabase.auth.updateUser({ phone }));
  if (error) {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw phoneError(error.message, "Could not send the verification code.", "send");
  }
  void recordSecurityEvent({ eventType: "phone_verification_sent", success: true });
  return phone;
}

export async function verifyPhoneSmsCode(phoneValue: string, code: string): Promise<User> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const phone = normalizePhoneNumber(phoneValue);
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (!phone) throw new Error("Enter a valid mobile number and request a new code.");
  if (digits.length !== 6) throw new Error("Enter the complete 6-digit verification code.");

  const { data, error } = await withAuthTimeout(
    supabase.auth.verifyOtp({
      phone,
      token: digits,
      type: "phone_change",
    }),
  );
  if (error) {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw phoneError(error.message, "That verification code is invalid.", "verify");
  }

  freshUserCache = null;
  let user = data.user && isPhoneVerified(data.user) ? data.user : await getFreshAuthUser();
  if (!isPhoneVerified(user)) {
    freshUserCache = null;
    user = await getFreshAuthUser();
  }
  if (!user || !isPhoneVerified(user)) {
    void recordSecurityEvent({ eventType: "phone_verification_failure", success: false });
    throw new Error("Phone verification did not finish. Send a new code and try again.");
  }

  // Persist the verified phone into the stored session so guards read it locally.
  const client = supabase;
  void withAuthTimeout(client.auth.refreshSession()).catch(() => {
    /* guards fall back to getFreshAuthUser */
  });
  void recordSecurityEvent({ eventType: "phone_verification_success", success: true });
  return user;
}
