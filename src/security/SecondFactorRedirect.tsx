import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isBackgroundAuthRefresh } from "../lib/authEvents";
import { isEmailVerified } from "../lib/emailVerification";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { supabase } from "../lib/supabaseClient";
import {
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  resolveMfaContinue,
} from "./mfa";

/**
 * After email, Google, or a restored session, send the operator to the
 * second sign-in check. Waits until the auth client has finished the
 * OAuth code exchange so the redirect does not wipe the return URL first.
 */
export function SecondFactorRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/god" || location.pathname.startsWith("/god/")) return;
    if (hasStoredOwnerGrant()) {
      if (
        location.pathname === MFA_SETUP_PATH ||
        location.pathname === MFA_VERIFY_PATH
      ) {
        navigate("/pulse", { replace: true });
      }
      return;
    }
    if (!supabase) return;
    if (
      location.pathname === MFA_SETUP_PATH ||
      location.pathname === MFA_VERIFY_PATH
    ) return;

    let alive = true;

    async function sendIfNeeded() {
      if (!alive || hasStoredOwnerGrant()) return;
      const params = new URLSearchParams(window.location.search);
      if (params.has("code") || params.has("error") || params.has("error_description")) return;
      const user = await getVerifiedSessionUser();
      if (!alive || !user || !isEmailVerified(user) || isMfaPolicyExemptEmail(user.email)) return;
      const next = await resolveMfaContinue(user);
      if (!alive) return;
      if (next.action === "setup" || next.action === "verify") {
        navigate(next.path, { replace: true, state: { from: location.pathname } });
      }
    }

    const first = window.setTimeout(() => {
      void sendIfNeeded();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || isBackgroundAuthRefresh(event)) return;
      window.setTimeout(() => {
        void sendIfNeeded();
      }, 0);
    });

    return () => {
      alive = false;
      window.clearTimeout(first);
      subscription.unsubscribe();
    };
  }, [location.pathname, navigate]);

  return null;
}
