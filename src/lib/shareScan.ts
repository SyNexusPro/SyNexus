import type { ShouldIBuyResult } from "./shouldIBuy";
import { verdictBeginnerMeta } from "./shouldIBuy";
import { PUBLIC_SITE_URL } from "../config/site";

export type ShareScanPayload = {
  text: string;
  url: string;
  title: string;
};

export function buildShareScanPayload(result: ShouldIBuyResult): ShareScanPayload {
  const { token, verdict, headline } = result;
  const beginner = verdictBeginnerMeta(verdict);
  const scanKey = token.mintAddress?.trim() || token.symbol;
  const url = `${PUBLIC_SITE_URL.replace(/\/$/, "")}/?scan=${encodeURIComponent(scanKey)}`;
  const label = beginner.label;
  const text = [
    `Should I buy $${token.symbol}? Synexus: ${headline} — ${label}`,
    "",
    `Scan any Solana token free → ${url}`,
  ].join("\n");

  return {
    title: `Synexus scan · ${token.symbol}`,
    url,
    text,
  };
}

export async function copyShareScan(payload: ShareScanPayload): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(payload.text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = payload.text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function nativeShareScan(payload: ShareScanPayload): Promise<"shared" | "unsupported" | "cancelled"> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return "unsupported";
  }
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}
