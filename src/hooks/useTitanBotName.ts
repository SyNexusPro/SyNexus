import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TITAN_BOT_NAME } from "../config/titanBot";
import {
  readStoredTitanBotName,
  resetTitanBotName,
  resolveTitanBotName,
  saveTitanBotName,
  TITAN_BOT_NAME_CHANGED,
} from "../lib/titanBotName";

export function useTitanBotName() {
  const [name, setNameState] = useState(() => resolveTitanBotName());

  const sync = useCallback(() => {
    setNameState(resolveTitanBotName());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(TITAN_BOT_NAME_CHANGED, sync);
    return () => window.removeEventListener(TITAN_BOT_NAME_CHANGED, sync);
  }, [sync]);

  const setName = useCallback((next: string) => {
    setNameState(saveTitanBotName(next));
  }, []);

  const resetName = useCallback(() => {
    setNameState(resetTitanBotName());
  }, []);

  const isCustom = name !== DEFAULT_TITAN_BOT_NAME;

  return {
    name,
    setName,
    resetName,
    isCustom,
    storedName: readStoredTitanBotName(),
  };
}
