import { useCallback, useEffect, useState } from "react";
import {
  getBiometricLoginEmailHint,
  getBiometricSupport,
  isBiometricLoginEnabled,
  type BiometricSupport,
} from "../lib/biometricLogin";

export function useBiometricLogin() {
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const nextSupport = await getBiometricSupport();
    const nextEnrolled = await isBiometricLoginEnabled();
    setSupport(nextSupport);
    setEnrolled(nextEnrolled);
    setEmailHint(nextEnrolled ? await getBiometricLoginEmailHint() : null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    support,
    enrolled,
    emailHint,
    refresh,
  };
}
