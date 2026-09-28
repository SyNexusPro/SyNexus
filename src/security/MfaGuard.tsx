import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { isBackgroundAuthRefresh } from "../lib/authEvents";
import { isEmailVerified } from "../lib/emailVerification";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import {
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  resolveMfaContinue,
} from "./mfa";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";

/** Require a verified phone MFA factor and an AAL2 session. */
export function MfaGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "setup" | "verify">("loading");

  useEffect(() => {
    let alive = true;

    async function decide(user: User | null) {
      if (!alive) return;
      if (!hasSupabaseEnv) {
        setState("ok");
        return;
      }
      if (!user || hasStoredOwnerGrant() || !isEmailVerified(user) || isMfaPolicyExemptEmail(user.email)) {
        setState("ok");
        return;
      }
      const next = await resolveMfaContinue(user);
      if (!alive) return;
      if (next.action === "setup") setState("setup");
      else if (next.action === "verify") setState("verify");
      else setState("ok");
    }

    if (!supabase) {
      setState("ok");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isBackgroundAuthRefresh(event)) return;
      const user = session?.user ?? null;
      window.setTimeout(() => {
        void decide(user);
      }, 0);
    });

    const fallback = window.setTimeout(() => {
      void getVerifiedSessionUser().then((user) => decide(user));
    }, 1200);

    return () => {
      alive = false;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="detail-loading" role="status">
        <p className="detail-loading__pulse">Checking security…</p>
      </div>
    );
  }
  if (state === "setup") {
    return <Navigate to={MFA_SETUP_PATH} replace state={{ from: location.pathname }} />;
  }
  if (state === "verify") return <Navigate to={MFA_VERIFY_PATH} replace />;
  return <>{children}</>;
}
