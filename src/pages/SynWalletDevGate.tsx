import { Navigate } from "react-router-dom";
import { SynWalletProvider } from "../context/SynWalletContext";
import { hasStoredOwnerGrant } from "../lib/ownerAccess";
import { SynWalletPage } from "./SynWallet";
import { CONNECT_WALLET_PATH } from "../config/connectWallet";

/**
 * Preserved SyN Wallet UI — owner/dev only for this release.
 * Public users are redirected to Connect Wallet. Vault data is not wiped.
 */
export function SynWalletDevGate() {
  if (!hasStoredOwnerGrant()) {
    return <Navigate to={CONNECT_WALLET_PATH} replace />;
  }
  return (
    <SynWalletProvider>
      <SynWalletPage />
    </SynWalletProvider>
  );
}
