import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSynexusPlan } from "../hooks/useSynexusPlan";
import { fetchRecentWhaleEvents, formatWhaleUsd, type WhaleEvent } from "../lib/whaleAlerts";
import { enableNativeWhalePushIfAvailable, enableWhalePushNotifications } from "../lib/whalePush";

const SEEN_KEY = "synexus_whale_seen_ids";
const POLL_MS = 4_000;

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr.slice(-80));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-80)));
  } catch {
    /* ignore */
  }
}

/**
 * Pro-only: polls whale events every few seconds and toasts new large buys.
 * Also arms Web Push once per session when permission is grantable.
 */
export function WhaleAlertToaster() {
  const { t } = useTranslation();
  const plan = useSynexusPlan();
  const [toast, setToast] = useState<WhaleEvent | null>(null);
  const seenRef = useRef<Set<string>>(loadSeen());
  const pushArmed = useRef(false);

  useEffect(() => {
    if (plan !== "PRO") return;

    if (!pushArmed.current) {
      pushArmed.current = true;
      void enableWhalePushNotifications().then(() => enableNativeWhalePushIfAvailable());
    }

    let cancelled = false;
    let since = new Date(Date.now() - 60_000).toISOString();

    const tick = async () => {
      const events = await fetchRecentWhaleEvents(since);
      if (cancelled || !events.length) return;
      since = events[0]?.detected_at || since;
      for (const ev of [...events].reverse()) {
        if (seenRef.current.has(ev.id)) continue;
        seenRef.current.add(ev.id);
        saveSeen(seenRef.current);
        setToast(ev);
        window.setTimeout(() => {
          setToast((cur) => (cur?.id === ev.id ? null : cur));
        }, 8_000);
        break;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [plan]);

  if (plan !== "PRO" || !toast) return null;

  return (
    <div className="whale-alert-toast" role="status" aria-live="polite">
      <p className="whale-alert-toast__title">{t("whale.toastTitle")}</p>
      <p className="whale-alert-toast__body">
        <strong>{toast.symbol || "Token"}</strong> · {formatWhaleUsd(toast.usd_amount)}
      </p>
      <Link className="whale-alert-toast__link" to={`/token/${encodeURIComponent(toast.mint)}`}>
        {t("whale.openToken")}
      </Link>
    </div>
  );
}
