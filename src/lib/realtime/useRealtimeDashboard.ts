import { useSyncExternalStore } from "react";
import { realtime } from "./RealtimeManager";
import type { DashboardSnapshot } from "./types";

export function useRealtimeDashboard(): DashboardSnapshot {
  return useSyncExternalStore(realtime.subscribe, realtime.getSnapshot, realtime.getSnapshot);
}
