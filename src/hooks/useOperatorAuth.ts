import { useEffect, useState } from "react";
import { getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";

const DEMO_SESSION_KEY = "hivemind_demo_session";

export function useOperatorAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

    if (!supabase) return () => {
      cancelled = true;
    };

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

  const linked = Boolean(userId && !userId.startsWith("demo-"));
  return { userId, linked, ready };
}
