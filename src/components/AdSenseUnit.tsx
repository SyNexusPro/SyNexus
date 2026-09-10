import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID, isAdSenseConfigured } from "../config/adsense";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type Props = {
  slot: string;
  className?: string;
  label?: string;
};

/** Responsive AdSense display unit — requires matching loader in index.html. */
export function AdSenseUnit({ slot, className = "", label = "Advertisement" }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!isAdSenseConfigured(slot) || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      /* blocked by ad blocker or script not loaded yet */
    }
  }, [slot]);

  if (!isAdSenseConfigured(slot)) return null;

  return (
    <aside className={`adsense-unit ${className}`.trim()} aria-label={label}>
      <p className="adsense-unit__label">{label}</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
