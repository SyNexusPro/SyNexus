import { useSyncExternalStore } from "react";
import { getOperatorAuthSnapshot, subscribeOperatorAuth } from "../lib/operatorAuthStore";

export function useOperatorAuth() {
  const { userId, ownerUnlocked, ready, secondFactorPath } = useSyncExternalStore(
    subscribeOperatorAuth,
    getOperatorAuthSnapshot,
    getOperatorAuthSnapshot,
  );

  const linked = Boolean((userId && !userId.startsWith("demo-")) || ownerUnlocked);
  return { userId, linked, ownerUnlocked, ready, secondFactorPath };
}
