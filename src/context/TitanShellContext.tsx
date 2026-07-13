import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  ORACLE_CLOSE_CHAT_EVENT,
  ORACLE_OPEN_CHAT_EVENT,
  ORACLE_OPEN_LOGIN_EVENT,
  scrollHomeSignInIntoView,
} from "../lib/openOracleLogin";

export type TitanSheetMode = "chat" | "login";

type TitanShellContextValue = {
  sheetOpen: boolean;
  sheetMode: TitanSheetMode;
  openChat: () => void;
  openLogin: () => void;
  closeSheet: () => void;
};

const TitanShellContext = createContext<TitanShellContextValue | null>(null);

export function TitanShellProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<TitanSheetMode>("chat");

  const openChat = useCallback(() => {
    setSheetMode("chat");
    setSheetOpen(true);
  }, []);

  const openLogin = useCallback(() => {
    if (location.pathname === "/") {
      scrollHomeSignInIntoView();
      return;
    }
    setSheetMode("login");
    setSheetOpen(true);
  }, [location.pathname]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    window.dispatchEvent(new Event(ORACLE_CLOSE_CHAT_EVENT));
  }, []);

  useEffect(() => {
    function onOpenChat() {
      setSheetMode("chat");
      setSheetOpen(true);
    }
    function onOpenLogin() {
      if (location.pathname === "/") {
        scrollHomeSignInIntoView();
        return;
      }
      setSheetMode("login");
      setSheetOpen(true);
    }
    window.addEventListener(ORACLE_OPEN_CHAT_EVENT, onOpenChat);
    window.addEventListener(ORACLE_OPEN_LOGIN_EVENT, onOpenLogin);
    return () => {
      window.removeEventListener(ORACLE_OPEN_CHAT_EVENT, onOpenChat);
      window.removeEventListener(ORACLE_OPEN_LOGIN_EVENT, onOpenLogin);
    };
  }, [location.pathname]);

  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  const value = useMemo(
    () => ({ sheetOpen, sheetMode, openChat, openLogin, closeSheet }),
    [sheetOpen, sheetMode, openChat, openLogin, closeSheet],
  );

  return <TitanShellContext.Provider value={value}>{children}</TitanShellContext.Provider>;
}

export function useTitanShell(): TitanShellContextValue {
  const ctx = useContext(TitanShellContext);
  if (!ctx) {
    throw new Error("useTitanShell must be used within TitanShellProvider");
  }
  return ctx;
}
