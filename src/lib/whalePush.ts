import { Capacitor } from "@capacitor/core";
import { authHeaders } from "./authSession";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/subscribe", {
      headers: await authHeaders(),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { vapidPublicKey?: string | null };
    return json.vapidPublicKey?.trim() || null;
  } catch {
    return null;
  }
}

async function postSubscription(sub: PushSubscription, platform: "web" | "android"): Promise<boolean> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      platform,
      minUsd: 10_000,
    }),
  });
  return res.ok;
}

/** Register Web Push for Pro whale alerts. No-ops if unsupported / not Pro / no VAPID. */
export async function enableWhalePushNotifications(): Promise<"ok" | "unsupported" | "denied" | "failed"> {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const vapid = await fetchVapidPublicKey();
  if (!vapid) return "failed";

  try {
    const reg = await navigator.serviceWorker.register("/sw-whale.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
    }
    const platform = Capacitor.isNativePlatform() ? "android" : "web";
    const ok = await postSubscription(sub, platform);
    return ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

/** Best-effort Capacitor local/push hook — Web Push covers Android WebView when permitted. */
export async function enableNativeWhalePushIfAvailable(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const mod = await import("@capacitor/push-notifications");
    const { PushNotifications } = mod;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();
  } catch {
    /* plugin optional until cap sync */
  }
}
