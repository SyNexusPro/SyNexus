export const ONBOARDING_TOUR_KEY = "synexus_onboarding_tour_completed";
export const ONBOARDING_TOUR_VOICE_KEY = "synexus_onboarding_tour_voice";

export type OnboardingStepId =
  | "welcome"
  | "scan"
  | "scan-go"
  | "listen"
  | "login"
  | "hub"
  | "done";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  body: string;
  /** Matches `[data-tour="…"]`. Null = centered card, no spotlight. */
  target: string | null;
  route?: string;
  /** Shown under the body when the spotlight is a real control. */
  interactHint?: string;
};

function scanStep(android: boolean): OnboardingStep {
  return android
    ? {
        id: "scan",
        title: "Check a coin",
        body: "Tap Scan to open your tools. Paste a coin name or its long ID to get Don’t buy, Wait, or Looks okay.",
        target: "android-scan-card",
        route: "/",
        interactHint: "Tap Scan to open it, or press Next.",
      }
    : {
        id: "scan",
        title: "Check a coin",
        body: "Paste a coin name or its long ID here. You’ll get a plain answer — and you always approve trades in your own wallet.",
        target: "scan-input",
        route: "/",
        interactHint: "Type a coin, or tap BONK / SYN / SOL, then continue.",
      };
}

function listenStep(): OnboardingStep {
  return {
    id: "listen",
    title: "Talk to Hera",
    body: "Turn on Listen, then say “Hera”. She opens and hears you. If the mic is blocked, this same control lets you type instead.",
    target: "nav-listen",
    interactHint: "Tap Listen if you want her waiting — or skip this for later.",
  };
}

function loginStep(): OnboardingStep {
  return {
    id: "login",
    title: "Save your account",
    body: "Sign in to keep watchlists, unlimited scans, and membership. You can explore without an account — this is here when you want it.",
    target: "nav-login",
    interactHint: "Tap Login to sign in, or press Next to keep going.",
  };
}

/**
 * First-run: Scan → Listen → Login (3 steps). Replay / ?tour=1 gets the fuller walkthrough.
 */
export function getOnboardingSteps(opts: {
  android: boolean;
  listenVisible: boolean;
  /** Compact first-run path (default false = full tour). */
  compact?: boolean;
}): OnboardingStep[] {
  const scanRoute = opts.android ? "/pulse" : "/";

  if (opts.compact) {
    const steps: OnboardingStep[] = [scanStep(opts.android)];
    if (opts.listenVisible) steps.push(listenStep());
    steps.push(loginStep());
    return steps;
  }

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to SyNexus",
      body: "Check a coin before you buy, talk to Hera, and save your stuff when you sign in. This walkthrough highlights the real buttons — you can tap them as we go.",
      target: "welcome-brand",
      route: "/",
    },
    scanStep(opts.android),
    {
      id: "scan-go",
      title: "Run the scan",
      body: "Hit Scan now when you’re ready. You can try it on this step — the tutorial stays with you.",
      target: "scan-submit",
      route: scanRoute,
      interactHint: "Tap Scan now to try it, then press Next.",
    },
  ];

  if (opts.listenVisible) steps.push(listenStep());

  steps.push(
    loginStep(),
    {
      id: "hub",
      title: "Hub",
      body: "Extras live here — invites, $SYN, and more. The bottom bar is your map: Scan, Hub, Login, and Listen.",
      target: "hub-hero",
      route: "/hub",
    },
    {
      id: "done",
      title: "You’re set",
      body: "Check a coin before you buy, ask Hera when you want a second opinion, and poke around Hub when you’re curious. Skip this tour anytime below.",
      target: null,
    },
  );

  return steps;
}
