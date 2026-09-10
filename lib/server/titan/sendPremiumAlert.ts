import type { SupabaseClient } from "@supabase/supabase-js";

export type PremiumAlertInput = {
  eventId?: string | null;
  title: string;
  message: string;
  priority?: string;
};

/**
 * Fan out one Titan alert to every active / Pro subscriber with instant alerts on.
 * Also attempts Web Push when VAPID + push_subscriptions are configured.
 */
export async function sendPremiumAlert(
  admin: SupabaseClient,
  alert: PremiumAlertInput,
  env: Record<string, string | undefined> = process.env,
): Promise<{ notified: number; pushed: number }> {
  const { data: byStatus, error: statusErr } = await admin
    .from("profiles")
    .select("id")
    .eq("subscription_status", "active")
    .eq("notifications_enabled", true)
    .eq("instant_alerts", true);

  if (statusErr && !/column|does not exist/i.test(statusErr.message)) {
    throw statusErr;
  }

  let subscribers = byStatus ?? [];

  if (!subscribers.length) {
    const { data: byPlan } = await admin
      .from("profiles")
      .select("id")
      .eq("paid_plan", "PRO");
    subscribers = byPlan ?? [];
  }

  if (!subscribers.length) {
    return { notified: 0, pushed: 0 };
  }

  const rows = subscribers.map((user) => ({
    user_id: user.id as string,
    event_id: alert.eventId || null,
    title: alert.title,
    message: alert.message,
    priority: alert.priority || "normal",
  }));

  const { error: insertErr } = await admin.from("titan_notifications").insert(rows);
  if (insertErr) throw insertErr;

  let pushed = 0;
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim() || "mailto:thesynexus@synexus.pro";

  if (publicKey && privateKey) {
    try {
      const webpush = await import("web-push");
      webpush.setVapidDetails(subject, publicKey, privateKey);
      const userIds = subscribers.map((s) => s.id as string);
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", userIds);

      const payload = JSON.stringify({
        title: `TITAN · ${alert.title}`,
        body: alert.message.slice(0, 180),
        url: "/pulse",
      });

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
            },
            payload,
            { urgency: "high", TTL: 120 },
          );
          pushed += 1;
        } catch {
          /* expired endpoint */
        }
      }
    } catch {
      /* web-push optional */
    }
  }

  return { notified: rows.length, pushed };
}
