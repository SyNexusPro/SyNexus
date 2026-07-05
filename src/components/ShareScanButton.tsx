import { useState } from "react";
import type { ShouldIBuyResult } from "../lib/shouldIBuy";
import {
  buildShareScanPayload,
  copyShareScan,
  nativeShareScan,
} from "../lib/shareScan";

type Props = {
  result: ShouldIBuyResult;
  className?: string;
};

export function ShareScanButton({ result, className = "" }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function handleShare() {
    const payload = buildShareScanPayload(result);
    const native = await nativeShareScan(payload);
    if (native === "shared") {
      setStatus("shared");
      window.setTimeout(() => setStatus("idle"), 2500);
      return;
    }
    const copied = await copyShareScan(payload);
    setStatus(copied ? "copied" : "idle");
    if (copied) window.setTimeout(() => setStatus("idle"), 2500);
  }

  const label =
    status === "copied" ? "Copied!" : status === "shared" ? "Shared!" : "Share this scan";

  return (
    <button
      type="button"
      className={`share-scan-btn ${className}`.trim()}
      onClick={() => void handleShare()}
    >
      {label}
    </button>
  );
}
