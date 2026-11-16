import { useEffect } from "react";
import { OWNER_ACCESS_CHANGED, hasStoredOwnerGrant } from "../lib/ownerAccess";
import { pullOwnerHeraThread, watchOwnerHeraThread } from "../lib/ownerHera";
import { supabase } from "../lib/supabaseClient";

/** Keeps the owner's Hera thread on one server copy for the phone and the computer. */
export function OwnerConversationSync() {
  useEffect(() => {
    let alive = true;
    let stop = () => undefined as void;

    const run = async () => {
      stop();
      stop = () => undefined;
      if (!hasStoredOwnerGrant() || !supabase) return;
      const session = (await supabase.auth.getSession()).data.session;
      if (!alive || !session) return;
      await pullOwnerHeraThread();
      if (!alive) return;
      stop = watchOwnerHeraThread();
    };

    void run();
    window.addEventListener(OWNER_ACCESS_CHANGED, run);
    return () => {
      alive = false;
      stop();
      window.removeEventListener(OWNER_ACCESS_CHANGED, run);
    };
  }, []);

  return null;
}
