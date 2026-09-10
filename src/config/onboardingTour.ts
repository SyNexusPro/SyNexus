export const ONBOARDING_TOUR_KEY = "synexus_onboarding_tour_completed";

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

export function getOnboardingSteps(opts: { android: boolean; listenVisible: boolean }): OnboardingStep[] {
  const scanRoute = opts.android ? "/pulse" : "/";
  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to SyNexus",
      body: "Scan a token before you buy, talk to Hera, and keep watchlists on your operator account. This walkthrough highlights the real buttons — you can use them as we go.",
      target: "welcome-brand",
      route: "/",
    },
    opts.android
      ? {
          id: "scan",
          title: "Scan a token",
          body: "Tap Scan to open the command center. Paste a coin name or mint address to get Avoid, Watch, or OK in plain English.",
          target: "android-scan-card",
          route: "/",
          interactHint: "Tap Scan to open it, or press Next.",
        }
      : {
          id: "scan",
          title: "Scan a token",
          body: "Paste a Solana token name or mint address here. SyNexus returns Avoid, Watch, or OK — you always sign in your own wallet.",
          target: "scan-input",
          route: "/",
          interactHint: "Type a token, or tap BONK / SYN / SOL, then continue.",
        },
    {
      id: "scan-go",
      title: "Run the scan",
      body: "Hit Scan now when you’re ready. You can try it on this step — the tutorial stays with you.",
      target: "scan-submit",
      route: scanRoute,
      interactHint: "Tap Scan now to try it, then press Next.",
    },
  ];

  if (opts.listenVisible) {
    steps.push({
      id: "listen",
      title: "Talk to Hera",
      body: "Turn on Listen, then say “Hera” or “Titan”. She opens and hears you. If the mic is blocked, this same control lets you type instead.",
      target: "nav-listen",
      interactHint: "Tap Listen if you want her waiting — or skip this for later.",
    });
  }

  steps.push(
    {
      id: "login",
      title: "Save your account",
      body: "Log in to keep watchlists, unlimited scans, and Pro. You can explore without an account — this is here when you want it.",
      target: "nav-login",
      interactHint: "Tap Login to sign in, or press Next to keep going.",
    },
    {
      id: "hub",
      title: "Hub",
      body: "Affiliates, $SYN, and staking live here. The bottom bar is your map: Scan, Hub, Login, and Listen.",
      target: "hub-hero",
      route: "/hub",
    },
    {
      id: "done",
      title: "You’re set",
      body: "Scan before you buy, ask Hera when you want a second read, and use Hub for the ecosystem. Skip this tour anytime from the button below if you’d rather poke around.",
      target: null,
    },
  );

  return steps;
}
