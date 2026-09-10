import { Capacitor } from "@capacitor/core";
import { isNativeAndroid, isNativeMobile } from "./bootExperience";

/** Scale polling for WebView / mobile — avoids main-thread + network pile-ups. */
export function nativePollIntervalMs(webMs: number): number {
  if (isNativeAndroid()) return Math.max(30_000, Math.round(webMs * 4.5));
  if (isNativeMobile()) return Math.max(webMs, Math.round(webMs * 2.5));
  return webMs;
}

/** Longer in-memory cache on native so overlapping panels share one network pull. */
export function nativeFeedCacheTtlMs(webMs: number): number {
  if (isNativeAndroid()) return Math.max(webMs, Math.round(webMs * 3));
  if (isNativeMobile()) return Math.max(webMs, Math.round(webMs * 2));
  return webMs;
}

export function nativeReduceMotion(): boolean {
  return isNativeAndroid();
}

export function isNativeWebView(): boolean {
  return Capacitor.isNativePlatform();
}

const ANDROID_BLOCKED_GLOBAL_EVENTS = new Set([
  "touchmove",
  "pointermove",
  "mousemove",
  "wheel",
  "scroll",
]);

let androidInputHardened = false;

/**
 * Drop window/document move + scroll listeners on Android.
 * Native scrolling still works; JS handlers that fire every finger move do not.
 */
export function hardenAndroidInputListeners(): void {
  if (androidInputHardened || typeof window === "undefined" || !isNativeAndroid()) return;
  androidInputHardened = true;

  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (
      listener &&
      ANDROID_BLOCKED_GLOBAL_EVENTS.has(type) &&
      (this === window || this === document || this === document.documentElement || this === document.body)
    ) {
      return;
    }
    return orig.call(this, type, listener as EventListenerOrEventListenerObject, options);
  };
}

/** Tag `<html>` / `<body>` so CSS can reduce motion on native shells. */
export function markNativePerformanceMode(): void {
  if (typeof document === "undefined") return;
  if (!isNativeMobile()) return;
  document.documentElement.classList.add("native-shell");
  if (isNativeAndroid()) {
    document.documentElement.classList.add("native-android");
    hardenAndroidInputListeners();
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
