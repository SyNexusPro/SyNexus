import { useEffect, useRef, useState } from "react";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useSynexusPlan } from "../hooks/useSynexusPlan";

type TitanNotificationRow = {
  id: string;
  title: string;
  message: string;
  priority?: string;
  created_at?: string;
};

/**
 * Live Titan alerts while the app is open (Supabase Realtime on titan_notifications).
 * Pro / active subscribers only.
 */
export function TitanLiveAlerts() {
  const { userId } = useOperatorAuth();
  const plan = useSynexusPlan();
  const [toast, setToast] = useState<TitanNotificationRow | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase || !userId || plan !== "PRO") return;

    const channel = supabase
      .channel(`titan-alerts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "titan_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as TitanNotificationRow;
          if (!row?.id || seen.current.has(row.id)) return;
          seen.current.add(row.id);
          setToast(row);
          window.setTimeout(() => {
            setToast((cur) => (cur?.id === row.id ? null : cur));
          }, 10_000);
        },
      )
      .subscribe();

    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [userId, plan]);

  if (!toast) return null;

  return (
    <div className="titan-live-alert" role="status" aria-live="assertive">
      <p className="titan-live-alert__eyebrow">TITAN ALERT</p>
      <p className="titan-live-alert__title">{toast.title}</p>
      <p className="titan-live-alert__message">{toast.message.slice(0, 280)}</p>
    </div>
  );
}
