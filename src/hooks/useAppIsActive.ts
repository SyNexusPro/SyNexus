import { useEffect, useState } from "react";
import { isOwnerScreen } from "../lib/ownerScreen";
import { bindNativeAppLifecycle } from "../lib/nativePerformance";

/** False when app is backgrounded or tab is hidden — pause heavy polling. */
export function useAppIsActive(): boolean {
  const ownerPhone = typeof navigator !== "undefined" && isOwnerScreen();
  const [active, setActive] = useState(() =>
    ownerPhone || (typeof document !== "undefined" ? !document.hidden : true),
  );

  useEffect(() => {
    if (isOwnerScreen()) {
      setActive(true);
      return;
    }
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
