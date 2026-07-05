import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { synexusRiskBandLabel } from "../data/tokens";
import {
  fetchGuardianAlerts,
  fetchProfile,
  fetchTrackedTokens,
  fetchWatchlistTokens,
  getCurrentUser,
  requestPasswordReset,
  signInWithEmail,
  signInWithMagicLink,
  signOut,
  signUpWithEmail,
  resendSignupVerificationEmail,
  restoreSessionFromRefreshToken,
  updatePaidPlan,
  updatePassword,
  upsertSignupProfile,
  validateSignupPassword,
} from "../lib/supabaseData";
import { passwordStrengthLabel } from "../lib/authCredentials";
import {
  isEmailVerified,
  loadPendingVerificationEmail,
  savePendingVerificationEmail,
} from "../lib/emailVerification";
import { loadRememberedEmail, saveRememberedEmail } from "../lib/authRemember";
import {
  buildOracleSupremeBriefing,
  buildOracleSupremeDailyReport,
  buildSyntheticSentinels,
} from "../data/syntheticWatchers";
import { recordTrustedPlanGrant, enforceStoredPlan } from "../lib/securityBot";
import {
  hasStoredOwnerGrant,
  refreshOwnerAccess,
  unlockOwnerAccess,
} from "../lib/ownerAccess";
import { ProTrialBanner } from "../components/ProTrialBanner";
import { ProDemoButton } from "../components/ProDemoButton";
import { ShouldIBuyPanel } from "../components/ShouldIBuyPanel";
import { TopMoversPanel } from "../components/TopMoversPanel";
import { SentinelAlertsHub } from "../components/SentinelAlertsHub";
import { WalletPerformanceDashboard } from "../components/WalletPerformanceDashboard";
import { OracleAdminControlCenter } from "../components/OracleAdminControlCenter";
import { UIModeToggle } from "../components/UIModeToggle";
import { notifySynexusPlanChanged, SYNEXUS_PLAN_CHANGED } from "../hooks/useSynexusPlan";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";
import { useBiometricLogin } from "../hooks/useBiometricLogin";
import { PulseOperatorLink } from "../components/PulseOperatorLink";
import {
  clearBiometricLogin,
  enableBiometricLogin,
  enrollBiometricAfterLogin,
  getBiometricSupport,
  isBiometricLoginEnabled,
  loadBiometricRefreshToken,
  refreshBiometricVaultToken,
} from "../lib/biometricLogin";
import {
  pulseFormatSentinelNamesInText,
  pulseSentinelDisplayName,
} from "../lib/pulseFormatting";
import {
  resolveOperatorName,
} from "../lib/oracleSupremeConversation";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";
import { isProDemoActive, clearExpiredProDemo } from "../lib/proDemo";
import { getSentinelIdleMessage, getSentinelMessage } from "../lib/watcherVoice";
import type { Token } from "../data/tokens";
import { fetchMvpTokenFeed } from "../services/marketDataService";
import { buildSentinelLiveIntel, sentinelLaneIdFromSentinel } from "../lib/sentinelIntel";
import { trackSiteEvent } from "../lib/siteAnalytics";

type GuardianAlertItem = {
  token_symbol?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
};

type TrackedTokenItem = {
  token_symbol?: string | null;
  token_name?: string | null;
  guardian_status?: "SAFE" | "WARNING" | "DANGER" | null;
  guardian_score?: number | null;
};

type SentinelAlertItem = {
  tokenSymbol: string;
  severity: "WARNING" | "DANGER";
  note: string;
};

type AppPlan = "FREE" | "PRO";

type PaidSignal = {
  id: string;
  title: string;
  detail: string;
};

type AuthMessage = {
  tone: "info" | "success" | "error";
  text: string;
};

const PLAN_STORAGE_KEY = "hivemind_paid_plan";
const DEMO_SESSION_KEY = "hivemind_demo_session";
const LOCAL_REPORTS_KEY = "hivemind_pending_reports";
const USER_FRIENDLY_ERROR = "Something went wrong. Please try again.";

function normalizeStoredPlan(plan: string | null | undefined): AppPlan {
  if (plan === "PRO") return "PRO";
  return "FREE";
}

function formatPlanName(plan: AppPlan) {
  if (plan === "PRO" && isProDemoActive()) return "Pro demo (5 min)";
  if (plan === "PRO") return "Synexus Pro";
  return "Free";
}

function describeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_grant")) {
    return "Wrong email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (lower.includes("too many requests") || lower.includes("rate")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("pgrst205") ||
    lower.includes("hivemind") ||
    lower.includes("undefined_table") ||
    lower.includes("42p01")
  ) {
    return USER_FRIENDLY_ERROR;
  }
  return USER_FRIENDLY_ERROR;
}

