import { useCallback, useEffect, useState } from "react";
import { DEEP_SCAN_FREE_LIMIT } from "../config/deepScanDemo";
import {
  DEEP_SCAN_CHANGED,
  getDeepScansRemaining,
  getDeepScansUsed,
  hasUnlimitedDeepScans,
} from "../lib/deepScanDemo";
import { useOperatorAuth } from "./useOperatorAuth";

export function useDeepScanDemo() {
  const { linked } = useOperatorAuth();
  const [remaining, setRemaining] = useState(() => getDeepScansRemaining(linked));
  const [used, setUsed] = useState(() => getDeepScansUsed());

  const sync = useCallback(() => {
    setRemaining(getDeepScansRemaining(linked));
    setUsed(getDeepScansUsed());
  }, [linked]);

  useEffect(() => {
    sync();
    window.addEventListener(DEEP_SCAN_CHANGED, sync);
    return () => window.removeEventListener(DEEP_SCAN_CHANGED, sync);
  }, [sync]);

  return {
    linked,
    unlimited: hasUnlimitedDeepScans(linked),
    limit: DEEP_SCAN_FREE_LIMIT,
    used,
    remaining,
  };
}
