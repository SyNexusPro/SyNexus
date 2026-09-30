import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabaseClient";

const OAUTH_ERROR_KEY = "synexus_oauth_error";
const handledAuthUrls = new Set<string>();

export function readGoogleAuthError(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(OAUTH_ERROR_KEY);
    if (!stored) return null;
    sessionStorage.removeItem(OAUTH_ERROR_KEY);
    return stored;
  } catch {
    return null;
  }
}

function rememberGoogleAuthError(message: string) {
  try {
    sessionStorage.setItem(OAUTH_ERROR_KEY, message);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("synexus-oauth-error", { detail: message }));
}

/** Finish a Google return that landed on the app via an Android app link. */
export async function completeGoogleAuthUrl(url: string): Promise<void> {
  if (!supabase) return;
  if (handledAuthUrls.has(url)) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  const oauthError = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
  if (oauthError) {
    handledAuthUrls.add(url);
    rememberGoogleAuthError(oauthError.replace(/\+/g, " "));
    if (Capacitor.isNativePlatform()) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        /* tab may already be closed */
      }
    }
    return;
  }
  const code = parsed.searchParams.get("code");
  if (!code) return;

  handledAuthUrls.add(url);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    rememberGoogleAuthError(error.message);
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {
      /* tab may already be closed */
    }
  }

  if (!window.location.pathname.startsWith("/security")) {
    window.location.assign("/pulse");
  }
}

/** Listen for the Android app link that brings Google back into the WebView. */
export function installGoogleAuthReturn(): void {
  if (!supabase || !Capacitor.isNativePlatform()) return;
  void import("@capacitor/app").then(({ App }) => {
    void App.addListener("appUrlOpen", ({ url }) => {
      void completeGoogleAuthUrl(url);
    });
    // appUrlOpen is not replayed when OAuth launches a stopped Android app.
    // Reading the launch URL makes that cold-start return complete as well.
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) void completeGoogleAuthUrl(launch.url);
    });
  });
}
