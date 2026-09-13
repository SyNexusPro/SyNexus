import { supabase } from "../lib/supabaseClient";
import { recordSecurityEvent } from "./securityEvents";

export const PASSKEYS_ENABLED = import.meta.env.VITE_SYNEXUS_PASSKEYS === "true";

export function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function"
  );
}

export function passkeysAvailable(): boolean {
  return PASSKEYS_ENABLED && browserSupportsPasskeys() && Boolean(supabase);
}

type MfaClient = {
  enroll: (args: { factorType: string; friendlyName: string }) => Promise<{
    data: { id?: string } | null;
    error: { message?: string } | null;
  }>;
};

/** Experimental — TOTP remains the required factor. */
export async function enrollDevicePasskey(): Promise<void> {
  if (!passkeysAvailable() || !supabase) {
    throw new Error("Passkeys are not available on this device yet.");
  }
  const mfa = supabase.auth.mfa as unknown as MfaClient;
  const { error } = await mfa.enroll({
    factorType: "webauthn",
    friendlyName: "SyNexus Device Passkey",
  });
  if (error) {
    throw new Error("Passkeys are not enabled on this project yet. Authenticator MFA still protects your account.");
  }
  void recordSecurityEvent({ eventType: "passkey_added", success: true });
}
