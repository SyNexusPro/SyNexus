import { useTitanShell } from "../context/TitanShellContext";

/** Tracks whether the Titan chat sheet is open (bottom nav highlight). */
export function useTitanChatOpen(): boolean {
  const { sheetOpen, sheetMode } = useTitanShell();
  return sheetOpen && sheetMode === "chat";
}

/** Tracks whether the quick-login sheet is open. */
export function useTitanLoginOpen(): boolean {
  const { sheetOpen, sheetMode } = useTitanShell();
  return sheetOpen && sheetMode === "login";
}