export function Pulse() {
  const [searchParams] = useSearchParams();
  const scanQuery = searchParams.get("scan")?.trim() ?? "";
  const [email, setEmail] = useState(() => loadRememberedEmail());
  const [password, setPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auth") === "recovery",
  );
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(() =>
    loadPendingVerificationEmail(),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("there");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<GuardianAlertItem[]>([]);
  const [tracked, setTracked] = useState<TrackedTokenItem[]>([]);
  const [sentinelAlerts, setSentinelAlerts] = useState<SentinelAlertItem[]>([]);
  const [marketTokens, setMarketTokens] = useState<Token[]>([]);
  const [plan, setPlan] = useState<AppPlan>(() =>
    normalizeStoredPlan(localStorage.getItem(PLAN_STORAGE_KEY)),
  );
  const [paidSignals, setPaidSignals] = useState<PaidSignal[]>([]);
  const [sentinelIdle, setSentinelIdle] = useState(getSentinelIdleMessage(Date.now()));
  const [authBusy, setAuthBusy] = useState(false);
  const [authLoadPhrase, setAuthLoadPhrase] = useState<"synexus" | "sentinel">("synexus");
  const [authMessage, setAuthMessage] = useState<AuthMessage>({
    tone: "info",
    text: hasSupabaseEnv
      ? "Secure operator channel ready — link below to save your Synexus data."
      : "Demo mode active — link below for a local session.",
  });
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [oracleSupremeReportStamp, setOracleSupremeReportStamp] = useState(() => Date.now());
  const [oracleSpeaking, setOracleSpeaking] = useState(false);
  const { isSimple, isAdvanced } = useSynexusUIMode();
  const biometric = useBiometricLogin();
  const pendingAuthMethod = useRef<"password" | "signup" | "biometric" | null>(null);

  const signupPasswordHint = useMemo(() => {
    if (!password) return null;
    const check = validateSignupPassword(password);
    if (!check.ok && check.message) return check.message;
    if (check.ok) return `Strength: ${passwordStrengthLabel(check.score)}`;
    return null;
  }, [password]);

  const emailVerificationPending = Boolean(pendingVerificationEmail);

  function markEmailVerificationPending(address: string) {
    setPendingVerificationEmail(address);
    savePendingVerificationEmail(address);
  }

  function clearEmailVerificationPending() {
    setPendingVerificationEmail(null);
    savePendingVerificationEmail(null);
  }

  async function rejectUnverifiedSession(user: User, message: string) {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserId(null);
    setUserEmail(null);
    markEmailVerificationPending(user.email ?? email);
    setAuthMessage({ tone: "info", text: message });
  }

  useEffect(() => {
    void refreshOwnerAccess().then((active) => {
      if (active) setPlan("PRO");
    });
  }, []);

  useEffect(() => {
    const syncPlan = () => {
      clearExpiredProDemo();
      setPlan(normalizeStoredPlan(localStorage.getItem(PLAN_STORAGE_KEY)));
    };
    window.addEventListener(SYNEXUS_PLAN_CHANGED, syncPlan);
    window.addEventListener("synexus-pro-demo-changed", syncPlan);
    return () => {
      window.removeEventListener(SYNEXUS_PLAN_CHANGED, syncPlan);
      window.removeEventListener("synexus-pro-demo-changed", syncPlan);
    };
  }, []);

  useEffect(() => {
    if (!authBusy) return;
    setAuthLoadPhrase("synexus");
    const id = window.setInterval(() => {
      setAuthLoadPhrase((p) => (p === "synexus" ? "sentinel" : "synexus"));
    }, 1400);
    return () => window.clearInterval(id);
  }, [authBusy]);

  async function refreshMarketSignals() {
    const marketFeed = await fetchMvpTokenFeed();
    setMarketTokens(marketFeed.all);
    const nextSentinelAlerts: SentinelAlertItem[] = marketFeed.all
      .filter(
        (token) =>
          token.guardianRisk !== "SAFE" ||
          (token.change24hPct != null && Math.abs(token.change24hPct) >= 12) ||
          (token.liquidityUsd != null && token.liquidityUsd <= 50_000),
      )
      .slice(0, 6)
      .map((token) => ({
        tokenSymbol: token.symbol,
        severity: token.guardianRisk === "DANGER" ? "DANGER" : "WARNING",
        note: getSentinelMessage(token.guardianRisk.toLowerCase()),
      }));
    setSentinelAlerts(nextSentinelAlerts);

    const generatedSignals: PaidSignal[] = marketFeed.trending.flatMap((token, idx) => [
      {
        id: `${token.id}-entry-${idx}`,
        title: `Entry timing signal: ${token.symbol}`,
        detail: `Momentum ${token.change24hPct.toFixed(2)}% with volume confirmation from DexScreener.`,
      },
      {
        id: `${token.id}-risk-${idx}`,
        title: `Liquidity stability model: ${token.symbol}`,
        detail: `Sentinel confidence ${token.confidence ?? 70}% with liquidity tracking and risk posture.`,
      },
    ]);
    setPaidSignals(generatedSignals.slice(0, 6));
  }

  async function loadData(sessionHint?: User) {
    try {
      try {
        await refreshMarketSignals();
      } catch {
        /* Market feed optional */
      }

      let user: User | null = sessionHint ?? null;
      if (!user) {
        try {
          user = await getCurrentUser();
        } catch {
          user = null;
        }
      }
      const demoSession = localStorage.getItem(DEMO_SESSION_KEY);

      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? null);
      } else if (demoSession) {
        setUserId(demoSession);
        setUserEmail(null);
        setOperatorName("there");
      } else {
        setUserId(null);
        setUserEmail(null);
        setOperatorName("there");
      }

      if (!user) return;

      if (!isEmailVerified(user)) {
        await rejectUnverifiedSession(
          user,
          "Verify your email before accessing Operator Link. Check your inbox for the confirmation link.",
        );
        return;
      }

      clearEmailVerificationPending();

      const profile = await fetchProfile(user.id);
      setOperatorName(resolveOperatorName(profile, user.email));
      const rawPlan = profile?.paid_plan ?? localStorage.getItem(PLAN_STORAGE_KEY) ?? "FREE";
      if (hasStoredOwnerGrant()) {
        setPlan("PRO");
      } else {
        const normalizedPlan = enforceStoredPlan(rawPlan, profile?.paid_plan === "PRO");
        setPlan(normalizedPlan);
      }
      notifySynexusPlanChanged();

      const watchlistRows = await fetchWatchlistTokens(user.id);
      setWatchlist(watchlistRows.map((r) => `${r.name}: ${r.token_symbol}`));

      const alertRows = await fetchGuardianAlerts();
      setAlerts(alertRows);

      const trackedRows = await fetchTrackedTokens();
      setTracked(trackedRows);
    } catch {
      /* hydration must never invalidate a successful auth */
    }
  }

  useEffect(() => {
    const demoSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoSession) {
      setUserId(demoSession);
      setUserEmail(null);
    }
    setSentinelIdle(getSentinelIdleMessage(Date.now()));
    void refreshMarketSignals().catch(() => {
      /* keep empty until next poll */
    });
    if (!hasSupabaseEnv || !supabase) return;

    void loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setAuthMessage({ tone: "info", text: "Choose a new access key to finish resetting." });
        return;
      }

      const signedInUser = session?.user ?? null;
      if (!signedInUser) {
        if (event === "SIGNED_OUT") {
          setUserId(null);
          setUserEmail(null);
          setPassword("");
        }
        return;
      }

      if (!isEmailVerified(signedInUser)) {
        if (event !== "SIGNED_OUT") {
          void signOut().catch(() => {
            /* session may already be cleared */
          });
        }
        markEmailVerificationPending(signedInUser.email ?? email);
        setUserId(null);
        setUserEmail(null);
        if (event === "SIGNED_IN") {
          setAuthMessage({
            tone: "info",
            text: "Confirm your email before signing in. Check your inbox for the verification link.",
          });
        }
        pendingAuthMethod.current = null;
        return;
      }

      clearEmailVerificationPending();
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUserId(signedInUser.id);
      setUserEmail(signedInUser.email ?? null);
      if (signedInUser.email) saveRememberedEmail(signedInUser.email);

      if (event === "SIGNED_IN") {
        setPassword("");
        setRecoveryMode(false);
        window.history.replaceState(null, "", window.location.pathname);
        const verifiedMessage = signedInUser.email
          ? `Welcome back — ${signedInUser.email}.`
          : "Synchronized with The Synexus.";
        setAuthMessage({
          tone: "success",
          text: verifiedMessage,
        });
        const method = pendingAuthMethod.current;
        pendingAuthMethod.current = null;
        if (method === "signup") {
          trackSiteEvent("sign_up", { userId: signedInUser.id, path: "/pulse" });
        } else if (method === "biometric") {
          trackSiteEvent("biometric_sign_in", { userId: signedInUser.id, path: "/pulse" });
        } else {
          trackSiteEvent("sign_in", { userId: signedInUser.id, path: "/pulse" });
        }
        if (session?.refresh_token && signedInUser.email) {
          void enrollBiometricAfterLogin(signedInUser.email, session.refresh_token).then(() => {
            void biometric.refresh();
          });
        }
      }

      void loadData(signedInUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const pollMs = plan === "PRO" ? 8_000 : 12_000;
    const id = window.setInterval(() => {
      void refreshMarketSignals().catch(() => {
        /* keep last good read */
      });
    }, pollMs);
    return () => window.clearInterval(id);
  }, [plan]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const checkoutPlan = normalizeStoredPlan(params.get("plan"));

    if (checkoutStatus === "cancel") {
      setAuthMessage({ tone: "info", text: "Checkout canceled. Your plan was not changed." });
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    if (checkoutStatus !== "success" || checkoutPlan !== "PRO") return;

    if (!hasSupabaseEnv) {
      setAuthMessage({
        tone: "info",
        text: "Checkout succeeded, but Supabase is not configured to remember the subscription.",
      });
      return;
    }

    if (!userId) {
      setAuthMessage({
        tone: "success",
        text: "Checkout succeeded. Sign in so Synexus can remember your subscription.",
      });
      return;
    }

    if (userId.startsWith("demo-")) {
      setAuthMessage({
        tone: "success",
        text: "Checkout succeeded. Sign in with a real account to link Synexus Pro.",
      });
      return;
    }

    updatePaidPlan(userId, "PRO")
      .then(() => {
        setPlan("PRO");
        recordTrustedPlanGrant("PRO", "stripe_checkout");
        localStorage.setItem(PLAN_STORAGE_KEY, "PRO");
        notifySynexusPlanChanged();
        setAuthMessage({
          tone: "success",
          text: `${formatPlanName("PRO")} saved to your Synexus profile.`,
        });
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {
        setAuthMessage({ tone: "error", text: USER_FRIENDLY_ERROR });
      });
  }, [userId]);

  async function handleOwnerUnlock() {
    if (authBusy) return;
    if (!email || !password) {
      setAuthMessage({ tone: "error", text: "Enter your command ID and key." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Verifying command code…" });
      const result = await unlockOwnerAccess(email, password);
      if (!result.ok) {
        setAuthMessage({ tone: "error", text: result.message });
        return;
      }
      setPlan("PRO");
      setAuthMessage({ tone: "success", text: result.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function completeAuthWithBiometricOffer(
    session: { refresh_token?: string | null } | null | undefined,
    authEmail: string,
    baseMessage: string,
  ) {
    if (!session?.refresh_token || !authEmail) {
      setAuthMessage({ tone: "success", text: baseMessage });
      return;
    }

    if (await isBiometricLoginEnabled()) {
      void refreshBiometricVaultToken(authEmail, session.refresh_token);
      void biometric.refresh();
      setAuthMessage({ tone: "success", text: baseMessage });
      return;
    }

    const support = await getBiometricSupport();
    if (!support.available) {
      setAuthMessage({ tone: "success", text: baseMessage });
      return;
    }

    setAuthMessage({
      tone: "info",
      text: `${baseMessage} Set up ${support.label} for faster sign-in next time…`,
    });

    const enrollResult = await enrollBiometricAfterLogin(authEmail, session.refresh_token);
    void biometric.refresh();

    if (enrollResult === "enrolled") {
      setAuthMessage({
        tone: "success",
        text: `${baseMessage} ${support.label} is ready — use it next time you return.`,
      });
      return;
    }

    if (enrollResult === "cancelled") {
      setAuthMessage({
        tone: "success",
        text: `${baseMessage} Enable ${support.label} anytime from Operator link.`,
      });
      return;
    }

    setAuthMessage({ tone: "success", text: baseMessage });
  }

  async function handleSignUp() {
    if (authBusy) return;
    if (!email || !password) {
      setAuthMessage({ tone: "error", text: "Enter an email and password before signing up." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Connecting to Synexus..." });
      if (!hasSupabaseEnv) {
        const demoId = `demo-${Date.now()}`;
        localStorage.setItem(DEMO_SESSION_KEY, demoId);
        setUserId(demoId);
        setUserEmail(null);
        const message =
          "Demo session started. Add Supabase keys on the server to create a real account.";
        setAuthMessage({ tone: "success", text: message });
        return;
      }
      pendingAuthMethod.current = "signup";
      const result = await signUpWithEmail(email, password);
      localStorage.removeItem(DEMO_SESSION_KEY);
      const signupUser = result.session?.user ?? result.user ?? null;
      const signupEmail = signupUser?.email ?? email;
      setPassword("");
      const needsVerification = !signupUser || !isEmailVerified(signupUser);
      if (needsVerification) {
        if (result.session && signupUser && supabase) {
          await supabase.auth.signOut();
        }
        setUserId(null);
        setUserEmail(null);
        markEmailVerificationPending(signupEmail);
        saveRememberedEmail(signupEmail);
        setAuthMessage({
          tone: "success",
          text: `Check ${signupEmail} for a verification link. Operator Link stays locked until you confirm.`,
        });
        pendingAuthMethod.current = null;
        trackSiteEvent("sign_up", { path: "/pulse", meta: { pending_confirmation: true } });
        void refreshMarketSignals();
        return;
      }
      setUserId(signupUser!.id);
      setUserEmail(signupEmail);
      saveRememberedEmail(signupEmail);
      if (result.session && signupUser) {
        try {
          await upsertSignupProfile(signupUser.id, signupEmail, "");
        } catch {
          /* profile row may already exist */
        }
      }
      const message = "Welcome to The Synexus. You are signed in.";
      if (result.session && signupUser) {
        void loadData(signupUser);
        await completeAuthWithBiometricOffer(result.session, signupEmail, message);
      } else {
        setAuthMessage({ tone: "success", text: message });
        pendingAuthMethod.current = null;
        trackSiteEvent("sign_up", { path: "/pulse" });
        void refreshMarketSignals();
      }
    } catch (err) {
      pendingAuthMethod.current = null;
      const friendlyMessage =
        (err as Error).message?.toLowerCase().includes("rate")
          ? "Too many sign-up attempts. Please wait a minute before trying again."
          : describeAuthError(err);
      setAuthMessage({ tone: "error", text: friendlyMessage });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignIn() {
    if (authBusy) return;
    if (!email || !password) {
      setAuthMessage({ tone: "error", text: "Enter an email and password before signing in." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Connecting to Synexus..." });
      if (!hasSupabaseEnv) {
        const demoId = localStorage.getItem(DEMO_SESSION_KEY) ?? `demo-${Date.now()}`;
        localStorage.setItem(DEMO_SESSION_KEY, demoId);
        setUserId(demoId);
        setUserEmail(null);
        const message =
          "Demo session active. Add Supabase keys to sign in with email and password.";
        setAuthMessage({ tone: "success", text: message });
        return;
      }
      pendingAuthMethod.current = "password";
      const result = await signInWithEmail(email, password);
      localStorage.removeItem(DEMO_SESSION_KEY);
      const signedIn = result.session?.user ?? result.user ?? null;
      if (!signedIn) {
        setAuthMessage({
          tone: "error",
          text: "Sign-in did not finish. Confirm your email or reset your password.",
        });
        return;
      }
      if (!isEmailVerified(signedIn)) {
        pendingAuthMethod.current = null;
        await rejectUnverifiedSession(
          signedIn,
          "Confirm your email before signing in. Check your inbox for the verification link.",
        );
        return;
      }
      clearEmailVerificationPending();
      setUserId(signedIn.id);
      setUserEmail(signedIn.email ?? email);
      saveRememberedEmail(signedIn.email ?? email);
      setPassword("");
      const message = signedIn.email
        ? `Synchronized as ${signedIn.email}.`
        : "Synchronized with The Synexus.";
      void loadData(signedIn);
      await completeAuthWithBiometricOffer(result.session, signedIn.email ?? email, message);
    } catch (err) {
      pendingAuthMethod.current = null;
      const message = describeAuthError(err);
      setAuthMessage({ tone: "error", text: message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleBiometricSignIn() {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Verifying biometrics…" });
      const vault = await loadBiometricRefreshToken();
      if (!vault?.refreshToken) {
        setAuthMessage({
          tone: "error",
          text: "No saved login found. Sign in with email once, then enable biometric sign-in.",
        });
        return;
      }
      pendingAuthMethod.current = "biometric";
      const { session, user } = await restoreSessionFromRefreshToken(vault.refreshToken);
      const signedIn = user ?? session?.user ?? null;
      if (!signedIn) {
        pendingAuthMethod.current = null;
        await clearBiometricLogin();
        void biometric.refresh();
        setAuthMessage({
          tone: "error",
          text: "Saved login expired. Sign in with email again, then re-enable biometrics.",
        });
        return;
      }
      if (!isEmailVerified(signedIn)) {
        pendingAuthMethod.current = null;
        await rejectUnverifiedSession(
          signedIn,
          "Confirm your email before using biometric sign-in. Check your inbox for the verification link.",
        );
        return;
      }
      clearEmailVerificationPending();
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUserId(signedIn.id);
      setUserEmail(signedIn.email ?? vault.email);
      setEmail(vault.email);
      setAuthMessage({
        tone: "success",
        text: signedIn.email
          ? `Welcome back — ${signedIn.email}.`
          : "Welcome back to The Synexus.",
      });
      if (session?.refresh_token) {
        void refreshBiometricVaultToken(signedIn.email ?? vault.email, session.refresh_token);
      }
      void loadData(signedIn);
      void biometric.refresh();
    } catch (err) {
      pendingAuthMethod.current = null;
      const message =
        err instanceof Error ? err.message : "Biometric sign-in failed. Try email instead.";
      setAuthMessage({ tone: "error", text: message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEnableBiometric() {
    if (authBusy || !userId || userId.startsWith("demo-")) return;
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Setting up biometric sign-in…" });
      const emailForVault = userEmail ?? (await getCurrentUser())?.email ?? email;
      if (!emailForVault) {
        setAuthMessage({ tone: "error", text: "Sign in with email before enabling biometrics." });
        return;
      }
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.refresh_token) {
        setAuthMessage({ tone: "error", text: "Active session missing. Sign in again first." });
        return;
      }
      await enableBiometricLogin(emailForVault, session.refresh_token);
      void biometric.refresh();
      setAuthMessage({
        tone: "success",
        text: `${biometric.support?.label ?? "Biometric"} sign-in enabled for this device.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not enable biometric sign-in.";
      setAuthMessage({ tone: "error", text: message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleDisableBiometric() {
    if (authBusy) return;
    await clearBiometricLogin();
    void biometric.refresh();
    setAuthMessage({
      tone: "success",
      text: `${biometric.support?.label ?? "Biometric"} sign-in removed from this device.`,
    });
  }

  async function handleMagicLink() {
    if (authBusy) return;
    if (!email.trim()) {
      setAuthMessage({ tone: "error", text: "Enter your email to receive a sign-in link." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Sending secure sign-in link…" });
      if (!hasSupabaseEnv) {
        setAuthMessage({
          tone: "error",
          text: "Email links require Supabase on the server. Use demo mode or add your keys.",
        });
        return;
      }
      await signInWithMagicLink(email);
      saveRememberedEmail(email);
      setPassword("");
      trackSiteEvent("magic_link_sent", { path: "/pulse" });
      setAuthMessage({
        tone: "success",
        text: "Check your email for a one-time sign-in link. It expires quickly for your security.",
      });
    } catch (err) {
      setAuthMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (authBusy) return;
    if (!email.trim()) {
      setAuthMessage({ tone: "error", text: "Enter your email first, then request a reset link." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Sending password reset link…" });
      await requestPasswordReset(email);
      saveRememberedEmail(email);
      setPassword("");
      trackSiteEvent("password_reset_requested", { path: "/pulse" });
      setAuthMessage({
        tone: "success",
        text: "Reset link sent. Check your email and choose a new access key.",
      });
    } catch (err) {
      setAuthMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleUpdatePassword(newPassword: string) {
    if (authBusy) return;
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Updating access key…" });
      await updatePassword(newPassword);
      setPassword("");
      setRecoveryMode(false);
      window.history.replaceState(null, "", window.location.pathname);
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? null);
        void loadData(user);
      }
      setAuthMessage({ tone: "success", text: "Access key updated. Your session is secure." });
    } catch (err) {
      setAuthMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResendVerification() {
    if (authBusy) return;
    const target = pendingVerificationEmail ?? email.trim();
    if (!target) {
      setAuthMessage({ tone: "error", text: "Enter the email you used to sign up." });
      return;
    }
    try {
      setAuthBusy(true);
      setAuthMessage({ tone: "info", text: "Sending verification email…" });
      await resendSignupVerificationEmail(target);
      markEmailVerificationPending(target);
      setAuthMessage({
        tone: "success",
        text: "Verification email sent. Check your inbox and spam folder.",
      });
      trackSiteEvent("verification_email_resent", { path: "/pulse" });
    } catch (err) {
      setAuthMessage({ tone: "error", text: describeAuthError(err) });
    } finally {
      setAuthBusy(false);
    }
  }

  function handleContinueToSignIn() {
    clearEmailVerificationPending();
    setAuthMessage({
      tone: "info",
      text: "Sign in after you click the verification link in your email.",
    });
  }

  async function handleSignOut() {
    if (!userId) {
      setAuthMessage({ tone: "error", text: "No active session to sign out." });
      return;
    }
    const signingOutId = userId.startsWith("demo-") ? null : userId;
    if (!hasSupabaseEnv || userId.startsWith("demo-")) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUserId(null);
      setUserEmail(null);
      setPassword("");
      setWatchlist([]);
      setAlerts([]);
      setTracked([]);
      void biometric.refresh();
      trackSiteEvent("sign_out", { userId: signingOutId, path: "/pulse" });
      setAuthMessage({ tone: "success", text: "Operator link disconnected." });
      return;
    }
    try {
      await signOut();
      void biometric.refresh();
      localStorage.removeItem(DEMO_SESSION_KEY);
      setUserId(null);
      setUserEmail(null);
      setPassword("");
      setWatchlist([]);
      setAlerts([]);
      setTracked([]);
      setOperatorName("there");
      trackSiteEvent("sign_out", { userId: signingOutId, path: "/pulse" });
      setAuthMessage({ tone: "success", text: "Operator link disconnected." });
    } catch {
      setAuthMessage({ tone: "error", text: USER_FRIENDLY_ERROR });
    }
  }

  async function handleUpgradeTrigger() {
    if (checkoutBusy) return;
    const checkoutError = USER_FRIENDLY_ERROR;
    try {
      setCheckoutBusy(true);
      setAuthMessage({ tone: "info", text: "Opening secure checkout…" });
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? checkoutError);
      }
      window.location.href = data.url;
    } catch {
      setAuthMessage({ tone: "error", text: checkoutError });
    } finally {
      setCheckoutBusy(false);
    }
  }

  function handleOracleSupremeReport() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setOracleSpeaking(false);
    setOracleSupremeReportStamp(Date.now());
  }

  const warningCalls = tracked.filter((token) => token.guardian_status === "WARNING");
  const safeCalls = tracked.filter((token) => token.guardian_status === "SAFE");
  const dangerAlerts = alerts.filter((alert) => alert.severity?.toUpperCase() === "DANGER");
  const visibleSignals = paidSignals.map((signal) => ({
    ...signal,
    isLocked: plan !== "PRO",
  }));

  const sentinelSignals = useMemo(() => {
    let reportCount = 0;
    try {
      const localReports = localStorage.getItem(LOCAL_REPORTS_KEY);
      reportCount = localReports ? (JSON.parse(localReports) as unknown[]).length : 0;
    } catch {
      reportCount = 0;
    }

    return {
      watchlistCount: watchlist.length,
      alertCount: alerts.length + sentinelAlerts.length,
      trackedCount: tracked.length,
      reportCount,
      plan,
    };
  }, [alerts.length, plan, tracked.length, sentinelAlerts.length, watchlist.length]);

  const syntheticSentinels = useMemo(
    () => buildSyntheticSentinels(sentinelSignals),
    [sentinelSignals],
  );

  const sentinelLiveIntel = useMemo(
    () =>
      buildSentinelLiveIntel({
        sentinels: syntheticSentinels,
        tokens: marketTokens,
        sentinelAlerts,
        plan,
      }),
    [marketTokens, plan, sentinelAlerts, syntheticSentinels],
  );
  const oracleSupremeBriefing = useMemo(
    () => buildOracleSupremeBriefing(syntheticSentinels, sentinelSignals),
    [syntheticSentinels, sentinelSignals],
  );
  const oracleSupremeDailyReport = useMemo(
    () => buildOracleSupremeDailyReport(syntheticSentinels, sentinelSignals),
    [oracleSupremeReportStamp, syntheticSentinels, sentinelSignals],
  );

  const authBusyLabel =
    authLoadPhrase === "synexus" ? "Connecting to Synexus..." : "Synchronizing Sentinels...";

  return (
    <div className={`page${isSimple ? " page--easy" : ""}`}>
      <section className="page__intro">
        <h1 className="page__headline">{isSimple ? "Your tools" : "Sentinels"}</h1>
        <p className="page__lede">
          {isSimple
            ? "Scan tokens, check your wallet, and talk to Oracle — everything you need without the noise."
            : "Full command center — alerts, Sentinel grid, operator tools, and Oracle Supreme."}
        </p>
      </section>

      <ProTrialBanner />

      {isAdvanced ? (
        <SentinelAlertsHub
          tokens={marketTokens}
          extraAlerts={sentinelAlerts.map((alert) => ({
            symbol: alert.tokenSymbol,
            severity: alert.severity,
            note: alert.note,
          }))}
        />
      ) : null}

      <ShouldIBuyPanel poolTokens={marketTokens} initialScan={scanQuery} />
      <TopMoversPanel />
      <WalletPerformanceDashboard />
      <OracleAdminControlCenter
        plan={plan}
        briefing={pulseFormatSentinelNamesInText(oracleSupremeBriefing)}
        dailyReport={oracleSupremeDailyReport}
        syntheticSentinels={syntheticSentinels}
        sentinelLiveIntel={sentinelLiveIntel}
        marketTokenCount={marketTokens.length}
        alertCount={alerts.length + sentinelAlerts.length}
        checkoutBusy={checkoutBusy}
        onRefreshReport={handleOracleSupremeReport}
        onUpgrade={() => void handleUpgradeTrigger()}
        onSpeakingChange={setOracleSpeaking}
        speaking={oracleSpeaking}
        compact={isSimple}
      />

      {isSimple ? (
        <div className="ui-mode-hint ui-mode-hint--easy">
          <p>
            You&apos;re in <strong>Easy</strong> mode — we show only what beginners need. Flip to{" "}
            <strong>Advanced</strong> for live Sentinel alerts, watchlists, and the full operator grid.
          </p>
          <UIModeToggle compact />
        </div>
      ) : null}

      {isAdvanced ? (
        <>
      <section className="sentinel-grid-panel">
        <div className="token-section__head">
          <h2 className="token-section__title">Sentinels</h2>
          <p className="token-section__lede">
            Oracle Supreme commands each lane — live orders and reports every {plan === "PRO" ? "8" : "12"}s across{" "}
            {marketTokens.length || "all"} tracked pairs.
          </p>
        </div>
        <div className="synthetic-sentinels">
          {syntheticSentinels
            .filter((s) => !s.isOracleSupreme)
            .map((sentinel) => {
              const laneId = sentinelLaneIdFromSentinel(sentinel.id);
              const intel = laneId ? sentinelLiveIntel[laneId] : null;
              const progress =
                sentinel.level >= 5
                  ? 100
                  : Math.min(100, Math.round((sentinel.xp / sentinel.nextLevelXp) * 100));
              return (
                <article
                  className={`synthetic-sentinel synthetic-sentinel--${sentinel.accent}${intel?.hits ? " synthetic-sentinel--active" : ""}`}
                  key={sentinel.id}
                >
                  <div className="synthetic-sentinel__top">
                    <div>
                      <p className="synthetic-sentinel__name">
                        <span className="synthetic-sentinel__live-dot" aria-hidden />
                        {pulseSentinelDisplayName(sentinel.name)}
                      </p>
                      <p className="synthetic-sentinel__desc">{sentinel.role}</p>
                    </div>
                    <span className="synthetic-sentinel__level">
                      Lv {sentinel.level} {sentinel.levelName}
                    </span>
                  </div>
                  {intel ? (
                    <div className="synthetic-sentinel__stats" aria-label="Sentinel performance">
                      <span>{intel.responseMs}ms response</span>
                      <span>{intel.precision}% precise</span>
                      <span>{intel.scansPerMin}/min scans</span>
                    </div>
                  ) : null}
                  <div className="synthetic-sentinel__meter">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="synthetic-sentinel__status">{intel?.liveStatus ?? sentinel.status}</p>
                  {intel?.oracleDirective ? (
                    <p className="synthetic-sentinel__directive">
                      <span>Oracle order</span> {intel.oracleDirective}
                    </p>
                  ) : null}
                  {intel?.sentinelReport ? (
                    <p className="synthetic-sentinel__report">
                      <span>Report to Oracle</span> {intel.sentinelReport}
                      {intel.reportMs ? ` · ${intel.reportMs}ms` : ""}
                    </p>
                  ) : null}
                  {intel?.focusSymbol ? (
                    <p className="synthetic-sentinel__focus">Focus: {intel.focusSymbol}</p>
                  ) : null}
                  <p className="synthetic-sentinel__lesson">{sentinel.lesson}</p>
                  <p className="synthetic-sentinel__confidence">
                    {intel?.hits ?? 0} live hit{intel?.hits === 1 ? "" : "s"} · Level {progress}%
                  </p>
                </article>
              );
            })}
        </div>
      </section>

      <PulseOperatorLink
        userId={userId}
        operatorName={operatorName}
        userEmail={userEmail}
        plan={plan}
        email={email}
        password={password}
        authBusy={authBusy}
        authBusyLabel={authBusyLabel}
        authMessage={authMessage}
        hasSupabaseEnv={hasSupabaseEnv}
        biometricSupport={biometric.support}
        biometricEnrolled={biometric.enrolled}
        biometricEmailHint={biometric.emailHint}
        recoveryMode={recoveryMode}
        emailVerificationPending={emailVerificationPending}
        pendingVerificationEmail={pendingVerificationEmail}
        signupPasswordHint={signupPasswordHint}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSignUp={() => void handleSignUp()}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
        onOwnerUnlock={() => void handleOwnerUnlock()}
        onBiometricSignIn={() => void handleBiometricSignIn()}
        onEnableBiometric={() => void handleEnableBiometric()}
        onDisableBiometric={() => void handleDisableBiometric()}
        onMagicLink={() => void handleMagicLink()}
        onForgotPassword={() => void handleForgotPassword()}
        onUpdatePassword={(next) => void handleUpdatePassword(next)}
        onResendVerification={() => void handleResendVerification()}
        onContinueToSignIn={handleContinueToSignIn}
        ownerUnlocked={hasStoredOwnerGrant()}
      />

      <div className="pulse-card">
        <p className="pulse-card__title">Saved watchlist tokens</p>
        <p className="pulse-card__body">{watchlist.length ? watchlist.join(" · ") : "None yet."}</p>
      </div>

      <div className="pulse-card">
        <p className="pulse-card__title">Warnings</p>
        {warningCalls.length ? (
          <ul className="pulse-list">
            {warningCalls.map((token) => (
              <li key={`warning-${token.token_symbol}`}>
                <span>{token.token_symbol ?? "UNKNOWN"}</span>
                <strong>The Synexus · {synexusRiskBandLabel("WARNING")}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulse-card__body">{sentinelIdle}</p>
        )}
      </div>

      <div className="pulse-card">
        <p className="pulse-card__title">Safe calls</p>
        {safeCalls.length ? (
          <ul className="pulse-list">
            {safeCalls.map((token) => (
              <li key={`safe-${token.token_symbol}`}>
                <span>{token.token_symbol ?? "UNKNOWN"}</span>
                <strong>
                  The Synexus · {synexusRiskBandLabel(token.guardian_status ?? "SAFE")}
                  {typeof token.guardian_score === "number"
                    ? ` (${token.guardian_score}/100)`
                    : ""}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulse-card__body">{getSentinelMessage("safe")}</p>
        )}
      </div>

      <div className="pulse-card">
        <p className="pulse-card__title">Sentinel alerts (live feed)</p>
        {sentinelAlerts.length ? (
          <ul className="pulse-list">
            {sentinelAlerts.map((alert) => (
              <li key={`sentinel-alert-${alert.tokenSymbol}-${alert.severity}`}>
                <span>
                  {alert.tokenSymbol} - {alert.note}
                </span>
                <strong>{alert.severity}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulse-card__body">{getSentinelMessage("safe")}</p>
        )}
      </div>

      <div className="pulse-card">
        <p className="pulse-card__title">Live alerts</p>
        {alerts.length ? (
          <ul className="pulse-list">
            {alerts.map((alert, index) => (
              <li key={`alert-${alert.token_symbol ?? "token"}-${index}`}>
                <span>
                  {alert.token_symbol ?? "Unknown token"} - {alert.title ?? "Untitled alert"}
                </span>
                <strong>{alert.severity ?? "UNKNOWN"}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulse-card__body">No active alerts. Sentinels are scanning.</p>
        )}
        {dangerAlerts.length ? (
          <p className="pulse-card__body pulse-card__body--danger">
            {dangerAlerts.length} high-risk alert{dangerAlerts.length > 1 ? "s are" : " is"} active.
          </p>
        ) : null}
      </div>

      <div className="pulse-card pulse-synexus-pro-wrap" id="synexus-pro">
        <div className="pulse-synexus-pro-promo">
          <div className="pulse-synexus-pro-promo__honeycomb" aria-hidden />
          <p className="pulse-synexus-pro-promo__label">Synexus Pro</p>
          <p className="pulse-synexus-pro-promo__price">$19.99/month</p>
          <p className="pulse-synexus-pro-promo__headline">Unlimited trading intelligence. One simple price.</p>
          <p className="pulse-synexus-pro-promo__body">
            Unlock the full Synexus system with real-time Sentinel analysis, risk scanning, momentum tracking, whale
            activity signals, pattern detection, and unlimited trading intelligence tools.
          </p>
          <ul className="pulse-synexus-pro-promo__bullets">
            <li>Unlimited Synexus access</li>
            <li>Real-time Sentinel signals</li>
            <li>Scam and risk alerts</li>
            <li>Whale activity tracking</li>
            <li>Momentum and trend analysis</li>
            <li>Pattern recognition insights</li>
            <li>Fast trading links</li>
            <li>Priority platform updates</li>
          </ul>
          <div className="pulse-synexus-pro-promo__cta-wrap">
            {plan !== "PRO" ? (
              <>
                <ProDemoButton
                  className="pulse-demo-button pulse-demo-button--first pulse-synexus-pro-promo__demo"
                  label="Try 5-minute Pro demo — see everything"
                />
                <button
                  type="button"
                  className="pulse-button--pro pulse-synexus-pro-promo__cta"
                  disabled={checkoutBusy}
                  onClick={() => void handleUpgradeTrigger()}
                >
                  {checkoutBusy ? "Opening…" : "Subscribe — $19.99/month"}
                </button>
              </>
            ) : isProDemoActive() ? (
              <>
                <p className="pulse-synexus-pro-promo__active">Pro demo running — full access unlocked.</p>
                <button
                  type="button"
                  className="pulse-button--pro pulse-synexus-pro-promo__cta"
                  disabled={checkoutBusy}
                  onClick={() => void handleUpgradeTrigger()}
                >
                  {checkoutBusy ? "Opening…" : "Keep Pro — Subscribe"}
                </button>
              </>
            ) : (
              <p className="pulse-synexus-pro-promo__active">Synexus Pro is active on your account.</p>
            )}
          </div>
          <p className="pulse-synexus-pro-promo__disclaimer">
            Cancel anytime. No financial advice. Trade at your own risk.
          </p>
        </div>
        <p className="pulse-card__body pulse-synexus-pro-wrap__plan">Current plan: {formatPlanName(plan)}</p>
        {visibleSignals.length ? (
          <ul className="pulse-list">
            {visibleSignals.map((signal) => (
              <li key={signal.id}>
                <span>
                  {signal.title} — {signal.detail}
                </span>
                {signal.isLocked ? (
                  <strong>Included in Synexus Pro</strong>
                ) : (
                  <strong>Unlocked</strong>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulse-card__body">Sentinels are scanning for Synexus Pro signal candidates.</p>
        )}
      </div>
        </>
      ) : null}
    </div>
  );
}
