import { useEffect, useRef } from "react";
import { startHeraBargeIn } from "../lib/hera/HeraBargeIn";

type Options = {
  active: boolean;
  onBargeIn: () => void;
};

/** While Hera is speaking, listen for the host's voice and cut her off. */
export function useHeraBargeIn({ active, onBargeIn }: Options) {
  const cbRef = useRef(onBargeIn);
  cbRef.current = onBargeIn;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let handle: { stop: () => void } | null = null;
    void startHeraBargeIn(() => {
      if (!cancelled) cbRef.current();
    })
      .then((h) => {
        if (cancelled) {
          h.stop();
          return;
        }
        handle = h;
      })
      .catch(() => {
        /* mic already in use or denied — barge-in stays off */
      });
    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [active]);
}
