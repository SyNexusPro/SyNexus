import { useCallback, useEffect, useState } from "react";
import { HERA_VERSION_CHANGED } from "../config/heraVersion";
import {
  formatHeraTaggedName,
  readHeraVersion,
  touchHeraGrowthDay,
  type HeraVersion,
} from "../lib/hera/growth";

export function useHeraVersion(name = "Hera") {
  const [version, setVersion] = useState<HeraVersion>(() => readHeraVersion());

  const sync = useCallback(() => {
    setVersion((prev) => {
      const next = readHeraVersion();
      return prev.tag === next.tag && prev.xp === next.xp ? prev : next;
    });
  }, []);

  useEffect(() => {
    touchHeraGrowthDay();
    sync();
    window.addEventListener(HERA_VERSION_CHANGED, sync);
    return () => window.removeEventListener(HERA_VERSION_CHANGED, sync);
  }, [sync]);

  return {
    version,
    tag: version.tag,
    labeledName: formatHeraTaggedName(name, version),
  };
}
