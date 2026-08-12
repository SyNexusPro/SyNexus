/** Public site copy and contact defaults (override via env where noted). */

export const PUBLIC_SITE_URL =
  (import.meta.env.VITE_APP_ORIGIN as string | undefined)?.trim() || "https://www.synexus.pro";

export const OPERATOR_LABEL = "SyNexus and its operator(s)";

export const LEGAL_EFFECTIVE_DATE = "June 12, 2026";

export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ||
  "thesynexus@synexus.pro";

export const TRUST_INDICATORS = [
  {
    id: "non-custodial",
    label: "Non-custodial",
    detail: "SyNexus never holds your SOL or tokens.",
  },
  {
    id: "wallet-sign",
    label: "You sign every trade",
    detail: "Swaps execute in your wallet app — we cannot move funds.",
  },
  {
    id: "transparent-fees",
    label: "Transparent fees",
    detail: "Trading fee tiers published in-app before you swap.",
  },
  {
    id: "risk-first",
    label: "Aegis security lane",
    detail: "Sentinel Aegis scans scams, rugs, and privacy-safe operator hygiene.",
  },
] as const;

export const SUPPORTED_WALLETS = [
  {
    id: "phantom",
    name: "Phantom",
    url: "https://phantom.app/",
    icon: "/phantom-wallet.svg",
  },
  {
    id: "solflare",
    name: "Solflare",
    url: "https://solflare.com/",
    icon: null,
  },
  {
    id: "backpack",
    name: "Backpack",
    url: "https://backpack.app/",
    icon: null,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    url: "https://www.coinbase.com/wallet",
    icon: null,
  },
  {
    id: "ledger",
    name: "Ledger (via Phantom / Solflare)",
    url: "https://www.ledger.com/",
    icon: null,
  },
] as const;

export const HOW_SYNEXUS_WORKS = [
  {
    step: 1,
    title: "Scan the feed",
    body: "The SyNexus Sentinels monitor liquidity, whale concentration, volume spikes, and community reports across Solana tokens.",
  },
  {
    step: 2,
    title: "Read the risk score",
    body: "Each token gets a Sentinel risk band, score, and reasons — so you know what you are buying before you connect a wallet.",
  },
  {
    step: 3,
    title: "Connect your wallet",
    body: "Use Phantom, Solflare, Backpack, or another Solana wallet. SyNexus does not store seed phrases or private keys.",
  },
  {
    step: 4,
    title: "Trade on your terms",
    body: "Buy and sell through Jupiter shortcuts. You review and sign every transaction — SyNexus routes intel, not custody.",
  },
  {
    step: 5,
    title: "Talk to Titan",
    body: "The AI assistant explains tokens, Sentinel reads, and market context. Outputs are informational — not financial advice.",
  },
] as const;

export const SECURITY_POINTS = [
  "Sentinel Aegis is the security & privacy lane — scams, rugs, contracts, liquidity, and safe operator accounts.",
  "SyNexus is a non-custodial intelligence layer — we do not execute trades or hold user assets.",
  "Wallet connections happen in third-party wallet apps; private keys never pass through SyNexus servers.",
  "Operator accounts require email verification before Operator Link activates — unverified sign-ups cannot sync watchlists or Pro status.",
  "Operator accounts (email sign-in on Pulse) store profile, watchlists, and subscription status — not wallet seeds.",
  "Market data and Sentinel scoring use heuristics and third-party APIs; outputs can be wrong or delayed.",
  "Report suspicious tokens in-app; abuse and security incidents can be escalated via Contact.",
  "Keep your wallet software updated, verify mint addresses, and never share seed phrases with anyone claiming to be SyNexus support.",
] as const;

export const PRIVACY_HIGHLIGHTS = [
  "We collect account email and usage logs to operate Pulse, Pro, and Operator Link.",
  "Payment metadata comes from our subscription platform; we do not store full card numbers.",
  "Some preferences and chat history may stay on your device via local storage.",
  "We do not sell personal information. See the full Privacy Policy for retention and your rights.",
] as const;

