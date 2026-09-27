import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "../lib/ownerAccess";
import { isEmailVerified } from "../lib/emailVerification";
import { isAlwaysOnLoginEmail } from "../config/googlePlayReview";
import { applyGooglePlayReviewAccess } from "../lib/googlePlayReviewAccess";
import { isMfaPolicyExemptEmail, resolveMfaContinue, sessionSatisfiesProtectedAccess } from "../security/mfa";

const DEMO_SESSION_KEY = "synexus_demo_session";

export function useOperatorAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [secondFactorPath, setSecondFactorPath] = useState<string | null>(null);
  const [ownerUnlocked, setOwnerUnlocked] = useState(() => hasStoredOwnerGrant());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncOwner = () => setOwnerUnlocked(hasStoredOwnerGrant());
    window.addEventListener(OWNER_ACCESS_CHANGED, syncOwner);
    window.addEventListener("storage", syncOwner);
    return () => {
      window.removeEventListener(OWNER_ACCESS_CHANGED, syncOwner);
      window.removeEventListener("storage", syncOwner);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function applyUser(user: User | null) {
      if (cancelled) return;
      if (!user || (!isEmailVerified(user) && !isAlwaysOnLoginEmail(user.email))) {
        setUserId(null);
        setSecondFactorPath(null);
        setReady(true);
        return;
      }
      if (isAlwaysOnLoginEmail(user.email)) {
        void applyGooglePlayReviewAccess(user.id, user.email);
      }
      if (hasStoredOwnerGrant() || isMfaPolicyExemptEmail(user.email)) {
        setUserId(user.id);
        setSecondFactorPath(null);
        setReady(true);
        return;
      }
      const allowed = await sessionSatisfiesProtectedAccess();
      if (cancelled) return;
      if (allowed) {
        setUserId(user.id);
        setSecondFactorPath(null);
        setReady(true);
        return;
      }
      const next = await resolveMfaContinue(user);
      if (cancelled) return;
      setUserId(null);
      setSecondFactorPath(next.action === "setup" || next.action === "verify" ? next.path : null);
      setReady(true);
    }

    async function sync() {
      if (!hasSupabaseEnv) {
        const demo = localStorage.getItem(DEMO_SESSION_KEY);
        if (!cancelled) {
          setUserId(demo);
          setSecondFactorPath(null);
          setReady(true);
        }
        return;
      }
      try {
        const user = await getCurrentUser();
        await applyUser(user);
      } catch {
        if (!cancelled) {
          setUserId(null);
          setSecondFactorPath(null);
          setReady(true);
        }
      }
    }

    void sync();

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      window.setTimeout(() => {
        void applyUser(user);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const linked = Boolean((userId && !userId.startsWith("demo-")) || ownerUnlocked);
  return { userId, linked, ownerUnlocked, ready, secondFactorPath };
}
