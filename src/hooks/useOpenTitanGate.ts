import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  markTitanGateOpenIntent,
  openTitanGateInPlace,
} from "../lib/openOracleLogin";

/** SPA-safe navigation to the Pulse Titan login / command gate. */
export function useOpenTitanGate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    markTitanGateOpenIntent();
    const onPulse = location.pathname === "/pulse";
    if (!onPulse) {
      navigate({ pathname: "/pulse", hash: "#oracle-admin" });
      return;
    }
    openTitanGateInPlace();
  }, [location.pathname, navigate]);
}
