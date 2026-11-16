import { Capacitor, registerPlugin } from "@capacitor/core";
import { authHeaders } from "./authSession";
import {
  loadConversationHistory,
  saveConversationHistory,
  setConversationThreadSink,
  type ConversationTurn,
} from "./oracleSupremeConversation";
import { pickNewerOwnerHeraTurns, sanitizeOwnerHeraTurns, type OwnerHeraTurn } from "../../lib/ownerHeraThread";

type ShortcutPlugin = {
  pin(): Promise<{ requested?: boolean }>;
};

const HeraShortcut = registerPlugin<ShortcutPlugin>("HeraShortcut");
const SHORTCUT_ASKED_KEY = "synexus_hera_shortcut_asked";

function asConversation(turns: OwnerHeraTurn[]): ConversationTurn[] {
  return turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    text: turn.text,
    at: turn.at,
    ...(turn.responseId ? { responseId: turn.responseId } : {}),
  }));
}

export async function verifyOwnerHera(): Promise<{ ok: true; vapidPublicKey: string | null } | { ok: false }> {
  const response = await fetch("/api/owner/hera", { headers: await authHeaders(), cache: "no-store" });
  if (!response.ok) return { ok: false };
  const body = (await response.json().catch(() => null)) as { vapidPublicKey?: unknown } | null;
  const vapidPublicKey = typeof body?.vapidPublicKey === "string" ? body.vapidPublicKey : null;
  return { ok: true, vapidPublicKey };
}

export async function pullOwnerHeraThread(): Promise<void> {
  const response = await fetch("/api/owner/hera/thread", { headers: await authHeaders(), cache: "no-store" });
  if (!response.ok) return;
  const body = (await response.json().catch(() => null)) as { turns?: unknown } | null;
  const remote = sanitizeOwnerHeraTurns(body?.turns);
  const local = sanitizeOwnerHeraTurns(loadConversationHistory());
  const chosen = pickNewerOwnerHeraTurns(local, remote);
  if (chosen !== local) saveConversationHistory(asConversation(chosen));
}

export function watchOwnerHeraThread(): () => void {
  let timer = 0;
  setConversationThreadSink((turns) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const payload = JSON.stringify({ turns: sanitizeOwnerHeraTurns(turns) });
      void authHeaders({ "Content-Type": "application/json" }).then((headers) =>
        fetch("/api/owner/hera/thread", { method: "PUT", headers, body: payload }),
      );
    }, 800);
  });
  return () => {
    window.clearTimeout(timer);
    setConversationThreadSink(null);
  };
}

export async function enableOwnerHeraPush(vapidPublicKey?: string | null): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  let vapid = vapidPublicKey?.trim() || "";
  if (!vapid) {
    const keyResponse = await fetch("/api/push/subscribe", { headers: await authHeaders() });
    const keyBody = (await keyResponse.json().catch(() => null)) as { vapidPublicKey?: string | null } | null;
    vapid = keyBody?.vapidPublicKey?.trim() || "";
  }
  if (!vapid) return;
  const registration = await navigator.serviceWorker.register("/sw-whale.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const padding = "=".repeat((4 - (vapid.length % 4)) % 4);
    const base64 = (vapid + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const key = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) key[i] = raw.charCodeAt(i);
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
  await fetch("/api/owner/hera/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
  });
  if (localStorage.getItem("synexus_hera_push_checked") === "1") return;
  const test = await fetch("/api/owner/hera/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ test: true }),
  });
  if (test.ok) localStorage.setItem("synexus_hera_push_checked", "1");
}

export async function requestHeraHomeShortcut(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (localStorage.getItem(SHORTCUT_ASKED_KEY) === "1") return;
    const result = await HeraShortcut.pin();
    if (result?.requested) localStorage.setItem(SHORTCUT_ASKED_KEY, "1");
  } catch {
    /* The static Android shortcut remains available from the app icon. */
  }
}
