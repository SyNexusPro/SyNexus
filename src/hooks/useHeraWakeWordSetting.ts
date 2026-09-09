import { useCallback, useEffect, useState } from "react";
import { HERA_WAKE_CHANGED_EVENT, HERA_WAKE_CONSENT_EVENT } from "../config/heraWakeWord";
import {
  closeHeraWakeConsent,
  getHeraWakePermission,
  hasHeraWakeConsent,
  isHeraWakeConsentOpen,
  isHeraWakeEnabled,
  isHeraListenDocked,
  dockHeraListenToSettings,
  openHeraWakeConsent,
  probeMicrophonePermission,
  requestMicrophoneAccess,
  setHeraWakeConsent,
  setHeraWakeEnabled,
  setHeraWakePermission,
  HERA_WAKE_PERMISSION_EVENT,
  type HeraWakePermission,
} from "../lib/hera/wakeWord";

export function useHeraWakeWordSetting() {
  const [enabled, setEnabled] = useState(() => isHeraWakeEnabled());
  const [consented, setConsented] = useState(() => hasHeraWakeConsent());
  const [permission, setPermissionLocal] = useState<HeraWakePermission>(() => getHeraWakePermission());
  const [consentOpen, setConsentOpen] = useState(() => isHeraWakeConsentOpen());
  const [docked, setDocked] = useState(() => isHeraListenDocked() || isHeraWakeEnabled());

  const setPermission = useCallback((next: HeraWakePermission) => {
    setHeraWakePermission(next);
    setPermissionLocal(next);
  }, []);

  useEffect(() => {
    const sync = () => {
      setEnabled(isHeraWakeEnabled());
      setConsented(hasHeraWakeConsent());
      setDocked(isHeraListenDocked() || isHeraWakeEnabled());
    };
    const syncConsent = () => setConsentOpen(isHeraWakeConsentOpen());
    const syncPermission = () => setPermissionLocal(getHeraWakePermission());
    window.addEventListener(HERA_WAKE_CHANGED_EVENT, sync);
    window.addEventListener(HERA_WAKE_CONSENT_EVENT, syncConsent);
    window.addEventListener(HERA_WAKE_PERMISSION_EVENT, syncPermission);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HERA_WAKE_CHANGED_EVENT, sync);
      window.removeEventListener(HERA_WAKE_CONSENT_EVENT, syncConsent);
      window.removeEventListener(HERA_WAKE_PERMISSION_EVENT, syncPermission);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (isHeraWakeEnabled()) dockHeraListenToSettings();
  }, []);

  useEffect(() => {
    void probeMicrophonePermission().then((next) => {
      if (next !== "unknown") setPermission(next);
    });
  }, [enabled, setPermission]);

  const requestEnable = useCallback(() => {
    if (!hasHeraWakeConsent()) {
      openHeraWakeConsent();
      return;
    }
    void (async () => {
      const mic = await requestMicrophoneAccess();
      setPermission(mic);
      if (mic === "granted") setHeraWakeEnabled(true);
    })();
  }, [setPermission]);

  const acceptConsent = useCallback(() => {
    setHeraWakeConsent(true);
    setConsented(true);
    closeHeraWakeConsent();
    void (async () => {
      const mic = await requestMicrophoneAccess();
      setPermission(mic);
      if (mic === "granted") setHeraWakeEnabled(true);
    })();
  }, [setPermission]);

  const declineConsent = useCallback(() => {
    closeHeraWakeConsent();
    setHeraWakeEnabled(false);
  }, []);

  const disable = useCallback(() => {
    setHeraWakeEnabled(false);
    closeHeraWakeConsent();
  }, []);

  const toggle = useCallback(() => {
    if (isHeraWakeEnabled()) disable();
    else requestEnable();
  }, [disable, requestEnable]);

  return {
    enabled,
    consented,
    permission,
    consentOpen,
    docked,
    setPermission,
    requestEnable,
    acceptConsent,
    declineConsent,
    disable,
    toggle,
  };
}
