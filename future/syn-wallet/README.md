# SyN Wallet — on hold
======================

Self-custodial Solana wallet (create/import, PIN vault, send/receive).
Parked here until product green-lights launch.

Source (moved from `src/`):
  src/config/synWallet.ts
  src/context/SynWalletContext.tsx
  src/lib/synWallet/
  src/pages/SynWallet.tsx

Related:
  ../synexus-vault/ — draft legal terms
  ../../src/config/sentinelHelix.ts — Sentinel Helix (wallet security lane, live in the grid)

When ready to ship:
  1. Move these files back under `src/`
  2. Wire `/wallet` in App.tsx + BottomNav
  3. Wrap AppShell with SynWalletProvider
  4. Legal review of wallet terms
  5. Port Jupiter Ultra APIs from SIN Guardian starter if desired
