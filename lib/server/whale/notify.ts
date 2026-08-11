import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhaleEventInput } from "./config.js";

export type StoredWhaleEvent = {
  id: string;
  mint: string;
  symbol: string | null;
  side: string;
  usd_amount: number;
  wallet: string | null;
  tx_signature: string | null;
  source: string;
  detected_at: string;
};

export async function insertWhaleEvents(
  admin: SupabaseClient,
  events: WhaleEventInput[],
): Promise<StoredWhaleEvent[]> {
  if (!events.length) return [];
  const rows = events.map((e) => ({
    mint: e.mint,
    symbol: e.symbol ?? null,
    side: e.side,
    usd_amount: e.usdAmount,
    wallet: e.wallet ?? null,
    tx_signature: e.txSignature ?? null,
    source: e.source,
    meta: e.meta ?? {},
  }));

  const { data, error } = await admin
    .from("whale_events")
    .upsert(rows, { onConflict: "tx_signature", ignoreDuplicates: true })
    .select("id, mint, symbol, side, usd_amount, wallet, tx_signature, source, detected_at");

  // Unique partial index may not map to onConflict — fall back to insert
  if (error) {
    const inserted: StoredWhaleEvent[] = [];
    for (const row of rows) {
      const { data: one, error: oneErr } = await admin
        .from("whale_events")
        .insert(row)
        .select("id, mint, symbol, side, usd_amount, wallet, tx_signature, source, detected_at")
        .maybeSingle();
      if (oneErr) {
        if (/duplicate|unique/i.test(oneErr.message)) continue;
        continue;
      }
      if (one) inserted.push(one as StoredWhaleEvent);
    }
    return inserted;
  }

  return (data ?? []) as StoredWhaleEvent[];
}

export async function listProPushTargets(admin: SupabaseClient): Promise<
  {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    min_usd: number;
    watch_mints: string[];
  }[]
> {
  const { data: profiles } = await admin.from("profiles").select("id").eq("paid_plan", "PRO");
  const proIds = (profiles ?? []).map((p) => p.id as string);
  if (!proIds.length) return [];

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", proIds);
  if (!subs?.length) return [];

  const { data: prefs } = await admin
    .from("whale_alert_prefs")
    .select("user_id, enabled, min_usd, watch_mints")
    .in("user_id", proIds);

  const prefMap = new Map(
    (prefs ?? []).map((p) => [
      p.user_id as string,
      {
        enabled: p.enabled !== false,
        min_usd: Number(p.min_usd) || 10_000,
        watch_mints: (p.watch_mints as string[]) || [],
      },
    ]),
  );

  return subs
    .map((s) => {
      const pref = prefMap.get(s.user_id as string) ?? {
        enabled: true,
        min_usd: 10_000,
        watch_mints: [] as string[],
      };
      if (!pref.enabled) return null;
      return {
        user_id: s.user_id as string,
        endpoint: s.endpoint as string,
        p256dh: s.p256dh as string,
        auth: s.auth as string,
        min_usd: pref.min_usd,
        watch_mints: pref.watch_mints,
      };
    })
    .filter(Boolean) as {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    min_usd: number;
    watch_mints: string[];
  }[];
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export async function fanoutWhalePush(
  env: Record<string, string | undefined>,
  admin: SupabaseClient,
  events: StoredWhaleEvent[],
): Promise<number> {
  if (!events.length) return 0;
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim() || "mailto:thesynexus@synexus.pro";
  if (!publicKey || !privateKey) return 0;

  let webpush: typeof import("web-push") | null = null;
  try {
    webpush = await import("web-push");
  } catch {
    return 0;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const targets = await listProPushTargets(admin);
  let sent = 0;

  for (const event of events) {
    if (event.side !== "buy") continue;
    const title = "🐋 Whale buy";
    const body = `${event.symbol || "Token"} · ${formatUsd(event.usd_amount)} · Leviathan`;
    const payload = JSON.stringify({
      title,
      body,
      url: `/token/${encodeURIComponent(event.mint)}`,
      mint: event.mint,
      usd: event.usd_amount,
      detectedAt: event.detected_at,
    });

    for (const t of targets) {
      if (event.usd_amount < t.min_usd) continue;
      if (t.watch_mints.length && !t.watch_mints.includes(event.mint)) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: t.endpoint,
            keys: { p256dh: t.p256dh, auth: t.auth },
          },
          payload,
          { urgency: "high", TTL: 60 },
        );
        sent += 1;
      } catch {
        /* expired endpoint — ignore */
      }
    }
  }

  return sent;
}

export async function processAndNotifyWhales(
  env: Record<string, string | undefined>,
  admin: SupabaseClient,
  events: WhaleEventInput[],
): Promise<{ stored: number; pushed: number; titanNotified: number }> {
  const stored = await insertWhaleEvents(admin, events);
  const pushed = await fanoutWhalePush(env, admin, stored);

  let titanNotified = 0;
  try {
    const { classifyEvent, shouldSendInstantPremium } = await import("../titan/classifyEvent.js");
    const { sendPremiumAlert } = await import("../titan/sendPremiumAlert.js");

    for (const event of stored) {
      if (event.side !== "buy") continue;
      const severity = classifyEvent({
        type: "WHALE_BUY",
        whaleMovementUsd: event.usd_amount,
        transactionValueUsd: event.usd_amount,
      });

      const title = `Large ${event.symbol || "token"} purchase detected`;
      const summary = `A wallet purchased approximately ${formatUsd(event.usd_amount)} of ${event.symbol || "token"}.`;

      const { data: titanEvent } = await admin
        .from("titan_events")
        .insert({
          type: "WHALE_BUY",
          title,
          summary,
          symbol: event.symbol,
          token_address: event.mint,
          severity,
          metadata: {
            wallet: event.wallet,
            usdValue: event.usd_amount,
            transactionSignature: event.tx_signature,
            source: event.source,
          },
        })
        .select("id")
        .maybeSingle();

      if (shouldSendInstantPremium(severity) && titanEvent?.id) {
        const fanout = await sendPremiumAlert(
          admin,
          {
            eventId: titanEvent.id as string,
            title: `TITAN ALERT · ${title}`,
            message: summary,
            priority: severity,
          },
          env,
        );
        titanNotified += fanout.notified;
      }
    }
  } catch {
    /* titan_events table may not exist yet */
  }

  return { stored: stored.length, pushed, titanNotified };
}
