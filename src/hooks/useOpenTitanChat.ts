import { useCallback } from "react";
import { useTitanShell } from "../context/TitanShellContext";

/** Opens Titan chat, or closes it if chat is already open. */
export function useOpenTitanChat() {
  const { sheetOpen, sheetMode, openChat, closeSheet } = useTitanShell();
  return useCallback(() => {
    if (sheetOpen && sheetMode === "chat") {
      closeSheet();
      return;
    }
    openChat();
  }, [sheetOpen, sheetMode, openChat, closeSheet]);
}
