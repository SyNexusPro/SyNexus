import { useCallback } from "react";
import { useTitanShell } from "../context/TitanShellContext";

/** Opens login sheet, or closes it if login is already open. */
export function useOpenTitanGate() {
  const { sheetOpen, sheetMode, openLogin, closeSheet } = useTitanShell();
  return useCallback(() => {
    if (sheetOpen && sheetMode === "login") {
      closeSheet();
      return;
    }
    openLogin();
  }, [sheetOpen, sheetMode, openLogin, closeSheet]);
}
