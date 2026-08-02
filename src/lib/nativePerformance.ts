import { Capacitor } from "@capacitor/core";
import { isNativeAndroid, isNativeMobile } from "./bootExperience";

/** Scale polling for WebView / mobile — avoids main-thread + network pile-ups. */
export function nativePollIntervalMs(webMs: number): number {
  if (isNativeAndroid()) return Math.max(webMs, Math.round(webMs * 2.75));
  if (isNativeMobile()) return Math.max(webMs, Math.round(webMs * 2));
  return webMs;
}

export function isNativeWebView(): boolean {
  return Capacitor.isNativePlatform();
}

/** Tag `<html>` / `<body>` so CSS can reduce motion on native shells. */
export function markNativePerformanceMode(): void {
  if (typeof document === "undefined") return;
  if (!isNativeMobile()) return;
  document.documentElement.classList.add("native-shell");
  if (isNativeAndroid()) {
    document.documentElement.classList.add("native-android");
  }
  try {
    document.body?.classList.add("native-shell");
  } catch {
    /* ignore */
  }
}

export async function bindNativeAppLifecycle(onActiveChange: (active: boolean) => void): Promise<() => void> {
  if (!isNativeMobile()) {
    const onVis = () => onActiveChange(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onActiveChange(!document.hidden);
    return () => document.removeEventListener("visibilitychange", onVis);
  }

  const { App } = await import("@capacitor/app");
  const onVis = () => onActiveChange(!document.hidden);
  document.addEventListener("visibilitychange", onVis);

  const sub = await App.addListener("appStateChange", ({ isActive }) => {
    onActiveChange(isActive);
  });

  onActiveChange(true);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    void sub.remove();
  };
}
