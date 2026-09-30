import type { User } from "@supabase/supabase-js";
import { isAlwaysOnLoginEmail } from "../config/googlePlayReview";
import { isMfaPolicyExemptEmail, resolveMfaContinue, sessionSatisfiesProtectedAccess } from "../security/mfa";
import { isBackgroundAuthRefresh } from "./authEvents";
import { isEmailVerified } from "./emailVerification";
import { applyGooglePlayReviewAccess } from "./googlePlayReviewAccess";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "./ownerAccess";
import { getCurrentUser } from "./supabaseData";
import { hasSupabaseEnv, supabase } from "./supabaseClient";
import { withTimeout } from "./withTimeout";

const DEMO_SESSION_KEY = "synexus_demo_session";
const AUTH_STORE_TIMEOUT_MS = 10_000;

export type OperatorAuthState = {
  userId: string | null;
  secondFactorPath: string | null;
  ownerUnlocked: boolean;
  ready: boolean;
};

const IDLE_STATE: OperatorAuthState = {
  userId: null,
  secondFactorPath: null,
  ownerUnlocked: false,
  ready: false,
};

let state: OperatorAuthState = IDLE_STATE;
const listeners = new Set<() => void>();
let started = false;
/** Guards against a slower earlier resolution overwriting a newer auth event. */
let applyToken = 0;

function setState(patch: Partial<OperatorAuthState>): void {
  const next = { ...state, ...patch };
  if (
    next.userId === state.userId &&
    next.secondFactorPath === state.secondFactorPath &&
    next.ownerUnlocked === state.ownerUnlocked &&
    next.ready === state.ready
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

async function applyUser(user: User | null, token: number): Promise<void> {
  const stale = () => token !== applyToken;

  if (!user || (!isEmailVerified(user) && !isAlwaysOnLoginEmail(user.email))) {
    setState({ userId: null, secondFactorPath: null, ready: true });
    return;
  }
  if (isAlwaysOnLoginEmail(user.email)) {
    void applyGooglePlayReviewAccess(user.id, user.email);
  }
  if (hasStoredOwnerGrant() || isMfaPolicyExemptEmail(user.email)) {
    setState({ userId: user.id, secondFactorPath: null, ready: true });
    return;
  }

  try {
    const allowed = await sessionSatisfiesProtectedAccess();
    if (stale()) return;
    if (allowed) {
      setState({ userId: user.id, secondFactorPath: null, ready: true });
      return;
    }

    const next = await resolveMfaContinue(user);
    if (stale()) return;
    setState({
      userId: null,
      secondFactorPath: next.action === "setup" || next.action === "verify" ? next.path : null,
      ready: true,
    });
  } catch {
    if (stale()) return;
    // Policy checks stalled. Keep the verified session instead of forcing authenticator setup.
    setState({ userId: user.id, secondFactorPath: null, ready: true });
  }
}

function refresh(load: () => Promise<User | null>): void {
  const token = ++applyToken;
  void (async () => {
    let user: User | null;
    try {
      user = await withTimeout(load(), AUTH_STORE_TIMEOUT_MS);
    } catch {
      if (token !== applyToken) return;
      // A stalled session read must not wipe a session we already know about.
      setState({ ready: true });
      return;
    }
    if (token !== applyToken) return;
    try {
      await withTimeout(applyUser(user, token), AUTH_STORE_TIMEOUT_MS);
    } catch {
      if (token !== applyToken) return;
      // Policy checks stalled — unblock consumers without dropping a known session.
      setState({ ready: true });
    }
  })();
}

function start(): void {
  started = true;

  const syncOwner = () => setState({ ownerUnlocked: hasStoredOwnerGrant() });
  syncOwner();
  window.addEventListener(OWNER_ACCESS_CHANGED, syncOwner);
  window.addEventListener("storage", syncOwner);

  if (!hasSupabaseEnv) {
    setState({ userId: localStorage.getItem(DEMO_SESSION_KEY), secondFactorPath: null, ready: true });
    return;
  }

  refresh(() => getCurrentUser());

  supabase?.auth.onAuthStateChange((event, session) => {
    if (isBackgroundAuthRefresh(event)) return;
    const user = session?.user ?? null;
    refresh(async () => user);
  });
}

export function subscribeOperatorAuth(listener: () => void): () => void {
  if (!started) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOperatorAuthSnapshot(): OperatorAuthState {
  return state;
}
