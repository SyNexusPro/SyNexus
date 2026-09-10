import { DEEP_SCAN_FREE_LIMIT } from "./deepScanDemo";
import { SYNEXUS_PRO_TRIAL_DAYS } from "./proTrial";

export type ResearchTutorialVisual =
  | "welcome"
  | "paste"
  | "scan"
  | "verdict"
  | "does"
  | "does-not";

export type ResearchTutorialStep = {
  id: string;
  visual: ResearchTutorialVisual;
  caption: string;
  narration: string;
};

/** Voice-over script for the token research scanner tutorial. */
export const RESEARCH_TOKEN_TUTORIAL_STEPS: readonly ResearchTutorialStep[] = [
  {
    id: "welcome",
    visual: "welcome",
    caption: "Research any Solana token before you ape.",
    narration:
      "Welcome to SyNexus token research. Paste any Solana token and the Sentinels return Avoid, Watch, or OK in plain English within seconds.",
  },
  {
    id: "paste",
    visual: "paste",
    caption: "Paste a symbol like BONK, or the full mint address.",
    narration:
      "How to use it: copy a token symbol like BONK, PEPE, or SOL — or paste the full mint address from DexScreener or your wallet. Drop it in the box and tap Scan.",
  },
  {
    id: "scan",
    visual: "scan",
    caption: "Sentinels pull live liquidity, momentum, and risk signals.",
    narration:
      "SyNexus looks up live market data, then runs it through Sentinel lanes — liquidity health, momentum, whale concentration, and rug-style warning patterns.",
  },
  {
    id: "verdict",
    visual: "verdict",
    caption: "You get Avoid, High risk, Watch, or OK — plus health bars.",
    narration:
      "You get a clear verdict: Avoid, High risk, Watch, or OK. Health bars show liquidity, momentum, risk exposure, and whale activity — all in plain language, not jargon.",
  },
  {
    id: "does",
    visual: "does",
    caption: "What it does: early warnings, shareable scan links, faster decisions.",
    narration:
      "What it does for you: surfaces red flags before hype hits your wallet, helps you compare tokens quickly, and lets you share scan links with friends. Sign up for unlimited scans and watchlists.",
  },
  {
    id: "does-not",
    visual: "does-not",
    caption: "What it does not do: no trades, no keys, not financial advice.",
    narration: `What it does not do: SyNexus never holds your keys or buys for you. This is not financial advice — you sign every trade in your own wallet. Data can lag, and no scanner catches every scam. You still verify the mint yourself. Guests get ${DEEP_SCAN_FREE_LIMIT} free deep scans; sign up free for unlimited reads and a ${SYNEXUS_PRO_TRIAL_DAYS}-day Pro trial with card on file.`,
  },
];

export const RESEARCH_TUTORIAL_TOTAL_MS = RESEARCH_TOKEN_TUTORIAL_STEPS.length * 9000;
