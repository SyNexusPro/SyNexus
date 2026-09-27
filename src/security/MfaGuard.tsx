import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { isEmailVerified } from "../lib/emailVerification";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import {
  getAssurance,
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
} from "./mfa";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";

/** If a session exists, require MFA before the protected page renders. */
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
      const { currentLevel, nextLevel } = await getAssurance();
      if (!alive) return;
      if (currentLevel === "aal2") {
        setState("ok");
        return;
      }
      setState(nextLevel === "aal2" ? "verify" : "setup");
    }

    if (!supabase) {
      setState("ok");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
  }, [location.key]);

  if (state === "loading") {
    return (
      <div className="detail-loading" role="status">
        <p className="detail-loading__pulse">Checking security…</p>
      </div>
    );
  }
  if (state === "setup") return <Navigate to={MFA_SETUP_PATH} replace />;
  if (state === "verify") return <Navigate to={MFA_VERIFY_PATH} replace />;
  return <>{children}</>;
}
