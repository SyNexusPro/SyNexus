import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isEmailVerified } from "../lib/emailVerification";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import {
  getAssurance,
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
} from "./mfa";

/** If a session exists, require MFA before the protected page renders. */
export function MfaGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "setup" | "verify">("loading");

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!hasSupabaseEnv) {
        if (alive) setState("ok");
        return;
      }
      const user = await getVerifiedSessionUser();
      if (!user) {
        if (alive) setState("ok");
        return;
      }
      if (!isEmailVerified(user) || isMfaPolicyExemptEmail(user.email)) {
        if (alive) setState("ok");
        return;
      }
      const { currentLevel, nextLevel } = await getAssurance();
      if (currentLevel === "aal2") {
        if (alive) setState("ok");
        return;
      }
      if (alive) setState(nextLevel === "aal2" ? "verify" : "setup");
    }
    void run();
    return () => {
      alive = false;
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
