import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { isBackgroundAuthRefresh } from "../lib/authEvents";
import { isEmailVerified } from "../lib/emailVerification";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { withTimeout } from "../lib/withTimeout";
import {
  getVerifiedSessionUser,
  isMfaPolicyExemptEmail,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  resolveMfaContinue,
} from "./mfa";

const GUARD_TIMEOUT_MS = 8_000;

type Props = {
  children: ReactNode;
  requireAal2?: boolean;
};

export function AuthGuard({ children, requireAal2 = false }: Props) {
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ok" | "signin" | "setup" | "verify" | "error">(
    "loading",
  );

  useEffect(() => {
    let alive = true;
    let decisionId = 0;
    let settled = false;
    setState("loading");

    async function decide(user: User | null, id: number) {
      if (!alive || id !== decisionId) return;
      if (!hasSupabaseEnv) {
        setState(hasStoredOwnerGrant() ? "ok" : "signin");
        return;
      }
      if (hasStoredOwnerGrant()) {
        setState("ok");
        return;
      }
      if (!user || !isEmailVerified(user)) {
        setState("signin");
        return;
      }
      if (!requireAal2 || isMfaPolicyExemptEmail(user.email)) {
        setState("ok");
        return;
      }
      try {
        const next = await resolveMfaContinue(user);
        if (!alive || id !== decisionId) return;
        if (next.action === "setup") setState("setup");
        else if (next.action === "verify") setState("verify");
        else setState("ok");
      } catch {
        if (!alive || id !== decisionId) return;
        setState("error");
      }
    }

    if (!supabase) {
      void decide(null, ++decisionId);
      return;
    }

    /** A stalled auth call must never leave the operator staring at the spinner. */
    function decideFromSession() {
      const id = ++decisionId;
      void withTimeout(getVerifiedSessionUser(), GUARD_TIMEOUT_MS)
        .then((user) => {
          if (!alive || id !== decisionId) return;
          settled = true;
          void decide(user, id);
        })
        .catch(() => {
          if (!alive || id !== decisionId) return;
          settled = true;
          setState("error");
        });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive || isBackgroundAuthRefresh(event)) return;
      const id = ++decisionId;
      const user = session?.user ?? null;
      window.setTimeout(() => {
        void decide(user, id);
      }, 0);
    });

    decideFromSession();
    const fallback = window.setTimeout(() => {
      if (!settled) decideFromSession();
    }, 1200);

    return () => {
      alive = false;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [requireAal2, attempt]);

  if (state === "loading") {
    return (
      <div className="detail-loading" role="status">
        <p className="detail-loading__pulse">Checking security…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="detail-loading" role="alert">
        <p className="detail-loading__message">Security check timed out. Check your connection and try again.</p>
        <button type="button" className="detail-loading__retry" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }
  if (state === "signin") {
    return <Navigate to="/pulse" replace state={{ from: location.pathname }} />;
  }
  if (state === "setup") {
    return <Navigate to={MFA_SETUP_PATH} replace state={{ from: location.pathname }} />;
  }
  if (state === "verify") return <Navigate to={MFA_VERIFY_PATH} replace />;
  return <>{children}</>;
}
