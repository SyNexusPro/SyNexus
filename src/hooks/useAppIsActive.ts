import { useEffect, useState } from "react";
import { bindNativeAppLifecycle } from "../lib/nativePerformance";

/** False when app is backgrounded or tab is hidden — pause heavy polling. */
export function useAppIsActive(): boolean {
  const [active, setActive] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true,
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void bindNativeAppLifecycle((next) => {
      if (!disposed) setActive(next);
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return active;
}
