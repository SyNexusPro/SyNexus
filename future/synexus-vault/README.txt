SyNexus Vault / SyN Wallet — back burner
========================================

Self-custodial wallet design and draft legal terms live here until launch.

Draft files:
  walletPolicy.ts      — route constants (not wired to production nav yet)
  WalletTerms.draft.tsx — full wallet terms outline for counsel review

Implementation code moved to:
  ../syn-wallet/

Production shows /wallet-terms (and /wallet) as "Coming soon" only.

Sentinel Helix (wallet & key security lane) is live in the app grid —
see src/config/sentinelHelix.ts — even while the wallet UI is parked.

When ready to launch:
  1. Legal review of WalletTerms.draft.tsx
  2. Move ../syn-wallet/src/* back into src/
  3. Wire App.tsx + BottomNav + SynWalletProvider
  4. Update Trust, Privacy, Terms for live wallet copy
  5. Mobile-only key storage — never browser localStorage for seeds