export const FAQ_ITEMS = [
  {
    q: "What is the token scan?",
    a: "Paste any Solana mint or symbol and SyNexus returns Avoid, Watch, or OK in plain English — plus risk score, whale activity, liquidity, and rug-pull flags. It is a research shortcut, not a buy order.",
  },
  {
    q: "Does SyNexus hold my crypto?",
    a: "No. SyNexus is non-custodial. Your tokens stay in wallets you control. We provide scanning, alerts, and trade shortcuts — you sign every on-chain action.",
  },
  {
    q: "Which wallets are supported?",
    a: "Any Solana wallet that works with Jupiter — including Phantom, Solflare, and Backpack. SyNexus opens swap flows; your wallet app handles signing.",
  },
  {
    q: "What is SyNexusPro?",
    a: "SyNexusPro ($9.99/month, cancel anytime) unlocks Oracle briefings, the full Sentinel grid, faster refresh, reduced trading fees (0.05% vs 0.10% free tier), and priority surfaces on Pulse. After you sign up, you get a 7-day free Pro trial when you add a card at checkout.",
  },
  {
    q: "How do I cancel SyNexusPro?",
    a: "Cancel through the billing portal or subscription tools linked from Pulse (the provider shown at checkout). Access continues until the end of the paid billing period. See our Refund Policy for refund eligibility.",
  },
  {
    q: "What is SyNexus's refund policy?",
    a: "SyNexusPro is $9.99/month after the 7-day trial. Subscription fees are generally non-refundable once a billing period starts. We may refund duplicate or erroneous charges and other cases described in the Refund Policy at /refund-policy.",
  },
  {
    q: "Is Sentinel, Titan, or “Avoid / Watch / OK” financial advice?",
    a: "No. Automated risk bands, scores, verdicts, and AI chat are informational tools only. They can be wrong or delayed. Always verify contracts and do your own research before trading.",
  },
  {
    q: "Is SyNexus on Android / Google Play?",
    a: "SyNexus is available as a web app and Android app (Capacitor). Check Google Play for the latest listing under SyNexus. iOS may follow.",
  },
  {
    q: "How do I report a bug or scam token?",
    a: "Use the bug form on Contact, or report a token from its detail page when signed in on Pulse. Include mint address and steps to reproduce when possible.",
  },
  {
    q: "Who do I contact for support?",
    a: `Email ${SUPPORT_EMAIL} or use the Contact page. We cannot recover lost seed phrases or reverse blockchain transactions.`,
  },
  {
    q: "Where is the SYN token?",
    a: "SYN is live on Solana — find the mint from the home feed banner or About page. Always verify the mint address in-app before trading. Utility roadmap is on the About page.",
  },
  {
    q: "Where is the SYN token roadmap?",
    a: "On the About page under Syn coin roadmap. Token utility and treasury allocation are documented separately from app features.",
  },
  {
    q: "How do I spot a crypto scam before I buy?",
    a: "Verify the full mint address (not just the ticker), check liquidity depth and top-holder concentration, ignore DMs from fake support, and never share your seed phrase. SyNexus Journal has step-by-step guides — start with How to Spot Crypto Scams on Solana at /blog/how-to-spot-crypto-scams-on-solana.",
  },
  {
    q: "What are the SyNexus Sentinels?",
    a: "Aegis (token & account security), Pulse (momentum/volume), Leviathan (whale flows), Cipher (pattern fusion), and Helix (SyN Wallet key & signature security). They fuse into Avoid, Watch, or OK on the home scan panel — Helix watches your wallet vault separately.",
  },
  {
    q: "Can AI predict which token will moon?",
    a: "No. Titan and Sentinel outputs are research aids — they can be wrong, delayed, or incomplete. AI helps explain risk reads and compress data; it does not replace your judgment or on-chain verification.",
  },
  {
    q: "How many free deep scans do I get?",
    a: "Three deep scans before signup. Re-scanning the same token does not use another slot. Linked operator accounts with verified email get unlimited scans.",
  },
  {
    q: "Is SyNexus safe to connect my wallet to?",
    a: "SyNexus is non-custodial — we never receive your seed phrase. Wallet connections happen in your wallet app; you approve every transaction. Read our Trust page for security practices and supported wallets.",
  },
  {
    q: "Where can I learn Solana wallet safety?",
    a: "See the SyNexus Journal: Solana Wallet Security Basics and Phantom Wallet Safety Checklist at /blog. Our homepage also links education articles on scams, verification, and memecoin risk.",
  },
  {
    q: "Does SyNexus publish market analysis?",
    a: "Yes — weekly outlook and trading-education articles live on the Journal at /blog. They are informational framing, not buy/sell signals or price targets.",
  },
  {
    q: "What should I do if a token shows Avoid?",
    a: "Treat it as a structured harm read: multiple Sentinel lanes flagged elevated risk. It is not a ban — you can still trade — but understand why (liquidity, whales, patterns) before sizing any position.",
  },
  {
    q: "How do I verify a token before swapping?",
    a: "Use our five-minute checklist: confirm mint, run a token scan, check Solscan holders, verify official socials, then size for total loss. Full guide at /blog/how-to-verify-a-token-before-swapping.",
  },
] as const;

export const SYN_COIN_ROADMAP = [
  {
    phase: "Phase 1 · Foundation",
    status: "Live on Solana",
    items: [
      "SYN community token live on Solana",
      "SyNexus app: feed, Sentinels, Titan, Pro subscriptions",
      "Transparent trading fee model and treasury allocation policy",
      "Community reports and Operator Link accounts",
    ],
  },
  {
    phase: "Phase 2 · Utility",
    status: "Planned",
    items: [
      "SYN-gated Pro discounts and partner campaigns",
      "Staking program with published on-chain fee schedule",
      "Treasury routing to liquidity, dev, marketing, audits, reserve",
    ],
  },
  {
    phase: "Phase 3 · Network",
    status: "Planned",
    items: [
      "Expanded Sentinel data partnerships and whale tracking depth",
      "Governance placeholders as the community matures",
      "Cross-ecosystem affiliate and content hub payouts",
    ],
  },
] as const;
