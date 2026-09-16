import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isEmailVerified } from "../lib/emailVerification";
import { hasSupabaseEnv } from "../lib/supabaseClient";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import {
  getAssurance,
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
} from "./mfa";

type Props = {
  children: ReactNode;
  requireAal2?: boolean;
};

export function AuthGuard({ children, requireAal2 = false }: Props) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "signin" | "setup" | "verify">("loading");

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!hasSupabaseEnv) {
        if (hasStoredOwnerGrant()) {
          if (alive) setState("ok");
          return;
        }
        if (alive) setState("signin");
        return;
      }
      if (hasStoredOwnerGrant()) {
        if (alive) setState("ok");
        return;
      }
      const user = await getVerifiedSessionUser();
      if (!user || !isEmailVerified(user)) {
        if (alive) setState("signin");
        return;
      }
      if (!requireAal2 || isMfaPolicyExemptEmail(user.email)) {
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
  }, [location.key, requireAal2]);

  if (state === "loading") {
    return (
      <div className="detail-loading" role="status">
        <p className="detail-loading__pulse">Checking security…</p>
      </div>
    );
  }
  if (state === "signin") {
    return <Navigate to="/pulse" replace state={{ from: location.pathname }} />;
  }
  if (state === "setup") return <Navigate to={MFA_SETUP_PATH} replace />;
  if (state === "verify") return <Navigate to={MFA_VERIFY_PATH} replace />;
  return <>{children}</>;
}
