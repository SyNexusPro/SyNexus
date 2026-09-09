import { useEffect, useState } from "react";
import { getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "../lib/ownerAccess";

const DEMO_SESSION_KEY = "synexus_demo_session";

export function useOperatorAuth() {
  const [userId, setUserId] = useState<string | null>(null);
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

    async function sync() {
      if (!hasSupabaseEnv) {
        const demo = localStorage.getItem(DEMO_SESSION_KEY);
        if (!cancelled) {
          setUserId(demo);
          setReady(true);
        }
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!cancelled) {
          setUserId(user?.id ?? null);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setUserId(null);
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
      setUserId(session?.user?.id ?? null);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const linked = Boolean((userId && !userId.startsWith("demo-")) || ownerUnlocked);
  return { userId, linked, ownerUnlocked, ready };
}
