/** Public site copy and contact defaults (override via env where noted). */

export const PUBLIC_SITE_URL =
  (import.meta.env.VITE_APP_ORIGIN as string | undefined)?.trim() || "https://synexus.pro";

export const OPERATOR_LABEL = "Synexus and its operator(s)";

export const LEGAL_EFFECTIVE_DATE = "June 12, 2026";

export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "support@synexus.pro";

export const TRUST_INDICATORS = [
  {
    id: "non-custodial",
    label: "Non-custodial",
    detail: "Synexus never holds your SOL or tokens.",
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
    label: "Risk-first design",
    detail: "Sentinel scans and scores surface before you ape.",
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
    body: "The Synexus Sentinels monitor liquidity, whale concentration, volume spikes, and community reports across Solana tokens.",
  },
  {
    step: 2,
    title: "Read the risk score",
    body: "Each token gets a Sentinel risk band, score, and reasons — so you know what you are buying before you connect a wallet.",
  },
  {
    step: 3,
    title: "Connect your wallet",
    body: "Use Phantom, Solflare, Backpack, or another Solana wallet. Synexus does not store seed phrases or private keys.",
  },
  {
    step: 4,
    title: "Trade on your terms",
    body: "Buy and sell through Jupiter shortcuts. You review and sign every transaction — Synexus routes intel, not custody.",
  },
  {
    step: 5,
    title: "Ask Oracle Supreme",
    body: "The AI assistant explains tokens, Sentinel reads, and market context. Outputs are informational — not financial advice.",
  },
] as const;

export const SECURITY_POINTS = [
  "Synexus is a non-custodial intelligence layer — we do not execute trades or hold user assets.",
  "Wallet connections happen in third-party wallet apps; private keys never pass through Synexus servers.",
  "Operator accounts (email sign-in on Pulse) store profile, watchlists, and subscription status — not wallet seeds.",
  "Market data and Sentinel scoring use heuristics and third-party APIs; outputs can be wrong or delayed.",
  "Report suspicious tokens in-app; abuse and security incidents can be escalated via Contact.",
  "Keep your wallet software updated, verify mint addresses, and never share seed phrases with anyone claiming to be Synexus support.",
] as const;

export const PRIVACY_HIGHLIGHTS = [
  "We collect account email and usage logs to operate Pulse, Pro, and Operator Link.",
  "Payment metadata comes from Stripe; we do not store full card numbers.",
  "Some preferences and chat history may stay on your device via local storage.",
  "We do not sell personal information. See the full Privacy Policy for retention and your rights.",
] as const;

export const FAQ_ITEMS = [
  {
    q: "What is “Should I buy this?”",
    a: "Paste any Solana mint or symbol and Synexus returns Avoid, Watch, or OK in plain English — plus risk score, whale activity, liquidity, and rug-pull flags. It is a research shortcut, not a buy order.",
  },
  {
    q: "Does Synexus hold my crypto?",
    a: "No. Synexus is non-custodial. Your tokens stay in wallets you control. We provide scanning, alerts, and trade shortcuts — you sign every on-chain action.",
  },
  {
    q: "Which wallets are supported?",
    a: "Any Solana wallet that works with Jupiter — including Phantom, Solflare, and Backpack. Synexus opens swap flows; your wallet app handles signing.",
  },
  {
    q: "What is Synexus Pro?",
    a: "Synexus Pro ($19.99/month, cancel anytime) unlocks Oracle briefings, the full Sentinel grid, faster refresh, reduced trading fees (0.05% vs 0.10% free tier), and priority surfaces on Pulse.",
  },
  {
    q: "How do I cancel Synexus Pro?",
    a: "Cancel through the same checkout or payment portal you used to subscribe (for example Stripe customer portal linked from Pulse). Access continues until the end of the paid billing period.",
  },
  {
    q: "Is Sentinel, Oracle Supreme, or “Avoid / Watch / OK” financial advice?",
    a: "No. Automated risk bands, scores, verdicts, and AI chat are informational tools only. They can be wrong or delayed. Always verify contracts and do your own research before trading.",
  },
  {
    q: "Is Synexus on Android / Google Play?",
    a: "Synexus is available as a web app and Android app (Capacitor). Check Google Play for the latest listing under Synexus. iOS may follow.",
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
    a: "SYN is live on pump.fun — join the $SyN community from the home feed banner or About page. Always verify the mint address in-app before trading. Utility roadmap is on the About page.",
  },
  {
    q: "Where is the SYN token roadmap?",
    a: "On the About page under Syn coin roadmap. Token utility and treasury allocation are documented separately from app features.",
  },
] as const;

export const SYN_COIN_ROADMAP = [
  {
    phase: "Phase 1 · Foundation",
    status: "Live on pump.fun",
    items: [
      "SYN community token launched on pump.fun",
      "Synexus app: feed, Sentinels, Oracle Supreme, Pro subscriptions",
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
